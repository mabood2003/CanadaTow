// Demo company and sample jobs. Jobs are built with the real job actions so they pass the same guardrails.
import type { Actor, Company, Job, RateCard, RequestType, TeamMember, Yard } from "@/lib/domain";
import {
  createJob,
  issueEstimate,
  issueInvoice,
  recordConsent,
  recordDelivery,
  recordPayment,
  recordTowEvent,
  saveEstimateDraft,
  startInvoiceDraft,
  updateDetails,
} from "@/lib/jobs";

export interface AppState {
  schemaVersion: 2;
  company: Company;
  rateCard: RateCard;
  yards: Yard[];
  team: TeamMember[];
  currentUserId: string;
  requestTypes: RequestType[];
  jobs: Job[];
  counters: { job: number; invoice: number };
}

// Config table, not code: the UI reads classification from here (mirrors request_types in schema.sql).
export const seedRequestTypes: RequestType[] = [
  { id: "owner_customer", label: "Vehicle owner / customer", workflow: "consumer", legalStatus: "confirmed" },
  { id: "owner_rep", label: "Owner's representative", workflow: "to_confirm", legalStatus: "to_be_confirmed" },
  { id: "motor_club", label: "Motor club / roadside assistance", workflow: "to_confirm", legalStatus: "to_be_confirmed" },
  { id: "insurance", label: "Insurance company", workflow: "to_confirm", legalStatus: "to_be_confirmed" },
  { id: "police", label: "Police", workflow: "exempt", legalStatus: "confirmed" },
  { id: "municipality", label: "Municipality / government", workflow: "exempt", legalStatus: "confirmed" },
  { id: "private_property", label: "Private-property owner", workflow: "to_confirm", legalStatus: "to_be_confirmed" },
  { id: "other", label: "Other", workflow: "to_confirm", legalStatus: "to_be_confirmed" },
];

export const seedCompany: Company = {
  name: "Foothills Demo Towing",
  address: "127 7 Ave SW, Calgary, AB T2P 0W4",
  phone: "(403) 555-0148",
  email: "office@foothills-demo.ca",
  gstNumber: "123456789 RT0001",
};

export const seedRateCard: RateCard = {
  hookupCents: 17500,
  perKmCents: 350,
  winchCents: 9000,
  afterHoursCents: 7000,
  storagePerDayCents: 3500,
};

export const seedYards: Yard[] = [
  { id: "yard-1", name: "Downtown Yard", address: "200 10 Ave SE, Calgary, AB", hours: "Mon–Sat 8am–6pm" },
];

export const seedTeam: TeamMember[] = [
  { id: "u-owner", name: "Morgan Lee", email: "owner@foothills-demo.ca", role: "owner", invited: false },
  { id: "u-ava", name: "Ava Thompson", email: "ava@foothills-demo.ca", role: "driver", invited: false },
  { id: "u-mateo", name: "Mateo Ruiz", email: "mateo@foothills-demo.ca", role: "driver", invited: true },
];

// A tiny signature image so the completed demo job has real evidence attached.
const DEMO_SIGNATURE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120"><path d="M20 80 C60 20, 90 110, 130 60 S190 30, 220 75 S280 90, 300 50" stroke="#0f172a" stroke-width="3" fill="none"/></svg>',
  );

function at(base: number, minutesAgo: number, by: string, device = "Phone"): Actor {
  return { by, device, now: new Date(base - minutesAgo * 60_000).toISOString() };
}

