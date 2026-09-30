"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useEffect, useSyncExternalStore } from "react";

import { Icon, type IconName } from "@/components/icons";
import type { Company } from "@/lib/domain";
import { initials } from "@/lib/describe";
import { useAppState } from "@/lib/store";
import type { Tone } from "@/lib/tow-rules";

export const inputClass =
  "w-full rounded-md border border-line bg-white px-3 py-3 text-base text-ink placeholder:text-subtle outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15 disabled:bg-sand/60 disabled:text-muted";

const toneClasses: Record<Tone, { pill: string; banner: string; icon: string }> = {
  neutral: { pill: "bg-[#edf2ed] text-[#355341]", banner: "bg-paper text-ink border-line", icon: "text-muted" },
  info: { pill: "bg-[#e9eff7] text-[#335d86]", banner: "bg-[#eef3f9] text-[#23405e] border-[#c9d8ea]", icon: "text-[#335d86]" },
  good: { pill: "bg-[#e5f3e9] text-[#22613e]", banner: "bg-[#eaf5ed] text-[#163f28] border-[#b9dcc4]", icon: "text-ok" },
  warn: { pill: "bg-[#fff0dd] text-[#945b0e]", banner: "bg-[#fff6ea] text-[#5c3908] border-[#f1d3a6]", icon: "text-[#b86e0f]" },
  bad: { pill: "bg-[#fdeceb] text-danger", banner: "bg-[#fdf0ef] text-[#7a1911] border-[#f2c3be]", icon: "text-danger" },
};

const toneIcon: Record<Tone, IconName> = { neutral: "info", info: "info", good: "check", warn: "alert", bad: "alert" };

// ---------------------------------------------------------------------------
// Brand

export function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand-mark ${small ? "small" : ""}`} aria-hidden>
      <span />
    </span>
  );
}

/** The towing company's own mark: uploaded logo, else initials. */
export function CompanyMark({ company, size = "md" }: { company: Pick<Company, "name" | "logo">; size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "h-14 w-14 text-lg" : size === "sm" ? "h-8 w-8 text-[11px]" : "h-10 w-10 text-sm";
  if (company.logo) {
    // eslint-disable-next-line @next/next/no-img-element -- uploaded logo is a local data URL
    return <img src={company.logo} alt={`${company.name} logo`} className={`${box} shrink-0 rounded-md bg-white object-contain ring-1 ring-line`} />;
  }
  return (
    <span aria-hidden className={`${box} grid shrink-0 place-items-center rounded-md bg-forest font-bold tracking-tight text-signal`}>
      {initials(company.name)}
    </span>
  );
}

export function Kicker({ children, light = false, className = "" }: { children: ReactNode; light?: boolean; className?: string }) {
  return <p className={`font-mono text-[11px] font-bold uppercase tracking-[0.12em] ${light ? "text-signal" : "text-pine"} ${className}`}>{children}</p>;
}

// ---------------------------------------------------------------------------
// Status

export function Chip({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${toneClasses[tone].pill}`}>{children}</span>;
}

export function Banner({ tone = "neutral", title, icon, children }: { tone?: Tone; title?: ReactNode; icon?: IconName; children?: ReactNode }) {
  return (
    <div role={tone === "bad" ? "alert" : undefined} className={`flex gap-3 rounded-lg border p-4 text-sm ${toneClasses[tone].banner}`}>
      <Icon name={icon ?? toneIcon[tone]} className={`mt-0.5 h-5 w-5 ${toneClasses[tone].icon}`} />
      <div className="min-w-0 flex-1">
        {title ? <p className="text-base font-bold leading-snug">{title}</p> : null}
        {children ? <div className={title ? "mt-1 leading-relaxed" : "leading-relaxed"}>{children}</div> : null}
      </div>
    </div>
  );
}

export function CheckMark({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-forest text-signal">
      <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />
    </span>
  ) : (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-dashed border-line text-subtle">
      <span className="h-0.5 w-2 rounded bg-current" />
    </span>
  );
}

