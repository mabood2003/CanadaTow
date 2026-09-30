import { appManifest, DRIVER_APP } from "@/lib/app-identity";

export const dynamic = "force-static";

export function GET() {
  return Response.json(appManifest(DRIVER_APP), { headers: { "Content-Type": "application/manifest+json" } });
}
