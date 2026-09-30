"use client";

import { AdminLog } from "@/components/admin-console";
import { Card, Loading, PageShell, ScreenHeader } from "@/components/ui";
import { usePlatform } from "@/lib/store";

/** Append-only record of what the TowLedger team did: sign-ins, onboarding, status changes, and every company view. */
export default function AdminActivityPage() {
  const platform = usePlatform();
  if (!platform) return <Loading />;
  const names = new Map(platform.companies.map((c) => [c.id, c.data.company.name]));
  return (
    <PageShell width="wide">
      <ScreenHeader
        kicker="TowLedger admin"
        title="Admin activity"
        subtitle="Every sign-in, onboarding, status change and look inside a company's records by the TowLedger team. Entries can't be edited or deleted."
      />
      <Card>
        <AdminLog entries={platform.adminAudit} companyName={(id) => names.get(id)} />
      </Card>
    </PageShell>
  );
}
