import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const cdnUrl = process.env.NEXT_PUBLIC_BLOB_CDN_URL;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    const rewrites = [];

    if (cdnUrl) {
      rewrites.push({
        source: "/api/data/:path*",
        destination: `${cdnUrl}/:path*`,
      });
    }

    if (apiUrl) {
      rewrites.push({
        source: "/api/instances/:path*",
        destination: `${apiUrl}/api/instances/:path*`,
      });
      rewrites.push({
        source: "/api/ping",
        destination: `${apiUrl}/api/ping`,
      });
    }

    return rewrites;
  },
};

export default nextConfig;
