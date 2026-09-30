"use client";

import { useState } from "react";

import { AdminHeader, isOwner, SavedNote } from "@/components/admin";
import { Icon } from "@/components/icons";
import { Button, Card, ErrorText, Field, inputClass, Loading, SectionTitle, Toggle } from "@/components/ui";
import type { RequestType, Workflow } from "@/lib/domain";
import { GuardrailError } from "@/lib/jobs";
import type { AppState } from "@/lib/seed";
import { attempt, setAppState, useAppState } from "@/lib/store";
import { normalizeWorkflow, workflowStepLabels } from "@/lib/tow-rules";

export default function WorkflowsPage() {
  const app = useAppState();
  if (!app) return <Loading />;
  return <Workflows app={app} />;
}

function StepChips({ workflow }: { workflow: Workflow }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {workflowStepLabels(workflow).map((s, i, all) => (
        <span key={s} className="inline-flex items-center gap-1 text-xs">
          <span className="rounded bg-mint px-1.5 py-0.5 font-semibold text-pine">{s}</span>
          {i < all.length - 1 ? <Icon name="chevronRight" className="h-3 w-3 text-subtle" /> : null}
        </span>
      ))}
    </span>
  );
}

function Workflows({ app }: { app: AppState }) {
  const owner = isOwner(app);
  const [types, setTypes] = useState<RequestType[]>(app.requestTypes);
  const [workflows, setWorkflows] = useState<Workflow[]>(app.workflows);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setType = (id: string, patch: Partial<RequestType>) => {
    setTypes((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setSaved(false);
  };
  const setWorkflow = (id: string, patch: Partial<Workflow>) => {
    setWorkflows((ws) => ws.map((w) => (w.id === id ? normalizeWorkflow({ ...w, ...patch }) : w)));
    setSaved(false);
  };

  const save = () => {
    const failure = attempt(() => {
      if (workflows.some((w) => !w.name.trim())) throw new GuardrailError("Every workflow needs a name.");
      if (!types.some((t) => t.enabled)) throw new GuardrailError("Enable at least one job category.");
      setAppState((s) => ({ ...s, requestTypes: types, workflows: workflows.map((w) => ({ ...w, name: w.name.trim() })) }));
    });
    setError(failure);
    setSaved(!failure);
  };

  const byId = (id: string) => workflows.find((w) => w.id === id);

  return (
    <>
      <AdminHeader kicker="Company setup · Workflows" title="Job categories and workflows">
        {app.company.name} chooses which workflow each job category follows and which steps are required before the tow. TowLedger enforces the steps you turn on — it doesn&apos;t decide which rules apply to a job.
      </AdminHeader>

      <fieldset disabled={!owner} className="space-y-5">
        <Card padded={false}>
          <div className="p-4 pb-0 sm:p-5 sm:pb-0">
            <SectionTitle>Who requested the tow → workflow</SectionTitle>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-y border-line-soft bg-[#f5f6f2] font-mono text-[10px] uppercase tracking-[0.08em] text-subtle">
                <tr>
                  <th className="px-5 py-3 font-bold">Job category</th>
                  <th className="px-3 py-3 font-bold">Enabled</th>
                  <th className="px-3 py-3 font-bold">Workflow</th>
                  <th className="px-5 py-3 font-bold">Steps drivers see</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {types.map((t) => {
                  const w = byId(t.workflowId);
                  return (
                    <tr key={t.id} className={t.enabled ? "" : "opacity-55"}>
                      <td className="px-5 py-3 font-semibold">{t.label}</td>
                      <td className="px-3 py-3">
                        <input type="checkbox" aria-label={`Enable ${t.label}`} className="h-5 w-5 accent-[#24573d]" checked={t.enabled} onChange={(e) => setType(t.id, { enabled: e.target.checked })} />
                      </td>
                      <td className="px-3 py-3">
                        <select aria-label={`Workflow for ${t.label}`} className={`${inputClass} w-64 py-2`} value={t.workflowId} onChange={(e) => setType(t.id, { workflowId: e.target.value })}>
                          {workflows.map((wf) => (
                            <option key={wf.id} value={wf.id}>
                              {wf.letter} — {wf.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-3">{w ? <StepChips workflow={w} /> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          {workflows.map((w) => {
            const categories = types.filter((t) => t.workflowId === w.id);
            return (
              <Card key={w.id}>
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-forest text-lg font-extrabold text-signal">{w.letter}</span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <input aria-label="Workflow name" className={`${inputClass} py-2 text-lg font-bold`} value={w.name} onChange={(e) => setWorkflow(w.id, { name: e.target.value })} />
                    <textarea aria-label="Description" className={`${inputClass} min-h-16 py-2 text-sm`} value={w.description} onChange={(e) => setWorkflow(w.id, { description: e.target.value })} />
                  </div>
                </div>
                <div className="mt-2 divide-y divide-line-soft">
                  <Toggle checked={w.requireReference} onChange={(v) => setWorkflow(w.id, { requireReference: v })} label="Requester reference before tow" detail="e.g. police file number, dispatch or PO number" />
                  {w.requireReference ? (
                    <div className="pb-3">
                      <Field label="What to call it">
                        <input className={`${inputClass} py-2`} value={w.referenceLabel} onChange={(e) => setWorkflow(w.id, { referenceLabel: e.target.value })} />
                      </Field>
                    </div>
                  ) : null}
                  <Toggle checked={w.requireEstimate} disabled={w.requireConsent} onChange={(v) => setWorkflow(w.id, { requireEstimate: v })} label="Estimate delivered before tow" detail={w.requireConsent ? "Required because consent is on" : "Driver can't start the tow until the customer has a copy"} />
                  <Toggle checked={w.requireConsent} onChange={(v) => setWorkflow(w.id, { requireConsent: v })} label="Company consent step before tow" detail="Uses your consent template and enabled methods" />
                  <Toggle checked={w.requireDestination} onChange={(v) => setWorkflow(w.id, { requireDestination: v })} label="Destination recorded before tow" detail="Driver records who supplied or confirmed it" />
                  <div className="pt-3">
                    <Field label="Rate card">
                      <select className={`${inputClass} py-2`} value={w.rateCardId} onChange={(e) => setWorkflow(w.id, { rateCardId: e.target.value })}>
                        {app.rateCards.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>
                <div className="mt-4 rounded-md bg-paper p-3">
                  <StepChips workflow={w} />
                  <p className="mt-2 text-xs text-muted">{categories.length ? `Used for: ${categories.map((c) => c.label).join(", ")}` : "No job categories use this workflow."}</p>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-4 rounded-lg border border-line bg-paper/95 p-3 backdrop-blur">
          <Button onClick={save}>Save workflows</Button>
          <SavedNote show={saved}>Saved. New jobs follow this configuration; jobs already in progress keep their workflow.</SavedNote>
        </div>
        <ErrorText message={error} />
      </fieldset>
    </>
  );
}
