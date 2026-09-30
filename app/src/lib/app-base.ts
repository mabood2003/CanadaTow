// TowLedger ships as two installable apps from one codebase:
//   /driver — the operator app (phone)            /owner — the owner app (phone + web)
// Job screens are shared, so their links must stay inside whichever app is showing them.
// Each app's shell calls setAppBase() while rendering, before any of its pages render.

import type { ActorRole } from "@/lib/domain";

export type AppBase = "/driver" | "/owner";

let current: AppBase = "/driver";

export function setAppBase(base: AppBase) {
  current = base;
}

export function appBase(): AppBase {
  return current;
}

/** Which app a person belongs in (e.g. for links from the customer page back to a job). */
export function baseForRole(role: ActorRole | "owner" | "driver" | undefined): AppBase {
  return role === "owner" ? "/owner" : "/driver";
}
