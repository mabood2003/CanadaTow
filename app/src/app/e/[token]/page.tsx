"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { EstimateDocument } from "@/components/documents";
import { Banner, Button, Checkbox, ErrorText, Field, inputClass, Loading, PageShell } from "@/components/ui";
import { recordConsent } from "@/lib/jobs";
import { jobHref } from "@/lib/job-steps";
import { attempt, findJobByEstimateToken, mutateJob, useAppState } from "@/lib/store";
import { formatDateTime } from "@/lib/time";

// Customer-facing: no login, no app chrome. In the pilot prototype, links only resolve on the device that created the job.
export default function CustomerEstimatePage() {
  const { token } = useParams<{ token: string }>();
  const app = useAppState();
  const [mode, setMode] = useState<"idle" | "consent" | "question">("idle");
  const [name, setName] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!app) return <Loading />;
  const found = findJobByEstimateToken(app, token);
  if (!found) {
    return (
      <PageShell>
        <Banner tone="warn" title="Estimate not found">
          This link isn&apos;t available on this device. Please ask your tow operator to show you the estimate on their device.
        </Banner>
      </PageShell>
    );
  }

  const { job, estimate } = found;
  const consent = job.consents.find((c) => c.purpose === "estimate" && c.estimateVersion === estimate.version);
  const signerName = name ?? estimate.customer.name;

  const confirm = () => {
    setError(
      attempt(() => {
        mutateJob(
          job.id,
          (j, actor) =>
            recordConsent(j, actor, {
              purpose: "estimate",
              name: signerName,
              relationship: j.customer.relationship,
              present: j.customer.present,
              method: "link",
              driverConfirmed: false,
            }),
          { by: signerName.trim() || "Customer", device: "Customer link" },
        );
        setMode("idle");
      }),
    );
  };

  return (
    <PageShell>
      <div className="space-y-4">
        {estimate.supersededAt ? (
          <Banner tone="bad" title="This estimate has been replaced">
            A newer estimate was issued on {formatDateTime(estimate.supersededAt)}. Please ask your tow operator for the latest version.
          </Banner>
        ) : null}

        <EstimateDocument company={app.company} estimate={estimate} jobNumber={job.number} />

        <div className="no-print space-y-3">
          {consent ? (
            <Banner tone="good" title="Consent received — thank you">
              {consent.name} consented on {formatDateTime(consent.at)}. Keep this page or a copy of the estimate for your records.
            </Banner>
          ) : !estimate.supersededAt ? (
            mode === "consent" ? (
              <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <Field label="Your full name">
                  <input className={inputClass} value={signerName} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                </Field>
                <Checkbox checked={agreed} onChange={setAgreed}>
                  I have read this estimate and I consent to {app.company.name} towing my vehicle to <strong>{estimate.destination}</strong>.
                </Checkbox>
                <ErrorText message={error} />
                <Button size="lg" full variant="success" disabled={!agreed || !signerName.trim()} onClick={confirm}>
                  Confirm consent
                </Button>
                <Button full variant="secondary" onClick={() => setMode("idle")}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button size="lg" variant="success" onClick={() => setMode("consent")}>
                  I consent
                </Button>
                <Button size="lg" variant="secondary" onClick={() => setMode("question")}>
                  I have a question
                </Button>
              </div>
            )
          ) : null}

          {mode === "question" ? (
            <Banner tone="info" title="Ask before you decide">
              Talk to your driver, or call {app.company.name} at{" "}
              <a className="font-semibold underline" href={`tel:${app.company.phone.replace(/[^\d+]/g, "")}`}>
                {app.company.phone}
              </a>
              .
            </Banner>
          ) : null}

          <Button full variant="secondary" onClick={() => window.print()}>
            Print or save a copy
          </Button>

          <p className="pt-4 text-center text-xs text-slate-400">
            <Link href={jobHref(job)} className="underline">
              Driver: return to job {job.number}
            </Link>
          </p>
        </div>
      </div>
    </PageShell>
  );
}
