"use client";

import { useState } from "react";

import { Icon } from "@/components/icons";
import { Button, inputClass } from "@/components/ui";
import type { LineItem } from "@/lib/domain";
import { newId } from "@/lib/jobs";
import { formatMoney, GST_PERCENT, lineTotalCents, parseDollars, totals, unitText } from "@/lib/money";

export function LineItemEditor({ items, onChange, disabled }: { items: LineItem[]; onChange: (items: LineItem[]) => void; disabled?: boolean }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const setQuantity = (id: string, quantity: number) => {
    onChange(items.map((i) => (i.id === id ? { ...i, quantity: Math.max(0, Number.isFinite(quantity) ? quantity : 0) } : i)));
  };

  const addCharge = () => {
    const cents = parseDollars(amount);
    if (!label.trim() || cents === null) return setAddError("Enter a description and an amount, e.g. 45.00");
    onChange([...items, { id: newId("x-"), label: label.trim(), quantity: 1, unitCents: cents }]);
    setLabel("");
    setAmount("");
    setAddError(null);
  };

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const active = item.quantity > 0;
        return (
          <div key={item.id} className={`rounded-md border p-3 transition ${active ? "border-line bg-white" : "border-line-soft bg-paper"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`font-semibold ${active ? "text-ink" : "text-subtle"}`}>{item.label}</p>
                <p className="text-xs text-muted">
                  {item.unitLabel ? `${unitText(item.quantity, item.unitLabel)} × ${formatMoney(item.unitCents)}` : `${formatMoney(item.unitCents)} each`}
                </p>
              </div>
              <p className={`shrink-0 font-bold tabular-nums ${active ? "text-ink" : "text-subtle"}`}>{formatMoney(lineTotalCents(item))}</p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                disabled={disabled || item.quantity <= 0}
                aria-label={`Less ${item.label}`}
                onClick={() => setQuantity(item.id, item.quantity - 1)}
                className="grid h-11 w-11 place-items-center rounded-md border border-line bg-paper text-xl font-bold text-ink disabled:opacity-40"
              >
                −
              </button>
              <input
                aria-label={`${item.label} quantity`}
                inputMode="decimal"
                disabled={disabled}
                className="h-11 w-20 rounded-md border border-line bg-white text-center text-base font-semibold tabular-nums outline-none focus:border-pine"
                value={item.quantity}
                onChange={(e) => setQuantity(item.id, Number(e.target.value))}
              />
              <button
                type="button"
                disabled={disabled}
                aria-label={`More ${item.label}`}
                onClick={() => setQuantity(item.id, item.quantity + 1)}
                className="grid h-11 w-11 place-items-center rounded-md bg-forest text-xl font-bold text-white shadow-[0_2px_0_#0e291c] disabled:opacity-40"
              >
                +
              </button>
              <span className="text-sm text-muted">{item.unitLabel ? unitText(item.quantity, item.unitLabel).replace(/^\S+ /, "") : ""}</span>
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => onChange(items.filter((i) => i.id !== item.id))}
                  className="ml-auto inline-flex min-h-10 items-center gap-1 rounded px-2 text-sm font-semibold text-muted hover:text-danger"
                >
                  <Icon name="x" className="h-4 w-4" /> Remove
                </button>
              ) : null}
            </div>
          </div>
        );
      })}

      {!disabled ? (
        <div className="rounded-md border border-dashed border-line p-3">
          <p className="mb-2 text-sm font-semibold text-ink">Add a charge</p>
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <input className={inputClass} placeholder="Description" value={label} onChange={(e) => setLabel(e.target.value)} />
            <input className={inputClass} placeholder="$0.00" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          {addError ? <p className="mt-2 text-sm text-danger">{addError}</p> : null}
          <Button variant="secondary" full icon="plus" className="mt-2" onClick={addCharge}>
            Add charge
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function Totals({ items, label = "Estimated total" }: { items: Pick<LineItem, "quantity" | "unitCents">[]; label?: string }) {
  const t = totals(items);
  return (
    <div className="rounded-lg bg-forest p-4 text-white shadow-[0_3px_0_#0e291c]">
      <div className="flex justify-between text-sm text-[#b6c6bb]">
        <span>Subtotal</span>
        <span className="tabular-nums">{formatMoney(t.subtotalCents)}</span>
      </div>
      <div className="mt-1 flex justify-between text-sm text-[#b6c6bb]">
        <span>GST {GST_PERCENT}%</span>
        <span className="tabular-nums">{formatMoney(t.gstCents)}</span>
      </div>
      <div className="mt-3 flex items-end justify-between border-t border-white/15 pt-3">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-signal">{label}</span>
        <span className="text-[32px] font-extrabold leading-none tracking-tight tabular-nums">{formatMoney(t.totalCents)}</span>
      </div>
    </div>
  );
}

export function sameItems(a: LineItem[], b: LineItem[]) {
  const norm = (items: LineItem[]) =>
    JSON.stringify(
      items
        .filter((i) => i.quantity > 0)
        .map((i) => [i.id, i.label, i.quantity, i.unitCents]),
    );
  return norm(a) === norm(b);
}
