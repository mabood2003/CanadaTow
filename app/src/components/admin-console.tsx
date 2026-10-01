"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { BrandMark, Chip, Loading } from "@/components/ui";
import { adminSignIn, adminSignOut, currentAdmin } from "@/lib/admin-store";
import { initials } from "@/lib/describe";
import { COMPANY_STATUS_LABELS, type AdminAuditEntry, type CompanyStatus } from "@/lib/platform";
import { usePlatform } from "@/lib/store";
import { formatWhen } from "@/lib/time";
import type { Tone } from "@/lib/tow-rules";

const NAV: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: "/admin", label: "Companies", icon: "building", match: (p) => p === "/admin" || p.startsWith("/admin/companies") },
  { href: "/admin/messages", label: "Message log", icon: "message", match: (p) => p.startsWith("/admin/messages") },
  { href: "/admin/activity", label: "Admin activity", icon: "history", match: (p) => p.startsWith("/admin/activity") },
];

const STATUS_TONE: Record<CompanyStatus, Tone> = { onboarding: "warn", pilot: "info", active: "good", paused: "bad" };

export function CompanyStatusChip({ status }: { status: CompanyStatus }) {
  return <Chip tone={STATUS_TONE[status]}>{COMPANY_STATUS_LABELS[status]}</Chip>;
}

/** Admin audit rows, newest first. */
export function AdminLog({ entries, companyName }: { entries: AdminAuditEntry[]; companyName?: (id: string) => string | undefined }) {
  if (entries.length === 0) return <p className="text-sm text-muted">Nothing yet.</p>;
  return (
    <ol className="space-y-3">
      {[...entries].reverse().map((e) => (
        <li key={e.id} className="text-sm">
          <p className="font-medium">{e.action}</p>
          <p className="text-xs text-muted">
            {formatWhen(e.at)} · {e.by}
            {companyName && e.companyId ? ` · ${companyName(e.companyId) ?? ""}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** TowLedger's own console (web): every company on TowLedger, onboarding, support views and the message log. */
export function AdminConsoleShell({ children }: { children: ReactNode }) {
  const platform = usePlatform();
  const path = usePathname();
  if (!platform) return <Loading />;
  const admin = currentAdmin(platform);

  if (!admin) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-10">
        <p className="flex items-center gap-2.5 text-[20px] font-extrabold tracking-[-0.03em]">
          <BrandMark /> TowLedger <span className="rounded bg-ink px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-signal">Admin</span>
        </p>
        <h1 className="mt-10 text-[32px] font-extrabold leading-none tracking-[-0.05em]">TowLedger team sign-in</h1>
        <p className="mt-2 text-sm text-muted">For the TowLedger team only. Every company you open and every change you make is recorded in the admin activity log.</p>
        {platform.admins.slice(0, 1).map((a) => (
          <button key={a.id} type="button" onClick={() => adminSignIn(a.id)} className="mt-6 flex min-h-16 w-full items-center gap-3 rounded-lg border border-line bg-paper px-4 text-left hover:border-pine/50">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-ink font-mono text-xs font-bold text-signal">{initials(a.name)}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Sign in as {a.name}</span>
              <span className="block text-xs text-muted">{a.email}</span>
            </span>
            <Icon name="arrowRight" className="h-5 w-5 text-pine" />
          </button>
        ))}
        <p className="mt-6 text-xs text-muted">Pilot sign-in: one shared team account. Real accounts with two-step sign-in come with the backend.</p>
        <Link href="/" className="mt-auto pt-10 text-sm font-semibold text-pine">
          ← TowLedger apps
        </Link>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:h-16 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2.5 text-[17px] font-extrabold tracking-[-0.03em]">
            <BrandMark small /> TowLedger
            <span className="rounded bg-signal px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink">Admin</span>
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Admin">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold ${n.match(path) ? "bg-white/10 text-white" : "text-[#b6c6bb] hover:text-white"}`}>
                <Icon name={n.icon} className="h-4 w-4" /> {n.label}
              </Link>
            ))}
          </nav>
          <Link href="/admin/companies/new" className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-md bg-signal px-3 text-sm font-semibold text-ink hover:bg-signal-hover">
            <Icon name="plus" className="h-4 w-4" strokeWidth={2.5} /> <span className="hidden sm:inline">Onboard company</span>
          </Link>
          <button type="button" onClick={adminSignOut} className="flex min-h-10 items-center gap-2 rounded-md px-2 text-sm hover:bg-white/10" title="Sign out">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 font-mono text-[11px] font-bold">{initials(admin.name)}</span>
            <span className="hidden text-left leading-tight lg:block">
              <span className="block font-semibold">{admin.name}</span>
              <span className="block text-xs text-[#b6c6bb]">Sign out</span>
            </span>
          </button>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 md:hidden" aria-label="Admin sections">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-semibold ${n.match(path) ? "bg-white/10 text-white" : "text-[#b6c6bb]"}`}>
              <Icon name={n.icon} className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
