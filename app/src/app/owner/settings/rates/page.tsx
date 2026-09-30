"use client";

import { useState } from "react";

import { AdminHeader, isOwner, SavedNote } from "@/components/admin";
import { Button, Card, ErrorText, Field, inputClass, Loading } from "@/components/ui";
import type { RateCard } from "@/lib/domain";
import { GuardrailError, newId } from "@/lib/jobs";
import { formatMoney, parseDollars } from "@/lib/money";
import type { AppState } from "@/lib/seed";
import { attempt, setAppState, useAppState } from "@/lib/store";

type MoneyKey = "baseTowCents" | "perKmCents" | "winchCents" | "afterHoursCents" | "storagePerDayCents";

const RATE_FIELDS: { key: MoneyKey; label: string; unit?: string }[] = [
  { key: "baseTowCents", label: "Base tow" },
  { key: "perKmCents", label: "Mileage", unit: "per km" },
  { key: "winchCents", label: "Winching" },
  { key: "afterHoursCents", label: "After-hours" },
  { key: "storagePerDayCents", label: "Storage", unit: "per day" },
];

type Draft = Omit<RateCard, MoneyKey> & Record<MoneyKey, string>;

const toDraft = (r: RateCard): Draft => ({ ...r, ...(Object.fromEntries(RATE_FIELDS.map(({ key }) => [key, (r[key] / 100).toFixed(2)])) as Record<MoneyKey, string>) });

export default function RatesPage() {
  const app = useAppState();
  if (!app) return <Loading />;
  return <Rates app={app} />;
}

function Rates({ app }: { app: AppState }) {
  const owner = isOwner(app);
  const [drafts, setDrafts] = useState<Draft[]>(() => app.rateCards.map(toDraft));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (id: string, patch: Partial<Draft>) => {
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    setSaved(false);
  };

  const save = () => {
    const failure = attempt(() => {
      const rateCards = drafts.map((d) => {
        if (!d.name.trim()) throw new GuardrailError("Every rate card needs a name.");
        const card = { id: d.id, name: d.name.trim(), description: d.description.trim() } as RateCard;
        for (const { key, label } of RATE_FIELDS) {
          const cents = parseDollars(d[key]);
          if (cents === null) throw new GuardrailError(`Enter a dollar amount for ${label} on “${d.name}”.`);
          card[key] = cents;
        }
        return card;
      });
      setAppState((s) => ({ ...s, rateCards }));
    });
    setError(failure);
    setSaved(!failure);
  };

  const add = () => {
    const base = app.rateCards[0];
    setDrafts((ds) => [...ds, toDraft({ ...base, id: newId("rc-"), name: "New rate card", description: "" })]);
  };

  return (
    <>
      <AdminHeader kicker="Company setup · Rate cards" title="Rate cards">
        Estimates are built from these rates. Each workflow chooses which rate card it uses — e.g. preset contract rates for motor-club calls.
      </AdminHeader>

      <fieldset disabled={!owner} className="space-y-4">
        {drafts.map((d) => {
          const usedBy = app.workflows.filter((w) => w.rateCardId === d.id);
          return (
            <Card key={d.id}>
              <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
                <Field label="Rate card name">
                  <input className={`${inputClass} font-semibold`} value={d.name} onChange={(e) => update(d.id, { name: e.target.value })} />
                </Field>
                <Field label="Description" optional>
                  <input className={inputClass} value={d.description} onChange={(e) => update(d.id, { description: e.target.value })} />
                </Field>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                {RATE_FIELDS.map(({ key, label, unit }) => {
                  const cents = parseDollars(d[key]);
                  return (
                    <Field key={key} label={label} hint={cents === null ? <span className="text-danger">Invalid amount</span> : `${formatMoney(cents)}${unit ? ` ${unit}` : ""}`}>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
                        <input className={`${inputClass} pl-7 tabular-nums`} inputMode="decimal" value={d[key]} onChange={(e) => update(d.id, { [key]: e.target.value })} />
                      </div>
                    </Field>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-muted">
                {usedBy.length ? `Used by ${usedBy.map((w) => `Workflow ${w.letter} (${w.name})`).join(", ")}` : "Not used by any workflow yet."}
              </p>
            </Card>
          );
        })}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save}>Save rate cards</Button>
          <Button variant="secondary" icon="plus" onClick={add}>
            Add rate card
          </Button>
          <SavedNote show={saved}>Saved. New estimates use the updated rates; issued estimates don&apos;t change.</SavedNote>
        </div>
        <ErrorText message={error} />
      </fieldset>
    </>
  );
}
