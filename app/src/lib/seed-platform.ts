// Demo platform: Summit (the interview company) plus two more fictional companies, so the admin console
// has a pilot with real jobs and one that was just onboarded. Built with the real job actions.
import type { Actor, Job } from "@/lib/domain";
import { issueInvoice, recordConsent, recordDelivery, recordPayment, recordTowEvent, startInvoiceDraft } from "@/lib/jobs";
import { companyFromTemplate, type CompanyAccount, type PlatformAdmin, type PlatformState } from "@/lib/platform";
import { at, buildSeedState, consentInput, issue, prepared, type AppState } from "@/lib/seed";

/** One shared TowLedger team account for the admin console. */
export const TEAM_ADMIN: PlatformAdmin = { id: "admin-team", name: "TowLedger Team", email: "team@towledger.example" };
export const seedAdmins: PlatformAdmin[] = [TEAM_ADMIN];

const DAY = 24 * 60;

/** Interview mode's company. */
export const DEMO_COMPANY_ID = "co-summit";

function prairie(nowMs: number): AppState {
  const onboarded: Actor = at(nowMs, 6 * DAY, TEAM_ADMIN.name, "system", "TowLedger admin");
  const base = companyFromTemplate(
    {
      name: "Prairie Roadside Recovery Inc.",
      address: "4820 50 Ave, Red Deer, AB T4N 4A1",
      phone: "(403) 555-0177",
      email: "dispatch@prairieroadside.example",
      gstNumber: "987654321 RT0001",
      ownerName: "Kelsey Morin",
      ownerEmail: "kelsey@prairieroadside.example",
      yardName: "Prairie yard",
      yardAddress: "7700 Edgar Industrial Dr, Red Deer",
      yardHours: "Mon–Fri 8am–5pm",
    },
    onboarded,
    "",
  );
  const owner = base.team[0];
  const app: AppState = {
    ...base,
    team: [
      { ...owner, invited: false },
      { id: "u-raj", name: "Raj Patel", email: "raj@prairieroadside.example", role: "driver", invited: false },
      { id: "u-owen", name: "Owen Fraser", email: "owen@prairieroadside.example", role: "driver", invited: false },
    ],
    sessions: { driver: "u-raj", owner: owner.id },
  };
  const yard = `${app.yards[0].name} — ${app.yards[0].address}`;

  // #1001 — customer tow, complete.
  let done: Job = prepared(app, nowMs, 4 * DAY + 70, "Raj Patel", {
    number: "1001",
    requestTypeId: "owner_customer",
    contactName: "Laura Chen (vehicle owner)",
    customer: { name: "Laura Chen", mobile: "(403) 555-0133", email: "", relationship: "Owner", present: true },
    vehicle: { plate: "BRD 2291", province: "AB", make: "Mazda", model: "CX-5", year: "2020", colour: "Silver" },
    pickup: "Gaetz Ave & 67 St, Red Deer",
    destination: yard,
    destinationConfirmedBy: "Laura Chen",
    km: 6,
  });
  done = issue(app, done, at(nowMs, 4 * DAY + 64, "Raj Patel"), "owner_customer");
  done = recordDelivery(done, at(nowMs, 4 * DAY + 63, "Raj Patel"), "estimate", "device");
  done = recordConsent(done, at(nowMs, 4 * DAY + 61, "Laura Chen", "customer", "Customer link"), { purpose: "estimate", name: "Laura Chen", relationship: "Owner", present: true, method: "link", driverConfirmed: false, ...consentInput(app, done) });
  for (const [event, m] of [["arrived", 60], ["secured", 55], ["departed", 50], ["delivered", 35]] as const) done = recordTowEvent(done, at(nowMs, 4 * DAY + m, "Raj Patel"), event);
  done = startInvoiceDraft(done);
  done = issueInvoice(done, at(nowMs, 4 * DAY + 30, "Raj Patel"), app.documentTemplates.invoiceNotes);
  done = recordPayment(done, at(nowMs, 4 * DAY + 28, "Raj Patel"), { amountCents: done.invoices[0].totalCents, method: "Debit" });

  // #1002 — motor club tow delivered yesterday, invoice never issued.
  let missing: Job = prepared(app, nowMs, DAY + 200, "Owen Fraser", {
    number: "1002",
    requestTypeId: "motor_club",
    contactName: "Roadside dispatch (sample motor club)",
    contactReference: "RC-771045",
    customer: { name: "Deb Olsen", mobile: "(587) 555-0102", email: "", relationship: "Owner", present: false },
    vehicle: { plate: "CWL 8830", province: "AB", make: "Subaru", model: "Outback", year: "2016", colour: "Green" },
    pickup: "QE2 Hwy northbound near Blackfalds",
    destination: yard,
    destinationConfirmedBy: "Deb Olsen (by phone)",
    km: 22,
  });
  missing = issue(app, missing, at(nowMs, DAY + 195, "Owen Fraser"), "motor_club");
  missing = recordDelivery(missing, at(nowMs, DAY + 194, "Owen Fraser"), "estimate", "text", "(587) 555-0102");
  missing = recordConsent(missing, at(nowMs, DAY + 185, "Deb Olsen", "customer", "Customer link"), { purpose: "estimate", name: "Deb Olsen", relationship: "Owner", present: false, method: "link", driverConfirmed: false, ...consentInput(app, missing) });
  for (const [event, m] of [["arrived", 180], ["secured", 172], ["departed", 168], ["delivered", 140]] as const) missing = recordTowEvent(missing, at(nowMs, DAY + m, "Owen Fraser"), event);

  // #1003 — police tow on the road now.
  let live: Job = prepared(app, nowMs, 40, "Raj Patel", {
    number: "1003",
    requestTypeId: "police",
    contactName: "Cst. R. Singh, RCMP Red Deer",
    contactReference: "RD 26-44810",
    vehicle: { plate: "BXT 6612", province: "AB", make: "Dodge", model: "Ram 1500", year: "2014", colour: "Black" },
    pickup: "Collision scene — 32 St & 40 Ave, Red Deer",
    destination: yard,
    destinationConfirmedBy: "Cst. R. Singh",
    km: 5,
  });
  for (const [event, m] of [["arrived", 30], ["secured", 22], ["departed", 12]] as const) live = recordTowEvent(live, at(nowMs, m, "Raj Patel"), event);

  return { ...app, jobs: [live, missing, done], counters: { job: 1004 } };
}

