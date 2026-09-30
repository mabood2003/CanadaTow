"use client";

import Link from "next/link";
import { useState } from "react";

import { ExportPackage } from "@/components/export-package";
import { Icon } from "@/components/icons";
import { JobScreen, ProgressStrip, type JobContext } from "@/components/job-screen";
import { AuditTrail, ConsentRecord } from "@/components/records";
import { Banner, Button, Card, CheckRow, Chip, DataList, ErrorText, inputClass, LinkButton, PageShell, ScreenHeader, SectionTitle } from "@/components/ui";
import { DELIVERY_LABELS, TOW_EVENT_LABELS, TOW_EVENTS } from "@/lib/domain";
import { vehicleLine, vehicleName } from "@/lib/describe";
import { appBase } from "@/lib/app-base";
import type { OutboundMessage } from "@/lib/domain";
import { MESSAGE_KIND_LABELS } from "@/lib/domain";
import { saveNotes } from "@/lib/jobs";
import { jobMessages } from "@/lib/messages";
import { firstOpenStep, jobHref, jobSteps } from "@/lib/job-steps";
import { formatMoney } from "@/lib/money";
import { attempt, mutateJob } from "@/lib/store";
import { formatDate, formatWhen } from "@/lib/time";
import { capitalize, currentEstimate, currentInvoice, jobRecord, jobStatus } from "@/lib/tow-rules";

export default function JobPage() {
  return <JobScreen>{(ctx) => <JobRecordView {...ctx} />}</JobScreen>;
}

