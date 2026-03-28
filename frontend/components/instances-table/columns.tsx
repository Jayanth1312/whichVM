"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";

export type Instance = {
  id: string;
  name: string;
  apiName: string;
  memory: string;
  vcpus: number | string;
  family?: string;
  network?: string;
  storage?: string;

  // New Specs
  processor?: string;
  clockSpeed?: string;
  architecture?: string;
  memoryPerVCPU?: string;
  l3Cache?: string;
  gpuCount?: number;
  gpuName?: string;
  gpuMemory?: string;
  numaNodes?: number | string;
  numaDistance?: number | string;
  enhancedNetwork?: string;
  ipv6?: string;
  placementGroup?: string;
  bareMetal?: string;
  hypervisor?: string;
  generation?: string;
  freeTier?: string;
  ebsOptimized?: string;
  ebsBandwidth?: string;
  ebsIops?: string;
  emr?: string;
  hibernation?: string;
  coreMark?: string;
  ffmpegFPS?: string;

  linuxCost?: string;
  windowsCost?: string;
  linuxOnDemandCost?: string;
  linuxSpotCost?: string;
  windowsOnDemandCost?: string;
  windowsSpotCost?: string;
  rhelCost?: string;
  ubuntuCost?: string;
  slesCost?: string;
  instancePrice?: string;

  region?: string;
  provider?: string;
};

const selectColumn: ColumnDef<Instance> = {
  id: "select",
  header: ({ table }) => (
    <Checkbox
      checked={
        table.getIsAllPageRowsSelected() ||
        (table.getIsSomePageRowsSelected() && "indeterminate")
      }
      onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      aria-label="Select all"
    />
  ),
  cell: ({ row }) => (
    <div
      className="flex items-center justify-center w-full h-full"
      onClick={(e) => e.stopPropagation()}
    >
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    </div>
  ),
  enableSorting: false,
  enableHiding: false,
  size: 50,
  minSize: 50,
  maxSize: 50,
};

const nameColumn: ColumnDef<Instance> = {
  accessorKey: "name",
  header: "Name",
  size: 260,
  minSize: 200,
  cell: ({ row }) => {
    const provider = (row.original.provider || "aws").toLowerCase();
    const name = row.getValue("name") as string;
    const family = row.original.family;
    const displayName =
      provider === "azure" && family ? family.replace(/_/g, " ") : name;

    return (
      <div className="font-medium text-foreground px-4 text-left truncate-custom">
        {displayName}
      </div>
    );
  },
};

const apiNameColumn: ColumnDef<Instance> = {
  accessorKey: "apiName",
  header: "API Name",
  size: 180,
  minSize: 140,
  cell: ({ row }) => {
    const apiName = row.getValue("apiName") as string;
    const provider = (row.original.provider || "aws").toLowerCase();
    const region = row.original.region || "";
    const href = `/${provider}/${region}/instance/${encodeURIComponent(apiName)}`;
    const family = row.original.family;
    const displayName =
      provider === "azure" && family ? family.replace(/_/g, " ") : apiName;

    return (
      <div className="px-4 text-left truncate-custom">
        <Link
          href={href}
          className="text-blue-600 font-mono text-xs cursor-pointer relative group pb-0.5 hover:text-blue-500"
          onClick={(e) => e.stopPropagation()}
        >
          {displayName}
          <span className="absolute bottom-0 left-0 w-0 h-px bg-blue-600 group-hover:w-full" />
        </Link>
      </div>
    );
  },
};

const familyColumn: ColumnDef<Instance> = {
  accessorKey: "family",
  header: "Compute Family",
  size: 200,
  minSize: 170,
  cell: ({ row }) => (
    <div className="text-muted-foreground text-sm px-4 text-left truncate-custom">
      {row.getValue("family") || "-"}
    </div>
  ),
};

const memoryColumn: ColumnDef<Instance> = {
  accessorKey: "memory",
  header: "Instance Memory",
  size: 200,
  minSize: 170,
  meta: { showTooltip: true },
  cell: ({ row }) => (
    <div className="text-foreground text-sm px-4 text-left truncate-custom">
      {row.getValue("memory") || "-"}
    </div>
  ),
};

const vcpusColumn: ColumnDef<Instance> = {
  accessorKey: "vcpus",
  header: "vCPUs",
  size: 110,
  minSize: 90,
  meta: { showTooltip: true },
  cell: ({ row }) => {
    const val = row.getValue("vcpus");
    return (
      <div className="text-foreground text-sm px-4 text-left truncate-custom">
        {val ? `${val}` : "-"}
      </div>
    );
  },
};

