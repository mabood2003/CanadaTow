// Interview mode: scripted demo scenarios for a fictional company (Summit Towing Ltd.).
// Scenario jobs start with suggested values; the presenter still taps through every screen.
import type { JobPrefill, ScenarioId } from "@/lib/domain";

export interface Scenario {
  id: ScenarioId;
  kicker: string;
  title: string;
  summary: string;
  beats: string[];
  question: string;
  prefill: JobPrefill;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "customer_breakdown",
    kicker: "Scenario 1 · about 2 minutes",
    title: "John Smith's F-150 breaks down in Calgary",
    summary: "John calls Summit directly and asks for a tow to his repair shop. The driver follows Summit's Workflow A from estimate to complete record.",
    beats: [
      "Who requested → Vehicle owner / customer",
      "Summit's Workflow A appears",
      "Customer, vehicle and destination (prefilled)",
      "Estimate from Summit's standard rates → send by text",
      "Open the customer link → Summit's consent wording → I authorize",
      "Consent evidence → ready to proceed → tow → invoice → complete record",
    ],
    question: "Does this match how your drivers handle a customer-called tow today? Which screen would slow your driver down at the roadside?",
    prefill: {
      requestTypeId: "owner_customer",
      contactName: "John Smith (vehicle owner)",
      customer: { name: "John Smith", mobile: "(403) 555-0199", email: "john.smith@example.com", relationship: "Owner", present: true },
      vehicle: { plate: "CKR 4821", province: "AB", make: "Ford", model: "F-150", year: "2019", colour: "Black" },
      pickup: "Glenmore Trail SW & 14 St SW, Calgary",
      destination: "Ridgeline Auto Repair — 2305 Centre St N, Calgary",
      destinationConfirmedBy: "John Smith",
      km: 14,
    },
  },
  {
    id: "motor_club",
    kicker: "Scenario 2 · motor club / insurer",
    title: "Motor club dispatches a breakdown — customer not on scene",
    summary: "A motor club calls on the customer's behalf. Summit maps motor-club jobs to Workflow B with preset contract rates, and the customer isn't physically present at first.",
    beats: [
      "Who requested → Motor club / roadside assistance, with dispatch reference",
      "Summit's Workflow B (preset rates) appears",
      "Customer present? No → remote methods",
      "Estimate uses the preset rate card → send by text",
      "Record another consent method → audio record by phone",
    ],
    question: "Does this resemble how AMA or insurer jobs actually work for you? Who agrees to the price — the club, the insurer, or the customer?",
    prefill: {
      requestTypeId: "motor_club",
      contactName: "Roadside dispatch (sample motor club)",
      contactReference: "RC-771045",
      customer: { name: "Sarah Chen", mobile: "(587) 555-0126", email: "", relationship: "Owner", present: false },
      vehicle: { plate: "CPL 7702", province: "AB", make: "Honda", model: "CR-V", year: "2020", colour: "White" },
      pickup: "Hwy 2 northbound near the Airdrie exit",
      destination: "Customer's dealer — 800 Main St S, Airdrie",
      destinationConfirmedBy: "Roadside dispatch, for Sarah Chen",
      km: 32,
    },
  },
  {
    id: "police_private",
    kicker: "Scenario 3 · police / private property",
    title: "Police-directed or private-property tow",
    summary: "An officer asks Summit to clear a collision scene. TowLedger doesn't decide what rules apply — it shows the workflow Summit configured for this category.",
    beats: [
      "Who requested → Police / law enforcement (or switch to Private-property owner)",
      "“Summit Towing configured Workflow C for this job category”",
      "Officer name and police file number recorded",
      "Tow → invoice to the owner at release → record",
    ],
    question: "What should actually happen here in your company? Would you want a different process for private-property tows?",
    prefill: {
      requestTypeId: "police",
      contactName: "Constable R. Patel",
      contactReference: "PF 26-120931",
      vehicle: { plate: "DHT 9034", province: "AB", make: "Chevrolet", model: "Malibu", year: "2016", colour: "Silver" },
      pickup: "Collision scene — 16 Ave NE & 19 St NE, Calgary",
      destinationConfirmedBy: "Constable R. Patel",
      km: 9,
    },
  },
];

export function scenarioFor(id: ScenarioId | undefined): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
