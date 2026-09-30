"use client";

import { useParams } from "next/navigation";

import { CustomerPortal } from "@/components/customer-portal";

export default function CustomerEstimatePage() {
  const { token } = useParams<{ token: string }>();
  return <CustomerPortal kind="estimate" token={token} />;
}
