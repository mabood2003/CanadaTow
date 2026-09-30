// What the customer sees on their link: where the vehicle is, and each step of the tow so far.
// Plain words for the public — no internal workflow names, no legal conclusions.
import type { Job } from "@/lib/domain";
import { formatMoney as money } from "@/lib/money";
import { currentEstimate, currentInvoice, estimateConsent } from "@/lib/tow-rules";

export type StepState = "done" | "current" | "upcoming";

export interface StatusStep {
  key: string;
  title: string;
  detail?: string;
  at?: string;
  state: StepState;
  /** Which document the step can open on the customer page. */
  document?: "estimate" | "invoice";
}

export interface CustomerStatus {
  headline: string;
  /** Where the vehicle is right now, in plain words. */
  vehicleAt: string;
  steps: StatusStep[];
  /** The customer still needs to review and approve the estimate. */
  awaitingApproval: boolean;
}

/** "Summit yard — Bay 4, 1250 …" → "Summit yard" for short sentences; the full address stays in the detail. */
export function placeName(place: string): string {
  return place.split(" — ")[0] || place;
}

export function customerStatus(job: Job): CustomerStatus {
  const w = job.workflow;
  const t = job.tow;
  const estimate = currentEstimate(job);
  const sentAt = estimate?.deliveries[0]?.at;
  const consent = estimateConsent(job);
  const invoice = currentInvoice(job);
  const paidCents = invoice ? job.payments.filter((p) => p.invoiceNumber === invoice.number).reduce((sum, p) => sum + p.amountCents, 0) : 0;
  const paidAt = invoice && paidCents >= invoice.totalCents ? job.payments.filter((p) => p.invoiceNumber === invoice.number).at(-1)?.at : undefined;
  const firstName = job.driverName.split(" ")[0];

  const steps: Omit<StatusStep, "state">[] = [{ key: "requested", title: "Tow requested", at: job.createdAt }];

  if (w?.requireEstimate || estimate) {
    steps.push({ key: "estimate", title: "Estimate sent to you", at: sentAt, detail: estimate ? `Estimated total ${money(estimate.totalCents)}` : undefined, document: estimate ? "estimate" : undefined });
  }
  if (w?.requireConsent || consent) {
    steps.push({ key: "approved", title: consent ? "You approved the estimate" : "Your approval", at: consent?.at, detail: consent ? `Recorded for ${consent.name}` : undefined });
  }
  steps.push(
    { key: "arrived", title: `Driver arrived${firstName ? ` (${firstName})` : ""}`, at: t.arrived },
    { key: "secured", title: "Vehicle hooked up and secured", at: t.secured },
    { key: "departed", title: `On the way to ${placeName(job.destinationChanges[0]?.from ?? job.destination)}`, at: t.departed },
  );
  for (const change of job.destinationChanges) {
    steps.push({ key: `moved-${change.id}`, title: `Destination changed to ${placeName(change.to)}`, at: change.at, detail: `Requested or approved by ${change.requestedBy}` });
  }
  steps.push(
    { key: "delivered", title: `Delivered to ${placeName(job.destination)}`, at: t.delivered, detail: t.delivered ? job.destination : undefined },
    { key: "invoice", title: "Invoice ready", at: invoice?.issuedAt, detail: invoice ? `${invoice.number} · ${money(invoice.totalCents)}` : undefined, document: invoice ? "invoice" : undefined },
  );
  if (paidAt) steps.push({ key: "paid", title: "Payment received — thank you", at: paidAt });

  // Everything with a time is done; the first step without one is where things stand now.
  let currentGiven = false;
  const withState: StatusStep[] = steps.map((s) => {
    if (s.at) return { ...s, state: "done" };
    if (!currentGiven) {
      currentGiven = true;
      return { ...s, state: "current" };
    }
    return { ...s, state: "upcoming" };
  });

  const awaitingApproval = Boolean(w?.requireConsent && estimate && sentAt && !consent && !estimate.supersededAt && !t.secured);

  let headline = "Your tow request is received";
  if (t.delivered) headline = `Your vehicle was delivered to ${placeName(job.destination)}`;
  else if (t.departed) headline = "Your vehicle is on the way";
  else if (t.secured) headline = "Your vehicle is secured and ready to go";
  else if (awaitingApproval) headline = "Your estimate is ready to review";
  else if (t.arrived) headline = "Your driver is with your vehicle";

  const vehicleAt = t.delivered
    ? job.destination
    : t.departed
      ? `On the way to ${placeName(job.destination)}`
      : job.pickup || "At the pickup location";

  return { headline, vehicleAt, steps: withState, awaitingApproval };
}
