"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { JobScreen, StepHeader, type JobContext } from "@/components/job-screen";
import { Banner, Button, ErrorText, Field, inputClass, PageShell } from "@/components/ui";
import { INVITED_BY_OPTIONS } from "@/lib/domain";
import { GuardrailError, updateDetails } from "@/lib/jobs";
import { nextHref } from "@/lib/job-steps";
import { attempt, mutateJob } from "@/lib/store";
import { resolveWorkflow, workflowSummary } from "@/lib/tow-rules";

export default function RequestStepPage() {
  return <JobScreen>{(ctx) => <RequestForm {...ctx} />}</JobScreen>;
}

function RequestForm({ app, job, type }: JobContext) {
  const router = useRouter();
  const [typeId, setTypeId] = useState(job.requestTypeId);
  const [requestOther, setRequestOther] = useState(job.requestOther);
  const [invitedBy, setInvitedBy] = useState(job.invitedBy);
  const [invitedByOther, setInvitedByOther] = useState(job.invitedByOther);
  const [exemptReason, setExemptReason] = useState(job.exemptReason);
  const [error, setError] = useState<string | null>(null);

  const selected = app.requestTypes.find((t) => t.id === typeId);
  const resolved = resolveWorkflow(selected);
  const locked = Boolean(job.tow.secured);

  const save = () => {
    const failure = attempt(() => {
      if (!selected) throw new GuardrailError("Choose who requested this tow.");
      if (selected.id === "other" && !requestOther.trim()) throw new GuardrailError("Describe who requested the tow.");
      if (!invitedBy) throw new GuardrailError("Record who contacted or invited your company.");
      if (invitedBy === "Other" && !invitedByOther.trim()) throw new GuardrailError("Describe who contacted your company.");
      if (resolved.runs === "exempt" && !exemptReason.trim()) throw new GuardrailError("Record the reason (e.g. police file number and officer).");

      const updated = mutateJob(job.id, (j, actor) =>
        updateDetails(
          j,
          actor,
          {
            requestTypeId: selected.id,
            requestOther: selected.id === "other" ? requestOther.trim() : "",
            invitedBy,
            invitedByOther: invitedBy === "Other" ? invitedByOther.trim() : "",
            exemptReason: resolved.runs === "exempt" ? exemptReason.trim() : "",
          },
          `Request recorded: ${selected.label}${selected.id === "other" ? ` (${requestOther.trim()})` : ""}; contacted by: ${
            invitedBy === "Other" ? invitedByOther.trim() : invitedBy
          }`,
        ),
      );
      router.replace(nextHref(updated, selected, "request"));
    });
    setError(failure);
  };

  return (
    <PageShell>
      <StepHeader job={job} type={type} title="Who requested this tow?" />

      <fieldset disabled={locked} className="space-y-6">
        {locked ? <Banner tone="neutral">The tow has started, so the request type is locked.</Banner> : null}

        <div className="grid gap-2" role="radiogroup" aria-label="Who requested this tow">
          {app.requestTypes.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={typeId === t.id}
              onClick={() => setTypeId(t.id)}
              className={`min-h-14 rounded-2xl px-4 text-left text-base font-semibold ring-1 transition ${
                typeId === t.id ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-900 ring-slate-300 hover:ring-slate-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {selected?.id === "other" ? (
          <Field label="Who requested it?">
            <input className={inputClass} value={requestOther} onChange={(e) => setRequestOther(e.target.value)} placeholder="e.g. fleet manager, dealership" />
          </Field>
        ) : null}

        {selected ? (
          <Banner tone={resolved.runs === "exempt" ? "info" : "good"} title={workflowSummary(resolved)}>
            {resolved.runs === "exempt" ? (
              <div className="mt-2">
                <Field label="Reason for the different workflow" hint="e.g. police file number, officer name and badge, reason for tow.">
                  <textarea className={`${inputClass} min-h-24`} value={exemptReason} onChange={(e) => setExemptReason(e.target.value)} />
                </Field>
              </div>
            ) : resolved.toConfirm ? (
              <p className="text-xs">Internal: classification to be confirmed — the full consumer workflow applies.</p>
            ) : null}
          </Banner>
        ) : null}

        <div>
          <h2 className="mb-1 text-lg font-bold text-slate-900">Who contacted or invited your company?</h2>
          <p className="mb-3 text-sm text-slate-600">Recorded on every job for the 200 m collision-scene rule.</p>
          <div className="grid gap-2">
            {INVITED_BY_OPTIONS.map((option) => (
              <label
                key={option}
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 ring-1 ${
                  invitedBy === option ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-900 ring-slate-300"
                }`}
              >
                <input type="radio" name="invitedBy" className="h-5 w-5 accent-emerald-500" checked={invitedBy === option} onChange={() => setInvitedBy(option)} />
                <span className="text-sm font-medium">{option}</span>
              </label>
            ))}
          </div>
          {invitedBy === "Other" ? (
            <div className="mt-3">
              <Field label="Describe who contacted you">
                <input className={inputClass} value={invitedByOther} onChange={(e) => setInvitedByOther(e.target.value)} />
              </Field>
            </div>
          ) : null}
        </div>
      </fieldset>

      <div className="mt-6 space-y-3">
        <ErrorText message={error} />
        {!locked ? (
          <Button size="lg" full onClick={save}>
            Save and continue
          </Button>
        ) : null}
      </div>
    </PageShell>
  );
}