const storageColumn: ColumnDef<Instance> = {
  accessorKey: "storage",
  header: "Instance Storage",
  size: 200,
  minSize: 170,
  meta: { showTooltip: true },
  cell: ({ row }) => (
    <div className="text-muted-foreground text-sm px-4 text-left truncate-custom">
      {row.getValue("storage") || "-"}
    </div>
  ),
};

const networkColumn: ColumnDef<Instance> = {
  accessorKey: "network",
  header: "Network Performance",
  size: 230,
  minSize: 190,
  cell: ({ row }) => (
    <div className="text-muted-foreground text-sm px-4 text-left truncate-custom">
      {row.getValue("network") || "-"}
    </div>
  ),
};

// Pricing Columns

export const linuxOnDemandCostColumn: ColumnDef<Instance> = {
  accessorKey: "linuxOnDemandCost",
  header: "Linux On Demand",
  size: 160,
  minSize: 140,
  cell: ({ row }) => (
    <div className="font-medium text-emerald-600 dark:text-emerald-400 px-4 text-left truncate-custom">
      {row.getValue("linuxOnDemandCost")}
    </div>
  ),
};

export const linuxSpotCostColumn: ColumnDef<Instance> = {
  accessorKey: "linuxSpotCost",
  header: "Linux Spot",
  size: 160,
  minSize: 140,
  cell: ({ row }) => (
    <div className="font-medium text-emerald-600 dark:text-emerald-400 px-4 text-left truncate-custom">
      {row.getValue("linuxSpotCost")}
    </div>
  ),
};

export const windowsOnDemandCostColumn: ColumnDef<Instance> = {
  accessorKey: "windowsOnDemandCost",
  header: "Windows On Demand",
  size: 160,
  minSize: 140,
  cell: ({ row }) => (
    <div className="font-medium text-emerald-600 dark:text-emerald-400 px-4 text-left truncate-custom">
      {row.getValue("windowsOnDemandCost")}
    </div>
  ),
};

export const windowsSpotCostColumn: ColumnDef<Instance> = {
  accessorKey: "windowsSpotCost",
  header: "Windows Spot",
  size: 160,
  minSize: 140,
  cell: ({ row }) => (
    <div className="font-medium text-emerald-600 dark:text-emerald-400 px-4 text-left truncate-custom">
      {row.getValue("windowsSpotCost")}
    </div>
  ),
};

const linuxCostColumn: ColumnDef<Instance> = {
  accessorKey: "linuxCost",
  header: "Linux Cost",
  size: 200,
  minSize: 160,
  cell: ({ row }) => (
    <div className="font-medium text-emerald-600 dark:text-emerald-400 px-4 text-left truncate-custom">
      {row.getValue("linuxCost")}
    </div>
  ),
};

const windowsCostColumn: ColumnDef<Instance> = {
  accessorKey: "windowsCost",
  header: "Windows Cost",
  size: 200,
  minSize: 160,
  cell: ({ row }) => (
    <div className="font-medium text-emerald-600 dark:text-emerald-400 px-4 text-left truncate-custom">
      {row.getValue("windowsCost")}
    </div>
  ),
};

const rhelCostColumn: ColumnDef<Instance> = {
  accessorKey: "rhelCost",
  header: "RHEL Cost",
  size: 200,
  minSize: 160,
  cell: ({ row }) => (
    <div className="font-medium text-emerald-600 dark:text-emerald-400 px-4 text-left truncate-custom">
      {row.getValue("rhelCost")}
    </div>
  ),
};

const ubuntuCostColumn: ColumnDef<Instance> = {
  accessorKey: "ubuntuCost",
  header: "Ubuntu Cost",
  size: 200,
  minSize: 160,
  cell: ({ row }) => (
    <div className="font-medium text-emerald-600 dark:text-emerald-400 px-4 text-left truncate-custom">
      {row.getValue("ubuntuCost")}
    </div>
  ),
};

const slesCostColumn: ColumnDef<Instance> = {
  accessorKey: "slesCost",
  header: "SLES Cost",
  size: 200,
  minSize: 160,
  cell: ({ row }) => (
    <div className="font-medium text-emerald-600 dark:text-emerald-400 px-4 text-left truncate-custom">
      {row.getValue("slesCost")}
    </div>
  ),
};

const instancePriceColumn: ColumnDef<Instance> = {
  accessorKey: "instancePrice",
  header: "Instance Price",
  size: 200,
  minSize: 160,
  cell: ({ row }) => (
    <div className="font-medium text-emerald-600 dark:text-emerald-400 px-4 text-left truncate-custom">
      {row.getValue("instancePrice")}
    </div>
  ),
};

