// Pure job mutations. Each returns a new Job and appends an audit entry; guardrails throw GuardrailError.
import type {
  Actor,
  Consent,
  ConsentMethod,
  DeliveryMethod,
  Job,
  JobPrefill,
  LineItem,
  RateCard,
  RequestType,
  ScenarioId,
  TowEvent,
  Workflow,
} from "@/lib/domain";
import { DELIVERY_LABELS, TOW_EVENT_LABELS } from "@/lib/domain";
import { formatMoney, totals } from "@/lib/money";
import {
  canIssueInvoice,
  canRecordPayment,
  canRecordTowEvent,
  currentEstimate,
  currentInvoice,
  differsFromEstimate,
  normalizeWorkflow,
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
    audit: [...job.audit, { id: newId("a-"), at: actor.now, by: actor.by, role: actor.role, device: actor.device, action }],
  };
}

export const SYSTEM_NAME = "TowLedger";

export function defaultEstimateItems(rateCard: RateCard, km = 10): LineItem[] {
  return [
    { id: "base", label: "Base tow", quantity: 1, unitCents: rateCard.baseTowCents },
    { id: "km", label: "Mileage", quantity: km, unitCents: rateCard.perKmCents, unitLabel: "km" },
    { id: "winch", label: "Winching", quantity: 0, unitCents: rateCard.winchCents },
    { id: "after_hours", label: "After-hours", quantity: 0, unitCents: rateCard.afterHoursCents },
    { id: "storage", label: "Storage", quantity: 0, unitCents: rateCard.storagePerDayCents, unitLabel: "day" },
  ];
}

export function createJob(input: {
  number: string;
  actor: Actor;
  rateCard: RateCard;
  defaultDestination: string;
  scenario?: ScenarioId;
  prefill?: JobPrefill;
}): Job {
  const job: Job = {
    id: newId("job-"),
    number: input.number,
    createdAt: input.actor.now,
    driverName: input.actor.by,
    scenario: input.scenario,
    prefill: input.prefill,
    requestTypeId: null,
    requestOther: "",
    contactName: "",
    contactReference: "",
    workflow: null,
    customer: { name: "", mobile: "", email: "", relationship: "Owner", present: true },
    vehicle: { plate: "", province: "AB", make: "", model: "", year: "", colour: "" },
    pickup: "",
    destination: input.defaultDestination,
    destinationConfirmedBy: "",
    notes: "",
    estimateDraft: defaultEstimateItems(input.rateCard, input.prefill?.km),
    estimates: [],
    consents: [],
    tow: {},
    destinationChanges: [],
    photos: [],
    invoiceDraft: null,
    invoices: [],
    payments: [],
    audit: [],
  };
  return audit(job, input.actor, `Job #${input.number} created${input.scenario ? " (demo scenario)" : ""}`);
}

/**
 * Records who requested the tow and snapshots the company workflow mapped to that request type.
 * The estimate draft switches to the workflow's rate card until an estimate has been issued.
 */
export function recordRequest(
  job: Job,
  actor: Actor,
  input: { requestType: RequestType; workflow: Workflow; rateCard: RateCard; requestOther: string; contactName: string; contactReference: string },
): Job {
  if (job.tow.secured) throw new GuardrailError("The tow has started, so the request is locked.");
  const { requestType, rateCard } = input;
  const workflow = normalizeWorkflow(input.workflow);
  if (requestType.id === "other" && !input.requestOther.trim()) throw new GuardrailError("Describe who requested the tow.");
  if (!input.contactName.trim()) throw new GuardrailError("Record who contacted or invited your company.");

  const rateCardChanged = job.workflow?.rateCardId !== workflow.rateCardId;
  const estimateDraft = job.estimates.length === 0 && rateCardChanged
    ? defaultEstimateItems(rateCard, job.estimateDraft.find((i) => i.id === "km")?.quantity)
    : job.estimateDraft;

  const next: Job = {
    ...job,
    requestTypeId: requestType.id,
    requestOther: requestType.id === "other" ? input.requestOther.trim() : "",
    contactName: input.contactName.trim(),
    contactReference: input.contactReference.trim(),
    workflow,
    estimateDraft,
  };
  const who = requestType.id === "other" ? `${requestType.label} (${next.requestOther})` : requestType.label;
  const ref = next.contactReference ? `, ref ${next.contactReference}` : "";
  return audit(next, actor, `Request recorded: ${who}; contacted by ${next.contactName}${ref}. Workflow ${workflow.letter} — ${workflow.name}`);
}

