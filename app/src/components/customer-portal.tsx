"use client";

import Link from "next/link";
import { useState } from "react";

import { CompanyConsentBlock, EstimateDocument, InvoiceDocument } from "@/components/documents";
import { Icon } from "@/components/icons";
import { Banner, BrandMark, Button, CompanyMark, ErrorText, Field, inputClass, Loading } from "@/components/ui";
import { baseForRole } from "@/lib/app-base";
import { customerStatus, placeName } from "@/lib/customer-status";
import type { Actor, Estimate, Invoice, Job } from "@/lib/domain";
import { consentContext, renderConsent, vehicleName } from "@/lib/describe";
import { GuardrailError, recordConsent, recordDelivery } from "@/lib/jobs";
import { jobHref } from "@/lib/job-steps";
import { formatMoney } from "@/lib/money";
import type { AppState } from "@/lib/seed";
import { activeConsentTemplate, attempt, findJobByEstimateToken, findJobByInvoiceToken, findJobByPublicToken, mutateJob, useAppState } from "@/lib/store";
import { formatWhen } from "@/lib/time";
import { currentInvoice, estimateConsent } from "@/lib/tow-rules";

type Tab = "status" | "estimate" | "invoice";

const NOT_FOUND: Record<Tab, string> = { status: "Tow", estimate: "Estimate", invoice: "Invoice" };

// Customer-facing: no login, no app. One link per job shows the tow's status plus the estimate and invoice.
// In the pilot prototype, links only resolve on the device that holds the job.
export function CustomerPortal({ kind, token }: { kind: Tab; token: string }) {
  const app = useAppState();
  if (!app) return <Loading />;

  const byEstimate = kind === "estimate" ? findJobByEstimateToken(app, token) : null;
  const byInvoice = kind === "invoice" ? findJobByInvoiceToken(app, token) : null;
  const job = byEstimate?.job ?? byInvoice?.job ?? (kind === "status" ? findJobByPublicToken(app, token) : null);
  if (!job) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <Banner tone="warn" title={`${NOT_FOUND[kind]} not found`}>
          This link isn&apos;t available on this device. Please ask your tow operator to show it to you on their device.
        </Banner>
      </main>
    );
  }
  return <Portal app={app} job={job} estimate={byEstimate?.estimate ?? job.estimates.at(-1)} invoice={byInvoice?.invoice ?? currentInvoice(job)} initialTab={kind} />;
}

function Portal({ app, job, estimate, invoice, initialTab }: { app: AppState; job: Job; estimate?: Estimate; invoice?: Invoice; initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab === "estimate" && !estimate ? "status" : initialTab === "invoice" && !invoice ? "status" : initialTab);
  const tel = app.company.phone.replace(/[^\d+]/g, "");
  const tabs: Tab[] = ["status", ...(estimate ? (["estimate"] as const) : []), ...(invoice ? (["invoice"] as const) : [])];

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
        {tabs.length > 1 ? (
          <nav className="no-print mx-auto flex max-w-md gap-1 px-4" aria-label="Your tow">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
                className={`min-h-11 flex-1 rounded-t-md text-sm font-semibold transition ${tab === t ? "bg-cream text-forest" : "text-[#c7d3cb] hover:text-white"}`}
              >
                {t === "status" ? "Status" : t === "estimate" ? "Estimate" : "Invoice"}
              </button>
            ))}
          </nav>
        ) : null}
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 pb-16 pt-5">
        {tab === "status" ? <StatusTab app={app} job={job} estimate={estimate} invoice={invoice} onOpen={setTab} /> : null}
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

