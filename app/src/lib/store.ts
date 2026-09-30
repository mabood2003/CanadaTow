// Device-local store for the pilot prototype (localStorage). Swap for Supabase + Dexie sync in later milestones.
// Every job mutation goes through `mutateJob`, which supplies the Actor so the audit row is always written.
import { useEffect, useSyncExternalStore } from "react";

import { appBase, type AppBase } from "@/lib/app-base";
import type { Actor, Job, OutboundMessage, RateCard, RequestType, ScenarioId, TeamMember, TowEvent, Workflow } from "@/lib/domain";
import { audit, createJob, GuardrailError, newToken, recordTowEvent } from "@/lib/jobs";
import { scenarioFor } from "@/lib/scenarios";
import { cancelDelivered, deliveredMessages, describeRecipients, flushDue, pendingDelivered } from "@/lib/messages";
import type { CompanyAccount, PlatformState } from "@/lib/platform";
import { DEFAULT_NOTIFICATIONS, type AppState, type Sessions } from "@/lib/seed";
import { buildPlatformSeed } from "@/lib/seed-platform";
import { currentConsentTemplate } from "@/lib/tow-rules";

// The device holds the whole TowLedger platform: every company's data plus the admin console's.
// The driver and owner apps work on one company at a time (the "active" company).
const STORAGE_KEY = "towledger:platform:v1";
/** Before the admin console, the device held a single company under this key. */
const LEGACY_KEY = "towledger:v3";

let platform: PlatformState | null = null;
const listeners = new Set<() => void>();

function tryPersist(next: PlatformState) {
  try {
    persist(next);
  } catch {
    // Out of space / private mode: keep working in memory rather than falling back to demo data.
  }
}

function load(): PlatformState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PlatformState;
      if (parsed.schemaVersion === 1 && parsed.companies?.length) {
        const migrated = migratePlatform(parsed);
        // Save upgrades right away so generated values (like link tokens) stay stable across reloads.
        if (migrated !== parsed) tryPersist(migrated);
        return migrated;
      }
    }
    // A phone that used the single-company prototype: its data becomes Summit's, alongside the demo companies.
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as AppState & { currentUserId?: string };
      if (parsed.schemaVersion === 3) {
        const upgraded = buildPlatformSeed(Date.now(), migrate(parsed));
        tryPersist(upgraded);
        return upgraded;
      }
    }
  } catch {
    // Corrupt or unavailable storage: fall back to demo data below.
  }
  const seeded = buildPlatformSeed();
  tryPersist(seeded);
  return seeded;
}

function migratePlatform(saved: PlatformState): PlatformState {
  let changed = false;
  const companies = saved.companies.map((c) => {
    const data = migrate(c.data);
    if (data === c.data) return c;
    changed = true;
    return { ...c, data };
  });
  return changed ? { ...saved, companies } : saved;
}

/** Upgrades a company's data saved by earlier versions of the prototype. Returns the same object when nothing changed. */
function migrate(saved: AppState & { currentUserId?: string }): AppState {
  let next: AppState = saved;
  // Before the owner / driver apps split there was one shared "current user".
  if (!saved.sessions) {
    const { currentUserId, ...rest } = saved;
    const me = saved.team.find((m) => m.id === currentUserId);
    next = {
      ...rest,
      sessions: {
        driver: me?.role === "driver" ? me.id : (saved.team.find((m) => m.role === "driver" && !m.invited)?.id ?? null),
        owner: me?.role === "owner" ? me.id : (saved.team.find((m) => m.role === "owner")?.id ?? null),
      },
    };
  }
  // Jobs created before the customer status link existed.
  if (next.jobs.some((j) => !j.publicToken)) {
    next = { ...next, jobs: next.jobs.map((j) => (j.publicToken ? j : { ...j, publicToken: newToken() })) };
  }
  // Before customer messages were recorded.
  if (!next.outbox || !next.notifications) {
    next = { ...next, outbox: next.outbox ?? [], notifications: next.notifications ?? DEFAULT_NOTIFICATIONS };
  }
  return next;
}

function persist(next: PlatformState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    throw new StorageError(
      error instanceof DOMException && error.name === "QuotaExceededError"
        ? "This device is out of space for TowLedger records. Try a shorter audio clip, a smaller photo, or reset the demo jobs."
        : "Couldn't save on this device.",
    );
  }
}

