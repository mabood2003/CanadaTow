import { describe, expect, it } from "vitest";

import type { Actor } from "@/lib/domain";
import { recordTowEvent } from "@/lib/jobs";
import { cancelDelivered, deliveredMessages, flushDue, movedMessage, pendingDelivered } from "@/lib/messages";
import { buildSeedState, seedCompany, seedYards } from "@/lib/seed";

const NOW = Date.parse("2026-09-30T18:00:00Z");
const app = buildSeedState(NOW);
const job = (n: string) => app.jobs.find((j) => j.number === n)!;
const at = (secondsAfter: number, by = "Mike Chen"): Actor => ({ by, role: "driver", device: "Phone", now: new Date(NOW + secondsAfter * 1000).toISOString() });

// #1043 is on the road; give it a customer and deliver it.
const delivered = recordTowEvent(
  { ...job("1043"), customer: { name: "Sam Lee", mobile: "(403) 555-0111", email: "sam@example.com", relationship: "Owner", present: false } },
  at(0),
  "delivered",
);
const schedule = () => deliveredMessages({ job: delivered, company: seedCompany, yards: seedYards, origin: "https://app.example", actor: at(0), delaySeconds: 30 });

describe("delivered notification", () => {
  it("texts and emails whichever contacts are on file, with where the vehicle is and the tow link", () => {
    const msgs = schedule();
    expect(msgs.map((m) => m.channel)).toEqual(["text", "email"]);
    const text = msgs[0];
    expect(text).toMatchObject({ kind: "delivered", status: "scheduled", to: "(403) 555-0111", jobNumber: "1043" });
    expect(text.body).toContain("Summit Towing Ltd.: Your 2017 White Chevrolet Silverado (CRW 7742) was delivered to Summit yard");
    expect(text.body).toContain("Yard hours: Mon–Sat 8am–6pm");
    expect(text.body).not.toContain("..");
    expect(text.body).toContain(`https://app.example/c/${delivered.publicToken}`);
    expect(msgs[1].subject).toMatch(/delivered/);
  });

  it("sends nothing when there's no mobile or email", () => {
    const noContact = { ...delivered, customer: { ...delivered.customer, mobile: "", email: "" } };
    expect(deliveredMessages({ job: noContact, company: seedCompany, yards: seedYards, origin: "", actor: at(0), delaySeconds: 30 })).toEqual([]);
  });

  it("waits out the undo window, then sends and records it on the job", () => {
    const outbox = schedule();
    const early = flushDue(outbox, [delivered], at(29).now);
    expect(early.outbox).toBe(outbox); // nothing due yet
    const due = flushDue(outbox, [delivered], at(30).now);
    expect(due.outbox.every((m) => m.status === "sent")).toBe(true);
    expect(due.jobs[0].audit.at(-1)).toMatchObject({ role: "system", action: expect.stringContaining("Customer notified that the vehicle was delivered — text to (403) 555-0111 and email to sam@example.com") });
  });

  it("lets the driver cancel inside the window, and records who cancelled", () => {
    const outbox = schedule();
    const { outbox: after, job: j } = cancelDelivered(outbox, delivered, at(10));
    expect(pendingDelivered(after, delivered.id)).toHaveLength(0);
    expect(after.every((m) => m.status === "cancelled" && m.cancelledBy === "Mike Chen")).toBe(true);
    expect(j.audit.at(-1)?.action).toMatch(/cancelled before sending/);
    // A cancelled notice never goes out later.
    expect(flushDue(after, [j], at(60).now).outbox).toBe(after);
  });

  it("writes the owner a move notice by text", () => {
    const moved = movedMessage({ job: delivered, to: "Kensington Auto", company: seedCompany, origin: "", actor: at(0) });
    expect(moved?.body).toContain("is being taken to Kensington Auto instead of Summit yard");
  });

  it("seeds the outbox with what the sample jobs sent", () => {
    expect(app.notifications).toEqual({ deliveredAuto: true, undoSeconds: 30 });
    expect(app.outbox.filter((m) => m.jobNumber === "1040").map((m) => `${m.kind}:${m.channel}`).sort()).toEqual(["delivered:email", "delivered:text", "estimate:text", "invoice:email"]);
    expect(job("1041").audit.some((a) => a.action.startsWith("Customer notified that the vehicle was delivered"))).toBe(true);
  });
});
