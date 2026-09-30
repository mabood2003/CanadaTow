// Pure job mutations. Each returns a new Job and appends an audit entry; guardrails throw GuardrailError.
import type {
  Actor,
  Consent,
  ConsentMethod,
  DeliveryMethod,
  Job,
  LineItem,
  RateCard,
  RequestType,
  TowEvent,
} from "@/lib/domain";
import { TOW_EVENT_LABELS } from "@/lib/domain";
import { formatMoney, totals } from "@/lib/money";
import {
  canIssueInvoice,
  canRecordPayment,
  canRecordTowEvent,
  currentEstimate,
  currentInvoice,
  differsFromAuthorized,
} from "@/lib/tow-rules";

export class GuardrailError extends Error {}

export function newId(prefix = ""): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return prefix + random;
}

export function newToken(): string {
  return newId().replace(/-/g, "").slice(0, 20);
}

export function audit(job: Job, actor: Actor, action: string): Job {
  return {
    ...job,
    audit: [...job.audit, { id: newId("a-"), at: actor.now, by: actor.by, device: actor.device, action }],
  };
}

export function defaultEstimateItems(rateCard: RateCard): LineItem[] {
  return [
    { id: "hookup", label: "Hook-up", quantity: 1, unitCents: rateCard.hookupCents },
    { id: "km", label: "Estimated kilometres to travel", quantity: 10, unitCents: rateCard.perKmCents, unitLabel: "km" },
    { id: "winch", label: "Winching", quantity: 0, unitCents: rateCard.winchCents },
    { id: "after_hours", label: "After-hours callout", quantity: 0, unitCents: rateCard.afterHoursCents },
    { id: "storage", label: "Storage per day", quantity: 1, unitCents: rateCard.storagePerDayCents, unitLabel: "day" },
  ];
}

export function createJob(input: { number: string; actor: Actor; rateCard: RateCard; defaultDestination: string }): Job {
  const job: Job = {
    id: newId("job-"),
    number: input.number,
    createdAt: input.actor.now,
    driverName: input.actor.by,
    requestTypeId: null,
    requestOther: "",
    invitedBy: "",
    invitedByOther: "",
    exemptReason: "",
    customer: { name: "", mobile: "", email: "", relationship: "Owner", present: true },
    vehicle: { plate: "", province: "AB", make: "", model: "", year: "", colour: "" },
    pickup: "",
    destination: input.defaultDestination,
    destinationConfirmed: false,
    estimateDraft: defaultEstimateItems(input.rateCard),
    estimates: [],
    consents: [],
    tow: {},
    destinationChanges: [],
    invoiceDraft: null,
    invoices: [],
    payments: [],
    audit: [],
  };
  return audit(job, input.actor, `Job ${input.number} created`);
}

/** Generic field update for editable (not-yet-issued) job details. */
export function updateDetails(
  job: Job,
  actor: Actor,
  patch: Partial<Pick<Job, "requestTypeId" | "requestOther" | "invitedBy" | "invitedByOther" | "exemptReason" | "customer" | "vehicle" | "pickup" | "destination" | "destinationConfirmed">>,
  action: string,
): Job {
  if (job.tow.secured && ("pickup" in patch || "destination" in patch)) {
    if (patch.pickup !== undefined && patch.pickup !== job.pickup) {
      throw new GuardrailError("Pickup can't change after the vehicle is secured.");
    }
    if (patch.destination !== undefined && patch.destination !== job.destination) {
      throw new GuardrailError("Use “Destination changed” on the tow screen once the vehicle is secured.");
    }
  }
  return audit({ ...job, ...patch }, actor, action);
}

export function saveEstimateDraft(job: Job, items: LineItem[]): Job {
  // Draft edits are working state, not records — no audit row until the estimate is issued.
  return { ...job, estimateDraft: items };
}

