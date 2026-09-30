import { describe, expect, it } from "vitest";

import type { Actor, Job, Workflow } from "@/lib/domain";
import { consentContext, renderConsent } from "@/lib/describe";
import { buildJobPackage } from "@/lib/export";
import {
  addPhoto,
  createJob,
  GuardrailError,
  issueEstimate,
  issueInvoice,
  recordConsent,
  recordDelivery,
  recordDestinationChange,
  recordOwnerNotice,
  recordPayment,
  recordRequest,
  recordTowEvent,
  saveEstimateDraft,
  saveInvoiceDraft,
  startInvoiceDraft,
  updateDetails,
} from "@/lib/jobs";
import { jobSteps, nextHref } from "@/lib/job-steps";
import { calculateGst, parseDollars, totals } from "@/lib/money";
import { buildSeedState, seedCompany, seedConsentTemplates, seedRateCards, seedRequestTypes, seedWorkflows } from "@/lib/seed";
import {
  canRecordPayment,
  currentConsentTemplate,
  currentEstimate,
  DIFFERENCE_WARNING,
  differsFromEstimate,
  jobRecord,
  jobStatus,
  normalizeWorkflow,
  READY_MESSAGE,
  renderConsentWording,
  towGate,
  workflowStepLabels,
} from "@/lib/tow-rules";
import { fromLocalInput, toLocalInput } from "@/lib/time";
import { buildZip, crc32 } from "@/lib/zip";

const type = (id: string) => seedRequestTypes.find((t) => t.id === id)!;
const workflow = (id: string) => seedWorkflows.find((w) => w.id === id)!;
const standard = seedRateCards[0];
const club = seedRateCards[1];
const template = currentConsentTemplate(seedConsentTemplates);

let clock = Date.parse("2026-09-30T16:00:00Z");
const actor = (by = "Terry Boyd", role: Actor["role"] = "driver"): Actor => {
  clock += 60_000;
  return { by, role, device: "Phone", now: new Date(clock).toISOString() };
};

const SIG = "data:image/png;base64,AAAA";

function requested(requestTypeId = "owner_customer", reference = ""): Job {
  const rt = type(requestTypeId);
  const wf = workflow(rt.workflowId);
  const job = createJob({ number: "2001", actor: actor(), rateCard: standard, defaultDestination: "Summit yard — 1 Main St" });
  return recordRequest(job, actor(), { requestType: rt, workflow: wf, rateCard: seedRateCards.find((r) => r.id === wf.rateCardId)!, requestOther: "", contactName: "John Smith", contactReference: reference });
}

function detailedJob(requestTypeId = "owner_customer", reference = ""): Job {
  let job = requested(requestTypeId, reference);
  job = updateDetails(job, actor(), { customer: { name: "John Smith", mobile: "403-555-0199", email: "", relationship: "Owner", present: true } }, "customer");
  return updateDetails(
    job,
    actor(),
    { vehicle: { plate: "CKR 4821", province: "AB", make: "Ford", model: "F-150", year: "2019", colour: "Black" }, pickup: "Glenmore Trail SW", destinationConfirmedBy: "John Smith" },
    "vehicle",
  );
}

const issue = (job: Job) => issueEstimate(job, actor(), { storagePerDayCents: 4500, rateCardName: "Standard rates", notes: "Company note" });

function consentFields(job: Job) {
  const r = renderConsent(template, consentContext(seedCompany.name, job, currentEstimate(job)));
  return { templateVersion: r.templateVersion, heading: r.heading, wording: r.wording };
}

function consentedJob(): Job {
  let job = issue(detailedJob());
  job = recordDelivery(job, actor(), "estimate", "text", "403-555-0192");
  return recordConsent(job, actor(), { purpose: "estimate", name: "John Smith", relationship: "Owner", present: true, method: "signature", evidence: SIG, driverConfirmed: true, ...consentFields(job) });
}

function deliveredJob(): Job {
  let job = consentedJob();
  for (const event of ["arrived", "secured", "departed", "delivered"] as const) job = recordTowEvent(job, actor(), event);
  return job;
}

