"use client";

import { useState } from "react";

import { Icon } from "@/components/icons";
import { Button, ErrorText, LinkButton, useOnline } from "@/components/ui";
import type { Job, OutboundMessage } from "@/lib/domain";
import { jobHref } from "@/lib/job-steps";
import { describeRecipients, jobMessages } from "@/lib/messages";
import type { AppState } from "@/lib/seed";
import { attempt, cancelDeliveredNotice, sendDeliveredNow, sendPendingNow } from "@/lib/store";
import { formatTime } from "@/lib/time";
import { useNow } from "@/lib/use-now";

/**
 * After Delivered: the customer is told automatically unless the driver cancels inside the undo window.
 * Shows the countdown, then what was sent — or a way to send it when auto-send is off or was cancelled.
 */
export function DeliveredNotice({ app, job }: { app: AppState; job: Job }) {
  const now = useNow(500);
  const online = useOnline() && !app.simulateOffline;
  const [error, setError] = useState<string | null>(null);
  const delivered = jobMessages(app.outbox, job.id).filter((m) => m.kind === "delivered");
  const pending = delivered.filter((m) => m.status === "scheduled");
  const sent = delivered.filter((m) => m.status === "sent");
  const cancelled = delivered.filter((m) => m.status === "cancelled");
  const hasContact = Boolean(job.customer.mobile.trim() || job.customer.email.trim());
  const firstName = job.customer.name.split(" ")[0] || "the customer";

  if (pending.length) {
    const seconds = Math.max(0, Math.ceil((Date.parse(pending[0].sendAt) - now) / 1000));
    return (
      <section className="rounded-lg border-2 border-forest bg-paper p-4" aria-live="polite">
        <p className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-pine">
          <Icon name="message" className="h-4 w-4" /> Letting {firstName} know
        </p>
        <p className="mt-1 text-lg font-extrabold tracking-tight">
          {online ? (seconds > 0 ? `Sending in ${seconds} second${seconds === 1 ? "" : "s"}` : "Sending…") : "Will send when you're back online"}
        </p>
        <p className="mt-1 text-sm text-muted">{describeRecipients(pending)} — where the vehicle is, yard hours and their tow link.</p>
        <MessagePreview message={pending[0]} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" icon="x" onClick={() => setError(attempt(() => cancelDeliveredNotice(job.id)))}>
            Cancel
          </Button>
          <Button icon="arrowRight" disabled={!online} onClick={() => setError(attempt(() => sendPendingNow(job.id)))}>
            Send now
          </Button>
        </div>
        <ErrorText message={error} />
      </section>
    );
  }

  if (sent.length) {
    const last = sent[0];
    return (
      <section className="rounded-lg border border-[#b9dcc4] bg-[#eaf5ed] p-4 text-[#163f28]">
        <p className="flex items-center gap-2 font-bold">
          <Icon name="check" className="h-4 w-4" strokeWidth={3} /> {firstName === "the customer" ? "Customer" : firstName} notified of delivery
        </p>
        <p className="mt-1 text-sm">
          {describeRecipients(sent)} · {formatTime(last.sentAt)}
        </p>
        <p className="mt-1 text-xs opacity-80">Prototype: messages are recorded, not actually sent.</p>
        <MessagePreview message={last} />
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-line bg-paper p-4">
      <p className="font-bold">
        {cancelled.length
          ? `Delivery notice cancelled by ${cancelled[0].cancelledBy}`
          : app.notifications.deliveredAuto
            ? "No delivery notice sent"
            : "Let the customer know it's delivered"}
      </p>
      {hasContact ? (
        <>
          <p className="mt-1 text-sm text-muted">Text {job.customer.mobile ? job.customer.mobile : job.customer.email} where the vehicle is, the yard hours and their tow link.</p>
          <Button className="mt-3" full icon="message" disabled={!online} onClick={() => setError(attempt(() => sendDeliveredNow(job.id)))}>
            Send delivery notice
          </Button>
          {!online ? <p className="mt-2 text-xs text-muted">Offline — send it when you&apos;re back online, or tell the customer another way.</p> : null}
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">There&apos;s no mobile number or email on file. Tell the customer another way, or add a contact.</p>
          <LinkButton className="mt-3" href={jobHref(job, "customer")} variant="secondary" full>
            Add customer contact
          </LinkButton>
        </>
      )}
      <ErrorText message={error} />
    </section>
  );
}

function MessagePreview({ message }: { message: OutboundMessage }) {
  return <p className="mt-3 whitespace-pre-line rounded-md border border-line-soft bg-white p-3 text-sm text-ink">{message.body}</p>;
}