export function issueEstimate(job: Job, actor: Actor, storagePerDayCents: number): Job {
  if (job.tow.secured) throw new GuardrailError("The estimate can't be revised after the vehicle is secured. Use the invoice step instead.");
  const items = job.estimateDraft.filter((i) => i.quantity > 0);
  if (items.length === 0) throw new GuardrailError("Add at least one charge to the estimate.");
  if (!job.destination.trim()) throw new GuardrailError("Enter the destination before issuing the estimate.");
  if (!job.customer.name.trim() || !(job.customer.mobile.trim() || job.customer.email.trim())) {
    throw new GuardrailError("The estimate must show the consenting person's name and a phone or email.");
  }

  const previous = currentEstimate(job);
  const version = (previous?.version ?? 0) + 1;
  const sums = totals(items);
  const estimates = job.estimates.map((e) => (e.supersededAt ? e : { ...e, supersededAt: actor.now }));
  estimates.push({
    version,
    token: newToken(),
    items: items.map((i) => ({ ...i })),
    ...sums,
    storagePerDayCents,
    customer: { name: job.customer.name, mobile: job.customer.mobile, email: job.customer.email },
    vehicle: { ...job.vehicle },
    pickup: job.pickup,
    destination: job.destination,
    issuedAt: actor.now,
    issuedBy: actor.by,
    deliveries: [],
  });
  const note = previous ? ` — replaces v${previous.version}; customer must consent again` : "";
  return audit({ ...job, estimates }, actor, `Estimate v${version} issued (${formatMoney(sums.totalCents)})${note}`);
}

export function recordDelivery(
  job: Job,
  actor: Actor,
  kind: "estimate" | "invoice",
  via: DeliveryMethod,
  to?: string,
): Job {
  const delivery = { via, to, at: actor.now };
  const where = to ? ` to ${to}` : "";
  if (kind === "estimate") {
    const estimate = currentEstimate(job);
    if (!estimate) throw new GuardrailError("Issue the estimate first.");
    const estimates = job.estimates.map((e) =>
      e.version === estimate.version ? { ...e, deliveries: [...e.deliveries, delivery] } : e,
    );
    return audit({ ...job, estimates }, actor, `Estimate v${estimate.version} delivered by ${via}${where}`);
  }
  const invoice = currentInvoice(job);
  if (!invoice) throw new GuardrailError("Issue the invoice first.");
  const invoices = job.invoices.map((i) => (i.version === invoice.version ? { ...i, deliveries: [...i.deliveries, delivery] } : i));
  return audit({ ...job, invoices }, actor, `Invoice ${invoice.number} delivered by ${via}${where}`);
}

export interface ConsentInput {
  purpose: Consent["purpose"];
  name: string;
  relationship: string;
  present: boolean;
  method: ConsentMethod;
  evidence?: string;
  driverConfirmed: boolean;
  /** Required for revised_amount: the new total the customer authorized. */
  amountCents?: number;
}

export function recordConsent(job: Job, actor: Actor, input: ConsentInput): Job {
  const estimate = currentEstimate(job);
  if (!estimate) throw new GuardrailError("Issue and send the estimate before recording consent.");
  if (input.purpose === "estimate" && estimate.deliveries.length === 0) {
    throw new GuardrailError("Give the customer their copy of the estimate before recording consent.");
  }
  if (!input.name.trim()) throw new GuardrailError("Record the consenting person's name.");
  if (!input.relationship.trim()) throw new GuardrailError("Record their relationship to the vehicle.");
  if (input.method !== "link" && !input.evidence) throw new GuardrailError("Capture the consent evidence first.");
  if (input.method !== "link" && !input.driverConfirmed) throw new GuardrailError("Driver must confirm consent was received.");
  if (input.purpose === "revised_amount" && input.amountCents === undefined) throw new GuardrailError("Missing the revised amount.");

  const consent: Consent = {
    id: newId("c-"),
    purpose: input.purpose,
    estimateVersion: estimate.version,
    amountCents: input.purpose === "estimate" ? estimate.totalCents : input.amountCents!,
    name: input.name.trim(),
    relationship: input.relationship,
    present: input.present,
    method: input.method,
    at: actor.now,
    evidence: input.evidence,
    recordedBy: actor.by,
    driverConfirmed: input.driverConfirmed,
  };
  const what =
    input.purpose === "estimate"
      ? `Consent to estimate v${estimate.version} recorded`
      : `Customer authorized revised amount ${formatMoney(consent.amountCents)}`;
  return audit({ ...job, consents: [...job.consents, consent] }, actor, `${what} — ${consent.name} (${consent.relationship}), ${input.method}`);
}

