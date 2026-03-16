/**
 * cron.api.ts
 *
 * POST /api/cron/update — Triggers the full data pipeline.
 * In production, this would be called by Vercel Cron.
 * In dev, you can trigger it manually.
 */

import { Router, Request, Response } from "express";
import { runPipeline } from "../pipeline/orchestrator";
import { Provider } from "../types";

const router = Router();

let pipelineRunning = false;

router.post("/cron/update", async (req: Request, res: Response) => {
  if (pipelineRunning) {
    res.status(429).json({
      error: "Pipeline is already running",
      message: "Please wait for the current run to complete.",
    });
    return;
  }

  // Optional: specify providers via body
  const providers = req.body?.providers as Provider[] | undefined;

  pipelineRunning = true;

  try {
    console.log("[Cron] Pipeline triggered via API");
    const result = await runPipeline(providers);

    res.json({
      success: result.success,
      summary: {
        providers: result.providersProcessed,
        regions: result.regionsTotal,
        files: result.filesTotal,
        duration: `${(result.durationMs / 1000).toFixed(1)}s`,
        errors: result.errors,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      error: "Pipeline failed",
      message: err.message,
    });
  } finally {
    pipelineRunning = false;
  }
});

// GET version for easy browser triggering during dev
router.get("/cron/update", async (_req: Request, res: Response) => {
  if (pipelineRunning) {
    res.status(429).json({ error: "Pipeline is already running" });
    return;
  }

  pipelineRunning = true;

  try {
    const result = await runPipeline();
    res.json({
      success: result.success,
      providers: result.providersProcessed,
      regions: result.regionsTotal,
      files: result.filesTotal,
      duration: `${(result.durationMs / 1000).toFixed(1)}s`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    pipelineRunning = false;
  }
});

export default router;
