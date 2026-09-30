"use client";

import { Icon } from "@/components/icons";
import { JobScreen, type JobContext } from "@/components/job-screen";
import { AuditTable, AuditTrail } from "@/components/records";
import { Chip, PageShell, ScreenHeader } from "@/components/ui";
import { vehicleLine } from "@/lib/describe";
import { jobHref } from "@/lib/job-steps";
import { formatDate } from "@/lib/time";
import { jobStatus } from "@/lib/tow-rules";

export default function AuditPage() {
  return <JobScreen>{(ctx) => <Audit {...ctx} />}</JobScreen>;
}

function Audit({ job }: JobContext) {
  const status = jobStatus(job);
  const counts = job.audit.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.role]: (acc[a.role] ?? 0) + 1 }), {});
  return (
    <PageShell width="wide">
      <ScreenHeader
        back={{ href: jobHref(job), label: `Job #${job.number}` }}
        kicker="Audit trail"
        title={`Activity history · Job #${job.number}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {vehicleLine(job.vehicle) || "Vehicle not recorded"} · started {formatDate(job.createdAt)} <Chip tone={status.tone}>{status.label}</Chip>
          </span>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-line bg-paper px-4 py-3 text-sm">
        <span className="flex items-center gap-2 font-semibold">
          <Icon name="lock" className="h-4 w-4 text-pine" /> Append-only: entries can&apos;t be edited or deleted
        </span>
        <span className="text-muted">
          {job.audit.length} entries · {counts.driver ?? 0} driver · {counts.owner ?? 0} office · {counts.customer ?? 0} customer · {counts.system ?? 0} system
        </span>
        <span className="text-muted">Times shown in Alberta time (America/Edmonton)</span>
      </div>

      <div className="hidden md:block">
        <AuditTable entries={job.audit} />
      </div>
      <div className="md:hidden">
        <AuditTrail entries={job.audit} />
      </div>
    </PageShell>
  );
}
