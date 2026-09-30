// Core record types. Money is integer cents; timestamps are UTC ISO strings.

export type Workflow = "consumer" | "exempt" | "to_confirm";
export type LegalStatus = "confirmed" | "to_be_confirmed";
export type ConsentMethod = "link" | "signature" | "audio" | "paper_photo";
export type DeliveryMethod = "text" | "email" | "device" | "print";
export type TowEvent = "arrived" | "secured" | "departed" | "delivered";

export const TOW_EVENTS: TowEvent[] = ["arrived", "secured", "departed", "delivered"];

export const TOW_EVENT_LABELS: Record<TowEvent, string> = {
  arrived: "Arrived at pickup",
  secured: "Vehicle secured",
  departed: "Departed — on route",
  delivered: "Delivered to destination",
};

export const CONSENT_METHOD_LABELS: Record<ConsentMethod, string> = {
  link: "Customer tapped the estimate link",
  signature: "Signed on driver's phone",
  audio: "Audio consent recorded",
  paper_photo: "Paper form photographed",
};

export const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  text: "Text message",
  email: "Email",
  device: "Shown on driver's device",
  print: "Printed",
};

export const RELATIONSHIPS = ["Owner", "Driver", "Family member", "Insurance rep", "Motor-club rep", "Other"] as const;

export const INVITED_BY_OPTIONS = [
  "Vehicle owner or driver called us",
  "Police asked us to attend",
  "Motor club or insurer dispatched us",
  "Property owner or manager called us",
  "Other",
] as const;

export interface RequestType {
  id: string;
  label: string;
  workflow: Workflow;
  legalStatus: LegalStatus;
}

export interface Company {
  name: string;
  address: string;
  phone: string;
  email: string;
  gstNumber: string;
}

export interface RateCard {
  hookupCents: number;
  perKmCents: number;
  winchCents: number;
  afterHoursCents: number;
  storagePerDayCents: number;
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
}

export interface Estimate {
  version: number;
  token: string;
  items: LineItem[];
  subtotalCents: number;
  gstCents: number;
  totalCents: number;
  storagePerDayCents: number;
  /** Snapshots taken at issue time — issued documents never change. */
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
  /** "estimate" = consent to tow on the estimate; "revised_amount" = authorization of a different final amount. */
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
}

export interface DestinationChange {
  id: string;
  at: string;
  from: string;
  to: string;
  authorizedBy: string;
  reason: string;
  ownerNotifiedVia: string;
  notifiedAt: string;
}

export interface Invoice {
  number: string;
  version: number;
  token: string;
  items: LineItem[];
  subtotalCents: number;
  gstCents: number;
  totalCents: number;
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
  device: string;
  action: string;
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

export interface Job {
  id: string;
  number: string;
  createdAt: string;
  driverName: string;
  requestTypeId: string | null;
  requestOther: string;
  invitedBy: string;
  invitedByOther: string;
  exemptReason: string;
  customer: JobCustomer;
  vehicle: JobVehicle;
  pickup: string;
  destination: string;
  destinationConfirmed: boolean;
  estimateDraft: LineItem[];
  estimates: Estimate[];
  consents: Consent[];
  tow: Partial<Record<TowEvent, string>>;
  destinationChanges: DestinationChange[];
  invoiceDraft: LineItem[] | null;
  invoices: Invoice[];
  payments: Payment[];
  audit: AuditEntry[];
}

/** Who is making a change, from what device, and when. Every job mutation takes one. */
export interface Actor {
  by: string;
  device: string;
  now: string;
}
