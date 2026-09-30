// Core record types. Money is integer cents; timestamps are UTC ISO strings.
//
// Product boundary: the towing company configures its own workflows, rates, consent wording and
// templates. TowLedger enforces that configuration and keeps the resulting records. It never decides
// which legal rules apply to a job.

export type ConsentMethod = "link" | "signature" | "audio" | "paper_photo";
export type DeliveryMethod = "text" | "email" | "device" | "print";
export type TowEvent = "arrived" | "secured" | "departed" | "delivered";
export type ActorRole = "driver" | "owner" | "customer" | "system";
export type ScenarioId = "customer_breakdown" | "motor_club" | "police_private";

export const TOW_EVENTS: TowEvent[] = ["arrived", "secured", "departed", "delivered"];

export const TOW_EVENT_LABELS: Record<TowEvent, string> = {
  arrived: "Arrived",
  secured: "Vehicle secured",
  departed: "Departed",
  delivered: "Delivered",
};

export const CONSENT_METHODS: ConsentMethod[] = ["link", "signature", "audio", "paper_photo"];

export const CONSENT_METHOD_LABELS: Record<ConsentMethod, string> = {
  link: "Customer web acknowledgement",
  signature: "Signature on driver's device",
  audio: "Audio record",
  paper_photo: "Upload / photo of paper document",
};

export const CONSENT_METHOD_SHORT: Record<ConsentMethod, string> = {
  link: "Web acknowledgement",
  signature: "Signature",
  audio: "Audio record",
  paper_photo: "Paper document",
};

export const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  text: "Text message",
  email: "Email",
  device: "Shown on driver's device",
  print: "Paper / print",
};

export const RELATIONSHIPS = ["Owner", "Driver", "Family member", "Insurance representative", "Motor-club representative", "Other"] as const;

export const ROLE_LABELS: Record<ActorRole, string> = {
  driver: "Driver",
  owner: "Office",
  customer: "Customer",
  system: "System",
};

// ---------------------------------------------------------------------------
// Company configuration

export interface Company {
  name: string;
  address: string;
  phone: string;
  email: string;
  gstNumber: string;
  /** Data URL of an uploaded logo; the app falls back to initials. */
  logo?: string;
}

export interface RateCard {
  id: string;
  name: string;
  description: string;
  baseTowCents: number;
  perKmCents: number;
  winchCents: number;
  afterHoursCents: number;
  storagePerDayCents: number;
}

/** A company-defined process. Which steps are required before the tow is the company's choice. */
export interface Workflow {
  id: string;
  letter: string;
  name: string;
  description: string;
  /** Requester name/organization and a reference number must be recorded before the tow. */
  requireReference: boolean;
  referenceLabel: string;
  /** A written estimate must be delivered to the customer before the tow. */
  requireEstimate: boolean;
  /** The company consent/authorization step must be completed before the tow (needs an estimate). */
  requireConsent: boolean;
  /** Destination and who supplied/confirmed it must be recorded before the tow. */
  requireDestination: boolean;
  rateCardId: string;
}

/** "Who requested this tow?" options. The company maps each one to a workflow. */
export interface RequestType {
  id: string;
  label: string;
  workflowId: string;
  enabled: boolean;
}

/** Versioned. Issued consent records keep the version and the exact wording shown. */
export interface ConsentTemplate {
  version: number;
  heading: string;
  body: string;
  acceptLabel: string;
  effectiveDate: string;
  updatedBy: string;
  createdAt: string;
}

export interface DocumentTemplates {
  estimateNotes: string;
  invoiceNotes: string;
}

export interface Yard {
  id: string;
  name: string;
  address: string;
  hours: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "driver";
  invited: boolean;
}

// ---------------------------------------------------------------------------
// Job records

export interface LineItem {
  id: string;
  label: string;
  quantity: number;
  unitCents: number;
  unitLabel?: string;
}

export interface Delivery {
  via: DeliveryMethod;
  to?: string;
  at: string;
  by: string;
}

