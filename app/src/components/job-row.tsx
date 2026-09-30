"use client";

import Link from "next/link";

import { Icon } from "@/components/icons";
import { Chip } from "@/components/ui";
import type { Job } from "@/lib/domain";
import { vehicleName } from "@/lib/describe";
import { firstOpenStep, jobHref } from "@/lib/job-steps";
import { formatMoney } from "@/lib/money";
import { LIVE_STAGE_LABELS, liveStage } from "@/lib/owner-view";
import { formatWhen } from "@/lib/time";
import { currentEstimate, currentInvoice, jobStatus } from "@/lib/tow-rules";

/** One job in a phone list: vehicle, plate, status chip, amount. */
export function JobRow({ job }: { job: Job }) {
  const status = jobStatus(job);
  const amount = currentInvoice(job)?.totalCents ?? currentEstimate(job)?.totalCents;
  return (
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
        <span className="mt-0.5 block text-xs text-subtle">
          #{job.number} · {formatWhen(job.createdAt)}
        </span>
      </span>
      <span className="flex items-center gap-1 text-sm font-bold tabular-nums">
        {amount !== undefined ? formatMoney(amount) : ""}
        <Icon name="chevronRight" className="h-4 w-4 text-subtle" />
      </span>
    </Link>
  );
}

/** The driver's job in progress, with a one-tap way back to the step they're on. */
export function ContinueJob({ job }: { job: Job }) {
  const next = firstOpenStep(job);
  const live = liveStage(job);
  const status = jobStatus(job);
  return (
    <section className="mt-6 rounded-lg border-2 border-forest bg-paper p-4">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-pine">Your job in progress</p>
      <p className="mt-1 text-lg font-extrabold tracking-tight">
        #{job.number} · {job.vehicle.make ? vehicleName(job.vehicle) : job.vehicle.plate || "Vehicle not recorded"}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
        <Chip tone={status.tone}>{live ? LIVE_STAGE_LABELS[live.stage] : status.label}</Chip>
        {job.customer.name ? <span>{job.customer.name}</span> : null}
      </p>
      <Link
        href={jobHref(job, next?.key)}
        className="mt-4 flex min-h-12 items-center justify-between rounded-md bg-forest px-4 font-semibold text-white shadow-[0_3px_0_#0e291c]"
      >
        {next ? `Continue: ${next.label}` : "Open job"}
        <Icon name="arrowRight" className="h-5 w-5 text-signal" />
      </Link>
    </section>
  );
}
