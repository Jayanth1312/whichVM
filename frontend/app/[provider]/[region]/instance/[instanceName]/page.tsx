import { InstanceDetail } from "@/components/instance-detail/instance-detail";

interface PageProps {
  params: Promise<{
    provider: string;
    region: string;
    instanceName: string;
  }>;
}

export default async function InstancePage({ params }: PageProps) {
  const resolvedParams = await params;
  const provider = resolvedParams.provider.toLowerCase();
  const region = resolvedParams.region;
  const instanceName = decodeURIComponent(resolvedParams.instanceName);

  const providerDisplay =
    provider === "aws"
      ? "AWS"
      : provider === "gcp"
        ? "GCP"
        : provider === "azure"
          ? "Azure"
          : "AWS";

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 pt-16">
      <InstanceDetail
        provider={providerDisplay}
        region={region}
        instanceName={instanceName}
      />
    </div>
  );
}
