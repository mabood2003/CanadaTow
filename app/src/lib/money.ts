import type { LineItem } from "@/lib/domain";

export const GST_PERCENT = 5;

export function calculateGst(subtotalCents: number): number {
  return Math.round((subtotalCents * GST_PERCENT) / 100);
}

export function lineTotalCents(item: Pick<LineItem, "quantity" | "unitCents">): number {
  return Math.round(item.quantity * item.unitCents);
}

export function totals(items: Pick<LineItem, "quantity" | "unitCents">[]) {
  const subtotalCents = items.reduce((sum, item) => sum + lineTotalCents(item), 0);
  const gstCents = calculateGst(subtotalCents);
  return { subtotalCents, gstCents, totalCents: subtotalCents + gstCents };
}

const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

export function formatMoney(cents: number): string {
  return cad.format(cents / 100);
}

/** Parses a dollar string typed by a user ("12.5", "$1,200") into cents. Returns null if invalid. */
export function parseDollars(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "" || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}