const processorColumn: ColumnDef<Instance> = {
  accessorKey: "processor",
  header: "Physical Processor",
  size: 250,
  minSize: 200,
  meta: { isAdvanced: true },
  cell: ({ row }) => (
    <div className="text-muted-foreground text-sm px-4 text-left truncate-custom">
      {row.getValue("processor") || "-"}
    </div>
  ),
};

const clockSpeedColumn: ColumnDef<Instance> = {
  accessorKey: "clockSpeed",
  header: "Clock Speed (GHz)",
  size: 160,
  minSize: 130,
  meta: { isAdvanced: true },
  cell: ({ row }) => (
    <div className="text-muted-foreground text-sm px-4 text-left truncate-custom">
      {row.getValue("clockSpeed") || "-"}
    </div>
  ),
};

const archColumn: ColumnDef<Instance> = {
  accessorKey: "architecture",
  header: "Arch",
  size: 100,
  minSize: 80,
  meta: { isAdvanced: true },
  cell: ({ row }) => (
    <div className="text-muted-foreground text-sm px-4 text-left truncate-custom uppercase">
      {row.getValue("architecture") || "-"}
    </div>
  ),
};

const memoryPerVCPUColumn: ColumnDef<Instance> = {
  accessorKey: "memoryPerVCPU",
  header: "GiB RAM per vCPU",
  size: 160,
  minSize: 130,
  meta: { isAdvanced: true },
  cell: ({ row }) => (
    <div className="text-muted-foreground text-sm px-4 text-center truncate-custom">
      {row.getValue("memoryPerVCPU") || "-"}
    </div>
  ),
};

const l3CacheColumn: ColumnDef<Instance> = {
  accessorKey: "l3Cache",
  header: "L3 Cache",
  size: 130,
  minSize: 100,
  meta: { isAdvanced: true },
  cell: ({ row }) => (
    <div className="text-muted-foreground text-sm px-4 text-center truncate-custom uppercase">
      {row.getValue("l3Cache") || "-"}
    </div>
  ),
};

const gpuCountColumn: ColumnDef<Instance> = {
  accessorKey: "gpuCount",
  header: "GPUs",
  size: 80,
  minSize: 60,
  meta: { isAdvanced: true },
  cell: ({ row }) => (
    <div className="text-muted-foreground text-sm px-4 text-center truncate-custom">
      {row.getValue("gpuCount") ?? "-"}
    </div>
  ),
};

const gpuNameColumn: ColumnDef<Instance> = {
  accessorKey: "gpuName",
  header: "GPU Model",
  size: 180,
  minSize: 140,
  meta: { isAdvanced: true },
  cell: ({ row }) => (
    <div className="text-muted-foreground text-sm px-4 text-left truncate-custom">
      {row.getValue("gpuName") || "-"}
    </div>
  ),
};

const gpuMemoryColumn: ColumnDef<Instance> = {
  accessorKey: "gpuMemory",
  header: "GPU Memory",
  size: 130,
  minSize: 100,
  meta: { isAdvanced: true },
  cell: ({ row }) => (
    <div className="text-muted-foreground text-sm px-4 text-left truncate-custom">
      {row.getValue("gpuMemory") || "-"}
    </div>
  ),
};

const numaNodesColumn: ColumnDef<Instance> = {
  accessorKey: "numaNodes",
  header: "NUMA Nodes",
  size: 120,
  minSize: 100,
  meta: { isAdvanced: true },
  cell: ({ row }) => (
    <div className="text-muted-foreground text-sm px-4 text-center truncate-custom">
      {row.getValue("numaNodes") ?? "-"}
    </div>
  ),
};

const enhancedNetworkColumn: ColumnDef<Instance> = {
  accessorKey: "enhancedNetwork",
  header: "Enhanced Network",
  size: 160,
  minSize: 130,
  meta: { isAdvanced: true },
  cell: ({ row }) => (
    <div className="text-muted-foreground text-sm px-4 text-left truncate-custom uppercase">
      {row.getValue("enhancedNetwork") || "-"}
    </div>
  ),
};

const ipv6Column: ColumnDef<Instance> = {
  accessorKey: "ipv6",
  header: "IPv6 Support",
  size: 120,
  minSize: 100,
  meta: { isAdvanced: true },
  cell: ({ row }) => (
    <div className="text-muted-foreground text-sm px-4 text-left truncate-custom uppercase">
      {row.getValue("ipv6") || "-"}
    </div>
  ),
};

