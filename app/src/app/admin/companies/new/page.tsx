"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/icons";
import { Button, Card, ErrorText, Field, inputClass, PageShell, ScreenHeader, SectionTitle } from "@/components/ui";
import { onboardCompany } from "@/lib/admin-store";
import type { OnboardingInput } from "@/lib/platform";
import { attempt } from "@/lib/store";

const EMPTY: OnboardingInput = {
  name: "",
  address: "",
  phone: "",
  email: "",
  gstNumber: "",
  ownerName: "",
  ownerEmail: "",
  yardName: "",
  yardAddress: "",
  yardHours: "",
};

const TEMPLATE = [
  "Workflows A–D: customer-requested, motor club / insurer, police-directed, private-property",
  "“Who requested this tow?” categories mapped to those workflows",
  "Two rate cards (standard and motor-club preset) with sample prices to replace",
  "Consent template version 1 with placeholders for the company's own wording",
  "Automatic delivery notices on, with a 30-second undo window",
];

export default function OnboardCompanyPage() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const field = (key: keyof OnboardingInput) => ({ value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value })) });

  const create = () => {
    let id = "";
    const failure = attempt(() => {
      id = onboardCompany(form);
    });
    setError(failure);
    if (!failure) router.push(`/admin/companies/${id}`);
  };

  return (
    <PageShell width="wide">
      <ScreenHeader back={{ href: "/admin", label: "Companies" }} kicker="TowLedger admin" title="Onboard a company" subtitle="Creates the company from the starting template and emails the owner an invite. The owner then makes rates, workflows and wording their own." />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card>
            <SectionTitle>Company</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Company name">
                  <input className={inputClass} {...field("name")} placeholder="e.g. Northgate Towing" />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Business address">
                  <input className={inputClass} {...field("address")} />
                </Field>
              </div>
              <Field label="Business phone">
                <input className={inputClass} type="tel" {...field("phone")} />
              </Field>
              <Field label="Business email" optional>
                <input className={inputClass} type="email" {...field("email")} />
              </Field>
              <Field label="GST number" optional>
                <input className={inputClass} {...field("gstNumber")} />
              </Field>
            </div>
          </Card>
          <Card>
            <SectionTitle>Owner</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Owner's name">
                <input className={inputClass} {...field("ownerName")} />
              </Field>
              <Field label="Owner's email">
                <input className={inputClass} type="email" {...field("ownerEmail")} />
              </Field>
            </div>
          </Card>
          <Card>
            <SectionTitle>Storage yard</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Yard name">
                <input className={inputClass} {...field("yardName")} />
              </Field>
              <Field label="Yard hours" optional>
                <input className={inputClass} {...field("yardHours")} placeholder="e.g. Mon–Fri 8am–5pm" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Yard address">
                  <input className={inputClass} {...field("yardAddress")} />
                </Field>
              </div>
            </div>
          </Card>
          <ErrorText message={error} />
          <Button size="lg" icon="plus" onClick={create}>
            Create company and invite owner
          </Button>
        </div>

        <aside className="lg:self-start">
          <Card>
            <SectionTitle>Starting template</SectionTitle>
            <ul className="space-y-2 text-sm">
              {TEMPLATE.map((t) => (
                <li key={t} className="flex gap-2">
                  <Icon name="check" className="mt-0.5 h-4 w-4 text-ok" strokeWidth={3} />
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">The company controls its forms, rates, wording and workflows — this is only a starting point, and TowLedger doesn&apos;t provide legal advice.</p>
          </Card>
        </aside>
      </div>
    </PageShell>
  );
}
