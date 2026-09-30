"use client";

import { useParams } from "next/navigation";

import { CustomerPortal } from "@/components/customer-portal";

// Same customer view as the estimate link, opened on the invoice. No payments are taken here.
export default function CustomerInvoicePage() {
  const { token } = useParams<{ token: string }>();
  return <CustomerPortal kind="invoice" token={token} />;
}
