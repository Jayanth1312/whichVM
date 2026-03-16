import express from "express";
import cors from "cors";
import { config } from "./config";
import { connectDB } from "./config/db";
import apiRouter from "./apis";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
  }),
);
app.use(express.json());

app.use("/api", apiRouter);

async function start() {
  // Connect to MongoDB
  if (config.mongoUri) {
    try {
      await connectDB();
    } catch (err: any) {
      console.warn(`⚠ MongoDB connection failed: ${err.message}`);
      console.warn("  Instance search API will be unavailable.");
    }
  } else {
    console.warn("⚠ MONGO_URI not set — instance search API disabled.");
  }

  app.listen(config.port, () => {
    console.log(
      `\n🚀 WhichVM Backend running on http://localhost:${config.port} [${config.nodeEnv}]`,
    );
    console.log(`\n📋 Available endpoints:`);
    console.log(`   GET  /api/ping                        — Health check`);
    console.log(`   GET  /api/cron/update                  — Trigger pipeline`);
    console.log(`   GET  /api/data/meta/index.json         — Region manifest`);
    console.log(
      `   GET  /api/data/:provider/:region.msgpack.zst — Compressed data`,
    );
    console.log(
      `   GET  /api/instances/search?q=t3&provider=aws — Search instances`,
    );
    console.log(`   GET  /api/instances/:provider/:type    — Instance detail`);
    console.log(``);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
