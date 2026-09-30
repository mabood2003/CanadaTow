"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ConsentCapture } from "@/components/consent-capture";
import { InvoiceDocument } from "@/components/documents";
import { JobScreen, StepHeader, type JobContext } from "@/components/job-screen";
import { LineItemEditor, Totals } from "@/components/line-items";
import { SendPanel } from "@/components/send-panel";
import { Banner, Button, Card, ErrorText, Field, inputClass, LinkButton, PageShell, SectionTitle } from "@/components/ui";
import { GuardrailError, issueInvoice, recordConsent, recordDelivery, recordPayment, saveInvoiceDraft, startInvoiceDraft } from "@/lib/jobs";
import { jobHref } from "@/lib/job-steps";
import { formatMoney, parseDollars, totals } from "@/lib/money";
import { actorFor, attempt, mutateJob, setAppState } from "@/lib/store";
import { formatDateTime } from "@/lib/time";
import { authorizedAmountCents, canRecordPayment, currentInvoice, DIFFERENCE_WARNING, differsFromAuthorized } from "@/lib/tow-rules";

const PAYMENT_METHODS = ["Debit", "Credit card", "Cash", "E-transfer", "Motor club / insurer account", "Other"];

export default function InvoiceStepPage() {
  return <JobScreen>{(ctx) => <InvoiceStep {...ctx} />}</JobScreen>;
}

function InvoiceStep({ app, job, type }: JobContext) {
  const invoice = currentInvoice(job);
  const delivered = Boolean(job.tow.delivered);
  const needsDraft = delivered && !invoice && job.invoiceDraft === null;

  // Auto-fill the first invoice from the consented estimate.
  useEffect(() => {
    if (needsDraft) attempt(() => mutateJob(job.id, (j) => startInvoiceDraft(j)));
  }, [needsDraft, job.id]);

  let body;
  if (!delivered) {
    body = (
      <>
        <Banner tone="neutral" title="Invoice comes after delivery">
          Record “Delivered to destination” on the tow screen, then build the invoice here. Payment can only be recorded after the invoice is issued.
        </Banner>
        <LinkButton href={jobHref(job, "tow")} full replace>
          Go to tow
        </LinkButton>
      </>
    );
  } else if (job.invoiceDraft) {
    body = <InvoiceBuilder app={app} job={job} type={type} />;
  } else if (invoice) {
    body = <IssuedInvoice app={app} job={job} type={type} />;
  } else {
    body = <p className="text-sm text-slate-500">Preparing invoice…</p>;
  }

  return (
    <PageShell>
      <div className="no-print">
        <StepHeader job={job} type={type} title="Invoice" />
      </div>
      <div className="space-y-4">{body}</div>
    </PageShell>
  );
}

