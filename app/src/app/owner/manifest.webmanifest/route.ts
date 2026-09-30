import { appManifest, OWNER_APP } from "@/lib/app-identity";

export const dynamic = "force-static";

export function GET() {
  return Response.json(appManifest(OWNER_APP), { headers: { "Content-Type": "application/manifest+json" } });
}
