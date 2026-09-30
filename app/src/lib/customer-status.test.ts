import { describe, expect, it } from "vitest";

import { customerStatus, placeName } from "@/lib/customer-status";
import { recordDestinationChange, recordTowEvent } from "@/lib/jobs";
import { buildSeedState } from "@/lib/seed";

const NOW = Date.parse("2026-09-30T18:00:00Z");
const app = buildSeedState(NOW);
const job = (n: string) => app.jobs.find((j) => j.number === n)!;
const actor = (minutesAfter: number) => ({ by: "Mike Chen", role: "driver" as const, device: "Phone", now: new Date(NOW + minutesAfter * 60_000).toISOString() });

describe("customer status page", () => {
  it("gives every job its own customer link token", () => {
    const tokens = app.jobs.map((j) => j.publicToken);
    expect(tokens.every(Boolean)).toBe(true);
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it("asks the customer to review the estimate while approval is pending", () => {
    const status = customerStatus(job("1042"));
    expect(status.awaitingApproval).toBe(true);
    expect(status.headline).toBe("Your estimate is ready to review");
    const current = status.steps.find((s) => s.state === "current")!;
    expect(current.key).toBe("approved");
    expect(status.steps.find((s) => s.key === "estimate")).toMatchObject({ state: "done", document: "estimate" });
  });

  it("shows the vehicle on the way, then delivered, with the invoice once issued", () => {
    const onRoad = customerStatus(job("1043"));
    expect(onRoad.headline).toBe("Your vehicle is on the way");
    expect(onRoad.vehicleAt).toBe("On the way to Summit yard");
    // Private-property workflow: no estimate or approval steps for the customer.
    expect(onRoad.steps.some((s) => s.key === "estimate" || s.key === "approved")).toBe(false);

    const done = customerStatus(job("1040"));
    expect(done.headline).toMatch(/^Your vehicle was delivered to Ridgeline Auto Repair/);
    expect(done.steps.find((s) => s.key === "invoice")).toMatchObject({ state: "done", document: "invoice" });
    expect(done.steps.at(-1)?.key).toBe("paid");
    expect(done.steps.every((s) => s.state === "done")).toBe(true);
  });

  it("shows a move to a new destination as its own step", () => {
    let moved = recordDestinationChange(job("1043"), actor(1), { to: "Kensington Auto — 300 10 St NW", requestedBy: "Vehicle owner", note: "", ownerNotifiedVia: "Phone call" });
    moved = recordTowEvent(moved, actor(2), "delivered");
    const status = customerStatus(moved);
    expect(status.steps.map((s) => s.title)).toContain("Destination changed to Kensington Auto");
    expect(status.steps.find((s) => s.key === "departed")?.title).toBe("On the way to Summit yard");
    expect(status.vehicleAt).toBe("Kensington Auto — 300 10 St NW");
  });

  it("shortens place names for headlines", () => {
    expect(placeName("Summit yard — Bay 4, Calgary")).toBe("Summit yard");
    expect(placeName("123 Main St")).toBe("123 Main St");
  });
});
