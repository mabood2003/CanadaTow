import type { Metadata } from "next";

import { AdminConsoleShell } from "@/components/admin-console";

// TowLedger's own admin console — web only, for the TowLedger team. Not installable.
export const metadata: Metadata = {
  title: { default: "TowLedger Admin", template: "%s · TowLedger Admin" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <AdminConsoleShell>{children}</AdminConsoleShell>;
}
