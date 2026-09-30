import { DriverShell } from "@/components/app-shell";
import { appMetadata, DRIVER_APP } from "@/lib/app-identity";

// TowLedger Driver — the operator app (phone). Installs separately from the owner app.
export const metadata = appMetadata(DRIVER_APP);

export default function DriverLayout({ children }: LayoutProps<"/driver">) {
  return <DriverShell>{children}</DriverShell>;
}
