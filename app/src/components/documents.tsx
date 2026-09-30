import type { ReactNode } from "react";

import { Icon } from "@/components/icons";
import { CompanyMark } from "@/components/ui";
import type { Company, Estimate, Invoice, LineItem } from "@/lib/domain";
import { TOW_EVENT_LABELS, TOW_EVENTS } from "@/lib/domain";
import { vehicleName } from "@/lib/describe";
import { formatMoney, GST_PERCENT, lineTotalCents, unitText } from "@/lib/money";
import { formatDateTime } from "@/lib/time";

function ItemsTable({ items, subtotalCents, gstCents, totalCents, totalLabel }: { items: LineItem[]; subtotalCents: number; gstCents: number; totalCents: number; totalLabel: string }) {
  return (
    <div>
      <ul>
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 border-b border-line-soft py-2.5 text-sm">
            <div>
              <p className="font-semibold text-ink">{item.label}</p>
              <p className="text-xs text-muted">
                {item.unitLabel ? `${unitText(item.quantity, item.unitLabel)} × ${formatMoney(item.unitCents)}` : item.quantity === 1 ? "" : `${item.quantity} × ${formatMoney(item.unitCents)}`}
              </p>
            </div>
            <p className="tabular-nums">{formatMoney(lineTotalCents(item))}</p>
          </li>
        ))}
      </ul>
      <div className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between text-muted">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatMoney(subtotalCents)}</span>
        </div>
        <div className="flex justify-between text-muted">
          <span>GST ({GST_PERCENT}%)</span>
          <span className="tabular-nums">{formatMoney(gstCents)}</span>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between rounded-md bg-mint px-3 py-3">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-pine">{totalLabel}</span>
        <span className="text-[28px] font-extrabold leading-none tracking-tight tabular-nums text-ink">{formatMoney(totalCents)}</span>
      </div>
    </div>
  );
}

function DocHeader({ company, kicker, title, meta }: { company: Company; kicker: string; title: ReactNode; meta: ReactNode }) {
  return (
    <div className="border-b border-line-soft pb-4">
      <div className="flex items-center gap-3">
        <CompanyMark company={company} />
        <div className="min-w-0">
          <p className="truncate text-lg font-extrabold tracking-tight text-ink">{company.name}</p>
          <p className="text-xs text-muted">{company.phone}</p>
        </div>
      </div>
      <p className="mt-5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-pine">{kicker}</p>
      <h2 className="mt-1 text-2xl font-extrabold leading-tight tracking-[-0.04em] text-ink">{title}</h2>
      <p className="mt-1 text-xs text-muted">{meta}</p>
    </div>
  );
}

function Route({ from, to }: { from: string; to: string }) {
  return (
    <div className="grid grid-cols-[20px_1fr] gap-x-3 text-sm">
      <span className="mt-1 grid h-4 w-4 place-items-center rounded-full border-2 border-pine" />
      <div>
        <p className="text-xs text-muted">Pickup</p>
        <p className="font-medium text-ink">{from || "—"}</p>
      </div>
      <span className="mx-auto my-1 h-6 w-0.5 bg-line" />
      <span />
      <Icon name="mapPin" className="h-5 w-5 text-pine" />
      <div>
        <p className="text-xs text-muted">Destination</p>
        <p className="font-semibold text-ink">{to || "—"}</p>
      </div>
    </div>
  );
}

function BusinessFooter({ company }: { company: Company }) {
  return (
    <div className="mt-5 border-t border-line-soft pt-4 text-xs leading-relaxed text-muted">
      <p className="font-semibold text-ink">{company.name}</p>
      <p>{company.address}</p>
      <p>
        {company.phone}
        {company.email ? ` · ${company.email}` : ""}
      </p>
      {company.gstNumber ? <p>GST no. {company.gstNumber}</p> : null}
    </div>
  );
}

