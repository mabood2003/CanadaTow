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

export function addYears(iso: string, years: number): string {
  const date = new Date(iso);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString();
}