/** Generic field update for editable (not-yet-issued) job details. */
export function updateDetails(
  job: Job,
  actor: Actor,
  patch: Partial<Pick<Job, "customer" | "vehicle" | "pickup" | "destination" | "destinationConfirmedBy" | "notes">>,
  action: string,
): Job {
  if (job.tow.secured) {
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

export function issueEstimate(job: Job, actor: Actor, input: { storagePerDayCents: number; rateCardName: string; notes: string }): Job {
  if (job.tow.secured) throw new GuardrailError("The estimate can't be revised after the vehicle is secured. Use the invoice step instead.");
  const items = job.estimateDraft.filter((i) => i.quantity > 0);
  if (items.length === 0) throw new GuardrailError("Add at least one charge to the estimate.");
  if (!job.destination.trim()) throw new GuardrailError("Enter the destination before issuing the estimate.");
  if (!job.customer.name.trim() || !(job.customer.mobile.trim() || job.customer.email.trim())) {
    throw new GuardrailError("The estimate needs the customer's name and a phone number or email.");
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
    storagePerDayCents: input.storagePerDayCents,
    rateCardName: input.rateCardName,
    notes: input.notes,
    customer: { name: job.customer.name, mobile: job.customer.mobile, email: job.customer.email },
    vehicle: { ...job.vehicle },
    pickup: job.pickup,
    destination: job.destination,
    issuedAt: actor.now,
    issuedBy: actor.by,
    deliveries: [],
  });
  const note = previous ? ` — replaces v${previous.version}` : "";
  return audit({ ...job, estimates }, actor, `Estimate #${job.number} v${version} generated from ${input.rateCardName} (${formatMoney(sums.totalCents)})${note}`);
}

/**
 * Records that a customer copy was delivered. Text and email are sent by the system (simulated in the
 * prototype), so those audit rows are attributed to TowLedger and name the person who requested them.
 */
export function recordDelivery(job: Job, actor: Actor, kind: "estimate" | "invoice", via: DeliveryMethod, to?: string): Job {
  const delivery = { via, to, at: actor.now, by: actor.by };
  const where = to ? ` to ${to}` : "";
  const systemSent = via === "text" || via === "email";
  const logActor: Actor = systemSent ? { ...actor, by: SYSTEM_NAME, role: "system", device: "Server" } : actor;
  const requested = systemSent ? ` (requested by ${actor.by})` : "";
  const how = DELIVERY_LABELS[via].toLowerCase();

  if (kind === "estimate") {
    const estimate = currentEstimate(job);
    if (!estimate) throw new GuardrailError("Issue the estimate first.");
    const estimates = job.estimates.map((e) => (e.version === estimate.version ? { ...e, deliveries: [...e.deliveries, delivery] } : e));
    return audit({ ...job, estimates }, logActor, `Estimate #${job.number} v${estimate.version} delivered — ${how}${where}${requested}`);
  }
  const invoice = currentInvoice(job);
  if (!invoice) throw new GuardrailError("Issue the invoice first.");
  const invoices = job.invoices.map((i) => (i.version === invoice.version ? { ...i, deliveries: [...i.deliveries, delivery] } : i));
  return audit({ ...job, invoices }, logActor, `Invoice ${invoice.number} delivered — ${how}${where}${requested}`);
}

export interface ConsentInput {
  purpose: Consent["purpose"];
  name: string;
  relationship: string;
  present: boolean;
  method: ConsentMethod;
  evidence?: string;
  driverConfirmed: boolean;
  templateVersion: number;
  heading: string;
  wording: string;
  /** Required for revised_amount: the new total the customer authorized. */
  amountCents?: number;
}

export function recordConsent(job: Job, actor: Actor, input: ConsentInput): Job {
  const estimate = currentEstimate(job);
  if (!estimate) throw new GuardrailError("Issue and deliver the estimate before recording consent.");
  if (input.purpose === "estimate" && estimate.deliveries.length === 0) {
    throw new GuardrailError("Give the customer their copy of the estimate before recording consent.");
  }
  if (!input.name.trim()) throw new GuardrailError("Record the name of the person giving consent.");
  if (!input.relationship.trim()) throw new GuardrailError("Record their relationship to the vehicle.");
  if (input.method !== "link" && !input.evidence) throw new GuardrailError("Capture the consent evidence first.");
  if (input.method !== "link" && !input.driverConfirmed) throw new GuardrailError("Driver must confirm the consent was received.");
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
    templateVersion: input.templateVersion,
    heading: input.heading,
    wording: input.wording,
  };
  const what =
    input.purpose === "estimate"
      ? `Consent record captured for estimate #${job.number} v${estimate.version}`
      : `Revised amount ${formatMoney(consent.amountCents)} authorized`;
  return audit(
    { ...job, consents: [...job.consents, consent] },
    actor,
    `${what} — ${consent.name} (${consent.relationship}), ${input.method.replace("_", " ")}, template v${input.templateVersion}`,
  );
}

export function recordTowEvent(job: Job, actor: Actor, event: TowEvent): Job {
  const allowed = canRecordTowEvent(job, event);
  if (!allowed.ok) throw new GuardrailError(allowed.reason);
  const label = event === "secured" ? "Vehicle secured — tow started" : TOW_EVENT_LABELS[event];
  return audit({ ...job, tow: { ...job.tow, [event]: actor.now } }, actor, label);
}

