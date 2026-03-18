"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { decompress as zstdDecompress } from "fzstd";
import { decode } from "@msgpack/msgpack";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Check,
  Search,
  Info,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  FilterDropdown,
  type FilterOption,
} from "@/components/ui/filter-dropdown";
import { cachedFetch } from "@/lib/cache";
import { getDataUrl } from "@/lib/api-utils";

const API_BASE = process.env.NEXT_PUBLIC_BLOB_CDN_URL || "/api/data";

interface InstanceDetailProps {
  provider: string;
  region: string;
  instanceName: string;
}

interface RawInstance {
  n: string;
  f: string;
  v: number;
  m: number;
  p: string;
  a: string;
  s: string;
  nw: string;
  g: boolean;
  gc: number;
  gn: string | null;
  pr: Record<string, number>;
  [key: string]: any;
}

// ─── Exchange rates ──────────────────────────────────────────────
const CURRENCIES = [
  { label: "USD - US Dollar", value: "usd", symbol: "$" },
  { label: "EUR - Euro", value: "eur", symbol: "€" },
  { label: "GBP - British Pound", value: "gbp", symbol: "£" },
  { label: "JPY - Japanese Yen", value: "jpy", symbol: "¥" },
  { label: "AUD - Australian Dollar", value: "aud", symbol: "A$" },
  { label: "CAD - Canadian Dollar", value: "cad", symbol: "C$" },
  { label: "CHF - Swiss Franc", value: "chf", symbol: "CHF" },
  { label: "CNY - Chinese Yuan", value: "cny", symbol: "¥" },
  { label: "INR - Indian Rupee", value: "inr", symbol: "₹" },
  { label: "BRL - Brazilian Real", value: "brl", symbol: "R$" },
  { label: "RUB - Russian Ruble", value: "rub", symbol: "₽" },
  { label: "KRW - South Korean Won", value: "krw", symbol: "₩" },
  { label: "MXN - Mexican Peso", value: "mxn", symbol: "$" },
  { label: "SGD - Singapore Dollar", value: "sgd", symbol: "S$" },
  { label: "HKD - Hong Kong Dollar", value: "hkd", symbol: "HK$" },
  { label: "NOK - Norwegian Krone", value: "nok", symbol: "kr" },
  { label: "SEK - Swedish Krona", value: "sek", symbol: "kr" },
  { label: "DKK - Danish Krone", value: "dkk", symbol: "kr" },
  { label: "PLN - Polish Zloty", value: "pln", symbol: "zł" },
  { label: "TRY - Turkish Lira", value: "try", symbol: "₺" },
  { label: "IDR - Indonesian Rupiah", value: "idr", symbol: "Rp" },
  { label: "ZAR - South African Rand", value: "zar", symbol: "R" },
  { label: "AED - UAE Dirham", value: "aed", symbol: "د.إ" },
  { label: "SAR - Saudi Riyal", value: "sar", symbol: "﷼" },
  { label: "THB - Thai Baht", value: "thb", symbol: "฿" },
  { label: "MYR - Malaysian Ringgit", value: "myr", symbol: "RM" },
  { label: "VND - Vietnamese Dong", value: "vnd", symbol: "₫" },
  { label: "PHP - Philippine Peso", value: "php", symbol: "₱" },
  { label: "TWD - Taiwan Dollar", value: "twd", symbol: "NT$" },
  { label: "ILS - Israeli Shekel", value: "ils", symbol: "₪" },
  { label: "NZD - New Zealand Dollar", value: "nzd", symbol: "NZ$" },
  { label: "CZK - Czech Koruna", value: "czk", symbol: "Kč" },
  { label: "CLP - Chilean Peso", value: "clp", symbol: "$" },
  { label: "COP - Colombian Peso", value: "cop", symbol: "$" },
  { label: "PEN - Peruvian Sol", value: "pen", symbol: "S/" },
  { label: "ARS - Argentine Peso", value: "ars", symbol: "$" },
  { label: "HUF - Hungarian Forint", value: "huf", symbol: "Ft" },
  { label: "RON - Romanian Leu", value: "ron", symbol: "lei" },
  { label: "PKR - Pakistani Rupee", value: "pkr", symbol: "₨" },
  { label: "BDT - Bangladeshi Taka", value: "bdt", symbol: "৳" },
  { label: "UAH - Ukrainian Hryvnia", value: "uah", symbol: "₴" },
  { label: "KZT - Kazakhstani Tenge", value: "kzt", symbol: "₸" },
  { label: "EGP - Egyptian Pound", value: "egp", symbol: "E£" },
  { label: "NGN - Nigerian Naira", value: "ngn", symbol: "₦" },
  { label: "KES - Kenyan Shilling", value: "kes", symbol: "KSh" },
  { label: "GHS - Ghanaian Cedi", value: "ghs", symbol: "GH₵" },
  { label: "MAD - Moroccan Dirham", value: "mad", symbol: "DH" },
  { label: "QAR - Qatari Riyal", value: "qar", symbol: "﷼" },
  { label: "KWD - Kuwaiti Dinar", value: "kwd", symbol: "KD" },
  { label: "OMR - Omani Rial", value: "omr", symbol: "RO" },
  { label: "BHD - Bahraini Dinar", value: "bhd", symbol: "BD" },
  { label: "JOD - Jordanian Dinar", value: "jod", symbol: "JD" },
  { label: "ISK - Icelandic Króna", value: "isk", symbol: "kr" },
];

