"use client";

import { useState } from "react";

import { Icon, type IconName } from "@/components/icons";
import { Banner, ErrorText, useOnline } from "@/components/ui";
import type { Delivery, DeliveryMethod, JobCustomer } from "@/lib/domain";
import { DELIVERY_LABELS } from "@/lib/domain";
import { formatWhen } from "@/lib/time";

const OPTIONS: { via: DeliveryMethod; label: string; icon: IconName }[] = [
  { via: "text", label: "Send by text", icon: "message" },
  { via: "email", label: "Send by email", icon: "mail" },
  { via: "device", label: "Show on this device", icon: "smartphone" },
  { via: "print", label: "Paper / print fallback", icon: "printer" },
];

/**
 * Delivery tools for a customer document. The operator chooses the method; the app records what happened.
 * Prototype: text and email are simulated (logged to the console) — Twilio / Resend come later.
 */
export function SendPanel({
  kind,
  path,
  customer,
  deliveries,
  onDelivered,
  onShowOnDevice,
}: {
  kind: "estimate" | "invoice";
  path: string;
  customer: Pick<JobCustomer, "mobile" | "email">;
  deliveries: Delivery[];
  onDelivered: (via: DeliveryMethod, to?: string) => string | null;
  onShowOnDevice: () => void;
}) {
  const online = useOnline();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const url = typeof window === "undefined" ? path : `${window.location.origin}${path}`;

  const choose = (via: DeliveryMethod) => {
    const to = via === "text" ? customer.mobile : via === "email" ? customer.email : undefined;
    if (via === "text" || via === "email") console.info(`[prototype] ${via} to ${to}: Your ${kind}: ${url}`);
    const failure = onDelivered(via, to);
    setError(failure);
    if (failure) return;
    if (via === "device") return onShowOnDevice();
    if (via === "print") {
      setNotice("Recorded as a paper copy. Your device's print screen is opening.");
      return window.print();
    }
    setNotice(`${via === "text" ? "Text" : "Email"} sent to ${to} (simulated in this prototype).`);
  };

  const disabledReason = (via: DeliveryMethod) => {
    if ((via === "text" || via === "email") && !online) return "Offline";
    if (via === "text" && !customer.mobile) return "No mobile on file";
    if (via === "email" && !customer.email) return "No email on file";
    return null;
  };

  return (
    <div className="no-print space-y-3">
      {!online ? (
        <Banner tone="warn" icon="wifiOff" title="Offline — text and email will wait">
          Show it on this device or use your paper process. The job is saved locally.
        </Banner>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((o) => {
          const reason = disabledReason(o.via);
          const sent = deliveries.some((d) => d.via === o.via);
          return (
            <button
              key={o.via}
              type="button"
              disabled={Boolean(reason)}
              onClick={() => choose(o.via)}
              className={`flex min-h-[88px] flex-col items-start justify-between rounded-md border p-3 text-left transition disabled:opacity-45 ${
                o.via === "text" ? "border-forest bg-forest text-white shadow-[0_3px_0_#0e291c]" : "border-line bg-white text-ink hover:border-pine/50"
              }`}
            >
              <span className="flex w-full items-center justify-between">
                <Icon name={o.icon} className={`h-5 w-5 ${o.via === "text" ? "text-signal" : "text-pine"}`} />
                {sent ? <Icon name="check" className={`h-4 w-4 ${o.via === "text" ? "text-signal" : "text-ok"}`} strokeWidth={3} /> : null}
              </span>
              <span>
                <span className="block text-[15px] font-semibold leading-tight">{o.label}</span>
                {reason ? <span className="text-xs opacity-80">{reason}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
      {notice ? <Banner tone="good">{notice}</Banner> : null}
      <ErrorText message={error} />
      {deliveries.length > 0 ? (
        <div className="rounded-md border border-line-soft bg-white p-3">
          <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Delivery record</p>
          <ul className="space-y-1.5 text-sm">
            {deliveries.map((d) => (
              <li key={d.at + d.via} className="flex items-start gap-2">
                <Icon name="check" className="mt-0.5 h-4 w-4 text-ok" strokeWidth={3} />
                <span>
                  {DELIVERY_LABELS[d.via]}
                  {d.to ? ` to ${d.to}` : ""} · <span className="text-muted">{formatWhen(d.at)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
