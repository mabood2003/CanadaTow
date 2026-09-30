"use client";

import { useState } from "react";

import { AudioRecorder, PhotoCapture, SignaturePad } from "@/components/evidence";
import { Banner, Button, Checkbox, ErrorText, Field, inputClass, LinkButton } from "@/components/ui";
import type { ConsentMethod } from "@/lib/domain";
import { RELATIONSHIPS } from "@/lib/domain";
import type { ConsentInput } from "@/lib/jobs";
import { formatMoney } from "@/lib/money";

const METHODS: { value: ConsentMethod; label: string; hint: string }[] = [
  { value: "link", label: "Customer taps link", hint: "They consent on the estimate page" },
  { value: "signature", label: "Sign on this phone", hint: "Customer signs with a finger" },
  { value: "audio", label: "Audio consent", hint: "Record them saying yes (in person or by phone)" },
  { value: "paper_photo", label: "Paper form photo", hint: "Photograph a signed paper form" },
];

export function ConsentCapture({
  purpose,
  initialName,
  initialRelationship,
  present,
  amountCents,
  vehicle,
  allowLink,
  linkPath,
  onRecord,
}: {
  purpose: ConsentInput["purpose"];
  initialName: string;
  initialRelationship: string;
  present: boolean;
  amountCents: number;
  vehicle: string;
  allowLink: boolean;
  linkPath?: string;
  onRecord: (input: ConsentInput) => string | null;
}) {
  const [name, setName] = useState(initialName);
  const [relationship, setRelationship] = useState(initialRelationship);
  const [method, setMethod] = useState<ConsentMethod | null>(allowLink && !present ? "link" : null);
  const [evidence, setEvidence] = useState<string | null>(null);
  const [driverConfirmed, setDriverConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = formatMoney(amountCents);
  const statement =
    purpose === "estimate"
      ? `I, ${name || "(name)"}, agree to the written estimate of ${amount} and consent to the tow of ${vehicle}.`
      : `I, ${name || "(name)"}, authorize the final amount of ${amount} for the tow of ${vehicle}.`;

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
      }),
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Consenting person">
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

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">How is consent being given?</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {METHODS.filter((m) => allowLink || m.value !== "link").map((m) => {
            const unavailable = m.value === "signature" && !present;
            return (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={method === m.value}
                disabled={unavailable}
                onClick={() => choose(m.value)}
                className={`min-h-20 rounded-2xl p-3 text-left ring-1 transition disabled:opacity-40 ${
                  method === m.value ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-900 ring-slate-300"
                }`}
              >
                <span className="block text-sm font-bold">{m.label}</span>
                <span className={`mt-1 block text-xs ${method === m.value ? "text-slate-300" : "text-slate-500"}`}>
                  {unavailable ? "Customer isn't present" : m.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {method === "link" && linkPath ? (
        <Banner tone="info" title="Waiting for the customer to tap “I consent”">
          <p>Consent appears here automatically when they accept on the estimate page. They can also use it on this phone:</p>
          <div className="mt-3">
            <LinkButton href={linkPath} variant="secondary" full>
              Open customer estimate page
            </LinkButton>
          </div>
        </Banner>
      ) : null}

      {method === "signature" ? (
        <div className="space-y-2">
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-800 ring-1 ring-slate-200">{statement}</p>
          <SignaturePad onChange={setEvidence} />
        </div>
      ) : null}

      {method === "audio" ? <AudioRecorder script={statement} onChange={setEvidence} /> : null}

      {method === "paper_photo" ? <PhotoCapture onChange={setEvidence} /> : null}

      {method && method !== "link" ? (
        <>
          <Checkbox checked={driverConfirmed} onChange={setDriverConfirmed}>
            I confirm <strong>{name || "the customer"}</strong> gave this consent{purpose === "estimate" ? " before the tow" : ""}, for{" "}
            <strong>{amount}</strong>.
          </Checkbox>
          <ErrorText message={error} />
          <Button size="lg" full variant="success" disabled={!evidence || !driverConfirmed || !name.trim()} onClick={record}>
            Record consent
          </Button>
          {!evidence ? <p className="text-center text-xs text-slate-500">Capture the {method === "audio" ? "recording" : method === "signature" ? "signature" : "photo"} to continue.</p> : null}
        </>
      ) : null}
    </div>
  );
}
