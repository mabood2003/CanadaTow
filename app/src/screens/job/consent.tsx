"use client";

import { useSearchParams } from "next/navigation";

import { ConsentCapture } from "@/components/consent-capture";
import { JobScreen, StepHeader, type JobContext } from "@/components/job-screen";
import { ConsentRecord } from "@/components/records";
import { Banner, LinkButton, PageShell } from "@/components/ui";
import type { ConsentMethod } from "@/lib/domain";
import { CONSENT_METHODS } from "@/lib/domain";
import { consentContext, renderConsent } from "@/lib/describe";
import { recordConsent } from "@/lib/jobs";
import { jobHref } from "@/lib/job-steps";
import { formatMoney } from "@/lib/money";
import { activeConsentTemplate, attempt, mutateJob } from "@/lib/store";
import { currentEstimate, estimateConsent } from "@/lib/tow-rules";

export default function ConsentStepPage() {
  return <JobScreen>{(ctx) => <ConsentStep {...ctx} />}</JobScreen>;
}

function ConsentStep({ app, job }: JobContext) {
  const estimate = currentEstimate(job);
  const consent = estimateConsent(job);
  // e.g. ?method=paper_photo from the dead-phone fallback.
  const requested = useSearchParams().get("method");
  const initialMethod = CONSENT_METHODS.includes(requested as ConsentMethod) ? (requested as ConsentMethod) : undefined;

  let body;
  if (!estimate || estimate.deliveries.length === 0) {
    body = (
      <>
        <Banner tone="bad" title="Do not begin tow — consent missing.">
          {estimate ? "Give the customer their copy of the estimate first." : "Build and issue the estimate first."}
        </Banner>
        <LinkButton href={jobHref(job, estimate ? "send" : "estimate")} full replace>
          {estimate ? "Estimate delivery" : "Go to estimate"}
        </LinkButton>
      </>
    );
  } else if (consent) {
    body = (
      <>
        <ConsentRecord consent={consent} jobNumber={job.number} />
        <LinkButton href={jobHref(job, "tow")} size="lg" full replace trailing="arrowRight">
          Continue
        </LinkButton>
      </>
    );
  } else {
    const template = activeConsentTemplate(app);
    body = (
      <>
        <p className="text-sm text-muted">
          Estimate #{job.number}
          {estimate.version > 1 ? ` v${estimate.version}` : ""} · <strong className="text-ink">{formatMoney(estimate.totalCents)}</strong> · to {estimate.destination}
        </p>
        <ConsentCapture
          purpose="estimate"
          initialName={job.customer.name}
          initialRelationship={job.customer.relationship}
          present={job.customer.present}
          amountCents={estimate.totalCents}
          enabled={app.consentMethods}
          linkPath={`/e/${estimate.token}`}
          initialMethod={initialMethod}
          companyName={app.company.name}
          render={(name, relationship) => renderConsent(template, consentContext(app.company.name, job, estimate, { name, relationship }))}
          onRecord={(input) =>
            attempt(() => {
              mutateJob(job.id, (j, actor) => recordConsent(j, actor, input));
              window.scrollTo({ top: 0 });
            })
          }
        />
      </>
    );
  }

  return (
    <PageShell>
      <StepHeader job={job} step="consent" title={consent ? "Consent evidence" : "Authorization / consent"} />
      <div className="space-y-4">{body}</div>
    </PageShell>
  );
}
