"use client";

import { useRouter } from "next/navigation";

import { EstimateDocument } from "@/components/documents";
import { JobScreen, StepHeader, type JobContext } from "@/components/job-screen";
import { SendPanel } from "@/components/send-panel";
import { Banner, LinkButton, PageShell } from "@/components/ui";
import { recordDelivery } from "@/lib/jobs";
import { jobHref } from "@/lib/job-steps";
import { attempt, mutateJob } from "@/lib/store";
import { currentEstimate } from "@/lib/tow-rules";

export default function SendStepPage() {
  return <JobScreen>{(ctx) => <SendEstimate {...ctx} />}</JobScreen>;
}

function SendEstimate({ app, job, type }: JobContext) {
  const router = useRouter();
  const estimate = currentEstimate(job);

  if (!estimate) {
    return (
      <PageShell>
        <StepHeader job={job} type={type} title="Give customer the estimate" />
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

  return (
    <PageShell>
      <div className="no-print">
        <StepHeader job={job} type={type} title="Give customer the estimate" subtitle="This is exactly what the customer receives. They keep a copy." />
      </div>
      <div className="space-y-4">
        <EstimateDocument company={app.company} estimate={estimate} jobNumber={job.number} />
        <SendPanel
          kind="estimate"
          path={`/e/${estimate.token}`}
          customer={estimate.customer}
          deliveries={estimate.deliveries}
          onDelivered={(via, to) => attempt(() => mutateJob(job.id, (j, actor) => recordDelivery(j, actor, "estimate", via, to)))}
          onShowOnDevice={() => router.push(`/e/${estimate.token}`)}
        />
        {estimate.deliveries.length > 0 ? (
          <div className="no-print">
            <LinkButton href={jobHref(job, "consent")} size="lg" full replace>
              Continue to consent →
            </LinkButton>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