export interface JobCustomer {
  name: string;
  mobile: string;
  email: string;
  relationship: string;
  present: boolean;
}

export interface JobVehicle {
  plate: string;
  province: string;
  make: string;
  model: string;
  year: string;
  colour: string;
}

export interface Estimate {
  version: number;
  token: string;
  items: LineItem[];
  subtotalCents: number;
  gstCents: number;
  totalCents: number;
  storagePerDayCents: number;
  rateCardName: string;
  /** Snapshots taken at issue time — issued documents never change. */
  notes: string;
  customer: Pick<JobCustomer, "name" | "mobile" | "email">;
  vehicle: JobVehicle;
  pickup: string;
  destination: string;
  issuedAt: string;
  issuedBy: string;
  deliveries: Delivery[];
  supersededAt?: string;
}

export interface Consent {
  id: string;
  /** "estimate" = consent on the estimate; "revised_amount" = authorization of a different final amount. */
  purpose: "estimate" | "revised_amount";
  estimateVersion: number;
  amountCents: number;
  name: string;
  relationship: string;
  present: boolean;
  method: ConsentMethod;
  at: string;
  evidence?: string;
  recordedBy: string;
  driverConfirmed: boolean;
  /** The company template version and the exact wording shown when consent was captured. */
  templateVersion: number;
  heading: string;
  wording: string;
}

export interface DestinationChange {
  id: string;
  /** When the change happened (driver-entered, defaults to now). */
  at: string;
  recordedAt: string;
  from: string;
  to: string;
  requestedBy: string;
  note: string;
  /** How the owner was told; empty until recorded. */
  ownerNotifiedVia: string;
  ownerNotifiedAt?: string;
}

export interface Photo {
  id: string;
  at: string;
  by: string;
  caption: string;
  dataUrl: string;
}

export interface Invoice {
  number: string;
  version: number;
  token: string;
  items: LineItem[];
  subtotalCents: number;
  gstCents: number;
  totalCents: number;
  notes: string;
  /** Snapshots taken at issue time — issued documents never change. */
  customer: Pick<JobCustomer, "name" | "mobile" | "email">;
  vehicle: JobVehicle;
  pickup: string;
  destination: string;
  tow: Partial<Record<TowEvent, string>>;
  issuedAt: string;
  issuedBy: string;
  deliveries: Delivery[];
  supersededAt?: string;
}

export interface Payment {
  id: string;
  invoiceNumber: string;
  amountCents: number;
  method: string;
  at: string;
  recordedBy: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  by: string;
  role: ActorRole;
  device: string;
  action: string;
}

/** Values a demo scenario suggests; forms start from these but the driver still confirms each screen. */
export interface JobPrefill {
  requestTypeId?: string;
  contactName?: string;
  contactReference?: string;
  customer?: JobCustomer;
  vehicle?: JobVehicle;
  pickup?: string;
  destination?: string;
  destinationConfirmedBy?: string;
  km?: number;
}

export interface Job {
  id: string;
  number: string;
  createdAt: string;
  driverName: string;
  scenario?: ScenarioId;
  prefill?: JobPrefill;
  requestTypeId: string | null;
  requestOther: string;
  /** Who contacted/invited the company (name or organization) and an optional reference number. */
  contactName: string;
  contactReference: string;
  /** Snapshot of the company workflow when the request was recorded. Later config changes don't alter it. */
  workflow: Workflow | null;
  customer: JobCustomer;
  vehicle: JobVehicle;
  pickup: string;
  destination: string;
  destinationConfirmedBy: string;
  notes: string;
  estimateDraft: LineItem[];
  estimates: Estimate[];
  consents: Consent[];
  tow: Partial<Record<TowEvent, string>>;
  destinationChanges: DestinationChange[];
  photos: Photo[];
  invoiceDraft: LineItem[] | null;
  invoices: Invoice[];
  payments: Payment[];
  audit: AuditEntry[];
}

/** Who is making a change, from what device, and when. Every job mutation takes one. */
export interface Actor {
  by: string;
  role: ActorRole;
  device: string;
  now: string;
}
