"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  X,
  Cpu,
  MemoryStick,
  Activity,
  Network,
  HardDrive,
  Banknote,
  Plus,
  ChevronRight,
  Gauge,
  Shield,
  Monitor,
  Zap,
  Server,
  Info,
} from "lucide-react";
import { AmazonWebServices } from "@/app/icons/amazonIcon";
import { MicrosoftAzure } from "@/app/icons/azureIcon";
import { GoogleCloud } from "@/app/icons/gcpIcon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { decompress as zstdDecompress } from "fzstd";
import { decode } from "@msgpack/msgpack";
import { motion } from "framer-motion";
import { cachedFetch } from "@/lib/cache";
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
import { loadFilterState, saveFilterState } from "@/lib/cache";
import { getDataUrl } from "@/lib/api-utils";

/* ─── Constants ─── */

const INTERVAL_OPTIONS: FilterOption[] = [
  { label: "Per second", value: "seconds" },
  { label: "Per minute", value: "minutes" },
  { label: "Per hour", value: "hourly" },
  { label: "Per week", value: "weekly" },
  { label: "Per month", value: "monthly" },
  { label: "Per year", value: "yearly" },
];

const UNIT_OPTIONS: FilterOption[] = [
  { label: "Per instance", value: "instance" },
  { label: "Per vCPU", value: "vcpu" },
  { label: "Per GiB RAM", value: "memory" },
];

const CURRENCIES: FilterOption[] = [
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
];

const EXCHANGE_RATES: Record<string, { rate: number; symbol: string }> = {
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
  ils: { rate: 3.72, symbol: "₪" },
  nzd: { rate: 1.65, symbol: "NZ$" },
};

const COMMITMENT_OPTIONS: Record<string, FilterOption[]> = {
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

/* ─── Interfaces ─── */

interface MappedInstance {
  id: string;
  name: string;
  apiName: string;
  family: string;
  vcpus: string;
  memory: string;
  network: string;
  storage: string;
  processor: string;
  architecture: string;
  memoryPerVCPU: string;
  gpuCount: number;
  gpuName: string;
  generation: string;
  linuxOnDemand: string;
  linuxSpot: string;
  windowsOnDemand: string;
  pr?: Record<string, number>;
  provider: string;
}

interface FullInstanceDetail {
  [key: string]: any;
}

/* ─── Map Helpers ─── */

function mapRawInstance(
  item: any,
  provider: string,
  region: string,
  index: number,
): MappedInstance {
  const pr = item.pr || {};

  const formatPriceRaw = (val?: number): string => {
    if (val === undefined || val === null || val <= 0) return "-";
    return `$${val.toFixed(4)}`;
  };

  const isAzure = provider.toLowerCase() === "azure";

  return {
    id: `${provider}-${region}-${index}`,
    provider,
    name: isAzure && item.f ? item.f.replace(/_/g, " ") : (item.n || ""),
    apiName: item.n || "",
    family: item.f || "",
    vcpus: String(item.v || ""),
    memory: item.m ? `${item.m} GiB` : "",
    network: item.nw || "",
    storage: item.s || "-",
    processor: item.p || "",
    architecture: item.a || "",
    memoryPerVCPU:
      item.v && item.m ? `${(item.m / item.v).toFixed(1)} GiB` : "",
    gpuCount: item.gc ?? 0,
    gpuName: item.gn || "",
    generation: item.g || "",
    linuxOnDemand: formatPriceRaw(pr.linuxOnDemand || pr.linux_payasyougo),
    linuxSpot: formatPriceRaw(pr.linuxSpot || pr.linux_spot || pr.ubuntu_spot),
    windowsOnDemand: formatPriceRaw(
      pr.windowsOnDemand || pr.windows_payasyougo,
    ),
  };
}

function formatDetailValue(value: any): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(2);
  }
  if (typeof value === "string") {
    if (value === "") return "—";
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    return value.join(", ");
  }
  return String(value);
}

/* ─── Performance logic for pricing ─── */

function getPricingValue(
  detail: FullInstanceDetail | null,
  instance: MappedInstance | null | undefined,
  region: string,
  key: string,
): number | null {
  if (detail?.pricing) {
    const regionPricing = detail.pricing[region] || detail.pricing[Object.keys(detail.pricing)[0]];
    if (regionPricing && regionPricing[key] != null) return regionPricing[key];
  }
  if (instance?.pr && instance.pr[key] != null) {
     return instance.pr[key];
  }
  return null;
}

