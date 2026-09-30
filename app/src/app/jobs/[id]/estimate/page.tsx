"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { JobScreen, StepHeader, type JobContext } from "@/components/job-screen";
import { LineItemEditor, sameItems, Totals } from "@/components/line-items";
import { Banner, Button, ErrorText, LinkButton, PageShell } from "@/components/ui";
import { issueEstimate, saveEstimateDraft } from "@/lib/jobs";
import { jobHref } from "@/lib/job-steps";
import { formatMoney } from "@/lib/money";
import { attempt, mutateJob } from "@/lib/store";
import { formatDateTime } from "@/lib/time";
import { currentEstimate, estimateConsent } from "@/lib/tow-rules";

export default function EstimateStepPage() {
  return <JobScreen>{(ctx) => <EstimateBuilder {...ctx} />}</JobScreen>;
}

function EstimateBuilder({ app, job, type }: JobContext) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const issued = currentEstimate(job);
  const consent = estimateConsent(job);
  const towStarted = Boolean(job.tow.secured);
  const changed = issued ? !sameItems(job.estimateDraft, issued.items) || issued.destination !== job.destination : true;

  const onChange = (items: typeof job.estimateDraft) => {
    setError(attempt(() => mutateJob(job.id, (j) => saveEstimateDraft(j, items))));
  };

  const issue = () => {
    const failure = attempt(() => {
      const updated = mutateJob(job.id, (j, actor, current) => issueEstimate(j, actor, current.rateCard.storagePerDayCents));
      router.replace(jobHref(updated, "send"));
    });
    setError(failure);
  };

  const discardChanges = () => {
    if (issued) onChange(issued.items.map((i) => ({ ...i })));
  };

  return (
    <PageShell>
      <StepHeader job={job} type={type} title="Estimate" />
      <div className="space-y-4">
        {issued ? (
          <Banner tone={changed ? "warn" : "good"} title={`Estimate v${issued.version} issued ${formatDateTime(issued.issuedAt)} · ${formatMoney(issued.totalCents)}`}>
            {towStarted
              ? "The tow has started — changes to the final amount are handled on the invoice."
              : changed
                ? "You've changed the estimate. Issuing it creates a new version, and the customer must see it and consent again."
                : consent
                  ? `Consented by ${consent.name}.`
                  : "Issued estimates can't be edited — changing anything creates a new version."}
          </Banner>
        ) : (
          <p className="text-sm text-slate-600">
            Built from your rate card. Adjust the kilometres and storage days, add or remove charges.
          </p>
        )}

        <LineItemEditor items={job.estimateDraft} onChange={onChange} disabled={towStarted} />
        <p className="text-sm text-slate-600">
          Storage after today: <strong>{formatMoney(app.rateCard.storagePerDayCents)} per day</strong> — shown to the customer on the estimate.
        </p>
        <Totals items={job.estimateDraft} />

        <ErrorText message={error} />

        {towStarted ? null : !issued ? (
          <Button size="lg" full onClick={issue}>
            Issue estimate
          </Button>
        ) : changed ? (
          <div className="space-y-2">
            <Button size="lg" full variant="danger" onClick={issue}>
              Issue revised estimate (v{issued.version + 1})
            </Button>
            <Button full variant="secondary" onClick={discardChanges}>
              Undo changes
            </Button>
          </div>
        ) : (
          <LinkButton href={jobHref(job, "send")} size="lg" full replace>
            Give customer the estimate →
          </LinkButton>
        )}
      </div>
    </PageShell>
  );
}
