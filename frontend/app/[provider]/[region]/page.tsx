import { DataTable } from "@/components/instances-table/data-table";

interface PageProps {
  params: Promise<{
    provider: string;
    region: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;
  const p = resolvedParams.provider.toLowerCase();
  const r = resolvedParams.region;

  const providerName =
    p === "aws"
      ? "AWS"
      : p === "gcp"
        ? "GCP"
        : p === "azure"
          ? "Azure"
          : "Azure";

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 pt-16">
      <DataTable provider={providerName} initialRegion={r} />
    </div>
  );
}
