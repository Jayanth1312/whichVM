/**
 * sync-azure.js
 *
 * Fetches Azure VM data from CloudPrice v2 API → writes per-region JSON files.
 *
 * Phases:
 *   Phase 1 — Metadata (regions, payment types)
 *   Phase 2 — Pricing across all regions (main loop)
 *   Phase 3 — Per-instance detail enrichment (full hardware specs)
 *   Phase 4 — Pivot to per-region JSON & write
 *
 * Usage:
 *   node src/sync-azure.js
 *   node src/sync-azure.js --fresh
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const CLOUDPRICE_KEY = process.env.CLOUDPRICE_AZURE_KEY || process.env.CLOUDPRICE_KEY;
if (!CLOUDPRICE_KEY) {
  console.error("ERROR: CLOUDPRICE_AZURE_KEY or CLOUDPRICE_KEY not set in .env");
  process.exit(1);
}

const fs = require("fs");
const path = require("path");

const BASE =
  process.env.CLOUDPRICE_BASE_URL || "https://data.cloudprice.net/api/v2";
const OUTPUT_DIR = path.join(__dirname, "../output");

const CALL_DELAY_MS = 600;
const RATE_LIMIT_WAITS = [10000, 20000, 40000, 60000, 120000];

let AZURE_REGIONS = [];
let PAYMENT_CONFIGS = [];

// ─── METADATA FETCHERS ───────────────────────────────────────────────────────

async function fetchRegions() {
  console.log("  Fetching regions from /azure/vm/regions...");
  const data = await apiFetch("/azure/vm/regions");
  const items = data?.Items ?? data ?? [];
  AZURE_REGIONS = items.map((r) =>
    typeof r === "string" ? r : (r.Region ?? r.region ?? r.name ?? r.Name),
  );
  console.log(`  ✓ ${AZURE_REGIONS.length} regions loaded`);
  return AZURE_REGIONS;
}

async function fetchPaymentTypes() {
  console.log("  Fetching payment types from /azure/vm/payment-types...");
  const data = await apiFetch("/azure/vm/payment-types");
  const items = data?.Items ?? data ?? [];
  const rawTypes = items.map((p) =>
    typeof p === "string"
      ? p
      : (p.PaymentType ?? p.paymentType ?? p.name ?? p.Name),
  );
  console.log(`  ✓ ${rawTypes.length} payment types loaded`);

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

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildQS(params) {
  return Object.entries(params)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
}


// ─── API FETCH ────────────────────────────────────────────────────────────────
async function apiFetch(pathWithQS) {
  const url = `${BASE}${pathWithQS}`;
  for (let attempt = 0; attempt <= RATE_LIMIT_WAITS.length; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        headers: {
          "subscription-key": CLOUDPRICE_KEY,
          Accept: "application/json",
        },
      });
    } catch (e) {
      if (attempt >= RATE_LIMIT_WAITS.length) throw e;
      await sleep(RATE_LIMIT_WAITS[attempt]);
      continue;
    }
    if (res.status === 429) {
      if (attempt >= RATE_LIMIT_WAITS.length) throw new Error("Rate limited");
      const w = res.headers.get("retry-after")
        ? parseInt(res.headers.get("retry-after")) * 1000
        : RATE_LIMIT_WAITS[attempt];
      console.warn(`\n    [429] waiting ${w / 1000}s...`);
      await sleep(w);
      continue;
    }
    if (res.status === 500) return null;
    if (!res.ok) {
      const b = await res.text();
      throw new Error(`HTTP ${res.status}: ${b.slice(0, 200)}`);
    }
    const json = await res.json();
    if (json?.Status !== "ok")
      throw new Error(`Non-ok: ${JSON.stringify(json).slice(0, 150)}`);
    return json.Data;
  }
}

// ─── EXTRACT SPECS ────────────────────────────────────────────────────────────

/**
 * Extract basic specs from the bulk listing endpoint.
 */
function extractBasicSpecs(item) {
  return {
    instanceType: item.name ?? null,
    instanceFamily: item.canonicalname ?? null,
    vCPUs: item.numberOfCores ?? null,
    memoryGiB: item.memoryInMB
      ? Math.round((item.memoryInMB / 1024) * 100) / 100
      : null,
    processor: item.cpuDesc ?? null,
    architecture: item.cpuArchitecture ?? null,
    hasGPU: (item.gpUs ?? 0) > 0,
    gpuCount: item.gpUs ?? 0,
    gpuName: item.gpuType ?? null,
    // Placeholders for detail enrichment
    gpuRAM: null,
    gpuTotalRAM: null,
    perfScore: null,
    acus: null,
    hyperVGen: null,
    maxNetInterfaces: null,
    acceleratedNet: null,
    rdmaEnabled: null,
    combinedIOPS: null,
    uncachedDiskIOPS: null,
    osDiskSizeMB: null,
    resourceDiskSizeMB: null,
    maxDataDiskCount: null,
    supportPremiumDisk: null,
    numaNodes: null,
  };
}

