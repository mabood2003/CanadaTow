"use client";

import Link from "next/link";

import { Icon } from "@/components/icons";
import { InstallApp } from "@/components/install-app";
import { Button, Card, CompanyMark, DataList, Loading, PageShell, ScreenHeader, SectionTitle } from "@/components/ui";
import { CONSENT_METHOD_SHORT, CONSENT_METHODS } from "@/lib/domain";
import { initials } from "@/lib/describe";
import { DRIVER_APP } from "@/lib/app-identity";
import { activeConsentTemplate, currentUser, signOut, useAppState } from "@/lib/store";
import { formatPlainDate } from "@/lib/time";

export default function DriverAccountPage() {
  const app = useAppState();
  if (!app) return <Loading />;
  const user = currentUser(app, "driver")!;
  const tel = app.company.phone.replace(/[^\d+]/g, "");
  const template = activeConsentTemplate(app);
  const yard = app.yards[0];

  return (
    <PageShell>
      <ScreenHeader kicker="Account" title={user.name} subtitle={user.email} right={<span className="grid h-12 w-12 place-items-center rounded-full bg-mint font-mono text-sm font-bold text-forest">{initials(user.name)}</span>} />

      <div className="space-y-4">
        <Card>
          <div className="flex items-center gap-3">
            <CompanyMark company={app.company} />
            <div className="min-w-0">
              <p className="truncate font-bold">{app.company.name}</p>
              <p className="text-xs text-muted">{app.company.address}</p>
            </div>
          </div>
          <a href={`tel:${tel}`} className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-md border border-line bg-white font-semibold text-forest">
            <Icon name="smartphone" className="h-4 w-4" /> Call the office · {app.company.phone}
          </a>
          {yard ? (
            <DataList
              className="mt-4"
              rows={[
                ["Yard", `${yard.name} — ${yard.address}`],
                ["Yard hours", yard.hours],
              ]}
            />
          ) : null}
        </Card>

        <Card>
          <SectionTitle>Your company&apos;s process</SectionTitle>
          <p className="text-sm text-muted">Set by the owner. The app follows it on every job.</p>
          <ul className="mt-3 space-y-2 text-sm">
            {app.workflows.map((w) => (
              <li key={w.id} className="flex items-start gap-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-forest text-xs font-bold text-signal">{w.letter}</span>
                <span>
                  <span className="font-semibold">{w.name}</span>
                  <span className="block text-xs text-muted">{w.description}</span>
                </span>
              </li>
            ))}
          </ul>
          <DataList
            className="mt-4"
            rows={[
              ["Consent template", `Version ${template.version} · effective ${formatPlainDate(template.effectiveDate)}`],
              ["Consent methods", CONSENT_METHODS.filter((m) => app.consentMethods[m]).map((m) => CONSENT_METHOD_SHORT[m]).join(" · ")],
            ]}
          />
        </Card>

        <Card>
          <SectionTitle>Install the app</SectionTitle>
          <InstallApp appName={DRIVER_APP.name} />
        </Card>

        <Button full variant="secondary" icon="logOut" onClick={() => signOut("driver")}>
          Sign out
        </Button>
        <p className="text-center text-sm">
          <Link href="/owner" className="font-semibold text-pine">
            Owner? Open TowLedger Owner
          </Link>
        </p>
      </div>
    </PageShell>
  );
}
