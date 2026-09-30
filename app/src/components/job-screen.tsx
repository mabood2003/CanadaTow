"use client";

import { useParams } from "next/navigation";
import type { ReactNode } from "react";

import { Icon } from "@/components/icons";
import { Chip, Loading, PageShell, ScreenHeader } from "@/components/ui";
import type { Job, RequestType } from "@/lib/domain";
import { vehicleLine } from "@/lib/describe";
import { jobHref, jobPhases, PHASE_LABELS, phaseOf } from "@/lib/job-steps";
import { scenarioFor } from "@/lib/scenarios";
import type { AppState } from "@/lib/seed";
import { appBase } from "@/lib/app-base";
import { currentUserName, requestTypeFor, useAppState } from "@/lib/store";
import { jobStatus, type StepKey } from "@/lib/tow-rules";

export interface JobContext {
  app: AppState;
  job: Job;
  type: RequestType | undefined;
}

/** Loads the job named in the URL and hands it to a form component (which can then use hooks freely). */
export function JobScreen({ children }: { children: (ctx: JobContext) => ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const app = useAppState();
  if (!app) return <Loading />;
  const job = app.jobs.find((j) => j.id === id);
  const base = appBase();
  if (!job) {
    return (
      <PageShell>
        <ScreenHeader back={{ href: base, label: "Home" }} title="Job not found" subtitle="It may have been created on another device." />
      </PageShell>
    );
  }
  // Operators only open their own jobs; the owner app sees every job in the company.
  if (base === "/driver" && job.driverName !== currentUserName(app)) {
    return (
      <PageShell>
        <ScreenHeader back={{ href: base, label: "Home" }} title={`Job #${job.number} belongs to ${job.driverName}`} subtitle="Drivers see their own jobs. Ask the office if you need this one." />
      </PageShell>
    );
  }
  return <>{children({ app, job, type: requestTypeFor(app, job) })}</>;
}

/** Header for a step inside a job: back goes to the job record (replace, so Back never replays the whole flow). */
export function StepHeader({ job, step, title, subtitle }: { job: Job; step: StepKey; title: string; subtitle?: ReactNode }) {
  const status = jobStatus(job);
  const who = [job.vehicle.plate, job.customer.name].filter(Boolean).join(" · ");
  return (
    <>
      <ScreenHeader
        back={{ href: jobHref(job), label: `Job #${job.number}` }}
        kicker={job.workflow ? `Job #${job.number} · Workflow ${job.workflow.letter}` : `Job #${job.number} · New tow`}
        title={title}
        subtitle={
          subtitle ?? (
            <span className="flex flex-wrap items-center gap-2">
              {who ? <span>{who}</span> : null}
              <Chip tone={status.tone}>{status.label}</Chip>
            </span>
          )
        }
      />
      {job.workflow ? <ProgressStrip job={job} current={step} /> : null}
    </>
  );
}

/** Estimate → Consent → Tow → Invoice → Record, filtered to what this company's workflow uses. */
export function ProgressStrip({ job, current }: { job: Job; current?: StepKey }) {
  const phases = jobPhases(job);
  const active = current ? phaseOf(current) : undefined;
  return (
    <ol className="no-print mb-6 flex items-start" aria-label="Job progress">
      {phases.map(({ phase, done }, i) => {
        const isActive = phase === active;
        return (
          <li key={phase} className="relative flex flex-1 flex-col items-center gap-1.5">
            {i < phases.length - 1 ? <span aria-hidden className={`absolute left-1/2 top-[11px] h-0.5 w-full ${done ? "bg-pine" : "bg-[#c9d0c9]"}`} /> : null}
            <span
              className={`relative z-10 grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold ${
                done ? "bg-forest text-signal" : isActive ? "bg-signal text-forest ring-4 ring-signal/40" : "border-2 border-[#c9d0c9] bg-cream text-subtle"
              }`}
            >
              {done ? <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className={`text-[11px] font-semibold ${isActive ? "text-ink" : "text-muted"}`}>{PHASE_LABELS[phase]}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Interview mode: the question to ask the operator at this point in the demo. */
export function InterviewPrompt({ job }: { job: Job }) {
  const scenario = scenarioFor(job.scenario);
  if (!scenario) return null;
  return (
    <aside className="no-print rounded-lg border-2 border-dashed border-pine/35 bg-signal/15 p-4">
      <p className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-pine">
        <Icon name="message" className="h-4 w-4" /> Interview question
      </p>
      <p className="mt-2 text-[15px] font-semibold leading-snug text-ink">{scenario.question}</p>
    </aside>
  );
}

export function JobSummaryLine({ job }: { job: Job }) {
  return <>{vehicleLine(job.vehicle) || "Vehicle not recorded"}</>;
}
