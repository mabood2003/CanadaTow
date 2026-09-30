import { describe, expect, it } from "vitest";

import { setAppBase } from "@/lib/app-base";
import { jobHref, nextHref } from "@/lib/job-steps";
import { balanceCents, companyActivity, dashboardCounts, driverSummaries, elapsed, liveStage } from "@/lib/owner-view";
import { buildSeedState } from "@/lib/seed";

const NOW = Date.parse("2026-09-30T18:00:00Z");
const app = buildSeedState(NOW);
const job = (n: string) => app.jobs.find((j) => j.number === n)!;

describe("owner view", () => {
  it("knows where each tow is right now", () => {
    expect(liveStage(job("1043"))?.stage).toBe("on_road");
    expect(liveStage(job("1042"))?.stage).toBe("at_pickup");
    expect(liveStage(job("1041"))).toBeNull(); // delivered
    expect(liveStage(job("1040"))).toBeNull();
  });

  it("counts what the owner needs to act on", () => {
    const counts = dashboardCounts(app.jobs, NOW);
    expect(counts.needsAttention).toBe(1); // #1041 delivered without an invoice
    expect(counts.live).toBe(2); // #1042 at pickup, #1043 on the road
    expect(counts.waitingOnCustomer).toBe(1); // #1042
    expect(counts.unpaidCents).toBe(0); // both issued invoices are paid
  });

  it("treats an issued, unpaid invoice as a balance owing", () => {
    const paid = job("1040");
    const unpaid = { ...paid, payments: [] };
    expect(balanceCents(paid)).toBe(0);
    expect(balanceCents(unpaid)).toBe(paid.invoices.at(-1)!.totalCents);
  });

  it("summarizes each driver for the Team screen", () => {
    const summaries = driverSummaries(app.team, app.jobs, NOW);
    const mike = summaries.find((s) => s.member.name === "Mike Chen")!;
    expect(mike.live?.job.number).toBe("1043");
    expect(mike.openJobs.map((j) => j.number).sort()).toEqual(["1041", "1043"]);
    const jules = summaries.find((s) => s.member.name === "Jules Martin")!;
    expect(jules.member.invited).toBe(true);
    expect(jules.openJobs).toHaveLength(0);
    expect(summaries.some((s) => s.member.role === "owner")).toBe(false);
  });

  it("lists company activity newest first", () => {
    const feed = companyActivity(app.jobs, 5);
    expect(feed).toHaveLength(5);
    for (let i = 1; i < feed.length; i++) expect(feed[i - 1].entry.at >= feed[i].entry.at).toBe(true);
  });

  it("formats elapsed time compactly", () => {
    expect(elapsed(new Date(NOW - 14 * 60_000).toISOString(), NOW)).toBe("14 min");
    expect(elapsed(new Date(NOW - 3 * 3600_000).toISOString(), NOW)).toBe("3 h");
    expect(elapsed(new Date(NOW - 3 * 24 * 3600_000).toISOString(), NOW)).toBe("3 d");
  });
});

describe("two apps, one set of job screens", () => {
  it("keeps job links inside the app that's showing them", () => {
    const j = job("1042");
    setAppBase("/owner");
    expect(jobHref(j, "tow")).toBe(`/owner/jobs/${j.id}/tow`);
    setAppBase("/driver");
    expect(jobHref(j)).toBe(`/driver/jobs/${j.id}`);
    expect(nextHref(j, "vehicle").startsWith("/driver/jobs/")).toBe(true);
    expect(jobHref(j, "audit", "/owner")).toBe(`/owner/jobs/${j.id}/audit`);
  });

  it("signs each app in separately", () => {
    expect(app.sessions).toEqual({ driver: "u-terry", owner: "u-owner" });
  });
});