const bareMetalColumn: ColumnDef<Instance> = {
  accessorKey: "bareMetal",
  header: "Bare Metal",
  size: 120,
  minSize: 100,
  meta: { isAdvanced: true },
  cell: ({ row }) => (
    <div className="text-muted-foreground text-sm px-4 text-left truncate-custom uppercase">
      {row.getValue("bareMetal") || "-"}
    </div>
  ),
};

const generationColumn: ColumnDef<Instance> = {
  accessorKey: "generation",
  header: "Generation",
  size: 140,
  minSize: 110,
  meta: { isAdvanced: true },
  cell: ({ row }) => (
    <div className="text-muted-foreground text-sm px-4 text-left truncate-custom">
      {row.getValue("generation") || "-"}
    </div>
  ),
};

const ebsBandwidthColumn: ColumnDef<Instance> = {
  accessorKey: "ebsBandwidth",
  header: "EBS Max Bandwidth",
  size: 180,
  minSize: 140,
  meta: { isAdvanced: true },
  cell: ({ row }) => (
    <div className="text-muted-foreground text-sm px-4 text-left truncate-custom">
      {row.getValue("ebsBandwidth") || "-"}
    </div>
  ),
};



const ffmpegFPSColumn: ColumnDef<Instance> = {
  accessorKey: "ffmpegFPS",
  header: "FFmpeg FPS",
  size: 140,
  minSize: 110,
  meta: { isAdvanced: true },
  cell: ({ row }) => (
    <div className="text-muted-foreground text-sm px-4 text-center truncate-custom">
      {row.getValue("ffmpegFPS") || "-"}
    </div>
  ),
};

const emrColumn: ColumnDef<Instance> = {
  accessorKey: "emr",
  header: "EMR Ready",
  size: 120,
  minSize: 100,
  meta: { isAdvanced: true },
  cell: ({ row }) => (
    <div className="text-muted-foreground text-sm px-4 text-center truncate-custom uppercase">
      {row.getValue("emr") || "-"}
    </div>
  ),
};

const hibernationColumn: ColumnDef<Instance> = {
  accessorKey: "hibernation",
  header: "Hibernation",
  size: 130,
  minSize: 100,
  meta: { isAdvanced: true },
  cell: ({ row }) => (
    <div className="text-muted-foreground text-sm px-4 text-center truncate-custom uppercase">
      {row.getValue("hibernation") || "-"}
    </div>
  ),
};
const awsColumns: ColumnDef<Instance>[] = [
  selectColumn,
  nameColumn,
  apiNameColumn,
  familyColumn,
  generationColumn,
  vcpusColumn,
  memoryColumn,
  memoryPerVCPUColumn,
  processorColumn,
  clockSpeedColumn,
  archColumn,
  ffmpegFPSColumn,
  l3CacheColumn,
  storageColumn,
  networkColumn,
  enhancedNetworkColumn,
  ebsBandwidthColumn,
  gpuCountColumn,
  gpuNameColumn,
  gpuMemoryColumn,
  bareMetalColumn,
  hibernationColumn,
  emrColumn,
  ipv6Column,
  linuxOnDemandCostColumn,
  linuxSpotCostColumn,
  windowsOnDemandCostColumn,
  windowsSpotCostColumn,
];

const azureColumns: ColumnDef<Instance>[] = [
  selectColumn,
  nameColumn,
  apiNameColumn,
  vcpusColumn,
  memoryColumn,
  memoryPerVCPUColumn,
  processorColumn,
  archColumn,
  numaNodesColumn,
  storageColumn,
  networkColumn,
  enhancedNetworkColumn,
  ebsBandwidthColumn,
  gpuCountColumn,
  gpuNameColumn,
  gpuMemoryColumn,
  linuxCostColumn,
  windowsCostColumn,
  rhelCostColumn,
  ubuntuCostColumn,
  slesCostColumn,
];

const gcpColumns: ColumnDef<Instance>[] = [
  selectColumn,
  nameColumn,
  apiNameColumn,
  familyColumn,
  generationColumn,
  vcpusColumn,
  memoryColumn,
  processorColumn,
  clockSpeedColumn,
  archColumn,
  storageColumn,
  networkColumn,
  gpuCountColumn,
  gpuNameColumn,
  gpuMemoryColumn,
  bareMetalColumn,
  instancePriceColumn,
];

export function getColumns(provider: string): ColumnDef<Instance>[] {
  switch (provider.toUpperCase()) {
    case "AZURE":
      return azureColumns;
    case "GCP":
      return gcpColumns;
    case "AWS":
      return awsColumns;
    default:
      return awsColumns;
  }
}

export const columns = awsColumns;
