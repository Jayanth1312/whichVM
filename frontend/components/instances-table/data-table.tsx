"use client";

import * as React from "react";
import {
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  Column,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import {
  ChevronUp,
  ChevronDown,
  Check,
  Search,
  Info,
  ArrowUp,
  X,
} from "lucide-react";
import {
  FilterDropdown,
  type FilterOption,
} from "@/components/ui/filter-dropdown";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getColumns, type Instance } from "./columns";
import { useRouter } from "next/navigation";
import { decompress as zstdDecompress } from "fzstd";
import { decode } from "@msgpack/msgpack";
import {
  cachedFetch,
  saveFilterState,
  loadFilterState,
  type PersistedFilterState,
} from "@/lib/cache";

const DEFAULT_REGIONS: Record<string, string> = {
  Azure: "eastus",
  GCP: "us-central1",
  AWS: "us-east-1",
};

// Backend API base URL (proxied via Next.js rewrites)
const API_BASE = "/api/data";

// ─── Module-level region store (survives component remounts) ────────
const regionStore: Record<string, any[]> = {};
let warmingProvider: string | null = null;
let warmingAbort: AbortController | null = null;

// Helper: fetch + decompress a single region file, returning instances[]
async function fetchAndDecode(
  providerLower: string,
  regionId: string,
  manifest: any | null,
): Promise<any[]> {
  let url = `${API_BASE}/${providerLower}/${regionId}.msgpack.zst`;

  // Prefer Blob CDN URL from manifest
  if (manifest) {
    const entry = manifest.providers?.[providerLower]?.regions?.find(
      (r: any) => r.id === regionId,
    );
    if (entry?.url?.startsWith("http")) url = entry.url;
  }

  const response = await cachedFetch(url);
  if (!response.ok) return [];

  const arrayBuffer = await response.arrayBuffer();
  const compressed = new Uint8Array(arrayBuffer);
  const decompressed = zstdDecompress(compressed);
  const regionFile: any = decode(decompressed);

  return regionFile?.instances ?? [];
}

const COMMITMENT_OPTIONS: Record<string, { label: string; value: string }[]> = {
  AWS: [
    { value: "payasyougo", label: "Pay-as-you-go" },
    { value: "ri_1y_no", label: "Reserved 1y - No Upfront" },
    { value: "ri_1y_partial", label: "Reserved 1y - Partial Upfront" },
    { value: "ri_1y_all", label: "Reserved 1y - All Upfront" },
    { value: "ri_3y_no", label: "Reserved 3y - No Upfront" },
    { value: "ri_3y_partial", label: "Reserved 3y - Partial Upfront" },
    { value: "ri_3y_all", label: "Reserved 3y - All Upfront" },
    { value: "sp_compute_1y_no", label: "Savings Plan 1y - No Upfront" },
    { value: "sp_compute_3y_no", label: "Savings Plan 3y - No Upfront" },
    { value: "sp_instance_1y_no", label: "Savings Plan 1y - No Upfront" },
    { value: "sp_instance_3y_no", label: "Savings Plan 3y - No Upfront" },
  ],
  AZURE: [
    { value: "payasyougo", label: "Pay-as-you-go" },
    { value: "reserved1y", label: "Reserved 1Y" },
    { value: "reserved3y", label: "Reserved 3Y" },
    { value: "savingsplan1y", label: "Savings Plan 1Y" },
    { value: "savingsplan3y", label: "Savings Plan 3Y" },
  ],
  GCP: [
    { value: "ondemand", label: "On Demand" },
    { value: "sustained", label: "Sustained Discount (100%)" },
    { value: "spot", label: "Spot" },
    { value: "commit_1y", label: "1-Year Commitment" },
    { value: "commit_3y", label: "3-Year Commitment" },
  ],
};

const COMMITMENT_LABELS: Record<string, string> = {
  AWS: "Reserved/Savings Plan",
  AZURE: "Hybrid Benefit",
  GCP: "Commitment",
};

const exprCache = new Map<string, any>();

const evaluateExpression = (val: any, expr: string): boolean => {
  const cleanExpr = expr.trim();
  if (!cleanExpr) return true;

  // Ignore incomplete advanced operators to prevent visual data dropouts while typing
  if (
    /^[><]=?$/.test(cleanExpr) ||
    /^\d+\.$/.test(cleanExpr) ||
    /^\d+\.\.$/.test(cleanExpr) ||
    ["!", "&", "|", "&&", "||"].includes(cleanExpr)
  ) {
    return true;
  }

  const strVal = String(val || "").toLowerCase();
  const numVal = ((): number => {
    if (typeof val === "number") return val;
    const match = strVal.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  })();

  let cached = exprCache.get(cleanExpr);
  if (!cached) {
    const strMethodMatch = cleanExpr.match(
      /^(starts_with|ends_with|has)\("(.+)"\)$/i,
    );
    const rangeMatch = cleanExpr.match(
      /^(\d+(?:\.\d+)?)\s*\.\.\s*(\d+(?:\.\d+)?)$/,
    );
    const compMatch = cleanExpr.match(/^([><]=?)\s*(\d+(?:\.\d+)?)$/);

    const isNum = /^\d+(?:\.\d+)?$/.test(cleanExpr);

    cached = {
      strMethodMatch,
      rangeMatch,
      compMatch,
      isNum,
    };
    exprCache.set(cleanExpr, cached);
  }

  if (cleanExpr === "ebs") return strVal.includes("ebs");
  if (cleanExpr === "nvme") return strVal.includes("nvme");
  if (cleanExpr === "ssd") return strVal.includes("ssd");
  if (cleanExpr === "hdd") return strVal.includes("hdd");

  const { strMethodMatch, rangeMatch, compMatch, isNum } = cached;

  if (strMethodMatch) {
    const method = strMethodMatch[1].toLowerCase();
    const search = strMethodMatch[2].toLowerCase();
    if (method === "starts_with") return strVal.startsWith(search);
    if (method === "ends_with") return strVal.endsWith(search);
    if (method === "has") return strVal.includes(search);
  }

  if (rangeMatch) {
    const start = parseFloat(rangeMatch[1]);
    const end = parseFloat(rangeMatch[2]);
    return numVal >= start && numVal <= end;
  }

  if (compMatch) {
    const op = compMatch[1];
    const target = parseFloat(compMatch[2]);
    switch (op) {
      case ">=":
        return numVal >= target;
      case "<=":
        return numVal <= target;
      case ">":
        return numVal > target;
      case "<":
        return numVal < target;
    }
  }

  if (cleanExpr.includes("&&")) {
    return cleanExpr.split("&&").every((e) => evaluateExpression(val, e));
  }
  if (cleanExpr.includes("||")) {
    return cleanExpr.split("||").some((e) => evaluateExpression(val, e));
  }

  if (cleanExpr.startsWith("!")) {
    return !evaluateExpression(val, cleanExpr.slice(1));
  }

  if (isNum) {
    return numVal === parseFloat(cleanExpr);
  }

  if (/^\d+(?:\.\d+)?$/.test(cleanExpr)) {
    return numVal === parseFloat(cleanExpr);
  }
  return strVal.includes(cleanExpr.toLowerCase());
};

