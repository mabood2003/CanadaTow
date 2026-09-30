"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { IconName } from "@/components/icons";
import { JobScreen, StepHeader, type JobContext } from "@/components/job-screen";
import { Banner, Button, ChoiceButton, ErrorText, Field, inputClass, PageShell } from "@/components/ui";
import { GuardrailError, recordRequest } from "@/lib/jobs";
import { jobHref } from "@/lib/job-steps";
import { attempt, mutateJob, rateCardFor, workflowForType } from "@/lib/store";

const ICONS: Record<string, IconName> = {
  owner_customer: "users",
  owner_rep: "users",
  motor_club: "truck",
  insurance: "shieldCheck",
  police: "shieldCheck",
  municipality: "building",
  private_property: "mapPin",
  other: "info",
};

export default function RequestStepPage() {
  return <JobScreen>{(ctx) => <RequestForm {...ctx} />}</JobScreen>;
}

function RequestForm({ app, job }: JobContext) {
  const router = useRouter();
  const prefill = job.prefill ?? {};
  const [typeId, setTypeId] = useState(job.requestTypeId ?? prefill.requestTypeId ?? null);
  const [requestOther, setRequestOther] = useState(job.requestOther);
  const [contactName, setContactName] = useState(job.contactName || prefill.contactName || "");
  const [contactReference, setContactReference] = useState(job.contactReference || prefill.contactReference || "");
  const [error, setError] = useState<string | null>(null);

  const options = app.requestTypes.filter((t) => t.enabled || t.id === job.requestTypeId);
  const selected = app.requestTypes.find((t) => t.id === typeId);
  const workflow = workflowForType(app, selected);
  const locked = Boolean(job.tow.secured);

  const save = () => {
    const failure = attempt(() => {
      if (!selected) throw new GuardrailError("Choose who requested this tow.");
      if (!workflow) throw new GuardrailError(`${app.company.name} hasn't mapped “${selected.label}” to a workflow yet. An owner can set it in Company setup → Workflows.`);
      mutateJob(job.id, (j, actor) =>
        recordRequest(j, actor, { requestType: selected, workflow, rateCard: rateCardFor(app, workflow), requestOther, contactName, contactReference }),
      );
      router.replace(jobHref(job, "workflow"));
    });
    setError(failure);
  };

  return (
    <PageShell>
      <StepHeader job={job} step="request" title="Who requested or initiated this tow?" />

      <fieldset disabled={locked} className="space-y-7">
        {locked ? <Banner tone="neutral">The tow has started, so the request is locked.</Banner> : null}

        <div className="grid gap-2" role="radiogroup" aria-label="Who requested this tow">
          {options.map((t) => (
            <ChoiceButton key={t.id} selected={typeId === t.id} onClick={() => setTypeId(t.id)} title={t.label} icon={ICONS[t.id] ?? "info"} />
          ))}
        </div>

        {selected?.id === "other" ? (
          <Field label="Who requested it?">
            <input className={inputClass} value={requestOther} onChange={(e) => setRequestOther(e.target.value)} placeholder="e.g. fleet manager, dealership" />
          </Field>
        ) : null}

        <div className="rounded-lg border border-line bg-paper p-4">
          <h2 className="text-lg font-extrabold tracking-tight">Who contacted or invited your company?</h2>
          <p className="mb-4 mt-1 text-sm text-muted">Recorded with the job for your records.</p>
          <div className="space-y-3">
            <Field label="Name or organization">
              <input className={inputClass} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="e.g. John Smith, Constable Patel, club dispatch" />
            </Field>
            <Field
              label={workflow?.requireReference ? workflow.referenceLabel : "Reference number"}
              optional={!workflow?.requireReference}
              hint={workflow?.requireReference ? `${app.company.name}'s Workflow ${workflow.letter} asks for this before the tow.` : "Dispatch, claim, file or PO number, if there is one."}
            >
              <input className={inputClass} value={contactReference} onChange={(e) => setContactReference(e.target.value)} />
            </Field>
          </div>
        </div>
      </fieldset>

      <div className="mt-6 space-y-3">
        <ErrorText message={error} />
        {!locked ? (
          <Button size="lg" full onClick={save} disabled={!selected}>
            Continue
          </Button>
        ) : null}
      </div>
    </PageShell>
  );
}