describe("money", () => {
  it("calculates GST at 5%, rounded to the cent", () => {
    expect(calculateGst(10000)).toBe(500);
    expect(calculateGst(12345)).toBe(617);
    // Base tow $125 + 14 km × $4.50 = $188.00; GST $9.40
    expect(totals([{ quantity: 1, unitCents: 12500 }, { quantity: 14, unitCents: 450 }])).toEqual({ subtotalCents: 18800, gstCents: 940, totalCents: 19740 });
  });

  it("parses typed dollar amounts into cents", () => {
    expect(parseDollars("$1,250.5")).toBe(125050);
    expect(parseDollars("12")).toBe(1200);
    expect(parseDollars("abc")).toBeNull();
    expect(parseDollars("1.234")).toBeNull();
  });
});

describe("company-configured workflows", () => {
  it("maps each request type to the workflow the company chose — no legal classification in code", () => {
    expect(requested("owner_customer").workflow?.letter).toBe("A");
    expect(requested("motor_club").workflow?.letter).toBe("B");
    expect(requested("police").workflow?.letter).toBe("C");
    expect(requested("private_property").workflow?.letter).toBe("D");
  });

  it("snapshots the workflow on the job so later config changes don't rewrite history", () => {
    const job = requested("owner_customer");
    seedWorkflows[0].name = "Renamed later";
    expect(job.workflow?.name).toBe("Customer-Requested Tow");
    seedWorkflows[0].name = "Customer-Requested Tow";
  });

  it("uses the workflow's rate card for the estimate draft", () => {
    const job = requested("motor_club", "RC-1");
    expect(job.estimateDraft.find((i) => i.id === "base")?.unitCents).toBe(club.baseTowCents);
  });

  it("shows the steps the company configured", () => {
    expect(workflowStepLabels(workflow("wf-a"))).toEqual(["Estimate", "Authorization / consent", "Tow", "Invoice", "Record"]);
    expect(workflowStepLabels(workflow("wf-c"))).toEqual(["Police file number", "Tow", "Invoice", "Record"]);
  });

  it("requiring consent always requires an estimate", () => {
    const w: Workflow = { ...workflow("wf-c"), requireConsent: true, requireEstimate: false };
    expect(normalizeWorkflow(w).requireEstimate).toBe(true);
  });

  it("only lists steps the workflow needs", () => {
    expect(jobSteps(requested("police")).map((s) => s.key)).toEqual(["request", "customer", "vehicle", "tow", "invoice"]);
    expect(jobSteps(requested("owner_customer")).map((s) => s.key)).toEqual(["request", "customer", "vehicle", "estimate", "send", "consent", "tow", "invoice"]);
  });

  it("requires a contact name, and the reference when the workflow asks for one", () => {
    const job = createJob({ number: "1", actor: actor(), rateCard: standard, defaultDestination: "" });
    expect(() => recordRequest(job, actor(), { requestType: type("police"), workflow: workflow("wf-c"), rateCard: standard, requestOther: "", contactName: " ", contactReference: "" })).toThrow(GuardrailError);
    const noRef = detailedJob("police");
    expect(towGate(noRef).checks.find((c) => c.key === "reference")?.ok).toBe(false);
    expect(nextHref(noRef, "vehicle")).toBe(`/jobs/${noRef.id}/tow`);
  });
});

