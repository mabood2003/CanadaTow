"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/icons";
import { Chip, CompanyMark, ErrorText, Kicker, Loading, PageShell } from "@/components/ui";
import { vehicleName } from "@/lib/describe";
import { jobHref } from "@/lib/job-steps";
import { formatMoney } from "@/lib/money";
import { attempt, currentUserName, startJob, useAppState } from "@/lib/store";
import { formatWhen } from "@/lib/time";
import { currentEstimate, currentInvoice, jobStatus } from "@/lib/tow-rules";

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-CA", { hour: "numeric", hourCycle: "h23", timeZone: "America/Edmonton" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default function DriverHome() {
  const app = useAppState();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  if (!app) return <Loading />;

  const userName = currentUserName(app);
  const recent = [...app.jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);

  const newTow = () => {
    let id = "";
    const failure = attempt(() => {
      id = startJob();
    });
    if (failure) return setError(failure);
    router.push(`/jobs/${id}/request`);
  };

  return (
    <PageShell>
      <div className="flex items-center gap-3">
        <CompanyMark company={app.company} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-lg font-extrabold tracking-tight">{app.company.name}</p>
          <p className="text-sm text-muted">Driver: {userName}</p>
        </div>
      </div>

      <div className="mt-8">
        <Kicker>{greeting()}</Kicker>
        <h1 className="mt-1 text-[34px] font-extrabold leading-none tracking-[-0.05em]">{userName.split(" ")[0]}&apos;s jobs</h1>
      </div>

      <button
        type="button"
        onClick={newTow}
        className="mt-6 grid w-full grid-cols-[48px_1fr_auto] items-center gap-4 rounded-lg bg-forest p-5 text-left text-white shadow-[0_4px_0_#0e291c] transition hover:-translate-y-px hover:bg-forest-hover active:translate-y-0.5 active:shadow-none"
      >
        <span className="grid h-12 w-12 place-items-center rounded-full bg-signal text-forest">
          <Icon name="plus" className="h-7 w-7" strokeWidth={2.5} />
        </span>
        <span>
          <span className="block text-2xl font-extrabold tracking-tight">New Tow</span>
          <span className="block text-sm text-[#b6c6bb]">Customer, vehicle and destination</span>
        </span>
        <Icon name="arrowRight" className="h-6 w-6 text-signal" />
      </button>
      <div className="mt-3">
        <ErrorText message={error} />
      </div>

      <section className="mt-10">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Recent jobs</h2>
          <Link href="/office" className="text-sm font-semibold text-pine underline-offset-4 hover:underline">
            All jobs
          </Link>
        </div>
        {recent.length === 0 ? <p className="text-sm text-muted">No jobs yet.</p> : null}
        <ul className="divide-y divide-line-soft border-y border-line-soft">
          {recent.map((job) => {
            const status = jobStatus(job);
            const amount = currentInvoice(job)?.totalCents ?? currentEstimate(job)?.totalCents;
            return (
              <li key={job.id}>
                <Link href={jobHref(job)} className="grid grid-cols-[40px_1fr_auto] items-center gap-3 py-4 hover:bg-paper">
                  <span
                    className={`grid h-10 w-10 place-items-center rounded-full ${
                      status.tone === "good" ? "bg-[#e5f3e9] text-ok" : status.tone === "bad" ? "bg-[#fdeceb] text-danger" : "bg-mint text-pine"
                    }`}
                  >
                    <Icon name={status.tone === "good" ? "check" : status.tone === "bad" ? "alert" : "truck"} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{job.vehicle.make ? vehicleName(job.vehicle) : `Job #${job.number}`}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <span>{job.vehicle.plate || "No plate yet"}</span>
                      <Chip tone={status.tone}>{status.label}</Chip>
                    </span>
                    <span className="mt-0.5 block text-xs text-subtle">{formatWhen(job.createdAt)}</span>
                  </span>
                  <span className="flex items-center gap-1 text-sm font-bold tabular-nums">
                    {amount !== undefined ? formatMoney(amount) : ""}
                    <Icon name="chevronRight" className="h-4 w-4 text-subtle" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </PageShell>
  );
}
