"use client";

import Link from "next/link";

import { MessageList } from "@/components/message-list";
import { Loading, PageShell, ScreenHeader } from "@/components/ui";
import { jobHref } from "@/lib/job-steps";
import { useAppState } from "@/lib/store";

export default function OwnerMessagesPage() {
  const app = useAppState();
  if (!app) return <Loading />;
  const jobs = new Map(app.jobs.map((j) => [j.id, j]));
  const rows = app.outbox.map((message) => {
    const job = message.jobId ? jobs.get(message.jobId) : undefined;
    return { message, jobHref: job ? jobHref(job) : undefined };
  });
  const sent = app.outbox.filter((m) => m.status === "sent").length;

  return (
    <PageShell width="full">
      <ScreenHeader
        kicker={`${app.company.name} · Messages`}
        title="Messages"
        subtitle={
          <>
            Every text and email sent to customers and drivers — {sent} sent. Automatic delivery notices are set in{" "}
            <Link href="/owner/settings/notifications" className="font-semibold text-pine underline">
              Customer notifications
            </Link>
            . Prototype: recorded, not actually sent.
          </>
        }
      />
      <MessageList rows={rows} />
    </PageShell>
  );
}
