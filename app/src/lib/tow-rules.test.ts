import { describe, expect, it } from "vitest";

import type { Actor, Job, RequestType } from "@/lib/domain";
import {
  createJob,
  GuardrailError,
  issueEstimate,
  issueInvoice,
  recordConsent,
  recordDelivery,
  recordDestinationChange,
  recordPayment,
  recordTowEvent,
  saveEstimateDraft,
  saveInvoiceDraft,
  startInvoiceDraft,
  updateDetails,
} from "@/lib/jobs";
import { calculateGst, parseDollars, totals } from "@/lib/money";
import { buildSeedState, seedRateCard, seedRequestTypes } from "@/lib/seed";
import {
  canRecordPayment,
  complianceFile,
  DIFFERENCE_WARNING,
  differsFromAuthorized,
  jobStatus,
  resolveWorkflow,
  towGate,
} from "@/lib/tow-rules";

const type = (id: string) => seedRequestTypes.find((t) => t.id === id)!;
const owner = type("owner_customer");
const police = type("police");

let clock = Date.parse("2026-09-30T16:00:00Z");
const actor = (by = "Ava Thompson"): Actor => {
  clock += 60_000;
  return { by, device: "Phone", now: new Date(clock).toISOString() };
};

const SIG = "data:image/png;base64,AAAA";

function detailedJob(requestType: RequestType = owner): Job {
  let job = createJob({ number: "TW-1", actor: actor(), rateCard: seedRateCard, defaultDestination: "Yard — 1 Main St" });
  job = updateDetails(job, actor(), { requestTypeId: requestType.id, invitedBy: "Vehicle owner or driver called us" }, "request");
  job = updateDetails(job, actor(), { customer: { name: "Jamie Clarke", mobile: "403-555-0192", email: "", relationship: "Owner", present: true } }, "customer");
  return updateDetails(
    job,
    actor(),
    { vehicle: { plate: "ABC 123", province: "AB", make: "Toyota", model: "Corolla", year: "2021", colour: "White" }, pickup: "17 Ave SW", destinationConfirmed: true },
    "vehicle",
  );
}

function consentedJob(): Job {
  let job = issueEstimate(detailedJob(), actor(), 3500);
  job = recordDelivery(job, actor(), "estimate", "text", "403-555-0192");
  return recordConsent(job, actor(), { purpose: "estimate", name: "Jamie Clarke", relationship: "Owner", present: true, method: "signature", evidence: SIG, driverConfirmed: true });
}

function deliveredJob(): Job {
  let job = consentedJob();
  for (const event of ["arrived", "secured", "departed", "delivered"] as const) job = recordTowEvent(job, actor(), owner, event);
  return job;
}

describe("money", () => {
  it("calculates GST at 5%, rounded to the cent", () => {
    expect(calculateGst(10000)).toBe(500);
    expect(calculateGst(12345)).toBe(617);
    expect(totals([{ quantity: 18, unitCents: 350 }, { quantity: 1, unitCents: 17500 }])).toEqual({ subtotalCents: 23800, gstCents: 1190, totalCents: 24990 });
  });

  it("parses typed dollar amounts into cents", () => {
    expect(parseDollars("$1,250.5")).toBe(125050);
    expect(parseDollars("12")).toBe(1200);
    expect(parseDollars("abc")).toBeNull();
    expect(parseDollars("1.234")).toBeNull();
  });
});

describe("classification comes from the request_types config", () => {
  it("only confirmed exempt types skip the consumer workflow", () => {
    expect(resolveWorkflow(police)).toEqual({ runs: "exempt", toConfirm: false });
    expect(resolveWorkflow(owner)).toEqual({ runs: "consumer", toConfirm: false });
    expect(resolveWorkflow(type("motor_club"))).toEqual({ runs: "consumer", toConfirm: true });
    expect(resolveWorkflow({ id: "x", label: "X", workflow: "exempt", legalStatus: "to_be_confirmed" })).toEqual({ runs: "consumer", toConfirm: true });
  });
});

