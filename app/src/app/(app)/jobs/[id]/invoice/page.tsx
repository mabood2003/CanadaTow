"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ConsentCapture } from "@/components/consent-capture";
import { InvoiceDocument } from "@/components/documents";
import { Icon } from "@/components/icons";
import { JobScreen, StepHeader, type JobContext } from "@/components/job-screen";
import { LineItemEditor, Totals } from "@/components/line-items";
import { SendPanel } from "@/components/send-panel";
import { Banner, Button, Card, DataList, ErrorText, Field, inputClass, LinkButton, PageShell, SectionTitle } from "@/components/ui";
import { TOW_EVENT_LABELS, TOW_EVENTS } from "@/lib/domain";
import { consentContext, renderConsent, vehicleLine } from "@/lib/describe";
import { GuardrailError, invoiceNumberFor, issueInvoice, recordConsent, recordDelivery, recordPayment, saveInvoiceDraft, startInvoiceDraft } from "@/lib/jobs";
import { jobHref } from "@/lib/job-steps";
import { formatMoney, parseDollars, totals } from "@/lib/money";
import { activeConsentTemplate, attempt, mutateJob } from "@/lib/store";
import { formatTime, formatWhen } from "@/lib/time";
import { agreedAmountCents, canRecordPayment, currentEstimate, currentInvoice, DIFFERENCE_WARNING, differsFromEstimate } from "@/lib/tow-rules";

const PAYMENT_METHODS = ["Debit", "Credit card", "Cash", "E-transfer", "Motor club / insurer account", "Other"];

export default function InvoiceStepPage() {
  return <JobScreen>{(ctx) => <InvoiceStep {...ctx} />}</JobScreen>;
}

function InvoiceStep(ctx: JobContext) {
  const { job } = ctx;
  const invoice = currentInvoice(job);
  const delivered = Boolean(job.tow.delivered);
  const needsDraft = delivered && !invoice && job.invoiceDraft === null;

  // Auto-fill the first invoice from the estimate (or the rate card when the workflow has no estimate).
  useEffect(() => {
    if (needsDraft) attempt(() => mutateJob(job.id, (j) => startInvoiceDraft(j)));
  }, [needsDraft, job.id]);

  let body;
  if (!delivered) {
    body = (
      <>
        <Banner tone="neutral" title="Invoice comes after delivery">
          Record “Delivered” on the tow screen, then build the invoice here. Payment can only be recorded after the invoice is issued.
        </Banner>
        <LinkButton href={jobHref(job, "tow")} full replace>
          Go to tow
        </LinkButton>
      </>
    );
  } else if (job.invoiceDraft) {
    body = <InvoiceBuilder {...ctx} />;
  } else if (invoice) {
    body = <IssuedInvoice {...ctx} />;
  } else {
    body = <p className="text-sm text-muted">Preparing invoice…</p>;
  }

  return (
    <PageShell>
      <div className="no-print">
        <StepHeader job={job} step="invoice" title={invoice && !job.invoiceDraft ? "Invoice issued" : "Invoice builder"} />
      </div>
      <div className="space-y-4">{body}</div>
    </PageShell>
  );
}

function InvoiceBuilder({ app, job }: JobContext) {
  const [error, setError] = useState<string | null>(null);
  const [reauthorize, setReauthorize] = useState(false);
  const items = job.invoiceDraft ?? [];
  const draftTotal = totals(items).totalCents;
  const agreed = agreedAmountCents(job);
  const differs = differsFromEstimate(job, draftTotal);
  const correcting = currentInvoice(job);
  const estimate = currentEstimate(job);
  const template = activeConsentTemplate(app);

  const issue = () => {
    const failure = attempt(() => mutateJob(job.id, (j, actor, current) => issueInvoice(j, actor, current.documentTemplates.invoiceNotes)));
    setError(failure);
    if (!failure) window.scrollTo({ top: 0 });
  };

  return (
    <>
      {correcting ? (
        <Banner tone="warn" title={`Correcting ${correcting.number}`}>
          The original invoice stays on file. Issuing creates a corrected version.
        </Banner>
      ) : null}

      <Card>
        <SectionTitle right={<span className="font-mono text-xs font-bold text-pine">{correcting ? `${invoiceNumberFor(job)}-R${correcting.version}` : invoiceNumberFor(job)}</span>}>Pre-filled from this job</SectionTitle>
        <DataList
          rows={[
            ["Billed to", job.customer.name ? `${job.customer.name}${job.customer.mobile ? ` · ${job.customer.mobile}` : ""}` : <span key="n" className="text-danger">No customer recorded</span>],
            ["Vehicle", vehicleLine(job.vehicle)],
            ["Pickup", job.pickup],
            ["Destination", job.destination],
            ["Times", TOW_EVENTS.map((e) => `${TOW_EVENT_LABELS[e]} ${formatTime(job.tow[e])}`).join(" · ")],
            ["Business", `${app.company.name} · GST ${app.company.gstNumber}`],
          ]}
        />
      </Card>

      <p className="text-sm text-muted">{estimate ? "Charges start from the estimate. Update actual kilometres and storage days, or add a charge." : "Charges start from your configured rates."}</p>
      <LineItemEditor items={items} onChange={(next) => setError(attempt(() => mutateJob(job.id, (j) => saveInvoiceDraft(j, next))))} />
      <Totals items={items} label="Invoice total" />

      {differs && agreed !== undefined ? (
        <Banner tone="info" title={DIFFERENCE_WARNING}>
          <p>
            Original estimate: {formatMoney(agreed)}. This invoice: {formatMoney(draftTotal)}.
          </p>
          {!reauthorize && estimate ? (
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => setReauthorize(true)}>
              Record a customer authorization
            </Button>
          ) : null}
        </Banner>
      ) : null}

      {differs && reauthorize && estimate ? (
        <Card>
          <SectionTitle>Authorization of {formatMoney(draftTotal)}</SectionTitle>
          <ConsentCapture
            purpose="revised_amount"
            initialName={job.customer.name}
            initialRelationship={job.customer.relationship}
            present={job.customer.present}
            amountCents={draftTotal}
            enabled={{ ...app.consentMethods, link: false }}
            companyName={app.company.name}
            render={(name, relationship) =>
              renderConsent(template, consentContext(app.company.name, job, estimate, { name, relationship, amountCents: draftTotal }))
            }
            onRecord={(input) =>
              attempt(() => {
                mutateJob(job.id, (j, actor) => recordConsent(j, actor, input));
                setReauthorize(false);
              })
            }
          />
        </Card>
      ) : null}

      <ErrorText message={error} />
      <Button size="lg" full onClick={issue} icon="receipt" className="min-h-16 text-lg">
        Issue invoice
      </Button>
      <p className="-mt-2 text-center text-xs text-muted">Issued invoices can&apos;t be edited. The invoice is issued before any payment is recorded.</p>
      {correcting ? (
        <Button variant="secondary" full onClick={() => setError(attempt(() => mutateJob(job.id, (j) => saveInvoiceDraft(j, null))))}>
          Cancel correction
        </Button>
      ) : null}

      <div className="flex items-center justify-center gap-2 rounded-md border border-line-soft bg-sand/50 p-3 text-sm font-semibold text-subtle">
        <Icon name="lock" className="h-4 w-4" /> Record payment — issue invoice first
      </div>
    </>
  );
}

