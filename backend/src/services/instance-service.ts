import { getDB } from "../config/db";
import { RegionFile, InstanceRow, Provider } from "../types";

const PROVIDER_COLLECTIONS: Record<Provider, string> = {
  aws: "aws_ec2",
  azure: "azure_vm",
  gcp: "gcp_compute",
};

export async function enrichProviderFromMongo(
  provider: Provider,
): Promise<Map<string, RegionFile>> {
  const db = await getDB();
  const collectionName = PROVIDER_COLLECTIONS[provider];
  if (!collectionName) {
    console.log(`[MongoEnricher] Unknown provider: ${provider}`);
    return new Map();
  }

  const collection = db.collection(collectionName);
  const cursor = collection.find({});
  const instances = await cursor.toArray();

  console.log(
    `[MongoEnricher] Loaded ${instances.length} instances from ${collectionName}`,
  );

  if (instances.length === 0) return new Map();

  // Pivot: instance-centric (MongoDB) → region-centric (RegionFile)
  const regionRows = new Map<string, InstanceRow[]>();

  for (const doc of instances) {
    const pricing = doc.pricing as Record<string, Record<string, number>>;
    if (!pricing) continue;

    for (const [region, regionPricing] of Object.entries(pricing)) {
      // Filter: only keep actual positive prices
      const pr: Record<string, number> = {};
      for (const [key, val] of Object.entries(regionPricing)) {
        if (typeof val === "number" && val > 0) pr[key] = val;
      }
      if (Object.keys(pr).length === 0) continue;

      const row: InstanceRow = {
        n: (doc.instanceType as string) || "",
        f: (doc.instanceFamily as string) || "",
        v: (doc.vCPUs as number) || 0,
        m: (doc.memoryGiB as number) || 0,
        p: (doc.processor as string) || "",
        a: (doc.architecture as string) || "",
        s: (doc.storage as string) || "",
        nw: (doc.network as string) || "",
        g: (doc.hasGPU as boolean) || false,
        gc: (doc.gpuCount as number) || 0,
        gn: (doc.gpuName as string) || null,
        pr,
      };

      if (!regionRows.has(region)) regionRows.set(region, []);
      regionRows.get(region)!.push(row);
    }
  }

  // Build RegionFile map
  const regionFiles = new Map<string, RegionFile>();
  for (const [region, rows] of regionRows) {
    rows.sort((a, b) => a.n.localeCompare(b.n));

    regionFiles.set(region, {
      provider,
      region,
      generatedAt: new Date().toISOString(),
      count: rows.length,
      instances: rows,
    });
  }

  console.log(
    `[MongoEnricher] Built ${regionFiles.size} region files for ${provider}`,
  );
  return regionFiles;
}

export interface InstanceSearchResult {
  instanceType: string;
  instanceFamily: string;
  vCPUs: number;
  memoryGiB: number;
  processor: string;
  architecture: string;
  linuxOnDemand?: number;
}

export async function searchInstances(
  provider: Provider,
  query: string,
  region: string = "us-east-1",
  limit: number = 20,
): Promise<InstanceSearchResult[]> {
  const db = await getDB();
  const collectionName = PROVIDER_COLLECTIONS[provider];
  if (!collectionName) return [];

  const collection = db.collection(collectionName);

  const results = await collection
    .find({
      instanceType: { $regex: query, $options: "i" },
    })
    .project({
      instanceType: 1,
      instanceFamily: 1,
      vCPUs: 1,
      memoryGiB: 1,
      processor: 1,
      architecture: 1,
      [`pricing.${region}.linuxOnDemand`]: 1,
    })
    .limit(limit)
    .toArray();

  return results.map((doc) => ({
    instanceType: doc.instanceType,
    instanceFamily: doc.instanceFamily,
    vCPUs: doc.vCPUs,
    memoryGiB: doc.memoryGiB,
    processor: doc.processor,
    architecture: doc.architecture,
    linuxOnDemand: doc.pricing?.[region]?.linuxOnDemand,
  }));
}

export async function getInstanceDetail(
  provider: Provider,
  instanceType: string,
): Promise<any | null> {
  const db = await getDB();
  const collectionName = PROVIDER_COLLECTIONS[provider];
  if (!collectionName) return null;

  const collection = db.collection(collectionName);
  const doc = await collection.findOne({ instanceType });
  return doc;
}

export async function getProviderRegions(
  provider: Provider,
): Promise<string[]> {
  const db = await getDB();
  const collectionName = PROVIDER_COLLECTIONS[provider];
  if (!collectionName) return [];

  const collection = db.collection(collectionName);

  // Sample a few docs and extract the region keys from pricing
  const sample = await collection.findOne({});
  if (!sample?.pricing) return [];

  return Object.keys(sample.pricing as Record<string, any>).sort();
}
