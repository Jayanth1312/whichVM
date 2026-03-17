const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const CLOUDPRICE_KEY = process.env.CLOUDPRICE_AWS_KEY || process.env.CLOUDPRICE_KEY;
if (!CLOUDPRICE_KEY) {
  console.error("ERROR: No Valid AWS Cloudprice key found under CLOUDPRICE_AWS_KEY in .env");
  process.exit(1);
}

const BASE = "https://data.cloudprice.net/api/v2";
const OUTPUT_DIR = path.join(__dirname, "../output/aws");

function buildQS(params) {
  return Object.entries(params)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
}

async function apiFetch(pathWithQS) {
  const url = `${BASE}${pathWithQS}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { "subscription-key": CLOUDPRICE_KEY, Accept: "application/json" } });
    if (res.status === 429) { await new Promise(r => setTimeout(r, 10000)); continue; }
    if (res.status === 500) return null;
    const json = await res.json();
    return json?.Data;
  }
}

async function main() {
  // 1. Load correct Payment Types including .Name
  const data = await apiFetch("/aws/ec2/payment-types");
  const items = data?.Items ?? data ?? [];
  const rawTypes = items.map(p => typeof p === "string" ? p : (p.PaymentType ?? p.paymentType ?? p.name ?? p.Name));
  const PAYMENT_CONFIGS = [];
  for (const pt of rawTypes) {
    PAYMENT_CONFIGS.push({ key: `linux${pt}`, qs: { operatingSystem: "Linux", paymentType: pt } });
    PAYMENT_CONFIGS.push({ key: `windows${pt}`, qs: { operatingSystem: "Windows", paymentType: pt } });
  }

  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith(".json"));
  console.log(`\nUpdating pricings for ${files.length} region json files...`);

  for (const file of files) {
    const region = file.replace(".json", "");
    const filePath = path.join(OUTPUT_DIR, file);
    const regionFile = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    
    console.log(`Processing ${region}...`);
    for (const payConf of PAYMENT_CONFIGS) {
      try {
        const qs = buildQS({ region, currency: "USD", ...payConf.qs });
        const batch = await apiFetch(`/aws/ec2/instances?${qs}`);
        if (batch && batch.Items) {
          for (const item of batch.Items) {
            const inst = regionFile.instances.find(i => i.n === item.InstanceType);
            if (inst) {
               if (!inst.pr) inst.pr = {};
               const price = item.PricePerHour;
               if (price != null) inst.pr[payConf.key] = price;
               // Delete the undefined key if it exists from previous bug
               delete inst.pr["linuxundefined"];
               delete inst.pr["windowsundefined"];
            }
          }
        }
      } catch (e) {
         console.error(`Error ${region} ${payConf.key}:`, e.message);
      }
      await new Promise(r => setTimeout(r, 300));
    }
    fs.writeFileSync(filePath, JSON.stringify(regionFile, null, 2));
  }
  console.log("\n✅ Amazon Web Services Prices successfully updated!");
}

main().catch(console.error);