describe("tow gate enforces the company's configured steps", () => {
  it("is locked on a new Workflow A job with the consent-missing banner", () => {
    const gate = towGate(detailedJob());
    expect(gate.canTow).toBe(false);
    expect(gate.message).toBe("Do not begin tow — consent missing.");
  });

  it("stays locked when the estimate was issued but never given to the customer", () => {
    const job = issue(detailedJob());
    expect(towGate(job).checks.find((c) => c.key === "estimate")?.ok).toBe(false);
    expect(() => recordConsent(job, actor(), { purpose: "estimate", name: "J", relationship: "Owner", present: true, method: "link", driverConfirmed: false, ...consentFields(job) })).toThrow(GuardrailError);
  });

  it("opens once estimate delivered, consent step completed and destination recorded", () => {
    const gate = towGate(consentedJob());
    expect(gate).toMatchObject({ canTow: true, message: READY_MESSAGE });
    expect(gate.checks.map((c) => c.label)).toEqual(["Estimate delivered", "Company consent step completed", "Destination recorded"]);
  });

  it("closes again when nobody is recorded as supplying the destination", () => {
    const job = updateDetails(consentedJob(), actor(), { destinationConfirmedBy: "" }, "x");
    expect(towGate(job)).toMatchObject({ canTow: false, message: "Do not begin tow — destination not recorded." });
  });

  it("requires new consent after the estimate is revised", () => {
    let job = consentedJob();
    job = saveEstimateDraft(job, job.estimateDraft.map((i) => (i.id === "winch" ? { ...i, quantity: 1 } : i)));
    job = issue(job);
    expect(job.estimates).toHaveLength(2);
    expect(job.estimates[0].supersededAt).toBeDefined();
    expect(towGate(job).canTow).toBe(false);
  });

  it("requires a revised estimate if the destination changes before the tow", () => {
    const job = updateDetails(consentedJob(), actor(), { destination: "Other shop — 9 Elm St" }, "x");
    expect(towGate(job).checks.find((c) => c.key === "destination")?.ok).toBe(false);
  });

  it("requires signature / audio / photo evidence and driver confirmation", () => {
    let job = issue(detailedJob());
    job = recordDelivery(job, actor(), "estimate", "device");
    const base = { purpose: "estimate" as const, name: "John", relationship: "Owner", present: true, method: "signature" as const, ...consentFields(job) };
    expect(() => recordConsent(job, actor(), { ...base, driverConfirmed: true })).toThrow(/evidence/);
    expect(() => recordConsent(job, actor(), { ...base, evidence: SIG, driverConfirmed: false })).toThrow(/confirm/);
  });

  it("lets the driver record arrival before consent but locks Vehicle secured", () => {
    let job = detailedJob();
    job = recordTowEvent(job, actor(), "arrived");
    expect(job.tow.arrived).toBeDefined();
    expect(() => recordTowEvent(job, actor(), "secured")).toThrow("Do not begin tow — consent missing.");
  });

  it("records tow times in order", () => {
    expect(() => recordTowEvent(consentedJob(), actor(), "secured")).toThrow(/previous step/);
  });

  it("a Workflow C (police) job needs the reference, not an estimate or consent — because the company configured it that way", () => {
    let job = detailedJob("police");
    expect(towGate(job).canTow).toBe(false);
    job = recordRequest(job, actor(), { requestType: type("police"), workflow: workflow("wf-c"), rateCard: standard, requestOther: "", contactName: "Cst. Patel", contactReference: "PF 26-1" });
    expect(towGate(job)).toMatchObject({ canTow: true });
    job = recordTowEvent(job, actor(), "arrived");
    expect(() => recordTowEvent(job, actor(), "secured")).not.toThrow();
  });
});

describe("consent templates", () => {
  it("fills the company's placeholders", () => {
    expect(renderConsentWording("I authorize {company} to tow {vehicle}. {unknown}", { company: "Summit", vehicle: "a truck" })).toBe("I authorize Summit to tow a truck. {unknown}");
  });

  it("records the template version and the exact wording shown", () => {
    const consent = consentedJob().consents[0];
    expect(consent.templateVersion).toBe(3);
    expect(consent.heading).toBe("Summit Towing Ltd. — Authorization / Consent");
    expect(consent.wording).toContain("I, John Smith, am the owner of the vehicle");
    expect(consent.wording).toContain("estimate #2001");
  });

  it("keeps historical consents on the wording that existed when captured", () => {
    const job = consentedJob();
    const v4 = { ...template, version: 4, body: "New wording" };
    expect(currentConsentTemplate([...seedConsentTemplates, v4]).version).toBe(4);
    expect(job.consents[0].wording).not.toBe("New wording");
    expect(job.consents[0].templateVersion).toBe(3);
  });
});

