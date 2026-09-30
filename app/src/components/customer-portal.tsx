"use client";

import Link from "next/link";
import { useState } from "react";

import { CompanyConsentBlock, EstimateDocument, InvoiceDocument } from "@/components/documents";
import { Icon } from "@/components/icons";
import { Banner, BrandMark, Button, CompanyMark, ErrorText, Field, inputClass, Loading } from "@/components/ui";
import { baseForRole } from "@/lib/app-base";
import type { Actor, Estimate, Invoice, Job } from "@/lib/domain";
import { consentContext, renderConsent } from "@/lib/describe";
import { GuardrailError, recordConsent, recordDelivery } from "@/lib/jobs";
import { jobHref } from "@/lib/job-steps";
import type { AppState } from "@/lib/seed";
import { activeConsentTemplate, attempt, findJobByEstimateToken, findJobByInvoiceToken, mutateJob, useAppState } from "@/lib/store";
import { formatWhen } from "@/lib/time";
import { currentInvoice, estimateConsent } from "@/lib/tow-rules";

// Customer-facing: no login, no app. In the pilot prototype, links only resolve on the device that created the job.
export function CustomerPortal({ kind, token }: { kind: "estimate" | "invoice"; token: string }) {
  const app = useAppState();
  if (!app) return <Loading />;

  const byEstimate = kind === "estimate" ? findJobByEstimateToken(app, token) : null;
  const byInvoice = kind === "invoice" ? findJobByInvoiceToken(app, token) : null;
  const job = byEstimate?.job ?? byInvoice?.job;
  if (!job) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <Banner tone="warn" title={`${kind === "estimate" ? "Estimate" : "Invoice"} not found`}>
          This link isn&apos;t available on this device. Please ask your tow operator to show it to you on their device.
        </Banner>
      </main>
    );
  }
  return <Portal app={app} job={job} estimate={byEstimate?.estimate ?? job.estimates.at(-1)} invoice={byInvoice?.invoice ?? currentInvoice(job)} initialTab={kind} />;
}

function Portal({ app, job, estimate, invoice, initialTab }: { app: AppState; job: Job; estimate?: Estimate; invoice?: Invoice; initialTab: "estimate" | "invoice" }) {
  const [tab, setTab] = useState<"estimate" | "invoice">(initialTab === "invoice" || !estimate ? "invoice" : "estimate");
  const tel = app.company.phone.replace(/[^\d+]/g, "");

  return (
    <div className="min-h-full bg-cream">
      <header className="bg-forest text-white">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-4">
          <CompanyMark company={app.company} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-extrabold tracking-tight">{app.company.name}</p>
            <p className="text-xs text-[#b6c6bb]">Job #{job.number}</p>
          </div>
          <a href={`tel:${tel}`} className="no-print inline-flex min-h-10 items-center gap-1.5 rounded-md bg-white/10 px-3 text-sm font-semibold hover:bg-white/20">
            Call
          </a>
        </div>
        {estimate && invoice ? (
          <nav className="no-print mx-auto flex max-w-md gap-1 px-4" aria-label="Documents">
            {(["estimate", "invoice"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`min-h-11 flex-1 rounded-t-md text-sm font-semibold transition ${tab === t ? "bg-cream text-forest" : "text-[#c7d3cb] hover:text-white"}`}
              >
                {t === "estimate" ? "Estimate" : "Invoice"}
              </button>
            ))}
          </nav>
        ) : null}
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 pb-16 pt-5">
        {tab === "estimate" && estimate ? <EstimateTab app={app} job={job} estimate={estimate} invoice={invoice} onViewInvoice={() => setTab("invoice")} /> : null}
        {tab === "invoice" && invoice ? <InvoiceTab app={app} job={job} invoice={invoice} /> : null}

        <footer className="no-print space-y-3 pt-4 text-center">
          <p className="flex items-center justify-center gap-2 text-xs text-muted">
            <BrandMark small /> Sent with TowLedger · no app or account needed
          </p>
          <Link href={jobHref(job, undefined, baseForRole(app.team.find((m) => m.name === job.driverName)?.role))} className="inline-block text-xs text-subtle underline">
            Driver: return to job #{job.number}
          </Link>
        </footer>
      </main>
    </div>
  );
}

