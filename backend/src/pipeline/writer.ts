/**
 * writer.ts
 *
 * Writes compressed region files and index.json.
 *
 * In production (BLOB_READ_WRITE_TOKEN set):
 *   → Uploads to Vercel Blob CDN
 *
 * In development:
 *   → Writes to local output/ directory
 */

import * as fs from "fs";
import * as path from "path";
import { put } from "@vercel/blob";
import { config } from "../config";
import {
  IndexManifest,
  RegionFile,
  RegionManifestEntry,
  Provider,
} from "../types";
import { compressRegionFile } from "./compressor";
import { getRegionLabel } from "./region-labels";

// ─── Blob Upload Helper ──────────────────────────────────────────────

/**
 * Upload a file to Vercel Blob and return its public URL.
 */
async function uploadToBlob(
  pathname: string,
  data: Buffer | string,
): Promise<string> {
  const contentType =
    typeof data === "string" ? "application/json" : "application/octet-stream";

  const blob = await put(pathname, data, {
    access: "public",
    token: config.blobToken!,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
  });

  return blob.url;
}

/**
 * Check if Blob storage is configured for production use.
 */
function useBlob(): boolean {
  return !!config.blobToken;
}

// ─── Local File Helpers ──────────────────────────────────────────────

/**
 * Ensure output directory structure exists (dev only).
 */
function ensureOutputDirs(): void {
  const dirs = [
    config.outputDir,
    path.join(config.outputDir, "meta"),
    path.join(config.outputDir, "aws"),
    path.join(config.outputDir, "azure"),
    path.join(config.outputDir, "gcp"),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// ─── Write Provider Files ────────────────────────────────────────────

/**
 * Write all region files for a provider and return manifest entries.
 *
 * Production: Uploads .msgpack.zst files to Vercel Blob CDN.
 * Development: Writes to local output/ directory.
 */
export async function writeProviderFiles(
  provider: Provider,
  regionFiles: Map<string, RegionFile>,
): Promise<RegionManifestEntry[]> {
  const isBlob = useBlob();

  if (!isBlob) {
    ensureOutputDirs();
  }

  const entries: RegionManifestEntry[] = [];
  let totalOriginal = 0;
  let totalCompressed = 0;

  for (const [region, regionFile] of regionFiles) {
    // Compress (async — zstd-codec uses WASM)
    const compressed = await compressRegionFile(regionFile);

    const blobPath = `${provider}/${region}.msgpack.zst`;
    let fileUrl: string;

    if (isBlob) {
      // ── Production: Upload to Vercel Blob CDN ──
      fileUrl = await uploadToBlob(blobPath, compressed);
      console.log(`  ☁ Uploaded ${blobPath} → ${fileUrl}`);
    } else {
      // ── Development: Write to local disk ──
      const filePath = path.join(config.outputDir, blobPath);
      fs.writeFileSync(filePath, compressed);
      fileUrl = `/${blobPath}`;

      // Also write JSON version for debugging (dev only)
      if (config.nodeEnv === "development") {
        const jsonPath = path.join(
          config.outputDir,
          provider,
          `${region}.json`,
        );
        fs.writeFileSync(jsonPath, JSON.stringify(regionFile, null, 2));
      }
    }

    // Stats
    const jsonSize = Buffer.byteLength(JSON.stringify(regionFile));
    totalOriginal += jsonSize;
    totalCompressed += compressed.length;

    // Build manifest entry
    entries.push({
      id: region,
      label: getRegionLabel(provider, region),
      instanceCount: regionFile.count,
      url: fileUrl,
      sizeBytes: compressed.length,
    });
  }

  if (totalOriginal > 0) {
    const target = isBlob ? "Blob CDN" : "local disk";
    console.log(
      `[Writer] ${provider}: ${regionFiles.size} files → ${target}, ` +
        `${(totalOriginal / 1024).toFixed(0)}KB JSON → ${(totalCompressed / 1024).toFixed(0)}KB compressed ` +
        `(${((totalCompressed / totalOriginal) * 100).toFixed(1)}%)`,
    );
  }

  return entries;
}

// ─── Write Index Manifest ────────────────────────────────────────────

/**
 * Write the index.json manifest.
 *
 * Production: Uploads to Vercel Blob AND writes locally (backend still serves it).
 * Development: Writes to local output/ directory only.
 */
export async function writeIndexManifest(
  manifest: IndexManifest,
): Promise<void> {
  ensureOutputDirs();

  const json = JSON.stringify(manifest, null, 2);

  // Always write locally (backend's data.api.ts serves it)
  const filePath = path.join(config.outputDir, "meta", "index.json");
  fs.writeFileSync(filePath, json);

  const sizeKB = (Buffer.byteLength(json) / 1024).toFixed(1);
  console.log(`[Writer] index.json written locally (${sizeKB}KB)`);

  // Also upload to Blob in production (for direct CDN access)
  if (useBlob()) {
    const blobUrl = await uploadToBlob("meta/index.json", json);
    console.log(`[Writer] index.json uploaded to Blob → ${blobUrl}`);
  }
}
