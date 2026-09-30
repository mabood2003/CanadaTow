"use client";

import type { AuditEntry, Consent } from "@/lib/domain";
import { CONSENT_METHOD_LABELS } from "@/lib/domain";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";

export function ConsentRecord({ consent }: { consent: Consent }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
      <p className="font-semibold text-slate-900">
        {consent.purpose === "estimate" ? `Consent to estimate v${consent.estimateVersion}` : "Authorization of revised amount"} ·{" "}
        {formatMoney(consent.amountCents)}
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-slate-700">
        <dt className="text-slate-500">Name</dt>
        <dd>{consent.name}</dd>
        <dt className="text-slate-500">Relationship</dt>
        <dd>{consent.relationship}</dd>
        <dt className="text-slate-500">Method</dt>
        <dd>{CONSENT_METHOD_LABELS[consent.method]}</dd>
        <dt className="text-slate-500">When</dt>
        <dd>{formatDateTime(consent.at)}</dd>
        <dt className="text-slate-500">Present</dt>
        <dd>{consent.present ? "Yes" : "No"}</dd>
        <dt className="text-slate-500">Recorded by</dt>
        <dd>{consent.recordedBy}</dd>
      </dl>
      <Evidence consent={consent} />
    </div>
  );
}

function Evidence({ consent }: { consent: Consent }) {
  if (!consent.evidence) {
    return consent.method === "link" ? null : <p className="mt-2 font-semibold text-red-700">Evidence file missing</p>;
  }
  if (consent.method === "audio") {
    return <audio className="mt-3 w-full" controls src={consent.evidence} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- evidence is a local data URL
    <img
      src={consent.evidence}
      alt={consent.method === "signature" ? "Customer signature" : "Photo of signed paper form"}
      className="mt-3 max-h-64 w-full rounded-lg bg-white object-contain ring-1 ring-slate-200"
    />
  );
}

export function AuditTrail({ entries }: { entries: AuditEntry[] }) {
  return (
    <ol className="space-y-2">
      {[...entries].reverse().map((entry) => (
        <li key={entry.id} className="rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
          <p className="font-medium text-slate-900">{entry.action}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatDateTime(entry.at)} · {entry.by} · {entry.device}
          </p>
        </li>
      ))}
    </ol>
  );
}
