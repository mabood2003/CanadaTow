"use client";

import { useState } from "react";

import { AdminHeader, isOwner, SavedNote } from "@/components/admin";
import { Button, Card, Field, inputClass, Loading, SectionTitle } from "@/components/ui";
import type { AppState } from "@/lib/seed";
import { setAppState, useAppState } from "@/lib/store";

export default function TemplatesPage() {
  const app = useAppState();
  if (!app) return <Loading />;
  return <Templates app={app} />;
}

function Templates({ app }: { app: AppState }) {
  const owner = isOwner(app);
  const [draft, setDraft] = useState(app.documentTemplates);
  const [saved, setSaved] = useState(false);

  return (
    <>
      <AdminHeader kicker="Company setup · Templates" title="Document templates">
        Company-defined text printed on every customer estimate and invoice, under your business name, address and GST number. Issued documents keep the text they were issued with.
      </AdminHeader>

      <fieldset disabled={!owner} className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <SectionTitle>Estimate template</SectionTitle>
            <Field label="Notes shown on the estimate" hint="e.g. what the estimate covers, how to ask questions, yard release hours.">
              <textarea
                className={`${inputClass} min-h-40`}
                value={draft.estimateNotes}
                onChange={(e) => {
                  setDraft({ ...draft, estimateNotes: e.target.value });
                  setSaved(false);
                }}
              />
            </Field>
            <p className="mt-3 text-xs text-muted">Always included automatically: company details, customer and vehicle, pickup and destination, itemized charges with GST, storage rate per day.</p>
          </Card>
          <Card>
            <SectionTitle>Invoice template</SectionTitle>
            <Field label="Notes shown on the invoice" hint="e.g. accepted payment methods, terms, thank-you line.">
              <textarea
                className={`${inputClass} min-h-40`}
                value={draft.invoiceNotes}
                onChange={(e) => {
                  setDraft({ ...draft, invoiceNotes: e.target.value });
                  setSaved(false);
                }}
              />
            </Field>
            <p className="mt-3 text-xs text-muted">Always included automatically: invoice number, customer, vehicle, service locations, tow times, itemized charges with GST.</p>
          </Card>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button
            onClick={() => {
              setAppState((s) => ({ ...s, documentTemplates: { estimateNotes: draft.estimateNotes.trim(), invoiceNotes: draft.invoiceNotes.trim() } }));
              setSaved(true);
            }}
          >
            Save templates
          </Button>
          <SavedNote show={saved}>Saved. New estimates and invoices use this text.</SavedNote>
        </div>
      </fieldset>
    </>
  );
}
