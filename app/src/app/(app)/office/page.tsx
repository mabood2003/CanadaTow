"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/icons";
import { Chip, inputClass, Loading, PageShell, ScreenHeader } from "@/components/ui";
import type { Job } from "@/lib/domain";
import { vehicleName } from "@/lib/describe";
import { jobHref } from "@/lib/job-steps";
import { requestTypeFor, useAppState } from "@/lib/store";
import { formatDate } from "@/lib/time";
import { currentEstimate, currentInvoice, estimateConsent, jobStatus, type JobStatus } from "@/lib/tow-rules";

type StatusFilter = "all" | "attention" | "progress" | "complete";
type DateFilter = "all" | "today" | "7" | "30";

type Mark = "yes" | "no" | "na";

function marks(job: Job): { estimate: Mark; consent: Mark; invoice: Mark } {
  const w = job.workflow;
  const estimate = currentEstimate(job);
  return {
    estimate: estimate && estimate.deliveries.length ? "yes" : w && !w.requireEstimate ? "na" : "no",
    consent: estimateConsent(job) ? "yes" : w && !w.requireConsent ? "na" : "no",
    invoice: currentInvoice(job) ? "yes" : "no",
  };
}

function MarkCell({ mark }: { mark: Mark }) {
  if (mark === "yes") return <span className="font-extrabold text-ok" aria-label="Done">✓</span>;
  if (mark === "na") return <span className="text-xs text-subtle" title="Not part of this workflow">n/a</span>;
  return <span className="text-[#b8bcb8]" aria-label="Missing">—</span>;
}

function group(status: JobStatus): StatusFilter {
  if (status.label === "Complete") return "complete";
  return status.tone === "bad" ? "attention" : "progress";
}

export default function OfficePage() {
  const app = useAppState();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [driver, setDriver] = useState("all");
  const [date, setDate] = useState<DateFilter>("all");

  if (!app) return <Loading />;

  const query = search.trim().toLowerCase();
  // eslint-disable-next-line react-hooks/purity -- "today" filter needs the current time
  const now = Date.now();
  const all = [...app.jobs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((job) => {
      const s = jobStatus(job);
      return { job, type: requestTypeFor(app, job), status: s, group: group(s), ...marks(job) };
    });
  const attention = all.filter((r) => r.group === "attention").length;
  const drivers = [...new Set(app.jobs.map((j) => j.driverName))].sort();

  const rows = all
    .filter(({ job }) => !query || `${job.vehicle.plate} ${job.customer.name} ${job.number} #${job.number}`.toLowerCase().includes(query))
    .filter((r) => status === "all" || r.group === status)
    .filter(({ job }) => driver === "all" || job.driverName === driver)
    .filter(({ job }) => {
      if (date === "all") return true;
      const age = now - Date.parse(job.createdAt);
      if (date === "today") return age < 24 * 3600_000;
      return age < Number(date) * 24 * 3600_000;
    });

  return (
    <PageShell width="full">
      <ScreenHeader
        kicker={`${app.company.name} · Office`}
        title="Jobs"
        subtitle={
          attention > 0 ? (
            <button type="button" onClick={() => setStatus("attention")} className="inline-flex items-center gap-1.5 font-semibold text-danger hover:underline">
              <Icon name="alert" className="h-4 w-4" /> {attention === 1 ? "1 job hasn't" : `${attention} jobs haven't`} completed your company process
            </button>
          ) : (
            "Every job has completed your company process."
          )
        }
      />

      <div className="mb-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <label className="relative">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input className={`${inputClass} pl-9`} type="search" placeholder="Search plate, customer or job number" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <select aria-label="Driver" className={`${inputClass} md:w-44`} value={driver} onChange={(e) => setDriver(e.target.value)}>
          <option value="all">All drivers</option>
          {drivers.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select aria-label="Status" className={`${inputClass} md:w-48`} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="all">All statuses</option>
          <option value="attention">Needs attention</option>
          <option value="progress">In progress</option>
          <option value="complete">Complete</option>
        </select>
        <select aria-label="Date" className={`${inputClass} md:w-40`} value={date} onChange={(e) => setDate(e.target.value as DateFilter)}>
          <option value="all">Any date</option>
          <option value="today">Last 24 hours</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </select>
      </div>

      {rows.length === 0 ? <p className="py-10 text-center text-sm text-muted">No jobs match.</p> : null}

      {/* Phone: cards */}
      <ul className="space-y-2 md:hidden">
        {rows.map(({ job, type, status: s, estimate, consent, invoice }) => (
          <li key={job.id}>
            <Link href={jobHref(job)} className="block rounded-lg border border-line bg-paper p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  #{job.number} · {job.vehicle.plate || "—"}
                </span>
                <Chip tone={s.tone}>{s.label}</Chip>
              </div>
              <p className="mt-1 text-sm text-muted">
                {job.customer.name || "No customer"} · {job.driverName} · {formatDate(job.createdAt)}
              </p>
              <p className="mt-2 flex flex-wrap gap-x-4 text-xs text-muted">
                <span>{job.workflow ? `Workflow ${job.workflow.letter}` : type?.label ?? "New"}</span>
                <span>
                  Estimate <MarkCell mark={estimate} />
                </span>
                <span>
                  Consent <MarkCell mark={consent} />
                </span>
                <span>
                  Invoice <MarkCell mark={invoice} />
                </span>
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {/* Laptop: table */}
      <div className="hidden overflow-x-auto rounded-lg border border-line bg-white shadow-[0_18px_50px_#1f362812] md:block">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-[#f5f6f2] font-mono text-[10px] uppercase tracking-[0.08em] text-subtle">
            <tr>
              {["Job ID", "Date", "Vehicle", "Driver", "Request type", "Workflow", "Estimate", "Consent", "Invoice", "Status"].map((h) => (
                <th key={h} className="px-4 py-3 font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {rows.map(({ job, type, status: s, estimate, consent, invoice }) => (
              <tr key={job.id} onClick={() => router.push(jobHref(job))} className="cursor-pointer hover:bg-paper">
                <td className="px-4 py-4">
                  <Link href={jobHref(job)} className="font-bold text-ink underline-offset-4 hover:underline">
                    #{job.number}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-muted">{formatDate(job.createdAt)}</td>
                <td className="px-4 py-4">
                  <span className="block font-semibold">{job.vehicle.make ? vehicleName(job.vehicle) : "—"}</span>
                  <span className="block font-mono text-xs text-muted">{job.vehicle.plate}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-4">{job.driverName}</td>
                <td className="px-4 py-4">{type?.label ?? "—"}</td>
                <td className="px-4 py-4">
                  {job.workflow ? (
                    <span className="inline-flex items-center gap-2" title={job.workflow.name}>
                      <span className="grid h-6 w-6 place-items-center rounded bg-forest text-xs font-bold text-signal">{job.workflow.letter}</span>
                      <span className="hidden text-xs text-muted xl:inline">{job.workflow.name}</span>
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-4 text-center">
                  <MarkCell mark={estimate} />
                </td>
                <td className="px-4 py-4 text-center">
                  <MarkCell mark={consent} />
                </td>
                <td className="px-4 py-4 text-center">
                  <MarkCell mark={invoice} />
                </td>
                <td className="px-4 py-4">
                  <Chip tone={s.tone}>{s.label}</Chip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
