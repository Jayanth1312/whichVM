/**
 * sync-azure.js
 *
 * Fetches Azure VM data from CloudPrice v2 API in parallel using up to 3 keys.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const KEYS = [
  process.env.CLOUDPRICE_AWS_KEY || process.env.CLOUDPRICE_KEY_1,
  process.env.CLOUDPRICE_AZURE_KEY,
  process.env.CLOUDPRICE_GCP_KEY,
].filter(Boolean);

if (KEYS.length === 0) {
  const fallback = process.env.CLOUDPRICE_AZURE_KEY || process.env.CLOUDPRICE_KEY;
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

let AZURE_REGIONS = [];
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
  const data = await apiFetch("/azure/vm/regions", KEYS[0]);
  const items = data?.Items ?? data ?? [];
  AZURE_REGIONS = items.map((r) =>
    typeof r === "string" ? r : (r.Region ?? r.region ?? r.name ?? r.Name),
  );
  return AZURE_REGIONS;
}

async function fetchPaymentTypes() {
  const data = await apiFetch("/azure/vm/payment-types", KEYS[0]);
  const items = data?.Items ?? data ?? [];
  const rawTypes = items.map((p) =>
    typeof p === "string" ? p : (p.PaymentType ?? p.paymentType ?? p.name ?? p.Name),
  );

  PAYMENT_CONFIGS = [];
  for (const pt of rawTypes) {
    PAYMENT_CONFIGS.push({
      key: pt,
      qs: { paymentType: pt },
      isBase: pt.toLowerCase() === "payasyougo",
    });
  }
  return PAYMENT_CONFIGS;
}

// ─── EXTRACT & MERGE SPECS ───
function extractBasicSpecs(item) {
  return {
    instanceType: item.name ?? null,
    instanceFamily: item.canonicalname ?? null,
    vCPUs: item.numberOfCores ?? null,
    memoryGiB: item.memoryInMB ? Math.round((item.memoryInMB / 1024) * 100) / 100 : null,
    processor: item.cpuDesc ?? null,
    architecture: item.cpuArchitecture ?? null,
    hasGPU: (item.gpUs ?? 0) > 0,
    gpuCount: item.gpUs ?? 0,
    gpuName: item.gpuType ?? null,
  };
}

function mergeDetailSpecs(basic, detail) {
  if (!detail) return basic;
  const d = detail.Instance ?? detail;
  const pick = (dv, bv) => (dv != null ? dv : bv);
  return {
    ...basic,
    instanceType: pick(d.name, basic.instanceType),
    instanceFamily: pick(d.canonicalname ?? d.InstanceFamily, basic.instanceFamily),
    vCPUs: pick(d.numberOfCores, basic.vCPUs),
    memoryGiB: d.memoryInMB ? Math.round((d.memoryInMB / 1024) * 100) / 100 : basic.memoryGiB,
    processor: pick(d.cpuDesc ?? d.CPUdesc ?? d.Processor, basic.processor),
  };
}

// ─── PIVOT AND WRITE ───
function pivotAndWrite(instanceMap) {
  const dir = path.join(OUTPUT_DIR, "azure");
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
    const rf = { provider: "azure", region, generatedAt: new Date().toISOString(), count: rows.length, instances: rows };
    fs.writeFileSync(path.join(dir, `${region}.json`), JSON.stringify(rf, null, 2));
    totalFiles++;
  }
  return totalFiles;
}

// ─── MAIN ───
async function main() {
  console.log(`\n  [Azure] Concurrency: ${KEYS.length} keys available`);
  await fetchRegions();
  await fetchPaymentTypes();

  const instanceMap = new Map();
  const tasks = [];
  for (const region of AZURE_REGIONS) {
    for (const payConf of PAYMENT_CONFIGS) {
      tasks.push({ region, payConf });
    }
  }

  console.log(`\n[Azure Pricing] Tasks: ${tasks.length}`);

  let taskIdx = 0;
  const runWorker = async (apiKey, workerId) => {
    while (taskIdx < tasks.length) {
      const currentIdx = taskIdx++;
      const { region, payConf } = tasks[currentIdx];
      try {
        const qs = buildQS({ region, currency: "USD", operatingSystem: "Linux", ...payConf.qs });
        const data = await apiFetch(`/azure/vm/instances?${qs}`, apiKey);
        if (data && data.Items) {
          for (const item of data.Items) {
            const instType = item.name;
            if (!instType) continue;

            if (!instanceMap.has(instType)) {
              instanceMap.set(instType, { specs: null, pricing: {} });
            }
            const entry = instanceMap.get(instType);
            if (payConf.isBase && !entry.specs) {
              entry.specs = extractBasicSpecs(item);
            }
            if (!entry.pricing[region]) entry.pricing[region] = {};

            if (item.linuxPrice != null) entry.pricing[region][`linux_${payConf.key}`] = item.linuxPrice;
            if (item.windowsPrice != null) entry.pricing[region][`windows_${payConf.key}`] = item.windowsPrice;
            if (item.ubuntuProPrice != null) entry.pricing[region][`ubuntu_${payConf.key}`] = item.ubuntuProPrice;
            if (item.slesPrice != null) entry.pricing[region][`sles_${payConf.key}`] = item.slesPrice;
            if (item.redHatEntPrice != null) entry.pricing[region][`rhel_${payConf.key}`] = item.redHatEntPrice;
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
  console.log(`\n[Azure Enrichment] Total: ${instancesToEnrich.length}`);

  const enrichWorker = async (apiKey, workerId) => {
    while (enrichIdx < instancesToEnrich.length) {
      const currentIdx = enrichIdx++;
      const it = instancesToEnrich[currentIdx];
      try {
        const detail = await apiFetch(`/azure/vm/instances/${encodeURIComponent(it)}`, apiKey);
        if (detail) {
          const entry = instanceMap.get(it);
          if (entry) {
            entry.specs = mergeDetailSpecs(entry.specs || {}, detail);

            if (detail.Prices) {
              for (const prItem of detail.Prices) {
                const rId = prItem.regionId;
                const pType = prItem.paymentType;
                if (rId && pType) {
                  if (!entry.pricing[rId]) entry.pricing[rId] = {};
                  if (prItem.linuxPrice != null) entry.pricing[rId][`linux_${pType}`] = prItem.linuxPrice;
                  if (prItem.windowsPrice != null) entry.pricing[rId][`windows_${pType}`] = prItem.windowsPrice;
                  if (prItem.ubuntuProPrice != null) entry.pricing[rId][`ubuntu_${pType}`] = prItem.ubuntuProPrice;
                  if (prItem.slesPrice != null) entry.pricing[rId][`sles_${pType}`] = prItem.slesPrice;
                  if (prItem.redHatEntPrice != null) entry.pricing[rId][`rhel_${pType}`] = prItem.redHatEntPrice;
                }
              }
            }
          }
        }
        process.stdout.write("+");
      } catch (e) {
        process.stdout.write("✗");
      }
      await sleep(CALL_DELAY_MS);
    }
  };
  await Promise.all(KEYS.map((key, i) => enrichWorker(key, i + 1)));

  console.log(`\n[Azure Write] Writing JSON files...`);
  const totalFiles = pivotAndWrite(instanceMap);
  console.log(`✓ Azure Sync Complete! Total regions written: ${totalFiles}`);
}

main().catch(console.error);
