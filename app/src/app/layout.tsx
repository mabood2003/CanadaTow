import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { OfflineBanner } from "@/components/ui";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TowLedger",
  description: "Built for Alberta's towing rules.",
  applicationName: "TowLedger",
  appleWebApp: { capable: true, title: "TowLedger", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-CA" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-100 text-slate-900">
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
