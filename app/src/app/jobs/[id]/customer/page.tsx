"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { JobScreen, StepHeader, type JobContext } from "@/components/job-screen";
import { Banner, Button, Checkbox, ErrorText, Field, inputClass, PageShell } from "@/components/ui";
import { RELATIONSHIPS } from "@/lib/domain";
import { GuardrailError, updateDetails } from "@/lib/jobs";
import { nextHref } from "@/lib/job-steps";
import { attempt, mutateJob } from "@/lib/store";
import { resolveWorkflow } from "@/lib/tow-rules";

export default function CustomerStepPage() {
  return <JobScreen>{(ctx) => <CustomerForm {...ctx} />}</JobScreen>;
}

function CustomerForm({ job, type }: JobContext) {
  const router = useRouter();
  const [customer, setCustomer] = useState(job.customer);
  const [error, setError] = useState<string | null>(null);
  const exempt = resolveWorkflow(type).runs === "exempt";
  const set = (patch: Partial<typeof customer>) => setCustomer((c) => ({ ...c, ...patch }));

  const save = () => {
    const failure = attempt(() => {
      const trimmed = { ...customer, name: customer.name.trim(), mobile: customer.mobile.trim(), email: customer.email.trim() };
      if (!exempt) {
        if (!trimmed.name) throw new GuardrailError("Enter the consenting person's full name.");
        if (!trimmed.mobile && !trimmed.email) throw new GuardrailError("Enter a mobile number or email — the estimate must show a contact detail.");
      }
      if (trimmed.email && !/^\S+@\S+\.\S+$/.test(trimmed.email)) throw new GuardrailError("That email address doesn't look right.");
      const updated = mutateJob(job.id, (j, actor) =>
        updateDetails(j, actor, { customer: trimmed }, `${exempt ? "Owner" : "Consenting person"} recorded: ${trimmed.name || "(no name)"} (${trimmed.relationship})`),
      );
      router.replace(nextHref(updated, type, "customer"));
    });
    setError(failure);
  };

  return (
    <PageShell>
      <StepHeader job={job} type={type} title={exempt ? "Owner details" : "Consenting person"} />
      <div className="space-y-4">
        {exempt ? <Banner tone="info">Optional for police / government tows — record the owner if known.</Banner> : null}
        <Field label="Full name">
          <input className={inputClass} autoComplete="name" value={customer.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Mobile number">
          <input className={inputClass} type="tel" inputMode="tel" autoComplete="tel" value={customer.mobile} onChange={(e) => set({ mobile: e.target.value })} placeholder="(403) 555-0100" />
        </Field>
        <Field label="Email (optional)">
          <input className={inputClass} type="email" inputMode="email" autoComplete="email" value={customer.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="Relationship to the vehicle">
          <select className={inputClass} value={customer.relationship} onChange={(e) => set({ relationship: e.target.value })}>
            {RELATIONSHIPS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        {!exempt ? (
          <>
            <Checkbox checked={customer.present} onChange={(present) => set({ present })}>
              Customer is physically present
            </Checkbox>
            {!customer.present ? (
              <Banner tone="warn" title="Customer isn't here">
                Send the estimate by text or email, then get consent through the estimate link — or record audio consent over the phone.
              </Banner>
            ) : null}
          </>
        ) : null}
        <ErrorText message={error} />
        <Button size="lg" full onClick={save}>
          Save and continue
        </Button>
      </div>
    </PageShell>
  );
}