export function CheckRow({ ok, label, detail, action, missingTone = "bad" }: { ok: boolean; label: string; detail?: ReactNode; action?: ReactNode; missingTone?: "bad" | "neutral" }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 ${ok ? "border-line-soft bg-white" : missingTone === "bad" ? "border-[#f2c3be] bg-[#fdf6f5]" : "border-line-soft bg-white"}`}>
      <div className="flex min-w-0 items-center gap-3">
        <CheckMark ok={ok} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{label}</p>
          {detail ? <p className="mt-0.5 truncate text-xs text-muted">{detail}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout

export function Card({ children, className = "", padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <section className={`rounded-lg border border-line bg-paper shadow-[0_1px_0_#e3e1d6] ${padded ? "p-4 sm:p-5" : ""} ${className}`}>{children}</section>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{children}</h2>
      {right}
    </div>
  );
}

export function PageShell({ children, width = "narrow" }: { children: ReactNode; width?: "narrow" | "wide" | "full" }) {
  const max = width === "full" ? "max-w-7xl" : width === "wide" ? "max-w-5xl" : "max-w-md";
  return <main className={`mx-auto w-full px-4 pb-20 pt-5 sm:px-6 ${max}`}>{children}</main>;
}

export function ScreenHeader({
  back,
  kicker,
  title,
  subtitle,
  right,
}: {
  back?: { href: string; label: string };
  kicker?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="mb-5">
      {back ? (
        <Link replace href={back.href} className="-ml-1 mb-2 inline-flex min-h-10 items-center gap-1.5 rounded px-1 text-sm font-semibold text-muted hover:text-ink">
          <Icon name="arrowLeft" className="h-4 w-4" /> {back.label}
        </Link>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {kicker ? <Kicker className="mb-1.5">{kicker}</Kicker> : null}
          <h1 className="text-[28px] font-extrabold leading-[1.05] tracking-[-0.045em] text-ink sm:text-[34px]">{title}</h1>
          {subtitle ? <div className="mt-2 text-sm text-muted">{subtitle}</div> : null}
        </div>
        {right}
      </div>
    </header>
  );
}

export function Loading() {
  return (
    <PageShell>
      <p className="py-20 text-center text-sm text-muted">Loading…</p>
    </PageShell>
  );
}

export function DataList({ rows, className = "" }: { rows: [ReactNode, ReactNode][]; className?: string }) {
  return (
    <dl className={`grid grid-cols-[minmax(5.5rem,auto)_1fr] gap-x-4 gap-y-2 text-sm ${className}`}>
      {rows.map(([label, value], i) => (
        <div key={i} className="contents">
          <dt className="text-muted">{label}</dt>
          <dd className="min-w-0 break-words text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-paper p-5 shadow-[0_18px_50px_#1f362840] sm:rounded-xl ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-md text-muted hover:bg-sand">
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buttons

type Variant = "primary" | "signal" | "secondary" | "danger" | "ghost";

const variantClasses: Record<Variant, string> = {
  primary: "bg-forest text-white shadow-[0_3px_0_#0e291c] hover:bg-forest-hover hover:-translate-y-px",
  signal: "bg-signal text-forest shadow-[0_3px_0_#aabe25] hover:bg-signal-hover hover:-translate-y-px",
  secondary: "border border-line bg-white text-ink hover:border-pine/50 hover:bg-paper",
  danger: "bg-danger text-white shadow-[0_3px_0_#7a1911] hover:bg-[#9c1e14]",
  ghost: "text-pine hover:bg-mint",
};

export function buttonClass(variant: Variant = "primary", size: "sm" | "md" | "lg" = "md", full = false) {
  return [
    "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition duration-150 active:translate-y-0.5 active:shadow-none",
    "disabled:pointer-events-none disabled:border-transparent disabled:bg-sand disabled:text-subtle disabled:shadow-none",
    size === "lg" ? "min-h-14 px-5 text-[17px]" : size === "sm" ? "min-h-10 px-3 text-sm" : "min-h-12 px-4 text-[15px]",
    full ? "w-full" : "",
    variantClasses[variant],
  ].join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  full = false,
  icon,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg"; full?: boolean; icon?: IconName }) {
  return (
    <button type="button" {...props} className={`${buttonClass(variant, size, full)} ${className}`}>
      {icon ? <Icon name={icon} className="h-[18px] w-[18px]" /> : null}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  full = false,
  replace,
  icon,
  trailing,
  children,
  target,
  className = "",
}: {
  href: string;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  full?: boolean;
  replace?: boolean;
  icon?: IconName;
  trailing?: IconName;
  children: ReactNode;
  target?: string;
  className?: string;
}) {
  return (
    <Link href={href} replace={replace} target={target} className={`${buttonClass(variant, size, full)} ${className}`}>
      {icon ? <Icon name={icon} className="h-[18px] w-[18px]" /> : null}
      {children}
      {trailing ? <Icon name={trailing} className="h-[18px] w-[18px]" /> : null}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Form controls

export function Field({ label, hint, children, optional }: { label: string; hint?: ReactNode; children: ReactNode; optional?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {optional ? <span className="ml-1 font-normal text-subtle">(optional)</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Checkbox({ checked, onChange, children, disabled }: { checked: boolean; onChange: (value: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className={`flex min-h-12 items-start gap-3 rounded-md border p-3 ${checked ? "border-pine/40 bg-mint" : "border-line bg-white"} ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#24573d]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-sm text-ink">{children}</span>
    </label>
  );
}

export function Toggle({ checked, onChange, label, detail, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: ReactNode; detail?: ReactNode; disabled?: boolean }) {
  return (
    <label className={`flex items-center justify-between gap-4 py-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {detail ? <span className="mt-0.5 block text-xs text-muted">{detail}</span> : null}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-line transition peer-checked:bg-pine peer-focus-visible:ring-2 peer-focus-visible:ring-pine/30" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (value: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-md border border-line bg-sand/60 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 rounded px-3 text-sm font-semibold transition ${value === o.value ? "bg-forest text-white shadow-sm" : "text-muted hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Big tappable choice (request type, consent method, etc). */
export function ChoiceButton({
  selected,
  onClick,
  title,
  detail,
  icon,
  disabled,
  role = "radio",
}: {
  selected: boolean;
  onClick: () => void;
  title: ReactNode;
  detail?: ReactNode;
  icon?: IconName;
  disabled?: boolean;
  role?: "radio" | "button";
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={role === "radio" ? selected : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-14 w-full items-center gap-3 rounded-md border px-4 py-3 text-left transition disabled:opacity-40 ${
        selected ? "border-forest bg-forest text-white shadow-[0_3px_0_#0e291c]" : "border-line bg-white text-ink hover:border-pine/50"
      }`}
    >
      {icon ? (
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${selected ? "bg-signal text-forest" : "bg-mint text-pine"}`}>
          <Icon name={icon} className="h-[18px] w-[18px]" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-snug">{title}</span>
        {detail ? <span className={`mt-0.5 block text-xs ${selected ? "text-[#b6c6bb]" : "text-muted"}`}>{detail}</span> : null}
      </span>
      {selected ? <Icon name="check" className="h-5 w-5 text-signal" strokeWidth={3} /> : null}
    </button>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md border border-[#f2c3be] bg-[#fdf0ef] p-3 text-sm font-medium text-[#7a1911]">
      <Icon name="alert" className="mt-0.5 h-4 w-4" /> {message}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Connectivity

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** False when the device is offline, or when interview mode is simulating it. */
export function useOnline(): boolean {
  const app = useAppState();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  return online && !app?.simulateOffline;
}

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="no-print sticky top-0 z-50 flex items-center justify-center gap-2 bg-offline px-4 py-2.5 text-center text-sm font-semibold text-white">
      <Icon name="wifiOff" className="h-4 w-4" />
      Offline — job saved locally. Will sync when connection returns.
    </div>
  );
}