const EXCHANGE_RATES: Record<string, number> = {
  usd: 1,
  eur: 0.85,
  gbp: 0.74,
  jpy: 155.78,
  aud: 1.42,
  cad: 1.37,
  inr: 90.73,
  cny: 6.91,
  brl: 5.12,
  krw: 1345.5,
  sgd: 1.27,
  chf: 1.29,
  mxn: 17.05,
  hkd: 7.82,
  sek: 10.42,
  nok: 10.55,
  dkk: 6.85,
  pln: 3.98,
  try: 34.2,
  idr: 15850,
  zar: 18.95,
  aed: 3.67,
  sar: 3.75,
  thb: 31.05,
  nzd: 1.62,
  php: 56.12,
  ils: 3.65,
  twd: 31.45,
  myr: 4.72,
  pkr: 279,
  rub: 92.45,
  bdt: 110,
  uah: 38.5,
  kzt: 452,
  egp: 30.9,
  ngn: 1450,
  kes: 145,
  ghs: 12.5,
  mad: 10.15,
  qar: 3.64,
  kwd: 0.31,
  omr: 0.385,
  bhd: 0.376,
  jod: 0.71,
  isk: 138,
  clp: 945,
  cop: 3950,
  pen: 3.82,
  ars: 850,
  huf: 362,
  ron: 4.58,
  czk: 23.45,
};

// ─── Pricing intervals ──────────────────────────────────────────
const PRICING_INTERVALS = [
  { value: "seconds", label: "Per second", mult: 1 / 3600 },
  { value: "minutes", label: "Per minute", mult: 1 / 60 },
  { value: "hourly", label: "Per hour", mult: 1 },
  { value: "weekly", label: "Per week", mult: 24 * 7 },
  { value: "monthly", label: "Per month", mult: 24 * 30 },
  { value: "yearly", label: "Per year", mult: 24 * 365 },
];

