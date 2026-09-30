import { appBase, type AppBase } from "@/lib/app-base";
import type { Job } from "@/lib/domain";
import { currentEstimate, currentInvoice, estimateConsent, jobRecord, type StepKey } from "@/lib/tow-rules";

export interface Step {
  key: StepKey;
  label: string;
  done: boolean;
  optional?: boolean;
}

/** Link to a job (or one of its steps) inside the current app — /driver/jobs/… or /owner/jobs/…. */
export function jobHref(job: Pick<Job, "id">, step?: StepKey | "audit", base: AppBase = appBase()) {
  return step ? `${base}/jobs/${job.id}/${step}` : `${base}/jobs/${job.id}`;
}

export function requestComplete(job: Job) {
  const w = job.workflow;
  if (!w || !job.requestTypeId || !job.contactName.trim()) return false;
  if (job.requestTypeId === "other" && !job.requestOther.trim()) return false;
  if (w.requireReference && !job.contactReference.trim()) return false;
  return true;
}

/** The steps this job's company workflow calls for, in order. */
export function jobSteps(job: Job): Step[] {
  const w = job.workflow;
  const c = job.customer;
  const v = job.vehicle;
  const needsCustomer = Boolean(w?.requireEstimate);
  const vehicleDone = Boolean(v.plate.trim() && v.make.trim() && job.pickup.trim() && job.destination.trim() && (!w?.requireDestination || job.destinationConfirmedBy.trim()));
  const estimate = currentEstimate(job);

  const steps: Step[] = [
    { key: "request", label: "Who requested the tow", done: requestComplete(job) },
    needsCustomer
      ? { key: "customer", label: "Customer / authorized person", done: Boolean(c.name.trim() && (c.mobile.trim() || c.email.trim())) }
      : { key: "customer", label: "Owner details (if known)", done: Boolean(c.name.trim()), optional: true },
    { key: "vehicle", label: "Vehicle and job details", done: vehicleDone },
  ];
  if (w?.requireEstimate) {
    steps.push(
      { key: "estimate", label: "Estimate", done: Boolean(estimate) },
      { key: "send", label: "Estimate delivery", done: Boolean(estimate && estimate.deliveries.length > 0) },
    );
  }
  if (w?.requireConsent) steps.push({ key: "consent", label: "Authorization / consent", done: Boolean(estimateConsent(job)) });
  steps.push({ key: "tow", label: "Tow", done: Boolean(job.tow.delivered) }, { key: "invoice", label: "Invoice", done: Boolean(currentInvoice(job)) });
  return steps;
}

/** Where to go after saving `from`: the first unfinished required step after it, else the job record. */
export function nextHref(job: Job, from: StepKey): string {
  const steps = jobSteps(job);
  const index = steps.findIndex((s) => s.key === from);
  const next = steps.slice(index + 1).find((s) => !s.done && !s.optional);
  return jobHref(job, next?.key);
}

export function firstOpenStep(job: Job): Step | undefined {
  return jobSteps(job).find((s) => !s.done && !s.optional);
}

// ---------------------------------------------------------------------------
// The compact progress strip (New tow → Estimate → Consent → Tow → Invoice → Record)

export type Phase = "details" | "estimate" | "consent" | "tow" | "invoice" | "record";

export const PHASE_LABELS: Record<Phase, string> = {
  details: "Details",
  estimate: "Estimate",
  consent: "Consent",
  tow: "Tow",
  invoice: "Invoice",
  record: "Record",
};

const PHASE_OF: Record<StepKey, Phase> = {
  request: "details",
  workflow: "details",
  customer: "details",
  vehicle: "details",
  estimate: "estimate",
  send: "estimate",
  consent: "consent",
  tow: "tow",
  invoice: "invoice",
};

export function phaseOf(step: StepKey): Phase {
  return PHASE_OF[step];
}

export function jobPhases(job: Job): { phase: Phase; done: boolean }[] {
  const steps = jobSteps(job);
  const phases: Phase[] = ["details"];
  if (job.workflow?.requireEstimate) phases.push("estimate");
  if (job.workflow?.requireConsent) phases.push("consent");
  phases.push("tow", "invoice", "record");
  return phases.map((phase) => ({
    phase,
    done: phase === "record" ? jobRecord(job).complete : steps.filter((s) => PHASE_OF[s.key] === phase && !s.optional).every((s) => s.done),
  }));
}
