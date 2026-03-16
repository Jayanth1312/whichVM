// ─── Shared Types for WhichVM Pipeline ───────────────────────────────────────

/** Short-key instance row for msgpack — minimizes payload size */
export interface InstanceRow {
  n: string; // instanceType (name)
  f: string; // family
  v: number; // vCPUs
  m: number; // memoryGiB
  p: string; // processor
  a: string; // architecture
  s: string; // storage description
  nw: string; // network description
  g: boolean; // hasGPU
  gc: number; // gpuCount
  gn: string | null; // gpuName
  pr: Record<string, number>; // pricing for THIS region only (short keys)
}

/** Region file structure — what gets msgpacked & compressed */
export interface RegionFile {
  provider: string;
  region: string;
  generatedAt: string;
  count: number;
  instances: InstanceRow[];
}

/** Single region entry in index.json */
export interface RegionManifestEntry {
  id: string;
  label: string;
  instanceCount: number;
  url: string;
  sizeBytes: number;
}

/** Provider entry in index.json */
export interface ProviderManifest {
  regions: RegionManifestEntry[];
}

/** index.json manifest — the tiny file the frontend loads first */
export interface IndexManifest {
  generatedAt: string;
  version: number;
  providers: Record<string, ProviderManifest>;
}

/** Provider identifiers */
export type Provider = "aws" | "azure" | "gcp";
