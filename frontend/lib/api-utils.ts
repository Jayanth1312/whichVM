/**
 * api-utils.ts
 * Helper functions for API requests in the frontend.
 */

/**
 * Returns the full URL for fetching a data file.
 * If NEXT_PUBLIC_BLOB_CDN_URL is provided, it returns the direct URL to the CDN.
 * Otherwise, it falls back to the local Next.js proxy route `/api/data/...`.
 *
 * @param path The path of the file, e.g., "/meta/index.json" or "/aws/us-east-1.msgpack.zst"
 * @returns The full URL to fetch the file from.
 */
export function getDataUrl(path: string): string {
  const cdnBase = process.env.NEXT_PUBLIC_BLOB_CDN_URL;

  // Ensure path starts with a slash
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (cdnBase) {
    // Remove trailing slash from CDN base if it exists
    const normalizedCdnBase = cdnBase.endsWith("/") ? cdnBase.slice(0, -1) : cdnBase;
    return `${normalizedCdnBase}${normalizedPath}`;
  }

  // Fallback to local Next.js proxy
  return `/api/data${normalizedPath}`;
}
