/**
 * api-utils.ts
 * Helper functions for API requests in the frontend.
 */

/**
 * Returns the full URL for fetching a data file from the Blob CDN.
 * Strictly requires NEXT_PUBLIC_BLOB_CDN_URL to be set, otherwise throws an error.
 *
 * @param path The path of the file, e.g., "/meta/index.json" or "/aws/us-east-1.msgpack.zst"
 * @returns The full URL to fetch the file from.
 */
export function getDataUrl(path: string): string {
  const cdnBase = process.env.NEXT_PUBLIC_BLOB_CDN_URL;

  if (!cdnBase) {
    throw new Error(
      "CRITICAL: NEXT_PUBLIC_BLOB_CDN_URL environment variable is missing. " +
      "The frontend requires this variable to fetch static data directly from the CDN. " +
      "Please set it in your .env file."
    );
  }

  // Ensure path starts with a slash
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // Remove trailing slash from CDN base if it exists
  const normalizedCdnBase = cdnBase.endsWith("/") ? cdnBase.slice(0, -1) : cdnBase;

  return `${normalizedCdnBase}${normalizedPath}`;
}
