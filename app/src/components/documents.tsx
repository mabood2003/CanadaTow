import type { Company, Estimate, Invoice, JobVehicle, LineItem } from "@/lib/domain";
import { TOW_EVENT_LABELS, TOW_EVENTS } from "@/lib/domain";
import { formatMoney, GST_PERCENT, lineTotalCents } from "@/lib/money";
import { formatDateTime } from "@/lib/time";

function vehicleText(v: JobVehicle) {
  return [v.plate && `${v.plate} (${v.province})`, [v.year, v.colour, v.make, v.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
}

function ItemsTable({ items, subtotalCents, gstCents, totalCents, totalLabel }: { items: LineItem[]; subtotalCents: number; gstCents: number; totalCents: number; totalLabel: string }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {items.map((item) => (
          <tr key={item.id} className="border-b border-slate-100 align-top">
            <td className="py-2 pr-2">
              <p className="font-medium text-slate-900">{item.label}</p>
              <p className="text-xs text-slate-500">
                {item.quantity} × {formatMoney(item.unitCents)}
                {item.unitLabel ? ` per ${item.unitLabel}` : ""}
              </p>
            </td>
            <td className="py-2 text-right tabular-nums">{formatMoney(lineTotalCents(item))}</td>
          </tr>
        ))}
        <tr>
          <td className="pt-3 text-slate-600">Subtotal</td>
          <td className="pt-3 text-right tabular-nums">{formatMoney(subtotalCents)}</td>
        </tr>
        <tr>
          <td className="text-slate-600">GST ({GST_PERCENT}%)</td>
          <td className="text-right tabular-nums">{formatMoney(gstCents)}</td>
        </tr>
        <tr className="text-lg font-bold">
          <td className="pt-2">{totalLabel}</td>
          <td className="pt-2 text-right tabular-nums">{formatMoney(totalCents)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function BusinessBlock({ company }: { company: Company }) {
  return (
    <div>
      <p className="text-xl font-bold text-slate-900">{company.name}</p>
      <p className="text-sm text-slate-600">{company.address}</p>
      <p className="text-sm text-slate-600">
        {company.phone}
        {company.email ? ` · ${company.email}` : ""}
      </p>
    </div>
  );
}

export function EstimateDocument({ company, estimate, jobNumber }: { company: Company; estimate: Estimate; jobNumber: string }) {
  const contact = [estimate.customer.mobile, estimate.customer.email].filter(Boolean).join(" · ");
  return (
    <article className="print-plain rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <BusinessBlock company={company} />
        <div className="shrink-0 text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Written estimate</p>
          <p className="text-sm font-semibold text-slate-900">
            {jobNumber} · v{estimate.version}
          </p>
          <p className="text-xs text-slate-500">{formatDateTime(estimate.issuedAt)}</p>
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 py-4 text-sm">
        <dt className="text-slate-500">Prepared for</dt>
        <dd className="font-medium">{estimate.customer.name}</dd>
        <dt className="text-slate-500">Contact</dt>
        <dd>{contact || "—"}</dd>
        <dt className="text-slate-500">Vehicle</dt>
        <dd>{vehicleText(estimate.vehicle) || "—"}</dd>
        <dt className="text-slate-500">From</dt>
        <dd>{estimate.pickup || "—"}</dd>
        <dt className="text-slate-500">To</dt>
        <dd className="font-medium">{estimate.destination}</dd>
      </dl>

      <ItemsTable items={estimate.items} subtotalCents={estimate.subtotalCents} gstCents={estimate.gstCents} totalCents={estimate.totalCents} totalLabel="Estimated total" />

      <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
        <strong>Storage:</strong> {formatMoney(estimate.storagePerDayCents)} per day (plus GST) while your vehicle is stored with us.
      </p>

      <div className="mt-4 rounded-xl bg-sky-50 p-3 text-sm text-sky-950 ring-1 ring-sky-200">
        <p className="font-semibold">Your rights</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>We must give you this written estimate and get your consent before towing your vehicle.</li>
          <li>You can ask questions before you agree. You don&apos;t have to consent.</li>
          <li>You&apos;ll get an itemized invoice before you pay.</li>
          <li>If your vehicle is moved somewhere else, we&apos;ll let you know.</li>
        </ul>
      </div>
    </article>
  );
}

export function InvoiceDocument({ company, invoice, jobNumber }: { company: Company; invoice: Invoice; jobNumber: string }) {
  const contact = [invoice.customer.mobile, invoice.customer.email].filter(Boolean).join(" · ");
  return (
    <article className="print-plain rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <BusinessBlock company={company} />
          {company.gstNumber ? <p className="text-xs text-slate-500">GST no. {company.gstNumber}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Invoice</p>
          <p className="text-lg font-bold text-slate-900">{invoice.number}</p>
          <p className="text-xs text-slate-500">Issued {formatDateTime(invoice.issuedAt)}</p>
          <p className="text-xs text-slate-500">Job {jobNumber}</p>
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 py-4 text-sm">
        <dt className="text-slate-500">Customer</dt>
        <dd className="font-medium">{invoice.customer.name || "—"}</dd>
        <dt className="text-slate-500">Contact</dt>
        <dd>{contact || "—"}</dd>
        <dt className="text-slate-500">Vehicle</dt>
        <dd>{vehicleText(invoice.vehicle) || "—"}</dd>
        <dt className="text-slate-500">Pickup</dt>
        <dd>{invoice.pickup}</dd>
        <dt className="text-slate-500">Delivered to</dt>
        <dd>{invoice.destination}</dd>
        {TOW_EVENTS.map((e) => (
          <Row key={e} label={TOW_EVENT_LABELS[e]} value={formatDateTime(invoice.tow[e])} />
        ))}
      </dl>

      <ItemsTable items={invoice.items} subtotalCents={invoice.subtotalCents} gstCents={invoice.gstCents} totalCents={invoice.totalCents} totalLabel="Total" />
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
