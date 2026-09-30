"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { JobScreen, StepHeader, type JobContext } from "@/components/job-screen";
import { Banner, Button, ErrorText, Field, inputClass, PageShell, Segmented } from "@/components/ui";
import { CONSENT_METHOD_LABELS, RELATIONSHIPS } from "@/lib/domain";
import { GuardrailError, updateDetails } from "@/lib/jobs";
import { nextHref } from "@/lib/job-steps";
import { attempt, mutateJob } from "@/lib/store";

export default function CustomerStepPage() {
  return <JobScreen>{(ctx) => <CustomerForm {...ctx} />}</JobScreen>;
}

function CustomerForm({ app, job }: JobContext) {
  const router = useRouter();
  const [customer, setCustomer] = useState(job.customer.name ? job.customer : (job.prefill?.customer ?? job.customer));
  const [error, setError] = useState<string | null>(null);
  const needsContact = Boolean(job.workflow?.requireEstimate);
  const set = (patch: Partial<typeof customer>) => setCustomer((c) => ({ ...c, ...patch }));

  const remoteMethods = (["link", "audio", "paper_photo"] as const).filter((m) => app.consentMethods[m]).map((m) => CONSENT_METHOD_LABELS[m].toLowerCase());

  const save = () => {
    const failure = attempt(() => {
      const trimmed = { ...customer, name: customer.name.trim(), mobile: customer.mobile.trim(), email: customer.email.trim() };
      if (needsContact) {
        if (!trimmed.name) throw new GuardrailError("Enter the customer's or authorized person's full name.");
        if (!trimmed.mobile && !trimmed.email) throw new GuardrailError("Enter a phone number or email — the estimate shows a contact detail.");
      }
      if (trimmed.email && !/^\S+@\S+\.\S+$/.test(trimmed.email)) throw new GuardrailError("That email address doesn't look right.");
      const updated = mutateJob(job.id, (j, actor) =>
        updateDetails(j, actor, { customer: trimmed }, `Customer recorded: ${trimmed.name || "(no name)"} (${trimmed.relationship}), ${trimmed.present ? "present" : "not present"}`),
      );
      router.replace(nextHref(updated, "customer"));
    });
    setError(failure);
  };

  return (
    <PageShell>
      <StepHeader job={job} step="customer" title={needsContact ? "Customer / authorized person" : "Owner details"} />
      <div className="space-y-4">
        {!needsContact ? (
          <Banner tone="neutral">Optional for {job.workflow ? `Workflow ${job.workflow.letter}` : "this job"} — record the owner if known. You can add it at release.</Banner>
        ) : null}
        <Field label="Full name">
          <input className={inputClass} autoComplete="name" value={customer.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Phone">
          <input className={inputClass} type="tel" inputMode="tel" autoComplete="tel" value={customer.mobile} onChange={(e) => set({ mobile: e.target.value })} placeholder="(403) 555-0100" />
        </Field>
        <Field label="Email" optional>
          <input className={inputClass} type="email" inputMode="email" autoComplete="email" value={customer.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="Relationship to vehicle">
          <select className={inputClass} value={customer.relationship} onChange={(e) => set({ relationship: e.target.value })}>
            {RELATIONSHIPS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink">Customer present?</p>
          <Segmented
            label="Customer present"
            value={customer.present ? "yes" : "no"}
            onChange={(v) => set({ present: v === "yes" })}
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
          />
        </div>
        {!customer.present && needsContact ? (
          <Banner tone="info" icon="smartphone" title="Remote methods available">
            The estimate can go by text or email, and consent can use {remoteMethods.join(", ") || "your company's remote process"}. Signature on the driver&apos;s device needs the customer on scene.
          </Banner>
        ) : null}
        <ErrorText message={error} />
        <Button size="lg" full onClick={save}>
          Save and continue
        </Button>
      </div>
    </PageShell>
  );
}
