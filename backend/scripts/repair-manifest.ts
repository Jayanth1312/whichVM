/**
 * repair-manifest.ts
 *
 * Reconstructs missing Azure & GCP entries in meta/index.json
 * by listing existing .msgpack.zst files in Vercel Blob.
 */

import { list, put } from "@vercel/blob";
import { config } from "../src/config";
import * as fs from "fs";
import * as path from "path";
import { IndexManifest, ProviderManifest, RegionManifestEntry } from "../src/types";
import { getRegionLabel } from "../src/pipeline/region-labels";

async function main() {
  if (!config.blobToken) {
    console.error("❌ BLOB_READ_WRITE_TOKEN is not set in environment.");
    process.exit(1);
  }

  console.log("Fetching blobs from Vercel...");
  
  const localPath = path.join(config.outputDir, "meta", "index.json");
  let manifest: IndexManifest = {
    generatedAt: new Date().toISOString(),
    version: 1,
    providers: {}
  };

  if (fs.existsSync(localPath)) {
    manifest = JSON.parse(fs.readFileSync(localPath, "utf8"));
  }

  const providersToRepair = ["azure", "gcp"];

  for (const provider of providersToRepair) {
    console.log(`\nReconstructing items for: ${provider}...`);
    const entries: RegionManifestEntry[] = [];

    const response = await list({ prefix: `${provider}/`, token: config.blobToken });
    const blobs = response.blobs.filter(b => b.pathname.endsWith(".msgpack.zst"));

    console.log(`Found ${blobs.length} blobs for ${provider}`);

    for (const blob of blobs) {
      const regionId = path.basename(blob.pathname).replace(".msgpack.zst", "");

      // Since we don't strictly need accurate count to fix dropdown
      // (frontend only uses id & label to build choices, falling back to id anyway)
      // we can set placeholder 0, or read it later if needed.
      // But accurate sizes are useful.

      entries.push({
        id: regionId,
        label: getRegionLabel(provider, regionId),
        instanceCount: 0, // Placeholder
        url: blob.url,
        sizeBytes: blob.size
      });
    }

    if (entries.length > 0) {
      manifest.providers[provider] = { regions: entries };
      console.log(`✅ Restored ${entries.length} regions for ${provider}`);
    } else {
      console.warn(`⚠ No blobs found for ${provider}`);
    }
  }

  manifest.generatedAt = new Date().toISOString();
  const json = JSON.stringify(manifest, null, 2);

  console.log(`\nWriting updated manifest locally to ${localPath}...`);
  fs.writeFileSync(localPath, json);

  console.log(`Uploading manifest back to Vercel Blob...`);
  const blobUrl = await put("meta/index.json", json, {
    access: "public",
    token: config.blobToken,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json"
  });

  console.log(`\n🎉 Repair Complete! Manifest uploaded → ${blobUrl}`);
}

main().catch(console.error);