function IssuedInvoice({ app, job }: JobContext) {
  const router = useRouter();
  const invoice = currentInvoice(job)!;
  const paid = job.payments.filter((p) => p.invoiceNumber === invoice.number).reduce((sum, p) => sum + p.amountCents, 0);
  const balance = invoice.totalCents - paid;
  const [amount, setAmount] = useState((Math.max(balance, 0) / 100).toFixed(2));
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  const [error, setError] = useState<string | null>(null);
  const differs = differsFromEstimate(job, invoice.totalCents);

  const pay = () => {
    setError(
      attempt(() => {
        const cents = parseDollars(amount);
        if (cents === null) throw new GuardrailError("Enter an amount like 250.00");
        mutateJob(job.id, (j, actor) => recordPayment(j, actor, { amountCents: cents, method }));
      }),
    );
  };

  return (
    <>
      <Banner tone="good" title={`Invoice ${invoice.number} issued`}>
        {formatWhen(invoice.issuedAt)} by {invoice.issuedBy}. Issued invoices can&apos;t be edited.
      </Banner>
      {differs ? <Banner tone="info">{DIFFERENCE_WARNING}</Banner> : null}
      <InvoiceDocument company={app.company} invoice={invoice} jobNumber={job.number} />
      <div className="no-print">
        <h2 className="mb-2 text-lg font-extrabold tracking-tight">Give the customer their invoice</h2>
        <SendPanel
          kind="invoice"
          path={`/i/${invoice.token}`}
          customer={invoice.customer}
          deliveries={invoice.deliveries}
          onDelivered={(via, to) => attempt(() => mutateJob(job.id, (j, actor) => recordDelivery(j, actor, "invoice", via, to)))}
          onShowOnDevice={() => router.push(`/i/${invoice.token}`)}
        />
      </div>

      <Card className="no-print">
        <SectionTitle>Payment</SectionTitle>
        {canRecordPayment(job).ok ? (
          <div className="space-y-3">
            {job.payments.map((p) => (
              <p key={p.id} className="flex items-center gap-2 text-sm text-[#163f28]">
                <Icon name="check" className="h-4 w-4 text-ok" strokeWidth={3} /> {formatMoney(p.amountCents)} · {p.method} · {formatWhen(p.at)} ({p.recordedBy})
              </p>
            ))}
            <p className="text-sm">
              Balance: <strong>{formatMoney(balance)}</strong>
            </p>
            {balance > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Amount received">
                    <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </Field>
                  <Field label="Method">
                    <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <ErrorText message={error} />
                <Button full onClick={pay}>
                  Record payment
                </Button>
                <p className="text-xs text-muted">TowLedger records payments only — it doesn&apos;t process them.</p>
              </>
            ) : null}
          </div>
        ) : null}
      </Card>

      <div className="no-print space-y-2">
        <LinkButton href={jobHref(job)} full size="lg" replace trailing="arrowRight">
          Done — view job record
        </LinkButton>
        <Button variant="secondary" full onClick={() => setError(attempt(() => mutateJob(job.id, (j) => startInvoiceDraft(j))))}>
          Issue corrected invoice
        </Button>
      </div>
    </>
  );
}
