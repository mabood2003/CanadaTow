// What the owner needs at a glance: who's on the road, what needs attention, what's unpaid.
// Pure functions over jobs so they're unit-tested alongside the guardrails.
import type { AuditEntry, Job, TeamMember } from "@/lib/domain";
import { currentInvoice, jobRecord, jobStatus } from "@/lib/tow-rules";

export type LiveStage = "at_pickup" | "secured" | "on_road";

export const LIVE_STAGE_LABELS: Record<LiveStage, string> = {
  at_pickup: "At pickup",
  secured: "Vehicle secured",
  on_road: "On the road",
};

/** Where a tow is right now, from its recorded timestamps. Null when it hasn't started or is delivered. */
export function liveStage(job: Job): { stage: LiveStage; since: string } | null {
  const t = job.tow;
  if (!t.arrived || t.delivered) return null;
  if (t.departed) return { stage: "on_road", since: t.departed };
  if (t.secured) return { stage: "secured", since: t.secured };
  return { stage: "at_pickup", since: t.arrived };
}

export function balanceCents(job: Job): number {
  const invoice = currentInvoice(job);
  if (!invoice) return 0;
  const paid = job.payments.filter((p) => p.invoiceNumber === invoice.number).reduce((sum, p) => sum + p.amountCents, 0);
  return Math.max(invoice.totalCents - paid, 0);
}

export function needsAttention(job: Job): boolean {
  return jobStatus(job).tone === "bad";
}

export interface DashboardCounts {
  needsAttention: number;
  live: number;
  waitingOnCustomer: number;
  completedThisWeek: number;
  unpaidCents: number;
  unpaidInvoices: number;
}

export function dashboardCounts(jobs: Job[], nowMs: number): DashboardCounts {
  const weekAgo = nowMs - 7 * 24 * 3600_000;
  let unpaidCents = 0;
  let unpaidInvoices = 0;
  for (const job of jobs) {
    const balance = balanceCents(job);
    if (balance > 0) {
      unpaidCents += balance;
      unpaidInvoices += 1;
    }
  }
  return {
    needsAttention: jobs.filter(needsAttention).length,
    live: jobs.filter((j) => liveStage(j)).length,
    waitingOnCustomer: jobs.filter((j) => jobStatus(j).label === "Waiting for customer").length,
    completedThisWeek: jobs.filter((j) => {
      const done = j.tow.delivered ?? j.createdAt;
      return jobRecord(j).complete && Date.parse(done) >= weekAgo;
    }).length,
    unpaidCents,
    unpaidInvoices,
  };
}

export interface ActivityItem {
  entry: AuditEntry;
  job: Job;
}

/** Latest audit rows across every job — the owner's "what just happened" feed. */
export function companyActivity(jobs: Job[], limit = 8): ActivityItem[] {
  return jobs
    .flatMap((job) => job.audit.map((entry) => ({ entry, job })))
    .sort((a, b) => b.entry.at.localeCompare(a.entry.at))
    .slice(0, limit);
}

export interface DriverSummary {
  member: TeamMember;
  openJobs: Job[];
  live: { job: Job; stage: LiveStage; since: string } | null;
  jobsThisWeek: number;
  lastActiveAt?: string;
}

/** Per-driver view for the owner's Team screen. Jobs belong to the person who started them. */
export function driverSummaries(team: TeamMember[], jobs: Job[], nowMs: number): DriverSummary[] {
  const weekAgo = nowMs - 7 * 24 * 3600_000;
  return team
    .filter((m) => m.role === "driver")
    .map((member) => {
      const mine = jobs.filter((j) => j.driverName === member.name);
      const liveJob = mine.map((job) => ({ job, live: liveStage(job) })).find((x) => x.live);
      const lastActiveAt = mine
        .flatMap((j) => j.audit.filter((a) => a.by === member.name).map((a) => a.at))
        .sort()
        .at(-1);
      return {
        member,
        openJobs: mine.filter((j) => !jobRecord(j).complete),
        live: liveJob ? { job: liveJob.job, ...liveJob.live! } : null,
        jobsThisWeek: mine.filter((j) => Date.parse(j.createdAt) >= weekAgo).length,
        lastActiveAt,
      };
    });
}

/** "14 min", "3 h", "2 d" — compact elapsed time for live tiles. */
export function elapsed(sinceIso: string, nowMs: number): string {
  const minutes = Math.max(0, Math.round((nowMs - Date.parse(sinceIso)) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} d`;
}
