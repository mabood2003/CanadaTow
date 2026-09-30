// Demo company (fictional) and sample jobs. Jobs are built with the real job actions so they pass the same guardrails.
import type {
  Actor,
  Company,
  ConsentMethod,
  ConsentTemplate,
  DocumentTemplates,
  Job,
  NotificationSettings,
  OutboundMessage,
  RateCard,
  RequestType,
  TeamMember,
  Workflow,
  Yard,
} from "@/lib/domain";
import { consentContext, renderConsent } from "@/lib/describe";
import { deliveredMessages, describeRecipients, documentMessage } from "@/lib/messages";
import {
  addPhoto,
  audit,
  createJob,
  issueEstimate,
  issueInvoice,
  recordConsent,
  recordDelivery,
  recordPayment,
  recordRequest,
  recordTowEvent,
  saveEstimateDraft,
  startInvoiceDraft,
  updateDetails,
} from "@/lib/jobs";
import { currentConsentTemplate, currentEstimate } from "@/lib/tow-rules";

export const DEFAULT_NOTIFICATIONS: NotificationSettings = { deliveredAuto: true, undoSeconds: 30 };

/** Team-member id signed in to each app, or null when signed out. */
export interface Sessions {
  driver: string | null;
  owner: string | null;
}

export interface AppState {
  schemaVersion: 3;
  company: Company;
  rateCards: RateCard[];
  workflows: Workflow[];
  requestTypes: RequestType[];
  consentTemplates: ConsentTemplate[];
  consentMethods: Record<ConsentMethod, boolean>;
  documentTemplates: DocumentTemplates;
  yards: Yard[];
  team: TeamMember[];
  /** Who is signed in to each app on this device (pilot stand-in for real sign-in). */
  sessions: Sessions;
  /** Every text and email to customers and staff (prototype: simulated sending). */
  outbox: OutboundMessage[];
  notifications: NotificationSettings;
  jobs: Job[];
  counters: { job: number };
  /** Interview mode: show the offline experience without disconnecting. */
  simulateOffline: boolean;
}

export const seedCompany: Company = {
  name: "Summit Towing Ltd.",
  address: "Bay 4, 1250 Summit Industrial Way SE, Calgary, AB T2C 0A1",
  phone: "(403) 555-0148",
  email: "dispatch@summittowing.example",
  gstNumber: "123456789 RT0001",
};

export const seedRateCards: RateCard[] = [
  {
    id: "rc-standard",
    name: "Standard rates",
    description: "Customer-requested and general tows.",
    baseTowCents: 12500,
    perKmCents: 450,
    winchCents: 7500,
    afterHoursCents: 4000,
    storagePerDayCents: 4500,
  },
  {
    id: "rc-club",
    name: "Motor club / insurer preset",
    description: "Preset contract rates for club- and insurer-dispatched calls (sample).",
    baseTowCents: 9500,
    perKmCents: 300,
    winchCents: 6000,
    afterHoursCents: 0,
    storagePerDayCents: 4000,
  },
];

export const seedWorkflows: Workflow[] = [
  {
    id: "wf-a",
    letter: "A",
    name: "Customer-Requested Tow",
    description: "Customer receives Summit's estimate and completes Summit's consent step before the tow.",
    requireReference: false,
    referenceLabel: "Requester reference",
    requireEstimate: true,
    requireConsent: true,
    requireDestination: true,
    rateCardId: "rc-standard",
  },
  {
    id: "wf-b",
    letter: "B",
    name: "Motor Club / Insurer Dispatch",
    description: "Preset contract rates. Record the dispatch reference; the customer may be remote.",
    requireReference: true,
    referenceLabel: "Dispatch reference",
    requireEstimate: true,
    requireConsent: true,
    requireDestination: true,
    rateCardId: "rc-club",
  },
  {
    id: "wf-c",
    letter: "C",
    name: "Police-Directed Tow",
    description: "Record the officer and file number. Invoice the owner at release.",
    requireReference: true,
    referenceLabel: "Police file number",
    requireEstimate: false,
    requireConsent: false,
    requireDestination: true,
    rateCardId: "rc-standard",
  },
  {
    id: "wf-d",
    letter: "D",
    name: "Private-Property Tow",
    description: "Record the property representative and authorization. Invoice the owner at release.",
    requireReference: true,
    referenceLabel: "Property authorization",
    requireEstimate: false,
    requireConsent: false,
    requireDestination: true,
    rateCardId: "rc-standard",
  },
];

