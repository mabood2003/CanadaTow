// Server-only: renders the home-screen icon PNGs. Kept apart from app-identity so client screens
// that show app names don't pull the image renderer into the browser bundle.
import { ImageResponse } from "next/og";

import type { AppIdentity } from "@/lib/app-identity";

export const ICON_SIZES = [180, 192, 512] as const;

/** The TowLedger mark (three slanted bars) in the app's colours. Full-bleed so it also works as a maskable icon. */
export function appIcon(app: AppIdentity, size: number) {
  const bar = { width: size * 0.46, height: size * 0.085, borderRadius: size * 0.05, background: app.foreground };
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: app.background }}>
        <div style={{ display: "flex", flexDirection: "column", gap: size * 0.06, transform: "rotate(-35deg)" }}>
          <div style={bar} />
          <div style={bar} />
          <div style={bar} />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
