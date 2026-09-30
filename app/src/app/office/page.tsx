"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Chip, inputClass, Loading, PageShell, ScreenHeader } from "@/components/ui";
import type { Job, RequestType } from "@/lib/domain";
import { jobHref } from "@/lib/job-steps";
import { requestTypeFor, useAppState } from "@/lib/store";
import { formatDate } from "@/lib/time";
import { currentEstimate, currentInvoice, estimateConsent, jobStatus, resolveWorkflow } from "@/lib/tow-rules";

type Filter = "all" | "attention" | "complete";

function summarize(job: Job, type: RequestType | undefined) {
  const exempt = resolveWorkflow(type).runs === "exempt";
  const estimate = currentEstimate(job);
  const consent = estimateConsent(job);
  const invoice = currentInvoice(job);
  return {
    status: jobStatus(job, type),
    estimate: exempt ? "n/a" : estimate ? `v${estimate.version} ${estimate.deliveries.length ? "sent" : "not sent"}` : "None",
    consent: exempt ? "n/a" : consent ? `✓ ${consent.method.replace("_", " ")}` : "Missing",
    invoice: invoice ? invoice.number : "Not issued",
  };
}

export default function OfficePage() {
  const app = useAppState();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  if (!app) return <Loading />;

  const query = search.trim().toLowerCase();
  const rows = [...app.jobs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((job) => {
      const type = requestTypeFor(app, job);
      return { job, type, ...summarize(job, type) };
    })
    .filter(({ job }) => !query || `${job.vehicle.plate} ${job.customer.name} ${job.number}`.toLowerCase().includes(query))
    .filter(({ status }) => (filter === "all" ? true : filter === "complete" ? status.label === "Complete" : status.label !== "Complete"));

  return (
    <PageShell wide>
      <ScreenHeader back={{ href: "/", label: "Home" }} title="Jobs" subtitle={`${app.company.name} · office view`} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input className={`${inputClass} sm:max-w-sm`} type="search" placeholder="Search plate or customer name" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex gap-2">
          {(
            [
              ["all", "All"],
              ["attention", "Needs attention"],
              ["complete", "Complete"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`min-h-10 rounded-full px-4 text-sm font-semibold ring-1 ${filter === value ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-300"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">No jobs match.</p> : null}

      {/* Phone: cards */}
      <ul className="space-y-3 md:hidden">
        {rows.map(({ job, type, status, estimate, consent, invoice }) => (
          <li key={job.id}>
            <Link href={jobHref(job)} className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  {job.vehicle.plate || "—"} <span className="font-normal text-slate-500">· {job.number}</span>
                </span>
                <Chip tone={status.tone}>{status.label}</Chip>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {job.customer.name || "No customer"} · {job.driverName} · {formatDate(job.createdAt)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {type?.label ?? "No request type"} · Estimate {estimate} · Consent {consent} · Invoice {invoice}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {/* Laptop: table */}
      <div className="hidden overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              {["Date", "Job", "Vehicle", "Customer", "Driver", "Request type", "Estimate", "Consent", "Invoice", "Status"].map((h) => (
                <th key={h} className="px-3 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ job, type, status, estimate, consent, invoice }) => (
              <tr key={job.id} onClick={() => router.push(jobHref(job))} className="cursor-pointer hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-3">{formatDate(job.createdAt)}</td>
                <td className="px-3 py-3">
                  <Link href={jobHref(job)} className="font-semibold underline-offset-4 hover:underline">
                    {job.number}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-3">{job.vehicle.plate || "—"}</td>
                <td className="px-3 py-3">{job.customer.name || "—"}</td>
                <td className="px-3 py-3">{job.driverName}</td>
                <td className="px-3 py-3">{type?.label ?? "—"}</td>
                <td className="px-3 py-3">{estimate}</td>
                <td className="px-3 py-3">{consent}</td>
                <td className="px-3 py-3">{invoice}</td>
                <td className="px-3 py-3">
                  <Chip tone={status.tone}>{status.label}</Chip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