function calculateCost(
  baseCost: number | null,
  vcpus: number,
  memory: number,
  interval: string,
  unit: string,
  currency: string,
) {
  if (baseCost === null || baseCost === undefined || baseCost <= 0) return "—";

  // Interval multipliers relative to Hourly
  const multipliers: Record<string, number> = {
    seconds: 1 / 3600,
    minutes: 1 / 60,
    hourly: 1,
    weekly: 24 * 7,
    monthly: (24 * 730) / 168,
    yearly: 24 * 365,
  };
  multipliers.monthly = 730;

  const mult = multipliers[interval] || 1;
  const currencyInfo = EXCHANGE_RATES[currency] || { rate: 1, symbol: "$" };

  let unitValue = 1;
  let unitSuffix = "";

  if (unit === "vcpu") {
    unitValue = vcpus || 1;
    unitSuffix = " / vCPU";
  } else if (unit === "memory") {
    unitValue = memory || 1;
    unitSuffix = " / GiB";
  }

  const calculated = (baseCost / unitValue) * mult * currencyInfo.rate;

  // Precision logic
  const precision = interval === "seconds" || interval === "minutes" ? 6 : 4;

  const displayInterval =
    interval === "hourly"
      ? "hourly"
      : interval === "monthly"
        ? "monthly"
        : interval === "weekly"
          ? "weekly"
          : interval === "yearly"
            ? "yearly"
            : interval === "minutes"
              ? "minutely"
              : "secondly";

  const spacer = currencyInfo.symbol.length > 1 ? " " : "";
  return `${currencyInfo.symbol}${spacer}${calculated.toFixed(precision)} ${displayInterval}${unitSuffix}`;
}

/* ─── Spec definition ─── */

interface FullSpec {
  label: string;
  getValue: (
    detail: FullInstanceDetail | null,
    instance?: MappedInstance | null,
  ) => string;
  isPrice?: boolean;
}

interface FullSectionGroup {
  title: string;
  icon: React.ReactNode;
  specs: FullSpec[];
}

