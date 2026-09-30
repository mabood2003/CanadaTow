"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CompanyStatusChip } from "@/components/admin-console";
import { Icon, type IconName } from "@/components/icons";
import { CompanyMark, Kicker, Loading, PageShell } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { companyMetrics } from "@/lib/platform";
import { usePlatform } from "@/lib/store";
import { formatDate, formatWhen } from "@/lib/time";

export default function AdminCompaniesPage() {
  const platform = usePlatform();
  const router = useRouter();
  const [now] = useState(() => Date.now());
  if (!platform) return <Loading />;

  const rows = platform.companies.map((account) => ({ account, m: companyMetrics(account, now) }));
  const totals = rows.reduce(
    (t, { account, m }) => ({
      live: t.live + (account.status === "pilot" || account.status === "active" ? 1 : 0),
      jobsThisWeek: t.jobsThisWeek + m.jobsThisWeek,
      needsAttention: t.needsAttention + m.needsAttention,
      messages: t.messages + m.messagesThisWeek,
      drivers: t.drivers + m.drivers,
    }),
    { live: 0, jobsThisWeek: 0, needsAttention: 0, messages: 0, drivers: 0 },
  );
  const onboarding = platform.companies.filter((c) => c.status === "onboarding").length;

  const tiles: { label: string; value: string; detail: string; icon: IconName }[] = [
    { label: "Companies", value: String(platform.companies.length), detail: `${totals.live} live · ${onboarding} onboarding`, icon: "building" },
    { label: "Jobs · 7 days", value: String(totals.jobsThisWeek), detail: `${totals.drivers} active drivers`, icon: "truck" },
    { label: "Needs attention", value: String(totals.needsAttention), detail: "Job records not complete", icon: "alert" },
    { label: "Messages · 7 days", value: String(totals.messages), detail: "Texts and emails sent", icon: "message" },
  ];

  return (
    <PageShell width="full">
      <header className="mb-6">
        <Kicker>TowLedger admin</Kicker>
        <h1 className="mt-1 text-[32px] font-extrabold leading-none tracking-[-0.05em] sm:text-[40px]">Companies on TowLedger</h1>
        <p className="mt-2 text-sm text-muted">Each company&apos;s records belong to that company. Opening one is read-only and logged.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-line bg-paper p-4">
            <Icon name={t.icon} className="h-5 w-5 text-pine" />
            <p className="mt-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{t.label}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight">{t.value}</p>
            <p className="mt-0.5 text-xs text-muted">{t.detail}</p>
          </div>
        ))}
      </div>

      {/* Phone: cards */}
      <ul className="mt-6 space-y-2 md:hidden">
        {rows.map(({ account, m }) => (
          <li key={account.id}>
            <Link href={`/admin/companies/${account.id}`} className="block rounded-lg border border-line bg-paper p-4">
              <div className="flex items-center gap-3">
                <CompanyMark company={account.data.company} size="sm" />
                <span className="min-w-0 flex-1 truncate font-semibold">{account.data.company.name}</span>
                <CompanyStatusChip status={account.status} />
              </div>
              <p className="mt-2 text-xs text-muted">
                {m.drivers} drivers · {m.jobsThisWeek} jobs this week · {m.needsAttention} need attention · last active {m.lastActiveAt ? formatWhen(m.lastActiveAt) : "never"}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {/* Laptop: table */}
      <div className="mt-6 hidden overflow-x-auto rounded-lg border border-line bg-white shadow-[0_18px_50px_#1f362812] md:block">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-[#f5f6f2] font-mono text-[10px] uppercase tracking-[0.08em] text-subtle">
            <tr>
              {["Company", "Status", "Owner", "Drivers", "Jobs · 7 days", "Needs attention", "On the road", "Unpaid", "Last active", "Since"].map((h) => (
                <th key={h} className="px-4 py-3 font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {rows.map(({ account, m }) => {
              const owner = account.data.team.find((t) => t.role === "owner");
              return (
                <tr key={account.id} onClick={() => router.push(`/admin/companies/${account.id}`)} className="cursor-pointer hover:bg-paper">
                  <td className="px-4 py-4">
                    <Link href={`/admin/companies/${account.id}`} className="flex items-center gap-3 font-bold hover:underline">
                      <CompanyMark company={account.data.company} size="sm" />
                      {account.data.company.name}
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    <CompanyStatusChip status={account.status} />
                  </td>
                  <td className="px-4 py-4">
                    <span className="block font-medium">{owner?.name ?? "—"}</span>
                    <span className="block text-xs text-muted">{owner?.invited ? "Invite not accepted" : owner?.email}</span>
                  </td>
                  <td className="px-4 py-4 tabular-nums">
                    {m.drivers}
                    {m.invitedPending ? <span className="text-xs text-muted"> (+{m.invitedPending} invited)</span> : null}
                  </td>
                  <td className="px-4 py-4 tabular-nums">{m.jobsThisWeek}</td>
                  <td className={`px-4 py-4 tabular-nums ${m.needsAttention ? "font-bold text-danger" : ""}`}>{m.needsAttention}</td>
                  <td className="px-4 py-4 tabular-nums">{m.live}</td>
                  <td className="px-4 py-4 tabular-nums">{m.unpaidCents ? formatMoney(m.unpaidCents) : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-muted">{m.lastActiveAt ? formatWhen(m.lastActiveAt) : "Never"}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-muted">{formatDate(account.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
