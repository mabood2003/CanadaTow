"use client";

import { useState } from "react";

import { AdminHeader, isOwner, SavedNote } from "@/components/admin";
import { CompanyConsentBlock } from "@/components/documents";
import { Icon } from "@/components/icons";
import { Banner, Button, Card, Chip, ErrorText, Field, inputClass, Loading, SectionTitle, Toggle } from "@/components/ui";
import type { ConsentMethod, ConsentTemplate } from "@/lib/domain";
import { CONSENT_METHOD_LABELS, CONSENT_METHODS } from "@/lib/domain";
import { GuardrailError } from "@/lib/jobs";
import type { AppState } from "@/lib/seed";
import { activeConsentTemplate, attempt, currentUserName, setAppState, useAppState } from "@/lib/store";
import { formatPlainDate } from "@/lib/time";
import { CONSENT_PLACEHOLDERS, renderConsentWording, type ConsentContext } from "@/lib/tow-rules";

const METHOD_HINTS: Record<ConsentMethod, string> = {
  link: "Customer reads your wording on their estimate link and taps to respond",
  signature: "Customer signs on the driver's phone under your wording",
  audio: "Driver reads your wording and records the customer's response",
  paper_photo: "Customer signs your paper form; driver photographs or uploads it",
};

export default function ConsentTemplatePage() {
  const app = useAppState();
  if (!app) return <Loading />;
  return <ConsentTemplateEditor app={app} />;
}

