"use client";

import Link from "next/link";
import { useState } from "react";

import { AdminHeader, SavedNote } from "@/components/admin";
import { Icon } from "@/components/icons";
import { Button, Card, Chip, ErrorText, Field, inputClass, Loading, PageShell, SectionTitle } from "@/components/ui";
import { initials } from "@/lib/describe";
import { GuardrailError, newId } from "@/lib/jobs";
import { jobHref } from "@/lib/job-steps";
import { driverSummaries, elapsed, LIVE_STAGE_LABELS } from "@/lib/owner-view";
import type { AppState } from "@/lib/seed";
import { inviteMessage } from "@/lib/messages";
import { actorFor, attempt, logMessages, setAppState, useAppState } from "@/lib/store";
import { formatWhen } from "@/lib/time";

export default function TeamPage() {
  const app = useAppState();
  if (!app) return <Loading />;
  return <Team app={app} />;
}

function Team({ app }: { app: AppState }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const drivers = driverSummaries(app.team, app.jobs, now);
  const owners = app.team.filter((m) => m.role === "owner");

  const invite = () => {
    const failure = attempt(() => {
      if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) throw new GuardrailError("Enter the driver's name and email.");
      if (app.team.some((m) => m.email.toLowerCase() === email.trim().toLowerCase())) throw new GuardrailError("Someone on the team already uses that email.");
      setAppState((s) => ({ ...s, team: [...s.team, { id: newId("u-"), name: name.trim(), email: email.trim(), role: "driver", invited: true }] }));
      logMessages([inviteMessage({ name: name.trim(), email: email.trim(), company: app.company, origin: window.location.origin, actor: actorFor(app) })]);
      setName("");
      setEmail("");
    });
    setError(failure);
    setNotice(failure ? null : "Invite recorded. They open TowLedger Driver and choose their name to accept (prototype — the email is in Messages, not actually sent).");
  };

  const resend = (member: { name: string; email: string }) => {
    logMessages([inviteMessage({ name: member.name, email: member.email, company: app.company, origin: window.location.origin, actor: actorFor(app) })]);
    setNotice(`Invite re-sent to ${member.email} (prototype — recorded in Messages, not actually sent).`);
  };

  return (
    <PageShell width="full">
      <div className="space-y-5">
        <AdminHeader kicker={`${app.company.name} · Team`} title="Team">
          Drivers work from the TowLedger Driver app on their phones and see only their own jobs. Owners use this app for every job, the team and company setup.
        </AdminHeader>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {drivers.map(({ member, openJobs, live, jobsThisWeek, lastActiveAt }) => (
            <Card key={member.id} className="flex flex-col">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mint font-mono text-sm font-bold text-forest">{initials(member.name)}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{member.name}</p>
                  <p className="truncate text-xs text-muted">{member.email}</p>
                </div>
                {member.invited ? <Chip tone="warn">Invited</Chip> : live ? <Chip tone="info">On a job</Chip> : <Chip tone="good">Available</Chip>}
              </div>

              {live ? (
                <Link href={jobHref(live.job)} className="mt-4 flex items-center gap-3 rounded-md bg-forest p-3 text-white">
                  <Icon name="truck" className="h-5 w-5 text-signal" />
                  <span className="min-w-0 text-sm">
                    <span className="block font-semibold">
                      #{live.job.number} · {LIVE_STAGE_LABELS[live.stage]}
                    </span>
                    <span className="block truncate text-xs text-[#b6c6bb]">
                      {elapsed(live.since, now)} ago · to {live.job.destination.split(" — ")[0]}
                    </span>
                  </span>
                </Link>
              ) : null}

              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-paper p-2">
                  <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Open</dt>
                  <dd className="text-lg font-extrabold tabular-nums">{openJobs.length}</dd>
                </div>
                <div className="rounded-md bg-paper p-2">
                  <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted">7 days</dt>
                  <dd className="text-lg font-extrabold tabular-nums">{jobsThisWeek}</dd>
                </div>
                <div className="rounded-md bg-paper p-2">
                  <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Last active</dt>
                  <dd className="pt-1 text-xs font-semibold">{lastActiveAt ? formatWhen(lastActiveAt) : "—"}</dd>
                </div>
              </dl>

              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <Link href={`/owner/jobs?driver=${encodeURIComponent(member.name)}`} className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-pine">
                  View jobs <Icon name="arrowRight" className="h-4 w-4" />
                </Link>
                {member.invited ? (
                  <Button size="sm" variant="secondary" className="ml-auto" icon="mail" onClick={() => resend(member)}>
                    Resend invite
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>

        <Card>
          <SectionTitle>Invite a driver</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Name">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Email">
              <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Button onClick={invite} icon="mail">
              Send invite
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            <SavedNote show={Boolean(notice)}>{notice}</SavedNote>
            <ErrorText message={error} />
          </div>
        </Card>

        <Card padded={false}>
          <div className="px-4 pt-4 sm:px-5">
            <SectionTitle>Owners</SectionTitle>
          </div>
          <ul className="divide-y divide-line-soft">
            {owners.map((m) => (
              <li key={m.id} className="flex min-h-14 items-center gap-3 px-4 py-3 sm:px-5">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-forest font-mono text-xs font-bold text-signal">{initials(m.name)}</span>
                <span>
                  <span className="block font-semibold">{m.name}</span>
                  <span className="block text-xs text-muted">Owner · {m.email}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </PageShell>
  );
}
