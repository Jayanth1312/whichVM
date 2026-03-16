/**
 * enricher.ts
 *
 * Reads per-region JSON files from disk (produced by sync-*.js scripts)
 * and returns them as RegionFile objects for compression.
 *
 * The sync scripts have already done the heavy lifting:
 *   - Fetched data from CloudPrice API
 *   - Extracted specs and pricing
 *   - Pivoted from instance-centric to region-centric format
 *   - Written per-region .json files to output/{provider}/
 *
 * This enricher simply reads those files back so the pipeline can compress them.
 */

import * as fs from "fs";
import * as path from "path";
import { RegionFile, Provider } from "../types";
import { config } from "../config";

/**
 * Reads all per-region JSON files for a provider from the output directory.
 *
 * @returns Map of region → RegionFile
 */
export async function enrichProvider(
  provider: Provider,
): Promise<Map<string, RegionFile>> {
  const providerDir = path.join(config.outputDir, provider);

  if (!fs.existsSync(providerDir)) {
    console.log(
      `[Enricher] No output directory for ${provider}: ${providerDir}`,
    );
    return new Map();
  }

  const jsonFiles = fs
    .readdirSync(providerDir)
    .filter((f) => f.endsWith(".json"));

  console.log(
    `[Enricher] Reading ${jsonFiles.length} JSON files for ${provider}`,
  );

  const regionFiles = new Map<string, RegionFile>();

  for (const file of jsonFiles) {
    try {
      const filePath = path.join(providerDir, file);
      const content = fs.readFileSync(filePath, "utf8");
      const regionFile: RegionFile = JSON.parse(content);

      // Use the region from the file content, or derive from filename
      const region = regionFile.region || file.replace(".json", "");

      regionFiles.set(region, regionFile);
    } catch (err: any) {
      console.warn(`[Enricher] Failed to read ${file}: ${err.message}`);
    }
  }

  console.log(
    `[Enricher] Loaded ${regionFiles.size} region files for ${provider}`,
  );
  return regionFiles;
}