/** Where the vehicle is and every step of the tow so far, with the estimate and invoice one tap away. */
function StatusTab({ app, job, estimate, invoice, onOpen }: { app: AppState; job: Job; estimate?: Estimate; invoice?: Invoice; onOpen: (tab: Tab) => void }) {
  const status = customerStatus(job);
  const yard = app.yards.find((y) => job.destination.startsWith(y.name));
  const paidCents = invoice ? job.payments.filter((p) => p.invoiceNumber === invoice.number).reduce((sum, p) => sum + p.amountCents, 0) : 0;

  return (
    <>
      <section className="rounded-lg bg-forest p-5 text-white shadow-[0_4px_0_#0e291c]" aria-live="polite">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-signal">Your tow · Job #{job.number}</p>
        <h1 className="mt-2 text-[26px] font-extrabold leading-tight tracking-[-0.04em]">{status.headline}</h1>
        {job.vehicle.make || job.vehicle.plate ? (
          <p className="mt-1 text-sm text-[#c7d3cb]">{[vehicleName(job.vehicle), job.vehicle.plate].filter(Boolean).join(" · ")}</p>
        ) : null}
        <div className="mt-4 flex items-start gap-2.5 rounded-md bg-white/10 p-3 text-sm">
          <Icon name="mapPin" className="mt-0.5 h-4 w-4 text-signal" />
          <span>
            <span className="block text-xs text-[#b6c6bb]">Your vehicle right now</span>
            <span className="font-semibold">{status.vehicleAt}</span>
            {job.tow.delivered && yard ? <span className="mt-1 block text-xs text-[#c7d3cb]">Yard hours: {yard.hours}</span> : null}
          </span>
        </div>
      </section>

      {status.awaitingApproval ? (
        <Button size="lg" full icon="check" onClick={() => onOpen("estimate")}>
          Review and approve the estimate
        </Button>
      ) : null}

      <section className="rounded-lg border border-line bg-white p-5">
        <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Tow progress</h2>
        <ol className="mt-4">
          {status.steps.map((step, i) => (
            <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
              {i < status.steps.length - 1 ? <span aria-hidden className={`absolute left-[11px] top-6 h-full w-0.5 ${step.state === "done" ? "bg-pine" : "bg-line"}`} /> : null}
              <span
                aria-hidden
                className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                  step.state === "done" ? "bg-forest text-signal" : step.state === "current" ? "bg-signal ring-4 ring-signal/40" : "border-2 border-line bg-white"
                }`}
              >
                {step.state === "done" ? <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} /> : null}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-[15px] font-semibold leading-snug ${step.state === "upcoming" ? "text-subtle" : "text-ink"}`}>
                  {step.title}
                  {step.state === "current" ? <span className="ml-2 rounded-full bg-signal/60 px-2 py-0.5 text-[11px] font-bold text-forest">Next</span> : null}
                </p>
                {step.at ? <p className="text-xs text-muted">{formatWhen(step.at)}</p> : null}
                {step.detail ? <p className="mt-0.5 text-sm text-muted">{step.detail}</p> : null}
                {step.document && step.state !== "upcoming" ? (
                  <button type="button" onClick={() => onOpen(step.document!)} className="mt-1 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-pine">
                    View {step.document} <Icon name="arrowRight" className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {estimate || invoice ? (
        <section className="grid gap-2">
          {estimate ? (
            <button type="button" onClick={() => onOpen("estimate")} className="flex items-center gap-3 rounded-lg border border-line bg-paper p-4 text-left hover:border-pine/50">
              <Icon name="fileText" className="h-6 w-6 text-pine" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Estimate{job.estimates.length > 1 ? ` (version ${estimate.version})` : ""}</span>
                <span className="block text-xs text-muted">
                  {formatMoney(estimate.totalCents)} · to {placeName(estimate.destination)}
                </span>
              </span>
              <Icon name="chevronRight" className="h-5 w-5 text-subtle" />
            </button>
          ) : null}
          {invoice ? (
            <button type="button" onClick={() => onOpen("invoice")} className="flex items-center gap-3 rounded-lg border border-line bg-paper p-4 text-left hover:border-pine/50">
              <Icon name="receipt" className="h-6 w-6 text-pine" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Invoice {invoice.number}</span>
                <span className="block text-xs text-muted">
                  {formatMoney(invoice.totalCents)} · {paidCents >= invoice.totalCents ? "Paid" : `Balance ${formatMoney(invoice.totalCents - paidCents)}`}
                </span>
              </span>
              <Icon name="chevronRight" className="h-5 w-5 text-subtle" />
            </button>
          ) : null}
        </section>
      ) : null}

      <p className="text-center text-xs text-muted">
        This page updates as your tow progresses. Questions? Call {app.company.name} at {app.company.phone}.
      </p>
    </>
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
