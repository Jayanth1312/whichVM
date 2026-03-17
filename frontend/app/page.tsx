"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const lastProvider = localStorage.getItem("lastViewedProvider") || "aws";
      
      let savedRegion = "us-east-1";
      try {
         const saved = localStorage.getItem(`whichvm-filters-${lastProvider}`);
         if (saved) {
           const parsed = JSON.parse(saved);
           if (parsed.region) savedRegion = parsed.region;
         } else {
           const defaultRegions: any = { aws: "us-east-1", azure: "eastus", gcp: "us-central1" };
           savedRegion = defaultRegions[lastProvider] || "us-east-1";
         }
      } catch {
         const defaultRegions: any = { aws: "us-east-1", azure: "eastus", gcp: "us-central1" };
         savedRegion = defaultRegions[lastProvider] || "us-east-1";
      }

      router.replace(`/${lastProvider}/${savedRegion}`);
    }
  }, [router]);

  return <div className="min-h-screen bg-black" />;
}
