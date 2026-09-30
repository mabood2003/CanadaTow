import { AppBar } from "@/components/app-bar";
import { OfflineBanner } from "@/components/ui";

// Staff screens (driver, office, company setup). Customer links under /e and /i have no app chrome.
export default function StaffLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <OfflineBanner />
      <AppBar />
      {children}
    </>
  );
}
