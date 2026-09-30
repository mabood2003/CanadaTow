// Stored as UTC ISO strings; always displayed in Alberta time.
export const DISPLAY_TIME_ZONE = "America/Edmonton";

const dateTime = new Intl.DateTimeFormat("en-CA", {
  timeZone: DISPLAY_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const dateOnly = new Intl.DateTimeFormat("en-CA", {
  timeZone: DISPLAY_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
});

const timeOnly = new Intl.DateTimeFormat("en-CA", {
  timeZone: DISPLAY_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

export function formatDateTime(iso: string | undefined): string {
  return iso ? dateTime.format(new Date(iso)) : "—";
}

export function formatDate(iso: string | undefined): string {
  return iso ? dateOnly.format(new Date(iso)) : "—";
}

export function formatTime(iso: string | undefined): string {
  return iso ? timeOnly.format(new Date(iso)) : "—";
}

const dayLabel = new Intl.DateTimeFormat("en-CA", {
  timeZone: DISPLAY_TIME_ZONE,
  month: "short",
  day: "numeric",
});

/** "Sept. 30 at 2:14 p.m." style, in Alberta time. */
export function formatWhen(iso: string | undefined): string {
  return iso ? `${dayLabel.format(new Date(iso))} at ${timeOnly.format(new Date(iso))}` : "—";
}

/** A YYYY-MM-DD date shown as "Sep 8, 2026" (no time zone shift). */
export function formatPlainDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, m - 1, d));
}

/** Value for <input type="datetime-local"> in Alberta time. */
export function toLocalInput(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Parses an Alberta-time datetime-local value back to UTC ISO. */
export function fromLocalInput(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  // Guess UTC, then correct by the zone offset at that moment (handles DST).
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const shown = toLocalInput(new Date(guess).toISOString());
  const [sy, smo, sd, sh, smi] = shown.split(/[-T:]/).map(Number);
  const offset = Date.UTC(sy, smo - 1, sd, sh, smi) - guess;
  return new Date(guess - offset).toISOString();
}

export function addYears(iso: string, years: number): string {
  const date = new Date(iso);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString();
}
