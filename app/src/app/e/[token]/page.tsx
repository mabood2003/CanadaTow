import { companyProfile } from "@/lib/prototype-data";

export default function EstimateCustomerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const token = "demo-estimate";

  return (
    <main className="min-h-screen bg-slate-100 p-4">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-5 shadow-lg ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">TowLedger</p>
            <h1 className="text-2xl font-semibold">{companyProfile.name}</h1>
          </div>
          <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
            Estimate #{token}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-600">Vehicle</p>
            <p className="text-lg font-semibold text-slate-900">ABC 123 · 2021 Toyota Corolla</p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-medium text-slate-700">Estimated charges</span>
              <span className="text-sm text-slate-500">GST included</span>
            </div>

            <div className="space-y-2 text-sm text-slate-700">
              <div className="flex justify-between"><span>Hook-up</span><span>$175.00</span></div>
              <div className="flex justify-between"><span>18 km × $3.50</span><span>$63.00</span></div>
              <div className="flex justify-between"><span>Winching</span><span>$90.00</span></div>
              <div className="flex justify-between"><span>After-hours callout</span><span>$70.00</span></div>
              <div className="flex justify-between"><span>Storage (2 days)</span><span>$70.00</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900"><span>Total</span><span>$468.00</span></div>
            </div>
          </div>

          <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
            <p className="font-semibold">Customer rights</p>
            <p className="mt-1">You may ask questions about the estimate, review the tow and storage charges, and choose whether to consent before the tow proceeds.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">I consent</button>
            <button className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700">I have a question</button>
          </div>
        </div>
      </div>
    </main>
  );
}