export class StorageError extends Error {}

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab (e.g. the customer estimate page) wrote to storage: reload so the driver sees it live.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      platform = load();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getPlatformSnapshot(): PlatformState {
  if (!platform) platform = load();
  return platform;
}

export function activeAccount(p: PlatformState = getPlatformSnapshot()): CompanyAccount {
  return p.companies.find((c) => c.id === p.activeCompanyId) ?? p.companies[0];
}

/** The active company's data — what the driver and owner apps show. */
function getSnapshot(): AppState {
  return activeAccount().data;
}

function getServerSnapshot(): null {
  return null;
}

/** The current state outside React (event handlers that need the latest value). */
export function getAppState(): AppState {
  return getSnapshot();
}

/** Returns null during server render / hydration; pages show a loading shell until the client store is ready. */
export function useAppState(): AppState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Every company plus the admin console's state (admin screens, customer links, sign-in). */
export function usePlatform(): PlatformState | null {
  return useSyncExternalStore(subscribe, getPlatformSnapshot, getServerSnapshot);
}

export function getPlatform(): PlatformState {
  return getPlatformSnapshot();
}

export function setPlatform(updater: (current: PlatformState) => PlatformState) {
  const next = updater(getPlatformSnapshot());
  persist(next);
  platform = next;
  emit();
}

/** Updates one company's data. */
export function setCompanyData(companyId: string, updater: (current: AppState) => AppState) {
  setPlatform((p) => ({ ...p, companies: p.companies.map((c) => (c.id === companyId ? { ...c, data: updater(c.data) } : c)) }));
}

/** Updates the active company's data (driver and owner apps). */
export function setAppState(updater: (current: AppState) => AppState) {
  setCompanyData(activeAccount().id, updater);
}

/** Interview mode: restores every demo company and signs the admin console out. */
export function resetDemoData() {
  const seeded = buildPlatformSeed();
  persist(seeded);
  platform = seeded;
  emit();
}

/** Pilot sign-in: pick which company this device's driver and owner apps belong to. */
export function switchCompany(companyId: string) {
  setPlatform((p) => ({ ...p, activeCompanyId: companyId }));
}

function companyOfJob(p: PlatformState, jobId: string): CompanyAccount | undefined {
  return p.companies.find((c) => c.data.jobs.some((j) => j.id === jobId));
}

export function deviceLabel(): string {
  if (typeof navigator === "undefined") return "Unknown device";
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "Phone" : "Computer";
}

export type AppKind = keyof Sessions;

export function appKindFor(base: AppBase): AppKind {
  return base === "/owner" ? "owner" : "driver";
}

/** The person signed in to the app that's showing (owner app or driver app). */
export function currentUser(app: AppState, kind: AppKind = appKindFor(appBase())): TeamMember | undefined {
  const id = app.sessions[kind];
  const member = app.team.find((m) => m.id === id);
  // A session only counts for someone whose role matches the app.
  return member && member.role === kind ? member : undefined;
}

export function currentUserName(app: AppState): string {
  return currentUser(app)?.name ?? "Unknown user";
}

export function signIn(kind: AppKind, memberId: string) {
  setAppState((s) => ({ ...s, sessions: { ...s.sessions, [kind]: memberId } }));
}

export function signOut(kind: AppKind) {
  setAppState((s) => ({ ...s, sessions: { ...s.sessions, [kind]: null } }));
}

