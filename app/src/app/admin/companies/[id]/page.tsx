"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AdminLog, CompanyStatusChip } from "@/components/admin-console";
import { Icon } from "@/components/icons";
import { MessageList } from "@/components/message-list";
import { AuditTable } from "@/components/records";
import { Banner, Button, Card, Chip, CompanyMark, DataList, ErrorText, inputClass, Loading, PageShell, ScreenHeader, SectionTitle, Segmented } from "@/components/ui";
import { recordAdminView, resendOwnerInvite, saveCompanyNotes, setCompanyStatus } from "@/lib/admin-store";
import { vehicleName } from "@/lib/describe";
import { formatMoney } from "@/lib/money";
import { COMPANY_STATUS_LABELS, companyMetrics, type CompanyAccount, type CompanyStatus } from "@/lib/platform";
import { attempt, usePlatform } from "@/lib/store";
import { formatDate, formatPlainDate, formatWhen } from "@/lib/time";
import { currentConsentTemplate, jobStatus } from "@/lib/tow-rules";

type Tab = "overview" | "jobs" | "messages" | "setup" | "activity";

const TAB_LABELS: Record<Tab, string> = { overview: "Overview", jobs: "Jobs", messages: "Messages", setup: "Setup", activity: "Admin activity" };

export default function AdminCompanyPage() {
  const { id } = useParams<{ id: string }>();
  const platform = usePlatform();
  const [tab, setTab] = useState<Tab>("overview");

  // Opening a company's records is logged once per visit (switching tabs or jobs isn't a new entry).
  useEffect(() => {
    attempt(() => recordAdminView(id));
  }, [id]);

  if (!platform) return <Loading />;
  const account = platform.companies.find((c) => c.id === id);
  if (!account) {
    return (
      <PageShell>
        <ScreenHeader back={{ href: "/admin", label: "Companies" }} title="Company not found" />
      </PageShell>
    );
  }

  return (
    <PageShell width="full">
      <ScreenHeader
        back={{ href: "/admin", label: "Companies" }}
        kicker={`TowLedger admin · support view (read-only)`}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <CompanyMark company={account.data.company} />
            {account.data.company.name}
            <CompanyStatusChip status={account.status} />
          </span>
        }
        subtitle={`On TowLedger since ${formatDate(account.createdAt)} · onboarded by ${account.createdBy}`}
      />

      <div className="mb-5 overflow-x-auto">
        <Segmented label="Section" value={tab} onChange={setTab} options={(Object.keys(TAB_LABELS) as Tab[]).map((t) => ({ value: t, label: TAB_LABELS[t] }))} />
      </div>

      {tab === "overview" ? <Overview account={account} /> : null}
      {tab === "jobs" ? <Jobs account={account} /> : null}
      {tab === "messages" ? (
        <MessageList rows={account.data.outbox.map((message) => ({ message }))} empty="This company hasn't sent any messages yet." />
      ) : null}
      {tab === "setup" ? <Setup account={account} /> : null}
      {tab === "activity" ? (
        <Card>
          <SectionTitle>What the TowLedger team did here</SectionTitle>
          <AdminLog entries={platform.adminAudit.filter((a) => a.companyId === account.id)} />
        </Card>
      ) : null}
    </PageShell>
  );
}

