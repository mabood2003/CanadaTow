"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { BrandMark, CompanyMark, ErrorText, Loading, OfflineBanner } from "@/components/ui";
import { setAppBase, type AppBase } from "@/lib/app-base";
import { initials } from "@/lib/describe";
import { jobHref } from "@/lib/job-steps";
import type { AppState } from "@/lib/seed";
import { attempt, currentUser, setAppState, signIn, signOut, startJob, useAppState, type AppKind } from "@/lib/store";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  match: (path: string) => boolean;
}

const DRIVER_TABS: NavItem[] = [
  { href: "/driver", label: "Home", icon: "home", match: (p) => p === "/driver" },
  { href: "/driver/jobs", label: "My jobs", icon: "list", match: (p) => p.startsWith("/driver/jobs") },
  { href: "/driver/account", label: "Account", icon: "user", match: (p) => p.startsWith("/driver/account") },
];

const OWNER_NAV: NavItem[] = [
  { href: "/owner", label: "Dashboard", icon: "dashboard", match: (p) => p === "/owner" },
  { href: "/owner/jobs", label: "Jobs", icon: "fileCheck", match: (p) => p.startsWith("/owner/jobs") },
  { href: "/owner/team", label: "Team", icon: "users", match: (p) => p.startsWith("/owner/team") },
  { href: "/owner/settings", label: "Company setup", icon: "sliders", match: (p) => p.startsWith("/owner/settings") },
];

/** Bottom tabs only on top-level screens; inside a job the screen's own back link and buttons lead. */
function showTabs(path: string, items: NavItem[]) {
  return items.some((i) => i.href === path) || path === "/owner/settings" || path.startsWith("/owner/settings/");
}

// ---------------------------------------------------------------------------
// Driver (operator) app — phone