// Company config: each "who requested" option maps to one of the company's workflows.
export const seedRequestTypes: RequestType[] = [
  { id: "owner_customer", label: "Vehicle owner / customer", workflowId: "wf-a", enabled: true },
  { id: "owner_rep", label: "Owner's representative", workflowId: "wf-a", enabled: true },
  { id: "motor_club", label: "Motor club / roadside assistance", workflowId: "wf-b", enabled: true },
  { id: "insurance", label: "Insurance company", workflowId: "wf-b", enabled: true },
  { id: "police", label: "Police / law enforcement", workflowId: "wf-c", enabled: true },
  { id: "municipality", label: "Municipality / government", workflowId: "wf-c", enabled: true },
  { id: "private_property", label: "Private-property owner", workflowId: "wf-d", enabled: true },
  { id: "other", label: "Other", workflowId: "wf-a", enabled: true },
];

export const seedConsentTemplates: ConsentTemplate[] = [
  {
    version: 1,
    heading: "Tow authorization",
    body: "I authorize {company} to tow my vehicle ({vehicle}) to {destination}.",
    acceptLabel: "I authorize",
    effectiveDate: "2026-01-12",
    updatedBy: "Dana Whitford",
    createdAt: "2026-01-12T17:00:00.000Z",
  },
  {
    version: 2,
    heading: "{company} — Tow authorization",
    body: "I, {customer}, have received estimate #{estimate} for {total} and authorize {company} to tow {vehicle} to {destination}. Storage is {storage} per day if the vehicle is stored at our yard.",
    acceptLabel: "I authorize this tow",
    effectiveDate: "2026-04-01",
    updatedBy: "Dana Whitford",
    createdAt: "2026-03-27T17:00:00.000Z",
  },
  {
    version: 3,
    heading: "{company} — Authorization / Consent",
    body:
      "I, {customer}, am the {relationship} of the vehicle described above ({vehicle}). I have received {company}'s written estimate #{estimate} for {total}, and I authorize {company} to tow this vehicle to {destination}.\n\n" +
      "I understand that storage is charged at {storage} per day if the vehicle is stored at the {company} yard, and that I will receive an itemized invoice before paying.",
    acceptLabel: "I authorize this tow",
    effectiveDate: "2026-09-08",
    updatedBy: "Dana Whitford",
    createdAt: "2026-09-08T16:00:00.000Z",
  },
];

export const seedDocumentTemplates: DocumentTemplates = {
  estimateNotes:
    "This estimate covers today's tow. Your final charges will be shown on an itemized invoice before you pay. Questions? Call Summit dispatch at (403) 555-0148 — we're happy to explain any charge.",
  invoiceNotes: "Payment accepted by debit, credit card or e-transfer. Thank you for choosing Summit Towing.",
};

export const seedYards: Yard[] = [
  { id: "yard-1", name: "Summit yard", address: "Bay 4, 1250 Summit Industrial Way SE, Calgary", hours: "Mon–Sat 8am–6pm · after-hours release by appointment" },
];

export const seedTeam: TeamMember[] = [
  { id: "u-owner", name: "Dana Whitford", email: "dana@summittowing.example", role: "owner", invited: false },
  { id: "u-terry", name: "Terry Boyd", email: "terry@summittowing.example", role: "driver", invited: false },
  { id: "u-mike", name: "Mike Chen", email: "mike@summittowing.example", role: "driver", invited: false },
  { id: "u-jules", name: "Jules Martin", email: "jules@summittowing.example", role: "driver", invited: true },
];

