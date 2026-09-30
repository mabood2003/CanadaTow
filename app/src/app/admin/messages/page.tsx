"use client";

import { MessageList } from "@/components/message-list";
import { Loading, PageShell, ScreenHeader } from "@/components/ui";
import { usePlatform } from "@/lib/store";

/** Every text and email across every company — for troubleshooting "the customer says they never got it". */
export default function AdminMessagesPage() {
  const platform = usePlatform();
  if (!platform) return <Loading />;
  const rows = platform.companies.flatMap((account) =>
    account.data.outbox.map((message) => ({
      message,
      context: <span className="rounded bg-sand px-1.5 py-0.5 text-xs font-semibold text-ink">{account.data.company.name}</span>,
      // Messages open inside the admin support view, not the company's own app.
      jobHref: message.jobId ? `/admin/companies/${account.id}` : undefined,
    })),
  );
  const scheduled = rows.filter((r) => r.message.status === "scheduled").length;

  return (
    <PageShell width="full">
      <ScreenHeader
        kicker="TowLedger admin"
        title="Message log"
        subtitle={`${rows.length} texts and emails across ${platform.companies.length} companies${scheduled ? ` · ${scheduled} scheduled` : ""}. Prototype: recorded, not actually sent — delivery status from Twilio / Resend appears here once they're connected.`}
      />
      <MessageList rows={rows} />
    </PageShell>
  );
}
