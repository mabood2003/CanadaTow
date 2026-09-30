"use client";

import { useState } from "react";

import { CompanyConsentBlock } from "@/components/documents";
import { AudioRecorder, PhotoCapture, SignaturePad } from "@/components/evidence";
import { Icon, type IconName } from "@/components/icons";
import { Banner, Button, Checkbox, ChoiceButton, ErrorText, Field, inputClass, LinkButton } from "@/components/ui";
import type { ConsentMethod } from "@/lib/domain";
import { CONSENT_METHOD_LABELS, CONSENT_METHODS, RELATIONSHIPS } from "@/lib/domain";
import { endSentence } from "@/lib/describe";
import type { ConsentInput } from "@/lib/jobs";
import { formatMoney } from "@/lib/money";

const METHOD_DETAIL: Record<ConsentMethod, { hint: string; icon: IconName }> = {
  link: { hint: "Customer responds on the estimate link", icon: "link" },
  signature: { hint: "Customer signs with a finger", icon: "pen" },
  audio: { hint: "Record the customer, in person or by phone", icon: "mic" },
  paper_photo: { hint: "Photograph or upload a signed form", icon: "camera" },
};

export interface RenderedConsent {
  templateVersion: number;
  heading: string;
  wording: string;
  acceptLabel: string;
}

/**
 * Captures the company's consent step with whichever methods the company enabled.
 * `render` re-renders the company wording when the name or relationship changes.
 */
export function ConsentCapture({
  purpose,
  initialName,
  initialRelationship,
  present,
  amountCents,
  enabled,
  linkPath,
  initialMethod,
  companyName,
  render,
  onRecord,
}: {
  purpose: ConsentInput["purpose"];
  initialName: string;
  initialRelationship: string;
  present: boolean;
  amountCents: number;
  enabled: Record<ConsentMethod, boolean>;
  linkPath?: string;
  initialMethod?: ConsentMethod;
  companyName: string;
  render: (name: string, relationship: string) => RenderedConsent;
  onRecord: (input: ConsentInput) => string | null;
}) {
  const methods = CONSENT_METHODS.filter((m) => enabled[m] && (m !== "link" || linkPath));
  const linkFirst = methods.includes("link") && !initialMethod;
  const [name, setName] = useState(initialName);
  const [relationship, setRelationship] = useState(initialRelationship);
  const [method, setMethod] = useState<ConsentMethod | null>(initialMethod && methods.includes(initialMethod) ? initialMethod : linkFirst ? "link" : null);
  const [showOthers, setShowOthers] = useState(!linkFirst);
  const [evidence, setEvidence] = useState<string | null>(null);
  const [driverConfirmed, setDriverConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rendered = render(name, relationship);
  const amount = formatMoney(amountCents);

  const choose = (value: ConsentMethod) => {
    setMethod(value);
    setEvidence(null);
    setDriverConfirmed(false);
    setError(null);
  };

  const record = () => {
    if (!method) return;
    setError(
      onRecord({
        purpose,
        name,
        relationship,
        present,
        method,
        evidence: evidence ?? undefined,
        driverConfirmed,
        amountCents,
        templateVersion: rendered.templateVersion,
        heading: rendered.heading,
        wording: rendered.wording,
      }),
    );
  };

  if (methods.length === 0) {
    return <Banner tone="warn" title="No consent methods are enabled">An owner can turn methods on in Company setup → Consent template.</Banner>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Person giving consent">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Relationship">
          <select className={inputClass} value={relationship} onChange={(e) => setRelationship(e.target.value)}>
            {RELATIONSHIPS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
      </div>

      <CompanyConsentBlock heading={rendered.heading} wording={rendered.wording} version={rendered.templateVersion} />
      <p className="-mt-2 text-xs text-muted">Wording configured by {endSentence(companyName)} The customer sees exactly this text.</p>

      {method === "link" ? (
        <div className="rounded-lg border border-line bg-white p-4">
          <p className="flex items-center gap-2 font-semibold text-ink">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pine/50" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-pine" />
            </span>
            Waiting for the customer — web acknowledgement
          </p>
          <p className="mt-1 text-sm text-muted">This updates automatically when they respond on their estimate link. They can also respond on this phone.</p>
          {linkPath ? (
            <div className="mt-3">
              <LinkButton href={linkPath} variant="secondary" full icon="smartphone">
                Open customer view on this device
              </LinkButton>
            </div>
          ) : null}
        </div>
      ) : null}

      {!showOthers ? (
        <Button variant="secondary" full icon="plus" onClick={() => setShowOthers(true)}>
          Record another consent method
        </Button>
      ) : (
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">{linkFirst ? "Record another consent method" : "How is consent being given?"}</p>
          <div className="grid gap-2" role="radiogroup">
            {methods.map((m) => {
              const unavailable = m === "signature" && !present;
              return (
                <ChoiceButton
                  key={m}
                  selected={method === m}
                  disabled={unavailable}
                  onClick={() => choose(m)}
                  icon={METHOD_DETAIL[m].icon}
                  title={CONSENT_METHOD_LABELS[m]}
                  detail={unavailable ? "Customer isn't present" : METHOD_DETAIL[m].hint}
                />
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">Only the methods {companyName} enabled are shown.</p>
        </div>
      )}

      {method === "signature" ? <SignaturePad onChange={setEvidence} /> : null}
      {method === "audio" ? <AudioRecorder script={rendered.wording} onChange={setEvidence} /> : null}
      {method === "paper_photo" ? <PhotoCapture label="Photograph or upload the signed form" onChange={setEvidence} /> : null}

      {method && method !== "link" ? (
        <>
          <Checkbox checked={driverConfirmed} onChange={setDriverConfirmed}>
            I confirm <strong>{name || "the customer"}</strong> gave this response{purpose === "estimate" ? " before the tow" : ""}, for <strong>{amount}</strong>.
          </Checkbox>
          <ErrorText message={error} />
          <Button size="lg" full disabled={!evidence || !driverConfirmed || !name.trim()} onClick={record} icon="shieldCheck">
            Save consent record
          </Button>
          {!evidence ? (
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
              <Icon name="info" className="h-3.5 w-3.5" /> Capture the {method === "audio" ? "recording" : method === "signature" ? "signature" : "photo"} to continue.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
