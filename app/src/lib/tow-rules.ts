// Pure rules for Alberta consumer-directed tows. No UI, no storage — everything here is unit-tested.
import type { Consent, Estimate, Invoice, Job, RequestType, TowEvent } from "@/lib/domain";
import { TOW_EVENTS } from "@/lib/domain";
import { addYears } from "@/lib/time";

export const RETENTION_YEARS = 3;

export type StepKey = "request" | "customer" | "vehicle" | "estimate" | "send" | "consent" | "tow" | "invoice";

export type Tone = "neutral" | "info" | "good" | "warn" | "bad";

// ---------------------------------------------------------------------------
// Classification

export interface ResolvedWorkflow {
  /** The workflow the app actually runs. `to_confirm` always runs the full consumer workflow. */
  runs: "consumer" | "exempt";
  /** Internal flag: classification not yet confirmed by counsel. */
  toConfirm: boolean;
}

export function resolveWorkflow(type: RequestType | undefined): ResolvedWorkflow {
  if (!type) return { runs: "consumer", toConfirm: false };
  // Only a *confirmed* exempt classification skips the consumer steps.
  if (type.workflow === "exempt" && type.legalStatus === "confirmed") return { runs: "exempt", toConfirm: false };
  if (type.workflow === "consumer" && type.legalStatus === "confirmed") return { runs: "consumer", toConfirm: false };
  return { runs: "consumer", toConfirm: true };
}

