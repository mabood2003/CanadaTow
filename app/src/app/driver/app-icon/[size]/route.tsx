import { appIcon, ICON_SIZES } from "@/lib/app-icon";
import { DRIVER_APP } from "@/lib/app-identity";

export const dynamic = "force-static";

export function generateStaticParams() {
  return ICON_SIZES.map((size) => ({ size: String(size) }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!ICON_SIZES.includes(size as (typeof ICON_SIZES)[number])) return new Response("Not found", { status: 404 });
  return appIcon(DRIVER_APP, size);
}
