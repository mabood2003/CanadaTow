import { describe, expect, it } from "vitest";

import type { Actor } from "@/lib/domain";
import { adminAudit, companyFromTemplate, companyMetrics, validateOnboarding, type OnboardingInput } from "@/lib/platform";
import { buildPlatformSeed, DEMO_COMPANY_ID } from "@/lib/seed-platform";

const NOW = Date.parse("2026-09-30T18:00:00Z");
const platform = buildPlatformSeed(NOW);
const byId = (id: string) => platform.companies.find((c) => c.id === id)!;
const admin: Actor = { by: "Bilal Saad", role: "system", device: "TowLedger admin", now: new Date(NOW).toISOString() };

const input: OnboardingInput = {
  name: "Foothills Recovery Ltd.",
  address: "1 Main St, Okotoks, AB",
  phone: "(403) 555-0199",
  email: "",
  gstNumber: "",
  ownerName: "Alex Kim",
  ownerEmail: "alex@foothills.example",
  yardName: "Okotoks yard",
  yardAddress: "5 Industrial Rd, Okotoks",
  yardHours: "Mon–Fri 9–5",
};

describe("platform seed", () => {
  it("has the demo company plus a pilot with jobs and a company still onboarding", () => {
    expect(platform.companies.map((c) => [c.data.company.name, c.status])).toEqual([
      ["Summit Towing Ltd.", "pilot"],
      ["Prairie Roadside Recovery Inc.", "pilot"],
      ["Northgate Towing", "onboarding"],
    ]);
    expect(platform.activeCompanyId).toBe(DEMO_COMPANY_ID);
    expect(platform.adminSession).toBeNull();
  });

  it("keeps job ids and customer links unique across companies", () => {
    const jobs = platform.companies.flatMap((c) => c.data.jobs);
    expect(new Set(jobs.map((j) => j.id)).size).toBe(jobs.length);
    expect(new Set(jobs.map((j) => j.publicToken)).size).toBe(jobs.length);
  });

  it("measures each company's health for the admin overview", () => {
    const prairie = companyMetrics(byId("co-prairie"), NOW);
    expect(prairie).toMatchObject({ drivers: 2, jobsTotal: 3, needsAttention: 1, live: 1 });
    const northgate = companyMetrics(byId("co-northgate"), NOW);
    expect(northgate).toMatchObject({ drivers: 0, invitedPending: 1, jobsTotal: 0, lastActiveAt: undefined });
  });
});

describe("onboarding a company", () => {
  const data = companyFromTemplate(input, admin, "https://app.example");

  it("starts from the template, owned by the new company", () => {
    expect(data.company.name).toBe("Foothills Recovery Ltd.");
    expect(data.workflows.map((w) => w.letter)).toEqual(["A", "B", "C", "D"]);
    expect(JSON.stringify(data.workflows)).not.toContain("Summit");
    expect(data.workflows[0].description).toContain("Foothills Recovery's estimate");
    expect(data.consentTemplates).toHaveLength(1);
    expect(data.consentTemplates[0]).toMatchObject({ version: 1, updatedBy: "Bilal Saad (TowLedger onboarding)" });
    expect(data.jobs).toEqual([]);
    expect(data.notifications.deliveredAuto).toBe(true);
  });

  it("invites the owner, who signs in to accept", () => {
    expect(data.team).toEqual([expect.objectContaining({ name: "Alex Kim", role: "owner", invited: true })]);
    expect(data.sessions).toEqual({ driver: null, owner: null });
    expect(data.outbox[0]).toMatchObject({ kind: "invite", channel: "email", to: "alex@foothills.example" });
    expect(data.outbox[0].body).toContain("https://app.example/owner");
  });

  it("checks the required details and duplicate names", () => {
    expect(validateOnboarding(input, platform.companies)).toBeNull();
    expect(validateOnboarding({ ...input, ownerEmail: "nope" }, platform.companies)).toMatch(/email/);
    expect(validateOnboarding({ ...input, yardAddress: " " }, platform.companies)).toBe("Enter the yard address.");
    expect(validateOnboarding({ ...input, name: "summit towing ltd." }, platform.companies)).toMatch(/already on TowLedger/);
  });

  it("records who did what in the admin audit log", () => {
    const next = adminAudit(platform, "Bilal Saad", admin.now, "Viewed Summit Towing Ltd. — jobs", DEMO_COMPANY_ID);
    expect(next.adminAudit.slice(0, platform.adminAudit.length)).toEqual(platform.adminAudit);
    expect(next.adminAudit.at(-1)).toMatchObject({ by: "Bilal Saad", companyId: DEMO_COMPANY_ID });
  });
});
