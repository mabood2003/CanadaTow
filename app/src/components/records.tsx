"use client";

import { useState } from "react";

import { Icon } from "@/components/icons";
import { DataList } from "@/components/ui";
import type { AuditEntry, Consent } from "@/lib/domain";
import { CONSENT_METHOD_LABELS, ROLE_LABELS } from "@/lib/domain";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime, formatTime, formatWhen } from "@/lib/time";

/** Factual metadata about a consent record — no legal conclusions. */
export function ConsentRecord({ consent, jobNumber, headline = true }: { consent: Consent; jobNumber: string; headline?: boolean }) {
  const [showWording, setShowWording] = useState(false);
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      {headline ? (
        <p className="mb-3 flex items-center gap-2 text-base font-bold text-ink">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-forest text-signal">
            <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
          {consent.purpose === "estimate" ? "Consent record captured" : `Revised amount authorized · ${formatMoney(consent.amountCents)}`}
        </p>
      ) : null}
      <DataList
        rows={[
          ["Name", <strong key="n">{consent.name}</strong>],
          ["Relationship", consent.relationship],
          ["Estimate", `#${jobNumber}${consent.estimateVersion > 1 ? ` v${consent.estimateVersion}` : ""} · ${formatMoney(consent.amountCents)}`],
          ["When", formatWhen(consent.at)],
          ["Method", CONSENT_METHOD_LABELS[consent.method]],
          ["Template version", consent.templateVersion],
          ["Customer present", consent.present ? "Yes" : "No"],
          ["Recorded by", consent.recordedBy],
        ]}
      />
      <button type="button" onClick={() => setShowWording((s) => !s)} className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-pine">
        <Icon name="fileText" className="h-4 w-4" /> {showWording ? "Hide" : "Show"} the wording shown
      </button>
      {showWording ? (
        <div className="mt-2 rounded-md border border-line-soft bg-paper p-3 text-sm">
          <p className="font-semibold">{consent.heading}</p>
          <p className="mt-1 whitespace-pre-line text-muted">{consent.wording}</p>
        </div>
      ) : null}
      <Evidence consent={consent} />
    </div>
  );
}

function Evidence({ consent }: { consent: Consent }) {
  if (!consent.evidence) {
    return consent.method === "link" ? null : <p className="mt-3 font-semibold text-danger">Evidence file missing</p>;
  }
  if (consent.method === "audio") {
    return <audio className="mt-3 w-full" controls src={consent.evidence} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- evidence is a local data URL
    <img
      src={consent.evidence}
      alt={consent.method === "signature" ? "Customer signature" : "Photo of signed paper document"}
      className="mt-3 max-h-56 w-full rounded-md border border-line-soft bg-white object-contain"
    />
  );
}

/** Phone-friendly activity list, newest first. */
export function AuditTrail({ entries, limit }: { entries: AuditEntry[]; limit?: number }) {
  const shown = [...entries].reverse().slice(0, limit);
  return (
    <ol className="relative space-y-3 border-l-2 border-line pl-4">
      {shown.map((entry) => (
        <li key={entry.id} className="relative">
          <span aria-hidden className={`absolute -left-[23px] top-1.5 h-3 w-3 rounded-full border-2 border-cream ${entry.role === "system" ? "bg-subtle" : entry.role === "customer" ? "bg-signal ring-1 ring-pine" : "bg-pine"}`} />
          <p className="text-sm font-medium leading-snug text-ink">{entry.action}</p>
          <p className="mt-0.5 text-xs text-muted">
            {formatDateTime(entry.at)} · {entry.by} · {ROLE_LABELS[entry.role]}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** Desktop audit table, oldest first — reads like an activity history. */
export function AuditTable({ entries }: { entries: AuditEntry[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-[0_18px_50px_#1f362812]">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-[#f5f6f2] font-mono text-[10px] uppercase tracking-[0.08em] text-subtle">
          <tr>
            <th className="px-4 py-3 font-bold">#</th>
            <th className="px-4 py-3 font-bold">Time</th>
            <th className="px-4 py-3 font-bold">Event</th>
            <th className="px-4 py-3 font-bold">By</th>
            <th className="px-4 py-3 font-bold">Source</th>
            <th className="px-4 py-3 font-bold">Device</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {entries.map((entry, i) => (
            <tr key={entry.id} className="align-top">
              <td className="px-4 py-3 font-mono text-xs text-subtle">{String(i + 1).padStart(3, "0")}</td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                <span className="font-semibold">{formatTime(entry.at)}</span>
                <span className="block text-xs text-muted">{formatDate(entry.at)}</span>
              </td>
              <td className="px-4 py-3 text-ink">{entry.action}</td>
              <td className="whitespace-nowrap px-4 py-3 font-medium">{entry.by}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    entry.role === "system" ? "bg-sand text-muted" : entry.role === "customer" ? "bg-signal/40 text-forest" : entry.role === "owner" ? "bg-[#e9eff7] text-[#335d86]" : "bg-mint text-pine"
                  }`}
                >
                  {ROLE_LABELS[entry.role]}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">{entry.device}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
