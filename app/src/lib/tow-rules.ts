// Pure rules. No UI, no storage — everything here is unit-tested.
// These rules enforce the *company's* configured workflow; they never decide what the law requires.
import type { Consent, ConsentTemplate, Estimate, Invoice, Job, TowEvent, Workflow } from "@/lib/domain";
import { TOW_EVENTS } from "@/lib/domain";
import { formatMoney } from "@/lib/money";
import { addYears } from "@/lib/time";

export const RETENTION_YEARS = 3;

export type StepKey = "request" | "workflow" | "customer" | "vehicle" | "estimate" | "send" | "consent" | "tow" | "invoice";

export type Tone = "neutral" | "info" | "good" | "warn" | "bad";

// ---------------------------------------------------------------------------
// Workflows

/** Consent is given on an estimate, so requiring consent always requires the estimate. */
export function normalizeWorkflow(workflow: Workflow): Workflow {
  return workflow.requireConsent ? { ...workflow, requireEstimate: true } : workflow;
}

export function workflowStepLabels(workflow: Workflow): string[] {
  return [
    workflow.requireReference ? workflow.referenceLabel || "Requester reference" : null,
    workflow.requireEstimate ? "Estimate" : null,
    workflow.requireConsent ? "Authorization / consent" : null,
    "Tow",
    "Invoice",
    "Record",
  ].filter((s): s is string => Boolean(s));
}

// ---------------------------------------------------------------------------
// Consent wording

export interface ConsentContext {
  company: string;
  customer: string;
  relationship: string;
  vehicle: string;
  estimate: string;
  total: string;
  destination: string;
  storage: string;
}

export const CONSENT_PLACEHOLDERS: (keyof ConsentContext)[] = ["company", "customer", "relationship", "vehicle", "estimate", "total", "destination", "storage"];

/** Fills {placeholders} in the company's wording. Unknown placeholders are left as typed. */
export function renderConsentWording(text: string, ctx: Partial<ConsentContext>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = ctx[key as keyof ConsentContext];
    return value === undefined ? match : value || "—";
  });
}

export function currentConsentTemplate(templates: ConsentTemplate[]): ConsentTemplate {
  return templates.reduce((latest, t) => (t.version > latest.version ? t : latest), templates[0]);
}

// ---------------------------------------------------------------------------
// Estimates and consent

export function currentEstimate(job: Job): Estimate | undefined {
  return job.estimates.at(-1);
}

export function estimateConsent(job: Job, estimate = currentEstimate(job)): Consent | undefined {
  if (!estimate) return undefined;
  return job.consents.find((c) => c.purpose === "estimate" && c.estimateVersion === estimate.version);
}

/** Web acknowledgement is its own evidence (the customer acted); the other methods need a stored file. */
export function consentHasEvidence(consent: Consent): boolean {
  return consent.method === "link" || Boolean(consent.evidence);
}

/** The amount most recently agreed for the current estimate: the latest authorization, else the estimate. */
export function agreedAmountCents(job: Job): number | undefined {
  const estimate = currentEstimate(job);
  if (!estimate) return undefined;
  const relevant = job.consents.filter((c) => c.estimateVersion === estimate.version);
  return relevant.at(-1)?.amountCents ?? estimate.totalCents;
}

export function differsFromEstimate(job: Job, totalCents: number): boolean {
  const agreed = agreedAmountCents(job);
  return agreed !== undefined && agreed !== totalCents;
}

// Neutral and operational — the company decides what approval, if any, it needs.
export const DIFFERENCE_WARNING = "Final amount differs from original estimate. Follow your company's configured approval process.";

// ---------------------------------------------------------------------------
// Tow gate: the company's pre-tow steps

export interface Check {
  key: string;
  label: string;
  ok: boolean;
  detail?: string;
  /** Short phrase used in "Needs attention: …" when this check fails. */
  problem: string;
  fix: StepKey;
}

export interface TowGate {
  canTow: boolean;
  checks: Check[];
  message: string;
}

export const READY_MESSAGE = "Workflow complete — ready to proceed.";

