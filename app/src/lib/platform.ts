// TowLedger platform: every towing company on TowLedger, plus the TowLedger team's admin console.
// Each company's data (an AppState) is private to that company; the admin console reads across companies
// for support and writes an admin audit row for every view and change.
import type { Actor, ConsentTemplate, OutboundMessage } from "@/lib/domain";
import { newId } from "@/lib/jobs";
import { inviteMessage } from "@/lib/messages";
import { balanceCents, liveStage, needsAttention } from "@/lib/owner-view";
import { DEFAULT_NOTIFICATIONS, seedConsentTemplates, seedRateCards, seedRequestTypes, seedWorkflows, type AppState } from "@/lib/seed";

export type CompanyStatus = "onboarding" | "pilot" | "active" | "paused";

export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  onboarding: "Onboarding",
  pilot: "Pilot",
  active: "Active",
  paused: "Paused",
};

export interface CompanyAccount {
  id: string;
  status: CompanyStatus;
  createdAt: string;
  createdBy: string;
  /** Internal TowLedger notes about this customer (never shown to the company). */
  notes: string;
  data: AppState;
}

export interface PlatformAdmin {
  id: string;
  name: string;
  email: string;
}

export interface AdminAuditEntry {
  id: string;
  at: string;
  by: string;
  action: string;
  companyId?: string;
}

export interface PlatformState {
  schemaVersion: 1;
  admins: PlatformAdmin[];
  adminSession: string | null;
  companies: CompanyAccount[];
  /** The company the driver and owner apps on this device are signed in to. */
  activeCompanyId: string;
  adminAudit: AdminAuditEntry[];
}

export function adminAudit(platform: PlatformState, by: string, now: string, action: string, companyId?: string): PlatformState {
  return { ...platform, adminAudit: [...platform.adminAudit, { id: newId("aa-"), at: now, by, action, companyId }] };
}

// ---------------------------------------------------------------------------
// Onboarding from the TowLedger starting template

export interface OnboardingInput {
  name: string;
  address: string;
  phone: string;
  email: string;
  gstNumber: string;
  ownerName: string;
  ownerEmail: string;
  yardName: string;
  yardAddress: string;
  yardHours: string;
}

/** Workflows A–D, two rate cards and a consent template the new company then edits to match its own process. */
export function companyFromTemplate(input: OnboardingInput, actor: Actor, origin: string): AppState {
  const short = input.name.replace(/\b(Ltd|Inc|Corp|Co)\.?$/i, "").trim();
  const latest = seedConsentTemplates.at(-1)!;
  const consent: ConsentTemplate = {
    version: 1,
    heading: latest.heading,
    body: latest.body,
    acceptLabel: latest.acceptLabel,
    effectiveDate: actor.now.slice(0, 10),
    updatedBy: `${actor.by} (TowLedger onboarding)`,
    createdAt: actor.now,
  };
  const company = { name: input.name.trim(), address: input.address.trim(), phone: input.phone.trim(), email: input.email.trim(), gstNumber: input.gstNumber.trim() };
  const owner = { id: newId("u-"), name: input.ownerName.trim(), email: input.ownerEmail.trim(), role: "owner" as const, invited: true };
  const invite: OutboundMessage = {
    ...inviteMessage({ name: owner.name, email: owner.email, company, origin, actor }),
    kind: "invite",
    subject: `Your TowLedger account for ${company.name}`,
    body: `${actor.by} from TowLedger set up ${company.name}. Open ${origin}/owner and choose your name to sign in, then review your rates, workflows and consent wording in Company setup.`,
  };
  return {
    schemaVersion: 3,
    company,
    rateCards: seedRateCards.map((r) => ({ ...r })),
    workflows: seedWorkflows.map((w) => ({ ...w, description: w.description.replace(/Summit's/g, `${short}'s`) })),
    requestTypes: seedRequestTypes.map((t) => ({ ...t })),
    consentTemplates: [consent],
    consentMethods: { link: true, signature: true, audio: true, paper_photo: true },
    documentTemplates: {
      estimateNotes: `This estimate covers today's tow. Your final charges will be shown on an itemized invoice before you pay. Questions? Call ${company.phone}.`,
      invoiceNotes: `Thank you for choosing ${company.name}.`,
    },
    yards: [{ id: newId("yard-"), name: input.yardName.trim(), address: input.yardAddress.trim(), hours: input.yardHours.trim() }],
    team: [owner],
    sessions: { driver: null, owner: null },
    jobs: [],
    counters: { job: 1001 },
    simulateOffline: false,
    outbox: [invite],
    notifications: DEFAULT_NOTIFICATIONS,
  };
}

export function validateOnboarding(input: OnboardingInput, existing: CompanyAccount[]): string | null {
  const required: [keyof OnboardingInput, string][] = [
    ["name", "company name"],
    ["address", "business address"],
    ["phone", "business phone"],
    ["ownerName", "owner's name"],
    ["ownerEmail", "owner's email"],
    ["yardName", "yard name"],
    ["yardAddress", "yard address"],
  ];
  const missing = required.find(([key]) => !input[key].trim());
  if (missing) return `Enter the ${missing[1]}.`;
  if (!/^\S+@\S+\.\S+$/.test(input.ownerEmail.trim())) return "The owner's email doesn't look right.";
  if (existing.some((c) => c.data.company.name.trim().toLowerCase() === input.name.trim().toLowerCase())) return "A company with that name is already on TowLedger.";
  return null;
}

// ---------------------------------------------------------------------------
// Health of each company, for the admin overview

export interface CompanyMetrics {
  drivers: number;
  invitedPending: number;
  jobsTotal: number;
  jobsThisWeek: number;
  needsAttention: number;
  live: number;
  unpaidCents: number;
  messagesThisWeek: number;
  lastActiveAt?: string;
}

export function companyMetrics(account: CompanyAccount, nowMs: number): CompanyMetrics {
  const { jobs, team, outbox } = account.data;
  const weekAgo = new Date(nowMs - 7 * 24 * 3600_000).toISOString();
  const lastActiveAt = jobs
    .flatMap((j) => j.audit.filter((a) => a.role === "driver" || a.role === "owner").map((a) => a.at))
    .sort()
    .at(-1);
  return {
    drivers: team.filter((m) => m.role === "driver" && !m.invited).length,
    invitedPending: team.filter((m) => m.invited).length,
    jobsTotal: jobs.length,
    jobsThisWeek: jobs.filter((j) => j.createdAt >= weekAgo).length,
    needsAttention: jobs.filter(needsAttention).length,
    live: jobs.filter((j) => liveStage(j)).length,
    unpaidCents: jobs.reduce((sum, j) => sum + balanceCents(j), 0),
    messagesThisWeek: outbox.filter((m) => m.status === "sent" && (m.sentAt ?? "") >= weekAgo).length,
    lastActiveAt,
  };
}

export function findCompanyByToken(platform: PlatformState, match: (data: AppState) => boolean): CompanyAccount | undefined {
  return platform.companies.find((c) => match(c.data));
}
