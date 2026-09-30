"use client";

import Link from "next/link";
import { useState } from "react";

import { JobScreen, StepHeader, type JobContext } from "@/components/job-screen";
import { Banner, Button, Card, ErrorText, Field, inputClass, LinkButton, PageShell, SectionTitle } from "@/components/ui";
import { TOW_EVENT_LABELS, TOW_EVENTS, type TowEvent } from "@/lib/domain";
import { recordDestinationChange, recordTowEvent } from "@/lib/jobs";
import { jobHref } from "@/lib/job-steps";
import { formatMoney } from "@/lib/money";
import { attempt, mutateJob } from "@/lib/store";
import { formatDateTime, formatTime } from "@/lib/time";
import { canRecordTowEvent, currentEstimate, estimateConsent, towGate } from "@/lib/tow-rules";

const NOTICE_METHODS = ["Text message", "Phone call", "Email", "In person"];

export default function TowStepPage() {
  return <JobScreen>{(ctx) => <TowStep {...ctx} />}</JobScreen>;
}

function TowStep({ app, job, type }: JobContext) {
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const gate = towGate(job, type);
  const estimate = currentEstimate(job);
  const consent = estimateConsent(job);
  const secured = Boolean(job.tow.secured);

  const record = (event: TowEvent) => {
    setError(attempt(() => mutateJob(job.id, (j, actor) => recordTowEvent(j, actor, type, event))));
  };

  return (
    <PageShell>
      <StepHeader job={job} type={type} title={secured ? "Tow in progress" : "Ready to tow?"} />
      <div className="space-y-4">
        {!secured ? (
          <Banner tone={gate.canTow ? "good" : "bad"} title={gate.message}>
            <ul className="mt-2 space-y-2">
              {gate.checks.map((c) => (
                <li key={c.key} className="flex items-center justify-between gap-3">
                  <span>
                    {c.ok ? "✓" : "✗"} {c.label}
                    {c.detail ? <span className="block text-xs">{c.detail}</span> : null}
                  </span>
                  {!c.ok ? (
                    <Link replace href={jobHref(job, c.fix)} className="shrink-0 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white">
                      Fix
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </Banner>
        ) : null}

        <Card>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-slate-500">Pickup</dt>
            <dd>{job.pickup || "—"}</dd>
            <dt className="text-slate-500">Destination</dt>
            <dd className="font-semibold">{job.destination || "—"}</dd>
            <dt className="text-slate-500">Customer</dt>
            <dd>{job.customer.name || "—"}</dd>
            {!gate.exempt ? (
              <>
                <dt className="text-slate-500">Estimate</dt>
                <dd>{estimate ? `v${estimate.version} · ${formatMoney(estimate.totalCents)}` : "Not issued"}</dd>
                <dt className="text-slate-500">Consent</dt>
                <dd>{consent ? `✓ ${consent.name}, ${formatTime(consent.at)}` : "Missing"}</dd>
              </>
            ) : null}
          </dl>
        </Card>

        <Card>
          <SectionTitle>Tow status</SectionTitle>
          <ol className="space-y-2">
            {TOW_EVENTS.map((event) => {
              const at = job.tow[event];
              const allowed = canRecordTowEvent(job, type, event);
              return (
                <li key={event}>
                  {at ? (
                    <div className="flex min-h-12 items-center justify-between rounded-xl bg-emerald-50 px-3 ring-1 ring-emerald-200">
                      <span className="font-semibold text-emerald-900">✓ {TOW_EVENT_LABELS[event]}</span>
                      <span className="text-sm tabular-nums text-emerald-900">{formatDateTime(at)}</span>
                    </div>
                  ) : allowed.ok ? (
                    <Button size="lg" full variant={event === "secured" ? "success" : "primary"} onClick={() => record(event)}>
                      {event === "secured" ? "Start tow — vehicle secured" : TOW_EVENT_LABELS[event]}
                    </Button>
                  ) : (
                    <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-slate-100 px-3 text-slate-500">
                      <span className="font-medium">🔒 {TOW_EVENT_LABELS[event]}</span>
                      <span className="text-right text-xs">{allowed.reason}</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <ErrorText message={error} />
        </Card>

        {secured && !job.tow.delivered ? (
          changing ? (
            <DestinationChangeForm
              app={app}
              job={job}
              onDone={() => setChanging(false)}
            />
          ) : (
            <Button variant="secondary" full onClick={() => setChanging(true)}>
              Destination changed
            </Button>
          )
        ) : null}

        {job.destinationChanges.map((c) => (
          <Banner key={c.id} tone="warn" title={`Moved to ${c.to}`}>
            Authorized by {c.authorizedBy} — {c.reason}. Owner notified by {c.ownerNotifiedVia.toLowerCase()} · {formatDateTime(c.notifiedAt)}
          </Banner>
        ))}

        {job.tow.delivered ? (
          <LinkButton href={jobHref(job, "invoice")} size="lg" full replace>
            Continue to invoice →
          </LinkButton>
        ) : null}
      </div>
    </PageShell>
  );
}

function DestinationChangeForm({ app, job, onDone }: Pick<JobContext, "app" | "job"> & { onDone: () => void }) {
  const [to, setTo] = useState("");
  const [authorizedBy, setAuthorizedBy] = useState("");
  const [reason, setReason] = useState("");
  const [via, setVia] = useState(job.customer.mobile ? NOTICE_METHODS[0] : NOTICE_METHODS[1]);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const failure = attempt(() => {
      if (via === "Text message" && job.customer.mobile) {
        console.info(`[dev] text to ${job.customer.mobile}: Your vehicle ${job.vehicle.plate} has been moved to ${to}. — ${app.company.name} ${app.company.phone}`);
      }
      mutateJob(job.id, (j, actor) => recordDestinationChange(j, actor, { to, authorizedBy, reason, ownerNotifiedVia: via }));
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
            <button key={yard.id} type="button" onClick={() => setTo(`${yard.name} — ${yard.address}`)} className="min-h-10 rounded-full bg-white px-3 text-sm ring-1 ring-slate-300">
              Our yard: {yard.name}
            </button>
          ))}
        </div>
        <Field label="Who authorized the change?">
          <input className={inputClass} value={authorizedBy} onChange={(e) => setAuthorizedBy(e.target.value)} placeholder="Name and role" />
        </Field>
        <Field label="Why?">
          <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. requested shop closed" />
        </Field>
        <Field label="How was the owner notified?" hint={via === "Text message" ? "Development mode: the text is logged, not sent." : undefined}>
          <select className={inputClass} value={via} onChange={(e) => setVia(e.target.value)}>
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
