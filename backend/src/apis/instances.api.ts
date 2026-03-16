import { Router, Request, Response } from "express";
import {
  searchInstances,
  getInstanceDetail,
  getProviderRegions,
} from "../services/instance-service";
import { Provider } from "../types";

const router = Router();

const VALID_PROVIDERS = ["aws", "azure", "gcp"];

router.get("/instances/search", async (req: Request, res: Response) => {
  const q = req.query.q as string | undefined;
  const provider = (req.query.provider as string) || "aws";
  const region = (req.query.region as string) || "us-east-1";
  const limit = (req.query.limit as string) || "20";

  if (!q) {
    res.status(400).json({ error: "Missing query parameter: q" });
    return;
  }

  const p = provider.toLowerCase();
  if (!VALID_PROVIDERS.includes(p)) {
    res.status(400).json({ error: "Invalid provider" });
    return;
  }

  const l = Math.min(parseInt(limit, 10), 50);

  try {
    const results = await searchInstances(p as Provider, q, region, l);
    res.json({ results, count: results.length });
  } catch (err: any) {
    console.error("[Search API] Error:", err.message);
    res.status(500).json({ error: "Search failed" });
  }
});

router.get(
  "/instances/:provider/:instanceType",
  async (
    req: Request<{ provider: string; instanceType: string }>,
    res: Response,
  ) => {
    const { provider, instanceType } = req.params;

    if (!VALID_PROVIDERS.includes(provider.toLowerCase())) {
      res.status(400).json({ error: "Invalid provider" });
      return;
    }

    try {
      const instance = await getInstanceDetail(
        provider.toLowerCase() as Provider,
        decodeURIComponent(instanceType),
      );

      if (!instance) {
        res.status(404).json({ error: "Instance not found" });
        return;
      }

      res.json(instance);
    } catch (err: any) {
      console.error("[Instance API] Error:", err.message);
      res.status(500).json({ error: "Failed to fetch instance" });
    }
  },
);

router.get(
  "/instances/:provider/regions",
  async (req: Request<{ provider: string }>, res: Response) => {
    const { provider } = req.params;

    if (!VALID_PROVIDERS.includes(provider.toLowerCase())) {
      res.status(400).json({ error: "Invalid provider" });
      return;
    }

    try {
      const regions = await getProviderRegions(
        provider.toLowerCase() as Provider,
      );
      res.json({ regions });
    } catch (err: any) {
      console.error("[Regions API] Error:", err.message);
      res.status(500).json({ error: "Failed to fetch regions" });
    }
  },
);

export default router;
