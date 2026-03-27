import { DataTable } from "@/components/instances-table/data-table";
import { Metadata } from "next";

interface PageProps {
  params: Promise<{
    provider: string;
    region: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const p = resolvedParams.provider.toUpperCase();
  const r = resolvedParams.region;

  const title = `Compare ${p} Instances in ${r} | WhichVM`;
  const description = `Find the best ${p} VM for your workload in the ${r} region. Compare CPU, RAM, and pricing instantly for AWS, Azure, and Google Cloud with WhichVM.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `https://whichvm.com/${resolvedParams.provider}/${r}`,
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: `WhichVM - ${p} ${r}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-image.png"],
    },
  };
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
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 pt-0 sm:pt-6 md:pt-4">
      <DataTable provider={providerName} initialRegion={r} />
    </div>
  );
}