describe("during the tow", () => {
  it("locks pickup / destination edits once secured; moves are recorded as facts", () => {
    let job = consentedJob();
    job = recordTowEvent(job, actor(), "arrived");
    job = recordTowEvent(job, actor(), "secured");
    expect(() => updateDetails(job, actor(), { destination: "Elsewhere" }, "x")).toThrow(GuardrailError);
    expect(() => recordDestinationChange(job, actor(), { to: "Shop B", requestedBy: "", note: "", ownerNotifiedVia: "" })).toThrow();
    job = recordDestinationChange(job, actor(), { to: "Shop B", requestedBy: "John Smith (owner)", note: "Shop A closed", ownerNotifiedVia: "" });
    expect(job.destination).toBe("Shop B");
    expect(job.destinationChanges[0]).toMatchObject({ from: "Summit yard — 1 Main St", requestedBy: "John Smith (owner)" });
    // A recorded move must not lock the rest of the tow.
    job = recordTowEvent(job, actor(), "departed");
    job = recordTowEvent(job, actor(), "delivered");
    expect(jobRecord(job).problems).toContain("owner notice of move not recorded");
    job = recordOwnerNotice(job, actor(), job.destinationChanges[0].id, "Phone call");
    expect(jobRecord(job).problems).not.toContain("owner notice of move not recorded");
  });

  it("can't revise the estimate after the vehicle is secured", () => {
    let job = consentedJob();
    job = recordTowEvent(job, actor(), "arrived");
    job = recordTowEvent(job, actor(), "secured");
    expect(() => issue(job)).toThrow(GuardrailError);
  });
});

describe("invoice before payment", () => {
  it("can't issue an invoice before delivery", () => {
    expect(() => issueInvoice(startInvoiceDraft(consentedJob()), actor(), "")).toThrow(/after the vehicle is delivered/);
  });

  it("locks Record payment until the invoice is issued", () => {
    const job = startInvoiceDraft(deliveredJob());
    expect(canRecordPayment(job)).toEqual({ ok: false, reason: "Issue invoice before recording payment." });
    expect(() => recordPayment(job, actor(), { amountCents: 100, method: "Cash" })).toThrow(GuardrailError);
    const invoiced = issueInvoice(job, actor(), "");
    expect(invoiced.invoices[0].number).toBe("INV-2001");
    expect(() => recordPayment(invoiced, actor(), { amountCents: invoiced.invoices[0].totalCents, method: "Cash" })).not.toThrow();
  });

  it("shows a neutral message (never blocks) when the final amount differs, and clears after re-authorization", () => {
    let job = startInvoiceDraft(deliveredJob());
    job = saveInvoiceDraft(job, job.invoiceDraft!.map((i) => (i.id === "km" ? { ...i, quantity: i.quantity + 4 } : i)));
    const newTotal = totals(job.invoiceDraft!).totalCents;
    expect(differsFromEstimate(job, newTotal)).toBe(true);
    expect(DIFFERENCE_WARNING).toBe("Final amount differs from original estimate. Follow your company's configured approval process.");

    const reauthorized = recordConsent(job, actor(), {
      purpose: "revised_amount",
      name: "John Smith",
      relationship: "Owner",
      present: true,
      method: "audio",
      evidence: "data:audio/webm;base64,AAAA",
      driverConfirmed: true,
      amountCents: newTotal,
      ...consentFields(job),
    });
    expect(differsFromEstimate(reauthorized, newTotal)).toBe(false);
    // No percentage rule: issuing without re-authorization is allowed.
    expect(() => issueInvoice(job, actor(), "")).not.toThrow();
  });

  it("keeps issued invoices immutable; corrections create a new numbered version", () => {
    let job = issueInvoice(startInvoiceDraft(deliveredJob()), actor(), "");
    const original = job.invoices[0];
    job = startInvoiceDraft(job);
    job = saveInvoiceDraft(job, job.invoiceDraft!.map((i) => (i.id === "storage" ? { ...i, quantity: 3 } : i)));
    expect(job.invoices[0]).toEqual(original);
    job = issueInvoice(job, actor(), "");
    expect(job.invoices.map((i) => i.number)).toEqual(["INV-2001", "INV-2001-R1"]);
    expect(job.invoices[0].supersededAt).toBeDefined();
  });

  it("keeps issued estimates immutable when the draft changes", () => {
    const job = consentedJob();
    const issued = job.estimates[0];
    const edited = saveEstimateDraft(job, job.estimateDraft.map((i) => ({ ...i, quantity: i.quantity + 1 })));
    expect(edited.estimates[0]).toEqual(issued);
  });
});