function buildSectionGroups(
  provider: string,
  region: string,
  interval: string,
  unit: string,
  currency: string,
  plan: string,
  azureHybridBenefit?: string,
): FullSectionGroup[] {
  const isAws = provider.toLowerCase() === "aws";
  const isAzure = provider.toLowerCase() === "azure";
  const isGcp = provider.toLowerCase() === "gcp";

  const getDetailValue = (
    detail: FullInstanceDetail | null,
    key: string,
  ): any => {
    if (!detail) return null;
    return detail[key];
  };

  const groups: FullSectionGroup[] = [
    {
      title: "COMPUTE",
      icon: <Cpu className="h-4 w-4" />,
      specs: [
        {
          label: "Instance Type",
          getValue: (d, i) => {
            if (d) {
              const val = getDetailValue(d, "instanceType");
              return isAzure && getDetailValue(d, "instanceFamily")
                ? formatDetailValue(getDetailValue(d, "instanceFamily")).replace(/_/g, " ")
                : formatDetailValue(val);
            }
            return i ? i.name : "—";
          },
        },
        ...(!isAzure
          ? [
              {
                label: "Instance Family",
                getValue: (d: any, i: any) =>
                  d ? formatDetailValue(getDetailValue(d, "instanceFamily")) : (i?.family || "—"),
              },
            ]
          : []),
        {
          label: "vCPUs",
          getValue: (d, i) => d ? formatDetailValue(getDetailValue(d, "vCPUs")) : (i?.vcpus || "—"),
        },
        {
          label: "Processor",
          getValue: (d, i) => d ? formatDetailValue(getDetailValue(d, "processor")) : (i?.processor || "—"),
        },
        {
          label: "Architecture",
          getValue: (d, i) => d ? formatDetailValue(getDetailValue(d, "architecture")) : (i?.architecture?.toUpperCase() || "—"),
        },
        {
          label: "Clock Speed (GHz)",
          getValue: (d) =>
            formatDetailValue(getDetailValue(d, "clockSpeedGHz")),
        },
        ...(isAws
          ? [
              {
                label: "Default Cores",
                getValue: (d: any) =>
                  formatDetailValue(getDetailValue(d, "defaultCores")),
              },
            ]
          : []),
        ...(isGcp
          ? [
              {
                label: "Shared CPU",
                getValue: (d: any) =>
                  formatDetailValue(getDetailValue(d, "sharedCPU")),
              },
            ]
          : []),
        ...(isAzure
          ? [
              {
                label: "ACU",
                getValue: (d: any) =>
                  formatDetailValue(getDetailValue(d, "acu")),
              },
              {
                label: "Tier",
                getValue: (d: any) =>
                  formatDetailValue(getDetailValue(d, "tier")),
              },
            ]
          : []),
      ],
    },
    {
      title: "MEMORY",
      icon: <MemoryStick className="h-4 w-4" />,
      specs: [
        {
          label: "Total RAM",
          getValue: (d, i) => {
            const mem = getDetailValue(d, "memoryGiB");
            if (mem != null) return `${mem} GiB`;
            return i?.memory || "—";
          },
        },
        {
          label: "RAM per vCPU",
          getValue: (d, i) => {
            const mem = getDetailValue(d, "memoryPerVCPU");
            if (mem != null) return `${mem} GiB`;
            const totalMem = getDetailValue(d, "memoryGiB");
            const vcpus = getDetailValue(d, "vCPUs");
            if (totalMem && vcpus)
              return `${(totalMem / vcpus).toFixed(1)} GiB`;
            if (i?.memoryPerVCPU) return i.memoryPerVCPU;
            return "—";
          },
        },
      ],
    },
    {
      title: "STORAGE",
      icon: <HardDrive className="h-4 w-4" />,
      specs: [
        {
          label: "Instance Storage",
          getValue: (d, i) => d ? formatDetailValue(getDetailValue(d, "storage")) : (i?.storage || "—"),
        },
        {
          label: "EBS Optimized",
          getValue: (d) => formatDetailValue(getDetailValue(d, "ebsOptimized")),
        },
        {
          label: "EBS Baseline IOPS",
          getValue: (d) =>
            formatDetailValue(getDetailValue(d, "ebsBaselineIOPS")),
        },
        {
          label: "EBS Max IOPS",
          getValue: (d) => formatDetailValue(getDetailValue(d, "ebsMaxIOPS")),
        },
        {
          label: "EBS Baseline BW",
          getValue: (d) => {
            const val = getDetailValue(d, "ebsBaselineBandwidthMbps");
            return val ? `${val} Mbps` : "—";
          },
        },
        {
          label: "EBS Max BW",
          getValue: (d) => {
            const val = getDetailValue(d, "ebsMaxBandwidthMbps");
            return val ? `${val} Mbps` : "—";
          },
        },
      ],
    },
    {
      title: "NETWORK",
      icon: <Network className="h-4 w-4" />,
      specs: [
        {
          label: "Network Perf",
          getValue: (d, i) =>
            d
              ? formatDetailValue(getDetailValue(d, "network") ?? getDetailValue(d, "bandwidth"))
              : (i?.network || "—"),
        },
        {
          label: "Max Interfaces",
          getValue: (d) =>
            formatDetailValue(
              getDetailValue(d, "maxInterfaces") ??
                getDetailValue(d, "networkMaxInterfaces"),
            ),
        },
        {
          label: "ENA Support",
          getValue: (d) => formatDetailValue(getDetailValue(d, "enaSupport")),
        },
        {
          label: "EFA Support",
          getValue: (d) => formatDetailValue(getDetailValue(d, "efaSupport")),
        },
      ],
    },
    {
      title: "HARDWARE & FEATURES",
      icon: <Server className="h-4 w-4" />,
      specs: [
        {
          label: "Processor",
          getValue: (d) => formatDetailValue(getDetailValue(d, "processor")),
        },
        {
          label: "Architecture",
          getValue: (d) => formatDetailValue(getDetailValue(d, "architecture")),
        },
        {
          label: "Bare Metal",
          getValue: (d) => formatDetailValue(getDetailValue(d, "bareMetal")),
        },
        {
          label: "Hypervisor",
          getValue: (d) => formatDetailValue(getDetailValue(d, "hypervisor")),
        },
        {
          label: "Burstable",
          getValue: (d) =>
            formatDetailValue(getDetailValue(d, "burstablePerformance")),
        },
        {
          label: "Free Tier",
          getValue: (d) =>
            formatDetailValue(getDetailValue(d, "freeTierEligible")),
        },
        {
          label: "Auto Recovery",
          getValue: (d) =>
            formatDetailValue(getDetailValue(d, "autoRecoverySupport")),
        },
        {
          label: "Hibernation",
          getValue: (d) =>
            formatDetailValue(getDetailValue(d, "hibernationSupport")),
        },
      ],
    },
    {
      title: "GPU & ACCELERATORS",
      icon: <Zap className="h-4 w-4" />,
      specs: [
        {
          label: "Has GPU",
          getValue: (d) => formatDetailValue(getDetailValue(d, "hasGPU")),
        },
        {
          label: "GPU Count",
          getValue: (d) => formatDetailValue(getDetailValue(d, "gpuCount")),
        },
        {
          label: "GPU Name",
          getValue: (d) => formatDetailValue(getDetailValue(d, "gpuName")),
        },
        {
          label: "GPU Memory (GiB)",
          getValue: (d) => formatDetailValue(getDetailValue(d, "gpuMemoryGiB")),
        },
      ],
    },
    {
      title: "PLATFORM & FEATURES",
      icon: <Server className="h-4 w-4" />,
      specs: [
        {
          label: "Current Gen",
          getValue: (d) =>
            formatDetailValue(getDetailValue(d, "currentGeneration")),
        },
        {
          label: "Hypervisor",
          getValue: (d) => formatDetailValue(getDetailValue(d, "hypervisor")),
        },
        {
          label: "Bare Metal",
          getValue: (d) => formatDetailValue(getDetailValue(d, "bareMetal")),
        },
        {
          label: "Burstable",
          getValue: (d) =>
            formatDetailValue(getDetailValue(d, "burstablePerformance")),
        },
        {
          label: "Free Tier",
          getValue: (d) =>
            formatDetailValue(getDetailValue(d, "freeTierEligible")),
        },
        {
          label: "Auto Recovery",
          getValue: (d) =>
            formatDetailValue(getDetailValue(d, "autoRecoverySupport")),
        },
        {
          label: "Hibernation",
          getValue: (d) =>
            formatDetailValue(getDetailValue(d, "hibernationSupport")),
        },
        ...(isGcp
          ? [
              {
                label: "Confidential VM",
                getValue: (d: any) =>
                  formatDetailValue(getDetailValue(d, "confidentialVM")),
              },
              {
                label: "Nested Virt",
                getValue: (d: any) =>
                  formatDetailValue(getDetailValue(d, "nestedVirtualization")),
              },
              {
                label: "Sole Tenant",
                getValue: (d: any) =>
                  formatDetailValue(getDetailValue(d, "soletenantCapable")),
              },
            ]
          : []),
        ...(isAzure
          ? [
              {
                label: "RDMA Support",
                getValue: (d: any) =>
                  formatDetailValue(getDetailValue(d, "rdmaSupport")),
              },
            ]
          : []),
      ],
    },
    {
      title: "PRICING",
      icon: <Banknote className="h-4 w-4" />,
      specs: [], // Will be populated below
    },
  ];

  // Populate Pricing Specs
  const pricingSection = groups.find((g) => g.title === "PRICING")!;

  const getFormattedPrice = (
    detail: FullInstanceDetail | null,
    instance: MappedInstance | null | undefined,
    key: string,
  ) => {
    const baseCost = getPricingValue(detail, instance, region, key);
    if (baseCost == null) return "—";

    const vcpus = detail 
      ? (getDetailValue(detail, "vCPUs") || 1) 
      : (instance?.vcpus ? parseFloat(instance.vcpus) : 1);
      
    const memory = detail 
      ? (getDetailValue(detail, "memoryGiB") || 1) 
      : (instance?.memory ? parseFloat(instance.memory) : 1);

    return calculateCost(baseCost, vcpus, memory, interval, unit, currency);
  };

  // Determine Reserved Keys based on plan
  let linuxReservedKey = "";
  let windowsReservedKey = "";

  if (isAws) {
    if (plan.startsWith("ri_1y")) {
      const type = plan.split("_")[2];
      const suffix =
        type === "no"
          ? "NoUpfront"
          : type === "partial"
            ? "PartialUpfront"
            : "AllUpfront";
      linuxReservedKey = `linuxReserved1yrStandard${suffix}`;
      windowsReservedKey = `windowsReserved1yrStandard${suffix}`;
    } else if (plan.startsWith("ri_3y")) {
      const type = plan.split("_")[2];
      const suffix =
        type === "no"
          ? "NoUpfront"
          : type === "partial"
            ? "PartialUpfront"
            : "AllUpfront";
      linuxReservedKey = `linuxReserved3yrStandard${suffix}`;
      windowsReservedKey = `windowsReserved3yrStandard${suffix}`;
    } else if (plan.startsWith("sp_compute")) {
      const term = plan.includes("3y") ? "3yr" : "1yr";
      linuxReservedKey = `linuxSavingsCompute${term}NoUpfront`;
      windowsReservedKey = `windowsSavingsCompute${term}NoUpfront`;
    } else if (plan.startsWith("sp_instance")) {
      const term = plan.includes("3y") ? "3yr" : "1yr";
      linuxReservedKey = `linuxSavingsInstance${term}NoUpfront`;
      windowsReservedKey = `windowsSavingsInstance${term}NoUpfront`;
    }
  } else if (isAzure) {
    const isSavings = plan.startsWith("sp") || plan.includes("savingsplan");
    const is3y = plan.includes("3y");
    const term = is3y ? "3y" : "1y";
    const type = isSavings ? "savingsplan" : "reserved";
    linuxReservedKey = `linux_${type}${term}`;
    windowsReservedKey = `windows_${type}${term}`;
  } else if (isGcp) {
    if (plan !== "no_commitment") {
      const is3y = plan.includes("3y");
      linuxReservedKey = is3y ? "linuxCommit3Yr" : "linuxCommit1Yr";
      windowsReservedKey = is3y ? "windowsCommit3Yr" : "windowsCommit1Yr";
    }
  }

  if (isAws) {
    pricingSection.specs = [
      {
        label: "Linux On Demand",
        isPrice: true,
        getValue: (d, i) => {
          const p = getFormattedPrice(d, i, "linuxOnDemand");
          if (p !== "—") return p;
          return getFormattedPrice(d, i, "linux_payasyougo");
        },
      },
      {
        label: "Linux Spot",
        isPrice: true,
        getValue: (d, i) => {
          const p1 = getFormattedPrice(d, i, "linuxSpot");
          if (p1 !== "—") return p1;
          const p2 = getFormattedPrice(d, i, "linux_spot");
          if (p2 !== "—") return p2;
          return getFormattedPrice(d, i, "ubuntu_spot");
        },
      },
      {
        label: "Windows On Demand",
        isPrice: true,
        getValue: (d, i) => {
          const p = getFormattedPrice(d, i, "windowsOnDemand");
          if (p !== "—") return p;
          return getFormattedPrice(d, i, "windows_payasyougo");
        },
      },
      {
        label: "Windows Spot",
        isPrice: true,
        getValue: (d, i) => {
          const p = getFormattedPrice(d, i, "windowsSpot");
          if (p !== "—") return p;
          return getFormattedPrice(d, i, "windows_spot");
        },
      },
    ];
  } else if (isAzure) {
    const isHB = azureHybridBenefit === "Yes";
    const costType = plan; // payasyougo, reserved1y, etc.
    const getAzureKey = (base: string) => `${base}_${costType}`;

    pricingSection.specs = [
      {
        label: "Linux Cost",
        isPrice: true,
        getValue: (d, i) => getFormattedPrice(d, i, getAzureKey("linux")),
      },
      {
        label: "Windows Cost",
        isPrice: true,
        getValue: (d, i) => getFormattedPrice(d, i, isHB ? getAzureKey("linux") : getAzureKey("windows")),
      },
      {
        label: "RHEL Cost",
        isPrice: true,
        getValue: (d, i) => getFormattedPrice(d, i, getAzureKey("rhel")),
      },
      {
        label: "Ubuntu Cost",
        isPrice: true,
        getValue: (d, i) => getFormattedPrice(d, i, getAzureKey("ubuntu")),
      },
      {
        label: "SLES Cost",
        isPrice: true,
        getValue: (d, i) => getFormattedPrice(d, i, getAzureKey("sles")),
      },
    ];
  } else if (isGcp) {
    let linuxKey = "linuxOnDemand";
    if (plan === "sustained") {
      linuxKey = "linuxSustainedDiscounts100";
    } else if (plan === "spot") {
      linuxKey = "linuxSpot";
    } else if (plan === "commit_1y") {
      linuxKey = "linuxCommit1Yr";
    } else if (plan === "commit_3y") {
      linuxKey = "linuxCommit3Yr";
    }

    pricingSection.specs = [
      {
        label: "Instance Price",
        isPrice: true,
        getValue: (d, i) => getFormattedPrice(d, i, linuxKey),
      },
    ];
  } else {
    pricingSection.specs = [];
  }

  return groups.filter((g) => g.specs.length > 0 || g.title === "PRICING");
}

