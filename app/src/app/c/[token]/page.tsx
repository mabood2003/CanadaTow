"use client";

import { useParams } from "next/navigation";

import { CustomerPortal } from "@/components/customer-portal";

// The customer's one link for a job: tow status, plus the estimate and invoice when they exist.
export default function CustomerStatusPage() {
  const { token } = useParams<{ token: string }>();
  return <CustomerPortal kind="status" token={token} />;
}
