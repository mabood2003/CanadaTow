import { OwnerShell } from "@/components/app-shell";
import { appMetadata, OWNER_APP } from "@/lib/app-identity";

// TowLedger Owner — runs the company from a phone or a laptop. Installs separately from the driver app.
export const metadata = appMetadata(OWNER_APP);

export default function OwnerLayout({ children }: LayoutProps<"/owner">) {
  return <OwnerShell>{children}</OwnerShell>;
}
