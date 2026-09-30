"use client";

import { useState } from "react";

import { Button, inputClass } from "@/components/ui";
import type { LineItem } from "@/lib/domain";
import { newId } from "@/lib/jobs";
import { formatMoney, GST_PERCENT, lineTotalCents, parseDollars, totals } from "@/lib/money";

const BUILT_IN = new Set(["hookup", "km", "winch", "after_hours", "storage"]);

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
      {items.map((item) => (
        <div key={item.id} className={`rounded-xl p-3 ring-1 ${item.quantity > 0 ? "bg-white ring-slate-300" : "bg-slate-50 ring-slate-200"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`font-semibold ${item.quantity > 0 ? "text-slate-900" : "text-slate-500"}`}>{item.label}</p>
              <p className="text-xs text-slate-500">
                {formatMoney(item.unitCents)}
                {item.unitLabel ? ` per ${item.unitLabel}` : " each"}
              </p>
            </div>
            <p className="shrink-0 font-semibold tabular-nums text-slate-900">{formatMoney(lineTotalCents(item))}</p>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              disabled={disabled || item.quantity <= 0}
              aria-label={`Less ${item.label}`}
              onClick={() => setQuantity(item.id, item.quantity - 1)}
              className="h-11 w-11 rounded-full bg-slate-200 text-xl font-bold text-slate-800 disabled:opacity-40"
            >
              −
            </button>
            <input
              aria-label={`${item.label} quantity`}
              inputMode="decimal"
              disabled={disabled}
              className="h-11 w-20 rounded-xl border border-slate-300 text-center text-base font-semibold tabular-nums"
              value={item.quantity}
              onChange={(e) => setQuantity(item.id, Number(e.target.value))}
            />
            <button
              type="button"
              disabled={disabled}
              aria-label={`More ${item.label}`}
              onClick={() => setQuantity(item.id, item.quantity + 1)}
              className="h-11 w-11 rounded-full bg-slate-900 text-xl font-bold text-white disabled:opacity-40"
            >
              +
            </button>
            <span className="text-sm text-slate-500">{item.unitLabel ? `${item.unitLabel}${item.quantity === 1 ? "" : "s"}` : ""}</span>
            {!BUILT_IN.has(item.id) && !disabled ? (
              <button type="button" onClick={() => onChange(items.filter((i) => i.id !== item.id))} className="ml-auto min-h-10 px-2 text-sm font-semibold text-red-700">
                Remove
              </button>
            ) : null}
          </div>
        </div>
      ))}

      {!disabled ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-3">
          <p className="mb-2 text-sm font-semibold text-slate-700">Add a charge</p>
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <input className={inputClass} placeholder="Description" value={label} onChange={(e) => setLabel(e.target.value)} />
            <input className={inputClass} placeholder="$0.00" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          {addError ? <p className="mt-2 text-sm text-red-700">{addError}</p> : null}
          <Button variant="secondary" full className="mt-2" onClick={addCharge}>
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
    <div className="rounded-2xl bg-slate-900 p-4 text-white">
      <div className="flex justify-between text-sm text-slate-300">
        <span>Subtotal</span>
        <span className="tabular-nums">{formatMoney(t.subtotalCents)}</span>
      </div>
      <div className="mt-1 flex justify-between text-sm text-slate-300">
        <span>GST {GST_PERCENT}%</span>
        <span className="tabular-nums">{formatMoney(t.gstCents)}</span>
      </div>
      <div className="mt-2 flex justify-between border-t border-slate-700 pt-2 text-xl font-bold">
        <span>{label}</span>
        <span className="tabular-nums">{formatMoney(t.totalCents)}</span>
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
