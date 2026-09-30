"use client";

import { useParams } from "next/navigation";
import type { ReactNode } from "react";

import { Chip, Loading, PageShell, ScreenHeader } from "@/components/ui";
import type { Job, RequestType } from "@/lib/domain";
import { jobHref } from "@/lib/job-steps";
import type { AppState } from "@/lib/seed";
import { requestTypeFor, useAppState } from "@/lib/store";
import { jobStatus, resolveWorkflow } from "@/lib/tow-rules";

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
  if (!job) {
    return (
      <PageShell>
        <ScreenHeader back={{ href: "/", label: "Home" }} title="Job not found" subtitle="It may have been created on another device." />
      </PageShell>
    );
  }
  return <>{children({ app, job, type: requestTypeFor(app, job) })}</>;
}

/** Header for a step inside a job: back goes to the job file (replace, so Back never replays the whole flow). */
export function StepHeader({ job, type, title, subtitle }: { job: Job; type: RequestType | undefined; title: string; subtitle?: ReactNode }) {
  const status = jobStatus(job, type);
  const resolved = resolveWorkflow(type);
  const who = [job.vehicle.plate, job.customer.name].filter(Boolean).join(" · ");
  return (
    <ScreenHeader
      back={{ href: jobHref(job), label: `Job ${job.number}` }}
      title={title}
      subtitle={
        subtitle ?? (
          <span className="flex flex-wrap items-center gap-2">
            {who ? <span>{who}</span> : null}
            <Chip tone={status.tone}>{status.label}</Chip>
            {resolved.toConfirm ? <Chip tone="neutral">Classification to be confirmed</Chip> : null}
          </span>
        )
      }
    />
  );
}
