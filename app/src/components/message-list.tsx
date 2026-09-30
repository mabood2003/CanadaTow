"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { Icon } from "@/components/icons";
import { Chip, inputClass } from "@/components/ui";
import type { MessageKind, MessageStatus, OutboundMessage } from "@/lib/domain";
import { MESSAGE_KIND_LABELS } from "@/lib/domain";
import { formatWhen } from "@/lib/time";
import type { Tone } from "@/lib/tow-rules";

const STATUS: Record<MessageStatus, { label: string; tone: Tone }> = {
  scheduled: { label: "Scheduled", tone: "warn" },
  sent: { label: "Sent", tone: "good" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export interface MessageRow {
  message: OutboundMessage;
  /** Where the job link goes (owner app, admin view…); omit for messages without a job. */
  jobHref?: string;
  /** Extra label, e.g. the company name in the admin log. */
  context?: ReactNode;
}

/** Searchable, filterable list of texts and emails, newest first. Tap a row to read the exact message. */
export function MessageList({ rows, empty = "No messages yet." }: { rows: MessageRow[]; empty?: string }) {
  const [kind, setKind] = useState<MessageKind | "all">("all");
  const [status, setStatus] = useState<MessageStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const shown = rows
    .filter((r) => kind === "all" || r.message.kind === kind)
    .filter((r) => status === "all" || r.message.status === status)
    .filter((r) => !q || `${r.message.to} ${r.message.body} ${r.message.jobNumber ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) => b.message.createdAt.localeCompare(a.message.createdAt));

  return (
    <div>
      <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label className="relative">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input className={`${inputClass} pl-9`} type="search" placeholder="Phone, email, job number or text" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <select aria-label="Message type" className={`${inputClass} md:w-48`} value={kind} onChange={(e) => setKind(e.target.value as MessageKind | "all")}>
          <option value="all">All messages</option>
          {(Object.keys(MESSAGE_KIND_LABELS) as MessageKind[]).map((k) => (
            <option key={k} value={k}>
              {MESSAGE_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <select aria-label="Message status" className={`${inputClass} md:w-40`} value={status} onChange={(e) => setStatus(e.target.value as MessageStatus | "all")}>
          <option value="all">Any status</option>
          <option value="sent">Sent</option>
          <option value="scheduled">Scheduled</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {shown.length === 0 ? <p className="py-10 text-center text-sm text-muted">{rows.length ? "No messages match." : empty}</p> : null}

      <ul className="divide-y divide-line-soft overflow-hidden rounded-lg border border-line bg-white">
        {shown.map(({ message: m, jobHref, context }) => {
          const expanded = open === m.id;
          return (
            <li key={m.id}>
              <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : m.id)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-paper">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mint text-pine">
                  <Icon name={m.channel === "text" ? "message" : "mail"} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold">{MESSAGE_KIND_LABELS[m.kind]}</span>
                    <Chip tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Chip>
                    {context}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-muted">
                    {m.channel === "text" ? "Text" : "Email"} to {m.to}
                    {m.jobNumber ? ` · job #${m.jobNumber}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs text-muted">{formatWhen(m.sentAt ?? m.cancelledAt ?? m.sendAt)}</span>
              </button>
              {expanded ? (
                <div className="space-y-2 bg-paper px-4 pb-4 pt-1 text-sm">
                  {m.subject ? <p className="font-semibold">Subject: {m.subject}</p> : null}
                  <p className="whitespace-pre-line rounded-md border border-line-soft bg-white p-3">{m.body}</p>
                  <p className="text-xs text-muted">
                    Created by {m.createdBy} · {formatWhen(m.createdAt)}
                    {m.status === "sent" ? ` · sent ${formatWhen(m.sentAt)}` : ""}
                    {m.status === "cancelled" ? ` · cancelled by ${m.cancelledBy} ${formatWhen(m.cancelledAt)}` : ""}
                    {m.status === "scheduled" ? ` · goes out ${formatWhen(m.sendAt)}` : ""}
                  </p>
                  {jobHref ? (
                    <Link href={jobHref} className="inline-flex min-h-9 items-center gap-1 font-semibold text-pine">
                      Open job #{m.jobNumber} <Icon name="arrowRight" className="h-4 w-4" />
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