function InvoiceBuilder({ job }: JobContext) {
  const [error, setError] = useState<string | null>(null);
  const [reconsent, setReconsent] = useState(false);
  const items = job.invoiceDraft ?? [];
  const draftTotal = totals(items).totalCents;
  const authorized = authorizedAmountCents(job);
  const differs = differsFromAuthorized(job, draftTotal);
  const correcting = currentInvoice(job);

  const issue = () => {
    const failure = attempt(() =>
      // One write: issue the invoice and advance the invoice-number counter together.
      setAppState((s) => {
        const actor = actorFor(s);
        const jobs = s.jobs.map((j) => (j.id === job.id ? issueInvoice(j, actor, `INV-${s.counters.invoice}`) : j));
        return { ...s, jobs, counters: correcting ? s.counters : { ...s.counters, invoice: s.counters.invoice + 1 } };
      }),
    );
    setError(failure);
    if (!failure) window.scrollTo({ top: 0 });
  };

  const vehicle = [job.vehicle.plate, job.vehicle.make, job.vehicle.model].filter(Boolean).join(" ");

  return (
    <>
      {correcting ? (
        <Banner tone="warn" title={`Correcting ${correcting.number}`}>
          The original invoice stays on file. Issuing creates a corrected version.
        </Banner>
      ) : (
        <p className="text-sm text-slate-600">Filled in from the consented estimate. Update the actual kilometres and storage days, or add a charge.</p>
      )}

      <LineItemEditor items={items} onChange={(next) => setError(attempt(() => mutateJob(job.id, (j) => saveInvoiceDraft(j, next))))} />
      <Totals items={items} label="Invoice total" />

      {differs && authorized !== undefined ? (
        <Banner tone="warn" title={DIFFERENCE_WARNING}>
          <p>
            Customer authorized {formatMoney(authorized)}. This invoice is {formatMoney(draftTotal)}.
          </p>
          {!reconsent ? (
            <Button variant="secondary" full className="mt-3" onClick={() => setReconsent(true)}>
              Record customer authorization
            </Button>
          ) : null}
        </Banner>
      ) : null}

      {differs && reconsent ? (
        <Card>
          <SectionTitle>Customer authorization of {formatMoney(draftTotal)}</SectionTitle>
          <ConsentCapture
            purpose="revised_amount"
            initialName={job.customer.name}
            initialRelationship={job.customer.relationship}
            present={job.customer.present}
            amountCents={draftTotal}
            vehicle={vehicle || "this vehicle"}
            allowLink={false}
            onRecord={(input) =>
              attempt(() => {
                mutateJob(job.id, (j, actor) => recordConsent(j, actor, input));
                setReconsent(false);
              })
            }
          />
        </Card>
      ) : null}

      <ErrorText message={error} />
      <Button size="lg" full onClick={issue} className="min-h-16">
        Issue invoice before recording payment
      </Button>
      {correcting ? (
        <Button variant="secondary" full onClick={() => setError(attempt(() => mutateJob(job.id, (j) => saveInvoiceDraft(j, null))))}>
          Cancel correction
        </Button>
      ) : null}

      <div className="rounded-xl bg-slate-100 p-3 text-center text-sm font-medium text-slate-500">🔒 Record payment — issue invoice first</div>
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
  const differs = differsFromAuthorized(job, invoice.totalCents);

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
      <Banner tone="good" title={`Invoice ${invoice.number} issued ✓`}>
        Issued {formatDateTime(invoice.issuedAt)} by {invoice.issuedBy}. Issued invoices can&apos;t be edited.
      </Banner>
      {differs ? <Banner tone="warn">{DIFFERENCE_WARNING}. No authorization of this amount is on file.</Banner> : null}
      <InvoiceDocument company={app.company} invoice={invoice} jobNumber={job.number} />
      <SendPanel
        kind="invoice"
        path={`/i/${invoice.token}`}
        customer={invoice.customer}
        deliveries={invoice.deliveries}
        onDelivered={(via, to) => attempt(() => mutateJob(job.id, (j, actor) => recordDelivery(j, actor, "invoice", via, to)))}
        onShowOnDevice={() => router.push(`/i/${invoice.token}`)}
      />

      <Card className="no-print">
        <SectionTitle>Payment</SectionTitle>
        {canRecordPayment(job).ok ? (
          <div className="space-y-3">
            {job.payments.map((p) => (
              <p key={p.id} className="text-sm text-emerald-800">
                ✓ {formatMoney(p.amountCents)} · {p.method} · {formatDateTime(p.at)} ({p.recordedBy})
              </p>
            ))}
            <p className="text-sm text-slate-700">
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
                <Button full variant="success" onClick={pay}>
                  Record payment
                </Button>
                <p className="text-xs text-slate-500">TowLedger records payments only — it doesn&apos;t process them.</p>
              </>
            ) : null}
          </div>
        ) : null}
      </Card>

      <div className="no-print space-y-2">
        <LinkButton href={jobHref(job)} full size="lg" replace>
          Done — view job file
        </LinkButton>
        <Button variant="secondary" full onClick={() => setError(attempt(() => mutateJob(job.id, (j) => startInvoiceDraft(j))))}>
          Issue corrected invoice
        </Button>
      </div>
    </>
  );
}
