"use client";

import { useState } from "react";

import { Icon } from "@/components/icons";
import { JobRow } from "@/components/job-row";
import { inputClass, Loading, PageShell, ScreenHeader, Segmented } from "@/components/ui";
import { currentUserName, useAppState } from "@/lib/store";
import { jobRecord } from "@/lib/tow-rules";

type Filter = "open" | "done" | "all";

export default function DriverJobsPage() {
  const app = useAppState();
  const [filter, setFilter] = useState<Filter>("open");
  const [search, setSearch] = useState("");
  if (!app) return <Loading />;

  const me = currentUserName(app);
  const query = search.trim().toLowerCase();
  const mine = app.jobs.filter((j) => j.driverName === me).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rows = mine
    .filter((j) => (filter === "all" ? true : filter === "done" ? jobRecord(j).complete : !jobRecord(j).complete))
    .filter((j) => !query || `${j.vehicle.plate} ${j.customer.name} ${j.number}`.toLowerCase().includes(query));

  return (
    <PageShell>
      <ScreenHeader kicker={me} title="My jobs" subtitle={`${mine.length} job${mine.length === 1 ? "" : "s"} on this device`} />
      <div className="space-y-3">
        <Segmented
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "open", label: "Open" },
            { value: "done", label: "Complete" },
            { value: "all", label: "All" },
          ]}
        />
        <label className="relative block">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input className={`${inputClass} pl-9`} type="search" placeholder="Plate, customer or job number" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">{filter === "open" ? "No open jobs. Nice work." : "No jobs match."}</p>
      ) : (
        <ul className="mt-4 divide-y divide-line-soft border-y border-line-soft">
          {rows.map((job) => (
            <li key={job.id}>
              <JobRow job={job} />
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
