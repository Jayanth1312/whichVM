import { Db, UpdateOneModel } from "mongodb";
import { getDB } from "../config/db";
import { RegionFile, Provider, InstanceRow } from "../types";

const PROVIDER_COLLECTIONS: Record<Provider, string> = {
  aws: "aws_ec2",
  azure: "azure_vm",
  gcp: "gcp_compute",
};

/**
 * Pushes in-memory RegionFiles into MongoDB collections using bulkWrite updates.
 * Pivots from Region-centric back to Instance-centric layout, keeping older region data intact.
 *
 * @param provider - AWS, Azure, GCP
 * @param regionFiles - Map of region index lists
 */
export async function pushToMongo(
  provider: Provider,
  regionFiles: Map<string, RegionFile>,
): Promise<void> {
  const db: Db = await getDB();
  const collectionName = PROVIDER_COLLECTIONS[provider];

  if (!collectionName) {
    console.warn(`[MongoPusher] Unknown provider mapping: ${provider}`);
    return;
  }

  const collection = db.collection(collectionName);

  // Pivot: region -> instanceType
  const instanceDocs = new Map<string, {
    instanceType: string;
    instanceFamily?: string;
    vCPUs?: number;
    memoryGiB?: number;
    processor?: string;
    architecture?: string;
    storage?: string;
    network?: string;
    hasGPU?: boolean;
    gpuCount?: number;
    gpuName?: string | null;
    pricing: Record<string, Record<string, number>>;
  }>();

  for (const [region, regionFile] of regionFiles) {
    for (const inst of regionFile.instances) {
      const type = inst.n;
      if (!type) continue;

      if (!instanceDocs.has(type)) {
        instanceDocs.set(type, {
          instanceType: type,
          instanceFamily: inst.f || "",
          vCPUs: typeof inst.v === "number" ? inst.v : parseFloat(inst.v as any) || 0,
          memoryGiB: typeof inst.m === "number" ? inst.m : parseFloat(inst.m as any) || 0,
          processor: inst.p || "",
          architecture: inst.a || "",
          storage: inst.s || "",
          network: inst.nw || "",
          hasGPU: inst.g || false,
          gpuCount: inst.gc || 0,
          gpuName: inst.gn || null,
          pricing: {},
        });
      }

      const doc = instanceDocs.get(type)!;
      doc.pricing[region] = inst.pr;
    }
  }

  const docs = Array.from(instanceDocs.values());
  if (docs.length === 0) {
    console.log(`[MongoPusher] No instances gathered for ${provider}. Skipping.`);
    return;
  }

  console.log(`[MongoPusher] Preparing bulkWrite for ${docs.length} instances into ${collectionName}`);

  const bulkOps = docs.map((doc) => {
    // 1. Core sets
    const setObj: any = {
      instanceType: doc.instanceType,
      instanceFamily: doc.instanceFamily,
      vCPUs: doc.vCPUs,
      memoryGiB: doc.memoryGiB,
      processor: doc.processor,
      architecture: doc.architecture,
      storage: doc.storage,
      network: doc.network,
      hasGPU: doc.hasGPU,
      gpuCount: doc.gpuCount,
      gpuName: doc.gpuName,
    };

    // 2. Add region pricing as individual keys to preserve existing other regions
    for (const [region, pricing] of Object.entries(doc.pricing)) {
      setObj[`pricing.${region}`] = pricing;
    }

    return {
      updateOne: {
        filter: { instanceType: doc.instanceType },
        update: { $set: setObj },
        upsert: true,
      } as UpdateOneModel<any>,
    };
  });

  try {
    const result = await collection.bulkWrite(bulkOps, { ordered: false });
    console.log(
      `[MongoPusher] ✓ ${provider}: Upserted: ${result.upsertedCount} | Modified: ${result.modifiedCount} instances.`
    );
  } catch (err: any) {
    console.error(`[MongoPusher] ❌ ${provider} bulkWrite failed:`, err.message);
  }
}