export function towGate(job: Job): TowGate {
  const workflow = job.workflow;
  if (!workflow) {
    return {
      canTow: false,
      checks: [{ key: "request", label: "Who requested the tow", ok: false, problem: "request not recorded", fix: "request" }],
      message: "Do not begin tow — record who requested it first.",
    };
  }

  const checks: Check[] = [];
  if (workflow.requireReference) {
    checks.push({
      key: "reference",
      label: `${workflow.referenceLabel || "Requester reference"} recorded`,
      ok: Boolean(job.contactName.trim() && job.contactReference.trim()),
      problem: `${(workflow.referenceLabel || "requester reference").toLowerCase()} missing`,
      fix: "request",
    });
  }

  const estimate = currentEstimate(job);
  if (workflow.requireEstimate) {
    const sent = Boolean(estimate && estimate.deliveries.length > 0);
    checks.push({
      key: "estimate",
      label: "Estimate delivered",
      ok: sent,
      detail: !estimate ? "No estimate issued" : sent ? undefined : "Issued but not given to the customer",
      problem: !estimate ? "estimate not issued" : "estimate not delivered",
      fix: estimate ? "send" : "estimate",
    });
  }

  if (workflow.requireConsent) {
    const consent = estimateConsent(job);
    checks.push({
      key: "consent",
      label: "Company consent step completed",
      ok: Boolean(consent),
      detail: consent ? undefined : estimate && job.estimates.length > 1 ? "Estimate was revised — new consent needed" : undefined,
      problem: "consent missing",
      fix: "consent",
    });
  }

  if (workflow.requireDestination) {
    const matches = !workflow.requireEstimate || !estimate || estimate.destination === job.destination;
    checks.push({
      key: "destination",
      label: "Destination recorded",
      ok: Boolean(job.destination.trim() && job.destinationConfirmedBy.trim() && matches),
      detail: !matches ? "Destination changed since the estimate — revise the estimate" : undefined,
      problem: "destination not recorded",
      fix: matches ? "vehicle" : "estimate",
    });
  }

  const canTow = checks.every((c) => c.ok);
  const consentMissing = checks.some((c) => c.key === "consent" && !c.ok);
  const firstMissing = checks.find((c) => !c.ok);
  const message = canTow ? READY_MESSAGE : consentMissing ? "Do not begin tow — consent missing." : `Do not begin tow — ${firstMissing!.problem}.`;
  return { canTow, checks, message };
}

/**
 * Tow timestamps are recorded in order. The gate guards "Vehicle secured" (the start of the tow);
 * later steps only need the previous one, so a recorded mid-tow destination change doesn't strand the driver.
 */
