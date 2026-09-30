"use client";

import Link from "next/link";
import { useState } from "react";

import { DeliveredNotice } from "@/components/delivered-notice";
import { PhotoCapture } from "@/components/evidence";
import { Icon } from "@/components/icons";
import { JobScreen, StepHeader, type JobContext } from "@/components/job-screen";
import { Banner, Button, Card, CheckMark, DataList, ErrorText, Field, inputClass, LinkButton, PageShell, SectionTitle } from "@/components/ui";
import type { Job } from "@/lib/domain";
import { TOW_EVENT_LABELS, TOW_EVENTS, type TowEvent } from "@/lib/domain";
import { addPhoto, recordDestinationChange, recordOwnerNotice } from "@/lib/jobs";
import { jobHref } from "@/lib/job-steps";
import { movedMessage } from "@/lib/messages";
import { formatMoney } from "@/lib/money";
import { actorFor, attempt, logMessages, mutateJob, recordTowEventAndNotify } from "@/lib/store";
import { formatTime, formatWhen, fromLocalInput, toLocalInput } from "@/lib/time";
import { canRecordTowEvent, currentEstimate, estimateConsent, towGate } from "@/lib/tow-rules";

const NOTICE_METHODS = ["Text message", "Phone call", "Email", "In person"];

export default function TowStepPage() {
  return <JobScreen>{(ctx) => <TowStep {...ctx} />}</JobScreen>;
}

