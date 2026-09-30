// Device-local store for the pilot prototype (localStorage). Swap for Supabase + Dexie sync in later milestones.
// Every job mutation goes through `mutateJob`, which supplies the Actor so the audit row is always written.
import { useSyncExternalStore } from "react";

import { appBase, type AppBase } from "@/lib/app-base";
import type { Actor, Job, RateCard, RequestType, ScenarioId, TeamMember, Workflow } from "@/lib/domain";
import { createJob, GuardrailError, newToken } from "@/lib/jobs";
import { scenarioFor } from "@/lib/scenarios";
import { buildSeedState, type AppState, type Sessions } from "@/lib/seed";
import { currentConsentTemplate } from "@/lib/tow-rules";

const STORAGE_KEY = "towledger:v3";

let state: AppState | null = null;
const listeners = new Set<() => void>();

function load(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState & { currentUserId?: string };
      if (parsed.schemaVersion === 3) {
        const migrated = migrate(parsed);
        // Save upgrades right away so generated values (like link tokens) stay stable across reloads.
        if (migrated !== parsed) {
          try {
            persist(migrated);
          } catch {
            // Out of space: keep the upgraded copy in memory rather than falling back to demo data.
          }
        }
        return migrated;
      }
    }
  } catch {
    // Corrupt or unavailable storage: fall back to demo data below.
  }
  const seeded = buildSeedState();
  try {
    persist(seeded);
  } catch {
    // Private mode etc.: keep working in memory.
  }
  return seeded;
}

/** Upgrades data saved by earlier versions of the prototype. Returns the same object when nothing changed. */
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
  return next;
}

function persist(next: AppState) {
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
      state = load();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): AppState {
  if (!state) state = load();
  return state;
}

function getServerSnapshot(): AppState | null {
  return null;
}

/** Returns null during server render / hydration; pages show a loading shell until the client store is ready. */
export function useAppState(): AppState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setAppState(updater: (current: AppState) => AppState) {
  const next = updater(getSnapshot());
  persist(next);
  state = next;
  emit();
}

export function resetDemoData() {
  const seeded = buildSeedState();
  persist(seeded);
  state = seeded;
  emit();
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

/** Applies a job change (throws on guardrail violations) and returns the updated job. */
export function mutateJob(jobId: string, change: (job: Job, actor: Actor, app: AppState) => Job, actorOverride?: Partial<Actor>): Job {
  let updated: Job | undefined;
  setAppState((app) => {
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
