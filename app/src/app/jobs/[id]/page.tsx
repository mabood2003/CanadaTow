"use client";

import Link from "next/link";
import { useState } from "react";

import { JobScreen, type JobContext } from "@/components/job-screen";
import { AuditTrail, ConsentRecord } from "@/components/records";
import { Banner, Card, CheckRow, Chip, LinkButton, PageShell, ScreenHeader, SectionTitle } from "@/components/ui";
import { TOW_EVENT_LABELS, TOW_EVENTS } from "@/lib/domain";
import { audit } from "@/lib/jobs";
import { firstOpenStep, jobHref, jobSteps } from "@/lib/job-steps";
import { formatMoney } from "@/lib/money";
import { attempt, mutateJob } from "@/lib/store";
import { formatDate, formatDateTime } from "@/lib/time";
import {
  complianceFile,
  currentEstimate,
  currentInvoice,
  jobStatus,
  resolveWorkflow,
  towGate,
  workflowSummary,
} from "@/lib/tow-rules";

export default function JobPage() {
  return <JobScreen>{(ctx) => <JobFile {...ctx} />}</JobScreen>;
}

function JobFile({ app, job, type }: JobContext) {
  const [open, setOpen] = useState<"consent" | "audit" | null>(null);
  const status = jobStatus(job, type);
  const resolved = resolveWorkflow(type);
  const gate = towGate(job, type);
  const steps = jobSteps(job, type);
  const next = firstOpenStep(job, type);
  const file = complianceFile(job, type);
  const estimate = currentEstimate(job);
  const invoice = currentInvoice(job);
  const towStarted = Boolean(job.tow.secured);
  const paid = job.payments.reduce((sum, p) => sum + p.amountCents, 0);

  const exportJobFile = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: "TowLedger",
      company: app.company,
      requestType: type ?? null,
      job,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job.number}-job-file.json`;
    a.click();
    URL.revokeObjectURL(url);
    attempt(() => mutateJob(job.id, (j, actor) => audit(j, actor, "Job file exported")));
  };

  return (
    <PageShell>
      <ScreenHeader
        back={{ href: "/", label: "Home" }}
        title={`Job ${job.number}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {[job.vehicle.plate, [job.vehicle.colour, job.vehicle.make, job.vehicle.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ") ||
                "Vehicle not recorded"}
            </span>
            <Chip tone={status.tone}>{status.label}</Chip>
          </span>
        }
      />

      <div className="space-y-4">
        <Card>
          <p className="text-sm font-semibold text-slate-900">{type ? workflowSummary(resolved) : "Request type not recorded yet"}</p>
          <p className="mt-1 text-sm text-slate-600">
            {type ? `Requested by: ${type.label}` : "Start with who requested this tow."} · Driver {job.driverName}
          </p>
          {resolved.toConfirm ? (
            <p className="mt-2 text-xs font-medium text-slate-500">Internal: classification to be confirmed — full consumer workflow applies.</p>
          ) : null}
        </Card>

        {!towStarted ? (
          <Banner tone={gate.canTow ? "good" : "bad"} title={gate.message}>
            <ul className="mt-2 space-y-1">
              {gate.checks.map((c) => (
                <li key={c.key}>
                  {c.ok ? "✓" : "✗"} {c.label}
                  {c.detail ? <span className="text-xs"> — {c.detail}</span> : null}
                </li>
              ))}
            </ul>
          </Banner>
        ) : null}

        {next ? (
          <LinkButton href={jobHref(job, next.key)} size="lg" full>
            Next: {next.label} →
          </LinkButton>
        ) : null}

        <Card>
          <SectionTitle>Steps</SectionTitle>
          <ol className="divide-y divide-slate-100">
            {steps.map((step) => (
              <li key={step.key}>
                <Link href={jobHref(job, step.key)} className="flex min-h-12 items-center justify-between gap-3 py-2 hover:bg-slate-50">
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                        step.done ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {step.done ? "✓" : ""}
                    </span>
                    <span className="text-sm font-medium text-slate-900">{step.label}</span>
                  </span>
                  <span className="text-xs text-slate-500">{step.done ? "Done" : step.optional ? "Optional" : "Open"} ›</span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>

        {towStarted ? (
          <Card>
            <SectionTitle right={<Chip tone={file.complete ? "good" : "bad"}>{file.complete ? "Complete" : "Incomplete"}</Chip>}>
              Compliance file
            </SectionTitle>
            {file.complete ? (
              <Banner tone="good" title="Compliance file complete">
                Records kept on file until {formatDate(file.retainUntil)} (3 years).
              </Banner>
            ) : (
              <Banner tone="bad" title={`Compliance incomplete: ${file.problems[0]}`}>
                {file.problems.length > 1 ? `Also: ${file.problems.slice(1).join(", ")}.` : "Fix it below."}
              </Banner>
            )}
            <div className="mt-3 space-y-2">
              {file.items.map((item) => (
                <CheckRow
                  key={item.key}
                  ok={item.ok}
                  label={item.label}
                  detail={item.detail}
                  action={
                    item.ok || item.key === "archived" ? null : (
                      <Link href={jobHref(job, item.fix)} className="shrink-0 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white">
                        Fix it
                      </Link>
                    )
                  }
                />
              ))}
            </div>
          </Card>
        ) : null}

        {towStarted ? (
          <Card>
            <SectionTitle>Locations and times</SectionTitle>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-slate-500">Pickup</dt>
              <dd>{job.pickup || "—"}</dd>
              <dt className="text-slate-500">Destination</dt>
              <dd>{job.destination || "—"}</dd>
              {TOW_EVENTS.map((e) => (
                <FragmentRow key={e} label={TOW_EVENT_LABELS[e]} value={formatDateTime(job.tow[e])} />
              ))}
            </dl>
            {job.destinationChanges.map((c) => (
              <p key={c.id} className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
                Moved from “{c.from}” to “{c.to}” — authorized by {c.authorizedBy} ({c.reason}). Owner notified by {c.ownerNotifiedVia.toLowerCase()} · {formatDateTime(c.notifiedAt)}
              </p>
            ))}
          </Card>
        ) : null}

        <Card>
          <SectionTitle>Records</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {estimate ? (
              <LinkButton href={`/e/${estimate.token}`} variant="secondary" target="_blank">
                Estimate v{estimate.version}
              </LinkButton>
            ) : (
              <DisabledRecord label="No estimate" />
            )}
            {job.consents.length > 0 ? (
              <button
                type="button"
                onClick={() => setOpen(open === "consent" ? null : "consent")}
                className="min-h-12 rounded-xl bg-white px-4 font-semibold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50"
              >
                Consent ({job.consents.length})
              </button>
            ) : (
              <DisabledRecord label="No consent" />
            )}
            {invoice ? (
              <LinkButton href={`/i/${invoice.token}`} variant="secondary" target="_blank">
                {invoice.number}
              </LinkButton>
            ) : (
              <DisabledRecord label="No invoice" />
            )}
            <button
              type="button"
              onClick={() => setOpen(open === "audit" ? null : "audit")}
              className="min-h-12 rounded-xl bg-white px-4 font-semibold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50"
            >
              Audit trail
            </button>
          </div>
          {invoice ? (
            <p className="mt-3 text-sm text-slate-600">
              Payments recorded: {formatMoney(paid)} of {formatMoney(invoice.totalCents)}
            </p>
          ) : null}
          {open === "consent" ? (
            <div className="mt-3 space-y-2">
              {job.consents.map((c) => (
                <ConsentRecord key={c.id} consent={c} />
              ))}
            </div>
          ) : null}
          {open === "audit" ? (
            <div className="mt-3">
              <AuditTrail entries={job.audit} />
            </div>
          ) : null}
          <button
            type="button"
            onClick={exportJobFile}
            className="mt-3 min-h-12 w-full rounded-xl bg-slate-900 px-4 font-semibold text-white hover:bg-slate-800"
          >
            Export job file
          </button>
        </Card>
      </div>
    </PageShell>
  );
}

function FragmentRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function DisabledRecord({ label }: { label: string }) {
  return <span className="flex min-h-12 items-center justify-center rounded-xl bg-slate-100 px-4 text-sm font-medium text-slate-400">{label}</span>;
}
