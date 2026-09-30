"use client";

import Link from "next/link";

import { AdminHeader } from "@/components/admin";
import { Card, Loading, SectionTitle, Segmented, Toggle } from "@/components/ui";
import { deliveredMessages, UNDO_CHOICES } from "@/lib/messages";
import { setAppState, useAppState } from "@/lib/store";

export default function NotificationSettingsPage() {
  const app = useAppState();
  if (!app) return <Loading />;
  const n = app.notifications;
  const sample = app.jobs.find((j) => j.customer.mobile && j.tow.delivered) ?? app.jobs[0];
  const preview = sample
    ? deliveredMessages({
        job: { ...sample, tow: { ...sample.tow, delivered: sample.tow.delivered ?? new Date(0).toISOString() }, customer: { ...sample.customer, email: "" } },
        company: app.company,
        yards: app.yards,
        origin: typeof window === "undefined" ? "" : window.location.origin,
        actor: { by: "Preview", role: "system", device: "Preview", now: sample.createdAt },
        delaySeconds: 0,
      })[0]
    : undefined;

  const set = (patch: Partial<typeof n>) => setAppState((s) => ({ ...s, notifications: { ...s.notifications, ...patch } }));

  return (
    <>
      <AdminHeader kicker="Company setup · Notifications" title="Customer notifications">
        What {app.company.name} tells customers automatically. Every message is kept in{" "}
        <Link href="/owner/messages" className="font-semibold text-pine underline">
          Messages
        </Link>
        .
      </AdminHeader>

      <Card>
        <SectionTitle>When the driver taps Delivered</SectionTitle>
        <Toggle
          checked={n.deliveredAuto}
          onChange={(deliveredAuto) => set({ deliveredAuto })}
          label="Text and email the customer automatically"
          detail="Where the vehicle is, yard hours, and their tow link with the estimate and invoice. Sent to whichever of mobile and email is on file."
        />
        {n.deliveredAuto ? (
          <div className="mt-4 border-t border-line-soft pt-4">
            <p className="mb-2 text-sm font-semibold">Driver&apos;s undo window</p>
            <Segmented
              label="Undo window"
              value={String(n.undoSeconds)}
              onChange={(v) => set({ undoSeconds: Number(v) })}
              options={UNDO_CHOICES.map((s) => ({ value: String(s), label: `${s} seconds` }))}
            />
            <p className="mt-2 text-xs text-muted">The driver sees a countdown and can cancel or send right away. If the phone is offline, it sends when the connection returns.</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">Drivers will see a “Send delivery notice” button after Delivered instead.</p>
        )}
      </Card>

      {preview ? (
        <Card>
          <SectionTitle>What the customer receives</SectionTitle>
          <p className="whitespace-pre-line rounded-md border border-line-soft bg-white p-3 text-sm">{preview.body}</p>
          <p className="mt-2 text-xs text-muted">Example from job #{sample!.number}. Prototype: messages are recorded, not actually sent.</p>
        </Card>
      ) : null}
    </>
  );
}
