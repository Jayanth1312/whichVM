/**
 * data.api.ts
 *
 * Serves static pipeline output files in development mode.
 * In production, these would come from Vercel Blob CDN.
 *
 * Routes:
 *   GET /api/data/meta/index.json
 *   GET /api/data/:provider/:file
 */

import { Router, Request, Response } from "express";
import * as path from "path";
import * as fs from "fs";
import { config } from "../config";

const router = Router();

// Serve index.json
router.get("/data/meta/index.json", (_req: Request, res: Response) => {
  const filePath = path.join(config.outputDir, "meta", "index.json");

  if (!fs.existsSync(filePath)) {
    res.status(404).json({
      error: "index.json not found",
      hint: "Run the pipeline first: GET /api/cron/update",
    });
    return;
  }

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.resolve(filePath));
});

// Serve provider region files
router.get("/data/:provider/:file", (req: Request, res: Response) => {
  const provider = req.params.provider as string;
  const file = req.params.file as string;

  // Validate provider
  if (!["aws", "azure", "gcp"].includes(provider)) {
    res.status(400).json({ error: "Invalid provider" });
    return;
  }

  const safeFile = path.basename(file);
  const filePath = path.join(config.outputDir, provider, safeFile);

  if (!filePath.startsWith(path.resolve(config.outputDir))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  if (!fs.existsSync(filePath)) {
    res.status(404).json({
      error: "File not found",
      path: `${provider}/${safeFile}`,
      hint: "Run the pipeline first: GET /api/cron/update",
    });
    return;
  }

  // Set appropriate content type
  if (filePath.endsWith(".json")) {
    res.setHeader("Content-Type", "application/json");
  } else if (filePath.endsWith(".msgpack.zst")) {
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${safeFile}"`);
  }

  // Enable CORS for frontend dev server
  res.setHeader("Access-Control-Allow-Origin", "*");

  // No caching in dev
  res.setHeader("Cache-Control", "no-store");

  res.sendFile(path.resolve(filePath));
});

export default router;
