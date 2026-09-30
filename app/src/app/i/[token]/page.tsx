import { companyProfile } from "@/lib/prototype-data";

export default function InvoiceCustomerPage() {
  return (
    <main className="min-h-screen bg-slate-100 p-4">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-5 shadow-lg ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Invoice</p>
            <h1 className="text-2xl font-semibold">{companyProfile.name}</h1>
          </div>
          <div className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
            INV-2048
          </div>
        </div>

        <div className="space-y-4 text-sm text-slate-700">
          <div className="flex items-center justify-between"><span>Customer</span><span>Jamie Clarke</span></div>
          <div className="flex items-center justify-between"><span>Vehicle</span><span>ABC 123</span></div>
          <div className="flex items-center justify-between"><span>Pickup</span><span>17 Ave SW</span></div>
          <div className="flex items-center justify-between"><span>Destination</span><span>Downtown Ship</span></div>

          <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <div className="space-y-2">
              <div className="flex justify-between"><span>Hook-up</span><span>$175.00</span></div>
              <div className="flex justify-between"><span>22 km × $3.50</span><span>$77.00</span></div>
              <div className="flex justify-between"><span>Winching</span><span>$90.00</span></div>
              <div className="flex justify-between"><span>After-hours callout</span><span>$70.00</span></div>
              <div className="flex justify-between"><span>Storage (3 days)</span><span>$105.00</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900"><span>Total</span><span>$517.00</span></div>
            </div>
          </div>

          <button className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">Download PDF</button>
        </div>
      </div>
    </main>
  );
}