export function actorFor(app: AppState, overrides?: Partial<Actor>): Actor {
  const user = currentUser(app);
  return {
    by: user?.name ?? "Unknown user",
    role: user?.role === "owner" ? "owner" : "driver",
    device: deviceLabel(),
    now: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Company configuration lookups

export function requestTypeFor(app: AppState, job: Job): RequestType | undefined {
  return app.requestTypes.find((t) => t.id === job.requestTypeId);
}

export function workflowForType(app: AppState, type: RequestType | undefined): Workflow | undefined {
  return type ? app.workflows.find((w) => w.id === type.workflowId) : undefined;
}

export function rateCardFor(app: AppState, workflow: Pick<Workflow, "rateCardId"> | null | undefined): RateCard {
  return app.rateCards.find((r) => r.id === workflow?.rateCardId) ?? app.rateCards[0];
}

export function activeConsentTemplate(app: AppState) {
  return currentConsentTemplate(app.consentTemplates);
}

export function yardDestination(app: AppState): string {
  const yard = app.yards[0];
  return yard ? `${yard.name} — ${yard.address}` : "";
}

/** Creates a job (optionally from a demo scenario) and returns its id. */
export function startJob(scenarioId?: ScenarioId): string {
  if (activeAccount().status === "paused") {
    throw new GuardrailError("Your company's TowLedger account is paused, so new tows can't be started. Existing records are still available. Contact TowLedger.");
  }
  let id = "";
  setAppState((current) => {
    const scenario = scenarioFor(scenarioId);
    const prefill = scenario?.prefill;
    const type = current.requestTypes.find((t) => t.id === prefill?.requestTypeId);
    const job = createJob({
      number: String(current.counters.job),
      actor: actorFor(current),
      rateCard: rateCardFor(current, workflowForType(current, type)),
      defaultDestination: prefill?.destination ?? yardDestination(current),
      scenario: scenario?.id,
      prefill,
    });
    id = job.id;
    return { ...current, jobs: [job, ...current.jobs], counters: { ...current.counters, job: current.counters.job + 1 } };
  });
  return id;
}

/**
 * Applies a job change (throws on guardrail violations) and returns the updated job.
 * Writes to whichever company owns the job — a customer's link can belong to any company on this device.
 */
export function mutateJob(jobId: string, change: (job: Job, actor: Actor, app: AppState) => Job, actorOverride?: Partial<Actor>): Job {
  let updated: Job | undefined;
  const owner = companyOfJob(getPlatformSnapshot(), jobId);
  if (!owner) throw new GuardrailError("Job not found on this device.");
  setCompanyData(owner.id, (app) => {
    const actor = actorFor(app, actorOverride);
    return {
      ...app,
      jobs: app.jobs.map((job) => {
        if (job.id !== jobId) return job;
        updated = change(job, actor, app);
        return updated;
      }),
    };
  });
  if (!updated) throw new GuardrailError("Job not found on this device.");
  return updated;
}

// ---------------------------------------------------------------------------
// Customer messages (prototype: "sent" means recorded in the outbox)

function origin() {
  return typeof window === "undefined" ? "" : window.location.origin;
}

function replaceJob(jobs: Job[], jobId: string, change: (job: Job) => Job) {
  return jobs.map((j) => (j.id === jobId ? change(j) : j));
}

/**
 * Records a tow timestamp. On "Delivered", also schedules the company's automatic customer notice,
 * which waits out the undo window before it goes. One write, so the tow time and the notice can't disagree.
 */
export function recordTowEventAndNotify(jobId: string, event: TowEvent) {
  setAppState((s) => {
    const actor = actorFor(s);
    let jobs = replaceJob(s.jobs, jobId, (j) => recordTowEvent(j, actor, event));
    let outbox = s.outbox;
    if (event === "delivered" && s.notifications.deliveredAuto) {
      const job = jobs.find((j) => j.id === jobId)!;
      const scheduled = deliveredMessages({ job, company: s.company, yards: s.yards, origin: origin(), actor, delaySeconds: s.notifications.undoSeconds });
      if (scheduled.length) {
        outbox = [...scheduled, ...outbox];
        jobs = replaceJob(jobs, jobId, (j) => audit(j, actor, `Delivery notice to the customer scheduled — ${describeRecipients(scheduled)} in ${s.notifications.undoSeconds} seconds unless cancelled`));
      }
    }
    return { ...s, jobs, outbox };
  });
}

/** Sends the delivered notice right away (auto-send off, or re-sending after a cancel). */
export function sendDeliveredNow(jobId: string) {
  setAppState((s) => {
    const actor = actorFor(s);
    const job = s.jobs.find((j) => j.id === jobId);
    if (!job) throw new GuardrailError("Job not found on this device.");
    if (!job.tow.delivered) throw new GuardrailError("Record Delivered first.");
    const sent = deliveredMessages({ job, company: s.company, yards: s.yards, origin: origin(), actor, delaySeconds: 0 });
    if (sent.length === 0) throw new GuardrailError("There's no mobile number or email for this customer. Add one on the customer screen.");
    return {
      ...s,
      outbox: [...sent, ...s.outbox],
      jobs: replaceJob(s.jobs, jobId, (j) => audit(j, actor, `Customer notified that the vehicle was delivered — ${describeRecipients(sent)} (sent by ${actor.by})`)),
    };
  });
}

/** Skips the rest of the undo window. */
export function sendPendingNow(jobId: string) {
  setAppState((s) => {
    const now = new Date().toISOString();
    const ids = new Set(pendingDelivered(s.outbox, jobId).map((m) => m.id));
    const outbox = s.outbox.map((m) => (ids.has(m.id) ? { ...m, sendAt: now } : m));
    return { ...s, ...flushDue(outbox, s.jobs, now) };
  });
}

export function cancelDeliveredNotice(jobId: string) {
  setAppState((s) => {
    const job = s.jobs.find((j) => j.id === jobId);
    if (!job) return s;
    const result = cancelDelivered(s.outbox, job, actorFor(s));
    return { ...s, outbox: result.outbox, jobs: replaceJob(s.jobs, jobId, () => result.job) };
  });
}

/** Records messages the app has just sent (estimate / invoice links, move notices, invites). */
export function logMessages(messages: (OutboundMessage | null)[]) {
  const real = messages.filter((m): m is OutboundMessage => Boolean(m));
  if (real.length) setAppState((s) => ({ ...s, outbox: [...real, ...s.outbox] }));
}

/** Sends whatever is due, for every company on this device. Held while offline, so notices go out when the connection returns. */
export function flushOutbox() {
  if (getAppState().simulateOffline || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  const now = new Date().toISOString();
  const due = (data: AppState) => data.outbox.some((m) => m.status === "scheduled" && m.sendAt <= now);
  if (!getPlatformSnapshot().companies.some((c) => due(c.data))) return;
  setPlatform((p) => ({
    ...p,
    companies: p.companies.map((c) => (due(c.data) ? { ...c, data: { ...c.data, ...flushDue(c.data.outbox, c.data.jobs, now) } } : c)),
  }));
}

/** Runs in each app shell: sends due messages every second while any are scheduled. */
export function useOutboxFlusher() {
  const p = usePlatform();
  const hasScheduled = Boolean(p?.companies.some((c) => c.data.outbox.some((m) => m.status === "scheduled")));
  useEffect(() => {
    if (!hasScheduled) return;
    flushOutbox();
    const timer = setInterval(() => {
      try {
        flushOutbox();
      } catch {
        // Storage full: try again next tick.
      }
    }, 1000);
    window.addEventListener("online", flushOutbox);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", flushOutbox);
    };
  }, [hasScheduled]);
}

/** Runs an action and turns guardrail / storage failures into a message for the screen. */
export function attempt(action: () => void): string | null {
  try {
    action();
    return null;
  } catch (error) {
    if (error instanceof GuardrailError || error instanceof StorageError) return error.message;
    throw error;
  }
}

/** Finds the company and job behind a customer link (/c, /e or /i), across every company on this device. */
export function findCustomerLink(p: PlatformState, kind: "status" | "estimate" | "invoice", token: string) {
  for (const account of p.companies) {
    const app = account.data;
    if (kind === "estimate") {
      const found = findJobByEstimateToken(app, token);
      if (found) return { app, job: found.job, estimate: found.estimate, invoice: undefined };
    } else if (kind === "invoice") {
      const found = findJobByInvoiceToken(app, token);
      if (found) return { app, job: found.job, estimate: undefined, invoice: found.invoice };
    } else {
      const job = findJobByPublicToken(app, token);
      if (job) return { app, job, estimate: undefined, invoice: undefined };
    }
  }
  return null;
}

export function findJobByEstimateToken(app: AppState, token: string) {
  for (const job of app.jobs) {
    const estimate = job.estimates.find((e) => e.token === token);
    if (estimate) return { job, estimate };
  }
  return null;
}

export function findJobByPublicToken(app: AppState, token: string) {
  return app.jobs.find((j) => j.publicToken === token) ?? null;
}

export function findJobByInvoiceToken(app: AppState, token: string) {
  for (const job of app.jobs) {
    const invoice = job.invoices.find((i) => i.token === token);
    if (invoice) return { job, invoice };
  }
  return null;
}
