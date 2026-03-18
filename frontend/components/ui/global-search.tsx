"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { decompress as zstdDecompress } from "fzstd";
import { decode } from "@msgpack/msgpack";
import { cachedFetch } from "@/lib/cache";
import { getDataUrl } from "@/lib/api-utils";

interface SearchHit {
  instanceType: string;
  vCPUs: number;
  memoryGiB: number;
  provider: string;
}

const DEFAULT_REGIONS: Record<string, string> = {
  aws: "us-east-1",
  azure: "eastus",
  gcp: "us-central1",
};

import { AmazonWebServices } from "@/app/icons/amazonIcon";
import { MicrosoftAzure } from "@/app/icons/azureIcon";
import { GoogleCloud } from "@/app/icons/gcpIcon";

const ProviderIcon = ({ provider }: { provider: string }) => {
  if (provider === "aws") return <AmazonWebServices className="w-4 h-4" />;
  if (provider === "azure") return <MicrosoftAzure className="w-4 h-4" />;
  return <GoogleCloud className="w-4 h-4" />;
};

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [indexedData, setIndexedData] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Warm Indexed Cache from static files client-side on mount
  useEffect(() => {
    let active = true;
    async function loadAll() {
      setLoading(true);
      const providers = ["aws", "azure", "gcp"];
      const masterList: SearchHit[] = [];

      try {
        const promises = providers.map(async (p) => {
          try {
            const region = DEFAULT_REGIONS[p];
            const url = getDataUrl(`/${p}/${region}.msgpack.zst`);
            const res = await cachedFetch(url);
            if (!res.ok) return;

            const arrayBuffer = await res.arrayBuffer();
            const decompressed = zstdDecompress(new Uint8Array(arrayBuffer));
            const data: any = decode(decompressed);
            if (data?.instances) {
              data.instances.forEach((inst: any) => {
                masterList.push({
                  instanceType: inst.n || "",
                  vCPUs: inst.v || 0,
                  memoryGiB: inst.m || 0,
                  provider: p,
                });
              });
            }
          } catch (e) {
            // skip
          }
        });
        await Promise.all(promises);
        if (active) setIndexedData(masterList);
      } catch (e) {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAll();
    return () => {
      active = false;
    };
  }, []);

  // Sync client-side array filtration
  useEffect(() => {
    const query = q.toLowerCase().trim();
    if (query.length <= 1) {
      setHits([]);
      setActiveIndex(-1);
      return;
    }

    const filtered = indexedData
      .filter((h) => h.instanceType.toLowerCase().includes(query))
      .slice(0, 10);
    setHits(filtered);
    setActiveIndex(-1);
  }, [q, indexedData]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const handleSelect = (hit: SearchHit) => {
    setOpen(false);
    setQ("");
    const region = DEFAULT_REGIONS[hit.provider];
    router.push(
      `/${hit.provider}/${region}/instance/${encodeURIComponent(hit.instanceType)}`,
    );
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[240px] md:max-w-[320px]"
    >
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-neutral-500" />
        <Input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (q.trim().length > 1) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (!open || hits.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((prev) => (prev < hits.length - 1 ? prev + 1 : prev));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (activeIndex >= 0 && activeIndex < hits.length) {
                handleSelect(hits[activeIndex]);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={loading ? "Warming index..." : "Search"}
          className="pl-9 pr-8 h-10 rounded-lg bg-neutral-900 border-neutral-800 text-sm focus-visible:ring-0 focus-visible:border-neutral-800"
        />
        {loading && (
          <Loader2 className="absolute right-9 h-4 w-4 animate-spin text-neutral-500" />
        )}
        {q && (
          <X
            className="absolute right-3 h-4 w-4 text-neutral-500 hover:text-white cursor-pointer"
            onClick={() => {
              setQ("");
              setHits([]);
              setOpen(false);
            }}
          />
        )}
      </div>

      <AnimatePresence>
        {open && hits.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute left-0 right-0 mt-1 z-50 rounded-md border border-neutral-800 bg-neutral-900/95 backdrop-blur-md shadow-lg"
          >
            <div className="py-1 max-h-64 overflow-y-auto">
              {hits.map((hit, i) => (
                <div
                  key={`${hit.provider}-${hit.instanceType}-${i}`}
                  onClick={() => handleSelect(hit)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-neutral-800/80 transition-colors",
                    i === activeIndex && "bg-neutral-800/80"
                  )}
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    <ProviderIcon provider={hit.provider} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white truncate max-w-[160px] md:max-w-[220px]">
                      {hit.instanceType}
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      {hit.vCPUs} vCPUs, {hit.memoryGiB} GiB RAM
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