export function DriverShell({ children }: { children: ReactNode }) {
  setAppBase("/driver");
  const app = useAppState();
  const path = usePathname();
  if (!app) return <Loading />;
  const user = currentUser(app, "driver");
  if (!user) return <SignIn app={app} kind="driver" />;
  const tabs = showTabs(path, DRIVER_TABS);

  return (
    <div className={tabs ? "pb-[calc(72px+env(safe-area-inset-bottom))]" : ""}>
      <OfflineBanner />
      <header className="no-print sticky top-0 z-40 border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-md items-center gap-2.5 px-4">
          <BrandMark small />
          <span className="text-[15px] font-extrabold tracking-[-0.03em]">TowLedger</span>
          <span className="rounded bg-forest px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-signal">Driver</span>
          <Link href="/driver/account" className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-mint font-mono text-[11px] font-bold text-forest" aria-label={`Account: ${user.name}`}>
            {initials(user.name)}
          </Link>
        </div>
      </header>
      {children}
      {tabs ? <BottomTabs items={DRIVER_TABS} path={path} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Owner app — phone and laptop

export function OwnerShell({ children }: { children: ReactNode }) {
  setAppBase("/owner");
  const app = useAppState();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  if (!app) return <Loading />;
  const user = currentUser(app, "owner");
  if (!user) return <SignIn app={app} kind="owner" />;
  const tabs = showTabs(path, OWNER_NAV);

  return (
    <div className={tabs ? "pb-[calc(72px+env(safe-area-inset-bottom))] lg:pb-0" : ""}>
      <OfflineBanner />
      <header className="no-print sticky top-0 z-40 border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:h-16 sm:px-6">
          <Link href="/owner" className="flex min-w-0 items-center gap-2.5">
            <CompanyMark company={app.company} size="sm" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[15px] font-extrabold tracking-[-0.03em]">{app.company.name}</span>
              <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-pine">TowLedger Owner</span>
            </span>
          </Link>

          <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Owner">
            {OWNER_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${item.match(path) ? "bg-mint text-forest" : "text-muted hover:text-ink"}`}
              >
                <Icon name={item.icon} className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
            <NewTowButton className="ml-2" />
          </nav>

          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-expanded={menu}
            aria-label="Account menu"
            className="ml-auto flex min-h-10 items-center gap-2 rounded-md px-1.5 text-sm font-semibold hover:bg-sand lg:ml-2"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-forest font-mono text-[11px] font-bold text-signal">{initials(user.name)}</span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block">{user.name}</span>
              <span className="block text-xs font-normal text-muted">Owner</span>
            </span>
          </button>
        </div>
        {menu ? (
          <div className="border-t border-ink/10 bg-paper">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
              <Link href="/driver" className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold hover:bg-sand" onClick={() => setMenu(false)}>
                <Icon name="truck" className="h-4 w-4" /> Open the driver app
              </Link>
              <button type="button" onClick={() => signOut("owner")} className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-danger hover:bg-sand">
                <Icon name="logOut" className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>
        ) : null}
      </header>
      {children}
      {tabs ? <OwnerTabs path={path} /> : null}
    </div>
  );
}

/** Creates a job as the signed-in person and opens its first step in the current app. */
export function useNewTow() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const start = () => {
    let id = "";
    const failure = attempt(() => {
      id = startJob();
    });
    setError(failure);
    if (!failure) router.push(jobHref({ id }, "request"));
  };
  return { start, error };
}

/** Starts a tow from wherever the owner is — owners on small crews run tows themselves. */
export function NewTowButton({ className = "", size = "md" }: { className?: string; size?: "md" | "lg" }) {
  const { start, error } = useNewTow();
  return (
    <>
      <button
        type="button"
        onClick={start}
        className={`inline-flex items-center justify-center gap-2 rounded-md bg-forest font-semibold text-white shadow-[0_3px_0_#0e291c] transition hover:bg-forest-hover active:translate-y-0.5 active:shadow-none ${
          size === "lg" ? "min-h-14 px-5 text-lg" : "min-h-10 px-4 text-sm"
        } ${className}`}
      >
        <Icon name="plus" className="h-4 w-4 text-signal" strokeWidth={2.5} /> New tow
      </button>
      {error ? <ErrorText message={error} /> : null}
    </>
  );
}

function BottomTabs({ items, path }: { items: NavItem[]; path: string }) {
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Main">
      <div className="mx-auto flex max-w-md">
        {items.map((item) => {
          const active = item.match(path);
          return (
            <Link key={item.href} href={item.href} className={`flex min-h-[64px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${active ? "text-forest" : "text-muted"}`}>
              <span className={`grid h-8 w-12 place-items-center rounded-full ${active ? "bg-mint" : ""}`}>
                <Icon name={item.icon} className="h-5 w-5" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function OwnerTabs({ path }: { path: string }) {
  const { start: newTow, error } = useNewTow();
  const [home, jobs, team, settings] = OWNER_NAV;
  const tab = (item: NavItem, label = item.label) => {
    const active = item.match(path);
    return (
      <Link key={item.href} href={item.href} className={`flex min-h-[64px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${active ? "text-forest" : "text-muted"}`}>
        <span className={`grid h-8 w-12 place-items-center rounded-full ${active ? "bg-mint" : ""}`}>
          <Icon name={item.icon} className="h-5 w-5" />
        </span>
        {label}
      </Link>
    );
  };
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Owner">
      {error ? <p className="px-4 pt-2 text-center text-xs font-semibold text-danger">{error}</p> : null}
      <div className="mx-auto flex max-w-md items-center">
        {tab(home, "Home")}
        {tab(jobs)}
        <div className="flex flex-1 justify-center">
          <button type="button" onClick={newTow} aria-label="New tow" className="-mt-5 grid h-14 w-14 place-items-center rounded-full bg-forest text-signal shadow-[0_4px_0_#0e291c]">
            <Icon name="plus" className="h-7 w-7" strokeWidth={2.5} />
          </button>
        </div>
        {tab(team)}
        {tab(settings, "Setup")}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Sign-in (pilot: pick your name; email sign-in links come with the backend)

function SignIn({ app, kind }: { app: AppState; kind: AppKind }) {
  const people = app.team.filter((m) => m.role === kind);
  const other: { href: AppBase; label: string } = kind === "driver" ? { href: "/owner", label: "Owner? Open TowLedger Owner" } : { href: "/driver", label: "Driver? Open TowLedger Driver" };

  const choose = (id: string) => {
    // Signing in for the first time accepts the owner's invite.
    setAppState((s) => ({ ...s, team: s.team.map((m) => (m.id === id ? { ...m, invited: false } : m)) }));
    signIn(kind, id);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-10">
      <div className="flex items-center gap-3">
        <CompanyMark company={app.company} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-lg font-extrabold tracking-tight">{app.company.name}</p>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-pine">{kind === "driver" ? "TowLedger Driver" : "TowLedger Owner"}</p>
        </div>
      </div>
      <h1 className="mt-10 text-[32px] font-extrabold leading-none tracking-[-0.05em]">{kind === "driver" ? "Who's driving?" : "Sign in"}</h1>
      <p className="mt-2 text-sm text-muted">
        {kind === "driver" ? "Choose your name to see your jobs and start a tow." : "The owner app is for running the company: every job, the team and company setup."}
      </p>

      <ul className="mt-6 space-y-2">
        {people.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => choose(m.id)} className="flex min-h-16 w-full items-center gap-3 rounded-lg border border-line bg-paper px-4 text-left hover:border-pine/50">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-mint font-mono text-xs font-bold text-forest">{initials(m.name)}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{m.name}</span>
                <span className="block text-xs text-muted">{m.invited ? "Invited — tap to accept and sign in" : m.email}</span>
              </span>
              <Icon name="arrowRight" className="h-5 w-5 text-pine" />
            </button>
          </li>
        ))}
        {people.length === 0 ? <li className="text-sm text-muted">No {kind === "driver" ? "drivers" : "owners"} yet. The owner invites drivers from the Team screen.</li> : null}
      </ul>

      <p className="mt-6 text-xs text-muted">Pilot sign-in: choose your name. Email sign-in links arrive with the shared backend.</p>
      <div className="mt-auto flex flex-wrap gap-x-5 gap-y-2 pt-10 text-sm font-semibold text-pine">
        <Link href={other.href}>{other.label}</Link>
        <Link href="/demo">Interview mode</Link>
      </div>
    </main>
  );
}
