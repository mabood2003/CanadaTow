"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon, type IconName } from "@/components/icons";
import { InstallApp } from "@/components/install-app";
import { OWNER_APP } from "@/lib/app-identity";
import { Card, Chip, Kicker, Loading, PageShell, SectionTitle } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/domain";
import { vehicleName } from "@/lib/describe";
import { jobHref } from "@/lib/job-steps";
import { formatMoney } from "@/lib/money";
import { balanceCents, companyActivity, dashboardCounts, elapsed, LIVE_STAGE_LABELS, liveStage, needsAttention } from "@/lib/owner-view";
import { currentUserName, useAppState } from "@/lib/store";
import { formatTime, formatWhen } from "@/lib/time";
import { capitalize, jobRecord, jobStatus } from "@/lib/tow-rules";

function greeting(nowMs: number) {
  const hour = Number(new Intl.DateTimeFormat("en-CA", { hour: "numeric", hourCycle: "h23", timeZone: "America/Edmonton" }).format(nowMs));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

/** Keeps "14 min on the road" current without a reload. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export default function OwnerDashboard() {
  const app = useAppState();
  const now = useNow();
  if (!app) return <Loading />;

  const jobs = [...app.jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const counts = dashboardCounts(jobs, now);
  const attention = jobs.filter(needsAttention);
  const live = jobs.map((job) => ({ job, live: liveStage(job) })).filter((x) => x.live);
  const unpaid = jobs.filter((j) => balanceCents(j) > 0);
  const activity = companyActivity(jobs, 10);
  const name = currentUserName(app).split(" ")[0];

  const tiles: { label: string; value: string; detail: string; icon: IconName; href: string; alert?: boolean }[] = [
    { label: "Needs attention", value: String(counts.needsAttention), detail: counts.needsAttention ? "Records to finish" : "All records on track", icon: "alert", href: "/owner/jobs?status=attention", alert: counts.needsAttention > 0 },
    { label: "On the road", value: String(counts.live), detail: counts.live ? "Tows under way" : "No tows right now", icon: "truck", href: "#live" },
    { label: "Waiting for customer", value: String(counts.waitingOnCustomer), detail: "Estimate sent, no consent yet", icon: "clock", href: "/owner/jobs?status=progress" },
    { label: "Unpaid", value: formatMoney(counts.unpaidCents), detail: `${counts.unpaidInvoices} issued invoice${counts.unpaidInvoices === 1 ? "" : "s"}`, icon: "receipt", href: "/owner/jobs?status=unpaid" },
  ];

  return (
    <PageShell width="full">
      <header className="mb-6">
        <Kicker>{app.company.name} · Owner</Kicker>
        <h1 className="mt-1 text-[32px] font-extrabold leading-none tracking-[-0.05em] sm:text-[40px]">
          {greeting(now)}, {name}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {counts.completedThisWeek} job{counts.completedThisWeek === 1 ? "" : "s"} completed in the last 7 days · {jobs.length} on file
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className={`rounded-lg border p-4 transition hover:-translate-y-px ${t.alert ? "border-danger/40 bg-[#fdeceb]" : "border-line bg-paper hover:border-pine/50"}`}
          >
            <Icon name={t.icon} className={`h-5 w-5 ${t.alert ? "text-danger" : "text-pine"}`} />
            <p className="mt-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{t.label}</p>
            <p className={`mt-1 text-2xl font-extrabold tracking-tight tabular-nums ${t.alert ? "text-danger" : ""}`}>{t.value}</p>
            <p className="mt-0.5 text-xs text-muted">{t.detail}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <SectionTitle right={attention.length ? <Link href="/owner/jobs?status=attention" className="text-xs font-semibold text-pine">View all</Link> : null}>Needs attention</SectionTitle>
            {attention.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Icon name="check" className="h-4 w-4 text-ok" strokeWidth={3} /> Every job is on track with your company process.
              </p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {attention.map((job) => {
                  const record = jobRecord(job);
                  const fix = record.items.find((i) => !i.ok);
                  const status = jobStatus(job);
                  return (
                    <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <Link href={jobHref(job)} className="min-w-0">
                        <span className="block font-semibold">
                          #{job.number} · {job.vehicle.make ? vehicleName(job.vehicle) : job.vehicle.plate || "Vehicle not recorded"}
                        </span>
                        <span className="block text-sm text-danger">{capitalize(status.detail ?? record.problems[0] ?? status.label)}</span>
                        <span className="block text-xs text-muted">
                          {job.driverName} · {formatWhen(job.createdAt)}
                        </span>
                      </Link>
                      {fix ? (
                        <Link href={jobHref(job, fix.fix)} className="inline-flex min-h-10 items-center rounded-md bg-danger px-3 text-sm font-semibold text-white">
                          Fix it
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <div id="live" className="scroll-mt-24" />
            <SectionTitle>On the road now</SectionTitle>
            {live.length === 0 ? (
              <p className="text-sm text-muted">No tows under way.</p>
            ) : (
              <ul className="space-y-2">
                {live.map(({ job, live: l }) => (
                  <li key={job.id}>
                    <Link href={jobHref(job)} className="flex items-center gap-3 rounded-md border border-line-soft bg-white p-3 hover:border-pine/50">
                      <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-forest text-signal">
                        <Icon name="truck" className="h-5 w-5" />
                        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full bg-signal ring-2 ring-white" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">
                          {job.driverName} · #{job.number}
                        </span>
                        <span className="block truncate text-sm text-muted">
                          {LIVE_STAGE_LABELS[l!.stage]} {elapsed(l!.since, now)} ago · to {job.destination.split(" — ")[0] || "—"}
                        </span>
                      </span>
                      <Chip tone={l!.stage === "on_road" ? "info" : "neutral"}>{LIVE_STAGE_LABELS[l!.stage]}</Chip>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {unpaid.length > 0 ? (
            <Card>
              <SectionTitle>Unpaid invoices</SectionTitle>
              <ul className="divide-y divide-line-soft">
                {unpaid.map((job) => (
                  <li key={job.id}>
                    <Link href={jobHref(job, "invoice")} className="flex items-center justify-between gap-3 py-3">
                      <span className="min-w-0">
                        <span className="block font-semibold">#{job.number} · {job.customer.name || "Customer not recorded"}</span>
                        <span className="block text-xs text-muted">Invoice issued {formatWhen(job.invoices.at(-1)!.issuedAt)}</span>
                      </span>
                      <span className="font-bold tabular-nums">{formatMoney(balanceCents(job))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5 lg:self-start">
        <Card>
          <SectionTitle right={<Link href="/owner/jobs" className="text-xs font-semibold text-pine">All jobs</Link>}>Recent activity</SectionTitle>
          <ol className="space-y-3">
            {activity.map(({ entry, job }) => (
              <li key={entry.id}>
                <Link href={jobHref(job)} className="block rounded-md p-1 -m-1 hover:bg-mint/60">
                  <p className="text-sm leading-snug">
                    <span className="font-semibold">#{job.number}</span> · {entry.action}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatTime(entry.at)} · {entry.by} ({ROLE_LABELS[entry.role]})
                  </p>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
        <Card>
          <SectionTitle>Install the app</SectionTitle>
          <InstallApp appName={OWNER_APP.name} />
        </Card>
        </div>
      </div>
    </PageShell>
  );
}
