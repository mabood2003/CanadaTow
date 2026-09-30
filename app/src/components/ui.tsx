"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useSyncExternalStore } from "react";

import type { Tone } from "@/lib/tow-rules";

export const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100 disabled:text-slate-500";

const toneClasses: Record<Tone, { chip: string; banner: string }> = {
  neutral: { chip: "bg-slate-100 text-slate-700", banner: "bg-slate-50 text-slate-800 ring-slate-200" },
  info: { chip: "bg-sky-100 text-sky-800", banner: "bg-sky-50 text-sky-900 ring-sky-200" },
  good: { chip: "bg-emerald-100 text-emerald-800", banner: "bg-emerald-50 text-emerald-900 ring-emerald-200" },
  warn: { chip: "bg-amber-100 text-amber-900", banner: "bg-amber-50 text-amber-950 ring-amber-300" },
  bad: { chip: "bg-red-100 text-red-800", banner: "bg-red-50 text-red-900 ring-red-300" },
};

export function Chip({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${toneClasses[tone].chip}`}>
      {children}
    </span>
  );
}

export function Banner({ tone = "neutral", title, children }: { tone?: Tone; title?: ReactNode; children?: ReactNode }) {
  return (
    <div role={tone === "bad" ? "alert" : undefined} className={`rounded-2xl p-4 text-sm ring-1 ${toneClasses[tone].banner}`}>
      {title ? <p className="text-base font-semibold">{title}</p> : null}
      {children ? <div className={title ? "mt-1" : ""}>{children}</div> : null}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 ${className}`}>{children}</section>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{children}</h2>
      {right}
    </div>
  );
}

type Variant = "primary" | "secondary" | "danger" | "success";

const variantClasses: Record<Variant, string> = {
  primary: "bg-slate-900 text-white hover:bg-slate-800",
  secondary: "bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50",
  danger: "bg-red-600 text-white hover:bg-red-700",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
};

function buttonClass(variant: Variant, size: "md" | "lg", full: boolean) {
  return [
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.99]",
    "disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:ring-0",
    size === "lg" ? "min-h-14 px-5 text-lg" : "min-h-12 px-4 text-base",
    full ? "w-full" : "",
    variantClasses[variant],
  ].join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  full = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "md" | "lg"; full?: boolean }) {
  return <button type="button" {...props} className={`${buttonClass(variant, size, full)} ${className}`} />;
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  full = false,
  replace,
  children,
  target,
}: {
  href: string;
  variant?: Variant;
  size?: "md" | "lg";
  full?: boolean;
  replace?: boolean;
  children: ReactNode;
  target?: string;
}) {
  return (
    <Link href={href} replace={replace} target={target} className={buttonClass(variant, size, full)}>
      {children}
    </Link>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Checkbox({ checked, onChange, children, disabled }: { checked: boolean; onChange: (value: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className={`flex min-h-12 items-start gap-3 rounded-xl p-3 ring-1 ${checked ? "bg-emerald-50 ring-emerald-300" : "bg-white ring-slate-300"} ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-600" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-sm text-slate-800">{children}</span>
    </label>
  );
}

export function CheckRow({ ok, label, detail, action }: { ok: boolean; label: string; detail?: ReactNode; action?: ReactNode }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl p-3 ring-1 ${ok ? "bg-emerald-50 ring-emerald-200" : "bg-red-50 ring-red-200"}`}>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">
          <span aria-hidden className={ok ? "text-emerald-700" : "text-red-700"}>{ok ? "✓" : "✗"}</span> {label}
        </p>
        {detail ? <p className="mt-0.5 text-xs text-slate-600">{detail}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800 ring-1 ring-red-200">
      {message}
    </p>
  );
}

export function ScreenHeader({
  back,
  title,
  subtitle,
  right,
}: {
  back?: { href: string; label: string };
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="mb-4">
      {back ? (
        <Link replace href={back.href} className="mb-2 inline-flex min-h-10 items-center text-sm font-semibold text-slate-600 hover:text-slate-900">
          ← {back.label}
        </Link>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
        </div>
        {right}
      </div>
    </header>
  );
}

export function PageShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <main className={`mx-auto w-full px-4 pb-16 pt-4 ${wide ? "max-w-5xl" : "max-w-md"}`}>{children}</main>;
}

export function Loading() {
  return (
    <PageShell>
      <p className="py-20 text-center text-sm text-slate-500">Loading…</p>
    </PageShell>
  );
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="sticky top-0 z-50 bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-amber-950">
      Offline — job saved on this device and will sync when connection returns.
    </div>
  );
}
