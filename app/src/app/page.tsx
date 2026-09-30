"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { buildEstimate, canStartTow, getTowGateMessage } from "@/lib/tow-rules";
import {
  companyProfile,
  demoScenarios,
  estimateRows,
  invoiceRows,
  officeJobs,
  recentJobs,
  requestTypes,
} from "@/lib/prototype-data";

type ScreenKey =
  | "home"
  | "setup"
  | "requester"
  | "workflow"
  | "consent"
  | "vehicle"
  | "estimate-builder"
  | "estimate-review"
  | "customer-estimate"
  | "consent-method"
  | "ready"
  | "tow-progress"
  | "invoice-builder"
  | "customer-invoice"
  | "compliance"
  | "problem"
  | "office"
  | "offline";

const screenOrder: ScreenKey[] = [
  "home",
  "setup",
  "requester",
  "workflow",
  "consent",
  "vehicle",
  "estimate-builder",
  "estimate-review",
  "customer-estimate",
  "consent-method",
  "ready",
  "tow-progress",
  "invoice-builder",
  "customer-invoice",
  "compliance",
  "problem",
  "office",
  "offline",
];

const consentMethods = [
  { value: "link", label: "Link" },
  { value: "signature", label: "Signature on driver device" },
  { value: "audio", label: "Audio consent" },
  { value: "paper_photo", label: "Paper form photo" },
] as const satisfies ReadonlyArray<{ value: "link" | "signature" | "audio" | "paper_photo"; label: string }>;

function sumLineItems(items: { quantity: number; amountCents: number }[]) {
  return items.reduce((sum, item) => sum + item.quantity * item.amountCents, 0);
}