export function recordTowEvent(job: Job, actor: Actor, type: RequestType | undefined, event: TowEvent): Job {
  const allowed = canRecordTowEvent(job, type, event);
  if (!allowed.ok) throw new GuardrailError(allowed.reason);
  return audit({ ...job, tow: { ...job.tow, [event]: actor.now } }, actor, TOW_EVENT_LABELS[event]);
}

export function recordDestinationChange(
  job: Job,
  actor: Actor,
  input: { to: string; authorizedBy: string; reason: string; ownerNotifiedVia: string },
): Job {
  if (!job.tow.secured) throw new GuardrailError("Before the tow starts, edit the destination on the vehicle screen.");
  if (job.tow.delivered) throw new GuardrailError("The vehicle has already been delivered.");
  if (!input.to.trim() || !input.authorizedBy.trim() || !input.reason.trim() || !input.ownerNotifiedVia.trim()) {
    throw new GuardrailError("Record the new destination, who authorized it, why, and how the owner was notified.");
  }
  const change = {
    id: newId("d-"),
    at: actor.now,
    from: job.destination,
    to: input.to.trim(),
    authorizedBy: input.authorizedBy.trim(),
    reason: input.reason.trim(),
    ownerNotifiedVia: input.ownerNotifiedVia,
    notifiedAt: actor.now,
  };
  return audit(
    { ...job, destination: change.to, destinationChanges: [...job.destinationChanges, change] },
    actor,
    `Destination changed from “${change.from}” to “${change.to}” — authorized by ${change.authorizedBy}; owner notified by ${change.ownerNotifiedVia}`,
  );
}

/** Starts the invoice from the consented estimate (or the last invoice when correcting one). */
export function startInvoiceDraft(job: Job): Job {
  const source = currentInvoice(job)?.items ?? currentEstimate(job)?.items ?? job.estimateDraft;
  return {
    ...job,
    invoiceDraft: source.map((i) => ({
      ...i,
      label: i.id === "km" ? "Kilometres travelled" : i.label,
    })),
  };
}

/** Pass null to discard a draft (e.g. cancelling a correction). */
export function saveInvoiceDraft(job: Job, items: LineItem[] | null): Job {
  return { ...job, invoiceDraft: items };
}

export function issueInvoice(job: Job, actor: Actor, baseNumber: string): Job {
  const allowed = canIssueInvoice(job);
  if (!allowed.ok) throw new GuardrailError(allowed.reason);
  const items = job.invoiceDraft!.filter((i) => i.quantity > 0);
  if (items.length === 0) throw new GuardrailError("Add at least one charge.");

  const previous = currentInvoice(job);
  const version = (previous?.version ?? 0) + 1;
  const number = previous ? `${previous.number.split("-R")[0]}-R${version - 1}` : baseNumber;
  const sums = totals(items);
  const invoices = job.invoices.map((i) => (i.supersededAt ? i : { ...i, supersededAt: actor.now }));
  invoices.push({
    number,
    version,
    token: newToken(),
    items: items.map((i) => ({ ...i })),
    ...sums,
    customer: { name: job.customer.name, mobile: job.customer.mobile, email: job.customer.email },
    vehicle: { ...job.vehicle },
    pickup: job.pickup,
    destination: job.destination,
    tow: { ...job.tow },
    issuedAt: actor.now,
    issuedBy: actor.by,
    deliveries: [],
  });
  const diff = differsFromAuthorized(job, sums.totalCents) ? " — differs from authorized estimate" : "";
  const replaces = previous ? ` (corrects ${previous.number})` : "";
  return audit({ ...job, invoices, invoiceDraft: null }, actor, `Invoice ${number} issued (${formatMoney(sums.totalCents)})${replaces}${diff}`);
}

export function recordPayment(job: Job, actor: Actor, input: { amountCents: number; method: string }): Job {
  const allowed = canRecordPayment(job);
  if (!allowed.ok) throw new GuardrailError(allowed.reason);
  if (!(input.amountCents > 0)) throw new GuardrailError("Enter the amount received.");
  const invoice = currentInvoice(job)!;
  const payment = {
    id: newId("p-"),
    invoiceNumber: invoice.number,
    amountCents: input.amountCents,
    method: input.method,
    at: actor.now,
    recordedBy: actor.by,
  };
  return audit(
    { ...job, payments: [...job.payments, payment] },
    actor,
    `Payment recorded against ${invoice.number}: ${formatMoney(input.amountCents)} (${input.method})`,
  );
}
