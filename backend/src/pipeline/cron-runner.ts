/**
 * cron-runner.ts
 * A master script designed to run sequentially for updates:
 *   1. sync-aws.js
 *   2. sync-azure.js
 *   3. sync-gcp.js
 *   4. orchestrator.ts (The pipeline compressor & Uploader)
 */

import { spawn } from "child_process";
import path from "path";
import { runPipeline } from "./orchestrator";

function execScript(scriptName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, "..", scriptName);
    console.log(`\n[CronRunner] 🚀 Starting: ${scriptName}`);

    const process = spawn("node", [scriptPath], {
      stdio: "inherit", // Pipe logs direct to console so you can see them on Render logs
    });

    process.on("close", (code) => {
      if (code === 0) {
        console.log(`[CronRunner] ✅ Finished: ${scriptName}`);
        resolve();
      } else {
        console.error(`[CronRunner] ❌ Failed: ${scriptName} (Exit code ${code})`);
        reject(new Error(`${scriptName} failed`));
      }
    });
  });
}

async function main() {
  const startTime = Date.now();
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║      WhichVM Master Cron — Sync & Process        ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  try {
    // 1-3. Sync all providers sequentially
    console.log("\n[CronRunner] 🚀 Syncing all providers sequentially...");
    await execScript("sync-gcp.js");
    await execScript("sync-aws.js");
    await execScript("sync-azure.js");

    // 4. Run Pipeline Orchestrator (Compress & Upload to Blob)
    console.log("\n── ORCHESTRATOR ──────────────────────────────");
    console.log("[CronRunner] 🚀 Starting Pipeline Orchestrator...");
    const result = await runPipeline();

    if (result.success) {
      console.log(`\n[CronRunner] ✅ All steps completed successfully!`);
    } else {
      console.warn(`\n[CronRunner] ⚠ Pipeline finished with errors:`, result.errors);
    }

  } catch (err: any) {
    console.error(`\n[CronRunner] 🚨 ABORTED: ${err.message}`);
    process.exit(1);
  }

  const durationMin = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\n[CronRunner] Total Duration: ${durationMin} minutes.`);
  console.log("══════════════════════════════════════════════════");
}

main();
