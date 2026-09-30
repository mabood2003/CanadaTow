// Customer messages: what gets written, when it goes out, and cancelling inside the undo window.
// Pure functions over the outbox so they're unit-tested. The prototype "sends" by marking a message sent;
// Twilio (texts) and Resend (email) plug in where flushDue marks messages sent.
import type { Actor, Company, Job, MessageChannel, MessageKind, OutboundMessage, Yard } from "@/lib/domain";
import { endSentence, vehicleName } from "@/lib/describe";
import { audit, newId } from "@/lib/jobs";
import { formatTime } from "@/lib/time";

export const UNDO_CHOICES = [15, 30, 60] as const;

export function message(input: {
  kind: MessageKind;
  channel: MessageChannel;
  to: string;
  body: string;
  subject?: string;
  job?: Pick<Job, "id" | "number">;
  actor: Actor;
  delaySeconds?: number;
}): OutboundMessage {
  const sendAt = new Date(Date.parse(input.actor.now) + (input.delaySeconds ?? 0) * 1000).toISOString();
  const scheduled = (input.delaySeconds ?? 0) > 0;
  return {
    id: newId("m-"),
    kind: input.kind,
    channel: input.channel,
    to: input.to,
    subject: input.subject,
    body: input.body,
    jobId: input.job?.id,
    jobNumber: input.job?.number,
    createdAt: input.actor.now,
    createdBy: input.actor.by,
    sendAt,
    status: scheduled ? "scheduled" : "sent",
    sentAt: scheduled ? undefined : input.actor.now,
  };
}

/** Text and email (whichever the customer gave us) telling them where their vehicle was delivered. */
export function deliveredMessages(input: {
  job: Job;
  company: Company;
  yards: Yard[];
  origin: string;
  actor: Actor;
  delaySeconds: number;
}): OutboundMessage[] {
  const { job, company, actor } = input;
  const deliveredAt = job.tow.delivered ?? actor.now;
  const yard = input.yards.find((y) => job.destination.startsWith(y.name));
  const plate = job.vehicle.plate ? ` (${job.vehicle.plate})` : "";
  const vehicle = `${job.vehicle.make ? vehicleName(job.vehicle) : "vehicle"}${plate}`;
  const link = `${input.origin}/c/${job.publicToken}`;
  const lines = [
    endSentence(`${company.name}: Your ${vehicle} was delivered to ${job.destination} at ${formatTime(deliveredAt)}`),
    yard ? endSentence(`Yard hours: ${yard.hours}`) : "",
    `Tow status, estimate and invoice: ${link}`,
    `Questions? Call ${company.phone}.`,
  ].filter(Boolean);
  const body = lines.join("\n");
  const out: OutboundMessage[] = [];
  if (job.customer.mobile.trim()) {
    out.push(message({ kind: "delivered", channel: "text", to: job.customer.mobile.trim(), body, job, actor, delaySeconds: input.delaySeconds }));
  }
  if (job.customer.email.trim()) {
    out.push(
      message({
        kind: "delivered",
        channel: "email",
        to: job.customer.email.trim(),
        subject: `Your vehicle was delivered — ${company.name}`,
        body,
        job,
        actor,
        delaySeconds: input.delaySeconds,
      }),
    );
  }
  return out;
}

/** Estimate or invoice link, sent when the driver or office taps Text / Email. */
export function documentMessage(input: {
  kind: "estimate" | "invoice";
  channel: MessageChannel;
  to: string;
  job: Job;
  company: Company;
  path: string;
  origin: string;
  actor: Actor;
}): OutboundMessage {
  const { company, job } = input;
  const what = input.kind === "estimate" ? "tow estimate is ready to review" : "invoice is ready";
  const body = [`${company.name}: Your ${what}: ${input.origin}${input.path}`, `Questions? Call ${company.phone}.`].join("\n");
  const subject = input.kind === "estimate" ? `Your tow estimate — ${company.name}` : `Your invoice — ${company.name}`;
  return message({ kind: input.kind, channel: input.channel, to: input.to, body, subject: input.channel === "email" ? subject : undefined, job, actor: input.actor });
}

/** The owner notice when a vehicle is taken somewhere other than the agreed destination. */
export function movedMessage(input: { job: Job; to: string; company: Company; origin: string; actor: Actor }): OutboundMessage | null {
  const { job, company } = input;
  if (!job.customer.mobile.trim()) return null;
  const body = [
    `${company.name}: Your vehicle${job.vehicle.plate ? ` (${job.vehicle.plate})` : ""} is being taken to ${input.to} instead of ${job.destination}.`,
    `Tow status: ${input.origin}/c/${job.publicToken}`,
    `Questions? Call ${company.phone}.`,
  ].join("\n");
  return message({ kind: "moved", channel: "text", to: job.customer.mobile.trim(), body, job, actor: input.actor });
}

export function inviteMessage(input: { name: string; email: string; company: Company; origin: string; actor: Actor }): OutboundMessage {
  const body = `${input.actor.by} invited ${input.name} to drive with ${input.company.name} on TowLedger. Open ${input.origin}/driver on your phone and choose your name to accept.`;
  return message({ kind: "invite", channel: "email", to: input.email, subject: `Join ${input.company.name} on TowLedger`, body, actor: input.actor });
}

export function describeRecipients(messages: OutboundMessage[]): string {
  return messages.map((m) => `${m.channel === "text" ? "text" : "email"} to ${m.to}`).join(" and ");
}

export function jobMessages(outbox: OutboundMessage[], jobId: string): OutboundMessage[] {
  return outbox.filter((m) => m.jobId === jobId);
}

/** Scheduled delivered-notice messages for a job still inside the undo window. */
export function pendingDelivered(outbox: OutboundMessage[], jobId: string): OutboundMessage[] {
  return outbox.filter((m) => m.jobId === jobId && m.kind === "delivered" && m.status === "scheduled");
}

/**
 * Marks every scheduled message whose time has come as sent, and writes one audit row per job.
 * Returns the same arrays when nothing was due.
 */
export function flushDue(outbox: OutboundMessage[], jobs: Job[], nowIso: string): { outbox: OutboundMessage[]; jobs: Job[] } {
  const due = outbox.filter((m) => m.status === "scheduled" && m.sendAt <= nowIso);
  if (due.length === 0) return { outbox, jobs };
  const dueIds = new Set(due.map((m) => m.id));
  const nextOutbox = outbox.map((m) => (dueIds.has(m.id) ? { ...m, status: "sent" as const, sentAt: m.sendAt } : m));
  const nextJobs = jobs.map((job) => {
    const mine = due.filter((m) => m.jobId === job.id);
    if (mine.length === 0) return job;
    const system: Actor = { by: "TowLedger", role: "system", device: "Server", now: mine[0].sendAt };
    return audit(job, system, `Customer notified that the vehicle was delivered — ${describeRecipients(mine)}`);
  });
  return { outbox: nextOutbox, jobs: nextJobs };
}

/** Driver's undo: cancels the job's scheduled delivered notice and records who cancelled it. */
export function cancelDelivered(outbox: OutboundMessage[], job: Job, actor: Actor): { outbox: OutboundMessage[]; job: Job } {
  const pending = pendingDelivered(outbox, job.id);
  if (pending.length === 0) return { outbox, job };
  const ids = new Set(pending.map((m) => m.id));
  return {
    outbox: outbox.map((m) => (ids.has(m.id) ? { ...m, status: "cancelled" as const, cancelledAt: actor.now, cancelledBy: actor.by } : m)),
    job: audit(job, actor, `Delivery notice to the customer cancelled before sending (${describeRecipients(pending)})`),
  };
}
