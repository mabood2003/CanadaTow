// The two installable TowLedger apps. Each gets its own name, icon, manifest and URL scope,
// so a phone can have both "TowLedger Driver" and "TowLedger Owner" on its home screen.
import type { Metadata, MetadataRoute } from "next";

import type { AppBase } from "@/lib/app-base";

export interface AppIdentity {
  base: AppBase;
  name: string;
  shortName: string;
  description: string;
  /** Icon background and bar colours: the driver app is forest-on-lime reversed from the owner app. */
  background: string;
  foreground: string;
}

export const DRIVER_APP: AppIdentity = {
  base: "/driver",
  name: "TowLedger Driver",
  shortName: "TL Driver",
  description: "Roadside estimates, consent, tow times and invoices for your company's drivers.",
  background: "#193c2a",
  foreground: "#e5ff57",
};

export const OWNER_APP: AppIdentity = {
  base: "/owner",
  name: "TowLedger Owner",
  shortName: "TL Owner",
  description: "Run your towing company: live jobs, records that need attention, team and company setup.",
  background: "#e5ff57",
  foreground: "#193c2a",
};

export function appMetadata(app: AppIdentity): Metadata {
  return {
    title: { default: app.name, template: `%s · ${app.name}` },
    applicationName: app.name,
    description: app.description,
    manifest: `${app.base}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: app.shortName, statusBarStyle: "default" },
    icons: { icon: `${app.base}/app-icon/192`, apple: `${app.base}/app-icon/180` },
  };
}

export function appManifest(app: AppIdentity): MetadataRoute.Manifest {
  return {
    id: app.base,
    name: app.name,
    short_name: app.shortName,
    description: app.description,
    start_url: app.base,
    scope: app.base,
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f0e7",
    theme_color: "#193c2a",
    icons: [
      { src: `${app.base}/app-icon/192`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${app.base}/app-icon/512`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${app.base}/app-icon/512`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
