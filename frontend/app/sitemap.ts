import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://whichvm.com";

  // List of known providers and regions (from the project structure/common knowledge)
  const providers = ["aws", "azure", "gcp"];
  const regions: Record<string, string[]> = {
    aws: [
      "ap-east-2", "ap-southeast-6", "ap-east-1", "ap-northeast-3", "ap-southeast-3",
      "ap-southeast-5", "ap-southeast-4", "ap-southeast-7", "eu-central-2", "il-central-1",
      "ca-west-1", "me-central-1", "me-south-1", "mx-central-1", "af-south-1",
      "ap-south-2", "eu-south-1", "eu-west-3", "eu-south-2", "us-gov-east-1",
      "ap-northeast-2", "ap-south-1", "ca-central-1", "eu-north-1", "eu-west-2",
      "us-gov-west-1", "us-west-1", "sa-east-1", "ap-southeast-1", "ap-southeast-2",
      "eu-west-1", "ap-northeast-1", "eu-central-1", "us-east-1", "us-east-2", "us-west-2"
    ],
    azure: [
      "chilecentral", "usgovtexas", "australiacentral", "australiacentral2", "australiasoutheast",
      "austriaeast", "brazilsoutheast", "brazilsouth", "belgiumcentral", "canadaeast",
      "francecentral", "francesouth", "germanynorth", "israelcentral", "indonesiacentral",
      "italynorth", "jioindiawest", "japanwest", "koreacentral", "koreasouth",
      "malaysiawest", "newzealandnorth", "mexicocentral", "northcentralus", "norwayeast",
      "norwaywest", "southafricanorth", "qatarcentral", "polandcentral", "southafricawest",
      "southindia", "spaincentral", "uaecentral", "switzerlandwest", "ukwest",
      "usgovarizona", "westcentralus", "usgovvirginia", "westindia", "australiaeast",
      "canadacentral", "centralus", "centralindia", "eastasia", "eastus",
      "eastus2", "germanywestcentral", "japaneast", "northeurope", "southcentralus",
      "southeastasia", "switzerlandnorth", "swedencentral", "uaenorth", "uksouth",
      "westeurope", "westus", "westus2", "westus3"
    ],
    gcp: [
      "africa-south1", "asia-east2", "asia-east1", "asia-northeast2", "asia-northeast1",
      "asia-northeast3", "asia-south2", "asia-south1", "asia-southeast2", "asia-southeast3",
      "asia-southeast1", "australia-southeast2", "europe-central2", "australia-southeast1",
      "europe-north2", "europe-north1", "europe-southwest1", "europe-west10", "europe-west1",
      "europe-west12", "europe-west2", "europe-west3", "europe-west6", "europe-west4",
      "europe-west8", "europe-west9", "me-central1", "me-central2", "me-west1",
      "northamerica-northeast1", "northamerica-northeast2", "northamerica-south1", "southamerica-east1",
      "southamerica-west1", "us-central1", "us-east1", "us-east4", "us-east5",
      "us-south1", "us-west1", "us-west3", "us-west2", "us-west4"
    ],
  };

  const providerRoutes = providers.flatMap((p) => {
    return regions[p].map((r) => ({
      url: `${baseUrl}/${p}/${r}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));
  });

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "yearly" as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/compare`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.9,
    },
    ...providerRoutes,
  ];
}