function EstimateTab({ app, job, estimate, invoice, onViewInvoice }: { app: AppState; job: Job; estimate: Estimate; invoice?: Invoice; onViewInvoice: () => void }) {
  const consent = estimateConsent(job, estimate);
  const [name, setName] = useState(estimate.customer.name);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsConsent = Boolean(job.workflow?.requireConsent);
  const template = activeConsentTemplate(app);
  const rendered = renderConsent(template, consentContext(app.company.name, job, estimate, { name }));

  const accept = () => {
    const actor: Partial<Actor> = { by: name.trim() || "Customer", role: "customer", device: "Customer link" };
    setError(
      attempt(() => {
        mutateJob(
          job.id,
          (j, a) =>
            recordConsent(j, a, {
              purpose: "estimate",
              name,
              relationship: j.customer.relationship,
              present: j.customer.present,
              method: "link",
              driverConfirmed: false,
              templateVersion: rendered.templateVersion,
              heading: rendered.heading,
              wording: rendered.wording,
            }),
          actor,
        );
      }),
    );
  };

  return (
    <>
      {estimate.supersededAt ? (
        <Banner tone="bad" title="This estimate has been replaced">
          A newer estimate was issued {formatWhen(estimate.supersededAt)}. Please ask your tow operator for the latest version.
        </Banner>
      ) : null}
      {invoice ? (
        <button type="button" onClick={onViewInvoice} className="no-print flex w-full items-center justify-between rounded-md border border-pine/30 bg-mint p-3 text-left text-sm font-semibold text-forest">
          <span className="flex items-center gap-2">
            <Icon name="receipt" className="h-4 w-4" /> Your invoice {invoice.number} is ready
          </span>
          <Icon name="arrowRight" className="h-4 w-4" />
        </button>
      ) : null}

      <EstimateDocument company={app.company} estimate={estimate} jobNumber={job.number} />

      {needsConsent && !estimate.supersededAt ? (
        consent ? (
          <div className="rounded-lg border-2 border-forest bg-white p-5">
            <p className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-forest text-signal">
                <Icon name="check" className="h-4 w-4" strokeWidth={3} />
              </span>
              Thank you — your response is recorded
            </p>
            <p className="mt-2 text-sm text-muted">
              {consent.name} · {formatWhen(consent.at)}. Keep this page or a copy of the estimate for your records.
            </p>
          </div>
        ) : (
          <CompanyConsentBlock heading={rendered.heading} wording={rendered.wording} version={rendered.templateVersion}>
            <div className="no-print space-y-3">
              <Field label="Your full name">
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
              <ErrorText message={error} />
              <Button size="lg" full onClick={accept} disabled={!name.trim()} icon="check">
                {rendered.acceptLabel}
              </Button>
              <Button full variant="secondary" onClick={() => setAsking((a) => !a)}>
                I have a question
              </Button>
              {asking ? (
                <Banner tone="info" title="Ask before you decide">
                  Talk to your driver, or call {app.company.name} at{" "}
                  <a className="font-semibold underline" href={`tel:${app.company.phone.replace(/[^\d+]/g, "")}`}>
                    {app.company.phone}
                  </a>
                  .
                </Banner>
              ) : null}
            </div>
          </CompanyConsentBlock>
        )
      ) : null}

      <Button full variant="secondary" icon="download" className="no-print" onClick={() => window.print()}>
        Save or print a copy
      </Button>
    </>
  );
}

function InvoiceTab({ app, job, invoice }: { app: AppState; job: Job; invoice: Invoice }) {
  const [email, setEmail] = useState(invoice.customer.email);
  const [emailing, setEmailing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emailCopy = () => {
    const failure = attempt(() => {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new GuardrailError("Enter a valid email address.");
      mutateJob(job.id, (j, a) => recordDelivery(j, a, "invoice", "email", email.trim()), { by: invoice.customer.name || "Customer", role: "customer", device: "Customer link" });
    });
    setError(failure);
    if (!failure) {
      setNotice(`A copy was sent to ${email.trim()} (simulated in this prototype).`);
      setEmailing(false);
    }
  };

  return (
    <>
      {invoice.supersededAt ? (
        <Banner tone="bad" title="This invoice was corrected">
          A corrected invoice was issued {formatWhen(invoice.supersededAt)}. Please ask your tow operator for the latest version.
        </Banner>
      ) : null}
      <InvoiceDocument company={app.company} invoice={invoice} jobNumber={job.number} />
      <div className="no-print grid grid-cols-2 gap-2">
        <Button icon="download" onClick={() => window.print()}>
          Download PDF
        </Button>
        <Button variant="secondary" icon="mail" onClick={() => setEmailing((e) => !e)}>
          Email copy
        </Button>
      </div>
      {emailing ? (
        <div className="no-print space-y-2 rounded-md border border-line bg-paper p-3">
          <Field label="Email address">
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <ErrorText message={error} />
          <Button full onClick={emailCopy}>
            Send copy
          </Button>
        </div>
      ) : null}
      {notice ? <Banner tone="good">{notice}</Banner> : null}
      <p className="no-print text-center text-xs text-muted">“Download PDF” opens your device&apos;s print screen — choose “Save as PDF”. No payment is taken here.</p>
    </>
  );
}