function JobRecordView({ app, job, type }: JobContext) {
  const [exporting, setExporting] = useState(false);
  const status = jobStatus(job);
  const record = jobRecord(job);
  const steps = jobSteps(job);
  const next = firstOpenStep(job);
  const estimate = currentEstimate(job);
  const invoice = currentInvoice(job);
  const towStarted = Boolean(job.tow.secured);
  const paid = job.payments.reduce((sum, p) => sum + p.amountCents, 0);

  return (
    <PageShell width="wide">
      <ScreenHeader
        back={appBase() === "/owner" ? { href: "/owner/jobs", label: "Jobs" } : { href: "/driver/jobs", label: "My jobs" }}
        kicker={job.workflow ? `Job record · Workflow ${job.workflow.letter} — ${job.workflow.name}` : "Job record"}
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            Job #{job.number}
            <Chip tone={status.tone}>{status.label}</Chip>
          </span>
        }
        subtitle={`${vehicleLine(job.vehicle) || "Vehicle not recorded"} · ${formatDate(job.createdAt)} · Driver ${job.driverName}`}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          {record.complete ? (
            <Banner tone="good" icon="fileCheck" title="Job record complete">
              Every step {app.company.name}&apos;s workflow asks for is on file. Kept until {formatDate(record.retainUntil)} (3 years).
            </Banner>
          ) : towStarted ? (
            <Banner tone="bad" title={`Needs attention: ${record.problems[0]}`}>
              {record.problems.length > 1 ? `Also: ${record.problems.slice(1).join(", ")}.` : `This job hasn't completed ${app.company.name}'s process yet.`}
              <div className="mt-3">
                <LinkButton href={jobHref(job, record.items.find((i) => !i.ok)!.fix)} size="sm" variant="danger">
                  Fix: {capitalize(record.problems[0])}
                </LinkButton>
              </div>
            </Banner>
          ) : next ? (
            <div className="rounded-lg border border-line bg-paper p-4">
              <ProgressStrip job={job} />
              <LinkButton href={jobHref(job, next.key)} size="lg" full trailing="arrowRight">
                Next: {next.label}
              </LinkButton>
            </div>
          ) : null}

          <Card>
            <SectionTitle>{app.company.name} process</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              {record.items.map((item) => (
                <CheckRow
                  key={item.key}
                  ok={item.ok}
                  label={item.label}
                  detail={item.detail}
                  missingTone={towStarted ? "bad" : "neutral"}
                  action={
                    item.ok || item.key === "archived" ? null : (
                      <Link href={jobHref(job, item.fix)} className="shrink-0 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink hover:border-pine">
                        {towStarted ? "Fix" : "Open"}
                      </Link>
                    )
                  }
                />
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle>Job details</SectionTitle>
            <DataList
              rows={[
                ["Requested by", type ? `${type.label}${job.requestOther ? ` (${job.requestOther})` : ""}` : "—"],
                ["Contacted by", job.contactName || "—"],
                ["Reference", job.contactReference || "—"],
                ["Workflow", job.workflow ? `${job.workflow.letter} — ${job.workflow.name}` : "—"],
                ["Customer", job.customer.name ? `${job.customer.name} · ${job.customer.relationship}${job.customer.present ? "" : " · not present"}` : "—"],
                ["Contact", [job.customer.mobile, job.customer.email].filter(Boolean).join(" · ") || "—"],
                ["Vehicle", vehicleLine(job.vehicle) || "—"],
                ["Pickup", job.pickup || "—"],
                ["Destination", job.destination || "—"],
                ["Supplied by", job.destinationConfirmedBy || "—"],
              ]}
            />
          </Card>

          {job.workflow?.requireEstimate || job.estimates.length > 0 ? (
            <Card>
              <SectionTitle right={estimate ? <LinkButton href={`/e/${estimate.token}`} target="_blank" variant="secondary" size="sm" icon="eye">View</LinkButton> : null}>Estimate and delivery record</SectionTitle>
              {estimate ? (
                <>
                  <p className="text-sm">
                    <strong>Estimate #{job.number}</strong>
                    {job.estimates.length > 1 ? ` v${estimate.version} (${job.estimates.length - 1} earlier version${job.estimates.length > 2 ? "s" : ""} kept)` : ""} · {formatMoney(estimate.totalCents)} · {estimate.rateCardName}
                  </p>
                  <p className="text-xs text-muted">
                    Issued {formatWhen(estimate.issuedAt)} by {estimate.issuedBy}
                  </p>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {estimate.deliveries.length === 0 ? <li className="text-danger">Not delivered to the customer</li> : null}
                    {estimate.deliveries.map((d) => (
                      <li key={d.at + d.via} className="flex items-start gap-2">
                        <Icon name="check" className="mt-0.5 h-4 w-4 text-ok" strokeWidth={3} />
                        {DELIVERY_LABELS[d.via]}
                        {d.to ? ` to ${d.to}` : ""} · <span className="text-muted">{formatWhen(d.at)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-muted">No estimate issued.</p>
              )}
            </Card>
          ) : null}

          {job.workflow?.requireConsent || job.consents.length > 0 ? (
            <Card>
              <SectionTitle>Consent / authorization evidence</SectionTitle>
              {job.consents.length === 0 ? <p className="text-sm text-muted">No consent record yet.</p> : null}
              <div className="space-y-3">
                {job.consents.map((c) => (
                  <ConsentRecord key={c.id} consent={c} jobNumber={job.number} />
                ))}
              </div>
            </Card>
          ) : null}

          <Card>
            <SectionTitle right={invoice ? <LinkButton href={`/i/${invoice.token}`} target="_blank" variant="secondary" size="sm" icon="eye">View</LinkButton> : null}>Invoice</SectionTitle>
            {invoice ? (
              <>
                <p className="text-sm">
                  <strong>{invoice.number}</strong> · {formatMoney(invoice.totalCents)} · issued {formatWhen(invoice.issuedAt)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Delivered: {invoice.deliveries.map((d) => DELIVERY_LABELS[d.via]).join(", ") || "not yet"} · Payments recorded {formatMoney(paid)} of {formatMoney(invoice.totalCents)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted">Not issued.</p>
            )}
          </Card>

          <Card>
            <SectionTitle right={<span className="text-xs text-muted">{job.photos.length}</span>}>Photos / uploads</SectionTitle>
            {job.photos.length === 0 ? (
              <p className="text-sm text-muted">
                None yet. Add photos on the <Link className="font-semibold text-pine underline" href={jobHref(job, "tow")}>tow screen</Link>.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {job.photos.map((p) => (
                  <figure key={p.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
                    <img src={p.dataUrl} alt={p.caption} className="aspect-square w-full rounded-md border border-line-soft object-cover" />
                    <figcaption className="mt-1 truncate text-xs text-muted">
                      {p.caption} · {formatWhen(p.at)}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle>Timeline</SectionTitle>
            <ol className="space-y-2 text-sm">
              <TimelineRow label="Job created" at={job.createdAt} />
              {TOW_EVENTS.map((e) => (
                <TimelineRow key={e} label={TOW_EVENT_LABELS[e]} at={job.tow[e]} />
              ))}
              {job.destinationChanges.map((c) => (
                <li key={c.id} className="rounded-md border border-[#f1d3a6] bg-[#fff6ea] p-3 text-[#5c3908]">
                  <strong>Destination changed</strong> {formatWhen(c.at)} — “{c.from}” → “{c.to}”, requested/approved by {c.requestedBy}
                  {c.note ? ` (${c.note})` : ""}. Owner notice: {c.ownerNotifiedVia || "not recorded"}.
                </li>
              ))}
            </ol>
          </Card>

          <NotesCard job={job} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <p className="text-lg font-extrabold tracking-tight">{job.vehicle.make ? vehicleName(job.vehicle) : `Job #${job.number}`}</p>
            <p className="text-sm text-muted">{job.customer.name || "Customer not recorded"}</p>
            <div className="mt-4 space-y-2">
              <Button full icon="package" onClick={() => setExporting(true)}>
                Export job record
              </Button>
              <LinkButton href={`/c/${job.publicToken}`} target="_blank" full variant="secondary" icon="link">
                Customer&apos;s page
              </LinkButton>
              <LinkButton href={jobHref(job, "audit")} full variant="secondary" icon="history">
                Audit trail
              </LinkButton>
            </div>
            <p className="mt-2 text-xs text-muted">The customer&apos;s link shows the tow&apos;s progress, the estimate and the invoice.</p>
          </Card>

          <Card>
            <SectionTitle>Steps</SectionTitle>
            <ol className="-my-1 divide-y divide-line-soft">
              {steps.map((step) => (
                <li key={step.key}>
                  <Link href={jobHref(job, step.key)} className="flex min-h-11 items-center justify-between gap-3 py-1.5 text-sm hover:text-pine">
                    <span className="flex items-center gap-2.5">
                      <span className={`grid h-5 w-5 place-items-center rounded-full ${step.done ? "bg-forest text-signal" : "border-2 border-line"}`}>
                        {step.done ? <Icon name="check" className="h-3 w-3" strokeWidth={3} /> : null}
                      </span>
                      {step.label}
                    </span>
                    <span className="text-xs text-subtle">{step.done ? "Done" : step.optional ? "Optional" : "Open"}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </Card>

          <JobMessages messages={jobMessages(app.outbox, job.id)} />

          <Card>
            <SectionTitle right={<Link href={jobHref(job, "audit")} className="text-xs font-semibold text-pine">All {job.audit.length}</Link>}>Recent activity</SectionTitle>
            <AuditTrail entries={job.audit} limit={5} />
          </Card>
        </aside>
      </div>

      <ExportPackage company={app.company} job={job} open={exporting} onClose={() => setExporting(false)} />
    </PageShell>
  );
}

/** Texts and emails sent to the customer about this job (prototype: recorded, not actually sent). */
function JobMessages({ messages }: { messages: OutboundMessage[] }) {
  return (
    <Card>
      <SectionTitle>Messages to the customer</SectionTitle>
      {messages.length === 0 ? (
        <p className="text-sm text-muted">None sent yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {messages.map((m) => (
            <li key={m.id} className="flex items-start gap-2">
              <Icon name={m.channel === "text" ? "message" : "mail"} className={`mt-0.5 h-4 w-4 ${m.status === "sent" ? "text-ok" : "text-subtle"}`} />
              <span className="min-w-0">
                <span className="font-medium">{MESSAGE_KIND_LABELS[m.kind]}</span>
                <span className="block text-xs text-muted">
                  {m.status === "sent" ? "Sent" : m.status === "scheduled" ? "Sending soon" : `Cancelled by ${m.cancelledBy}`} · {m.to} · {formatWhen(m.sentAt ?? m.cancelledAt ?? m.sendAt)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function TimelineRow({ label, at }: { label: string; at?: string }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-line-soft pb-2">
      <span className={at ? "font-medium" : "text-subtle"}>{label}</span>
      <span className={`tabular-nums ${at ? "" : "text-subtle"}`}>{formatWhen(at)}</span>
    </li>
  );
}

function NotesCard({ job }: Pick<JobContext, "job">) {
  const [notes, setNotes] = useState(job.notes);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  return (
    <Card>
      <SectionTitle>Notes</SectionTitle>
      <textarea
        className={`${inputClass} min-h-24`}
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaved(false);
        }}
        placeholder="Anything the office should know about this job"
      />
      <div className="mt-2 flex items-center gap-3">
        <Button
          size="sm"
          variant="secondary"
          disabled={notes === job.notes}
          onClick={() => {
            const failure = attempt(() => mutateJob(job.id, (j, actor) => saveNotes(j, actor, notes.trim())));
            setError(failure);
            setSaved(!failure);
          }}
        >
          Save notes
        </Button>
        {saved ? <span className="text-xs text-ok">Saved · recorded in the audit trail</span> : null}
      </div>
      <ErrorText message={error} />
    </Card>
  );
}
