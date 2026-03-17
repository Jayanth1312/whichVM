/**
 * orchestrator.ts
 *
 * Runs the full pipeline:
 *   1. For each provider: read JSON files → compress → write .msgpack.zst
 *   2. Generate index.json manifest
 *
 * The sync scripts (sync-aws.js, sync-azure.js, sync-gcp.js) must have
 * already run and produced per-region JSON files in output/{provider}/.
 *
 * No MongoDB dependency — everything is file-based.
 */

import { enrichProvider } from "./enricher";
import { closeDB } from "../config/db";
import { config } from "../config";
import { writeProviderFiles, writeIndexManifest } from "./writer";
import { pushToMongo } from "./mongo-pusher";
import * as fs from "fs";
import * as path from "path";
import {
  IndexManifest,
  Provider,
  ProviderManifest,
  RegionManifestEntry,
} from "../types";

const PROVIDERS: Provider[] = ["aws", "azure", "gcp"];

export interface PipelineResult {
  success: boolean;
  providersProcessed: string[];
  regionsTotal: number;
  filesTotal: number;
  errors: string[];
  durationMs: number;
}

/**
 * Run the compression + manifest pipeline.
 *
 * Reads per-region JSON files (produced by sync scripts),
 * compresses them to .msgpack.zst, and generates index.json.
 *
 * @param providers - Which providers to process (default: all)
 * @returns Pipeline result summary
 */
export async function runPipeline(
  providers: Provider[] = PROVIDERS,
): Promise<PipelineResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let regionsTotal = 0;
  let filesTotal = 0;

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║      WhichVM Pipeline — Build Started            ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // Load existing manifest to preserve other providers if running partial pipeline
  let existingManifest: IndexManifest | null = null;
  if (config.blobToken) {
    try {
      const response = await fetch(`${config.blobCdnUrl}/meta/index.json`);
      if (response.ok) {
        existingManifest = await response.json() as IndexManifest;
        console.log(`[Pipeline] Loaded existing manifest from Blob CDN`);
      }
    } catch (err) {
      console.warn(`[Pipeline] Failed to load manifest from Blob CDN:`, err);
    }
  } else {
    const filePath = path.join(config.outputDir, "meta", "index.json");
    if (fs.existsSync(filePath)) {
      try {
        existingManifest = JSON.parse(fs.readFileSync(filePath, "utf8"));
        console.log(`[Pipeline] Loaded existing manifest from local disk`);
      } catch {}
    }
  }

  const manifestProviders: Record<string, ProviderManifest> = existingManifest?.providers || {};

  for (const provider of providers) {
    try {
      console.log(
        `\n── ${provider.toUpperCase()} ──────────────────────────────`,
      );

      const regionFiles = await enrichProvider(provider);

      if (regionFiles.size === 0) {
        console.warn(
          `⚠ ${provider}: No data found. Run sync-${provider}.js first.`,
        );
        errors.push(`${provider}: No data found`);
        continue;
      }

      // Step 2: Compress & Write .msgpack.zst files
      const entries = await writeProviderFiles(provider, regionFiles);

      manifestProviders[provider] = { regions: entries };
      regionsTotal += regionFiles.size;
      filesTotal += entries.length;

      console.log(
        `✓ ${provider}: ${regionFiles.size} regions, ` +
          `${entries.reduce((sum: number, e: RegionManifestEntry) => sum + e.instanceCount, 0)} total instance-region rows`,
      );

      // Step 2.5: Sync with MongoDB (for dynamic searches & details API)
      await pushToMongo(provider, regionFiles);

    } catch (err: any) {
      console.error(`✗ ${provider}: ${err.message}`);
      errors.push(`${provider}: ${err.message}`);
    }
  }

  // Step 3: Generate index.json manifest
  const manifest: IndexManifest = {
    generatedAt: new Date().toISOString(),
    version: 1,
    providers: manifestProviders,
  };

  await writeIndexManifest(manifest);

  await closeDB();

  const durationMs = Date.now() - startTime;

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log(
    `║  Pipeline Complete — ${(durationMs / 1000).toFixed(1)}s                         ║`,
  );
  console.log(
    `║  ${regionsTotal} regions, ${filesTotal} files${errors.length > 0 ? `, ${errors.length} errors` : ""}                       ║`,
  );
  console.log("╚══════════════════════════════════════════════════╝\n");

  return {
    success: errors.length === 0,
    providersProcessed: providers,
    regionsTotal,
    filesTotal,
    errors,
    durationMs,
  };
}

/**
 * CLI entry point — run pipeline standalone.
 */
export async function runPipelineCli(): Promise<void> {
  try {
    const result = await runPipeline();

    if (!result.success) {
      console.error("Pipeline completed with errors:", result.errors);
      process.exit(1);
    }
  } catch (err: any) {
    console.error("Pipeline failed:", err.message);
    process.exit(1);
  }
}

// Allow running directly: `npx tsx src/pipeline/orchestrator.ts`
if (require.main === module) {
  runPipelineCli();
}
