/**
 * sync-aws.js
 *
 * Fetches AWS EC2 data from CloudPrice v2 API → writes per-region JSON files.
 *
 * Phases:
 *   Phase 1 — Metadata (regions, payment types)
 *   Phase 2 — Discovery check
 *   Phase 3 — Pricing across all regions (main loop)
 *   Phase 4 — Per-instance detail enrichment (full hardware specs)
 *   Phase 5 — Pivot to per-region JSON & write
 *
 * Usage:
 *   node src/sync-aws.js
 *   node src/sync-aws.js --fresh
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const CLOUDPRICE_KEY = process.env.CLOUDPRICE_AWS_KEY || process.env.CLOUDPRICE_KEY;
if (!CLOUDPRICE_KEY) {
  console.error("ERROR: CLOUDPRICE_AWS_KEY or CLOUDPRICE_KEY not set in .env");
  process.exit(1);
}

const fs = require("fs");
const path = require("path");

const BASE =
  process.env.CLOUDPRICE_BASE_URL || "https://data.cloudprice.net/api/v2";
const OUTPUT_DIR = path.join(__dirname, "../output");

const CALL_DELAY_MS = 750;
const RATE_LIMIT_WAITS = [10000, 20000, 40000, 60000, 120000];

let AWS_REGIONS = [];
let PAYMENT_CONFIGS = [];

// ─── METADATA FETCHERS ───────────────────────────────────────────────────────

async function fetchRegions() {
  console.log("  Fetching regions from /aws/ec2/regions...");
  const data = await apiFetch("/aws/ec2/regions");
  const items = data?.Items ?? data ?? [];
  AWS_REGIONS = items.map((r) =>
    typeof r === "string" ? r : (r.Region ?? r.region ?? r.name ?? r.Name),
  );
  console.log(`${AWS_REGIONS.length} regions loaded`);
  return AWS_REGIONS;
}

async function fetchPaymentTypes() {
  console.log("  Fetching payment types from /aws/ec2/payment-types...");
  const data = await apiFetch("/aws/ec2/payment-types");
  const items = data?.Items ?? data ?? [];
  const rawTypes = items.map((p) =>
    typeof p === "string"
      ? p
      : (p.PaymentType ?? p.paymentType ?? p.name ?? p.Name),
  );
  console.log(`${rawTypes.length} payment types loaded`);

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

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildQS(params) {
  return Object.entries(params)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
}


// ─── API FETCH (with rate-limit retry) ────────────────────────────────────────
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
    } catch (networkErr) {
      if (attempt >= RATE_LIMIT_WAITS.length) throw networkErr;
      const wait = RATE_LIMIT_WAITS[attempt];
      console.warn(
        `\n    [network error] ${networkErr.message} — retrying in ${wait / 1000}s...`,
      );
      await sleep(wait);
      continue;
    }

    if (res.status === 429) {
      if (attempt >= RATE_LIMIT_WAITS.length)
        throw new Error(
          `Still rate limited after ${RATE_LIMIT_WAITS.length} retries`,
        );
      const retryAfter = res.headers.get("retry-after");
      const wait = retryAfter
        ? parseInt(retryAfter) * 1000
        : RATE_LIMIT_WAITS[attempt];
      console.warn(
        `\n    [429] Rate limited — waiting ${wait / 1000}s (attempt ${attempt + 1})...`,
      );
      await sleep(wait);
      continue;
    }

    if (res.status === 500) return null;
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = await res.json();
    if (json?.Status !== "ok")
      throw new Error(`Non-ok status: ${JSON.stringify(json).slice(0, 150)}`);
    return json.Data;
  }
}

// ─── EXTRACT SPECS ────────────────────────────────────────────────────────────

/**
 * Extract basic specs from the bulk listing endpoint.
 * These fields come from /aws/ec2/instances?region=...&paymentType=...
 */
