"use client";

import { Icon } from "@/components/icons";
import { InterviewPrompt, JobScreen, StepHeader, type JobContext } from "@/components/job-screen";
import { Banner, LinkButton, PageShell } from "@/components/ui";
import { jobHref, nextHref } from "@/lib/job-steps";
import { rateCardFor } from "@/lib/store";
import { workflowStepLabels } from "@/lib/tow-rules";

export default function WorkflowStepPage() {
  return <JobScreen>{(ctx) => <WorkflowSelected {...ctx} />}</JobScreen>;
}

function WorkflowSelected({ app, job, type }: JobContext) {
  const workflow = job.workflow;
  if (!workflow || !type) {
    return (
      <PageShell>
        <StepHeader job={job} step="workflow" title="Workflow" />
        <Banner tone="warn" title="Record who requested the tow first" />
        <div className="mt-4">
          <LinkButton href={jobHref(job, "request")} full replace>
            Who requested this tow?
          </LinkButton>
        </div>
      </PageShell>
    );
  }

  const steps = workflowStepLabels(workflow);
  const before = [
    workflow.requireReference && `${workflow.referenceLabel} recorded`,
    workflow.requireEstimate && "Estimate delivered to the customer",
    workflow.requireConsent && `${app.company.name} consent step completed`,
    workflow.requireDestination && "Destination and who supplied it recorded",
  ].filter((s): s is string => Boolean(s));

  return (
    <PageShell>
      <StepHeader job={job} step="workflow" title="Workflow selected" />

      <div className="space-y-5">
        <section className="overflow-hidden rounded-lg bg-forest text-white shadow-[0_4px_0_#0e291c]">
          <div className="p-5">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-signal">{app.company.name} workflow</p>
            <div className="mt-2 flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-signal text-xl font-extrabold text-forest">{workflow.letter}</span>
              <h2 className="text-[26px] font-extrabold leading-[1.05] tracking-[-0.04em]">{workflow.name}</h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#c7d3cb]">{workflow.description}</p>
          </div>
          <ol className="grid gap-px bg-white/10">
            {steps.map((step, i) => (
              <li key={step} className="flex items-center gap-3 bg-forest px-5 py-3">
                <span className="grid h-7 w-7 place-items-center rounded-full border border-signal/60 font-mono text-xs font-bold text-signal">{i + 1}</span>
                <span className="font-semibold">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <p className="text-sm text-muted">
          <strong className="text-ink">{app.company.name}</strong> configured Workflow {workflow.letter} for <strong className="text-ink">{type.label}</strong> jobs.
        </p>

        {before.length > 0 ? (
          <div className="rounded-lg border border-line bg-paper p-4">
            <p className="mb-2 text-sm font-bold text-ink">Required before the tow</p>
            <ul className="space-y-2 text-sm">
              {before.map((b) => (
                <li key={b} className="flex items-center gap-2">
                  <Icon name="lock" className="h-4 w-4 text-pine" /> {b}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">Rates: {rateCardFor(app, workflow).name}</p>
          </div>
        ) : null}

        <InterviewPrompt job={job} />

        <LinkButton href={nextHref(job, "request")} size="lg" full replace trailing="arrowRight">
          Continue
        </LinkButton>
        <p className="text-center text-xs text-muted">
          <Icon name="sliders" className="mr-1 inline h-3.5 w-3.5" />
          Workflow configured by {app.company.name}
        </p>
      </div>
    </PageShell>
  );
}
