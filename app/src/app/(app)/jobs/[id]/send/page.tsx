"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { EstimateDocument } from "@/components/documents";
import { Icon, type IconName } from "@/components/icons";
import { JobScreen, StepHeader, type JobContext } from "@/components/job-screen";
import { SendPanel } from "@/components/send-panel";
import { Banner, ErrorText, LinkButton, PageShell } from "@/components/ui";
import { recordDelivery } from "@/lib/jobs";
import { jobHref, nextHref } from "@/lib/job-steps";
import { attempt, mutateJob } from "@/lib/store";
import { currentEstimate } from "@/lib/tow-rules";

export default function SendStepPage() {
  return <JobScreen>{(ctx) => <SendEstimate {...ctx} />}</JobScreen>;
}

function SendEstimate({ app, job }: JobContext) {
  const router = useRouter();
  const estimate = currentEstimate(job);
  const [fallback, setFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!estimate) {
    return (
      <PageShell>
        <StepHeader job={job} step="send" title="Estimate delivery" />
        <Banner tone="warn" title="No estimate yet">
          Build and issue the estimate first.
        </Banner>
        <div className="mt-4">
          <LinkButton href={jobHref(job, "estimate")} full replace>
            Go to estimate
          </LinkButton>
        </div>
      </PageShell>
    );
  }

  const deliver = (via: "device" | "print") => attempt(() => mutateJob(job.id, (j, actor) => recordDelivery(j, actor, "estimate", via)));

  const fallbackOptions: { icon: IconName; title: string; detail: string; onClick: () => void }[] = [
    {
      icon: "smartphone",
      title: "Show the estimate on your screen",
      detail: "Hand the customer your phone to read it. Recorded as shown on the driver's device.",
      onClick: () => {
        const failure = deliver("device");
        setError(failure);
        if (!failure) router.push(`/e/${estimate.token}`);
      },
    },
    {
      icon: "camera",
      title: `Use ${app.company.name}'s paper process`,
      detail: "Customer signs your paper form; photograph or upload it as the consent record.",
      onClick: () => {
        const failure = estimate.deliveries.length ? null : deliver("device");
        setError(failure);
        if (!failure) router.replace(`${jobHref(job, "consent")}?method=paper_photo`);
      },
    },
    {
      icon: "printer",
      title: "Print a copy",
      detail: "If your company uses a printer in the truck.",
      onClick: () => {
        const failure = deliver("print");
        setError(failure);
        if (!failure) window.print();
      },
    },
  ];

  return (
    <PageShell>
      <div className="no-print">
        <StepHeader job={job} step="send" title="Estimate preview and delivery" subtitle="This is exactly what the customer receives, with your company's branding." />
      </div>
      <div className="space-y-5">
        <div className="rounded-xl border border-line bg-sand/50 p-2 sm:p-3">
          <p className="no-print mb-2 flex items-center justify-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
            <Icon name="eye" className="h-3.5 w-3.5" /> Customer view
          </p>
          <EstimateDocument company={app.company} estimate={estimate} jobNumber={job.number} />
        </div>

        <div className="no-print">
          <h2 className="mb-2 text-lg font-extrabold tracking-tight">Give the customer their copy</h2>
          <SendPanel
            kind="estimate"
            path={`/e/${estimate.token}`}
            customer={estimate.customer}
            deliveries={estimate.deliveries}
            onDelivered={(via, to) => attempt(() => mutateJob(job.id, (j, actor) => recordDelivery(j, actor, "estimate", via, to)))}
            onShowOnDevice={() => router.push(`/e/${estimate.token}`)}
          />
          <p className="mt-2 text-xs text-muted">You choose how to deliver it. TowLedger records the method and time.</p>
        </div>

        <div className="no-print rounded-lg border border-line bg-paper">
          <button type="button" onClick={() => setFallback((f) => !f)} className="flex min-h-14 w-full items-center gap-3 px-4 text-left" aria-expanded={fallback}>
            <Icon name="battery" className="h-5 w-5 text-[#b86e0f]" />
            <span className="flex-1 font-semibold">Customer&apos;s phone is dead?</span>
            <Icon name="chevronRight" className={`h-5 w-5 text-subtle transition ${fallback ? "rotate-90" : ""}`} />
          </button>
          {fallback ? (
            <div className="space-y-2 border-t border-line-soft p-3">
              {fallbackOptions.map((o) => (
                <button key={o.title} type="button" onClick={o.onClick} className="flex w-full items-start gap-3 rounded-md border border-line bg-white p-3 text-left hover:border-pine/50">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mint text-pine">
                    <Icon name={o.icon} className="h-[18px] w-[18px]" />
                  </span>
                  <span>
                    <span className="block font-semibold">{o.title}</span>
                    <span className="block text-xs text-muted">{o.detail}</span>
                  </span>
                </button>
              ))}
              <ErrorText message={error} />
            </div>
          ) : null}
        </div>

        {estimate.deliveries.length > 0 ? (
          <div className="no-print">
            <LinkButton href={job.workflow?.requireConsent ? jobHref(job, "consent") : nextHref(job, "send")} size="lg" full replace trailing="arrowRight">
              {job.workflow?.requireConsent ? "Continue to consent" : "Continue"}
            </LinkButton>
          </div>
        ) : (
          <p className="no-print text-center text-sm text-muted">
            Deliver the estimate to continue. <Link className="font-semibold text-pine underline" href={jobHref(job, "estimate")} replace>Edit estimate</Link>
          </p>
        )}
      </div>
    </PageShell>
  );
}
