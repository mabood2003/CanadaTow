// Builds the "one job → one documentation package" export: documents, evidence, delivery record, activity log.
import type { Company, Estimate, Invoice, Job, LineItem } from "@/lib/domain";
import { CONSENT_METHOD_LABELS, DELIVERY_LABELS, ROLE_LABELS, TOW_EVENT_LABELS, TOW_EVENTS } from "@/lib/domain";
import { vehicleLine } from "@/lib/describe";
import { formatMoney, GST_PERCENT, lineTotalCents } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { jobRecord } from "@/lib/tow-rules";
import { dataUrlToBytes, type ZipEntry } from "@/lib/zip";

export interface PackageFile extends ZipEntry {
  label: string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function csv(rows: string[][]) {
  return rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\r\n");
}

function documentHtml(title: string, company: Company, meta: [string, string][], items: LineItem[], sums: { subtotalCents: number; gstCents: number; totalCents: number }, totalLabel: string, notes: string) {
  const rows = items
    .map((i) => `<tr><td>${esc(i.label)}<br><small>${i.quantity} × ${formatMoney(i.unitCents)}${i.unitLabel ? ` per ${i.unitLabel}` : ""}</small></td><td class="r">${formatMoney(lineTotalCents(i))}</td></tr>`)
    .join("");
  return `<!doctype html><html lang="en-CA"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:system-ui,sans-serif;color:#152019;background:#f3f0e7;margin:0;padding:32px}article{max-width:680px;margin:auto;background:#fbfaf6;border:1px solid #d8d9cf;border-radius:8px;padding:28px}
h1{font-size:22px;margin:0}small,.m{color:#667067}table{width:100%;border-collapse:collapse;margin-top:16px}td{padding:8px 0;border-bottom:1px solid #e5e7e1;vertical-align:top}.r{text-align:right}
.k{font:700 11px ui-monospace,monospace;letter-spacing:.12em;color:#24573d;text-transform:uppercase}dl{display:grid;grid-template-columns:auto 1fr;gap:4px 16px;margin:18px 0}dt{color:#667067}dd{margin:0}.t td{font-weight:700;font-size:18px;border:0}</style></head>
<body><article><p class="k">${esc(title)}</p><h1>${esc(company.name)}</h1><p class="m">${esc(company.address)}<br>${esc(company.phone)} · ${esc(company.email)}${company.gstNumber ? `<br>GST ${esc(company.gstNumber)}` : ""}</p>
<dl>${meta.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
<table>${rows}<tr><td>Subtotal</td><td class="r">${formatMoney(sums.subtotalCents)}</td></tr><tr><td>GST (${GST_PERCENT}%)</td><td class="r">${formatMoney(sums.gstCents)}</td></tr><tr class="t"><td>${esc(totalLabel)}</td><td class="r">${formatMoney(sums.totalCents)}</td></tr></table>
${notes ? `<p class="m">${esc(notes)}</p>` : ""}</article></body></html>`;
}

function estimateHtml(company: Company, job: Job, e: Estimate) {
  return documentHtml(
    `Estimate #${job.number} v${e.version}`,
    company,
    [
      ["Issued", formatDateTime(e.issuedAt)],
      ["Prepared for", e.customer.name],
      ["Contact", [e.customer.mobile, e.customer.email].filter(Boolean).join(" · ")],
      ["Vehicle", vehicleLine(e.vehicle)],
      ["Pickup", e.pickup],
      ["Destination", e.destination],
      ["Storage", `${formatMoney(e.storagePerDayCents)} per day if stored`],
    ],
    e.items,
    e,
    "Estimated total",
    e.notes,
  );
}

function invoiceHtml(company: Company, job: Job, i: Invoice) {
  return documentHtml(
    `Invoice ${i.number}`,
    company,
    [
      ["Issued", formatDateTime(i.issuedAt)],
      ["Job", `#${job.number}`],
      ["Customer", i.customer.name || "—"],
      ["Contact", [i.customer.mobile, i.customer.email].filter(Boolean).join(" · ") || "—"],
      ["Vehicle", vehicleLine(i.vehicle)],
      ["Pickup", i.pickup],
      ["Delivered to", i.destination],
      ...TOW_EVENTS.map((e): [string, string] => [TOW_EVENT_LABELS[e], formatDateTime(i.tow[e])]),
    ],
    i.items,
    i,
    "Total",
    i.notes,
  );
}

export function buildJobPackage(company: Company, job: Job, exportedAt = new Date().toISOString()): PackageFile[] {
  const base = `job-${job.number}`;
  const files: PackageFile[] = [];
  const record = jobRecord(job);

  for (const e of job.estimates) {
    files.push({ path: `${base}/estimate-v${e.version}.html`, label: `Estimate #${job.number} v${e.version}${e.supersededAt ? " (superseded)" : ""}`, data: estimateHtml(company, job, e) });
  }

  job.consents.forEach((c, n) => {
    const text = [
      `${c.heading}`,
      "",
      c.wording,
      "",
      `Name: ${c.name}`,
      `Relationship: ${c.relationship}`,
      `Customer present: ${c.present ? "Yes" : "No"}`,
      `Method: ${CONSENT_METHOD_LABELS[c.method]}`,
      `Captured: ${formatDateTime(c.at)} (America/Edmonton)`,
      `Estimate: #${job.number} v${c.estimateVersion} · ${formatMoney(c.amountCents)}`,
      `Consent template version: ${c.templateVersion}`,
      `Recorded by: ${c.recordedBy}`,
    ].join("\r\n");
    files.push({ path: `${base}/consent/consent-${n + 1}.txt`, label: `Consent record ${n + 1} — ${CONSENT_METHOD_LABELS[c.method]}`, data: text });
    if (c.evidence) {
      const { bytes, ext } = dataUrlToBytes(c.evidence);
      files.push({ path: `${base}/consent/consent-${n + 1}-evidence.${ext}`, label: `Consent evidence ${n + 1} (${c.method.replace("_", " ")})`, data: bytes });
    }
  });

  for (const i of job.invoices) {
    files.push({ path: `${base}/invoice-${i.number}.html`, label: `Invoice ${i.number}${i.supersededAt ? " (corrected)" : ""}`, data: invoiceHtml(company, job, i) });
  }

  const deliveries = [
    ...job.estimates.flatMap((e) => e.deliveries.map((d) => [`Estimate v${e.version}`, DELIVERY_LABELS[d.via], d.to ?? "", formatDateTime(d.at), d.by])),
    ...job.invoices.flatMap((i) => i.deliveries.map((d) => [`Invoice ${i.number}`, DELIVERY_LABELS[d.via], d.to ?? "", formatDateTime(d.at), d.by])),
  ];
  files.push({ path: `${base}/customer-delivery-record.csv`, label: "Customer delivery record", data: csv([["Document", "Method", "To", "When", "By"], ...deliveries]) });

  job.photos.forEach((p, n) => {
    const { bytes, ext } = dataUrlToBytes(p.dataUrl);
    files.push({ path: `${base}/photos/photo-${n + 1}.${ext}`, label: `Photo — ${p.caption}`, data: bytes });
  });

  files.push({
    path: `${base}/activity-log.csv`,
    label: `Activity log (${job.audit.length} entries)`,
    data: csv([["When (America/Edmonton)", "UTC", "Event", "By", "Role", "Device"], ...job.audit.map((a) => [formatDateTime(a.at), a.at, a.action, a.by, ROLE_LABELS[a.role], a.device])]),
  });

  const summary = [
    `${company.name} — job record #${job.number}`,
    `Exported ${formatDateTime(exportedAt)} with TowLedger`,
    "",
    `Workflow: ${job.workflow ? `${job.workflow.letter} — ${job.workflow.name}` : "not recorded"}`,
    `Vehicle: ${vehicleLine(job.vehicle)}`,
    `Pickup: ${job.pickup}`,
    `Destination: ${job.destination}`,
    `Record: ${record.complete ? "complete" : `needs attention — ${record.problems.join(", ")}`}`,
    `Retain until: ${record.retainUntil.slice(0, 10)}`,
    "",
    "Contents:",
    ...files.map((f) => `- ${f.path.replace(`${base}/`, "")}: ${f.label}`),
  ].join("\r\n");
  files.unshift({ path: `${base}/README.txt`, label: "Summary and contents", data: summary });
  files.push({ path: `${base}/job-record.json`, label: "Structured job data (JSON)", data: JSON.stringify({ exportedAt, company, job }, null, 2) });
  return files;
}