function TowStep({ app, job }: JobContext) {
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const gate = towGate(job);
  const estimate = currentEstimate(job);
  const consent = estimateConsent(job);
  const secured = Boolean(job.tow.secured);
  const workflow = job.workflow;

  // "Delivered" also schedules the company's automatic customer notice.
  const record = (event: TowEvent) => {
    setError(attempt(() => recordTowEventAndNotify(job.id, event)));
  };

  return (
    <PageShell>
      <StepHeader job={job} step="tow" title={secured ? "Tow in progress" : gate.canTow ? "Ready to proceed" : "Before the tow"} />
      <div className="space-y-4">
        {!secured ? (
          gate.canTow ? (
            <section className="rounded-lg bg-forest p-5 text-white shadow-[0_4px_0_#0e291c]">
              <p className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-signal">
                <Icon name="shieldCheck" className="h-4 w-4" /> Workflow {workflow?.letter}
              </p>
              <h2 className="mt-2 text-2xl font-extrabold leading-tight tracking-[-0.04em]">{app.company.name} workflow complete — ready to proceed.</h2>
              <ul className="mt-4 space-y-2">
                {gate.checks.map((c) => (
                  <li key={c.key} className="flex items-center gap-3 font-semibold">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-signal text-forest">
                      <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    {c.label}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-[#b6c6bb]">
                {app.company.name} requires these steps for {workflow?.name} jobs. TowLedger enforces the configured process.
              </p>
            </section>
          ) : (
            <Banner tone="bad" title={gate.message}>
              <p>{app.company.name}&apos;s workflow requires these steps before the tow:</p>
              <ul className="mt-3 space-y-2">
                {gate.checks.map((c) => (
                  <li key={c.key} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <CheckMark ok={c.ok} />
                      <span>
                        <span className="font-semibold">{c.label}</span>
                        {c.detail ? <span className="block text-xs">{c.detail}</span> : null}
                      </span>
                    </span>
                    {!c.ok ? (
                      <Link replace href={jobHref(job, c.fix)} className="shrink-0 rounded-md bg-danger px-3 py-2 text-xs font-semibold text-white">
                        Fix
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Banner>
          )
        ) : null}

        <Card>
          <DataList
            rows={[
              ["Pickup", job.pickup || "—"],
              ["Destination", <strong key="d">{job.destination || "—"}</strong>],
              ["Customer", job.customer.name || "—"],
              ...(workflow?.requireEstimate
                ? ([
                    ["Estimate", estimate ? `#${job.number} · ${formatMoney(estimate.totalCents)}` : "Not issued"],
                    ["Consent", consent ? `✓ ${consent.name}, ${formatTime(consent.at)}` : "Not recorded"],
                  ] as [string, string][])
                : []),
            ]}
          />
        </Card>

        <Card>
          <SectionTitle>Tow status</SectionTitle>
          <ol className="space-y-2">
            {TOW_EVENTS.map((event) => {
              const at = job.tow[event];
              const allowed = canRecordTowEvent(job, event);
              return (
                <li key={event}>
                  {at ? (
                    <div className="flex min-h-14 items-center justify-between rounded-md border border-[#b9dcc4] bg-[#eaf5ed] px-4">
                      <span className="flex items-center gap-3 font-semibold text-[#163f28]">
                        <CheckMark ok /> {TOW_EVENT_LABELS[event]}
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-[#163f28]">{formatTime(at)}</span>
                    </div>
                  ) : allowed.ok ? (
                    <Button size="lg" full variant={event === "secured" ? "signal" : "primary"} onClick={() => record(event)} icon="clock">
                      {TOW_EVENT_LABELS[event]}
                    </Button>
                  ) : (
                    <div className="flex min-h-14 items-center justify-between gap-3 rounded-md border border-line-soft bg-sand/50 px-4 text-subtle">
                      <span className="flex items-center gap-2 font-semibold">
                        <Icon name="lock" className="h-4 w-4" /> {TOW_EVENT_LABELS[event]}
                      </span>
                      <span className="text-right text-xs">{allowed.reason}</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="mt-3">
            <ErrorText message={error} />
          </div>
        </Card>

        {secured && !job.tow.delivered ? (
          changing ? (
            <DestinationChangeForm app={app} job={job} onDone={() => setChanging(false)} />
          ) : (
            <Button variant="secondary" full icon="mapPin" onClick={() => setChanging(true)}>
              Destination changed
            </Button>
          )
        ) : null}

        {job.destinationChanges.map((c) => (
          <DestinationChangeCard key={c.id} job={job} change={c} />
        ))}

        <Card>
          <SectionTitle right={<span className="text-xs text-muted">{job.photos.length} on file</span>}>Photos</SectionTitle>
          {job.photos.length > 0 ? (
            <div className="mb-3 grid grid-cols-3 gap-2">
              {job.photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element -- local data URL
                <img key={p.id} src={p.dataUrl} alt={p.caption} className="aspect-square w-full rounded-md border border-line-soft object-cover" />
              ))}
            </div>
          ) : null}
          <PhotoCapture
            keepPreview={false}
            label="Add photo"
            onChange={(dataUrl) => dataUrl && setError(attempt(() => mutateJob(job.id, (j, actor) => addPhoto(j, actor, { dataUrl, caption: job.tow.secured ? "During tow" : "On arrival" }))))}
          />
        </Card>

        {job.tow.delivered ? <DeliveredNotice app={app} job={job} /> : null}

        {job.tow.delivered ? (
          <LinkButton href={jobHref(job, "invoice")} size="lg" full replace trailing="arrowRight">
            Continue to invoice
          </LinkButton>
        ) : null}
      </div>
    </PageShell>
  );
}

function DestinationChangeCard({ job, change }: { job: Job; change: Job["destinationChanges"][number] }) {
  const [via, setVia] = useState(NOTICE_METHODS[0]);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="rounded-lg border border-[#f1d3a6] bg-[#fff6ea] p-4 text-sm text-[#5c3908]">
      <p className="font-bold">Destination changed · {formatWhen(change.at)}</p>
      <DataList
        className="mt-2"
        rows={[
          ["From", change.from],
          ["To", <strong key="t">{change.to}</strong>],
          ["Requested / approved by", change.requestedBy],
          ...(change.note ? ([["Note", change.note]] as [string, string][]) : []),
          ["Owner notice", change.ownerNotifiedVia ? `${change.ownerNotifiedVia} · ${formatWhen(change.ownerNotifiedAt)}` : "Not recorded yet"],
        ]}
      />
      {!change.ownerNotifiedVia ? (
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <select className={inputClass} value={via} onChange={(e) => setVia(e.target.value)} aria-label="How the owner was notified">
            {NOTICE_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <Button onClick={() => setError(attempt(() => mutateJob(job.id, (j, actor) => recordOwnerNotice(j, actor, change.id, via))))}>Record notice</Button>
        </div>
      ) : null}
      <ErrorText message={error} />
    </div>
  );
}

function DestinationChangeForm({ app, job, onDone }: Pick<JobContext, "app" | "job"> & { onDone: () => void }) {
  const [to, setTo] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [when, setWhen] = useState(() => toLocalInput(new Date().toISOString()));
  const [note, setNote] = useState("");
  const [via, setVia] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const failure = attempt(() => {
      const before = job;
      mutateJob(job.id, (j, actor) => recordDestinationChange(j, actor, { to, requestedBy, at: fromLocalInput(when) ?? undefined, note, ownerNotifiedVia: via }));
      if (via === "Text message") {
        logMessages([movedMessage({ job: before, to: to.trim(), company: app.company, origin: window.location.origin, actor: actorFor(app) })]);
      }
      onDone();
    });
    setError(failure);
  };

  return (
    <Card>
      <SectionTitle>Destination changed</SectionTitle>
      <div className="space-y-3">
        <Field label="New destination">
          <input className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          {app.yards.map((yard) => (
            <button key={yard.id} type="button" onClick={() => setTo(`${yard.name} — ${yard.address}`)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-sm">
              <Icon name="mapPin" className="h-4 w-4 text-pine" /> {yard.name}
            </button>
          ))}
        </div>
        <Field label="Who requested / approved it?">
          <input className={inputClass} value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} placeholder="Name and role" />
        </Field>
        <Field label="Date and time">
          <input className={inputClass} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </Field>
        <Field label="Note" optional>
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. requested shop closed" />
        </Field>
        <Field label="Owner notice" hint={via === "Text message" ? "Prototype: the text is simulated." : "You can record the notice later if it hasn't happened yet."}>
          <select className={inputClass} value={via} onChange={(e) => setVia(e.target.value)}>
            <option value="">Not yet</option>
            {NOTICE_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <ErrorText message={error} />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onDone}>
            Cancel
          </Button>
          <Button onClick={save}>Record change</Button>
        </div>
      </div>
    </Card>
  );
}