export function EstimateDocument({ company, estimate, jobNumber }: { company: Company; estimate: Estimate; jobNumber: string }) {
  const contact = [estimate.customer.mobile, estimate.customer.email].filter(Boolean).join(" · ");
  return (
    <article className="print-plain rounded-lg border border-line bg-paper p-5 shadow-[0_18px_50px_#1f362812]">
      <DocHeader
        company={company}
        kicker={`Estimate #${jobNumber}${estimate.version > 1 ? ` · v${estimate.version}` : ""}`}
        title="Your tow estimate"
        meta={`Issued ${formatDateTime(estimate.issuedAt)}`}
      />

      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted">Prepared for</p>
            <p className="font-semibold text-ink">{estimate.customer.name}</p>
            <p className="text-xs text-muted">{contact || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Vehicle</p>
            <p className="font-semibold text-ink">{vehicleName(estimate.vehicle)}</p>
            <p className="text-xs text-muted">
              {estimate.vehicle.plate} ({estimate.vehicle.province})
            </p>
          </div>
        </div>
        <Route from={estimate.pickup} to={estimate.destination} />
      </div>

      <ItemsTable items={estimate.items} subtotalCents={estimate.subtotalCents} gstCents={estimate.gstCents} totalCents={estimate.totalCents} totalLabel="Estimated total" />

      <p className="mt-4 flex items-start gap-2 rounded-md border border-line-soft bg-white p-3 text-sm text-ink">
        <Icon name="building" className="mt-0.5 h-4 w-4 text-pine" />
        <span>
          <strong>Storage:</strong> {formatMoney(estimate.storagePerDayCents)} per day (plus GST) if your vehicle is stored at our yard.
        </span>
      </p>

      {estimate.notes ? <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">{estimate.notes}</p> : null}
      <BusinessFooter company={company} />
    </article>
  );
}

export function InvoiceDocument({ company, invoice, jobNumber }: { company: Company; invoice: Invoice; jobNumber: string }) {
  const contact = [invoice.customer.mobile, invoice.customer.email].filter(Boolean).join(" · ");
  return (
    <article className="print-plain rounded-lg border border-line bg-paper p-5 shadow-[0_18px_50px_#1f362812]">
      <DocHeader company={company} kicker={`Invoice · Job #${jobNumber}`} title={invoice.number} meta={`Issued ${formatDateTime(invoice.issuedAt)}`} />

      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted">Billed to</p>
            <p className="font-semibold text-ink">{invoice.customer.name || "—"}</p>
            <p className="text-xs text-muted">{contact || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Vehicle</p>
            <p className="font-semibold text-ink">{vehicleName(invoice.vehicle)}</p>
            <p className="text-xs text-muted">
              {invoice.vehicle.plate} ({invoice.vehicle.province})
            </p>
          </div>
        </div>
        <Route from={invoice.pickup} to={invoice.destination} />
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-md border border-line-soft bg-white p-3 text-xs">
          {TOW_EVENTS.map((e) => (
            <div key={e} className="contents">
              <dt className="text-muted">{TOW_EVENT_LABELS[e]}</dt>
              <dd className="text-right tabular-nums text-ink">{formatDateTime(invoice.tow[e])}</dd>
            </div>
          ))}
        </dl>
      </div>

      <ItemsTable items={invoice.items} subtotalCents={invoice.subtotalCents} gstCents={invoice.gstCents} totalCents={invoice.totalCents} totalLabel="Total" />
      {invoice.notes ? <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted">{invoice.notes}</p> : null}
      <BusinessFooter company={company} />
    </article>
  );
}

/** The towing company's own consent wording, labelled as theirs. */
export function CompanyConsentBlock({ heading, wording, version, children }: { heading: string; wording: string; version: number; children?: ReactNode }) {
  return (
    <section className="rounded-lg border-2 border-forest bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-extrabold leading-snug tracking-tight text-ink">{heading}</h3>
        <span className="shrink-0 rounded bg-mint px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-pine">v{version}</span>
      </div>
      <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink">{wording}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
