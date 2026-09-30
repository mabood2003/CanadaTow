"use client";

import { useEffect, useMemo, useState } from "react";

import { Icon, type IconName } from "@/components/icons";
import { Button, Modal } from "@/components/ui";
import type { Company, Job } from "@/lib/domain";
import { buildJobPackage } from "@/lib/export";
import { audit } from "@/lib/jobs";
import { attempt, mutateJob } from "@/lib/store";
import { buildZip } from "@/lib/zip";

function iconFor(path: string): IconName {
  if (path.includes("/photos/")) return "image";
  if (path.includes("/consent/")) return "shieldCheck";
  if (path.includes("invoice")) return "receipt";
  if (path.includes("estimate")) return "fileText";
  if (path.includes("activity")) return "history";
  if (path.includes("delivery")) return "message";
  return "fileText";
}

function size(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

/** "One job → one complete documentation package." */
export function ExportPackage({ company, job, open, onClose }: { company: Company; job: Job; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={`Export job record #${job.number}`} wide>
      <PackageBody company={company} job={job} />
    </Modal>
  );
}

/** Mounted each time the dialog opens, so packaging restarts from zero. */
function PackageBody({ company, job }: { company: Company; job: Job }) {
  const [ready, setReady] = useState(0);
  const files = useMemo(() => buildJobPackage(company, job), [company, job]);
  const encoder = useMemo(() => new TextEncoder(), []);

  // Visual packaging: files tick in one by one.
  useEffect(() => {
    const timer = setInterval(() => setReady((n) => (n >= files.length ? n : n + 1)), 110);
    return () => clearInterval(timer);
  }, [files.length]);

  const done = ready >= files.length && files.length > 0;

  const download = () => {
    const zip = buildZip(files);
    const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${company.name.replace(/[^\w]+/g, "-").replace(/-+$/, "")}-job-${job.number}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    attempt(() => mutateJob(job.id, (j, actor) => audit(j, actor, `Job record exported (${files.length} files)`)));
  };

  return (
    <>
      <div className="flex items-center gap-3 rounded-md bg-forest p-4 text-white">
        <span className="grid h-11 w-11 place-items-center rounded-md bg-signal text-forest">
          <Icon name="package" className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">job-{job.number}.zip</p>
          <p className="text-sm text-[#b6c6bb]">{done ? `${files.length} files ready` : `Packaging ${ready} of ${files.length}…`}</p>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand">
        <div className="h-full bg-pine transition-all" style={{ width: `${files.length ? (ready / files.length) * 100 : 0}%` }} />
      </div>
      <ul className="mt-4 divide-y divide-line-soft rounded-md border border-line bg-white">
        {files.map((f, i) => {
          const bytes = typeof f.data === "string" ? encoder.encode(f.data).length : f.data.length;
          return (
            <li key={f.path} className={`flex items-center gap-3 px-3 py-2.5 text-sm transition ${i < ready ? "opacity-100" : "opacity-35"}`}>
              <Icon name={iconFor(f.path)} className="h-4 w-4 text-pine" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{f.label}</span>
                <span className="block truncate font-mono text-[11px] text-subtle">{f.path.split("/").slice(1).join("/")}</span>
              </span>
              <span className="shrink-0 font-mono text-[11px] text-subtle">{size(bytes)}</span>
              {i < ready ? <Icon name="check" className="h-4 w-4 text-ok" strokeWidth={3} /> : <span className="h-4 w-4" />}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted">Documents are printable HTML in this prototype; server-generated PDFs with a stored SHA-256 hash come later.</p>
      <Button full size="lg" className="mt-4" icon="download" disabled={!done} onClick={download}>
        Download job record
      </Button>
    </>
  );
}