function Overview({ account }: { account: CompanyAccount }) {
  const [now] = useState(() => Date.now());
  const m = companyMetrics(account, now);
  const [status, setStatus] = useState<CompanyStatus>(account.status);
  const [notes, setNotes] = useState(account.notes);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const owner = account.data.team.find((t) => t.role === "owner");
  const run = (action: () => void, done: string) => {
    const failure = attempt(action);
    setError(failure);
    setMessage(failure ? null : done);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Jobs · 7 days", String(m.jobsThisWeek)],
            ["Needs attention", String(m.needsAttention)],
            ["On the road", String(m.live)],
            ["Unpaid", formatMoney(m.unpaidCents)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-line bg-paper p-4">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        <Card>
          <SectionTitle>Team</SectionTitle>
          <ul className="divide-y divide-line-soft">
            {account.data.team.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>
                  <span className="font-semibold">{t.name}</span> <span className="text-muted">· {t.role === "owner" ? "Owner" : "Driver"} · {t.email}</span>
                </span>
                {t.invited ? <Chip tone="warn">Invite not accepted</Chip> : <Chip tone="good">Active</Chip>}
              </li>
            ))}
          </ul>
          {owner?.invited ? (
            <Button className="mt-3" size="sm" variant="secondary" icon="mail" onClick={() => run(() => resendOwnerInvite(account.id), `Invite re-sent to ${owner.email} (prototype — recorded in Messages).`)}>
              Resend owner invite
            </Button>
          ) : null}
        </Card>

        <Card>
          <SectionTitle>Company details</SectionTitle>
          <DataList
            rows={[
              ["Address", account.data.company.address],
              ["Phone", account.data.company.phone],
              ["Email", account.data.company.email || "—"],
              ["GST number", account.data.company.gstNumber || "—"],
              ["Yard", account.data.yards.map((y) => `${y.name} — ${y.address}`).join("; ") || "—"],
              ["Last active", m.lastActiveAt ? formatWhen(m.lastActiveAt) : "Never"],
            ]}
          />
        </Card>
      </div>

      <aside className="space-y-5 lg:self-start">
        <Card>
          <SectionTitle>Account status</SectionTitle>
          <select className={inputClass} aria-label="Account status" value={status} onChange={(e) => setStatus(e.target.value as CompanyStatus)}>
            {(Object.keys(COMPANY_STATUS_LABELS) as CompanyStatus[]).map((s) => (
              <option key={s} value={s}>
                {COMPANY_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          {status === "paused" && account.status !== "paused" ? (
            <p className="mt-2 text-xs text-danger">Pausing stops new tows in their apps. Their records stay available to them.</p>
          ) : null}
          <Button className="mt-3" full disabled={status === account.status} onClick={() => run(() => setCompanyStatus(account.id, status), `Status changed to ${COMPANY_STATUS_LABELS[status]}.`)}>
            Save status
          </Button>
        </Card>
        <Card>
          <SectionTitle>Internal notes</SectionTitle>
          <textarea className={`${inputClass} min-h-28`} aria-label="Internal notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Only the TowLedger team sees these." />
          <Button className="mt-3" full variant="secondary" disabled={notes === account.notes} onClick={() => run(() => saveCompanyNotes(account.id, notes), "Notes saved.")}>
            Save notes
          </Button>
        </Card>
        {message ? <Banner tone="good">{message}</Banner> : null}
        <ErrorText message={error} />
      </aside>
    </div>
  );
}

function Jobs({ account }: { account: CompanyAccount }) {
  const [open, setOpen] = useState<string | null>(null);
  const jobs = [...account.data.jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (jobs.length === 0) return <p className="py-10 text-center text-sm text-muted">No jobs yet.</p>;

  const toggle = (jobId: string) => setOpen(open === jobId ? null : jobId);

  return (
    <ul className="space-y-2">
      {jobs.map((job) => {
        const status = jobStatus(job);
        const expanded = open === job.id;
        return (
          <li key={job.id} className="overflow-hidden rounded-lg border border-line bg-white">
            <button type="button" aria-expanded={expanded} onClick={() => toggle(job.id)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-paper">
              <span className="font-bold">#{job.number}</span>
              <span className="min-w-0 flex-1 truncate">{job.vehicle.make ? vehicleName(job.vehicle) : job.vehicle.plate || "Vehicle not recorded"}</span>
              <span className="text-sm text-muted">{job.driverName}</span>
              {job.workflow ? <span className="grid h-6 w-6 place-items-center rounded bg-forest text-xs font-bold text-signal">{job.workflow.letter}</span> : null}
              <Chip tone={status.tone}>{status.label}</Chip>
              <span className="text-xs text-muted">{formatDate(job.createdAt)}</span>
              <Icon name="chevronRight" className={`h-4 w-4 text-subtle transition ${expanded ? "rotate-90" : ""}`} />
            </button>
            {expanded ? (
              <div className="space-y-4 border-t border-line-soft bg-paper p-4">
                <DataList
                  rows={[
                    ["Workflow", job.workflow ? `${job.workflow.letter} — ${job.workflow.name}` : "Not recorded"],
                    ["Customer", job.customer.name || "—"],
                    ["Pickup → destination", `${job.pickup || "—"} → ${job.destination || "—"}`],
                    ["Estimate", job.estimates.at(-1) ? formatMoney(job.estimates.at(-1)!.totalCents) : "—"],
                    ["Invoice", job.invoices.at(-1) ? `${job.invoices.at(-1)!.number} · ${formatMoney(job.invoices.at(-1)!.totalCents)}` : "Not issued"],
                  ]}
                />
                <AuditTable entries={job.audit} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function Setup({ account }: { account: CompanyAccount }) {
  const d = account.data;
  const template = currentConsentTemplate(d.consentTemplates);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <SectionTitle>Workflows</SectionTitle>
        <ul className="space-y-3 text-sm">
          {d.workflows.map((w) => (
            <li key={w.id}>
              <p className="font-semibold">
                {w.letter} — {w.name}
              </p>
              <p className="text-xs text-muted">
                Before the tow: {[w.requireReference && w.referenceLabel, w.requireEstimate && "estimate delivered", w.requireConsent && "consent step", w.requireDestination && "destination recorded"].filter(Boolean).join(", ") || "nothing required"} ·{" "}
                {d.rateCards.find((r) => r.id === w.rateCardId)?.name}
              </p>
              <p className="text-xs text-muted">Used for: {d.requestTypes.filter((t) => t.enabled && t.workflowId === w.id).map((t) => t.label).join(", ") || "—"}</p>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <SectionTitle>Rate cards</SectionTitle>
        <ul className="space-y-2 text-sm">
          {d.rateCards.map((r) => (
            <li key={r.id}>
              <span className="font-semibold">{r.name}</span>
              <span className="block text-xs text-muted">
                Base {formatMoney(r.baseTowCents)} · {formatMoney(r.perKmCents)}/km · storage {formatMoney(r.storagePerDayCents)}/day
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-line-soft pt-3">
          <DataList
            rows={[
              ["Consent template", `Version ${template.version} · effective ${formatPlainDate(template.effectiveDate)} · ${template.updatedBy}`],
              ["Delivery notices", d.notifications.deliveredAuto ? `Automatic, ${d.notifications.undoSeconds}-second undo window` : "Manual"],
            ]}
          />
        </div>
      </Card>
    </div>
  );
}
