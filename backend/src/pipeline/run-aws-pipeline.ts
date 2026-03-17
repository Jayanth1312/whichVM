import { runPipeline } from "./orchestrator";

async function main() {
  // Only process AWS to save time since it's the one we re-ran
  const result = await runPipeline(["aws"]);
  
  if (result.success) {
    console.log("\n✅ AWS Pipeline Complete!");
    process.exit(0);
  } else {
    console.error("\n❌ AWS Pipeline Failed:", result.errors);
    process.exit(1);
  }
}

main().catch(console.error);