export function canRecordTowEvent(job: Job, event: TowEvent): { ok: boolean; reason?: string } {
  if (job.tow[event]) return { ok: false, reason: "Already recorded" };
  const index = TOW_EVENTS.indexOf(event);
  const previous = TOW_EVENTS[index - 1];
  if (previous && !job.tow[previous]) return { ok: false, reason: "Record the previous step first" };
  if (event === "secured") {
    const gate = towGate(job);
    if (!gate.canTow) return { ok: false, reason: gate.message };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Invoice and payment

export function currentInvoice(job: Job): Invoice | undefined {
  return job.invoices.at(-1);
}

export function canIssueInvoice(job: Job): { ok: boolean; reason?: string } {
  if (!job.tow.delivered) return { ok: false, reason: "Issue the invoice after the vehicle is delivered." };
  if (!job.invoiceDraft || job.invoiceDraft.length === 0) return { ok: false, reason: "Add at least one charge." };
  return { ok: true };
}

export function canRecordPayment(job: Job): { ok: boolean; reason?: string } {
  return currentInvoice(job) ? { ok: true } : { ok: false, reason: "Issue invoice before recording payment." };
}

// ---------------------------------------------------------------------------
// Status and the job record

export interface JobStatus {
  label: string;
  tone: Tone;
  detail?: string;
}

export function jobStatus(job: Job): JobStatus {
  const record = jobRecord(job);

  if (currentInvoice(job)) {
    return record.complete ? { label: "Complete", tone: "good" } : { label: "Needs attention", tone: "bad", detail: record.problems[0] };
  }
  if (job.tow.delivered) return { label: "Missing invoice", tone: "bad" };
  if (job.tow.secured) {
    const gate = towGate(job);
    return gate.canTow ? { label: "Tow in progress", tone: "info" } : { label: "Needs attention", tone: "bad", detail: gate.checks.find((c) => !c.ok)?.problem };
  }
  if (!job.workflow) return { label: "New", tone: "neutral" };

  const gate = towGate(job);
  if (gate.canTow) return { label: "Ready to proceed", tone: "good" };
  const missing = gate.checks.find((c) => !c.ok)!;
  if (missing.key === "consent") return { label: "Waiting for customer", tone: "warn" };
  if (missing.key === "estimate") return { label: currentEstimate(job) ? "Estimate not sent" : "Estimate needed", tone: "warn" };
  if (missing.key === "reference") return { label: "Reference needed", tone: "warn" };
  return { label: "Destination needed", tone: "warn" };
}

export interface JobRecord {
  complete: boolean;
  items: Check[];
  problems: string[];
  retainUntil: string;
}

/** What the company's process produced for this job, and what is still missing. */
export function jobRecord(job: Job): JobRecord {
  const workflow = job.workflow;
  const items: Check[] = [];

  if (!workflow) {
    items.push({ key: "request", label: "Request recorded", ok: false, problem: "request not recorded", fix: "request" });
  } else {
    if (workflow.requireReference) {
      items.push({
        key: "reference",
        label: workflow.referenceLabel || "Requester reference",
        ok: Boolean(job.contactName.trim() && job.contactReference.trim()),
        detail: job.contactReference ? `${job.contactName} · ${job.contactReference}` : undefined,
        problem: `${(workflow.referenceLabel || "requester reference").toLowerCase()} missing`,
        fix: "request",
      });
    }
    if (workflow.requireEstimate) {
      const estimate = currentEstimate(job);
      items.push(
        {
          key: "estimate",
          label: "Estimate",
          ok: Boolean(estimate),
          detail: estimate ? `#${job.number} v${estimate.version} · ${formatMoney(estimate.totalCents)}` : undefined,
          problem: "estimate not issued",
          fix: "estimate",
        },
        {
          key: "delivered",
          label: "Estimate delivery record",
          ok: Boolean(estimate && estimate.deliveries.length > 0),
          problem: "estimate delivery not recorded",
          fix: "send",
        },
      );
    }
    if (workflow.requireConsent) {
      const consent = estimateConsent(job);
      items.push({
        key: "consent",
        label: "Consent record",
        ok: Boolean(consent && consentHasEvidence(consent)),
        detail: consent ? `${consent.name} · ${consent.relationship} · template v${consent.templateVersion}` : undefined,
        problem: consent ? "consent evidence missing" : "consent missing",
        fix: "consent",
      });
    }
  }

  const v = job.vehicle;
  items.push({
    key: "vehicle",
    label: "Vehicle details",
    ok: Boolean(v.plate.trim() && v.province.trim() && v.make.trim()),
    problem: "vehicle details incomplete",
    fix: "vehicle",
  });

  const allTimes = TOW_EVENTS.every((e) => job.tow[e]);
  items.push({
    key: "times",
    label: "Locations and times",
    ok: Boolean(job.pickup.trim() && job.destination.trim() && allTimes),
    problem: allTimes ? "locations missing" : "tow times incomplete",
    fix: "tow",
  });

  if (job.destinationChanges.length > 0) {
    items.push({
      key: "moved",
      label: "Owner notice of move",
      ok: job.destinationChanges.every((c) => c.ownerNotifiedVia),
      problem: "owner notice of move not recorded",
      fix: "tow",
    });
  }

  const invoice = currentInvoice(job);
  items.push({
    key: "invoice",
    label: "Invoice",
    ok: Boolean(invoice),
    detail: invoice ? `${invoice.number} · ${formatMoney(invoice.totalCents)}` : undefined,
    problem: "invoice not issued",
    fix: "invoice",
  });

  const recordsOk = items.every((i) => i.ok);
  const retainUntil = addYears(job.createdAt, RETENTION_YEARS);
  items.push({
    key: "archived",
    label: "Retained",
    ok: recordsOk,
    detail: `Kept until ${retainUntil.slice(0, 10)}`,
    problem: "record not complete",
    fix: "invoice",
  });

  const problems = items.filter((i) => !i.ok && i.key !== "archived").map((i) => i.problem);
  return { complete: recordsOk, items, problems, retainUntil };
}

export function capitalize(text: string | undefined) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}
