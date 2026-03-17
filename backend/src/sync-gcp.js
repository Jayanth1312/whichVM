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

const CALL_DELAY_MS = 250;
const RATE_LIMIT_WAITS = [5000, 15000, 30000, 60000];

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

// ─── API FETCH ───
async function apiFetch(pathWithQS, apiKey) {
  const url = `${BASE}${pathWithQS}`;

  for (let attempt = 0; attempt <= RATE_LIMIT_WAITS.length; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "subscription-key": apiKey,
          Accept: "application/json",
        },
      });

      if (res.status === 429) {
        const wait = RATE_LIMIT_WAITS[attempt] || 30000;
        await sleep(wait);
        continue;
      }

      if (res.status === 500) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      if (json?.Status !== "ok") throw new Error("Non-ok status");
      return json.Data;
    } catch (e) {
      if (attempt >= RATE_LIMIT_WAITS.length) throw e;
      await sleep(5000);
    }
  }
}

// ─── METADATA FETCHERS ───
async function fetchRegions() {
  const data = await apiFetch("/gcp/compute/regions", KEYS[0]);
  const items = data?.Items ?? data ?? [];
  GCP_REGIONS = items.map((r) =>
    typeof r === "string" ? r : (r.Region ?? r.region ?? r.name ?? r.Name),
  );
  return GCP_REGIONS;
}

async function fetchPaymentTypes() {
  const data = await apiFetch("/gcp/compute/payment-types", KEYS[0]);
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

  let taskIdx = 0;
  const runWorker = async (apiKey, workerId) => {
    while (taskIdx < tasks.length) {
      const currentIdx = taskIdx++;
      const { region, payConf } = tasks[currentIdx];
      try {
        const qs = buildQS({ region, currency: "USD", ...payConf.qs });
        const data = await apiFetch(`/gcp/compute/instances?${qs}`, apiKey);
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
      await sleep(CALL_DELAY_MS);
    }
  };

  const startTime = Date.now();
  await Promise.all(KEYS.map((key, i) => runWorker(key, i + 1)));
  console.log(`\n Pricing took: ${Math.round((Date.now() - startTime)/1000)}s`);

  // Enrichment
  const instancesToEnrich = [...instanceMap.keys()];
  let enrichIdx = 0;
  console.log(`\n[GCP Enrichment] Total: ${instancesToEnrich.length}`);

  const enrichWorker = async (apiKey, workerId) => {
    while (enrichIdx < instancesToEnrich.length) {
      const currentIdx = enrichIdx++;
      const it = instancesToEnrich[currentIdx];
      try {
        const detail = await apiFetch(`/gcp/compute/instances/${encodeURIComponent(it)}`, apiKey);
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
      await sleep(CALL_DELAY_MS);
    }
  };
  await Promise.all(KEYS.map((key, i) => enrichWorker(key, i + 1)));

  console.log(`\n[GCP Write] Writing JSON files...`);
  const totalFiles = pivotAndWrite(instanceMap);
  console.log(`✓ GCP Sync Complete! Total regions written: ${totalFiles}`);
}

main().catch(console.error);
