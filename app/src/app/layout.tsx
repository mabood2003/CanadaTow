import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "TowLedger",
  description: "Towing documentation for Alberta operators — built for Alberta's towing rules.",
  applicationName: "TowLedger",
  appleWebApp: { capable: true, title: "TowLedger", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#193c2a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-CA" className="h-full antialiased">
      <body className="min-h-full bg-cream text-ink">{children}</body>
    </html>
  );
}