function extractBasicSpecs(item) {
  return {
    instanceType: item.InstanceType ?? item.name ?? null,
    instanceFamily: item.InstanceFamily ?? item.canonicalname ?? null,
    vCPUs: item.ProcessorVCPUCount ?? item.numberOfCores ?? null,
    memoryGiB:
      item.MemorySizeInMB != null
        ? Math.round((item.MemorySizeInMB / 1024) * 100) / 100
        : item.memoryInMB
          ? Math.round((item.memoryInMB / 1024) * 100) / 100
          : null,
    processor: item.Processor ?? item.cpuDesc ?? null,
    architecture: Array.isArray(item.ProcessorArchitecture)
      ? item.ProcessorArchitecture.join(", ")
      : (item.ProcessorArchitecture ?? item.cpuArchitecture ?? null),
    storage:
      item.InstanceStorage ?? (item.InstanceStorageSupport ? "EBS only" : null),
    network: item.NetworkingPerformance ?? "",
    hasGPU: item.HasGPU ?? false,
    gpuCount: item.GPUCount ?? 0,
    gpuName: item.GPUName ?? null,
    // Placeholders for detail enrichment
    instanceFamilyName: null,
    baseInstanceType: null,
    burstable: null,
    hypervisor: null,
    clockSpeed: null,
    physicalCores: null,
    threadsPerCore: null,
    storageType: null,
    storageSizeGB: null,
    storageDiskCount: null,
    storageNVMe: null,
    ebsOptimized: null,
    networkMaxInterfaces: null,
    enaSupport: null,
    efaSupport: null,
    gpuRAM: null,
  };
}

/**
 * Merge detailed specs from /aws/ec2/instances/{instance_type}
 * This endpoint returns ALL hardware details.
 */
function mergeDetailSpecs(basic, detail) {
  if (!detail) return basic;
  const d = detail.Instance ?? detail;
  const pick = (dv, bv) => (dv != null ? dv : bv);

  return {
    ...basic,
    // ── Identity ──
    instanceType: pick(d.InstanceType, basic.instanceType),
    instanceFamily: pick(d.InstanceFamily, basic.instanceFamily),
    instanceFamilyName: pick(d.InstanceFamilyName, basic.instanceFamilyName),
    baseInstanceType: pick(d.BaseInstanceType, basic.baseInstanceType),

    // ── Compute ──
    vCPUs: pick(d.ProcessorVCPUCount, basic.vCPUs),
    memoryGiB:
      d.MemorySizeInMB != null
        ? Math.round((d.MemorySizeInMB / 1024) * 100) / 100
        : basic.memoryGiB,
    processor: pick(d.Processor, basic.processor),
    architecture: pick(
      Array.isArray(d.ProcessorArchitecture)
        ? d.ProcessorArchitecture.join(", ")
        : d.ProcessorArchitecture,
      basic.architecture,
    ),
    clockSpeed: pick(
      d.ProcessorClockSpeed ?? d.ProcessorSustainedClockSpeedInGHz,
      basic.clockSpeed,
    ),
    physicalCores: pick(d.ProcessorDefaultCores, basic.physicalCores),
    threadsPerCore: pick(
      d.ProcessorDefaultThreadsPerCore,
      basic.threadsPerCore,
    ),
    burstable: pick(d.BurstablePerformanceSupport, basic.burstable),
    hypervisor: pick(d.Hypervisor, basic.hypervisor),

    // ── Storage ──
    storage: pick(d.InstanceStorage, basic.storage),
    storageType: pick(d.InstanceStorageDiskType, basic.storageType),
    storageSizeGB: pick(
      d.InstanceStorageTotalSizeInGB,
      basic.storageSizeGB,
    ),
    storageDiskCount: pick(
      d.InstanceStorageDiskCount,
      basic.storageDiskCount,
    ),
    storageNVMe: pick(d.InstanceStorageNVMeSupport, basic.storageNVMe),
    ebsOptimized: pick(d.EBSOptimizedSupport, basic.ebsOptimized),

    // ── Network ──
    network: pick(d.NetworkingPerformance, basic.network),
    networkMaxInterfaces: pick(
      d.NetworkingMaxInterfaces,
      basic.networkMaxInterfaces,
    ),
    enaSupport: pick(d.NetworkingENASupport, basic.enaSupport),
    efaSupport: pick(d.NetworkingEFASupport, basic.efaSupport),

    // ── GPU ──
    hasGPU: pick(d.HasGPU, basic.hasGPU),
    gpuCount: pick(d.GPUCount, basic.gpuCount),
    gpuName: pick(d.GPUName, basic.gpuName),
    gpuRAM: pick(d.GPUTotalRAMinGB ?? d.GPUMemoryInMiB, basic.gpuRAM),
  };
}

