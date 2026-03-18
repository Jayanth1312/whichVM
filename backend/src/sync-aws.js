/**
 * sync-aws.js
 *
 * Fetches AWS EC2 data from CloudPrice v2 API in parallel using up to 3 keys.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const KEYS = [
  process.env.CLOUDPRICE_AWS_KEY || process.env.CLOUDPRICE_KEY_1,
  process.env.CLOUDPRICE_AZURE_KEY,
  process.env.CLOUDPRICE_GCP_KEY,
].filter(Boolean);

if (KEYS.length === 0) {
  const fallback = process.env.CLOUDPRICE_AWS_KEY || process.env.CLOUDPRICE_KEY;
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

let AWS_REGIONS = [];
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
  const data = await apiQueue.fetch(`${BASE}/aws/ec2/regions`);
  const items = data?.Items ?? data ?? [];
  AWS_REGIONS = items.map((r) =>
    typeof r === "string" ? r : (r.Region ?? r.region ?? r.name ?? r.Name),
  );
  return AWS_REGIONS;
}

async function fetchPaymentTypes() {
  const data = await apiQueue.fetch(`${BASE}/aws/ec2/payment-types`);
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
    instanceType: item.InstanceType ?? item.name ?? null,
    instanceFamily: item.InstanceFamily ?? item.canonicalname ?? null,
    vCPUs: item.ProcessorVCPUCount ?? item.numberOfCores ?? null,
    memoryGiB: item.MemorySizeInMB ? Math.round((item.MemorySizeInMB / 1024) * 100) / 100 : null,
    processor: item.Processor ?? item.cpuDesc ?? null,
    architecture: Array.isArray(item.ProcessorArchitecture) ? item.ProcessorArchitecture.join(", ") : (item.ProcessorArchitecture ?? item.cpuArchitecture ?? null),
    storage: item.InstanceStorage ?? (item.InstanceStorageSupport ? "EBS only" : null),
    network: item.NetworkingPerformance ?? "",
    hasGPU: item.HasGPU ?? false,
    gpuCount: item.GPUCount ?? 0,
    gpuName: item.GPUName ?? null,
  };
}

function mergeDetailSpecs(basic, detail) {
  if (!detail) return basic;
  const d = detail.Instance ?? detail;
  const pick = (dv, bv) => (dv != null ? dv : bv);
  return {
    ...basic,
    instanceType: pick(d.InstanceType, basic.instanceType),
    vCPUs: pick(d.ProcessorVCPUCount, basic.vCPUs),
    memoryGiB: d.MemorySizeInMB ? Math.round((d.MemorySizeInMB / 1024) * 100) / 100 : basic.memoryGiB,
    processor: pick(d.Processor, basic.processor),
    storage: pick(d.InstanceStorage, basic.storage),
    network: pick(d.NetworkingPerformance, basic.network),
  };
}

// ─── PIVOT AND WRITE ───
function pivotAndWrite(instanceMap) {
  const providerDir = path.join(OUTPUT_DIR, "aws");
  fs.mkdirSync(providerDir, { recursive: true });
  const regionRows = new Map();

  for (const [instanceType, { specs, pricing }] of instanceMap) {
    if (!specs) continue;
    for (const [region, regionPricing] of Object.entries(pricing)) {
      const pr = {};
      for (const [key, val] of Object.entries(regionPricing)) {
        if (typeof val === "number" && val > 0) pr[key] = val;
      }
      if (Object.keys(pr).length === 0) continue;
      const row = {
        n: specs.instanceType || instanceType,
        f: specs.instanceFamily || "",
        v: specs.vCPUs || 0,
        m: specs.memoryGiB || 0,
        p: specs.processor || "",
        a: specs.architecture || "",
        s: specs.storage || "",
        nw: specs.network || "",
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
    const regionFile = { provider: "aws", region, generatedAt: new Date().toISOString(), count: rows.length, instances: rows };
    fs.writeFileSync(path.join(providerDir, `${region}.json`), JSON.stringify(regionFile, null, 2));
    totalFiles++;
  }
  return totalFiles;
}

// ─── MAIN ───
async function main() {
  console.log(`\n  [AWS] Concurrency: ${KEYS.length} keys available`);
  await fetchRegions();
  await fetchPaymentTypes();

  const instanceMap = new Map();
  const tasks = [];
  for (const region of AWS_REGIONS) {
    for (const payConf of PAYMENT_CONFIGS) {
      tasks.push({ region, payConf });
    }
  }

  console.log(`\n[AWS Pricing] Tasks: ${tasks.length}`);

  const startTime = Date.now();

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
      const data = await apiQueue.fetch(`${BASE}/aws/ec2/instances?${qs}`);
      if (data && data.Items) {
        for (const item of data.Items) {
          const instanceType = item.InstanceType;
          if (!instanceType) continue;

          if (!instanceMap.has(instanceType)) {
            instanceMap.set(instanceType, { specs: null, pricing: {} });
          }
          const entry = instanceMap.get(instanceType);
          if (!entry.specs) entry.specs = extractBasicSpecs(item);

          const price = item.PricePerHour;
          if (price != null) {
            if (!entry.pricing[region]) entry.pricing[region] = {};
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

  const instancesToEnrich = [...instanceMap.keys()];
  let enrichIdx = 0;

  console.log(`\n[AWS Enrichment] Total: ${instancesToEnrich.length}`);

  await runTasksWithLimit(instancesToEnrich, 50, async (it) => {
    try {
      const detail = await apiQueue.fetch(`${BASE}/aws/ec2/instances/${encodeURIComponent(it)}`);
      if (detail) {
        const entry = instanceMap.get(it);
        if (entry) entry.specs = mergeDetailSpecs(entry.specs, detail);
        process.stdout.write("+");
      }
    } catch (e) {
      process.stdout.write("✗");
    }
  });

  console.log(`\n[AWS Write] Writing JSON files...`);
  const totalFiles = pivotAndWrite(instanceMap);
  console.log(`✓ AWS Sync Complete! Total regions written: ${totalFiles}`);
}

main().catch(console.error);
