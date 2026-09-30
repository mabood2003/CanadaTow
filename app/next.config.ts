import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1", "0.0.0.0", "192.168.1.78"],
  // Stage 1 URLs, from before the driver and owner apps were split. (/admin is now the TowLedger admin console.)
  async redirects() {
    return [
      { source: "/office", destination: "/owner/jobs", permanent: false },
      { source: "/setup", destination: "/owner/settings", permanent: false },
      { source: "/jobs/:path*", destination: "/driver/jobs/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
