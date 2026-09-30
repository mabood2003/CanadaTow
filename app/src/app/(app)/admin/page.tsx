"use client";

import Link from "next/link";
import { useState } from "react";

import { AdminHeader, isOwner, ProductBoundary, SavedNote } from "@/components/admin";
import { Icon, type IconName } from "@/components/icons";
import { Button, Card, CompanyMark, ErrorText, Field, inputClass, Loading, SectionTitle } from "@/components/ui";
import { CONSENT_METHOD_SHORT, CONSENT_METHODS } from "@/lib/domain";
import { GuardrailError, newId } from "@/lib/jobs";
import { formatMoney } from "@/lib/money";
import type { AppState } from "@/lib/seed";
import { activeConsentTemplate, attempt, setAppState, useAppState } from "@/lib/store";
import { formatPlainDate } from "@/lib/time";

export default function AdminOverview() {
  const app = useAppState();
  if (!app) return <Loading />;
  return <CompanyProfile app={app} />;
}

function readLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 256 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function CompanyProfile({ app }: { app: AppState }) {
  const owner = isOwner(app);
  const [company, setCompany] = useState(app.company);
  const [yard, setYard] = useState(app.yards[0] ?? { id: newId("yard-"), name: "", address: "", hours: "" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof company>) => {
    setCompany((c) => ({ ...c, ...patch }));
    setSaved(false);
  };

  const save = () => {
    const failure = attempt(() => {
      if (!company.name.trim() || !company.address.trim() || !company.phone.trim()) {
        throw new GuardrailError("Business name, address and phone are required — they appear on every estimate and invoice.");
      }
      if (!yard.name.trim() || !yard.address.trim()) throw new GuardrailError("Enter your storage yard's name and address.");
      setAppState((s) => ({ ...s, company, yards: [yard, ...s.yards.slice(1)] }));
    });
    setError(failure);
    setSaved(!failure);
  };

  const template = activeConsentTemplate(app);
  const enabledCategories = app.requestTypes.filter((t) => t.enabled).length;
  const enabledMethods = CONSENT_METHODS.filter((m) => app.consentMethods[m]);

  const summary: { href: string; icon: IconName; title: string; value: string; detail: string }[] = [
    { href: "/admin/rates", icon: "receipt", title: "Rate cards", value: `${app.rateCards.length}`, detail: app.rateCards.map((r) => `${r.name} (base ${formatMoney(r.baseTowCents)})`).join(" · ") },
    { href: "/admin/workflows", icon: "workflow", title: "Job categories", value: `${enabledCategories} of ${app.requestTypes.length} enabled`, detail: `Mapped to Workflows ${app.workflows.map((w) => w.letter).join(", ")}` },
    { href: "/admin/consent", icon: "shieldCheck", title: "Consent methods", value: `${enabledMethods.length} enabled`, detail: enabledMethods.map((m) => CONSENT_METHOD_SHORT[m]).join(" · ") },
    { href: "/admin/consent", icon: "history", title: "Consent template", value: `Version ${template.version}`, detail: `Effective ${formatPlainDate(template.effectiveDate)} · ${template.updatedBy}` },
    { href: "/admin/templates", icon: "fileText", title: "Document templates", value: "Estimate & invoice", detail: "Company notes shown to customers" },
    { href: "/admin/team", icon: "users", title: "Team", value: `${app.team.length} people`, detail: app.team.map((m) => m.name.split(" ")[0]).join(", ") },
  ];

  return (
    <>
      <AdminHeader kicker="Company setup · Your company's process" title={`${app.company.name} configuration`}>
        Your company&apos;s information, rates, job categories, consent wording and templates. Drivers follow what you configure here; past jobs keep exactly what they captured.
      </AdminHeader>

      <ProductBoundary company={app.company.name} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {summary.map((s) => (
          <Link key={s.title} href={s.href} className="group rounded-lg border border-line bg-paper p-4 transition hover:border-pine/50">
            <div className="flex items-center justify-between">
              <Icon name={s.icon} className="h-6 w-6 text-pine" />
              <Icon name="arrowRight" className="h-4 w-4 text-subtle transition group-hover:translate-x-0.5 group-hover:text-pine" />
            </div>
            <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{s.title}</p>
            <p className="mt-1 text-lg font-extrabold tracking-tight">{s.value}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted">{s.detail}</p>
          </Link>
        ))}
      </div>

      <fieldset disabled={!owner} className="space-y-5">
        <Card>
          <SectionTitle>Company profile</SectionTitle>
          <div className="grid gap-5 md:grid-cols-[160px_1fr]">
            <div>
              <p className="mb-1.5 text-sm font-semibold">Logo</p>
              <div className="flex items-center gap-3 md:flex-col md:items-start">
                <CompanyMark company={company} size="lg" />
                <div className="flex flex-col gap-1">
                  <label className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 text-sm font-semibold text-pine ${owner ? "" : "pointer-events-none opacity-50"}`}>
                    <Icon name="upload" className="h-4 w-4" /> Upload logo
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) set({ logo: await readLogo(file) });
                      }}
                    />
                  </label>
                  {company.logo ? (
                    <button type="button" className="text-left text-xs text-muted underline" onClick={() => set({ logo: undefined })}>
                      Use initials instead
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Business name">
                  <input className={inputClass} value={company.name} onChange={(e) => set({ name: e.target.value })} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Business address">
                  <input className={inputClass} value={company.address} onChange={(e) => set({ address: e.target.value })} />
                </Field>
              </div>
              <Field label="Phone">
                <input className={inputClass} type="tel" value={company.phone} onChange={(e) => set({ phone: e.target.value })} />
              </Field>
              <Field label="Email">
                <input className={inputClass} type="email" value={company.email} onChange={(e) => set({ email: e.target.value })} />
              </Field>
              <Field label="GST number">
                <input className={inputClass} value={company.gstNumber} onChange={(e) => set({ gstNumber: e.target.value })} />
              </Field>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle>Storage yard</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input className={inputClass} value={yard.name} onChange={(e) => setYard({ ...yard, name: e.target.value })} />
            </Field>
            <Field label="Hours">
              <input className={inputClass} value={yard.hours} onChange={(e) => setYard({ ...yard, hours: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address">
                <input className={inputClass} value={yard.address} onChange={(e) => setYard({ ...yard, address: e.target.value })} />
              </Field>
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-4">
          <Button onClick={save}>Save company profile</Button>
          <SavedNote show={saved}>Saved. New estimates and invoices use these details.</SavedNote>
        </div>
        <ErrorText message={error} />
      </fieldset>
    </>
  );
}