// Tiny illustrations so the sample records have real evidence attached.
export const DEMO_SIGNATURE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120"><path d="M20 80 C60 20, 90 110, 130 60 S190 30, 220 75 S280 90, 300 50" stroke="#152019" stroke-width="3" fill="none"/></svg>',
  );

export const DEMO_PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320"><rect width="480" height="320" fill="#dfe3d9"/><rect y="230" width="480" height="90" fill="#9aa39a"/><path d="M90 220 L130 160 Q140 146 160 146 L310 146 Q330 146 345 160 L395 205 Q410 208 410 222 L410 236 L70 236 L70 228 Q70 220 90 220Z" fill="#24573d"/><path d="M150 160 L175 150 L235 150 L235 196 L130 196Z M250 150 L300 150 Q312 150 322 158 L352 196 L250 196Z" fill="#cfe0d6"/><circle cx="140" cy="238" r="26" fill="#152019"/><circle cx="140" cy="238" r="11" fill="#b9c5bc"/><circle cx="340" cy="238" r="26" fill="#152019"/><circle cx="340" cy="238" r="11" fill="#b9c5bc"/><text x="20" y="34" font-family="monospace" font-size="16" fill="#152019">PHOTO · ON ARRIVAL</text></svg>',
  );

export function at(base: number, minutesAgo: number, by: string, role: Actor["role"] = "driver", device = "Phone"): Actor {
  return { by, role, device, now: new Date(base - minutesAgo * 60_000).toISOString() };
}

export interface Config {
  company: Company;
  rateCards: RateCard[];
  workflows: Workflow[];
  requestTypes: RequestType[];
  consentTemplates: ConsentTemplate[];
  documentTemplates: DocumentTemplates;
}

function configFor(config: Config, requestTypeId: string) {
  const requestType = config.requestTypes.find((t) => t.id === requestTypeId)!;
  const workflow = config.workflows.find((w) => w.id === requestType.workflowId)!;
  const rateCard = config.rateCards.find((r) => r.id === workflow.rateCardId) ?? config.rateCards[0];
  return { requestType, workflow, rateCard };
}

/** Same steps the UI takes: request → customer → vehicle → estimate → deliver → consent. */
export function prepared(
  config: Config,
  base: number,
  start: number,
  driver: string,
  input: {
    number: string;
    requestTypeId: string;
    contactName: string;
    contactReference?: string;
    customer?: Job["customer"];
    vehicle: Job["vehicle"];
    pickup: string;
    destination: string;
    destinationConfirmedBy: string;
    km: number;
  },
): Job {
  const { requestType, workflow, rateCard } = configFor(config, input.requestTypeId);
  let job = createJob({ number: input.number, actor: at(base, start, driver), rateCard, defaultDestination: input.destination });
  job = recordRequest(job, at(base, start - 1, driver), {
    requestType,
    workflow,
    rateCard,
    requestOther: "",
    contactName: input.contactName,
    contactReference: input.contactReference ?? "",
  });
  if (input.customer) {
    job = updateDetails(job, at(base, start - 2, driver), { customer: input.customer }, `Customer recorded: ${input.customer.name} (${input.customer.relationship})`);
  }
  job = updateDetails(
    job,
    at(base, start - 3, driver),
    { vehicle: input.vehicle, pickup: input.pickup, destination: input.destination, destinationConfirmedBy: input.destinationConfirmedBy },
    `Vehicle and job details recorded: ${input.vehicle.plate}; ${input.pickup} → ${input.destination} (supplied by ${input.destinationConfirmedBy})`,
  );
  return saveEstimateDraft(job, job.estimateDraft.map((i) => (i.id === "km" ? { ...i, quantity: input.km } : i)));
}