/**
 * Merge detailed specs from /azure/vm/instances/{instance_type}
 * This endpoint returns ALL hardware details for Azure VMs.
 */
function mergeDetailSpecs(basic, detail) {
  if (!detail) return basic;
  const d = detail.Instance ?? detail;
  const pick = (dv, bv) => (dv != null ? dv : bv);

  return {
    ...basic,
    // ── Identity ──
    instanceType: pick(d.name, basic.instanceType),
    instanceFamily: pick(
      d.canonicalname ?? d.InstanceFamily,
      basic.instanceFamily,
    ),

    // ── Compute ──
    vCPUs: pick(d.numberOfCores, basic.vCPUs),
    memoryGiB: d.memoryInMB
      ? Math.round((d.memoryInMB / 1024) * 100) / 100
      : basic.memoryGiB,
    processor: pick(d.cpuDesc ?? d.CPUdesc ?? d.Processor, basic.processor),
    architecture: pick(
      d.cpuArchitecture ?? d.CpuArchitecture ?? d.ProcessorArchitecture,
      basic.architecture,
    ),
    perfScore: pick(d.perfScore ?? d.PerfScore, basic.perfScore),
    acus: pick(d.acus ?? d.ACUs, basic.acus),
    hyperVGen: pick(d.hyperVGen ?? d.HyperVGen, basic.hyperVGen),
    numaNodes: pick(d.numaNodes ?? d.NUMAnodes, basic.numaNodes),

    // ── Storage ──
    osDiskSizeMB: pick(
      d.osDiskSizeInMB ?? d.osDiskSizeMB,
      basic.osDiskSizeMB,
    ),
    resourceDiskSizeMB: pick(
      d.resourceDiskSizeInMB ?? d.resourceDiskSizeMB,
      basic.resourceDiskSizeMB,
    ),
    maxDataDiskCount: pick(
      d.maxDataDiskCount ?? d.MaxDataDiskCount,
      basic.maxDataDiskCount,
    ),
    supportPremiumDisk: pick(
      d.supportPremiumDisk ?? d.SupportPremiumDisk,
      basic.supportPremiumDisk,
    ),
    combinedIOPS: pick(
      d.combinedIOPS ?? d.CombinedIOPS,
      basic.combinedIOPS,
    ),
    uncachedDiskIOPS: pick(
      d.uncachedDiskIOPS ?? d.UncachedDiskIOPS,
      basic.uncachedDiskIOPS,
    ),

    // ── Network ──
    maxNetInterfaces: pick(
      d.maxNetInter ?? d.MaxNetInter ?? d.maxNetInterfaces,
      basic.maxNetInterfaces,
    ),
    acceleratedNet: pick(
      d.acceleratedNet ?? d.AcceleratedNet,
      basic.acceleratedNet,
    ),
    rdmaEnabled: pick(d.rdmaEnabled ?? d.RdmaEnabled, basic.rdmaEnabled),

    // ── GPU ──
    hasGPU: pick((d.gpUs ?? d.GPUs ?? 0) > 0, basic.hasGPU),
    gpuCount: pick(d.gpUs ?? d.GPUs, basic.gpuCount),
    gpuName: pick(d.gpuType ?? d.GpuType, basic.gpuName),
    gpuRAM: pick(d.gpuRAM ?? d.GpuRAM, basic.gpuRAM),
    gpuTotalRAM: pick(d.gpuTotalRAM ?? d.GpuTotalRAM, basic.gpuTotalRAM),
  };
}

// ─── STATE MANAGEMENT (Resume capability) ───────────────────────────────────
const PROGRESS_FILE = path.join(OUTPUT_DIR, "azure", "progress.json");
const CHECKPOINT_FILE = path.join(OUTPUT_DIR, "azure", "checkpoint.json");

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
    } catch (e) {
      return {};
    }
  }
  return {};
}

function saveProgress(data) {
  fs.mkdirSync(path.dirname(PROGRESS_FILE), { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2));
}

