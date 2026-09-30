"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Chip, ErrorText, Loading, PageShell } from "@/components/ui";
import { createJob } from "@/lib/jobs";
import { jobHref } from "@/lib/job-steps";
import { actorFor, attempt, currentUserName, requestTypeFor, setAppState, useAppState } from "@/lib/store";
import { formatDateTime } from "@/lib/time";
import { jobStatus } from "@/lib/tow-rules";

export default function HomePage() {
  const app = useAppState();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  if (!app) return <Loading />;

  const userName = currentUserName(app);
  const recent = [...app.jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);

  const startNewTow = () => {
    let id = "";
    const failure = attempt(() =>
      setAppState((current) => {
        const yard = current.yards[0];
        const job = createJob({
          number: `TW-${current.counters.job}`,
          actor: actorFor(current),
          rateCard: current.rateCard,
          defaultDestination: yard ? `${yard.name} — ${yard.address}` : "",
        });
        id = job.id;
        return { ...current, jobs: [job, ...current.jobs], counters: { ...current.counters, job: current.counters.job + 1 } };
      }),
    );
    if (failure) return setError(failure);
    router.push(`/jobs/${id}/request`);
  };

  return (
    <PageShell>
      <header className="mb-6 rounded-3xl bg-slate-900 p-5 text-white shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">TowLedger</p>
            <h1 className="mt-1 truncate text-2xl font-bold">{app.company.name}</h1>
            <p className="mt-1 text-sm text-slate-300">Signed in as {userName}</p>
          </div>
          <Link href="/setup" className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/20 hover:bg-white/20">
            Company
          </Link>
        </div>
      </header>

      <Button size="lg" full onClick={startNewTow} className="min-h-20 text-2xl">
        + New Tow
      </Button>
      <div className="mt-3">
        <ErrorText message={error} />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent jobs</h2>
          <Link href="/office" className="text-sm font-semibold text-slate-700 underline underline-offset-4">
            All jobs
          </Link>
        </div>
        {recent.length === 0 ? <p className="text-sm text-slate-500">No jobs yet.</p> : null}
        <ul className="space-y-3">
          {recent.map((job) => {
            const status = jobStatus(job, requestTypeFor(app, job));
            return (
              <li key={job.id}>
                <Link href={jobHref(job)} className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:ring-slate-400">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-900">
                      {job.vehicle.plate || "No plate yet"} <span className="font-normal text-slate-500">· {job.number}</span>
                    </span>
                    <Chip tone={status.tone}>{status.label}</Chip>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {job.customer.name || "Customer not recorded"} · {formatDateTime(job.createdAt)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </PageShell>
  );
}
