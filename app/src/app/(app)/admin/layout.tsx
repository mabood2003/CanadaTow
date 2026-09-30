"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon, type IconName } from "@/components/icons";
import { Banner, Button, CompanyMark, Loading } from "@/components/ui";
import { endSentence } from "@/lib/describe";
import { currentUser, setAppState, useAppState } from "@/lib/store";

const SECTIONS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin", label: "Company profile", icon: "building" },
  { href: "/admin/rates", label: "Rate cards", icon: "receipt" },
  { href: "/admin/workflows", label: "Job categories & workflows", icon: "workflow" },
  { href: "/admin/consent", label: "Consent template", icon: "shieldCheck" },
  { href: "/admin/templates", label: "Document templates", icon: "fileText" },
  { href: "/admin/team", label: "Team", icon: "users" },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  const app = useAppState();
  const path = usePathname();
  if (!app) return <Loading />;
  const user = currentUser(app);
  const owner = app.team.find((m) => m.role === "owner");

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-5 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-lg bg-forest p-4 text-white shadow-[0_4px_0_#0e291c]">
            <div className="flex items-center gap-3">
              <CompanyMark company={app.company} />
              <div className="min-w-0">
                <p className="truncate font-extrabold tracking-tight">{app.company.name}</p>
                <p className="text-xs text-[#b6c6bb]">Company settings</p>
              </div>
            </div>
            <nav className="-mx-1 mt-4 flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible" aria-label="Company setup">
              {SECTIONS.map((s) => {
                const active = s.href === "/admin" ? path === "/admin" : path.startsWith(s.href);
                return (
                  <Link
                    key={s.href}
                    href={s.href}
                    className={`flex min-h-10 shrink-0 items-center gap-2.5 whitespace-nowrap rounded px-3 text-sm font-semibold transition ${
                      active ? "bg-[#315540] text-white" : "text-[#c7d3cb] hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon name={s.icon} className={`h-4 w-4 ${active ? "text-signal" : ""}`} />
                    {s.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <p className="mt-3 hidden px-1 text-xs leading-relaxed text-muted lg:block">
            Managed by {owner?.name ?? "the owner"}. This configuration belongs to {endSentence(app.company.name)}
          </p>
        </aside>

        <div className="min-w-0 space-y-5">
          {user?.role !== "owner" ? (
            <Banner tone="info" icon="lock" title={`Viewing as ${user?.name} (driver)`}>
              <p>Drivers can see the company&apos;s settings. Changes are made by the owner.</p>
              {owner ? (
                <Button size="sm" variant="secondary" className="mt-3" onClick={() => setAppState((s) => ({ ...s, currentUserId: owner.id }))}>
                  Switch to {owner.name} (owner)
                </Button>
              ) : null}
            </Banner>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