function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      const arr = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf-8"));
      return new Map(arr);
    } catch (e) {
      return new Map();
    }
  }
  return new Map();
}

function saveCheckpoint(map) {
  fs.mkdirSync(path.dirname(CHECKPOINT_FILE), { recursive: true });
  const arr = Array.from(map.entries());
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(arr, null, 2));
}

function clearProgress() {
  if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
  if (fs.existsSync(CHECKPOINT_FILE)) fs.unlinkSync(CHECKPOINT_FILE);
}

// ─── PIVOT & WRITE ────────────────────────────────────────────────────────────
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
        // ── Core fields (backward compatible) ──
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
        // ── Extended hardware fields ──
        ps: specs.perfScore || null,
        acu: specs.acus || null,
        hv: specs.hyperVGen || null,
        ni: specs.maxNetInterfaces || null,
        an: specs.acceleratedNet || null,
        rd: specs.rdmaEnabled || null,
        ci: specs.combinedIOPS || null,
        ui: specs.uncachedDiskIOPS || null,
        od: specs.osDiskSizeMB || null,
        rds: specs.resourceDiskSizeMB || null,
        md: specs.maxDataDiskCount || null,
        pd: specs.supportPremiumDisk || null,
        gr: specs.gpuRAM || null,
        gtr: specs.gpuTotalRAM || null,
        nm: specs.numaNodes || null,
      };

      if (!regionRows.has(region)) regionRows.set(region, []);
      regionRows.get(region).push(row);
    }
  }

  let totalFiles = 0,
    totalRows = 0;
  for (const [region, rows] of regionRows) {
    rows.sort((a, b) => a.n.localeCompare(b.n));
    const rf = {
      provider: "azure",
      region,
      generatedAt: new Date().toISOString(),
      count: rows.length,
      instances: rows,
    };
    fs.writeFileSync(
      path.join(dir, `${region}.json`),
      JSON.stringify(rf, null, 2),
    );
    totalFiles++;
    totalRows += rows.length;
  }
  return { totalFiles, totalRows };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const isFresh = process.argv.includes("--fresh");

  console.log("═".repeat(68));
  console.log("  Azure VM → JSON Sync   (CloudPrice v2 API)");
  console.log("═".repeat(68));
  if (isFresh) {
    clearProgress();
    console.log("  --fresh: starting from scratch.");
  }

  // ── Phase 1: Fetch metadata ─────────────────────────────────────────
  console.log("\n[1/4] Fetching metadata...");
  await fetchRegions();
  await sleep(CALL_DELAY_MS);
  await fetchPaymentTypes();
  await sleep(CALL_DELAY_MS);

  const progress = loadProgress();
  const completedSet = new Set(progress.completedRegions ?? []);
  const enrichedSet = new Set(progress.enrichedInstances ?? []);
  const pendingRegions = AZURE_REGIONS.filter((r) => !completedSet.has(r));

  // ── Phase 2: Pricing ────────────────────────────────────────────────
  console.log(
    `\n[2/4] Pricing: ${AZURE_REGIONS.length} regions × ${PAYMENT_CONFIGS.length} payment types`,
  );
  console.log(
    `      Done: ${completedSet.size} | Pending: ${pendingRegions.length}`,
  );

  const instanceMap = loadCheckpoint();
  let apiCalls = 0,
    errors = 0;

  for (const region of pendingRegions) {
    process.stdout.write(`  ${region.padEnd(26)}`);
    for (const payConf of PAYMENT_CONFIGS) {
      let data;
      try {
        data = await apiFetch(
          `/azure/vm/instances?${buildQS({ region, currency: "USD", operatingSystem: "Linux", ...payConf.qs })}`,
        );
        apiCalls++;
      } catch (err) {
        errors++;
        process.stdout.write("✗");
        await sleep(CALL_DELAY_MS);
        continue;
      }
      if (data === null) {
        process.stdout.write("-");
        await sleep(CALL_DELAY_MS);
        continue;
      }

      for (const item of data?.Items || []) {
        const instType = item.name;
        if (!instType) continue;
        if (!instanceMap.has(instType))
          instanceMap.set(instType, { specs: null, pricing: {} });
        const entry = instanceMap.get(instType);
        if (payConf.isBase && !entry.specs)
          entry.specs = extractBasicSpecs(item);
        if (!entry.pricing[region]) entry.pricing[region] = {};
        if (item.linuxPrice != null)
          entry.pricing[region][`linux_${payConf.key}`] = item.linuxPrice;
        if (item.windowsPrice != null)
          entry.pricing[region][`windows_${payConf.key}`] = item.windowsPrice;
        if (item.ubuntuProPrice != null)
          entry.pricing[region][`ubuntu_${payConf.key}`] = item.ubuntuProPrice;
        if (item.slesPrice != null)
          entry.pricing[region][`sles_${payConf.key}`] = item.slesPrice;
        if (item.redHatEntPrice != null)
          entry.pricing[region][`rhel_${payConf.key}`] = item.redHatEntPrice;
      }
      process.stdout.write(".");
      await sleep(CALL_DELAY_MS);
    }
    completedSet.add(region);
    saveProgress({
      completedRegions: [...completedSet],
      enrichedInstances: [...enrichedSet],
    });
    saveCheckpoint(instanceMap);
    process.stdout.write("\n");
  }

  console.log(
    `\n  Pricing done — ${apiCalls} calls, ${errors} errors, ${instanceMap.size} instances`,
  );

  // ── Phase 3: Detail enrichment ──────────────────────────────────────
  const allTypes = [...instanceMap.keys()];
  const pendingEnrich = allTypes.filter((t) => !enrichedSet.has(t));
  console.log(
    `\n[3/4] Enrichment: ${pendingEnrich.length} instances to fetch detailed specs`,
  );
  let enrichCalls = 0,
    enriched = 0;

  for (let i = 0; i < pendingEnrich.length; i++) {
    const it = pendingEnrich[i];
    if (i % 50 === 0)
      process.stdout.write(`\n  [${i}/${pendingEnrich.length}] `);
    let detail;
    try {
      detail = await apiFetch(`/azure/vm/instances/${encodeURIComponent(it)}`);
      enrichCalls++;
    } catch (e) {
      process.stdout.write("✗");
      await sleep(CALL_DELAY_MS);
      continue;
    }
    if (detail === null) {
      process.stdout.write(".");
      enrichedSet.add(it);
      await sleep(CALL_DELAY_MS);
      continue;
    }
    const entry = instanceMap.get(it);
    if (entry) {
      entry.specs = mergeDetailSpecs(entry.specs ?? {}, detail);

      // Augment pricing from detailed Prices array (contains all Savings Plans & Reserved)
      if (detail && detail.Prices) {
        for (const prItem of detail.Prices) {
          const rId = prItem.regionId;
          const pType = prItem.paymentType;
          if (rId && pType) {
            if (!entry.pricing[rId]) entry.pricing[rId] = {};
            if (prItem.linuxPrice != null)
              entry.pricing[rId][`linux_${pType}`] = prItem.linuxPrice;
            if (prItem.windowsPrice != null)
              entry.pricing[rId][`windows_${pType}`] = prItem.windowsPrice;
            if (prItem.ubuntuProPrice != null)
              entry.pricing[rId][`ubuntu_${pType}`] = prItem.ubuntuProPrice;
            if (prItem.slesPrice != null)
              entry.pricing[rId][`sles_${pType}`] = prItem.slesPrice;
            if (prItem.redHatEntPrice != null)
              entry.pricing[rId][`rhel_${pType}`] = prItem.redHatEntPrice;
          }
        }
      }
      enriched++;
      process.stdout.write("+");
    }
    enrichedSet.add(it);
    saveProgress({
      completedRegions: [...completedSet],
      enrichedInstances: [...enrichedSet],
    });
    saveCheckpoint(instanceMap);
    await sleep(CALL_DELAY_MS);
  }
  console.log(
    `\n  Enrichment done. Calls: ${enrichCalls} | Enriched: ${enriched}`,
  );

  // ── Phase 4: Pivot & write ──────────────────────────────────────────
  console.log("\n[4/4] Writing per-region JSON files...");
  const { totalFiles, totalRows } = pivotAndWrite(instanceMap);
  console.log(`      ${totalFiles} region files, ${totalRows} rows`);

  if (pendingRegions.length > 0 && errors === 0) {
    clearProgress();
    console.log("\n  ✓ Sync complete.");
  } else if (errors > 0) {
    console.log(`\n  Progress kept (${errors} errors).`);
  }

  console.log("\n" + "═".repeat(68));
  console.log(
    `  SYNC COMPLETE — ${instanceMap.size} instances, ${totalFiles} regions`,
  );
  console.log("═".repeat(68));
}

main().catch((err) => {
  console.error("\nFATAL:", err.message);
  process.exit(1);
});