function northgate(nowMs: number): AppState {
  return companyFromTemplate(
    {
      name: "Northgate Towing",
      address: "11820 142 St NW, Edmonton, AB T5L 2R3",
      phone: "(780) 555-0161",
      email: "office@northgatetowing.example",
      gstNumber: "",
      ownerName: "Sandeep Gill",
      ownerEmail: "sandeep@northgatetowing.example",
      yardName: "Northgate yard",
      yardAddress: "11820 142 St NW, Edmonton",
      yardHours: "24/7 release by appointment",
    },
    at(nowMs, DAY + 90, TEAM_ADMIN.name, "system", "TowLedger admin"),
    "",
  );
}

export function buildPlatformSeed(nowMs = Date.now(), summit: AppState = buildSeedState(nowMs)): PlatformState {
  const iso = (minutesAgo: number) => new Date(nowMs - minutesAgo * 60_000).toISOString();
  const companies: CompanyAccount[] = [
    { id: DEMO_COMPANY_ID, status: "pilot", createdAt: "2026-01-12T17:00:00.000Z", createdBy: TEAM_ADMIN.name, notes: "Interview / demo company. Calgary, 3 drivers.", data: summit },
    { id: "co-prairie", status: "pilot", createdAt: iso(6 * DAY), createdBy: TEAM_ADMIN.name, notes: "Red Deer pilot. Motor-club heavy; asked about QuickBooks export.", data: prairie(nowMs) },
    { id: "co-northgate", status: "onboarding", createdAt: iso(DAY + 90), createdBy: TEAM_ADMIN.name, notes: "Owner invited; hasn't signed in yet.", data: northgate(nowMs) },
  ];
  return {
    schemaVersion: 1,
    admins: seedAdmins,
    adminSession: null,
    companies,
    activeCompanyId: DEMO_COMPANY_ID,
    adminAudit: [
      { id: "aa-1", at: iso(6 * DAY), by: TEAM_ADMIN.name, action: "Onboarded Prairie Roadside Recovery Inc. from the TowLedger starting template; invited owner Kelsey Morin", companyId: "co-prairie" },
      { id: "aa-2", at: iso(DAY + 90), by: TEAM_ADMIN.name, action: "Onboarded Northgate Towing from the TowLedger starting template; invited owner Sandeep Gill", companyId: "co-northgate" },
    ],
  };
}
