const requireFresh = process.argv.includes("--fresh");
const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

// Support 3 distinct CloudPrice API Keys for parallel fetching Concurrency
const KEYS = [
  process.env.CLOUDPRICE_AWS_KEY || process.env.CLOUDPRICE_KEY_1,
  process.env.CLOUDPRICE_AZURE_KEY || process.env.CLOUDPRICE_KEY_2,
  process.env.CLOUDPRICE_GCP_KEY || process.env.CLOUDPRICE_KEY_3,
].filter(Boolean);

if (KEYS.length === 0) {
  // Fallback to absolute default if no numbered list found
  const fallback = process.env.CLOUDPRICE_AWS_KEY || process.env.CLOUDPRICE_KEY;
  if (fallback) KEYS.push(fallback);
  else {
    console.error("ERROR: No CLOUDPRICE API keys found in .env (Add CLOUDPRICE_KEY_1, _2, _3)");
    process.exit(1);
  }
}

const BASE = process.env.CLOUDPRICE_BASE_URL || "https://data.cloudprice.net/api/v2";
const OUTPUT_DIR = path.join(__dirname, "../output");

console.log(`\n  [Config] Parallel Concurrency: ${KEYS.length} keys`);

const CALL_DELAY_MS = 250; // Delay set smaller per worker to optimize totals
const RATE_LIMIT_WAITS = [5000, 15000, 30000, 60000];

let AWS_REGIONS = [];
let PAYMENT_CONFIGS = [];

async function apiFetch(pathWithQS, apiKey) {
  const url = `${BASE}${pathWithQS}`;
  for (let attempt = 0; attempt <= RATE_LIMIT_WAITS.length; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "subscription-key": apiKey, Accept: "application/json" },
      });
      if (res.status === 429) {
         const wait = RATE_LIMIT_WAITS[attempt] || 30000;
         await new Promise(r => setTimeout(r, wait));
         continue;
      }
      if (res.status === 500) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json?.Status !== "ok") return null;
      return json.Data;
    } catch (e) {
      if (attempt >= RATE_LIMIT_WAITS.length) throw e;
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

async function fetchRegions() {
  const data = await apiFetch("/aws/ec2/regions", KEYS[0]);
  const items = data?.Items ?? data ?? [];
  AWS_REGIONS = items.map(r => typeof r === "string" ? r : (r.Region ?? r.region ?? r.name));
  return AWS_REGIONS;
}

async function fetchPaymentTypes() {
  const data = await apiFetch("/aws/ec2/payment-types", KEYS[0]);
  const items = data?.Items ?? data ?? [];
  const rawTypes = items.map(p => typeof p === "string" ? p : (p.PaymentType ?? p.paymentType ?? p.name));
  PAYMENT_CONFIGS = [];
  for (const pt of rawTypes) {
    PAYMENT_CONFIGS.push({ key: `linux${pt}`, qs: { operatingSystem: "Linux", paymentType: pt } });
    PAYMENT_CONFIGS.push({ key: `windows${pt}`, qs: { operatingSystem: "Windows", paymentType: pt } });
  }
  return PAYMENT_CONFIGS;
}

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

function buildQS(params) {
  return Object.entries(params)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
}

async function main() {
  await fetchRegions();
  await fetchPaymentTypes();

  const instanceMap = new Map();
  const tasks = [];
  for (const region of AWS_REGIONS) {
    for (const payConf of PAYMENT_CONFIGS) {
      tasks.push({ region, payConf });
    }
  }

  console.log(`\n[Phase 3] Total Pricing Tasks: ${tasks.length}`);

  let taskIdx = 0;
  const runWorker = async (apiKey, workerId) => {
    while (taskIdx < tasks.length) {
      const currentIdx = taskIdx++;
      const { region, payConf } = tasks[currentIdx];
      try {
        const qs = buildQS({ region, currency: "USD", ...payConf.qs });
        const data = await apiFetch(`/aws/ec2/instances?${qs}`, apiKey);
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
        console.error(`\n[Worker ${workerId}] Error task ${currentIdx}: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, CALL_DELAY_MS));
    }
  };

  // Run 3 workers in Parallel
  const startTime = Date.now();
  await Promise.all(KEYS.map((key, i) => runWorker(key, i + 1)));
  console.log(`\n Pricing Phase Took: ${Math.round((Date.now() - startTime)/1000)}s`);

  // Phase 4: Enrich Specs Parallel
  const instancesToEnrich = [...instanceMap.keys()];
  console.log(`\n[Phase 4] Enriching ${instancesToEnrich.length} instances`);

  let enrichIdx = 0;
  const enrichWorker = async (apiKey, workerId) => {
    while (enrichIdx < instancesToEnrich.length) {
      const currentIdx = enrichIdx++;
      const it = instancesToEnrich[currentIdx];
      try {
         const detail = await apiFetch(`/aws/ec2/instances/${encodeURIComponent(it)}`, apiKey);
         if (detail) {
            const entry = instanceMap.get(it);
            if (entry) entry.specs = mergeDetailSpecs(entry.specs, detail);
         }
         process.stdout.write("+");
      } catch (e) {}
      await new Promise(r => setTimeout(r, CALL_DELAY_MS));
    }
  };
  await Promise.all(KEYS.map((key, i) => enrichWorker(key, i + 1)));

  // Phase 5: Pivot & Write
  console.log(`\n[Phase 5] Writing JSON files to disk...`);
  const totalFiles = pivotAndWrite(instanceMap);
  console.log(`\n✓ AWS Sync Complete! Total files written: ${totalFiles}`);
}

main().catch(console.error);
