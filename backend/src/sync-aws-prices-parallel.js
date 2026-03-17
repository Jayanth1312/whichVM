const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

// Support 3 concurrent keys
const KEYS = [
  process.env.CLOUDPRICE_AWS_KEY || process.env.CLOUDPRICE_KEY_1,
  process.env.CLOUDPRICE_AZURE_KEY || process.env.CLOUDPRICE_KEY_2,
  process.env.CLOUDPRICE_GCP_KEY || process.env.CLOUDPRICE_KEY_3,
].filter(Boolean);

if (KEYS.length === 0) {
  console.error("ERROR: No Valid keys found in .env");
  process.exit(1);
}

const BASE = "https://data.cloudprice.net/api/v2";
const OUTPUT_DIR = path.join(__dirname, "../output/aws");

console.log(`\n  [Config] Concurrency Worker Count: ${KEYS.length} keys`);

function buildQS(params) {
  return Object.entries(params)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
}

async function apiFetch(pathWithQS, apiKey) {
  const url = `${BASE}${pathWithQS}`;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const res = await fetch(url, { headers: { "subscription-key": apiKey, Accept: "application/json" } });
      if (res.status === 429) { await new Promise(r => setTimeout(r, 15000)); continue; }
      if (res.status === 500) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json?.Data;
    } catch (e) {
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

async function main() {
  // 1. Load correct Payment Types including .Name
  const data = await apiFetch("/aws/ec2/payment-types", KEYS[0]);
  const items = data?.Items ?? data ?? [];
  const rawTypes = items.map(p => typeof p === "string" ? p : (p.PaymentType ?? p.paymentType ?? p.name ?? p.Name));
  const PAYMENT_CONFIGS = [];
  for (const pt of rawTypes) {
    if (!pt) continue;
    PAYMENT_CONFIGS.push({ key: `linux${pt}`, qs: { operatingSystem: "Linux", paymentType: pt } });
    PAYMENT_CONFIGS.push({ key: `windows${pt}`, qs: { operatingSystem: "Windows", paymentType: pt } });
  }

  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith(".json"));
  console.log(`\nUpdating pricings for ${files.length} region json files...`);

  for (const file of files) {
    const region = file.replace(".json", "");
    const filePath = path.join(OUTPUT_DIR, file);
    const regionFile = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    const tasks = PAYMENT_CONFIGS;
    let taskIdx = 0;

    console.log(`Processing ${region} (Tasks: ${tasks.length})...`);

    const runWorker = async (apiKey, workerId) => {
      while (taskIdx < tasks.length) {
        const currentIdx = taskIdx++;
        const payConf = tasks[currentIdx];
        try {
          const qs = buildQS({ region, currency: "USD", ...payConf.qs });
          const batch = await apiFetch(`/aws/ec2/instances?${qs}`, apiKey);
          if (batch && batch.Items) {
            for (const item of batch.Items) {
              const inst = regionFile.instances.find(i => i.n === item.InstanceType);
              if (inst) {
                 if (!inst.pr) inst.pr = {};
                 const price = item.PricePerHour;
                 if (price != null) inst.pr[payConf.key] = price;
                 delete inst.pr["linuxundefined"];
                 delete inst.pr["windowsundefined"];
              }
            }
          }
          process.stdout.write(".");
        } catch (e) {}
        await new Promise(r => setTimeout(r, 200));
      }
    };

    // Run Concurrency for this single region iteration
    await Promise.all(KEYS.map((key, i) => runWorker(key, i + 1)));

    // Re-pack and flush
    fs.writeFileSync(filePath, JSON.stringify(regionFile, null, 2));
    process.stdout.write("\n");
  }

  console.log("\n✅ Amazon Web Services Prices successfully updated with Concurrency!");
}

main().catch(console.error);
