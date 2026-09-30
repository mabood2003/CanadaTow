"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/icons";
import { Banner, Button, Card, Kicker, Loading, PageShell, SectionTitle, Toggle } from "@/components/ui";
import type { ScenarioId } from "@/lib/domain";
import { endSentence } from "@/lib/describe";
import { jobHref } from "@/lib/job-steps";
import { SCENARIOS } from "@/lib/scenarios";
import { attempt, resetDemoData, setAppState, startJob, useAppState } from "@/lib/store";

export default function DemoPage() {
  const app = useAppState();
  const router = useRouter();
  const [resetAt, setResetAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!app) return <Loading />;

  const owner = app.team.find((m) => m.role === "owner");
  const driver = app.team.find((m) => m.role === "driver" && !m.invited);
  const waiting = app.jobs.find((j) => j.number === "1042");

  const asOwner = () => {
    if (owner) setAppState((s) => ({ ...s, currentUserId: owner.id }));
    router.push("/admin");
  };

  const start = (id: ScenarioId) => {
    let jobId = "";
    const failure = attempt(() => {
      if (driver) setAppState((s) => ({ ...s, currentUserId: driver.id }));
      jobId = startJob(id);
    });
    if (failure) return setError(failure);
    router.push(`/jobs/${jobId}/request`);
  };

  return (
    <PageShell width="wide">
      <header className="relative overflow-hidden rounded-xl bg-forest p-6 text-white shadow-[0_4px_0_#0e291c] sm:p-8">
        <div aria-hidden className="stage-glow pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full" />
        <Kicker light>Interview mode</Kicker>
        <h1 className="mt-2 max-w-2xl text-[34px] font-extrabold leading-[1.02] tracking-[-0.05em] sm:text-[46px]">Walk an operator through {endSentence(app.company.name)}</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#c7d3cb]">
          {app.company.name} is a fictional company. Start as the owner to show that the operator controls the process, then run a scenario on your phone as driver {driver?.name ?? ""}.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="signal" icon="sliders" onClick={asOwner}>
            Start as the owner ({owner?.name})
          </Button>
          <Button
            variant="secondary"
            icon="reset"
            className="!border-white/20 !bg-white/10 !text-white hover:!bg-white/20"
            onClick={() => {
              resetDemoData();
              setResetAt(new Date().toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" }));
            }}
          >
            Reset demo
          </Button>
        </div>
        {resetAt ? <p className="mt-3 text-sm font-semibold text-signal">Demo data reset at {resetAt}.</p> : null}
      </header>

      {error ? (
        <div className="mt-4">
          <Banner tone="bad">{error}</Banner>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {SCENARIOS.map((s) => (
          <Card key={s.id} className="flex flex-col">
            <Kicker>{s.kicker}</Kicker>
            <h2 className="mt-2 text-xl font-extrabold leading-tight tracking-[-0.03em]">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{s.summary}</p>
            <ol className="mt-4 space-y-2 text-sm">
              {s.beats.map((b, i) => (
                <li key={b} className="flex gap-2.5">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-mint font-mono text-[10px] font-bold text-pine">{i + 1}</span>
                  <span>{b}</span>
                </li>
              ))}
            </ol>
            <div className="mt-4 rounded-md border-2 border-dashed border-pine/35 bg-signal/15 p-3 text-sm">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-pine">Ask the operator</p>
              <p className="mt-1 font-semibold leading-snug">{s.question}</p>
            </div>
            <div className="mt-auto pt-5">
              <Button full size="lg" icon="play" onClick={() => start(s.id)}>
                Start scenario
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <SectionTitle>Roadside problems to show</SectionTitle>
          <Toggle
            checked={app.simulateOffline}
            onChange={(on) => setAppState((s) => ({ ...s, simulateOffline: on }))}
            label="Simulate offline"
            detail="Shows the orange “Offline — job saved locally” banner and disables text/email."
          />
          <div className="border-t border-line-soft pt-3">
            <p className="text-sm font-semibold">Customer&apos;s phone is dead</p>
            <p className="mt-0.5 text-xs text-muted">On any estimate delivery screen, open “Customer&apos;s phone is dead?” to show the on-screen, paper-photo and print fallbacks.</p>
            {waiting ? (
              <Button size="sm" variant="secondary" className="mt-2" icon="battery" onClick={() => router.push(jobHref(waiting, "send"))}>
                Open job #{waiting.number} delivery
              </Button>
            ) : null}
          </div>
          <p className="mt-4 text-xs text-muted">Ask: is working offline essential for your drivers, or a nice-to-have?</p>
        </Card>
        <Card>
          <SectionTitle>Owner screens to show</SectionTitle>
          <ul className="space-y-2 text-sm">
            {[
              ["/admin/consent", "Consent template — version 3 and version history"],
              ["/admin/workflows", "Job category → workflow mapping (A–D)"],
              ["/office", "Office jobs list — which jobs need attention"],
              ...(app.jobs.find((j) => j.number === "1041") ? [[jobHref(app.jobs.find((j) => j.number === "1041")!), "Incomplete job #1041 — invoice missing"]] : []),
              ...(app.jobs.find((j) => j.number === "1040") ? [[jobHref(app.jobs.find((j) => j.number === "1040")!, "audit"), "Audit trail for completed job #1040"]] : []),
            ].map(([href, label]) => (
              <li key={href}>
                <button type="button" onClick={() => router.push(href)} className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left font-semibold hover:bg-mint">
                  {label}
                  <Icon name="arrowRight" className="h-4 w-4 text-pine" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </PageShell>
  );
}
