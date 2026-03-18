import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const cdnUrl = process.env.NEXT_PUBLIC_BLOB_CDN_URL;
    const rewrites = [];

    if (cdnUrl) {
      rewrites.push({
        source: "/api/data/:path*",
        destination: `${cdnUrl}/:path*`,
      });
    }

    return rewrites;
  },
};

export default nextConfig;
