"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Icon, type IconName } from "@/components/icons";
import { BrandMark } from "@/components/ui";
import { initials } from "@/lib/describe";
import { currentUser, setAppState, useAppState } from "@/lib/store";

const NAV: { href: string; label: string; icon: IconName; match: (path: string) => boolean }[] = [
  { href: "/", label: "Driver", icon: "truck", match: (p) => p === "/" || (p.startsWith("/jobs/") && !p.endsWith("/audit")) },
  { href: "/office", label: "Office jobs", icon: "fileCheck", match: (p) => p.startsWith("/office") || p.endsWith("/audit") },
  { href: "/admin", label: "Company setup", icon: "sliders", match: (p) => p.startsWith("/admin") },
  { href: "/demo", label: "Interview mode", icon: "play", match: (p) => p.startsWith("/demo") },
];

export function AppBar() {
  const app = useAppState();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const user = app ? currentUser(app) : undefined;

  return (
    <header className="no-print sticky top-0 z-40 border-b border-ink/10 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:h-16 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-[18px] font-extrabold tracking-[-0.03em]">
          <BrandMark />
          TowLedger
        </Link>
        {app ? <span className="hidden truncate border-l border-ink/15 pl-4 text-sm text-muted md:block">{app.company.name}</span> : null}

        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
                item.match(path) ? "bg-mint text-forest" : "text-muted hover:text-ink"
              }`}
            >
              <Icon name={item.icon} className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          aria-expanded={menu}
          className="ml-auto flex min-h-10 items-center gap-2 rounded-md px-1.5 text-sm font-semibold text-ink hover:bg-sand lg:ml-2"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-mint font-mono text-[11px] font-bold text-forest">{user ? initials(user.name) : "…"}</span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block">{user?.name}</span>
            <span className="block text-xs font-normal text-muted">{user?.role === "owner" ? "Owner / office" : "Driver"}</span>
          </span>
          <Icon name="menu" className="h-5 w-5 lg:hidden" />
        </button>
      </div>

      {menu && app ? (
        <div className="border-t border-ink/10 bg-paper">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:grid-cols-2 sm:px-6">
            <nav className="grid gap-1 lg:hidden" aria-label="Main">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenu(false)}
                  className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-[15px] font-semibold ${item.match(path) ? "bg-mint text-forest" : "text-ink hover:bg-sand"}`}
                >
                  <Icon name={item.icon} className="h-[18px] w-[18px]" />
                  {item.label}
                </Link>
              ))}
            </nav>
            <div>
              <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Using the app as</p>
              <div className="grid gap-1">
                {app.team.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setAppState((s) => ({ ...s, currentUserId: m.id }));
                      setMenu(false);
                    }}
                    className={`flex min-h-11 items-center justify-between rounded-md px-3 text-left text-sm ${m.id === app.currentUserId ? "bg-forest text-white" : "hover:bg-sand"}`}
                  >
                    <span className="font-semibold">{m.name}</span>
                    <span className={m.id === app.currentUserId ? "text-[#b6c6bb]" : "text-muted"}>{m.role === "owner" ? "Owner" : "Driver"}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">Pilot stand-in for sign-in, so you can demo as the owner or a driver.</p>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
