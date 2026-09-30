"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Banner, Button, Card, ErrorText, Field, inputClass, Loading, PageShell, ScreenHeader, SectionTitle } from "@/components/ui";
import type { RateCard } from "@/lib/domain";
import { GuardrailError, newId } from "@/lib/jobs";
import { formatMoney, parseDollars } from "@/lib/money";
import type { AppState } from "@/lib/seed";
import { attempt, resetDemoData, setAppState, useAppState } from "@/lib/store";

export default function SetupPage() {
  const app = useAppState();
  if (!app) return <Loading />;
  return <SetupForm app={app} />;
}

const RATE_FIELDS: { key: keyof RateCard; label: string }[] = [
  { key: "hookupCents", label: "Hook-up" },
  { key: "perKmCents", label: "Per kilometre" },
  { key: "winchCents", label: "Winching" },
  { key: "afterHoursCents", label: "After-hours callout" },
  { key: "storagePerDayCents", label: "Storage per day" },
];

function SetupForm({ app }: { app: AppState }) {
  const router = useRouter();
  const [company, setCompany] = useState(app.company);
  const [rates, setRates] = useState(() =>
    Object.fromEntries(RATE_FIELDS.map(({ key }) => [key, (app.rateCard[key] / 100).toFixed(2)])) as Record<keyof RateCard, string>,
  );
  const [yard, setYard] = useState(app.yards[0] ?? { id: newId("yard-"), name: "", address: "", hours: "" });
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const failure = attempt(() => {
      if (!company.name.trim() || !company.address.trim() || !company.phone.trim()) {
        throw new GuardrailError("Business name, address and phone are required — they appear on every estimate.");
      }
      const rateCard = {} as RateCard;
      for (const { key, label } of RATE_FIELDS) {
        const cents = parseDollars(rates[key]);
        if (cents === null) throw new GuardrailError(`Enter a dollar amount for ${label}.`);
        rateCard[key] = cents;
      }
      if (!yard.name.trim() || !yard.address.trim()) throw new GuardrailError("Enter your storage yard's name and address.");
      setAppState((s) => ({ ...s, company, rateCard, yards: [yard, ...s.yards.slice(1)] }));
    });
    setError(failure);
    setMessage(failure ? null : "Saved. New estimates use the updated rate card.");
  };

  const invite = () => {
    const failure = attempt(() => {
      if (!inviteName.trim() || !/^\S+@\S+\.\S+$/.test(inviteEmail.trim())) throw new GuardrailError("Enter the driver's name and email.");
      console.info(`[dev] magic-link invite to ${inviteEmail.trim()}`);
      setAppState((s) => ({
        ...s,
        team: [...s.team, { id: newId("u-"), name: inviteName.trim(), email: inviteEmail.trim(), role: "driver", invited: true }],
      }));
      setInviteName("");
      setInviteEmail("");
    });
    setError(failure);
    setMessage(failure ? null : "Invite logged (development mode — no email sent).");
  };

  return (
    <PageShell>
      <ScreenHeader back={{ href: "/", label: "Home" }} title="Company setup" subtitle="Appears on every estimate and invoice." />
      <div className="space-y-4">
        <Card>
          <SectionTitle>Business</SectionTitle>
          <div className="space-y-3">
            <Field label="Business name">
              <input className={inputClass} value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} />
            </Field>
            <Field label="Business address">
              <input className={inputClass} value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <input className={inputClass} type="tel" value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} />
              </Field>
              <Field label="GST number">
                <input className={inputClass} value={company.gstNumber} onChange={(e) => setCompany({ ...company, gstNumber: e.target.value })} />
              </Field>
            </div>
            <Field label="Email">
              <input className={inputClass} type="email" value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card>
          <SectionTitle>Rate card</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {RATE_FIELDS.map(({ key, label }) => (
              <Field key={key} label={label} hint={parseDollars(rates[key]) !== null ? formatMoney(parseDollars(rates[key])!) : "Invalid amount"}>
                <input className={inputClass} inputMode="decimal" value={rates[key]} onChange={(e) => setRates({ ...rates, [key]: e.target.value })} />
              </Field>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle>Storage yard</SectionTitle>
          <div className="space-y-3">
            <Field label="Name">
              <input className={inputClass} value={yard.name} onChange={(e) => setYard({ ...yard, name: e.target.value })} />
            </Field>
            <Field label="Address">
              <input className={inputClass} value={yard.address} onChange={(e) => setYard({ ...yard, address: e.target.value })} />
            </Field>
            <Field label="Hours">
              <input className={inputClass} value={yard.hours} onChange={(e) => setYard({ ...yard, hours: e.target.value })} />
            </Field>
          </div>
        </Card>

        <ErrorText message={error} />
        {message ? <Banner tone="good">{message}</Banner> : null}
        <Button size="lg" full onClick={save}>
          Save company setup
        </Button>

        <Card>
          <SectionTitle>Team</SectionTitle>
          <ul className="mb-3 divide-y divide-slate-100">
            {app.team.map((m) => (
              <li key={m.id} className="flex min-h-12 items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-semibold">{m.name}</span> <span className="text-slate-500">· {m.role}</span>
                  {m.invited ? <span className="text-amber-700"> · invited</span> : null}
                </span>
                {app.currentUserId === m.id ? (
                  <span className="text-xs font-semibold text-emerald-700">Using app as</span>
                ) : (
                  <button type="button" className="min-h-10 px-2 text-xs font-semibold text-slate-600 underline" onClick={() => setAppState((s) => ({ ...s, currentUserId: m.id }))}>
                    Use as
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="space-y-2">
            <input className={inputClass} placeholder="Driver name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
            <input className={inputClass} type="email" placeholder="Driver email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            <Button variant="secondary" full onClick={invite}>
              Invite driver
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">“Use as” is a pilot stand-in for sign-in, so you can test as the owner or a driver.</p>
        </Card>

        <Card>
          <SectionTitle>Demo data</SectionTitle>
          {confirmReset ? (
            <div className="space-y-2">
              <Banner tone="bad" title="Erase every job on this device?">
                This restores the three sample jobs. It can&apos;t be undone.
              </Banner>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => setConfirmReset(false)}>
                  Keep my data
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    resetDemoData();
                    router.push("/");
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" full onClick={() => setConfirmReset(true)}>
              Reset demo data
            </Button>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
