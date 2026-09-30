import {
  buildEstimate,
  canStartTow,
  getTowGateMessage,
} from "@/lib/tow-rules";
import { demoCompany, onboardingChecklist, recentJobs } from "@/lib/demo-data";

const estimate = buildEstimate(178500);

export default function Home() {
  const towReady = canStartTow({
    workflow: "consumer",
    estimateSent: true,
    consentCaptured: true,
    destinationConfirmed: true,
  });

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-md px-4 py-6">
        <header className="mb-5 flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-lg">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-300">TowLedger</p>
            <h1 className="text-xl font-semibold">{demoCompany.name}</h1>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-900">
            {demoCompany.logo}
          </div>
        </header>

        <section className="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Driver</p>
              <h2 className="text-lg font-semibold">{demoCompany.driver}</h2>
            </div>
            <button className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white">
              New Tow
            </button>
          </div>
        </section>

        <section className="mb-5 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Tow gate</p>
              <p className="mt-1 text-sm font-medium text-emerald-950">
                {getTowGateMessage({
                  workflow: "consumer",
                  estimateSent: true,
                  consentCaptured: true,
                  destinationConfirmed: true,
                })}
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                towReady ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
              }`}
            >
              {towReady ? "Ready" : "Blocked"}
            </span>
          </div>
        </section>

        <section className="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Setup checklist
            </h3>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
              Milestone 1
            </span>
          </div>

          <ul className="space-y-2">
            {onboardingChecklist.map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-slate-700">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Recent jobs
            </h3>
            <span className="text-xs font-medium text-slate-500">3 shown</span>
          </div>

          <div className="space-y-3">
            {recentJobs.map((job) => (
              <div key={job.id} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{job.id}</span>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                      job.status === "Complete"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {job.status}
                  </span>
                </div>
                <p className="text-sm text-slate-700">
                  {job.vehicle} · {job.customer}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Invoice: {job.invoice}</span>
                  <span>Consent: {job.consent}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-slate-950 p-4 text-white shadow-lg">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Rate card snapshot</p>
          <div className="mt-3 space-y-2 text-sm text-slate-200">
            <div className="flex justify-between">
              <span>Hook-up</span>
              <span>$175.00</span>
            </div>
            <div className="flex justify-between">
              <span>Storage</span>
              <span>$35.00 / day</span>
            </div>
            <div className="flex justify-between">
              <span>GST</span>
              <span>${(estimate.gstCents / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-700 pt-2 text-base font-semibold text-white">
              <span>Estimated total</span>
              <span>${(estimate.totalCents / 100).toFixed(2)}</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
