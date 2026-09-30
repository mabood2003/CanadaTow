"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { InvoiceDocument } from "@/components/documents";
import { Banner, Button, Loading, PageShell } from "@/components/ui";
import { jobHref } from "@/lib/job-steps";
import { findJobByInvoiceToken, useAppState } from "@/lib/store";
import { formatDateTime } from "@/lib/time";

// Customer-facing invoice. No payments are taken here.
export default function CustomerInvoicePage() {
  const { token } = useParams<{ token: string }>();
  const app = useAppState();

  if (!app) return <Loading />;
  const found = findJobByInvoiceToken(app, token);
  if (!found) {
    return (
      <PageShell>
        <Banner tone="warn" title="Invoice not found">
          This link isn&apos;t available on this device. Please ask your tow operator for a copy of your invoice.
        </Banner>
      </PageShell>
    );
  }

  const { job, invoice } = found;
  return (
    <PageShell>
      <div className="space-y-4">
        {invoice.supersededAt ? (
          <Banner tone="bad" title="This invoice was corrected">
            A corrected invoice was issued on {formatDateTime(invoice.supersededAt)}. Please ask your tow operator for the latest version.
          </Banner>
        ) : null}
        <InvoiceDocument company={app.company} invoice={invoice} jobNumber={job.number} />
        <div className="no-print space-y-3">
          <Button full size="lg" onClick={() => window.print()}>
            Download PDF
          </Button>
          <p className="text-center text-xs text-slate-500">Opens your device&apos;s print screen — choose “Save as PDF”.</p>
          <p className="pt-4 text-center text-xs text-slate-400">
            <Link href={jobHref(job)} className="underline">
              Driver: return to job {job.number}
            </Link>
          </p>
        </div>
      </div>
    </PageShell>
  );
}