// ─── Commitment options (Sync with data-table.tsx) ──────────────
const COMMITMENT_OPTIONS: Record<string, { label: string; value: string }[]> = {
  AWS: [
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
  AZURE: "Payment Term",
  GCP: "Commitment",
};

// ─── Detail table section ───────────────────────────────────────
function DetailSection({
  title,
  rows = [],
  children,
  defaultOpen = true,
}: {
  title: string;
  rows?: {
    label: string;
    value: string | number | boolean | null | undefined;
  }[];
  children?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  function renderValue(val: any): React.ReactNode {
    if (val === null || val === undefined || val === "" || val === "N/A") {
      return <span className="text-neutral-600">N/A</span>;
    }
    if (typeof val === "boolean") {
      return (
        <span
          className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-mono font-medium ${val ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}
        >
          {val ? "true" : "false"}
        </span>
      );
    }
    if (typeof val === "number") {
      return <span className="text-white font-mono text-sm">{val}</span>;
    }
    if (val === "true" || val === "false" || val === "Yes" || val === "No") {
      const boolVal = val === "true" || val === "Yes";
      return (
        <span
          className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-mono font-medium ${boolVal ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}
        >
          {val}
        </span>
      );
    }
    return <span className="text-white text-sm">{String(val)}</span>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-800/60 font-sans shadow-sm transition-all duration-200">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between bg-neutral-900/80 px-4 py-3 cursor-pointer select-none hover:bg-neutral-800 transition-colors"
      >
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
          {title}
        </h3>
        <ChevronDown
          className={`h-4 w-4 text-neutral-500 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`}
        />
      </div>
      {isOpen && (
        <div className="divide-y divide-neutral-800/30">
          {rows.map((row, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-neutral-900/40"
            >
              <span className="text-sm text-neutral-400 pr-4">{row.label}</span>
              <div className="text-right">{renderValue(row.value)}</div>
            </div>
          ))}
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────
export function InstanceDetail({
  provider,
  region: initialRegion,
  instanceName,
}: InstanceDetailProps) {
  const router = useRouter();

  // State
  const [instance, setInstance] = React.useState<RawInstance | null>(null);
  const [allInstances, setAllInstances] = React.useState<RawInstance[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Filter state
  const [region, setRegion] = React.useState(initialRegion);
  const [os, setOs] = React.useState("linux");
  const [pricingInterval, setPricingInterval] = React.useState("hourly");
  const [reservedPlan, setReservedPlan] = React.useState(
    provider.toUpperCase() === "GCP"
      ? "ondemand"
      : provider.toUpperCase() === "AWS"
        ? "ri_1y_no"
        : "payasyougo",
  );
  const [currency, setCurrency] = React.useState("usd");

  // Main pricing breakdown collapsibility
  const [isBreakoutOpen, setIsBreakoutOpen] = React.useState(true);

  // Region data
  const [allRegions, setAllRegions] = React.useState<
    { value: string; label: string }[]
  >([]);

  // Fetch regions
  React.useEffect(() => {
    const fetchRegions = async () => {
      try {
        const response = await cachedFetch(
          getDataUrl(`/meta/index.json`),
          12 * 60 * 60 * 1000,
        );
        if (response.ok) {
          const manifest = await response.json();
          const providerData = manifest.providers?.[provider.toLowerCase()];
          if (providerData?.regions) {
            setAllRegions(
              providerData.regions.map((r: any) => ({
                label: r.label || r.id,
                value: r.id,
              })),
            );
          }
        }
      } catch {
        /* ignore */
      }
    };
    fetchRegions();
  }, [provider]);

  // Fetch instance data
  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const url = getDataUrl(`/${provider.toLowerCase()}/${region}.msgpack.zst`);
        const response = await cachedFetch(url);
        if (!response.ok) {
          setError("Failed to fetch instance data");
          return;
        }
        const arrayBuffer = await response.arrayBuffer();
        const decompressed = zstdDecompress(new Uint8Array(arrayBuffer));
        const regionFile: any = decode(decompressed);

        if (regionFile?.instances) {
          setAllInstances(regionFile.instances);
          const found = regionFile.instances.find(
            (inst: any) => inst.n === instanceName,
          );
          if (found) setInstance(found);
          else setError(`Instance "${instanceName}" not found in this region`);
        } else setError("No instances in response");
      } catch {
        setError("Failed to load instance data");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [provider, region, instanceName]);

  const handleRegionChange = (newRegion: string) => {
    setRegion(newRegion);
    router.replace(
      `/${provider.toLowerCase()}/${newRegion}/instance/${encodeURIComponent(instanceName)}`,
    );
  };

  const formatCost = React.useCallback(
    (baseHourly: number | undefined | null): string => {
      if (!baseHourly || baseHourly <= 0) return "-";
      const interval =
        PRICING_INTERVALS.find((p) => p.value === pricingInterval) ||
        PRICING_INTERVALS[0];
      const rate = EXCHANGE_RATES[currency] || 1;
      const curr = CURRENCIES.find((c) => c.value === currency);
      const sym = curr?.symbol || "$";
      const converted = baseHourly * interval.mult * rate;
      return `${sym}${sym.length > 1 ? " " : ""}${converted.toFixed(converted > 100 ? 2 : converted > 1 ? 4 : 6)}`;
    },
    [pricingInterval, currency],
  );

  const intervalSuffix = React.useMemo(() => {
    const map: Record<string, string> = {
      hourly: "/hr",
      daily: "/day",
      weekly: "/wk",
      monthly: "/mo",
      yearly: "/yr",
    };
    return map[pricingInterval] || "/hr";
  }, [pricingInterval]);

  if (isLoading)
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-2 border-neutral-800" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-blue-500 border-transparent" />
        </div>
        <p className="mt-4 text-sm text-neutral-500">Loading details...</p>
      </div>
    );

  if (error || !instance)
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center px-4">
        <div className="mb-4 text-4xl">⚠️</div>
        <p className="text-lg font-medium text-white">Instance Not Found</p>
        <p className="mt-2 text-sm text-neutral-500">{error}</p>
        <button
          onClick={() => router.push(`/${provider.toLowerCase()}/${region}`)}
          className="mt-6 flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to instances
        </button>
      </div>
    );

  const currentIndex = allInstances.findIndex(
    (inst) => inst.n === instanceName,
  );
  const prevInstance = currentIndex > 0 ? allInstances[currentIndex - 1] : null;
  const nextInstance =
    currentIndex < allInstances.length - 1
      ? allInstances[currentIndex + 1]
      : null;

  const memoryPerVCPU = (instance.m / instance.v).toFixed(1);
  const familySiblings = allInstances
    .filter(
      (inst) =>
        inst.f === instance.f &&
        inst.n.split(".")[0] === instanceName.split(".")[0],
    )
    .sort((a, b) => a.v - b.v);

  const getPrice = (type: string) => {
    const pr = instance.pr || {};
    const providerUpper = provider.toUpperCase();
    const pref = os;

    if (type === "sustained") {
      return pr[`${pref}SustainedDiscounts100`];
    }

    if (type === "ondemand") {
      return pr[`${pref}OnDemand`] || pr[`${pref}_payasyougo`];
    }

    if (type === "spot") {
      return pr[`${pref}Spot`] || pr[`${pref}_spot`];
    }

    // Default summaries for quick pricing summary cards
    if (type === "1yr_sum") {
      if (providerUpper === "AWS")
        return pr[`${pref}Reserved1yrStandardNoUpfront`];
      if (providerUpper === "AZURE") return pr[`${pref}_reserved1y`];
      return pr[`${pref}Commit1Yr`];
    }
    if (type === "3yr_sum") {
      if (providerUpper === "AWS")
        return pr[`${pref}Reserved3yrStandardNoUpfront`];
      if (providerUpper === "AZURE") return pr[`${pref}_reserved3y`];
      return pr[`${pref}Commit3Yr`];
    }

    return 0; // fallback
  };

  const breakoutKeys = Object.keys(instance.pr || {})
    .filter(
      (k) => k.toLowerCase().startsWith(os.toLowerCase()) && instance.pr[k] > 0,
    )
    .sort();

  const isAzure = provider.toUpperCase() === "AZURE";
  const displayName =
    isAzure && instance?.f
      ? instance.f.replace(/_/g, " ")
      : instanceName.replace(/_/g, " ");

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
      {/* Top Section: Breadcrumb & Title */}
      <div className="mb-10">
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                asChild
                className="text-neutral-500 hover:text-white transition-colors text-[13px] font-medium"
              >
                <Link href="/">Instances</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-neutral-800" />
            <BreadcrumbItem>
              <BreadcrumbLink
                asChild
                className="text-neutral-500 hover:text-white transition-colors text-[13px] font-medium capitalize"
              >
                <Link href={`/${provider.toLowerCase()}/${region}`}>
                  {provider} {provider === "AWS" ? "EC2" : "Compute"}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-neutral-800" />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-white font-medium text-[13px]">
                {displayName}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-3xl md:text-[40px] font-semibold text-white tracking-tight leading-none">
          {displayName}
        </h1>
        <p className="mt-4 max-w-3xl text-sm md:text-base text-neutral-400 leading-relaxed font-sans">
          The {displayName} instance{" "}
          {isAzure ? "" : `is in the ${instance.f} family `}with{" "}
          <span className="text-white">{instance.v} vCPUs</span> and{" "}
          <span className="text-white">{instance.m} GiB</span> of memory,
          starting at{" "}
          <span className="text-emerald-400 font-semibold">
            {formatCost(getPrice("ondemand"))}
          </span>
          {intervalSuffix}.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-10">
        {/* Sidebar */}
        <div className="space-y-8">
          {/* Quick Pricing Summary */}
          <div className="rounded-xl border border-neutral-800/60 bg-neutral-950 p-6 shadow-sm">
            <h3 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
              Summary Pricing
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              {(provider.toUpperCase() === "GCP"
                ? [
                    { label: "On Demand", type: "ondemand" },
                    { label: "Sustained (100%)", type: "sustained" },
                    { label: "Spot", type: "spot" },
                    { label: "1y Commitment", type: "1yr_sum" },
                    { label: "3y Commitment", type: "3yr_sum" },
                  ]
                : [
                    {
                      label:
                        provider.toUpperCase() === "AZURE"
                          ? "Pay-as-you-go"
                          : "On Demand",
                      type: "ondemand",
                    },
                    { label: "Spot", type: "spot" },
                    { label: "1y Reserved", type: "1yr_sum" },
                    { label: "3y Reserved", type: "3yr_sum" },
                  ]
              ).map(({ label, type }) => {
                const price = getPrice(type);
                return (
                  <div key={label}>
                    <span className="block text-xl font-bold text-emerald-400">
                      {formatCost(price)}
                    </span>
                    <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-tight">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filters (2 Columns) */}
          <div className="space-y-4 rounded-xl border border-neutral-800/60 bg-neutral-900/10 p-5">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
              Filters
            </h3>
            <div className="grid grid-cols-2 gap-3 pb-2">
              <div className="flex flex-col gap-1.5 transition-all">
                <span className="text-[11px] font-bold text-neutral-500 tracking-wider ml-1 uppercase">
                  Region
                </span>
                <FilterDropdown
                  label="Region"
                  value={region}
                  options={allRegions}
                  onSelect={handleRegionChange}
                  searchable
                  dropdownWidth="w-[320px]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-neutral-500 tracking-wider ml-1 uppercase">
                  OS
                </span>
                <FilterDropdown
                  label="OS"
                  value={os}
                  options={
                    provider.toUpperCase() === "AZURE"
                      ? [
                          { value: "linux", label: "Linux" },
                          { value: "windows", label: "Windows" },
                          { value: "ubuntu", label: "Ubuntu" },
                          { value: "sles", label: "SLES (SUSE)" },
                          { value: "rhel", label: "RHEL" },
                        ]
                      : [
                          { value: "linux", label: "Linux" },
                          { value: "windows", label: "Windows" },
                        ]
                  }
                  onSelect={setOs}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-neutral-500 tracking-wider ml-1 uppercase">
                  Interval
                </span>
                <FilterDropdown
                  label="Interval"
                  value={pricingInterval}
                  options={PRICING_INTERVALS}
                  onSelect={setPricingInterval}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-neutral-500 tracking-wider ml-1 uppercase">
                  Currency
                </span>
                <FilterDropdown
                  label="Currency"
                  value={currency}
                  options={CURRENCIES}
                  onSelect={setCurrency}
                  searchable
                  dropdownWidth="w-[320px]"
                />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5 pt-1">
                <span className="text-[11px] font-bold text-neutral-500 tracking-wider ml-1 uppercase">
                  {COMMITMENT_LABELS[provider.toUpperCase()] || "Commitment"}
                </span>
                <FilterDropdown
                  label="Commitment"
                  value={reservedPlan}
                  options={COMMITMENT_OPTIONS[provider.toUpperCase()] || []}
                  onSelect={setReservedPlan}
                />
              </div>
            </div>
            <button
              onClick={() => {
                setOs("linux");
                setPricingInterval("hourly");
                const defaultPlan =
                  provider.toUpperCase() === "AWS"
                    ? "ri_1y_no"
                    : provider.toUpperCase() === "AZURE"
                      ? "res_1y_no_hb"
                      : "no_commitment";
                setReservedPlan(defaultPlan);
                setCurrency("usd");
              }}
              className="w-full h-9 rounded-lg border border-neutral-800 bg-neutral-900 px-4 text-[11px] font-bold uppercase tracking-widest text-neutral-500 hover:text-white transition-colors cursor-pointer"
            >
              Reset View
            </button>
          </div>

          {familySiblings.length > 0 && (
            <DetailSection title="Family Sizes" defaultOpen={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-[10px] text-neutral-500 uppercase tracking-widest bg-neutral-900/10">
                      <th className="px-4 py-2 text-left font-bold border-b border-neutral-800/30">
                        Size
                      </th>
                      <th className="px-4 py-2 text-left font-bold border-b border-neutral-800/30">
                        vCPUs
                      </th>
                      <th className="px-4 py-2 text-left font-bold border-b border-neutral-800/30">
                        Mem
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/30">
                    {familySiblings.map((sib) => (
                      <tr
                        key={sib.n}
                        className={`hover:bg-neutral-900/20 ${sib.n === instanceName ? "bg-blue-500/5" : ""}`}
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/${provider.toLowerCase()}/${region}/instance/${encodeURIComponent(sib.n)}`}
                            className={`font-medium transition-colors ${sib.n === instanceName ? "text-white font-bold" : "text-blue-400 hover:text-blue-300"}`}
                          >
                            {sib.n}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-neutral-300 font-mono">
                          {sib.v}
                        </td>
                        <td className="px-4 py-2.5 text-neutral-300 font-mono">
                          {sib.m}G
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DetailSection>
          )}
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 border border-blue-400/20 rounded-xl text-blue-400 text-xs font-semibold">
            <Info className="h-4 w-4" />
            <span>Note: All tables below are also dropdowns</span>
          </div>

          <DetailSection
            title="Compute"
            rows={[
              { label: "vCPUs", value: instance.v },
              { label: "Memory", value: `${instance.m} GiB` },
              { label: "Memory/vCPU", value: `${memoryPerVCPU} GiB` },
              { label: "Processor", value: instance.p },
              { label: "Architecture", value: instance.a?.toUpperCase() },
              { label: "GPU", value: instance.g ? "Yes" : "No" },
              { label: "GPU Model", value: instance.gn },
            ]}
          />
          <DetailSection
            title="Connectivity"
            rows={[
              { label: "Network Performance", value: instance.nw },
              { label: "Storage", value: instance.s },
            ]}
          />
          <DetailSection
            title="Cloud Provider"
            rows={[
              { label: "Provider", value: provider },
              {
                label: "Instance Type",
                value:
                  isAzure && instance.f
                    ? instance.f.replace(/_/g, " ")
                    : instance.n,
              },
              ...(!isAzure ? [{ label: "Family", value: instance.f }] : []),
              { label: "RegionID", value: region },
            ]}
          />

          <DetailSection
            key={`${os}-${instance.n}`}
            title={`${os.charAt(0).toUpperCase() + os.slice(1)} Committed Pricing Detail`}
            defaultOpen={false}
            rows={breakoutKeys.map((key) => {
              const dict: Record<string, string> = {
                payasyougo: "Pay-as-you-go",
                reserved1y: "Reserved 1Y",
                reserved3y: "Reserved 3Y",
                savingsplan1y: "Savings Plan 1Y",
                savingsplan3y: "Savings Plan 3Y",
                OnDemand: "On Demand",
                Spot: "Spot",
                Commit1Yr: "1-Year Commitment",
                Commit3Yr: "3-Year Commitment",
                SustainedDiscounts100: "Sustained Discount",
              };
              const cleaned = key
                .replace(new RegExp(`^${os}`, "i"), "")
                .replace(/_/g, "")
                .trim();
              const label =
                dict[cleaned] || cleaned.replace(/([A-Z])/g, " $1").trim();
              return {
                label: label.charAt(0).toUpperCase() + label.slice(1),
                value: formatCost(instance.pr[key]) + " " + intervalSuffix,
              };
            })}
          />
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between mt-12 pt-6 border-t border-neutral-800/60">
        {prevInstance ? (
          <Link
            href={`/${provider.toLowerCase()}/${region}/instance/${encodeURIComponent(prevInstance.n)}`}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {isAzure && prevInstance.f
              ? prevInstance.f.replace(/_/g, " ")
              : prevInstance.n.replace(/_/g, " ")}
          </Link>
        ) : (
          <div />
        )}

        {nextInstance ? (
          <Link
            href={`/${provider.toLowerCase()}/${region}/instance/${encodeURIComponent(nextInstance.n)}`}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            {isAzure && nextInstance.f
              ? nextInstance.f.replace(/_/g, " ")
              : nextInstance.n.replace(/_/g, " ")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