describe("audit log", () => {
  it("appends one row per recorded action and never drops rows", () => {
    const job = deliveredJob();
    const before = job.audit.length;
    const invoiced = issueInvoice(startInvoiceDraft(job), actor("Dana Whitford", "owner"), "");
    expect(invoiced.audit.length).toBe(before + 1);
    expect(invoiced.audit.slice(0, before)).toEqual(job.audit);
    expect(invoiced.audit.at(-1)).toMatchObject({ by: "Dana Whitford", role: "owner", device: "Phone" });
  });

  it("attributes text and email delivery to the system", () => {
    const job = recordDelivery(issue(detailedJob()), actor(), "estimate", "text", "403-555-0199");
    expect(job.audit.at(-1)).toMatchObject({ by: "TowLedger", role: "system" });
    expect(job.audit.at(-1)!.action).toContain("requested by Terry Boyd");
  });
});

describe("seed data (Summit Towing Ltd.)", () => {
  const app = buildSeedState(Date.parse("2026-09-30T18:00:00Z"));
  const byNumber = (n: string) => app.jobs.find((j) => j.number === n)!;

  it("has complete jobs under Workflow A and Workflow C", () => {
    for (const n of ["1039", "1040"]) {
      expect(jobStatus(byNumber(n)).label).toBe("Complete");
      expect(jobRecord(byNumber(n))).toMatchObject({ complete: true, problems: [] });
    }
    expect(byNumber("1039").workflow?.letter).toBe("C");
  });

  it("has one job missing its invoice", () => {
    const job = byNumber("1041");
    expect(jobStatus(job).label).toBe("Missing invoice");
    expect(jobRecord(job).problems).toEqual(["invoice not issued"]);
  });

  it("has one motor-club job waiting for the customer", () => {
    const job = byNumber("1042");
    expect(jobStatus(job).label).toBe("Waiting for customer");
    expect(job.workflow?.letter).toBe("B");
  });

  it("keeps records for 3 years", () => {
    const job = byNumber("1040");
    expect(jobRecord(job).retainUntil.slice(0, 4)).toBe(String(new Date(job.createdAt).getUTCFullYear() + 3));
  });

  it("has consent template history V1–V3", () => {
    expect(app.consentTemplates.map((t) => [t.version, t.effectiveDate])).toEqual([
      [1, "2026-01-12"],
      [2, "2026-04-01"],
      [3, "2026-09-08"],
    ]);
  });
});

describe("record export", () => {
  it("packages documents, consent evidence, delivery record, photos and the activity log", () => {
    const app = buildSeedState(Date.parse("2026-09-30T18:00:00Z"));
    const job = app.jobs.find((j) => j.number === "1040")!;
    const files = buildJobPackage(app.company, job);
    const paths = files.map((f) => f.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        "job-1040/README.txt",
        "job-1040/estimate-v1.html",
        "job-1040/consent/consent-1.txt",
        "job-1040/invoice-INV-1040.html",
        "job-1040/customer-delivery-record.csv",
        "job-1040/photos/photo-1.svg",
        "job-1040/activity-log.csv",
      ]),
    );
    const zip = buildZip(files);
    expect(new DataView(zip.buffer).getUint32(0, true)).toBe(0x04034b50);
  });

  it("computes standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("includes photos added to the job", () => {
    const job = addPhoto(detailedJob(), actor(), { dataUrl: SIG, caption: "Damage" });
    expect(buildJobPackage(seedCompany, job).some((f) => f.path.endsWith("photos/photo-1.png"))).toBe(true);
  });
});

describe("Alberta time inputs", () => {
  it("round-trips datetime-local values through America/Edmonton", () => {
    const iso = "2026-09-30T20:14:00.000Z";
    expect(toLocalInput(iso)).toBe("2026-09-30T14:14");
    expect(fromLocalInput("2026-09-30T14:14")).toBe(iso);
    expect(fromLocalInput("2026-01-15T09:00")).toBe("2026-01-15T16:00:00.000Z");
  });
});
