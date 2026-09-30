"use client";

import { useRouter } from "next/navigation";

import { ConsentCapture } from "@/components/consent-capture";
import { JobScreen, StepHeader, type JobContext } from "@/components/job-screen";
import { ConsentRecord } from "@/components/records";
import { Banner, LinkButton, PageShell } from "@/components/ui";
import { recordConsent } from "@/lib/jobs";
import { jobHref } from "@/lib/job-steps";
import { formatMoney } from "@/lib/money";
import { attempt, mutateJob } from "@/lib/store";
import { currentEstimate, estimateConsent } from "@/lib/tow-rules";

export default function ConsentStepPage() {
  return <JobScreen>{(ctx) => <ConsentStep {...ctx} />}</JobScreen>;
}

function ConsentStep({ job, type }: JobContext) {
  const router = useRouter();
  const estimate = currentEstimate(job);
  const consent = estimateConsent(job);

  let body;
  if (!estimate || estimate.deliveries.length === 0) {
    body = (
      <>
        <Banner tone="bad" title="Do not begin tow — consent missing.">
          {estimate ? "Give the customer their copy of the estimate first." : "Build and issue the estimate first."}
        </Banner>
        <LinkButton href={jobHref(job, estimate ? "send" : "estimate")} full replace>
          {estimate ? "Give customer the estimate" : "Go to estimate"}
        </LinkButton>
      </>
    );
  } else if (consent) {
    body = (
      <>
        <Banner tone="good" title="Consent captured ✓" />
        <ConsentRecord consent={consent} />
        <LinkButton href={jobHref(job, "tow")} size="lg" full replace>
          Continue to tow →
        </LinkButton>
      </>
    );
  } else {
    const vehicle = [job.vehicle.plate, job.vehicle.make, job.vehicle.model].filter(Boolean).join(" ") || "this vehicle";
    body = (
      <>
        <p className="text-sm text-slate-600">
          Estimate v{estimate.version} · <strong>{formatMoney(estimate.totalCents)}</strong> · to {estimate.destination}
        </p>
        <ConsentCapture
          purpose="estimate"
          initialName={job.customer.name}
          initialRelationship={job.customer.relationship}
          present={job.customer.present}
          amountCents={estimate.totalCents}
          vehicle={vehicle}
          allowLink
          linkPath={`/e/${estimate.token}`}
          onRecord={(input) =>
            attempt(() => {
              const updated = mutateJob(job.id, (j, actor) => recordConsent(j, actor, input));
              router.replace(jobHref(updated, "tow"));
            })
          }
        />
      </>
    );
  }

  return (
    <PageShell>
      <StepHeader job={job} type={type} title="Consent" />
      <div className="space-y-4">{body}</div>
    </PageShell>
  );
}