describe("tow gate", () => {
  it("is locked on a new consumer job with the consent-missing banner", () => {
    const gate = towGate(detailedJob(), owner);
    expect(gate.canTow).toBe(false);
    expect(gate.message).toBe("Do not begin tow — consent missing.");
  });

  it("stays locked when the estimate was issued but never given to the customer", () => {
    const job = issueEstimate(detailedJob(), actor(), 3500);
    expect(towGate(job, owner).checks.find((c) => c.key === "estimate")?.ok).toBe(false);
    expect(() =>
      recordConsent(job, actor(), { purpose: "estimate", name: "J", relationship: "Owner", present: true, method: "link", driverConfirmed: false }),
    ).toThrow(GuardrailError);
  });

  it("opens once estimate sent, consent captured and destination confirmed", () => {
    expect(towGate(consentedJob(), owner)).toMatchObject({ canTow: true, message: "Tow may begin." });
  });

  it("closes again when the destination is unconfirmed", () => {
    const job = updateDetails(consentedJob(), actor(), { destinationConfirmed: false }, "x");
    expect(towGate(job, owner)).toMatchObject({ canTow: false, message: "Do not begin tow — destination not confirmed." });
  });

  it("requires new consent after the estimate is revised", () => {
    let job = consentedJob();
    job = saveEstimateDraft(job, job.estimateDraft.map((i) => (i.id === "winch" ? { ...i, quantity: 1 } : i)));
    job = issueEstimate(job, actor(), 3500);
    expect(job.estimates).toHaveLength(2);
    expect(job.estimates[0].supersededAt).toBeDefined();
    expect(towGate(job, owner).canTow).toBe(false);
  });

  it("requires a revised estimate if the destination changes before the tow", () => {
    const job = updateDetails(consentedJob(), actor(), { destination: "Joe's Auto — 9 Elm St", destinationConfirmed: true }, "x");
    expect(towGate(job, owner).checks.find((c) => c.key === "destination")?.ok).toBe(false);
  });

  it("requires signature / audio / photo evidence and driver confirmation", () => {
    let job = issueEstimate(detailedJob(), actor(), 3500);
    job = recordDelivery(job, actor(), "estimate", "device");
    const base = { purpose: "estimate" as const, name: "Jamie", relationship: "Owner", present: true, method: "signature" as const };
    expect(() => recordConsent(job, actor(), { ...base, driverConfirmed: true })).toThrow(/evidence/);
    expect(() => recordConsent(job, actor(), { ...base, evidence: SIG, driverConfirmed: false })).toThrow(/confirm/);
  });

  it("lets the driver record arrival before consent but locks Vehicle secured", () => {
    let job = detailedJob();
    job = recordTowEvent(job, actor(), owner, "arrived");
    expect(job.tow.arrived).toBeDefined();
    expect(() => recordTowEvent(job, actor(), owner, "secured")).toThrow("Do not begin tow — consent missing.");
  });

  it("records tow times in order", () => {
    expect(() => recordTowEvent(consentedJob(), actor(), owner, "secured")).toThrow(/previous step/);
  });

  it("exempt (police) jobs skip estimate and consent but must record the reason", () => {
    let job = detailedJob(police);
    expect(towGate(job, police).canTow).toBe(false);
    job = updateDetails(job, actor(), { exemptReason: "CPS file 26-1234, Cst. Lee" }, "reason");
    expect(towGate(job, police)).toMatchObject({ canTow: true, exempt: true });
    job = recordTowEvent(job, actor(), police, "arrived");
    expect(() => recordTowEvent(job, actor(), police, "secured")).not.toThrow();
  });
});

describe("during the tow", () => {
  it("locks pickup / destination edits once secured; moves go through a recorded destination change", () => {
    let job = consentedJob();
    job = recordTowEvent(job, actor(), owner, "arrived");
    job = recordTowEvent(job, actor(), owner, "secured");
    expect(() => updateDetails(job, actor(), { destination: "Elsewhere" }, "x")).toThrow(GuardrailError);
    expect(() => recordDestinationChange(job, actor(), { to: "Shop B", authorizedBy: "", reason: "closed", ownerNotifiedVia: "Phone call" })).toThrow();
    job = recordDestinationChange(job, actor(), { to: "Shop B", authorizedBy: "Jamie Clarke (owner)", reason: "Shop A closed", ownerNotifiedVia: "Phone call" });
    expect(job.destination).toBe("Shop B");
    expect(job.destinationChanges[0]).toMatchObject({ from: "Yard — 1 Main St", authorizedBy: "Jamie Clarke (owner)" });
    // A recorded move must not lock the rest of the tow.
    job = recordTowEvent(job, actor(), owner, "departed");
    job = recordTowEvent(job, actor(), owner, "delivered");
    expect(job.tow.delivered).toBeDefined();
  });

  it("can't revise the estimate after the vehicle is secured", () => {
    let job = consentedJob();
    job = recordTowEvent(job, actor(), owner, "arrived");
    job = recordTowEvent(job, actor(), owner, "secured");
    expect(() => issueEstimate(job, actor(), 3500)).toThrow(GuardrailError);
  });
});

