import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // If you are no longer running a separate backend proxy server,
  // there's no need to proxy /api/* requests. The frontend fetches
  // static Blob storage files directly.
};

export default nextConfig;
