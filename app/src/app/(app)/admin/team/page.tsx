"use client";

import { useState } from "react";

import { AdminHeader, isOwner, SavedNote } from "@/components/admin";
import { Banner, Button, Card, ErrorText, Field, inputClass, Loading, SectionTitle } from "@/components/ui";
import { initials } from "@/lib/describe";
import { GuardrailError, newId } from "@/lib/jobs";
import type { AppState } from "@/lib/seed";
import { attempt, setAppState, useAppState } from "@/lib/store";

export default function TeamPage() {
  const app = useAppState();
  if (!app) return <Loading />;
  return <Team app={app} />;
}

function Team({ app }: { app: AppState }) {
  const owner = isOwner(app);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [invited, setInvited] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invite = () => {
    const failure = attempt(() => {
      if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) throw new GuardrailError("Enter the driver's name and email.");
      console.info(`[prototype] sign-in link invite to ${email.trim()}`);
      setAppState((s) => ({ ...s, team: [...s.team, { id: newId("u-"), name: name.trim(), email: email.trim(), role: "driver", invited: true }] }));
      setName("");
      setEmail("");
    });
    setError(failure);
    setInvited(!failure);
  };

  return (
    <>
      <AdminHeader kicker="Company setup · Team" title="Team">
        Drivers use the roadside flow on their phones; owners and office staff manage settings and review job records.
      </AdminHeader>

      <Card padded={false}>
        <ul className="divide-y divide-line-soft">
          {app.team.map((m) => (
            <li key={m.id} className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <span className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-mint font-mono text-xs font-bold text-forest">{initials(m.name)}</span>
                <span>
                  <span className="block font-semibold">
                    {m.name}
                    {m.invited ? <span className="ml-2 rounded bg-[#fff0dd] px-1.5 py-0.5 text-[11px] font-semibold text-[#945b0e]">Invited</span> : null}
                  </span>
                  <span className="block text-xs text-muted">
                    {m.role === "owner" ? "Owner / office" : "Driver"} · {m.email}
                  </span>
                </span>
              </span>
              {app.currentUserId === m.id ? (
                <span className="text-xs font-semibold text-ok">Using the app as</span>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setAppState((s) => ({ ...s, currentUserId: m.id }))}>
                  Use as {m.name.split(" ")[0]}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <p className="text-xs text-muted">“Use as” is a pilot stand-in for sign-in, so you can test as the owner or a driver.</p>

      <fieldset disabled={!owner}>
        <Card>
          <SectionTitle>Invite a driver</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Name">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Email">
              <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Button onClick={invite}>Send invite</Button>
          </div>
          <div className="mt-3">
            <SavedNote show={invited}>Invite recorded (prototype — no email sent).</SavedNote>
            <ErrorText message={error} />
          </div>
        </Card>
      </fieldset>
      {!owner ? <Banner tone="neutral">Only the owner can invite drivers.</Banner> : null}
    </>
  );
}