describe("invoice before payment", () => {
  it("can't issue an invoice before delivery", () => {
    expect(() => issueInvoice(startInvoiceDraft(consentedJob()), actor(), "INV-1")).toThrow(/after the vehicle is delivered/);
  });

  it("locks Record payment until the invoice is issued", () => {
    const job = startInvoiceDraft(deliveredJob());
    expect(canRecordPayment(job)).toEqual({ ok: false, reason: "Issue invoice before recording payment." });
    expect(() => recordPayment(job, actor(), { amountCents: 100, method: "Cash" })).toThrow(GuardrailError);
    const invoiced = issueInvoice(job, actor(), "INV-1");
    expect(() => recordPayment(invoiced, actor(), { amountCents: invoiced.invoices[0].totalCents, method: "Cash" })).not.toThrow();
  });

  it("warns neutrally (never blocks) when the final amount differs, and clears after re-consent", () => {
    let job = startInvoiceDraft(deliveredJob());
    job = saveInvoiceDraft(job, job.invoiceDraft!.map((i) => (i.id === "km" ? { ...i, quantity: i.quantity + 4 } : i)));
    const newTotal = totals(job.invoiceDraft!).totalCents;
    expect(differsFromAuthorized(job, newTotal)).toBe(true);
    expect(DIFFERENCE_WARNING).toBe("Final amount differs from estimate — confirm customer authorization");

    const reconsented = recordConsent(job, actor(), {
      purpose: "revised_amount",
      name: "Jamie Clarke",
      relationship: "Owner",
      present: true,
      method: "audio",
      evidence: "data:audio/webm;base64,AAAA",
      driverConfirmed: true,
      amountCents: newTotal,
    });
    expect(differsFromAuthorized(reconsented, newTotal)).toBe(false);
    // Issuing without re-consent is still allowed — the warning is advisory until counsel confirms a rule.
    expect(() => issueInvoice(job, actor(), "INV-1")).not.toThrow();
  });

  it("keeps issued invoices immutable; corrections create a new numbered version", () => {
    let job = issueInvoice(startInvoiceDraft(deliveredJob()), actor(), "INV-7");
    const original = job.invoices[0];
    job = startInvoiceDraft(job);
    job = saveInvoiceDraft(job, job.invoiceDraft!.map((i) => (i.id === "storage" ? { ...i, quantity: 3 } : i)));
    expect(job.invoices[0]).toEqual(original);
    job = issueInvoice(job, actor(), "unused");
    expect(job.invoices.map((i) => i.number)).toEqual(["INV-7", "INV-7-R1"]);
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
    const invoiced = issueInvoice(startInvoiceDraft(job), actor("Morgan Lee"), "INV-1");
    expect(invoiced.audit.length).toBe(before + 1);
    expect(invoiced.audit.slice(0, before)).toEqual(job.audit);
    expect(invoiced.audit.at(-1)).toMatchObject({ by: "Morgan Lee", device: "Phone" });
  });
});

describe("compliance file and statuses (seed data)", () => {
  const app = buildSeedState(Date.parse("2026-09-30T18:00:00Z"));
  const byNumber = (n: string) => app.jobs.find((j) => j.number === n)!;
  const typeOf = (job: Job) => app.requestTypes.find((t) => t.id === job.requestTypeId);

  it("has one complete job with a complete compliance file", () => {
    const job = byNumber("TW-1001");
    expect(jobStatus(job, typeOf(job)).label).toBe("Complete");
    expect(complianceFile(job, typeOf(job))).toMatchObject({ complete: true, problems: [] });
  });

  it("has one problem-state job: invoice not issued", () => {
    const job = byNumber("TW-1002");
    expect(jobStatus(job, typeOf(job)).label).toBe("Missing invoice");
    expect(complianceFile(job, typeOf(job)).problems).toEqual(["invoice not issued"]);
  });

  it("has one job waiting for consent", () => {
    const job = byNumber("TW-1003");
    expect(jobStatus(job, typeOf(job)).label).toBe("Waiting for consent");
  });

  it("keeps records for 3 years", () => {
    const job = byNumber("TW-1001");
    expect(complianceFile(job, typeOf(job)).retainUntil.slice(0, 4)).toBe(String(new Date(job.createdAt).getUTCFullYear() + 3));
  });
});
