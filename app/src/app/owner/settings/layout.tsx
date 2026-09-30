"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon, type IconName } from "@/components/icons";
import { CompanyMark, Loading } from "@/components/ui";
import { endSentence } from "@/lib/describe";
import { currentUser, useAppState } from "@/lib/store";

const SECTIONS: { href: string; label: string; icon: IconName }[] = [
  { href: "/owner/settings", label: "Company profile", icon: "building" },
  { href: "/owner/settings/rates", label: "Rate cards", icon: "receipt" },
  { href: "/owner/settings/workflows", label: "Job categories & workflows", icon: "workflow" },
  { href: "/owner/settings/consent", label: "Consent template", icon: "shieldCheck" },
  { href: "/owner/settings/templates", label: "Document templates", icon: "fileText" },
];

export default function SettingsLayout({ children }: LayoutProps<"/owner/settings">) {
  const app = useAppState();
  const path = usePathname();
  if (!app) return <Loading />;
  const user = currentUser(app);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-5 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-lg bg-forest p-4 text-white shadow-[0_4px_0_#0e291c]">
            <div className="flex items-center gap-3">
              <CompanyMark company={app.company} />
              <div className="min-w-0">
                <p className="truncate font-extrabold tracking-tight">{app.company.name}</p>
                <p className="text-xs text-[#b6c6bb]">Company setup</p>
              </div>
            </div>
            <nav className="-mx-1 mt-4 flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible" aria-label="Company setup">
              {SECTIONS.map((s) => {
                const active = s.href === "/owner/settings" ? path === s.href : path.startsWith(s.href);
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
            Managed by {user?.name ?? "the owner"}. This configuration belongs to {endSentence(app.company.name)} Drivers see it in the driver app; only owners change it.
          </p>
        </aside>

        <div className="min-w-0 space-y-5">{children}</div>
      </div>
    </div>
  );
}
