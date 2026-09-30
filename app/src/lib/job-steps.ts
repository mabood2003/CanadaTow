import type { Job, RequestType } from "@/lib/domain";
import { currentEstimate, currentInvoice, estimateConsent, resolveWorkflow, type StepKey } from "@/lib/tow-rules";

export interface Step {
  key: StepKey;
  label: string;
  done: boolean;
  optional?: boolean;
}

export function jobHref(job: Pick<Job, "id">, step?: StepKey) {
  return step ? `/jobs/${job.id}/${step}` : `/jobs/${job.id}`;
}

export function requestComplete(job: Job, type: RequestType | undefined) {
  if (!type || !job.invitedBy) return false;
  if (job.invitedBy === "Other" && !job.invitedByOther.trim()) return false;
  if (type.id === "other" && !job.requestOther.trim()) return false;
  if (resolveWorkflow(type).runs === "exempt" && !job.exemptReason.trim()) return false;
  return true;
}

export function jobSteps(job: Job, type: RequestType | undefined): Step[] {
  const exempt = resolveWorkflow(type).runs === "exempt";
  const c = job.customer;
  const v = job.vehicle;
  const vehicleDone = Boolean(v.plate.trim() && v.make.trim() && job.pickup.trim() && job.destination.trim() && (exempt || job.destinationConfirmed));

  if (exempt) {
    return [
      { key: "request", label: "Who requested the tow", done: requestComplete(job, type) },
      { key: "customer", label: "Owner details (if known)", done: Boolean(c.name.trim()), optional: true },
      { key: "vehicle", label: "Vehicle and tow details", done: vehicleDone },
      { key: "tow", label: "Tow", done: Boolean(job.tow.delivered) },
      { key: "invoice", label: "Invoice", done: Boolean(currentInvoice(job)) },
    ];
  }

  const estimate = currentEstimate(job);
  return [
    { key: "request", label: "Who requested the tow", done: requestComplete(job, type) },
    { key: "customer", label: "Consenting person", done: Boolean(c.name.trim() && (c.mobile.trim() || c.email.trim())) },
    { key: "vehicle", label: "Vehicle and tow details", done: vehicleDone },
    { key: "estimate", label: "Estimate", done: Boolean(estimate) },
    { key: "send", label: "Give customer the estimate", done: Boolean(estimate && estimate.deliveries.length > 0) },
    { key: "consent", label: "Consent", done: Boolean(estimateConsent(job)) },
    { key: "tow", label: "Tow", done: Boolean(job.tow.delivered) },
    { key: "invoice", label: "Invoice", done: Boolean(currentInvoice(job)) },
  ];
}

/** Where to go after saving `from`: the first unfinished required step after it, else the job file. */
export function nextHref(job: Job, type: RequestType | undefined, from: StepKey): string {
  const steps = jobSteps(job, type);
  const index = steps.findIndex((s) => s.key === from);
  const next = steps.slice(index + 1).find((s) => !s.done && !s.optional);
  return jobHref(job, next?.key);
}

export function firstOpenStep(job: Job, type: RequestType | undefined): Step | undefined {
  return jobSteps(job, type).find((s) => !s.done && !s.optional);
}