/* ─── Search Column Component ─── */

function InstanceSearchColumn({
  instance,
  allData,
  onSelect,
  onRemove,
}: {
  instance: MappedInstance | null;
  allData: MappedInstance[];
  onSelect: (inst: MappedInstance) => void;
  onRemove: () => void;
}) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(
    () =>
      query.length > 0
        ? allData
            .filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 15)
        : [],
    [query, allData],
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <th className="w-1/3 min-w-[280px] p-6 text-left align-top border-r border-neutral-800 last:border-r-0">
      <div ref={containerRef} className="relative">
        {instance ? (
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-lg font-bold text-white mb-1 truncate">
                {instance.name}
              </div>
              {!instance.id.startsWith("azure") && (
                <div className="text-[11px] text-neutral-500 font-medium uppercase tracking-wider">
                  {instance.family}
                </div>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="text-neutral-600 hover:text-red-400/80 p-1 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-600" />
              <Input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                placeholder="Search instance…"
                className="pl-9 h-10 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:ring-1 focus-visible:ring-neutral-700 rounded-xl text-sm font-medium"
              />
            </div>

            {isFocused && matches.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-[300px] overflow-y-auto bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl backdrop-blur-xl">
                {matches.map((match) => (
                  <button
                    key={match.id}
                    onClick={() => {
                      onSelect(match);
                      setQuery("");
                      setIsFocused(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-neutral-800/80 transition-colors border-b border-neutral-800/50 last:border-b-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 flex items-center justify-center">
                        {match.provider === "aws" && <AmazonWebServices className="w-4 h-4" />}
                        {match.provider === "azure" && <MicrosoftAzure className="w-4 h-4" />}
                        {match.provider === "gcp" && <GoogleCloud className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-white truncate">
                          {match.name}
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">
                          {match.vcpus} vCPUs · {match.memory}
                        </div>
                      </div>
                      {match.linuxOnDemand !== "-" && (
                        <span className="text-xs font-bold text-emerald-400 ml-3 whitespace-nowrap">
                          {match.linuxOnDemand}/hr
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!isFocused && (
              <div className="mt-4 h-[80px] border-2 border-dashed border-neutral-800/50 rounded-xl flex items-center justify-center bg-neutral-900/10">
                <div className="text-[11px] font-bold text-neutral-700 uppercase tracking-widest">
                  Empty Slot
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </th>
  );
}

/* ─── Main Compare Page ─── */

export function ComparePage() {
  const searchParams = useSearchParams();
  const provider = searchParams.get("provider") || "aws";
  const region = useMemo(() => {
    const r = searchParams.get("region");
    if (r) return r;
    const p = provider.toUpperCase();
    if (p === "AZURE") return "eastus";
    if (p === "GCP") return "us-east1";
    return "us-east-1";
  }, [provider, searchParams]);
  const initialInstanceNames =
    searchParams.get("instances")?.split(",").filter(Boolean) || [];

  const [allData, setAllData] = useState<MappedInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [columnCount, setColumnCount] = useState(
    Math.max(initialInstanceNames.length, 2),
  );
  const [instances, setInstances] = useState<(MappedInstance | null)[]>([
    null,
    null,
    null,
  ]);
  const [instanceDetails, setInstanceDetails] = useState<
    (FullInstanceDetail | null)[]
  >([null, null, null]);
  const [compareMode, setCompareMode] = useState<"full" | "diff">("full");

  // Pricing Filter State (with persistence)
  const [pricingInterval, setPricingInterval] = useState("hourly");
  const [currency, setCurrency] = useState("usd");
  const [pricingUnit, setPricingUnit] = useState("instance");
  const [reservedPlan, setReservedPlan] = useState("");
  const [azureHybridBenefit, setAzureHybridBenefit] = useState("No");

  const [isRestored, setIsRestored] = useState(false);

  // Restore filters loaded on mount
  useEffect(() => {
    const saved = loadFilterState(`compare-${provider}`);
    if (saved) {
      if (saved.pricing) setPricingInterval(saved.pricing);
      if (saved.currency) setCurrency(saved.currency);
      if (saved.pricingUnit) setPricingUnit(saved.pricingUnit);
      if (saved.reservedPlan) setReservedPlan(saved.reservedPlan);
      if (saved.azureHybridBenefit) setAzureHybridBenefit(saved.azureHybridBenefit);
    }
    setIsRestored(true);
  }, [provider]);

  // Persist filters
  useEffect(() => {
    if (!isRestored) return;
    saveFilterState(`compare-${provider}`, {
      pricing: pricingInterval,
      currency,
      pricingUnit,
      reservedPlan,
      azureHybridBenefit,
    });
  }, [pricingInterval, currency, pricingUnit, reservedPlan, provider, isRestored]);

  // Initialize reservedPlan based on provider if not already set or if provider changed
  useEffect(() => {
    if (reservedPlan) return;
    const p = provider.toUpperCase();
    if (p === "AWS") setReservedPlan("payasyougo");
    else if (p === "AZURE") setReservedPlan("payasyougo");
    else setReservedPlan("ondemand");
  }, [provider, reservedPlan]);

  const clearFilters = useCallback(() => {
    setPricingInterval("hourly");
    setCurrency("usd");
    setPricingUnit("instance");
    setAzureHybridBenefit("No");
    const p = provider.toUpperCase();
    if (p === "AWS") setReservedPlan("payasyougo");
    else if (p === "AZURE") setReservedPlan("payasyougo");
    else setReservedPlan("ondemand");
  }, [provider]);

  // Fetch full detail from MongoDB
  const fetchInstanceDetail = useCallback(
    async (instanceName: string, p: string, idx: number) => {
      try {
        const response = await fetch(
          `/api/instances/${p.toLowerCase()}/${encodeURIComponent(instanceName)}`,
        );
        if (response.ok) {
          const detail = await response.json();
          setInstanceDetails((prev) => {
            const next = [...prev];
            next[idx] = detail;
            return next;
          });
        }
      } catch (err) {
        console.warn(`Error fetching detail for ${instanceName}:`, err);
      }
    },
    [],
  );

  // Load bulk region data for all providers
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setIsLoading(true);
      const providers = ["aws", "azure", "gcp"];
      const masterList: MappedInstance[] = [];

      try {
        const promises = providers.map(async (p) => {
          const d_regs: Record<string, string> = { aws: "us-east-1", azure: "eastus", gcp: "us-central1" };
          const r = d_regs[p];
          try {
            const url = getDataUrl(`/${p}/${r}.msgpack.zst`);
            const response = await cachedFetch(url);
            if (!response.ok) return;

            const buf = await response.arrayBuffer();
            const decompressed = zstdDecompress(new Uint8Array(buf));
            const decoded: any = decode(decompressed);
            if (decoded?.instances) {
              decoded.instances.forEach((item: any, i: number) => {
                masterList.push(mapRawInstance(item, p, r, i));
              });
            }
          } catch (e) {}
        });

        await Promise.all(promises);

        if (!cancelled) {
          setAllData(masterList);

          if (initialInstanceNames.length > 0) {
            const newInstances: (MappedInstance | null)[] = [null, null, null];
            initialInstanceNames.forEach((name, idx) => {
              const found = masterList.find(
                (m: MappedInstance) =>
                  m.apiName.toLowerCase() === name.toLowerCase(),
              );
              if (found && idx < 3) {
                newInstances[idx] = found;
                fetchInstanceDetail(found.apiName, found.provider, idx);
              }
            });
            setInstances(newInstances);
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Failed to load compare data:", err);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [fetchInstanceDetail]);

  const handleSelectInstance = useCallback(
    (idx: number, inst: MappedInstance) => {
      setInstances((prev) => {
        const next = [...prev];
        next[idx] = inst;
        return next;
      });
      fetchInstanceDetail(inst.apiName, inst.provider, idx);
    },
    [fetchInstanceDetail],
  );

  const handleRemoveInstance = useCallback((idx: number) => {
    setInstances((prev) => {
      const next = [...prev];
      next[idx] = null;
      return next;
    });
    setInstanceDetails((prev) => {
      const next = [...prev];
      next[idx] = null;
      return next;
    });
  }, []);

  const activeColumns = instances.slice(0, columnCount);
  const activeDetails = instanceDetails.slice(0, columnCount);
  const filledCount = activeColumns.filter((i) => i !== null).length;

  const sectionGroups = useMemo(
    () =>
      buildSectionGroups(
        provider,
        region,
        pricingInterval,
        pricingUnit,
        currency,
        reservedPlan,
        azureHybridBenefit,
      ),
    [provider, region, pricingInterval, pricingUnit, currency, reservedPlan, azureHybridBenefit],
  );

  const SERVICE_NAMES: Record<string, string> = {
    aws: "EC2",
    azure: "VIRTUAL MACHINES",
    gcp: "COMPUTE ENGINE",
  };

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 pt-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <Breadcrumb className="mb-4">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild className="text-neutral-500 hover:text-white transition-colors text-[13px] font-medium">
                    <Link href="/">Instances</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-neutral-800" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-white font-medium text-[13px]">
                    Compare
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <h1 className="text-3xl md:text-[40px] font-semibold text-white tracking-tight leading-none">
              Compare Instances
            </h1>
            <p className="mt-4 text-neutral-400 text-sm md:text-base max-w-2xl font-sans leading-relaxed">
              Analyze and compare hardware specifications, network performance,
              and real-time pricing across different instance types and
              providers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex bg-black p-1 rounded-xl border border-neutral-800">
              <button
                onClick={() => setCompareMode("full")}
                className={cn(
                  "relative z-10 px-5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                  compareMode === "full"
                    ? "text-black"
                    : "text-neutral-500 hover:text-white",
                )}
              >
                {compareMode === "full" && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-white rounded-lg -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                FULL SPECS
              </button>
              <button
                onClick={() => setCompareMode("diff")}
                className={cn(
                  "relative z-10 px-5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                  compareMode === "diff"
                    ? "text-black"
                    : "text-neutral-500 hover:text-white",
                )}
              >
                {compareMode === "diff" && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-white rounded-lg -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                DIFFERENCES
              </button>
            </div>

            {columnCount < 3 && (
              <Button
                onClick={() => setColumnCount(3)}
                className="bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-800 h-10 px-5 rounded-xl flex items-center gap-2 font-medium text-sm cursor-pointer"
              >
                <Plus className="h-4 w-4" /> ADD INSTANCE
              </Button>
            )}
          </div>
        </div>

        {/* Comparison Table */}
        <div
          className={cn(
            "relative transition-opacity duration-300",
            isLoading ? "opacity-40 pointer-events-none" : "opacity-100",
          )}
        >
          {isLoading && (
            <div className="absolute inset-0 z-40 flex items-center justify-center">
              <div className="bg-black/40 backdrop-blur-[2px] rounded-2xl px-8 py-4 border border-neutral-800 flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span className="text-white text-sm font-medium">
                  Refreshing Data...
                </span>
              </div>
            </div>
          )}

          <div className="relative overflow-x-auto border border-neutral-800 rounded-2xl bg-neutral-950/50 backdrop-blur-sm">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="sticky left-0 z-30 bg-neutral-950/95 backdrop-blur-md w-[280px] p-6 text-left align-top border-r border-neutral-800">
                    <div className="flex items-center gap-2 text-neutral-500 text-xs font-bold uppercase tracking-[0.2em]">
                      <Activity className="h-3 w-3" /> Specifications
                    </div>
                  </th>
                  {activeColumns.map((instance, idx) => (
                    <InstanceSearchColumn
                      key={idx}
                      instance={instance}
                      allData={allData}
                      onSelect={(inst) => handleSelectInstance(idx, inst)}
                      onRemove={() => handleRemoveInstance(idx)}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sectionGroups.map((section) => {
                  const filteredSpecs =
                    compareMode === "diff" && filledCount > 1
                      ? section.specs.filter((spec) => {
                          const values = activeDetails
                            .map((d, idx) => activeColumns[idx] ? spec.getValue(d, activeColumns[idx]) : "—")
                            .filter((_, idx) => activeColumns[idx] !== null);
                          return !values.every((v) => v === values[0]);
                        })
                      : section.specs;

                  if (filteredSpecs.length === 0 && section.title !== "PRICING")
                    return null;

                  return (
                    <React.Fragment key={section.title}>
                      <tr className="bg-neutral-900/40 border-b border-neutral-800/50">
                        <td className="sticky left-0 z-30 bg-neutral-900/90 backdrop-blur-md px-6 py-3 border-r border-neutral-800">
                          <div className="flex items-center gap-2 text-white">
                            {section.icon}
                            <span className="text-[13px] font-bold uppercase tracking-wider">
                              {section.title}
                            </span>
                          </div>
                        </td>
                        <td colSpan={columnCount} className="px-6 py-3">
                          {section.title === "PRICING" && (
                            <div className="flex flex-wrap items-center gap-6">
                              {/* Plan filters removed */}

                              {provider.toUpperCase() === "AZURE" && (
                                <div className="flex flex-col gap-1.5 min-w-[140px]">
                                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">
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
                                    className="h-9"
                                  />
                                </div>
                              )}

                              <div className="flex flex-col gap-1.5 min-w-[140px]">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">
                                  Pricing Interval
                                </span>
                                <FilterDropdown
                                  label="Interval"
                                  value={pricingInterval}
                                  options={INTERVAL_OPTIONS}
                                  onSelect={setPricingInterval}
                                  className="h-9"
                                />
                              </div>

                              <div className="flex flex-col gap-1.5 min-w-[140px]">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">
                                  Pricing Unit
                                </span>
                                <FilterDropdown
                                  label="Unit"
                                  value={pricingUnit}
                                  options={UNIT_OPTIONS}
                                  onSelect={setPricingUnit}
                                  className="h-9"
                                />
                              </div>

                              <div className="flex flex-col gap-1.5 min-w-[160px]">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">
                                  Currency
                                </span>
                                <FilterDropdown
                                  label="Currency"
                                  value={currency}
                                  options={CURRENCIES}
                                  onSelect={setCurrency}
                                  className="h-9"
                                />
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-bold text-transparent select-none uppercase tracking-widest ml-1">
                                  Spacing
                                </span>
                                <button
                                  onClick={clearFilters}
                                  className="text-xs font-bold text-blue-500 hover:text-blue-400 transition-colors cursor-pointer h-9 flex items-center"
                                >
                                  Clear Filters
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>

                      {filteredSpecs.map((spec, specIdx) => {
                        const values = activeDetails.map((d, idx) =>
                          activeColumns[idx] ? spec.getValue(d, activeColumns[idx]) : "—",
                        );
                        return (
                          <tr
                            key={`${section.title}-${specIdx}`}
                            className="border-b border-neutral-900 hover:bg-white/[0.01] transition-colors group"
                          >
                            <td className="sticky left-0 z-30 bg-neutral-950/95 backdrop-blur-md px-6 py-4 border-r border-neutral-800 text-[13px] font-medium text-neutral-400 group-hover:text-neutral-200">
                              {spec.label}
                            </td>
                            {values.map((val, idx) => (
                              <td
                                key={idx}
                                className={cn(
                                  "px-6 py-4 border-r border-neutral-900 last:border-r-0 text-sm",
                                  !activeColumns[idx] && "bg-neutral-950/20",
                                )}
                              >
                                {activeColumns[idx] ? (
                                  <div className="flex flex-col">
                                    {spec.isPrice ? (
                                      <span
                                        className={cn(
                                          "text-base font-bold",
                                          val !== "—"
                                            ? "text-emerald-400"
                                            : "text-neutral-600",
                                        )}
                                      >
                                        {val}
                                      </span>
                                    ) : (
                                      <span
                                        className={cn(
                                          "font-medium",
                                          val !== "—"
                                            ? "text-neutral-200"
                                            : "text-neutral-700",
                                        )}
                                      >
                                        {val}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-neutral-800">—</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
