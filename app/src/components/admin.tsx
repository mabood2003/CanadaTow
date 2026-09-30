"use client";

import type { ReactNode } from "react";

import { Icon } from "@/components/icons";
import { Kicker } from "@/components/ui";
import type { AppState } from "@/lib/seed";
import { currentUser } from "@/lib/store";

export function isOwner(app: AppState) {
  return currentUser(app)?.role === "owner";
}

export function AdminHeader({ kicker, title, children, right }: { kicker: string; title: ReactNode; children?: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-2xl">
        <Kicker>{kicker}</Kicker>
        <h1 className="mt-1.5 text-[32px] font-extrabold leading-[1.03] tracking-[-0.05em] sm:text-[40px]">{title}</h1>
        {children ? <div className="mt-2 text-[15px] leading-relaxed text-muted">{children}</div> : null}
      </div>
      {right}
    </header>
  );
}

/** "Your company controls its forms, rates, wording and workflows." */
export function ProductBoundary({ company }: { company: string }) {
  return (
    <aside className="flex gap-3 rounded-lg border border-line bg-paper p-4 text-sm leading-relaxed">
      <Icon name="info" className="mt-0.5 h-5 w-5 text-pine" />
      <p>
        <strong>{company} controls its forms, rates, wording and workflows.</strong> TowLedger provides tools to deliver, capture, organize and retain the resulting records. TowLedger doesn&apos;t provide legal advice.
      </p>
    </aside>
  );
}

export function SavedNote({ show, children = "Saved. New jobs use this configuration." }: { show: boolean; children?: ReactNode }) {
  if (!show) return null;
  return (
    <span role="status" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ok">
      <Icon name="check" className="h-4 w-4" strokeWidth={3} /> {children}
    </span>
  );
}