export function recordDestinationChange(
  job: Job,
  actor: Actor,
  input: { to: string; requestedBy: string; at?: string; note: string; ownerNotifiedVia: string },
): Job {
  if (!job.tow.secured) throw new GuardrailError("Before the tow starts, edit the destination on the vehicle screen.");
  if (job.tow.delivered) throw new GuardrailError("The vehicle has already been delivered.");
  if (!input.to.trim() || !input.requestedBy.trim()) throw new GuardrailError("Record the new destination and who requested or approved it.");
  const change = {
    id: newId("d-"),
    at: input.at || actor.now,
    recordedAt: actor.now,
    from: job.destination,
    to: input.to.trim(),
    requestedBy: input.requestedBy.trim(),
    note: input.note.trim(),
    ownerNotifiedVia: input.ownerNotifiedVia,
    ownerNotifiedAt: input.ownerNotifiedVia ? actor.now : undefined,
  };
  const notice = change.ownerNotifiedVia ? `; owner notified by ${change.ownerNotifiedVia.toLowerCase()}` : "; owner notice not yet recorded";
  return audit(
    { ...job, destination: change.to, destinationChanges: [...job.destinationChanges, change] },
    actor,
    `Destination changed from “${change.from}” to “${change.to}” — requested/approved by ${change.requestedBy}${notice}`,
  );
}

export function recordOwnerNotice(job: Job, actor: Actor, changeId: string, via: string): Job {
  if (!via.trim()) throw new GuardrailError("Choose how the owner was notified.");
  const change = job.destinationChanges.find((c) => c.id === changeId);
  if (!change) throw new GuardrailError("Destination change not found.");
  if (change.ownerNotifiedVia) throw new GuardrailError("Owner notice is already recorded for this change.");
  const destinationChanges = job.destinationChanges.map((c) => (c.id === changeId ? { ...c, ownerNotifiedVia: via, ownerNotifiedAt: actor.now } : c));
  return audit({ ...job, destinationChanges }, actor, `Owner notified of move to “${change.to}” by ${via.toLowerCase()}`);
}

export function addPhoto(job: Job, actor: Actor, input: { dataUrl: string; caption: string }): Job {
  const photo = { id: newId("p-"), at: actor.now, by: actor.by, caption: input.caption.trim() || "Photo", dataUrl: input.dataUrl };
  return audit({ ...job, photos: [...job.photos, photo] }, actor, `Photo added: ${photo.caption}`);
}

export function saveNotes(job: Job, actor: Actor, notes: string): Job {
  return audit({ ...job, notes }, actor, "Job notes updated");
}

/** Starts the invoice from the estimate (or the last invoice when correcting one), or the rate card draft. */
export function startInvoiceDraft(job: Job): Job {
  const source = currentInvoice(job)?.items ?? currentEstimate(job)?.items ?? job.estimateDraft.filter((i) => i.quantity > 0);
  return { ...job, invoiceDraft: source.map((i) => ({ ...i })) };
}

/** Pass null to discard a draft (e.g. cancelling a correction). */
export function saveInvoiceDraft(job: Job, items: LineItem[] | null): Job {
  return { ...job, invoiceDraft: items };
}

export function invoiceNumberFor(job: Job): string {
  return `INV-${job.number}`;
}

export function issueInvoice(job: Job, actor: Actor, notes: string): Job {
  const allowed = canIssueInvoice(job);
  if (!allowed.ok) throw new GuardrailError(allowed.reason);
  const items = job.invoiceDraft!.filter((i) => i.quantity > 0);
  if (items.length === 0) throw new GuardrailError("Add at least one charge.");

  const previous = currentInvoice(job);
  const version = (previous?.version ?? 0) + 1;
  const number = previous ? `${invoiceNumberFor(job)}-R${version - 1}` : invoiceNumberFor(job);
  const sums = totals(items);
  const invoices = job.invoices.map((i) => (i.supersededAt ? i : { ...i, supersededAt: actor.now }));
  invoices.push({
    number,
    version,
    token: newToken(),
    items: items.map((i) => ({ ...i })),
    ...sums,
    notes,
    customer: { name: job.customer.name, mobile: job.customer.mobile, email: job.customer.email },
    vehicle: { ...job.vehicle },
    pickup: job.pickup,
    destination: job.destination,
    tow: { ...job.tow },
    issuedAt: actor.now,
    issuedBy: actor.by,
    deliveries: [],
  });
  const diff = differsFromEstimate(job, sums.totalCents) ? " — differs from original estimate" : "";
  const replaces = previous ? ` (corrects ${previous.number})` : "";
  return audit({ ...job, invoices, invoiceDraft: null }, actor, `Invoice ${number} issued (${formatMoney(sums.totalCents)})${replaces}${diff}`);
}

export function recordPayment(job: Job, actor: Actor, input: { amountCents: number; method: string }): Job {
  const allowed = canRecordPayment(job);
  if (!allowed.ok) throw new GuardrailError(allowed.reason);
  if (!(input.amountCents > 0)) throw new GuardrailError("Enter the amount received.");
  const invoice = currentInvoice(job)!;
  const payment = {
    id: newId("pay-"),
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