export function issue(config: Config, job: Job, actor: Actor, requestTypeId: string) {
  const { rateCard } = configFor(config, requestTypeId);
  return issueEstimate(job, actor, { storagePerDayCents: rateCard.storagePerDayCents, rateCardName: rateCard.name, notes: config.documentTemplates.estimateNotes });
}

export function consentInput(config: Config, job: Job) {
  const template = currentConsentTemplate(config.consentTemplates);
  const rendered = renderConsent(template, consentContext(config.company.name, job, currentEstimate(job)));
  return { templateVersion: rendered.templateVersion, heading: rendered.heading, wording: rendered.wording };
}

export function buildSeedState(nowMs = Date.now()): AppState {
  const config: Config = {
    company: seedCompany,
    rateCards: seedRateCards,
    workflows: seedWorkflows,
    requestTypes: seedRequestTypes,
    consentTemplates: seedConsentTemplates,
    documentTemplates: seedDocumentTemplates,
  };
  const DAY = 24 * 60;
  const yard = `${seedYards[0].name} — ${seedYards[0].address}`;
  const outbox: OutboundMessage[] = [];
  const sendDocument = (job: Job, kind: "estimate" | "invoice", channel: "text" | "email", to: string, actor: Actor) => {
    const path = kind === "estimate" ? `/e/${currentEstimate(job)!.token}` : `/i/${job.invoices.at(-1)!.token}`;
    outbox.push(documentMessage({ kind, channel, to, job, company: seedCompany, path, origin: "", actor }));
  };
  // Delivered notices go out automatically; record them (and their audit row) right after delivery.
  const notifyDelivered = (job: Job, minutesAgo: number) => {
    const system = at(nowMs, minutesAgo, "TowLedger", "system", "Server");
    const sent = deliveredMessages({ job, company: seedCompany, yards: seedYards, origin: "", actor: system, delaySeconds: 0 });
    outbox.push(...sent);
    return sent.length ? audit(job, system, `Customer notified that the vehicle was delivered — ${describeRecipients(sent)}`) : job;
  };

  // #1039 — Police-directed (Workflow C), complete.
  let police = prepared(config, nowMs, 3 * DAY + 90, "Mike Chen", {
    number: "1039",
    requestTypeId: "police",
    contactName: "Constable A. Brooks",
    contactReference: "PF 26-118204",
    vehicle: { plate: "BKT 5510", province: "AB", make: "Nissan", model: "Altima", year: "2015", colour: "Grey" },
    pickup: "Collision scene — Memorial Dr NE & 36 St NE, Calgary",
    destination: yard,
    destinationConfirmedBy: "Constable A. Brooks",
    km: 11,
  });
  police = recordTowEvent(police, at(nowMs, 3 * DAY + 80, "Mike Chen"), "arrived");
  police = recordTowEvent(police, at(nowMs, 3 * DAY + 70, "Mike Chen"), "secured");
  police = recordTowEvent(police, at(nowMs, 3 * DAY + 66, "Mike Chen"), "departed");
  police = recordTowEvent(police, at(nowMs, 3 * DAY + 40, "Mike Chen"), "delivered");
  police = updateDetails(
    police,
    at(nowMs, 2 * DAY + 200, "Dana Whitford", "owner", "Computer"),
    { customer: { name: "Lena Fischer", mobile: "(403) 555-0167", email: "lena.f@example.com", relationship: "Owner", present: true } },
    "Owner recorded at release: Lena Fischer",
  );
  police = startInvoiceDraft(police);
  police = { ...police, invoiceDraft: police.invoiceDraft!.map((i) => (i.id === "storage" ? { ...i, quantity: 1 } : i)) };
  police = issueInvoice(police, at(nowMs, 2 * DAY + 195, "Dana Whitford", "owner", "Computer"), config.documentTemplates.invoiceNotes);
  police = recordDelivery(police, at(nowMs, 2 * DAY + 194, "Dana Whitford", "owner", "Computer"), "invoice", "device");
  police = recordPayment(police, at(nowMs, 2 * DAY + 190, "Dana Whitford", "owner", "Computer"), { amountCents: police.invoices[0].totalCents, method: "Credit card" });

  // #1040 — Customer-requested (Workflow A), complete: web acknowledgement, photo, invoice emailed, paid.
  let complete = prepared(config, nowMs, 2 * DAY + 62, "Terry Boyd", {
    number: "1040",
    requestTypeId: "owner_customer",
    contactName: "Priya Nair (vehicle owner)",
    customer: { name: "Priya Nair", mobile: "(403) 555-0192", email: "priya.nair@example.com", relationship: "Owner", present: true },
    vehicle: { plate: "CJM 2087", province: "AB", make: "Toyota", model: "RAV4", year: "2021", colour: "Blue" },
    pickup: "Crowchild Trail NW near 24 Ave NW, Calgary",
    destination: "Ridgeline Auto Repair — 2305 Centre St N, Calgary",
    destinationConfirmedBy: "Priya Nair",
    km: 12,
  });
  complete = recordTowEvent(complete, at(nowMs, 2 * DAY + 57, "Terry Boyd"), "arrived");
  complete = issue(config, complete, at(nowMs, 2 * DAY + 55, "Terry Boyd"), "owner_customer");
  complete = recordDelivery(complete, at(nowMs, 2 * DAY + 54, "Terry Boyd"), "estimate", "text", "(403) 555-0192");
  sendDocument(complete, "estimate", "text", "(403) 555-0192", at(nowMs, 2 * DAY + 54, "Terry Boyd"));
  complete = recordConsent(complete, at(nowMs, 2 * DAY + 48, "Priya Nair", "customer", "Customer link"), {
    purpose: "estimate",
    name: "Priya Nair",
    relationship: "Owner",
    present: true,
    method: "link",
    driverConfirmed: false,
    ...consentInput(config, complete),
  });
  complete = addPhoto(complete, at(nowMs, 2 * DAY + 46, "Terry Boyd"), { dataUrl: DEMO_PHOTO, caption: "Vehicle on arrival" });
  complete = recordTowEvent(complete, at(nowMs, 2 * DAY + 45, "Terry Boyd"), "secured");
  complete = recordTowEvent(complete, at(nowMs, 2 * DAY + 40, "Terry Boyd"), "departed");
  complete = recordTowEvent(complete, at(nowMs, 2 * DAY + 14, "Terry Boyd"), "delivered");
  complete = notifyDelivered(complete, 2 * DAY + 13);
  complete = startInvoiceDraft(complete);
  complete = issueInvoice(complete, at(nowMs, 2 * DAY + 9, "Terry Boyd"), config.documentTemplates.invoiceNotes);
  complete = recordDelivery(complete, at(nowMs, 2 * DAY + 8, "Terry Boyd"), "invoice", "email", "priya.nair@example.com");
  sendDocument(complete, "invoice", "email", "priya.nair@example.com", at(nowMs, 2 * DAY + 8, "Terry Boyd"));
  complete = recordPayment(complete, at(nowMs, 2 * DAY + 2, "Dana Whitford", "owner", "Computer"), { amountCents: complete.invoices[0].totalCents, method: "Debit" });

  // #1041 — Delivered yesterday, invoice never issued: needs attention.
  let problem = prepared(config, nowMs, DAY + 130, "Mike Chen", {
    number: "1041",
    requestTypeId: "owner_customer",
    contactName: "Marcus Reid (driver)",
    customer: { name: "Marcus Reid", mobile: "(587) 555-0144", email: "", relationship: "Driver", present: true },
    vehicle: { plate: "BVR 3316", province: "AB", make: "Ford", model: "Escape", year: "2018", colour: "Grey" },
    pickup: "Macleod Trail SE & 58 Ave SE, Calgary",
    destination: yard,
    destinationConfirmedBy: "Marcus Reid",
    km: 8,
  });
  problem = recordTowEvent(problem, at(nowMs, DAY + 118, "Mike Chen"), "arrived");
  problem = issue(config, problem, at(nowMs, DAY + 116, "Mike Chen"), "owner_customer");
  problem = recordDelivery(problem, at(nowMs, DAY + 115, "Mike Chen"), "estimate", "device");
  problem = recordConsent(problem, at(nowMs, DAY + 112, "Mike Chen"), {
    purpose: "estimate",
    name: "Marcus Reid",
    relationship: "Driver",
    present: true,
    method: "signature",
    evidence: DEMO_SIGNATURE,
    driverConfirmed: true,
    ...consentInput(config, problem),
  });
  problem = recordTowEvent(problem, at(nowMs, DAY + 105, "Mike Chen"), "secured");
  problem = recordTowEvent(problem, at(nowMs, DAY + 100, "Mike Chen"), "departed");
  problem = recordTowEvent(problem, at(nowMs, DAY + 78, "Mike Chen"), "delivered");
  problem = notifyDelivered(problem, DAY + 77);

  // #1042 — Motor club (Workflow B): estimate texted, waiting for the customer.
  let waiting = prepared(config, nowMs, 38, "Terry Boyd", {
    number: "1042",
    requestTypeId: "motor_club",
    contactName: "Roadside dispatch (sample motor club)",
    contactReference: "RC-558213",
    customer: { name: "Alex Langford", mobile: "(403) 555-0791", email: "alex.langford@example.com", relationship: "Owner", present: false },
    vehicle: { plate: "CPL 1954", province: "AB", make: "Honda", model: "Civic", year: "2019", colour: "Red" },
    pickup: "Stoney Trail NW near Country Hills Blvd",
    destination: yard,
    destinationConfirmedBy: "Alex Langford (by phone)",
    km: 18,
  });
  waiting = issue(config, waiting, at(nowMs, 30, "Terry Boyd"), "motor_club");
  waiting = recordDelivery(waiting, at(nowMs, 29, "Terry Boyd"), "estimate", "text", "(403) 555-0791");
  sendDocument(waiting, "estimate", "text", "(403) 555-0791", at(nowMs, 29, "Terry Boyd"));
  waiting = recordTowEvent(waiting, at(nowMs, 20, "Terry Boyd"), "arrived");

  // #1043 — Private-property (Workflow D): on the road right now, so the owner app has a live tow to show.
  let onRoad = prepared(config, nowMs, 32, "Mike Chen", {
    number: "1043",
    requestTypeId: "private_property",
    contactName: "Kensington Plaza property management",
    contactReference: "Signed tow authorization KP-0931",
    vehicle: { plate: "CRW 7742", province: "AB", make: "Chevrolet", model: "Silverado", year: "2017", colour: "White" },
    pickup: "Kensington Plaza lot, 1144 Kensington Rd NW, Calgary",
    destination: yard,
    destinationConfirmedBy: "Kensington Plaza property management",
    km: 9,
  });
  onRoad = recordTowEvent(onRoad, at(nowMs, 26, "Mike Chen"), "arrived");
  onRoad = recordTowEvent(onRoad, at(nowMs, 18, "Mike Chen"), "secured");
  onRoad = recordTowEvent(onRoad, at(nowMs, 14, "Mike Chen"), "departed");

  return {
    schemaVersion: 3,
    company: seedCompany,
    rateCards: seedRateCards,
    workflows: seedWorkflows,
    requestTypes: seedRequestTypes,
    consentTemplates: seedConsentTemplates,
    consentMethods: { link: true, signature: true, audio: true, paper_photo: true },
    documentTemplates: seedDocumentTemplates,
    yards: seedYards,
    team: seedTeam,
    sessions: { driver: "u-terry", owner: "u-owner" },
    outbox: outbox.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    notifications: DEFAULT_NOTIFICATIONS,
    jobs: [onRoad, waiting, problem, complete, police],
    counters: { job: 1044 },
    simulateOffline: false,
  };
}
