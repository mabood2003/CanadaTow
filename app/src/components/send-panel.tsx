"use client";

import { useState } from "react";

import { Banner, Button, ErrorText, useOnline } from "@/components/ui";
import type { Delivery, DeliveryMethod, JobCustomer } from "@/lib/domain";
import { DELIVERY_LABELS } from "@/lib/domain";
import { formatDateTime } from "@/lib/time";

/**
 * Text / Email / Show on device / Print for a customer document.
 * Development mode: text and email are logged to the console instead of sent (Twilio / Resend come later).
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

  const send = (via: "text" | "email") => {
    const to = via === "text" ? customer.mobile : customer.email;
    console.info(`[dev] ${via} to ${to}: Your ${kind} from TowLedger: ${url}`);
    const failure = onDelivered(via, to);
    setError(failure);
    if (!failure) setNotice(`Development mode: ${via === "text" ? "text" : "email"} to ${to} was logged, not sent. Link: ${url}`);
  };

  const print = () => {
    const failure = onDelivered("print");
    setError(failure);
    if (!failure) window.print();
  };

  const showOnDevice = () => {
    const failure = onDelivered("device");
    setError(failure);
    if (!failure) onShowOnDevice();
  };

  return (
    <div className="no-print space-y-3">
      {!online ? (
        <Banner tone="warn" title="Offline — the customer can't get a text or email right now">
          Show it on this device or print it. For consent, use a signature, audio, or a photo of a signed paper form.
        </Banner>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => send("text")} disabled={!online || !customer.mobile}>
          Text
        </Button>
        <Button onClick={() => send("email")} disabled={!online || !customer.email}>
          Email
        </Button>
        <Button variant="secondary" onClick={showOnDevice}>
          Show on this device
        </Button>
        <Button variant="secondary" onClick={print}>
          Print
        </Button>
      </div>
      {!customer.mobile || !customer.email ? (
        <p className="text-xs text-slate-500">
          {!customer.mobile ? "No mobile number on file. " : ""}
          {!customer.email ? "No email on file." : ""}
        </p>
      ) : null}
      {notice ? <Banner tone="info">{notice}</Banner> : null}
      <ErrorText message={error} />
      {deliveries.length > 0 ? (
        <ul className="space-y-1 text-sm text-emerald-800">
          {deliveries.map((d) => (
            <li key={d.at + d.via}>
              ✓ {DELIVERY_LABELS[d.via]}
              {d.to ? ` to ${d.to}` : ""} · {formatDateTime(d.at)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