export default function Home() {
  const [screen, setScreen] = useState<ScreenKey>("home");
  const [companyInfo, setCompanyInfo] = useState(companyProfile);
  const [selectedRequestType, setSelectedRequestType] = useState("owner_customer");
  const [estimateState, setEstimateState] = useState(estimateRows);
  const [invoiceState, setInvoiceState] = useState(invoiceRows);
  const [consentName, setConsentName] = useState("Jamie Clarke");
  const [relationship, setRelationship] = useState("Owner");
  const [selectedMethod, setSelectedMethod] = useState<"link" | "signature" | "audio" | "paper_photo">("signature");
  const [estimateSent, setEstimateSent] = useState(true);
  const [consentCaptured, setConsentCaptured] = useState(true);
  const [destinationConfirmed, setDestinationConfirmed] = useState(true);
  const [searchValue, setSearchValue] = useState("");
  const [yardAddress, setYardAddress] = useState(companyProfile.yard);
  const [invitedDrivers, setInvitedDrivers] = useState(["Ava Thompson", "Mateo Ruiz"]);

  const selectedWorkflow = requestTypes.find((type) => type.id === selectedRequestType)?.workflow ?? "consumer";

  const estimateSummary = useMemo(() => buildEstimate(sumLineItems(estimateState)), [estimateState]);
  const invoiceSummary = useMemo(() => buildEstimate(sumLineItems(invoiceState)), [invoiceState]);
  const towReady = canStartTow({
    workflow: selectedWorkflow,
    estimateSent,
    consentCaptured,
    destinationConfirmed,
  });

  const filteredJobs = officeJobs.filter((job) =>
    `${job.vehicle} ${job.customer} ${job.driver}`.toLowerCase().includes(searchValue.toLowerCase()),
  );

  const updateEstimateRow = (rowId: string, delta: number) => {
    setEstimateState((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, quantity: Math.max(0, row.quantity + delta) } : row,
      ),
    );
  };

  const updateInvoiceRow = (rowId: string, delta: number) => {
    setInvoiceState((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, quantity: Math.max(0, row.quantity + delta) } : row,
      ),
    );
  };

  const renderScreen = () => {
    switch (screen) {
      case "setup":
        return (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Company setup</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">Milestone 1</span>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Company profile</label>
                <div className="space-y-3">
                  <input
                    value={companyInfo.name}
                    onChange={(e) => setCompanyInfo((current) => ({ ...current, name: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                    placeholder="Business name"
                  />
                  <input
                    value={companyInfo.phone}
                    onChange={(e) => setCompanyInfo((current) => ({ ...current, phone: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                    placeholder="Phone"
                  />
                  <textarea
                    value={companyInfo.address}
                    onChange={(e) => setCompanyInfo((current) => ({ ...current, address: e.target.value }))}
                    className="min-h-20 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                    placeholder="Business address"
                  />
                  <input
                    value={companyInfo.gstNumber}
                    onChange={(e) => setCompanyInfo((current) => ({ ...current, gstNumber: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                    placeholder="GST number"
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Primary yard</label>
                <input
                  value={yardAddress}
                  onChange={(e) => setYardAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                  placeholder="Yard address"
                />
              </div>

              <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Invited drivers</label>
                <div className="space-y-2">
                  {invitedDrivers.map((driver) => (
                    <div key={driver} className="flex items-center justify-between rounded-xl bg-white p-2 text-sm ring-1 ring-slate-200">
                      <span>{driver}</span>
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Invited</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
                Demo company is ready for Alberta consumer tow workflows, with one full rate card and one active yard configured.
              </div>

              <button
                onClick={() => setScreen("home")}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
              >
                Save and return home
              </button>
            </div>
          </section>
        );
      case "requester":
        return (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Who requested this tow?</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">Step 2</span>
            </div>
            <div className="grid gap-3">
              {requestTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedRequestType(type.id)}
                  className={`rounded-2xl border p-4 text-left ${
                    selectedRequestType === type.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{type.label}</span>
                    <span className="text-xs uppercase tracking-[0.2em] opacity-75">{type.workflow}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <label className="mb-2 block text-sm font-medium text-slate-700">Who contacted/invited your company?</label>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-slate-400"
                placeholder="Customer, police, motor club, insurance"
              />
            </div>
          </section>
        );
      case "workflow":
        return (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Workflow</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">Step 3</span>
            </div>
            <div className="rounded-2xl bg-slate-900 p-4 text-white">
              {selectedWorkflow === "exempt" ? (
                <p className="text-base font-medium">Different/exempt workflow — reason recorded.</p>
              ) : (
                <p className="text-base font-medium">Consumer workflow: Estimate → Consent → Tow → Invoice → Record</p>
              )}
            </div>
            <div className="mt-4 grid gap-3 text-sm text-slate-700">
              {selectedWorkflow === "exempt" ? (
                <>
                  <div className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">Reason recorded for government or police-directed tow.</div>
                  <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">No consumer estimate required unless guided by office policy.</div>
                </>
              ) : (
                <>
                  <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">Estimate must be sent before tow start.</div>
                  <div className="rounded-xl bg-blue-50 p-3 ring-1 ring-blue-200">Consent must be captured before vehicle is secured.</div>
                  <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">Invoice must be issued before recording payment.</div>
                </>
              )}
            </div>
          </section>
        );
      case "consent":
        return (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Consenting person</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">Step 4</span>
            </div>
            <div className="space-y-3">
              <input value={consentName} onChange={(e) => setConsentName(e.target.value)} className="w-full rounded-xl border border-slate-200 p-3" placeholder="Full name" />
              <input className="w-full rounded-xl border border-slate-200 p-3" placeholder="Mobile number" defaultValue="(403) 555-0192" />
              <input className="w-full rounded-xl border border-slate-200 p-3" placeholder="Email (optional)" defaultValue="jamie@example.com" />
              <select value={relationship} onChange={(e) => setRelationship(e.target.value)} className="w-full rounded-xl border border-slate-200 p-3">
                <option>Owner</option>
                <option>Driver</option>
                <option>Family member</option>
                <option>Insurance rep</option>
                <option>Motor-club rep</option>
                <option>Other</option>
              </select>
              <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
                <input type="checkbox" defaultChecked className="h-4 w-4" />
                Customer is physically present
              </label>
            </div>
          </section>
        );
      case "vehicle":
        return (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Vehicle and tow details</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">Step 5</span>
            </div>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <input className="rounded-xl border border-slate-200 p-3" placeholder="Plate" defaultValue="ABC 123" />
                <input className="rounded-xl border border-slate-200 p-3" placeholder="Province" defaultValue="AB" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className="rounded-xl border border-slate-200 p-3" placeholder="Make" defaultValue="Toyota" />
                <input className="rounded-xl border border-slate-200 p-3" placeholder="Model" defaultValue="Corolla" />
              </div>
              <input className="rounded-xl border border-slate-200 p-3" placeholder="Colour" defaultValue="White" />
              <input className="rounded-xl border border-slate-200 p-3" placeholder="Pickup location" defaultValue="17 Ave SW, Calgary" />
              <input className="rounded-xl border border-slate-200 p-3" placeholder="Requested destination" defaultValue="Downtown Yard" />
              <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
                <input type="checkbox" checked={destinationConfirmed} onChange={() => setDestinationConfirmed((value) => !value)} className="h-4 w-4" />
                Destination confirmed by customer
              </label>
            </div>
          </section>
        );
      case "estimate-builder":
        return (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Estimate builder</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">Step 6</span>
            </div>
            <div className="space-y-3">
              {estimateState.map((row) => (
                <div key={row.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div>
                    <p className="font-medium text-slate-900">{row.label}</p>
                    <p className="text-xs text-slate-500">${(row.amountCents / 100).toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateEstimateRow(row.id, -1)} className="h-8 w-8 rounded-full bg-slate-200 text-lg leading-none">−</button>
                    <span className="w-6 text-center font-medium">{row.quantity}</span>
                    <button onClick={() => updateEstimateRow(row.id, 1)} className="h-8 w-8 rounded-full bg-slate-900 text-lg leading-none text-white">+</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-slate-900 p-4 text-white">
              <div className="flex items-center justify-between text-sm text-slate-200"><span>Subtotal</span><span>${(sumLineItems(estimateState) / 100).toFixed(2)}</span></div>
              <div className="mt-2 flex items-center justify-between text-sm text-slate-200"><span>GST 5%</span><span>${(estimateSummary.gstCents / 100).toFixed(2)}</span></div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-700 pt-2 text-base font-semibold"><span>Total</span><span>${(estimateSummary.totalCents / 100).toFixed(2)}</span></div>
            </div>
          </section>
        );
      case "estimate-review":
        return (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Estimate review</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">Step 7</span>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="space-y-2 text-sm text-slate-700">
                {estimateState.map((row) => (
                  <div key={row.id} className="flex justify-between"><span>{row.label}</span><span>${((row.quantity * row.amountCents) / 100).toFixed(2)}</span></div>
                ))}
              </div>
              <div className="mt-3 border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
                <div className="flex justify-between"><span>Total</span><span>${(estimateSummary.totalCents / 100).toFixed(2)}</span></div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button className="rounded-xl bg-slate-900 px-3 py-3 text-sm font-semibold text-white">Text</button>
              <button className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-700">Email</button>
              <button className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-700">Show on device</button>
              <button className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-700">Print</button>
            </div>
          </section>
        );
      case "customer-estimate":
        return (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Customer estimate page</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">Step 8</span>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <p className="text-sm text-slate-600">Public link</p>
              <Link href="/e/demo-estimate" target="_blank" className="mt-2 block text-base font-semibold text-slate-900 underline">/e/demo-estimate</Link>
              <p className="mt-3 text-sm text-slate-700">Company, items, total, destination, storage rate, plain-language rights note, and consent CTA are included.</p>
            </div>
          </section>
        );
      case "consent-method":
        return (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Consent method</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">Step 9</span>
            </div>
            <div className="grid gap-3">
              {consentMethods.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setSelectedMethod(value)}
                  className={`rounded-2xl border p-3 text-left ${selectedMethod === value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-700"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 text-sm text-slate-700">
              <p className="font-medium">Consent captured</p>
              <p className="mt-1">{consentName} · {relationship} · {selectedMethod}</p>
            </div>
          </section>
        );
      case "ready":
        return (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Ready to tow</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">Step 10</span>
            </div>
            <div className="space-y-3">
              {[
                { value: estimateSent, label: "Estimate sent" },
                { value: consentCaptured, label: "Consent captured" },
                { value: destinationConfirmed, label: "Destination confirmed" },
              ].map(({ value, label }) => (
                <div key={label} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${value ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    {value ? "✓" : "Missing"}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
              {towReady ? "Tow may begin." : "Do not begin tow — consent missing."}
            </div>
          </section>
        );
      case "tow-progress":
        return (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Tow in progress</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">Step 11</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {['Arrived', 'Vehicle secured', 'Departed', 'Delivered'].map((label) => (
                <button key={label} className="rounded-xl bg-slate-900 px-3 py-3 text-sm font-semibold text-white">{label}</button>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
              <p className="font-semibold">Destination changed</p>
              <p className="mt-1">Who authorized it? Why? Notice to the owner is recorded automatically.</p>
            </div>
          </section>
        );
      case "invoice-builder":
        return (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Invoice builder</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">Step 12</span>
            </div>
            <div className="space-y-3">
              {invoiceState.map((row) => (
                <div key={row.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div>
                    <p className="font-medium text-slate-900">{row.label}</p>
                    <p className="text-xs text-slate-500">${(row.amountCents / 100).toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateInvoiceRow(row.id, -1)} className="h-8 w-8 rounded-full bg-slate-200 text-lg leading-none">−</button>
                    <span className="w-6 text-center font-medium">{row.quantity}</span>
                    <button onClick={() => updateInvoiceRow(row.id, 1)} className="h-8 w-8 rounded-full bg-slate-900 text-lg leading-none text-white">+</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
              Final amount differs from estimate — confirm customer authorization.
            </div>
            <div className="mt-4 rounded-2xl bg-slate-900 p-4 text-white">
              <div className="flex items-center justify-between text-sm text-slate-200"><span>Subtotal</span><span>${(sumLineItems(invoiceState) / 100).toFixed(2)}</span></div>
              <div className="mt-2 flex items-center justify-between text-sm text-slate-200"><span>GST 5%</span><span>${(invoiceSummary.gstCents / 100).toFixed(2)}</span></div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-700 pt-2 text-base font-semibold"><span>Total</span><span>${(invoiceSummary.totalCents / 100).toFixed(2)}</span></div>
            </div>
          </section>
        );
      case "customer-invoice":
        return (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Customer invoice page</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">Step 13</span>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <Link href="/i/demo-invoice" target="_blank" className="block text-base font-semibold text-slate-900 underline">/i/demo-invoice</Link>
              <p className="mt-3 text-sm text-slate-700">Invoice number, line items, total, and PDF download are shown to the customer. No payment collection is included.</p>
            </div>
          </section>
        );
      case "compliance":
        return (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Compliance file</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">Step 14</span>
            </div>
            <div className="space-y-3 text-sm text-slate-700">
              {['Estimate', 'Copy delivered', 'Consent', 'Invoice', 'Vehicle details', 'Locations/times', 'Archived'].map((item) => (
                <div key={item} className="flex items-center justify-between rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
                  <span>{item}</span>
                  <span className="font-semibold text-emerald-700">✓</span>
                </div>
              ))}
            </div>
          </section>
        );
      case "problem":
        return (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Problem state</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">Step 15</span>
            </div>
            <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-900 ring-1 ring-red-200">
              <p className="font-semibold">Compliance incomplete: invoice not issued.</p>
              <p className="mt-1">Consent evidence missing.</p>
            </div>
            <button className="mt-4 w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white">Fix it</button>
          </section>
        );
      case "office":
        return (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Office jobs list</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">Step 16</span>
            </div>
            <input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="mb-4 w-full rounded-xl border border-slate-200 p-3 text-sm"
              placeholder="Search plate or customer name"
            />
            <div className="space-y-3">
              {filteredJobs.map((job) => (
                <button key={job.id} className="w-full rounded-2xl bg-slate-50 p-3 text-left ring-1 ring-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{job.id}</span>
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">{job.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{job.vehicle} · {job.driver}</p>
                  <div className="mt-2 flex justify-between text-xs text-slate-500"><span>{job.requestType}</span><span>{job.estimate}</span></div>
                </button>
              ))}
            </div>
          </section>
        );
      case "offline":
        return (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Offline status</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">Step 17</span>
            </div>
            <div className="rounded-2xl bg-slate-900 p-4 text-white">
              <p className="text-sm font-semibold">Offline — job saved on this device and will sync when connection returns.</p>
            </div>
            <p className="mt-4 text-sm text-slate-700">Customer cannot receive text/email; show on driver device, print, or paper photo instead.</p>
          </section>
        );
      default:
        return (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <header className="mb-5 flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-lg">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-300">TowLedger</p>
                <h1 className="text-xl font-semibold">{companyInfo.name}</h1>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-900">{companyInfo.logo}</div>
            </header>

            <div className="mb-5 flex gap-2">
              <button
                onClick={() => setScreen("setup")}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Company setup
              </button>
              <button
                onClick={() => setScreen("requester")}
                className="flex-1 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
              >
                New Tow
              </button>
            </div>

            <div className="mb-5 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-700">Tow gate</p>
                  <p className="mt-1 text-sm font-medium text-emerald-950">{getTowGateMessage({ workflow: selectedWorkflow, estimateSent, consentCaptured, destinationConfirmed })}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${towReady ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>{towReady ? 'Ready' : 'Blocked'}</span>
              </div>
            </div>

            <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Driver</p>
                  <h2 className="text-lg font-semibold">{companyInfo.driver}</h2>
                </div>
                <button onClick={() => setScreen("requester")} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white">New Tow</button>
              </div>
            </div>

            <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Milestone 1–7 prototype</h3>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-700">Demo</span>
              </div>
              <ul className="space-y-2 text-sm text-slate-700">
                {demoScenarios.map((scenario) => (
                  <li key={scenario.name} className="flex items-center justify-between rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200">
                    <span>{scenario.name}</span>
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{scenario.workflow}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Recent jobs</h3>
                <span className="text-xs text-slate-500">3 shown</span>
              </div>
              <div className="space-y-3">
                {recentJobs.map((job) => (
                  <div key={job.id} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{job.id}</span>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${job.status === 'Complete' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{job.status}</span>
                    </div>
                    <p className="text-sm text-slate-700">{job.vehicle} · {job.customer}</p>
                    <div className="mt-2 flex justify-between text-xs text-slate-500"><span>Invoice: {job.invoice}</span><span>Consent: {job.consent}</span></div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Offline — job saved on this device and will sync when connection returns.
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {screenOrder.map((item) => (
            <button
              key={item}
              onClick={() => setScreen(item)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                screen === item ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {renderScreen()}
      </div>
    </main>
  );
}
