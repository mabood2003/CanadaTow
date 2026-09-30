import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TowLedger",
    short_name: "TowLedger",
    description: "Towing documentation for Alberta operators.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f0e7",
    theme_color: "#193c2a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
