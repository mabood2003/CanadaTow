import Link from "next/link";

import { Icon, type IconName } from "@/components/icons";
import { BrandMark } from "@/components/ui";
import { DRIVER_APP, OWNER_APP } from "@/lib/app-identity";

// Front door: TowLedger is two apps. Drivers install TowLedger Driver; owners install TowLedger Owner.
const APPS: { href: string; name: string; who: string; detail: string; icon: IconName; dark: boolean }[] = [
  {
    href: DRIVER_APP.base,
    name: DRIVER_APP.name,
    who: "For drivers · phone",
    detail: "Start a tow, give the customer the estimate, capture consent, record tow times and issue the invoice at the roadside.",
    icon: "truck",
    dark: true,
  },
  {
    href: OWNER_APP.base,
    name: OWNER_APP.name,
    who: "For owners · phone and laptop",
    detail: "See every job and what needs attention, who's on the road, unpaid invoices, your team, and your company's rates, workflows and consent wording.",
    icon: "dashboard",
    dark: false,
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-10 sm:px-6">
      <p className="flex items-center gap-2.5 text-[20px] font-extrabold tracking-[-0.03em]">
        <BrandMark /> TowLedger
      </p>
      <h1 className="mt-10 text-[38px] font-extrabold leading-[1.02] tracking-[-0.05em] sm:text-[52px]">Which app are you opening?</h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">Built for Alberta&apos;s towing rules. Install the one you use — each gets its own icon on your home screen.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {APPS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={`group flex flex-col rounded-xl p-6 transition hover:-translate-y-0.5 ${a.dark ? "bg-forest text-white shadow-[0_4px_0_#0e291c]" : "border-2 border-forest bg-signal text-forest shadow-[0_4px_0_#0e291c]"}`}
          >
            <span className={`grid h-12 w-12 place-items-center rounded-lg ${a.dark ? "bg-signal text-forest" : "bg-forest text-signal"}`}>
              <Icon name={a.icon} className="h-6 w-6" />
            </span>
            <span className={`mt-5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] ${a.dark ? "text-signal" : "text-pine"}`}>{a.who}</span>
            <span className="mt-1 text-2xl font-extrabold tracking-tight">{a.name}</span>
            <span className={`mt-2 text-sm leading-relaxed ${a.dark ? "text-[#c7d3cb]" : "text-forest/80"}`}>{a.detail}</span>
            <span className="mt-5 inline-flex items-center gap-1.5 font-semibold">
              Open <Icon name="arrowRight" className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-auto pt-12 text-sm text-muted">
        Demoing to an operator?{" "}
        <Link href="/demo" className="font-semibold text-pine">
          Interview mode
        </Link>
        <span className="mx-2 text-line">·</span>
        TowLedger team?{" "}
        <Link href="/admin" className="font-semibold text-pine">
          Admin console
        </Link>
      </p>
    </main>
  );
}
