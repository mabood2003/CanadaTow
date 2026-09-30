"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/icons";
import { JobScreen, StepHeader, type JobContext } from "@/components/job-screen";
import { LineItemEditor, sameItems, Totals } from "@/components/line-items";
import { Banner, Button, ErrorText, LinkButton, PageShell } from "@/components/ui";
import { defaultEstimateItems, issueEstimate, saveEstimateDraft } from "@/lib/jobs";
import { jobHref } from "@/lib/job-steps";
import { formatMoney } from "@/lib/money";
import { attempt, mutateJob, rateCardFor } from "@/lib/store";
import { formatDateTime } from "@/lib/time";
import { currentEstimate, estimateConsent } from "@/lib/tow-rules";

export default function EstimateStepPage() {
  return <JobScreen>{(ctx) => <EstimateBuilder {...ctx} />}</JobScreen>;
}

function EstimateBuilder({ app, job }: JobContext) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const rateCard = rateCardFor(app, job.workflow);
  const issued = currentEstimate(job);
  const consent = estimateConsent(job);
  const towStarted = Boolean(job.tow.secured);
  const changed = issued ? !sameItems(job.estimateDraft, issued.items) || issued.destination !== job.destination : true;

  const onChange = (items: typeof job.estimateDraft) => {
    setError(attempt(() => mutateJob(job.id, (j) => saveEstimateDraft(j, items))));
  };

  const issue = () => {
    const failure = attempt(() => {
      mutateJob(job.id, (j, actor, current) =>
        issueEstimate(j, actor, { storagePerDayCents: rateCard.storagePerDayCents, rateCardName: rateCard.name, notes: current.documentTemplates.estimateNotes }),
      );
      router.replace(jobHref(job, "send"));
    });
    setError(failure);
  };

  const km = job.estimateDraft.find((i) => i.id === "km")?.quantity;

  return (
    <PageShell>
      <StepHeader job={job} step="estimate" title="Estimate builder" />
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-paper px-3 py-2.5 text-sm">
          <span className="flex items-center gap-2">
            <Icon name="receipt" className="h-4 w-4 text-pine" />
            <span>
              {app.company.name} · <strong>{rateCard.name}</strong>
            </span>
          </span>
          {!towStarted ? (
            <button type="button" className="shrink-0 text-xs font-semibold text-pine underline" onClick={() => onChange(defaultEstimateItems(rateCard, km))}>
              Reset
            </button>
          ) : null}
        </div>

        {issued ? (
          <Banner tone={changed ? "warn" : "good"} title={`Estimate #${job.number} v${issued.version} issued ${formatDateTime(issued.issuedAt)} · ${formatMoney(issued.totalCents)}`}>
            {towStarted
              ? "The tow has started — changes to the final amount are handled on the invoice."
              : changed
                ? "You've changed the estimate. Issuing it creates a new version, and the customer needs the new copy and a new consent record."
                : consent
                  ? `Consent recorded from ${consent.name}.`
                  : "Issued estimates can't be edited — changing anything creates a new version."}
          </Banner>
        ) : (
          <p className="text-sm text-muted">Built from your company&apos;s configured rates. Adjust the kilometres, add or remove charges.</p>
        )}

        <LineItemEditor items={job.estimateDraft} onChange={onChange} disabled={towStarted} />
        <p className="text-sm text-muted">
          Storage if needed: <strong className="text-ink">{formatMoney(rateCard.storagePerDayCents)}/day</strong> — always shown to the customer on the estimate.
        </p>
        <Totals items={job.estimateDraft} />

        <ErrorText message={error} />

        {towStarted ? null : !issued ? (
          <Button size="lg" full onClick={issue} icon="fileCheck">
            Preview and send estimate
          </Button>
        ) : changed ? (
          <div className="space-y-2">
            <Button size="lg" full onClick={issue}>
              Issue revised estimate (v{issued.version + 1})
            </Button>
            <Button full variant="secondary" onClick={() => onChange(issued.items.map((i) => ({ ...i })))}>
              Undo changes
            </Button>
          </div>
        ) : (
          <LinkButton href={jobHref(job, "send")} size="lg" full replace trailing="arrowRight">
            Estimate delivery
          </LinkButton>
        )}
      </div>
    </PageShell>
  );
}