function ConsentTemplateEditor({ app }: { app: AppState }) {
  const owner = isOwner(app);
  const current = activeConsentTemplate(app);
  const [heading, setHeading] = useState(current.heading);
  const [body, setBody] = useState(current.body);
  const [acceptLabel, setAcceptLabel] = useState(current.acceptLabel);
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saved, setSaved] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const changed = heading !== current.heading || body !== current.body || acceptLabel !== current.acceptLabel;
  const sample: ConsentContext = {
    company: app.company.name,
    customer: "John Smith",
    relationship: "owner",
    vehicle: "2019 Black Ford F-150",
    estimate: "1042",
    total: "$219.24",
    destination: "Ridgeline Auto Repair — 2305 Centre St N, Calgary",
    storage: "$45.00",
  };

  const usage = (version: number) => app.jobs.reduce((n, j) => n + j.consents.filter((c) => c.templateVersion === version).length, 0);

  const saveVersion = () => {
    const failure = attempt(() => {
      if (!heading.trim() || !body.trim() || !acceptLabel.trim()) throw new GuardrailError("Heading, wording and button label are all required.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) throw new GuardrailError("Choose an effective date.");
      const next: ConsentTemplate = {
        version: current.version + 1,
        heading: heading.trim(),
        body: body.trim(),
        acceptLabel: acceptLabel.trim(),
        effectiveDate,
        updatedBy: currentUserName(app),
        createdAt: new Date().toISOString(),
      };
      setAppState((s) => ({ ...s, consentTemplates: [...s.consentTemplates, next] }));
      setSaved(next.version);
    });
    setError(failure);
  };

  const toggleMethod = (m: ConsentMethod, on: boolean) => {
    setError(
      attempt(() => {
        if (!on && CONSENT_METHODS.filter((x) => app.consentMethods[x] && x !== m).length === 0) throw new GuardrailError("Keep at least one consent method enabled.");
        setAppState((s) => ({ ...s, consentMethods: { ...s.consentMethods, [m]: on } }));
      }),
    );
  };

  const history = [...app.consentTemplates].sort((a, b) => b.version - a.version);

  return (
    <>
      <AdminHeader
        kicker="Company setup · Consent"
        title={`Consent Template — Version ${current.version}`}
        right={
          <div className="flex flex-wrap gap-2 text-xs">
            <Chip tone="good">Current</Chip>
            <Chip>Effective {formatPlainDate(current.effectiveDate)}</Chip>
            <Chip>Last updated by {current.updatedBy}</Chip>
          </div>
        }
      >
        The wording customers see when they authorize a tow. Every consent record keeps the version and the exact text that was shown.
      </AdminHeader>

      <Banner tone="neutral" icon="shieldCheck" title="Your company controls and approves its consent wording.">
        TowLedger shows your wording, captures the response and links it to the job. Review your wording with your own advisors.
      </Banner>

      <fieldset disabled={!owner} className="grid gap-5 xl:grid-cols-[1fr_minmax(320px,420px)]">
        <Card>
          <SectionTitle>Edit wording</SectionTitle>
          <div className="space-y-3">
            <Field label="Heading">
              <input className={inputClass} value={heading} onChange={(e) => setHeading(e.target.value)} />
            </Field>
            <Field
              label="Consent wording"
              hint={
                <span className="flex flex-wrap items-center gap-1">
                  Fills in automatically:
                  {CONSENT_PLACEHOLDERS.map((p) => (
                    <button key={p} type="button" onClick={() => setBody((b) => `${b}{${p}}`)} className="rounded bg-mint px-1.5 py-0.5 font-mono text-[11px] text-pine hover:bg-[#dbe7dc]">
                      {`{${p}}`}
                    </button>
                  ))}
                </span>
              }
            >
              <textarea className={`${inputClass} min-h-56 leading-relaxed`} value={body} onChange={(e) => setBody(e.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Button label">
                <input className={inputClass} value={acceptLabel} onChange={(e) => setAcceptLabel(e.target.value)} />
              </Field>
              <Field label="Effective date (new version)">
                <input className={inputClass} type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button onClick={saveVersion} disabled={!changed} icon="history">
                Save as Version {current.version + 1}
              </Button>
              {changed ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setHeading(current.heading);
                    setBody(current.body);
                    setAcceptLabel(current.acceptLabel);
                  }}
                >
                  Discard changes
                </Button>
              ) : null}
              <SavedNote show={saved === current.version && !changed}>Version {current.version} is now current. Past jobs keep their version.</SavedNote>
            </div>
            <ErrorText message={error} />
          </div>
        </Card>

        <div className="space-y-2">
          <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
            <Icon name="eye" className="h-3.5 w-3.5" /> Customer preview (sample job)
          </p>
          <CompanyConsentBlock heading={renderConsentWording(heading, sample)} wording={renderConsentWording(body, sample)} version={changed ? current.version + 1 : current.version}>
            <span className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-forest font-semibold text-white shadow-[0_3px_0_#0e291c]">
              <Icon name="check" className="h-4 w-4" /> {acceptLabel || "…"}
            </span>
          </CompanyConsentBlock>
        </div>
      </fieldset>

      <Card>
        <SectionTitle>Enabled consent methods</SectionTitle>
        <p className="mb-1 text-sm text-muted">Drivers only see the methods you turn on.</p>
        <div className="divide-y divide-line-soft">
          {CONSENT_METHODS.map((m) => (
            <Toggle key={m} checked={app.consentMethods[m]} disabled={!owner} onChange={(on) => toggleMethod(m, on)} label={CONSENT_METHOD_LABELS[m]} detail={METHOD_HINTS[m]} />
          ))}
        </div>
      </Card>

      <Card padded={false}>
        <div className="p-4 pb-2 sm:p-5 sm:pb-2">
          <SectionTitle>Version history</SectionTitle>
          <p className="text-sm text-muted">A completed job records exactly which version was shown. Changing the wording never rewrites past records.</p>
        </div>
        <ol className="divide-y divide-line-soft">
          {history.map((t) => (
            <li key={t.version} className="px-4 py-3 sm:px-5">
              <button type="button" onClick={() => setOpen(open === t.version ? null : t.version)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 text-left">
                <span className={`grid h-8 w-10 place-items-center rounded font-mono text-sm font-bold ${t.version === current.version ? "bg-forest text-signal" : "bg-sand text-muted"}`}>V{t.version}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {formatPlainDate(t.effectiveDate)}
                    {t.version === current.version ? <span className="ml-2 text-xs font-semibold text-ok">Current</span> : null}
                  </span>
                  <span className="block text-xs text-muted">
                    Updated by {t.updatedBy} · used in {usage(t.version)} consent record{usage(t.version) === 1 ? "" : "s"}
                  </span>
                </span>
                <Icon name="chevronRight" className={`h-4 w-4 text-subtle transition ${open === t.version ? "rotate-90" : ""}`} />
              </button>
              {open === t.version ? (
                <div className="mt-3 rounded-md border border-line-soft bg-paper p-3 text-sm">
                  <p className="font-semibold">{t.heading}</p>
                  <p className="mt-1 whitespace-pre-line text-muted">{t.body}</p>
                  <p className="mt-2 text-xs text-subtle">Button: “{t.acceptLabel}”</p>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}
