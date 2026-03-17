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

// Helper: Fetch from CDN and proxy response
async function proxyFromCdn(req: Request, res: Response, cdnUrl: string): Promise<void> {
  try {
    const response = await fetch(cdnUrl);
    if (!response.ok) {
      res.status(response.status).json({ error: "CDN fetch failed" });
      return;
    }

    // Copy headers
    const contentType = response.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (error) {
    console.error("[CDN Proxy] Error:", error);
    res.status(500).json({ error: "CDN proxy error" });
  }
}

// Serve index.json
router.get("/data/meta/index.json", async (_req: Request, res: Response) => {
  const filePath = path.join(config.outputDir, "meta", "index.json");

  // 1. Production Mode: Default straight to Vercel Blob CDN
  if (config.blobToken) {
    const baseCdn = config.blobCdnUrl;
    const cdnUrl = `${baseCdn}/meta/index.json`;
    await proxyFromCdn(_req, res, cdnUrl);
    return;
  }

  // 2. Development Mode: Fallback to local disk
  if (fs.existsSync(filePath)) {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.resolve(filePath));
    return;
  }

  res.status(404).json({ error: "File not found" });
});

// Serve provider region files
router.get("/data/:provider/:file", async (req: Request, res: Response) => {
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

  // 1. Production Mode: Default straight to Vercel Blob CDN
  if (config.blobToken) {
    const baseCdn = config.blobCdnUrl;
    const cdnUrl = `${baseCdn}/${provider}/${safeFile}`;
    await proxyFromCdn(req, res, cdnUrl);
    return;
  }

  // 2. Development Mode: Fallback to local disk
  if (fs.existsSync(filePath)) {
    // Set appropriate content type
    if (filePath.endsWith(".json")) {
      res.setHeader("Content-Type", "application/json");
    } else if (filePath.endsWith(".msgpack.zst")) {
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename="${safeFile}"`);
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");

    res.sendFile(path.resolve(filePath));
    return;
  }

  res.status(404).json({ error: "File not found" });
});

export default router;
