/**
 * sync-gcp.js
 *
 * Fetches GCP Compute data from CloudPrice v2 API in parallel using up to 3 keys.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const KEYS = [
  process.env.CLOUDPRICE_AWS_KEY || process.env.CLOUDPRICE_KEY_1,
  process.env.CLOUDPRICE_AZURE_KEY,
  process.env.CLOUDPRICE_GCP_KEY,
].filter(Boolean);

if (KEYS.length === 0) {
  const fallback = process.env.CLOUDPRICE_GCP_KEY || process.env.CLOUDPRICE_KEY;
  if (fallback) KEYS.push(fallback);
  else {
    console.error("ERROR: No CLOUDPRICE API keys found in .env");
    process.exit(1);
  }
}

const fs = require("fs");
const path = require("path");

const BASE = process.env.CLOUDPRICE_BASE_URL || "https://data.cloudprice.net/api/v2";
const OUTPUT_DIR = path.join(__dirname, "../output");

const { ApiQueue } = require("./utils/api-queue");
const apiQueue = new ApiQueue(KEYS, 100);

let GCP_REGIONS = [];
let PAYMENT_CONFIGS = [];

// ─── HELPER ───
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildQS(params) {
  return Object.entries(params)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
}

// ─── METADATA FETCHERS ───
async function fetchRegions() {
  const data = await apiQueue.fetch(`${BASE}/gcp/compute/regions`);
  const items = data?.Items ?? data ?? [];
  GCP_REGIONS = items.map((r) =>
    typeof r === "string" ? r : (r.Region ?? r.region ?? r.name ?? r.Name),
  );
  return GCP_REGIONS;
}

async function fetchPaymentTypes() {
  const data = await apiQueue.fetch(`${BASE}/gcp/compute/payment-types`);
  const items = data?.Items ?? data ?? [];
  const rawTypes = items.map((p) =>
    typeof p === "string" ? p : (p.PaymentType ?? p.paymentType ?? p.name ?? p.Name),
  );

  PAYMENT_CONFIGS = [];
  for (const pt of rawTypes) {
    PAYMENT_CONFIGS.push({
      key: `linux${pt}`,
      qs: { operatingSystem: "Linux", paymentType: pt },
    });
    PAYMENT_CONFIGS.push({
      key: `windows${pt}`,
      qs: { operatingSystem: "Windows", paymentType: pt },
    });
  }
  return PAYMENT_CONFIGS;
}

// ─── EXTRACT & MERGE SPECS ───
function extractBasicSpecs(item) {
  return {
    instanceType: item.InstanceType ?? null,
    instanceFamily: item.InstanceFamily ?? null,
    instanceFamilyName: item.InstanceFamilyName ?? null,
    vCPUs: item.ProcessorVCPUCount ?? null,
    memoryGiB: item.MemorySizeInMB ? Math.round((item.MemorySizeInMB / 1024) * 100) / 100 : null,
    processor: item.Processor ?? null,
    architecture: item.ProcessorArchitecture ?? null,
    hasGPU: item.HasGPU ?? false,
    gpuCount: item.GPUCount ?? 0,
    gpuName: item.GPUType ?? null,
  };
}

function mergeDetailSpecs(basic, detail) {
  if (!detail) return basic;
  const d = detail.Instance ?? detail;
  const pick = (dv, bv) => (dv != null ? dv : bv);
  return {
    ...basic,
    instanceType: pick(d.InstanceType, basic.instanceType),
    instanceFamily: pick(d.InstanceFamily, basic.instanceFamily),
    vCPUs: pick(d.ProcessorVCPUCount, basic.vCPUs),
    memoryGiB: d.MemorySizeInMB ? Math.round((d.MemorySizeInMB / 1024) * 100) / 100 : basic.memoryGiB,
    processor: pick(d.Processor, basic.processor),
  };
}

// ─── PIVOT AND WRITE ───
function pivotAndWrite(instanceMap) {
  const dir = path.join(OUTPUT_DIR, "gcp");
  fs.mkdirSync(dir, { recursive: true });
  const regionRows = new Map();

  for (const [instType, { specs, pricing }] of instanceMap) {
    if (!specs) continue;
    for (const [region, rp] of Object.entries(pricing)) {
      const pr = {};
      for (const [k, v] of Object.entries(rp)) {
        if (typeof v === "number" && v > 0) pr[k] = v;
      }
      if (!Object.keys(pr).length) continue;

      const row = {
        n: specs.instanceType || instType,
        f: specs.instanceFamily || "",
        v: specs.vCPUs || 0,
        m: specs.memoryGiB || 0,
        p: specs.processor || "",
        a: specs.architecture || "",
        s: "",
        nw: "",
        g: specs.hasGPU || false,
        gc: specs.gpuCount || 0,
        gn: specs.gpuName || null,
        pr,
      };

      if (!regionRows.has(region)) regionRows.set(region, []);
      regionRows.get(region).push(row);
    }
  }

  let totalFiles = 0;
  for (const [region, rows] of regionRows) {
    rows.sort((a, b) => a.n.localeCompare(b.n));
    const rf = { provider: "gcp", region, generatedAt: new Date().toISOString(), count: rows.length, instances: rows };
    fs.writeFileSync(path.join(dir, `${region}.json`), JSON.stringify(rf, null, 2));
    totalFiles++;
  }
  return totalFiles;
}

// ─── MAIN ───
async function main() {
  console.log(`\n  [GCP] Concurrency: ${KEYS.length} keys available`);
  await fetchRegions();
  await fetchPaymentTypes();

  const instanceMap = new Map();
  const tasks = [];
  for (const region of GCP_REGIONS) {
    for (const payConf of PAYMENT_CONFIGS) {
      tasks.push({ region, payConf });
    }
  }

  console.log(`\n[GCP Pricing] Tasks: ${tasks.length}`);

  const startTime = Date.now();

  // Run all tasks concurrently through the rate-limited queue.
  // We can use a concurrency limit (e.g. 20) to avoid building too massive a promise array,
  // but since we rely on `apiQueue`, we can just map them and `Promise.all`.
  // To avoid huge memory spikes, let's chunk them or just fire them all if it's < 10000.
  // Let's use a simple concurrency bound mapper:

  async function runTasksWithLimit(taskList, limit, workerFn) {
    const results = [];
    const executing = [];
    for (const item of taskList) {
      const p = Promise.resolve().then(() => workerFn(item));
      results.push(p);
      if (limit <= taskList.length) {
        const e = p.then(() => executing.splice(executing.indexOf(e), 1));
        executing.push(e);
        if (executing.length >= limit) {
          await Promise.race(executing);
        }
      }
    }
    return Promise.all(results);
  }

  await runTasksWithLimit(tasks, 50, async ({ region, payConf }) => {
    try {
      const qs = buildQS({ region, currency: "USD", ...payConf.qs });
      const data = await apiQueue.fetch(`${BASE}/gcp/compute/instances?${qs}`);
      if (data && data.Items) {
        for (const item of data.Items) {
          const instType = item.InstanceType;
          if (!instType) continue;

          if (!instanceMap.has(instType)) {
            instanceMap.set(instType, { specs: null, pricing: {} });
          }
          const entry = instanceMap.get(instType);
          if (!entry.specs) {
            entry.specs = extractBasicSpecs(item);
          }
          if (!entry.pricing[region]) entry.pricing[region] = {};

          const price = item.PricePerHour;
          if (price != null) {
            entry.pricing[region][payConf.key] = price;
          }
        }
      }
      process.stdout.write(".");
    } catch (e) {
      process.stdout.write("✗");
    }
  });

  console.log(`\n Pricing took: ${Math.round((Date.now() - startTime)/1000)}s`);

  // Enrichment
  const instancesToEnrich = [...instanceMap.keys()];
  let enrichIdx = 0;
  console.log(`\n[GCP Enrichment] Total: ${instancesToEnrich.length}`);

  await runTasksWithLimit(instancesToEnrich, 50, async (it) => {
    try {
      const detail = await apiQueue.fetch(`${BASE}/gcp/compute/instances/${encodeURIComponent(it)}`);
      if (detail) {
        const entry = instanceMap.get(it);
        if (entry) {
          entry.specs = mergeDetailSpecs(entry.specs || {}, detail);
        }
        process.stdout.write("+");
      }
    } catch (e) {
      process.stdout.write("✗");
    }
  });

  console.log(`\n[GCP Write] Writing JSON files...`);
  const totalFiles = pivotAndWrite(instanceMap);
  console.log(`✓ GCP Sync Complete! Total regions written: ${totalFiles}`);
}

main().catch(console.error);