const advancedFilterFn = (row: any, columnId: string, filterValue: string) => {
  return evaluateExpression(row.getValue(columnId), filterValue);
};

function Filter({ column }: { column: Column<any, unknown> }) {
  const columnFilterValue = column.getFilterValue();
  const meta = column.columnDef.meta as any;
  const isAdvanced = meta?.isAdvanced;
  const showTooltip = meta?.showTooltip;
  const header = column.columnDef.header as string;

  const [value, setValue] = React.useState<string>(
    (columnFilterValue ?? "") as string,
  );

  React.useEffect(() => {
    setValue((columnFilterValue ?? "") as string);
  }, [columnFilterValue]);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      column.setFilterValue(value);
    }, 300);
    return () => clearTimeout(timeout);
  }, [value, column]);

  return (
    <div className="flex items-center gap-1.5 w-full">
      <Input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={isAdvanced ? ">=0" : `Filter ${header}`}
        className="h-8 bg-black! border-neutral-800! text-[11px] text-white placeholder:text-neutral-600 rounded-lg w-full pl-3 focus:ring-0! focus-visible:ring-0! shadow-none border"
      />
      {showTooltip && (
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button className="text-neutral-500 hover:text-white transition-colors shrink-0">
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="bg-neutral-900 border-neutral-800 text-[11px] max-w-[240px] p-3 shadow-xl">
              <div className="space-y-2">
                <p className="font-bold text-white">
                  Advanced Filter Expressions
                </p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-neutral-400">
                  <span className="text-white">10..20</span> <span>Range</span>
                  <span className="text-white">&gt;=10</span>{" "}
                  <span>Greater/Equal</span>
                  <span className="text-white">&&, ||</span>{" "}
                  <span>Logical and/or</span>
                  <span className="text-white">!</span> <span>Not</span>
                </div>
                <p className="text-[10px] text-neutral-500 pt-1 border-t border-neutral-800">
                  Examples:{" "}
                  <code className="text-emerald-400">&gt;=8 && &lt;=32</code>,{" "}
                  <code className="text-emerald-400">16..64</code>
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

interface DataTableProps {
  provider: string;
  initialRegion?: string;
}

export function DataTable({ provider, initialRegion }: DataTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "name", desc: false },
  ]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});

  const [rowSelection, setRowSelection] = React.useState({});
  const selectedCount = Object.keys(rowSelection).length;
  const [region, setRegion] = React.useState(
    initialRegion || DEFAULT_REGIONS[provider] || "eastus",
  );
  const [pricing, setPricing] = React.useState("hourly");
  const [currency, setCurrency] = React.useState("usd");
  const [pricingUnit, setPricingUnit] = React.useState("instance");
  const [reservedPlan, setReservedPlan] = React.useState(
    provider.toUpperCase() === "GCP" ? "ondemand" : "payasyougo"
  );
  const [azureHybridBenefit, setAzureHybridBenefit] = React.useState("No"); // Yes, No
  const [isRestored, setIsRestored] = React.useState(false);

  // Initialize allData from module-level store if available (survives remounts)
  const initKey = `${provider.toLowerCase()}:${initialRegion || DEFAULT_REGIONS[provider] || "eastus"}`;
  const [allData, setAllData] = React.useState<any[]>(
    () => regionStore[initKey] ?? [],
  );
  const [isLoading, setIsLoading] = React.useState(
    () => !(regionStore[initKey]?.length > 0),
  );

  // Restore filter state from localStorage when provider changes
  React.useEffect(() => {
    setIsRestored(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("lastViewedProvider", provider.toLowerCase());
    }
    const saved = loadFilterState(provider);
    if (saved) {
      if (saved.region && saved.region !== region) setRegion(saved.region);
      if (saved.pricing) setPricing(saved.pricing);
      if (saved.currency) setCurrency(saved.currency);
      if (saved.pricingUnit) setPricingUnit(saved.pricingUnit);
      if (saved.reservedPlan) {
        const options = COMMITMENT_OPTIONS[provider.toUpperCase()] || [];
        const isValid = options.some((opt) => opt.value === saved.reservedPlan);
        if (isValid) {
          setReservedPlan(saved.reservedPlan);
        } else {
          setReservedPlan(
            provider.toUpperCase() === "GCP" ? "ondemand" : "payasyougo"
          );
        }
      }
      if (saved.columnFilters && saved.columnFilters.length > 0) {
        setColumnFilters(saved.columnFilters as ColumnFiltersState);
      } else {
        setColumnFilters([]);
      }
      if (saved.sorting && saved.sorting.length > 0) {
        setSorting(saved.sorting as SortingState);
      } else {
        setSorting([]);
      }
    } else {
      // Default fallback if no cache available for this provider
      setReservedPlan(
        provider.toUpperCase() === "GCP" ? "ondemand" : "payasyougo"
      );
      setRegion(DEFAULT_REGIONS[provider.toUpperCase() as keyof typeof DEFAULT_REGIONS] || "");
    }
    setIsRestored(true);
  }, [provider]);

  // Sync initialRegion prop back to state on Next.js soft-navigation
  React.useEffect(() => {
    if (initialRegion && initialRegion !== region) {
      setRegion(initialRegion);
    }
  }, [initialRegion]);



  // Persist filter state whenever it changes
  React.useEffect(() => {
    // Skip the initial render before restoration
    if (!isRestored) return;

    const debounce = setTimeout(() => {
      saveFilterState(provider, {
        region,
        pricing,
        currency,
        pricingUnit,
        reservedPlan,
        columnFilters: columnFilters as { id: string; value: unknown }[],
        sorting: sorting as { id: string; desc: boolean }[],
      });
    }, 300);
    return () => clearTimeout(debounce);
  }, [
    provider,
    region,
    pricing,
    currency,
    pricingUnit,
    reservedPlan,
    columnFilters,
    sorting,
  ]);

  const columns = React.useMemo(() => {
    const cols = getColumns(provider);
    return cols.map((c: any) => {
      const isAdv =
        c.meta?.isAdvanced ||
        ["vcpus", "memory", "storage"].includes(c.accessorKey);
      return isAdv ? { ...c, filterFn: advancedFilterFn } : c;
    });
  }, [provider]);

  React.useEffect(() => {
    const visibility: VisibilityState = {};
    columns.forEach((col: any) => {
      if (col.meta?.isAdvanced) {
        visibility[col.id || col.accessorKey] = false;
      }
    });
    setColumnVisibility(visibility);
  }, [columns]);

  // ─── Primary data load: instant from memory, or fetch + decode ────
  React.useEffect(() => {
    const providerLower = provider.toLowerCase();
    const cacheKey = `${providerLower}:${region}`;

    // INSTANT path — data already in memory from background warming
    if (regionStore[cacheKey]?.length) {
      console.log(`[DataTable] ⚡ Instant swap for ${cacheKey}`);
      setAllData(regionStore[cacheKey]);
      setIsLoading(false);
      return;
    }

    // FETCH path — first visit to this region (don't clear allData to avoid flash)
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        let manifest: any = null;
        try {
          const manifestRes = await cachedFetch(
            `${API_BASE}/meta/index.json`,
            1 * 60 * 1000,
          );
          if (manifestRes.ok) manifest = await manifestRes.json();
        } catch {}

        const instances = await fetchAndDecode(providerLower, region, manifest);

        if (!cancelled) {
          regionStore[cacheKey] = instances;
          setAllData(instances);
          console.log(
            `[DataTable] Loaded ${instances.length} instances for ${cacheKey}`,
          );
        }
      } catch (err) {
        if (!cancelled) {
          if (process.env.NODE_ENV !== "production") {
            console.error("[DataTable] Failed to load data:", err);
          }
          setAllData([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [provider, region]);

  // ─── Background warming: eagerly decode ALL regions across ALL providers ──
  React.useEffect(() => {
    if (warmingProvider === "ALL_DONE" || warmingProvider === "ALL_RUNNING")
      return;

    warmingAbort?.abort();
    const abort = new AbortController();
    warmingAbort = abort;
    warmingProvider = "ALL_RUNNING";

    const warmAll = async () => {
      try {
        const manifestRes = await cachedFetch(
          `${API_BASE}/meta/index.json`,
          1 * 60 * 1000,
        );
        if (!manifestRes.ok) return;
        const manifest = await manifestRes.json();

        // Get list of all providers defined in manifest (aws, azure, gcp)
        const providersList = Object.keys(manifest.providers ?? {});

        console.log(
          `[DataTable] 🔥 Warming all data triggers for: ${providersList.join(", ")}`,
        );

        for (const prov of providersList) {
          if (abort.signal.aborted) return;

          const regionEntries = manifest.providers[prov]?.regions ?? [];
          if (!regionEntries.length) continue;

          console.log(
            `[DataTable] 🔥 Background warming ${regionEntries.length} regions for ${prov}`,
          );

          const BATCH_SIZE = 4;
          for (let i = 0; i < regionEntries.length; i += BATCH_SIZE) {
            if (abort.signal.aborted) return;

            const batch = regionEntries.slice(i, i + BATCH_SIZE);
            await Promise.all(
              batch.map(async (entry: any) => {
                const rid = entry.id;
                const key = `${prov}:${rid}`;

                if (regionStore[key]?.length) return;

                try {
                  const instances = await fetchAndDecode(prov, rid, manifest);
                  if (!abort.signal.aborted) {
                    regionStore[key] = instances;
                  }
                } catch {}
              }),
            );

            await new Promise((r) => setTimeout(r, 50));
          }
        }

        console.log(
          "[DataTable] ✅ Global warming complete for all providers!",
        );
        warmingProvider = "ALL_DONE";
      } catch {
        warmingProvider = null; // scale back reset on fail
      }
    };

    const timer = setTimeout(warmAll, 500);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  const [fetchedRegions, setFetchedRegions] = React.useState<FilterOption[]>(
    [],
  );

  const CURRENCIES = [
    { label: "USD - US Dollar", value: "usd" },
    { label: "EUR - Euro", value: "eur" },
    { label: "GBP - British Pound", value: "gbp" },
    { label: "JPY - Japanese Yen", value: "jpy" },
    { label: "AUD - Australian Dollar", value: "aud" },
    { label: "CAD - Canadian Dollar", value: "cad" },
    { label: "CHF - Swiss Franc", value: "chf" },
    { label: "CNY - Chinese Yuan", value: "cny" },
    { label: "INR - Indian Rupee", value: "inr" },
    { label: "BRL - Brazilian Real", value: "brl" },
    { label: "RUB - Russian Ruble", value: "rub" },
    { label: "KRW - South Korean Won", value: "krw" },
    { label: "MXN - Mexican Peso", value: "mxn" },
    { label: "SGD - Singapore Dollar", value: "sgd" },
    { label: "HKD - Hong Kong Dollar", value: "hkd" },
    { label: "NOK - Norwegian Krone", value: "nok" },
    { label: "SEK - Swedish Krona", value: "sek" },
    { label: "DKK - Danish Krone", value: "dkk" },
    { label: "PLN - Polish Zloty", value: "pln" },
    { label: "TRY - Turkish Lira", value: "try" },
    { label: "IDR - Indonesian Rupiah", value: "idr" },
    { label: "ZAR - South African Rand", value: "zar" },
    { label: "AED - UAE Dirham", value: "aed" },
    { label: "SAR - Saudi Riyal", value: "sar" },
    { label: "THB - Thai Baht", value: "thb" },
    { label: "MYR - Malaysian Ringgit", value: "myr" },
    { label: "VND - Vietnamese Dong", value: "vnd" },
    { label: "PHP - Philippine Peso", value: "php" },
    { label: "TWD - Taiwan Dollar", value: "twd" },
    { label: "ILS - Israeli Shekel", value: "ils" },
    { label: "NZD - New Zealand Dollar", value: "nzd" },
    { label: "CZK - Czech Koruna", value: "czk" },
    { label: "CLP - Chilean Peso", value: "clp" },
    { label: "COP - Colombian Peso", value: "cop" },
    { label: "PEN - Peruvian Sol", value: "pen" },
    { label: "ARS - Argentine Peso", value: "ars" },
    { label: "HUF - Hungarian Forint", value: "huf" },
    { label: "RON - Romanian Leu", value: "ron" },
    { label: "PKR - Pakistani Rupee", value: "pkr" },
    { label: "BDT - Bangladeshi Taka", value: "bdt" },
    { label: "UAH - Ukrainian Hryvnia", value: "uah" },
    { label: "KZT - Kazakhstani Tenge", value: "kzt" },
    { label: "EGP - Egyptian Pound", value: "egp" },
    { label: "NGN - Nigerian Naira", value: "ngn" },
    { label: "KES - Kenyan Shilling", value: "kes" },
    { label: "GHS - Ghanaian Cedi", value: "ghs" },
    { label: "MAD - Moroccan Dirham", value: "mad" },
    { label: "QAR - Qatari Riyal", value: "qar" },
    { label: "KWD - Kuwaiti Dinar", value: "kwd" },
    { label: "OMR - Omani Rial", value: "omr" },
    { label: "BHD - Bahraini Dinar", value: "bhd" },
    { label: "JOD - Jordanian Dinar", value: "jod" },
    { label: "ISK - Icelandic Króna", value: "isk" },
    { label: "HRK - Croatian Kuna", value: "hrk" },
    { label: "BGN - Bulgarian Lev", value: "bgn" },
    { label: "TJS - Tajikistani Somoni", value: "tjs" },
    { label: "UZS - Uzbekistani Som", value: "uzs" },
    { label: "AZN - Azerbaijani Manat", value: "azn" },
    { label: "GEL - Georgian Lari", value: "gel" },
    { label: "AMD - Armenian Dram", value: "amd" },
    { label: "MNT - Mongolian Tögrög", value: "mnt" },
    { label: "LKR - Sri Lankan Rupee", value: "lkr" },
    { label: "NPR - Nepalese Rupee", value: "npr" },
    { label: "MUR - Mauritian Rupee", value: "mur" },
    { label: "SCR - Seychellois Rupee", value: "scr" },
    { label: "MVR - Maldivian Rufiyaa", value: "mvr" },
    { label: "FJD - Fijian Dollar", value: "fjd" },
    { label: "XPF - CFP Franc", value: "xpf" },
    { label: "XOF - CFA Franc", value: "xof" },
    { label: "XAF - CFA Franc", value: "xaf" },
    { label: "BND - Brunei Dollar", value: "bnd" },
    { label: "MMK - Myanmar Kyat", value: "mmk" },
    { label: "KHR - Cambodian Riel", value: "khr" },
    { label: "LAK - Lao Kip", value: "lak" },
    { label: "MOP - Macanese Pataca", value: "mop" },
    { label: "BMD - Bermudian Dollar", value: "bmd" },
    { label: "KYD - Cayman Islands Dollar", value: "kyd" },
    { label: "BBD - Barbadian Dollar", value: "bbd" },
    { label: "JMD - Jamaican Dollar", value: "jmd" },
    { label: "TTD - Trinidad and Tobago Dollar", value: "ttd" },
  ];

  const regionSearchInputRef = React.useRef<HTMLInputElement>(null);
  const prefetchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const handleRegionPrefetch = React.useCallback(
    (regionValue: string) => {
      if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = setTimeout(() => {
        router.prefetch(`/${provider.toLowerCase()}/${regionValue}`);
      }, 100);
    },
    [router, provider],
  );

  React.useEffect(() => {
    return () => {
      if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    const fetchRegions = async () => {
      try {
        const response = await cachedFetch(
          `${API_BASE}/meta/index.json`,
          1 * 60 * 1000,
        );
        if (response.ok) {
          const manifest = await response.json();
          const providerLower = provider.toLowerCase();
          const providerData = manifest.providers?.[providerLower];
          if (providerData?.regions) {
            const regions = providerData.regions.map((r: any) => ({
              label: r.label || r.id,
              value: r.id,
            }));
            setFetchedRegions(regions);
          }
        }
      } catch {
        if (process.env.NODE_ENV !== "production") {
          console.error(`Failed to fetch regions from backend`);
        }
      }
    };
    fetchRegions();
  }, [provider]);

  React.useEffect(() => {
    setRowSelection({});
    // When provider changes, restore any persisted filters for that provider
    const saved = loadFilterState(provider);
    if (saved) {
      if (saved.columnFilters && saved.columnFilters.length > 0) {
        setColumnFilters(saved.columnFilters as ColumnFiltersState);
      } else {
        setColumnFilters([]);
      }
      if (saved.sorting && saved.sorting.length > 0) {
        setSorting(saved.sorting as SortingState);
      }
      if (saved.pricing) setPricing(saved.pricing);
      if (saved.currency) setCurrency(saved.currency);
      if (saved.pricingUnit) setPricingUnit(saved.pricingUnit);
    } else {
      setColumnFilters([]);
    }
  }, [provider]);

  const data: Instance[] = React.useMemo(() => {
    const providerLower = provider.toLowerCase();

    // Pricing multipliers relative to Hourly
    const multipliers: Record<string, number> = {
      seconds: 1 / 3600,
      minutes: 1 / 60,
      hourly: 1,
      weekly: 24 * 7,
      monthly: 24 * 30,
      yearly: 24 * 365,
    };
    const mult = multipliers[pricing] || 1;
    const unitLabel = pricing.toLowerCase();

    // Unified 2026 Exchange Rates (USD base)
    const exchangeRates: Record<string, { rate: number; symbol: string }> = {
      usd: { rate: 1, symbol: "$" },
      eur: { rate: 0.85, symbol: "€" },
      gbp: { rate: 0.74, symbol: "£" },
      jpy: { rate: 155.78, symbol: "¥" },
      aud: { rate: 1.42, symbol: "A$" },
      cad: { rate: 1.37, symbol: "C$" },
      chf: { rate: 1.29, symbol: "CHF " },
      cny: { rate: 6.91, symbol: "¥" },
      inr: { rate: 90.73, symbol: "₹" },
      brl: { rate: 5.12, symbol: "R$" },
      rub: { rate: 92.45, symbol: "₽" },
      krw: { rate: 1345.5, symbol: "₩" },
      mxn: { rate: 17.05, symbol: "$" },
      sgd: { rate: 1.27, symbol: "S$" },
      hkd: { rate: 7.82, symbol: "HK$" },
      nok: { rate: 10.55, symbol: "kr" },
      sek: { rate: 10.42, symbol: "kr" },
      dkk: { rate: 6.85, symbol: "kr" },
      pln: { rate: 3.98, symbol: "zł" },
      try: { rate: 34.2, symbol: "₺" },
      idr: { rate: 15850, symbol: "Rp" },
      zar: { rate: 18.95, symbol: "R" },
      aed: { rate: 3.67, symbol: "د.إ" },
      sar: { rate: 3.75, symbol: "﷼" },
      thb: { rate: 31.05, symbol: "฿" },
      myr: { rate: 4.72, symbol: "RM" },
      vnd: { rate: 24650, symbol: "₫" },
      php: { rate: 56.12, symbol: "₱" },
      twd: { rate: 31.45, symbol: "NT$" },
      ils: { rate: 3.65, symbol: "₪" },
      nzd: { rate: 1.62, symbol: "NZ$" },
      czk: { rate: 23.45, symbol: "Kč" },
      clp: { rate: 945, symbol: "$" },
      cop: { rate: 3950, symbol: "$" },
      pen: { rate: 3.82, symbol: "S/" },
      ars: { rate: 850, symbol: "$" },
      huf: { rate: 362, symbol: "Ft" },
      ron: { rate: 4.58, symbol: "lei" },
      pkr: { rate: 279, symbol: "₨" },
      bdt: { rate: 110, symbol: "৳" },
      uah: { rate: 38.5, symbol: "₴" },
      kzt: { rate: 452, symbol: "₸" },
      egp: { rate: 30.9, symbol: "E£" },
      ngn: { rate: 1450, symbol: "₦" },
      kes: { rate: 145, symbol: "KSh" },
      ghs: { rate: 12.5, symbol: "GH₵" },
      mad: { rate: 10.15, symbol: "DH" },
      qar: { rate: 3.64, symbol: "﷼" },
      kwd: { rate: 0.31, symbol: "KD" },
      omr: { rate: 0.385, symbol: "RO" },
      bhd: { rate: 0.376, symbol: "BD" },
      jod: { rate: 0.71, symbol: "JD" },
      isk: { rate: 138, symbol: "kr" },
      hrk: { rate: 7.05, symbol: "kn" },
      bgn: { rate: 1.81, symbol: "лв" },
      tjs: { rate: 10.9, symbol: "SM" },
      uzs: { rate: 12450, symbol: "so'm" },
      azn: { rate: 1.7, symbol: "₼" },
      gel: { rate: 2.68, symbol: "₾" },
      amd: { rate: 402, symbol: "֏" },
      mnt: { rate: 3450, symbol: "₮" },
      lkr: { rate: 312, symbol: "₨" },
      npr: { rate: 133, symbol: "₨" },
      mur: { rate: 45.2, symbol: "₨" },
      scr: { rate: 13.5, symbol: "₨" },
      mvr: { rate: 15.4, symbol: "Rf" },
      fjd: { rate: 2.22, symbol: "FJ$" },
      xpf: { rate: 110.5, symbol: "₣" },
      xof: { rate: 605, symbol: "CFA" },
      xaf: { rate: 605, symbol: "FCFA" },
      bnd: { rate: 1.34, symbol: "B$" },
      mmk: { rate: 2100, symbol: "K" },
      khr: { rate: 4100, symbol: "៛" },
      lak: { rate: 21000, symbol: "₭" },
      mop: { rate: 8.05, symbol: "P" },
      bmd: { rate: 1, symbol: "$" },
      kyd: { rate: 0.83, symbol: "$" },
      bbd: { rate: 2, symbol: "$" },
      jmd: { rate: 155, symbol: "J$" },
      ttd: { rate: 6.75, symbol: "TT$" },
    };
    const currencyInfo = exchangeRates[currency] || { rate: 1, symbol: "$" };

    return allData.map((item: any, index: number) => {
      // New format: pricing is flat in item.pr (already region-specific)
      const pr = item.pr || {};

      const formatCost = (baseCost?: number) => {
        if (baseCost === undefined || baseCost === null || baseCost <= 0)
          return "-";

        let unitValue = 1;
        let pricingUnitSuffix = "";

        if (pricingUnit === "vcpu") {
          unitValue = Number(item.v) || 1;
          pricingUnitSuffix = " / vCPU";
        } else if (pricingUnit === "memory") {
          unitValue = Number(item.m) || 1;
          pricingUnitSuffix = " / GiB";
        } else if (pricingUnit === "ecu") {
          unitValue = Number(item.e) || 1;
          pricingUnitSuffix = " / ECU";
        }

        const calculated = (baseCost / unitValue) * mult;
        const precision =
          unitLabel === "seconds" || unitLabel === "minutes" ? 6 : 4;
        const displayUnit =
          pricing === "hourly"
            ? "hourly"
            : pricing === "weekly"
              ? "weekly"
              : pricing === "monthly"
                ? "monthly"
                : pricing === "yearly"
                  ? "yearly"
                  : pricing === "minutes"
                    ? "minutely"
                    : "secondly";

        const convertedCost = calculated * currencyInfo.rate;
        const formattedPrice = Number(convertedCost).toFixed(precision);
        const spacer = currencyInfo.symbol.length > 1 ? " " : "";

        return `${currencyInfo.symbol}${spacer}${formattedPrice} ${displayUnit}${pricingUnitSuffix}`;
      };

      // New short-key format: n=name, f=family, v=vCPUs, m=memory, p=processor, a=arch, s=storage, nw=network
      const apiName = item.n || "";
      const name = item.n || "";
      const family = item.f || "";


      let linuxKey = "linuxOnDemand";
      let windowsKey = "windowsOnDemand";
      let rhelKey = "rhelOnDemand";
      let ubuntuKey = "ubuntuOnDemand";
      let slesKey = "slesOnDemand";

      if (provider.toUpperCase() === "AWS") {
        if (reservedPlan === "payasyougo") {
          linuxKey = "linuxOnDemand";
          windowsKey = "windowsOnDemand";
        } else if (reservedPlan.startsWith("ri_")) {
          const type = reservedPlan.split("_")[2]; // no, partial, all
          const is3y = reservedPlan.startsWith("ri_3y");
          const term = is3y ? "3yr" : "1yr";
          const suffix = type === "no" ? "NoUpfront" : type === "partial" ? "PartialUpfront" : "AllUpfront";
          linuxKey = `linuxReserved${term}Standard${suffix}`;
          windowsKey = `windowsReserved${term}Standard${suffix}`;
        } else if (reservedPlan.startsWith("sp_compute_")) {
          const is3y = reservedPlan.includes("3y");
          const term = is3y ? "3yr" : "1yr";
          linuxKey = `linuxSavingsCompute${term}NoUpfront`;
          windowsKey = `windowsSavingsCompute${term}NoUpfront`;
        } else if (reservedPlan.startsWith("sp_instance_")) {
          const is3y = reservedPlan.includes("3y");
          const term = is3y ? "3yr" : "1yr";
          linuxKey = `linuxSavingsInstance${term}NoUpfront`;
          windowsKey = `windowsSavingsInstance${term}NoUpfront`;
        }
      } else if (provider.toUpperCase() === "AZURE") {
        const isHB = azureHybridBenefit === "Yes";
        const costType = reservedPlan; // payasyougo, reserved1y, reserved3y, etc.
        linuxKey = `linux_${costType}`;
        windowsKey = isHB ? `linux_${costType}` : `windows_${costType}`;
        rhelKey = `rhel_${costType}`;
        ubuntuKey = `ubuntu_${costType}`;
        slesKey = `sles_${costType}`;
      } else if (provider.toUpperCase() === "GCP") {
        if (reservedPlan === "ondemand" || reservedPlan === "payasyougo") {
          linuxKey = "linuxOnDemand";
        } else if (reservedPlan === "sustained") {
          linuxKey = "linuxSustainedDiscounts100";
        } else if (reservedPlan === "spot") {
          linuxKey = "linuxSpot";
        } else if (reservedPlan === "commit_1y") {
          linuxKey = "linuxCommit1Yr";
        } else if (reservedPlan === "commit_3y") {
          linuxKey = "linuxCommit3Yr";
        }
      }

      const linuxCost = formatCost(pr[linuxKey]);
      const windowsCost = formatCost(pr[windowsKey]);
      const rhelCost = formatCost(pr[rhelKey]);
      const ubuntuCost = formatCost(pr[ubuntuKey]);
      const slesCost = formatCost(pr[slesKey]);
      const instancePrice = provider.toUpperCase() === "GCP" ? linuxCost : undefined;

      const linuxOnDemandCost = formatCost(pr["linuxOnDemand"] || pr["linux_payasyougo"]);
      const linuxSpotCost = formatCost(pr["linuxSpot"] || pr["linux_spot"] || pr["ubuntu_spot"]);
      const windowsOnDemandCost = formatCost(pr["windowsOnDemand"] || pr["windows_payasyougo"]);
      const windowsSpotCost = formatCost(pr["windowsSpot"] || pr["windows_spot"]);

      return {
        id: `${provider}-${region}-${index}`,
        name,
        apiName,
        family,
        vcpus: item.v || "",
        memory: item.m ? `${item.m} GiB` : "",
        network: item.nw || "",
        storage: item.s || "-",
        linuxCost,
        windowsCost,
        rhelCost,
        ubuntuCost,
        slesCost,
        instancePrice,
        linuxOnDemandCost,
        linuxSpotCost,
        windowsOnDemandCost,
        windowsSpotCost,
        region: region,
        provider: provider,

        // Technical Specs (mapped from short keys)
        processor: item.p || "",
        clockSpeed: "",
        architecture: item.a || "",
        memoryPerVCPU:
          item.v && item.m ? `${(item.m / item.v).toFixed(1)} GiB` : "",
        l3Cache: "",
        gpuCount: item.gc ?? 0,
        gpuName: item.gn || "",
        gpuMemory: "",
        numaNodes: "",
        enhancedNetwork: "",
        ipv6: "",
        bareMetal: "",
        generation: "",
        ebsBandwidth: "",
        coreMark: "",
        ffmpegFPS: "",
        emr: "",
        hibernation: "",
      };
    });
  }, [allData, provider, region, pricing, currency, pricingUnit, reservedPlan]);

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    state: { sorting, columnFilters, columnVisibility, rowSelection },
  });

  const regionsData = React.useMemo(() => {
    // Regions are loaded dynamically from backend index.json
    return fetchedRegions;
  }, [fetchedRegions]);

  const parentRef = React.useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 42,
    measureElement: (element) => element.getBoundingClientRect().height,
    overscan: 20,
    scrollMargin: 0,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalHeight - virtualRows[virtualRows.length - 1].end
      : 0;

  const clearFilters = () => {
    table.resetColumnFilters();
    setColumnFilters([]);
    setSorting([]);
    setPricing("hourly");
    setCurrency("usd");
    setPricingUnit("instance");
    const defaultPlan =
      provider.toUpperCase() === "GCP" ? "ondemand" : "payasyougo";
    setReservedPlan(defaultPlan);
    const defaultR = DEFAULT_REGIONS[provider] || "eastus";
    if (region !== defaultR) {
      const cacheKey = `${provider.toLowerCase()}:${defaultR}`;
      if (regionStore[cacheKey]?.length) {
        setAllData(regionStore[cacheKey]);
        setIsLoading(false);
      }
      setRegion(defaultR);
      window.history.replaceState(
        null,
        "",
        `/${provider.toLowerCase()}/${defaultR}`,
      );
    }
    // Clear persisted state
    saveFilterState(provider, {});
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end gap-3 mb-6">
        {/* Columns Dropdown */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold text-neutral-500 tracking-wider ml-1">
            Columns
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              asChild
              className="focus-visible:ring-0 focus:ring-0 focus:outline-none border-none shadow-none outline-none cursor-pointer"
            >
              <button className="flex items-center justify-between w-[160px] bg-neutral-900 border border-neutral-800 h-10 text-white rounded-lg px-4 hover:bg-neutral-800 transition-colors text-sm outline-none focus:outline-none focus-visible:outline-none">
                <span className="truncate">Select Display</span>
                <ChevronDown
                  className="h-4 w-4 text-neutral-500"
                  strokeWidth={2}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="bg-neutral-900 border-neutral-800 text-white min-w-[220px] shadow-2xl"
            >
              <div className="p-2 flex gap-2 border-b border-neutral-800 mb-1">
                <button
                  onClick={() => table.toggleAllColumnsVisible(true)}
                  className="text-[10px] bg-neutral-800 hover:bg-neutral-700 px-2 py-1 rounded transition-colors uppercase font-bold text-neutral-400"
                >
                  Select All
                </button>
                <button
                  onClick={() => {
                    const reset: VisibilityState = {};
                    columns.forEach((col: any) => {
                      if (col.meta?.isAdvanced) {
                        reset[col.id || col.accessorKey] = false;
                      }
                    });
                    setColumnVisibility(reset);
                  }}
                  className="text-[10px] bg-neutral-800 hover:bg-neutral-700 px-2 py-1 rounded transition-colors uppercase font-bold text-neutral-400"
                >
                  Reset
                </button>
              </div>
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                {table
                  .getAllColumns()
                  .filter((c) => c.getCanHide())
                  .map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.id}
                      className="capitalize py-2"
                      checked={c.getIsVisible()}
                      onCheckedChange={(v) => c.toggleVisibility(!!v)}
                    >
                      {c.columnDef.header?.toString() || c.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Region Filter */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold text-neutral-500 tracking-wider ml-1">
            Region
          </span>
          <FilterDropdown
            label="Region"
            value={region}
            options={regionsData}
            onSelect={(val) => {
              // Synchronous instant swap: set data BEFORE React re-renders
              const cacheKey = `${provider.toLowerCase()}:${val}`;
              if (regionStore[cacheKey]?.length) {
                setAllData(regionStore[cacheKey]);
                setIsLoading(false);
              }

              setRegion(val);

              // Shallow URL update — no Next.js navigation/remount
              window.history.replaceState(
                null,
                "",
                `/${provider.toLowerCase()}/${val}`,
              );

              // Persist filter state
              saveFilterState(provider, {
                region: val,
                pricing,
                currency,
                pricingUnit,
                reservedPlan,
                columnFilters: columnFilters as {
                  id: string;
                  value: unknown;
                }[],
                sorting: sorting as { id: string; desc: boolean }[],
              });
            }}
            searchable
            dropdownWidth="w-[320px]"
          />
        </div>

        {/* Payment Term Filter */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold text-neutral-500 tracking-wider ml-1 whitespace-nowrap">
            Payment Term
          </span>
          <FilterDropdown
            label="Payment Term"
            value={reservedPlan}
            options={COMMITMENT_OPTIONS[provider.toUpperCase()] || []}
            onSelect={setReservedPlan}
            dropdownWidth="w-[200px]"
          />
        </div>

        {/* Azure Hybrid Benefit Filter */}
        {provider.toUpperCase() === "AZURE" && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-neutral-500 tracking-wider ml-1 whitespace-nowrap">
              Hybrid Benefit
            </span>
            <FilterDropdown
              label="Hybrid Benefit"
              value={azureHybridBenefit}
              options={[
                { value: "No", label: "No" },
                { value: "Yes", label: "Yes" },
              ]}
              onSelect={setAzureHybridBenefit}
              dropdownWidth="w-[160px]"
            />
          </div>
        )}

        {/* Pricing Unit Filter */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold text-neutral-500 tracking-wider ml-1">
            Pricing Unit
          </span>
          <FilterDropdown
            label="Pricing Unit"
            value={pricingUnit}
            options={[
              { value: "instance", label: "Instance" },
              { value: "vcpu", label: "vCPU" },
              { value: "ecu", label: "ECU" },
              { value: "memory", label: "Memory (GiB)" },
            ]}
            onSelect={setPricingUnit}
            dropdownWidth="w-[180px]"
          />
        </div>

        {/* Pricing Filter */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold text-neutral-500 tracking-wider ml-1">
            Pricing
          </span>
          <FilterDropdown
            label="Pricing"
            value={pricing}
            options={[
              { value: "seconds", label: "Per second" },
              { value: "minutes", label: "Per minute" },
              { value: "hourly", label: "Per hour" },
              { value: "weekly", label: "Per week" },
              { value: "monthly", label: "Per month" },
              { value: "yearly", label: "Per year" },
            ]}
            onSelect={setPricing}
            dropdownWidth="w-[180px]"
          />
        </div>

        {/* Currency Filter */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold text-neutral-500 tracking-wider ml-1">
            Currency
          </span>
          <FilterDropdown
            label="Currency"
            value={currency}
            options={CURRENCIES}
            onSelect={setCurrency}
            searchable
            dropdownWidth="w-[280px]"
          />
        </div>

        {/* Clear Filters Button */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold transparent uppercase tracking-wider ml-1 select-none opacity-0">
            Spacing
          </span>
          <Button
            variant="ghost"
            onClick={clearFilters}
            className="text-blue-600 hover:text-blue-500 bg-transparent border-none hover:bg-blue-100 px-4 font-medium h-10! rounded-lg shadow-none transition-colors cursor-pointer"
          >
            Clear Filters
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 overflow-hidden shadow-2xl relative">
        <div
          ref={parentRef}
          className="overflow-auto custom-scrollbar max-h-[calc(100vh-240px)] min-h-[400px] relative"
        >
          <table
            style={{ width: table.getTotalSize() }}
            className="table-fixed border-collapse"
          >
            <colgroup>
              {table.getVisibleLeafColumns().map((column) => (
                <col
                  key={column.id}
                  style={{ width: `${column.getSize()}px` }}
                />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-30 bg-neutral-900">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header, idx) => (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      className="p-0 relative text-left font-normal border-b border-neutral-800 bg-neutral-900"
                    >
                      {!header.isPlaceholder && (
                        <div
                          className={`relative flex flex-col h-full overflow-hidden ${
                            header.column.getCanSort()
                              ? "cursor-pointer hover:bg-neutral-800/50"
                              : ""
                          }`}
                          onClick={() => {
                            if (header.column.getCanSort()) {
                              header.column.getToggleSortingHandler()?.(
                                {} as any,
                              );
                            }
                          }}
                        >
                          {/* Top part: Checkbox (centered) OR Title + Sort Icons */}
                          <div
                            className={`flex items-center w-full px-4 py-2 select-none whitespace-nowrap overflow-hidden ${
                              header.id === "select"
                                ? "justify-center"
                                : "justify-between"
                            }`}
                          >
                            {header.id === "select" ? (
                              flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )
                            ) : (
                              <>
                                <span className="text-[14px] font-bold text-neutral-400 overflow-hidden text-ellipsis">
                                  {flexRender(
                                    header.column.columnDef.header,
                                    header.getContext(),
                                  )}
                                </span>
                                {header.column.getCanSort() && (
                                  <span className="flex flex-col -space-y-1 ml-2 shrink-0">
                                    <ChevronUp
                                      className={`h-3 w-3 shrink-0 ${
                                        header.column.getIsSorted() === "asc"
                                          ? "text-white"
                                          : "text-neutral-600"
                                      }`}
                                      strokeWidth={3}
                                    />
                                    <ChevronDown
                                      className={`h-3 w-3 shrink-0 ${
                                        header.column.getIsSorted() === "desc"
                                          ? "text-white"
                                          : "text-neutral-600"
                                      }`}
                                      strokeWidth={3}
                                    />
                                  </span>
                                )}
                              </>
                            )}
                          </div>

                          {/* Bottom part: Filter OR Spacer */}
                          <div className="px-2 pb-2 mt-auto">
                            {header.column.getCanFilter() &&
                            header.id !== "select" ? (
                              <div onClick={(e) => e.stopPropagation()}>
                                <Filter column={header.column} />
                              </div>
                            ) : (
                              <div className="h-8" />
                            )}
                          </div>

                          {/* Column divider - skip for checkbox -> name boundary */}
                          {idx > 1 && (
                            <div className="absolute left-0 top-[10%] bottom-[10%] w-px bg-neutral-800" />
                          )}

                          {/* Resize handle - skip for checkbox */}
                          {header.id !== "select" && (
                            <div
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              onClick={(e) => e.stopPropagation()}
                              className={`absolute right-0 inset-y-0 w-1 cursor-col-resize select-none touch-none z-30 ${
                                header.column.getIsResizing()
                                  ? "bg-blue-500"
                                  : "hover:bg-blue-500/50"
                              }`}
                            />
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {paddingTop > 0 && (
                <tr>
                  <td
                    style={{ height: `${paddingTop}px` }}
                    colSpan={table.getVisibleLeafColumns().length}
                  />
                </tr>
              )}
              {virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index];
                const isSelected = row.getIsSelected();
                return (
                  <tr
                    key={row.id}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className={`border-b border-neutral-800 transition-colors cursor-pointer ${
                      isSelected ? "bg-blue-950/30!" : "hover:bg-neutral-800/20"
                    }`}
                    onClick={() => row.toggleSelected()}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="py-2 border-none text-left">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {paddingBottom > 0 && (
                <tr>
                  <td
                    style={{ height: `${paddingBottom}px` }}
                    colSpan={table.getVisibleLeafColumns().length}
                  />
                </tr>
              )}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={table.getVisibleLeafColumns().length}
                    className="h-32 text-center text-neutral-500 font-medium"
                  >
                    No results found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compare Bar */}
      {selectedCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-neutral-950 border-t border-neutral-900 backdrop-blur-3xl px-8 py-3.5 flex items-center justify-between animate-in slide-in-from-bottom-full duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-8 overflow-hidden">
            {selectedCount <= 3 ? (
              <>
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                  <span className="text-[12px] font-bold text-white tracking-tight uppercase opacity-90 whitespace-nowrap">
                    Selected Instances
                  </span>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar no-scrollbar py-1">
                  {table.getSelectedRowModel().rows.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center gap-2 bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/50 py-1.5 pl-3 pr-2 rounded-full transition-all group/chip shrink-0"
                    >
                      <span className="text-[11px] font-mono text-neutral-300 group-hover/chip:text-white truncate max-w-[120px]">
                        {row.original.apiName}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          row.toggleSelected(false);
                        }}
                        className="hover:bg-neutral-700 p-0.5 rounded-full text-neutral-500 hover:text-white transition-colors cursor-pointer"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <span className="text-[12px] font-bold text-neutral-500 tracking-tight opacity-90 whitespace-nowrap">
                <span className="text-white"> {selectedCount} </span>
                &nbsp;&nbsp;Instances Selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 shrink-0 pl-8">
            <Button
              variant="ghost"
              onClick={() => setRowSelection({})}
              className="text-[11px] font-bold text-neutral-500 hover:text-white cursor-pointer uppercase tracking-wider h-9 px-4 transition-colors"
            >
              Clear All
            </Button>
            <Link
              href={`/compare?provider=${provider.toLowerCase()}&region=${region}&instances=${table
                .getSelectedRowModel()
                .rows.map((r) => r.original.apiName)
                .join(",")}`}
            >
              <Button
                disabled={selectedCount < 2 || selectedCount > 3}
                className={`text-[13px] font-bold px-8 h-10 rounded-full shadow-lg transition-all ${
                  selectedCount >= 2 && selectedCount <= 3
                    ? "bg-white hover:bg-neutral-200 text-black cursor-pointer"
                    : "bg-neutral-200 text-black cursor-not-allowed"
                }`}
              >
                {selectedCount > 3 ? "Compare" : `Compare (${selectedCount})`}
              </Button>
            </Link>
          </div>
        </div>
      )}

      <div className="flex justify-end mt-2.5 px-0.5">
        <span className="text-[14px] font-medium text-neutral-500 select-none">
          {rows.length.toLocaleString()} instances
        </span>
      </div>
    </div>
  );
}