export function workflowSummary(resolved: ResolvedWorkflow): string {
  return resolved.runs === "exempt"
    ? "Different workflow (police / government) — reason recorded"
    : "Consumer workflow: Estimate → Consent → Tow → Invoice → Record";
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

/** Link consent is its own evidence (the customer acted); the other methods need a stored file. */
export function consentHasEvidence(consent: Consent): boolean {
  return consent.method === "link" || Boolean(consent.evidence);
}

/** The amount the customer has most recently authorized for the current estimate. */
export function authorizedAmountCents(job: Job): number | undefined {
  const estimate = currentEstimate(job);
  if (!estimate) return undefined;
  const relevant = job.consents.filter((c) => c.estimateVersion === estimate.version);
  return relevant.at(-1)?.amountCents;
}

export function differsFromAuthorized(job: Job, totalCents: number): boolean {
  const authorized = authorizedAmountCents(job);
  return authorized !== undefined && authorized !== totalCents;
}

export const DIFFERENCE_WARNING = "Final amount differs from estimate — confirm customer authorization";

// ---------------------------------------------------------------------------
// Tow gate

export interface Check {
  key: string;
  label: string;
  ok: boolean;
  detail?: string;
  /** Short phrase used in "Compliance incomplete: …" when this check fails. */
  problem: string;
  fix: StepKey;
}

export interface TowGate {
  canTow: boolean;
  exempt: boolean;
  checks: Check[];
  message: string;
}

export function towGate(job: Job, type: RequestType | undefined): TowGate {
  const resolved = resolveWorkflow(type);

  if (!type) {
    return {
      canTow: false,
      exempt: false,
      checks: [{ key: "request", label: "Request type recorded", ok: false, problem: "request type missing", fix: "request" }],
      message: "Do not begin tow — record who requested it first.",
    };
  }

  if (resolved.runs === "exempt") {
    const ok = job.exemptReason.trim().length > 0;
    return {
      canTow: ok,
      exempt: true,
      checks: [{ key: "reason", label: "Reason for different workflow recorded", ok, problem: "workflow reason not recorded", fix: "request" }],
      message: ok ? "Tow may begin." : "Do not begin tow — record the reason for this police / government tow.",
    };
  }

  const estimate = currentEstimate(job);
  const sent = Boolean(estimate && estimate.deliveries.length > 0);
  const consent = estimateConsent(job);
  const destinationMatches = !estimate || estimate.destination === job.destination;

  const checks: Check[] = [
    {
      key: "estimate",
      label: "Estimate sent",
      ok: sent,
      detail: !estimate ? "No estimate issued" : sent ? undefined : "Issued but not given to the customer",
      problem: !estimate ? "estimate not issued" : "estimate copy not delivered",
      fix: estimate ? "send" : "estimate",
    },
    {
      key: "consent",
      label: "Consent captured",
      ok: Boolean(consent),
      detail: consent ? undefined : estimate && job.estimates.length > 1 ? "Estimate was revised — new consent needed" : undefined,
      problem: "consent missing",
      fix: "consent",
    },
    {
      key: "destination",
      label: "Destination confirmed",
      ok: job.destinationConfirmed && job.destination.trim() !== "" && destinationMatches,
      detail: !destinationMatches ? "Destination changed since the estimate — revise the estimate" : undefined,
      problem: "destination not confirmed",
      fix: destinationMatches ? "vehicle" : "estimate",
    },
  ];

  const canTow = checks.every((c) => c.ok);
  const firstMissing = checks.find((c) => !c.ok);
  let message = "Tow may begin.";
  if (firstMissing) {
    message = !consentOk(checks) ? "Do not begin tow — consent missing." : `Do not begin tow — ${firstMissing.problem}.`;
  }
  return { canTow, exempt: false, checks, message };
}

function consentOk(checks: Check[]) {
  return checks.find((c) => c.key === "consent")?.ok ?? false;
}

/**
 * Tow timestamps are recorded in order. The tow gate guards "Vehicle secured" (the start of the tow);
 * later steps only need the previous one, so a recorded mid-tow destination change doesn't strand the driver.
 */
export function canRecordTowEvent(job: Job, type: RequestType | undefined, event: TowEvent): { ok: boolean; reason?: string } {
  if (job.tow[event]) return { ok: false, reason: "Already recorded" };
  const index = TOW_EVENTS.indexOf(event);
  const previous = TOW_EVENTS[index - 1];
  if (previous && !job.tow[previous]) return { ok: false, reason: "Record the previous step first" };
  if (event === "secured") {
    const gate = towGate(job, type);
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
// Status and compliance file

export interface JobStatus {
  label: string;
  tone: Tone;
}

export function jobStatus(job: Job, type: RequestType | undefined): JobStatus {
  const resolved = resolveWorkflow(type);
  const compliance = complianceFile(job, type);

  if (currentInvoice(job)) {
    return compliance.complete ? { label: "Complete", tone: "good" } : { label: capitalize(compliance.problems[0]), tone: "bad" };
  }
  if (job.tow.delivered) return { label: "Missing invoice", tone: "bad" };
  if (job.tow.secured) {
    if (resolved.runs === "consumer" && !estimateConsent(job)) return { label: "Consent missing", tone: "bad" };
    return { label: "Tow in progress", tone: "info" };
  }
  if (!type) return { label: "New", tone: "neutral" };

  const gate = towGate(job, type);
  if (gate.canTow) return { label: "Ready to tow", tone: "good" };
  if (resolved.runs === "exempt") return { label: "Reason needed", tone: "warn" };
  if (!currentEstimate(job)) return { label: "Estimate needed", tone: "warn" };
  if (!gate.checks[0].ok) return { label: "Estimate not sent", tone: "warn" };
  if (!gate.checks[1].ok) return { label: "Waiting for consent", tone: "warn" };
  return { label: "Confirm destination", tone: "warn" };
}

export interface ComplianceFile {
  complete: boolean;
  items: Check[];
  problems: string[];
  retainUntil: string;
}

export function complianceFile(job: Job, type: RequestType | undefined): ComplianceFile {
  const resolved = resolveWorkflow(type);
  const items: Check[] = [];

  if (!type) {
    items.push({ key: "request", label: "Request type", ok: false, problem: "request type missing", fix: "request" });
  } else if (resolved.runs === "exempt") {
    items.push({
      key: "reason",
      label: "Workflow reason",
      ok: job.exemptReason.trim() !== "",
      detail: job.exemptReason || undefined,
      problem: "workflow reason not recorded",
      fix: "request",
    });
  } else {
    const estimate = currentEstimate(job);
    const consent = estimateConsent(job);
    items.push(
      {
        key: "estimate",
        label: "Estimate",
        ok: Boolean(estimate),
        detail: estimate ? `Version ${estimate.version}` : undefined,
        problem: "estimate not issued",
        fix: "estimate",
      },
      {
        key: "delivered",
        label: "Copy delivered",
        ok: Boolean(estimate && estimate.deliveries.length > 0),
        problem: "estimate copy not delivered",
        fix: "send",
      },
      {
        key: "consent",
        label: "Consent",
        ok: Boolean(consent && consentHasEvidence(consent)),
        detail: consent ? `${consent.name} · ${consent.relationship}` : undefined,
        problem: consent ? "consent evidence missing" : "consent missing",
        fix: "consent",
      },
    );
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
    label: "Locations / times",
    ok: Boolean(job.pickup.trim() && job.destination.trim() && allTimes),
    problem: allTimes ? "locations missing" : "tow times incomplete",
    fix: "tow",
  });

  if (job.destinationChanges.length > 0) {
    items.push({
      key: "moved",
      label: "Owner notified of move",
      ok: job.destinationChanges.every((c) => c.notifiedAt),
      problem: "owner not notified of move",
      fix: "tow",
    });
  }

  const invoice = currentInvoice(job);
  items.push({
    key: "invoice",
    label: "Invoice",
    ok: Boolean(invoice),
    detail: invoice?.number,
    problem: "invoice not issued",
    fix: "invoice",
  });

  const recordsOk = items.every((i) => i.ok);
  const retainUntil = addYears(job.createdAt, RETENTION_YEARS);
  items.push({
    key: "archived",
    label: "Archived",
    ok: recordsOk,
    detail: `Kept until ${retainUntil.slice(0, 10)}`,
    problem: "file not complete",
    fix: "invoice",
  });

  const problems = items.filter((i) => !i.ok && i.key !== "archived").map((i) => i.problem);
  return { complete: recordsOk, items, problems, retainUntil };
}

function capitalize(text: string | undefined) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}