export function buildSeedState(nowMs = Date.now()): AppState {
  const ava = "Ava Thompson";
  const yard = `${seedYards[0].name} — ${seedYards[0].address}`;
  const DAY = 24 * 60;

  // 1. Complete consumer tow, signed on the driver's phone, invoiced and paid.
  let complete = createJob({ number: "TW-1001", actor: at(nowMs, 2 * DAY + 60, ava), rateCard: seedRateCard, defaultDestination: yard });
  complete = updateDetails(complete, at(nowMs, 2 * DAY + 58, ava), { requestTypeId: "owner_customer", invitedBy: "Vehicle owner or driver called us" }, "Request type: Vehicle owner / customer");
  complete = recordTowEvent(complete, at(nowMs, 2 * DAY + 57, ava), seedRequestTypes[0], "arrived");
  complete = updateDetails(complete, at(nowMs, 2 * DAY + 56, ava), { customer: { name: "Jamie Clarke", mobile: "(403) 555-0192", email: "jamie@example.com", relationship: "Owner", present: true } }, "Consenting person recorded");
  complete = updateDetails(complete, at(nowMs, 2 * DAY + 54, ava), { vehicle: { plate: "ABC 123", province: "AB", make: "Toyota", model: "Corolla", year: "2021", colour: "White" }, pickup: "17 Ave SW & 4 St SW, Calgary", destinationConfirmed: true }, "Vehicle and tow details recorded");
  complete = saveEstimateDraft(complete, complete.estimateDraft.map((i) => (i.id === "km" ? { ...i, quantity: 18 } : i.id === "storage" ? { ...i, quantity: 2 } : i)));
  complete = issueEstimate(complete, at(nowMs, 2 * DAY + 50, ava), seedRateCard.storagePerDayCents);
  complete = recordDelivery(complete, at(nowMs, 2 * DAY + 49, ava), "estimate", "text", "(403) 555-0192");
  complete = recordConsent(complete, at(nowMs, 2 * DAY + 47, ava), { purpose: "estimate", name: "Jamie Clarke", relationship: "Owner", present: true, method: "signature", evidence: DEMO_SIGNATURE, driverConfirmed: true });
  complete = recordTowEvent(complete, at(nowMs, 2 * DAY + 40, ava), seedRequestTypes[0], "secured");
  complete = recordTowEvent(complete, at(nowMs, 2 * DAY + 35, ava), seedRequestTypes[0], "departed");
  complete = recordTowEvent(complete, at(nowMs, 2 * DAY + 10, ava), seedRequestTypes[0], "delivered");
  complete = startInvoiceDraft(complete);
  complete = issueInvoice(complete, at(nowMs, 2 * DAY + 5, ava), "INV-5001");
  complete = recordDelivery(complete, at(nowMs, 2 * DAY + 4, ava), "invoice", "email", "jamie@example.com");
  complete = recordPayment(complete, at(nowMs, 2 * DAY, "Morgan Lee", "Computer"), { amountCents: complete.invoices[0].totalCents, method: "Debit" });

  // 2. Problem state: delivered yesterday, invoice never issued.
  let problem = createJob({ number: "TW-1002", actor: at(nowMs, DAY + 120, ava), rateCard: seedRateCard, defaultDestination: yard });
  problem = updateDetails(problem, at(nowMs, DAY + 118, ava), { requestTypeId: "owner_customer", invitedBy: "Vehicle owner or driver called us" }, "Request type: Vehicle owner / customer");
  problem = updateDetails(problem, at(nowMs, DAY + 116, ava), { customer: { name: "M. Singh", mobile: "(587) 555-0144", email: "", relationship: "Driver", present: false } }, "Consenting person recorded");
  problem = updateDetails(problem, at(nowMs, DAY + 114, ava), { vehicle: { plate: "PQR 441", province: "AB", make: "Ford", model: "Escape", year: "2018", colour: "Grey" }, pickup: "Macleod Trail & 58 Ave SE, Calgary", destinationConfirmed: true }, "Vehicle and tow details recorded");
  problem = issueEstimate(problem, at(nowMs, DAY + 110, ava), seedRateCard.storagePerDayCents);
  problem = recordDelivery(problem, at(nowMs, DAY + 109, ava), "estimate", "text", "(587) 555-0144");
  problem = recordConsent(problem, at(nowMs, DAY + 100, "M. Singh", "Customer link"), { purpose: "estimate", name: "M. Singh", relationship: "Driver", present: false, method: "link", driverConfirmed: false });
  problem = recordTowEvent(problem, at(nowMs, DAY + 98, ava), seedRequestTypes[0], "arrived");
  problem = recordTowEvent(problem, at(nowMs, DAY + 95, ava), seedRequestTypes[0], "secured");
  problem = recordTowEvent(problem, at(nowMs, DAY + 90, ava), seedRequestTypes[0], "departed");
  problem = recordTowEvent(problem, at(nowMs, DAY + 70, ava), seedRequestTypes[0], "delivered");

  // 3. Waiting for consent: motor-club call (classification to be confirmed → full consumer workflow).
  const motorClub = seedRequestTypes.find((t) => t.id === "motor_club")!;
  let waiting = createJob({ number: "TW-1003", actor: at(nowMs, 25, ava), rateCard: seedRateCard, defaultDestination: yard });
  waiting = updateDetails(waiting, at(nowMs, 24, ava), { requestTypeId: motorClub.id, invitedBy: "Motor club or insurer dispatched us" }, `Request type: ${motorClub.label}`);
  waiting = updateDetails(waiting, at(nowMs, 22, ava), { customer: { name: "A. Langford", mobile: "(403) 555-0791", email: "alangford@example.com", relationship: "Owner", present: true } }, "Consenting person recorded");
  waiting = updateDetails(waiting, at(nowMs, 20, ava), { vehicle: { plate: "XYZ 781", province: "AB", make: "Honda", model: "Civic", year: "2019", colour: "Blue" }, pickup: "Crowchild Trail NW near University Dr", destinationConfirmed: true }, "Vehicle and tow details recorded");
  waiting = issueEstimate(waiting, at(nowMs, 15, ava), seedRateCard.storagePerDayCents);
  waiting = recordDelivery(waiting, at(nowMs, 14, ava), "estimate", "text", "(403) 555-0791");
  waiting = recordTowEvent(waiting, at(nowMs, 12, ava), motorClub, "arrived");

  return {
    schemaVersion: 2,
    company: seedCompany,
    rateCard: seedRateCard,
    yards: seedYards,
    team: seedTeam,
    currentUserId: "u-ava",
    requestTypes: seedRequestTypes,
    jobs: [waiting, problem, complete],
    counters: { job: 1004, invoice: 5002 },
  };
}