// ─── STATE MANAGEMENT (Resume capability) ───────────────────────────────────
const PROGRESS_FILE = path.join(OUTPUT_DIR, "aws", "progress.json");
const CHECKPOINT_FILE = path.join(OUTPUT_DIR, "aws", "checkpoint.json");

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

// ─── PIVOT: instance-centric → region-centric JSON files ──────────────────────
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
        // ── Core fields (backward compatible) ──
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
        // ── Extended hardware fields ──
        fn: specs.instanceFamilyName || null,
        cs: specs.clockSpeed || null,
        pc: specs.physicalCores || null,
        tc: specs.threadsPerCore || null,
        bu: specs.burstable || false,
        hy: specs.hypervisor || null,
        st: specs.storageType || null,
        ss: specs.storageSizeGB || null,
        sd: specs.storageDiskCount || null,
        sn: specs.storageNVMe || null,
        eb: specs.ebsOptimized || null,
        ni: specs.networkMaxInterfaces || null,
        ne: specs.enaSupport || null,
        ef: specs.efaSupport || null,
        gr: specs.gpuRAM || null,
      };

      if (!regionRows.has(region)) regionRows.set(region, []);
      regionRows.get(region).push(row);
    }
  }

  let totalFiles = 0;
  let totalRows = 0;

  for (const [region, rows] of regionRows) {
    rows.sort((a, b) => a.n.localeCompare(b.n));

    const regionFile = {
      provider: "aws",
      region,
      generatedAt: new Date().toISOString(),
      count: rows.length,
      instances: rows,
    };

    fs.writeFileSync(
      path.join(providerDir, `${region}.json`),
      JSON.stringify(regionFile, null, 2),
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
  console.log("  AWS EC2 → JSON Sync   (CloudPrice v2 API)");
  console.log("═".repeat(68));

  if (isFresh) {
    clearProgress();
    console.log("  --fresh: starting from scratch.");
  }

  // ── Phase 1: Fetch metadata ─────────────────────────────────────────
  console.log("\n[1/5] Fetching metadata...");
  await fetchRegions();
  await sleep(CALL_DELAY_MS);
  await fetchPaymentTypes();
  await sleep(CALL_DELAY_MS);

  // ── Phase 2: Discovery check ────────────────────────────────────────
  console.log("\n[2/5] Discovery check...");
  {
    const data = await apiFetch(
      `/aws/ec2/instances?${buildQS({ region: "us-east-1", currency: "USD", operatingSystem: "Linux", paymentType: "OnDemand" })}`,
    );
    const items = data?.Items ?? [];
    if (items.length === 0) {
      console.error("  ERROR: 0 items. Check your subscription key.");
      process.exit(1);
    }
    const s = items[0];
    console.log(
      `  OK — ${items.length} instances. Sample: ${s.InstanceType} | vCPUs: ${s.ProcessorVCPUCount} | $${s.PricePerHour}/hr`,
    );
  }
  await sleep(CALL_DELAY_MS);

  // ── Resume state ───────────────────────────────────────────────────
  const progress = loadProgress();
  const completedSet = new Set(progress.completedRegions ?? []);
  const enrichedSet = new Set(progress.enrichedInstances ?? []);
  const pendingRegions = AWS_REGIONS.filter((r) => !completedSet.has(r));

  // ── Phase 3: Pricing ────────────────────────────────────────────────
  console.log(
    `\n[3/5] Pricing: ${AWS_REGIONS.length} regions × ${PAYMENT_CONFIGS.length} payment types`,
  );
  console.log(
    `      Done: ${completedSet.size} | Pending: ${pendingRegions.length}`,
  );
  console.log(
    `      ~${Math.ceil((pendingRegions.length * PAYMENT_CONFIGS.length * CALL_DELAY_MS) / 60000)} min estimated`,
  );
  console.log(`      Legend: . = ok   - = unsupported   ✗ = error\n`);

  const instanceMap = loadCheckpoint();
  let apiCalls = 0;
  let errors = 0;

  for (const region of pendingRegions) {
    process.stdout.write(`  ${region.padEnd(26)}`);

    for (const payConf of PAYMENT_CONFIGS) {
      let data;
      try {
        data = await apiFetch(
          `/aws/ec2/instances?${buildQS({ region, currency: "USD", ...payConf.qs })}`,
        );
        apiCalls++;
      } catch (err) {
        errors++;
        process.stdout.write("✗");
        console.error(
          `\n    ! [${region}/${payConf.key}]: ${err.message.split("\n")[0]}`,
        );
        await sleep(CALL_DELAY_MS);
        continue;
      }

      if (data === null) {
        process.stdout.write("-");
        await sleep(CALL_DELAY_MS);
        continue;
      }

      for (const item of data?.Items ?? []) {
        const instanceType = item.InstanceType;
        if (!instanceType) continue;

        if (!instanceMap.has(instanceType))
          instanceMap.set(instanceType, { specs: null, pricing: {} });
        const entry = instanceMap.get(instanceType);

        if (!entry.specs) entry.specs = extractBasicSpecs(item);

        const price = item.PricePerHour;
        if (price != null) {
          if (!entry.pricing[region]) entry.pricing[region] = {};
          entry.pricing[region][payConf.key] = price;
        }
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

  // ── Phase 4: Detail enrichment (full hardware specs) ────────────────
  const allTypes = [...instanceMap.keys()];
  const pendingEnrich = allTypes.filter((t) => !enrichedSet.has(t));
  console.log(
    `\n[4/5] Enrichment: ${pendingEnrich.length} instances to fetch detailed specs`,
  );
  let enrichCalls = 0,
    enriched = 0;

  for (let i = 0; i < pendingEnrich.length; i++) {
    const it = pendingEnrich[i];
    if (i % 50 === 0)
      process.stdout.write(`\n  [${i}/${pendingEnrich.length}] `);
    let detail;
    try {
      detail = await apiFetch(`/aws/ec2/instances/${encodeURIComponent(it)}`);
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

  // ── Phase 5: Pivot & write per-region JSON ──────────────────────────
  console.log("\n[5/5] Writing per-region JSON files...");
  const { totalFiles, totalRows } = pivotAndWrite(instanceMap);
  console.log(
    `      ${totalFiles} region files, ${totalRows} instance-region rows`,
  );

  // ── Cleanup ────────────────────────────────────────────────────────
  if (pendingRegions.length > 0 && errors === 0) {
    clearProgress();
    console.log("\n  ✓ Progress cleared — sync complete.");
  } else if (errors > 0) {
    console.log(`\n  Progress kept (${errors} errors — re-run to retry).`);
  } else {
    console.log("\n  Nothing new to sync.");
  }

  console.log("\n" + "═".repeat(68));
  console.log("  SYNC COMPLETE");
  console.log("═".repeat(68));
  console.log(`  Instances : ${instanceMap.size}`);
  console.log(`  Regions   : ${totalFiles}`);
  console.log(`  API calls : ${apiCalls + enrichCalls}`);
  console.log(`  Errors    : ${errors}`);
  console.log(`  Output    : ${path.join(OUTPUT_DIR, "aws")}/`);
  console.log("═".repeat(68));
}

main().catch((err) => {
  console.error("\nFATAL:", err.message);
  process.exit(1);
});
