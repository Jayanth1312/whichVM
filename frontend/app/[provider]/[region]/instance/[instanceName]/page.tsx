import { InstanceDetail } from "@/components/instance-detail/instance-detail";
import { fetchInstanceData } from "@/lib/fetch-instance";
import { Metadata } from "next";

interface PageProps {
  params: Promise<{
    provider: string;
    region: string;
    instanceName: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const provider = resolvedParams.provider.toUpperCase();
  const region = resolvedParams.region;
  const instanceName = decodeURIComponent(resolvedParams.instanceName);

  const instance = await fetchInstanceData(provider, region, instanceName);

  if (!instance) {
    return {
      title: `${instanceName} - WhichVM`,
      description: `Compare ${provider} ${instanceName} pricing and specifications on WhichVM.`,
    };
  }

  let minPrice = 0;
  if (instance.pr) {
    const vals = Object.values(instance.pr).filter((v: any) => typeof v === "number" && v > 0) as number[];
    if (vals.length > 0) minPrice = Math.min(...vals);
  }

  const priceStr = minPrice > 0 
    ? ` Starting at $${minPrice.toFixed(minPrice > 1 ? 2 : 4)}/hr.` 
    : "";

  const description = `${provider} ${instanceName} instance is in the ${instance.f} family with ${instance.v} vCPUs, ${instance.m} GiB of memory and ${instance.a} architecture.${priceStr}`;

  return {
    title: `${instanceName} Pricing and Specs - WhichVM`,
    description,
    openGraph: {
      title: `${instanceName} Pricing and Specs - WhichVM`,
      description,
      type: "website",
    }
  };
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
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 pt-3 sm:pt-6 md:pt-4">
      <InstanceDetail
        provider={providerDisplay}
        region={region}
        instanceName={instanceName}
      />
    </div>
  );
}
