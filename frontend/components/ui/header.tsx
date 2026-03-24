"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GlobalSearch } from "@/components/ui/global-search";
import { AmazonWebServices } from "@/app/icons/amazonIcon";
import { MicrosoftAzure } from "@/app/icons/azureIcon";
import { GoogleCloud } from "@/app/icons/gcpIcon";
import { GitHub } from "@/app/icons/githubIcon";

const providers = ["AWS", "Azure", "GCP"];

const DEFAULT_REGIONS: Record<string, string> = {
  Azure: "eastus",
  GCP: "us-central1",
  AWS: "us-east-1",
};

import { Suspense } from "react";

interface HeaderProps {
  activeProvider?: string;
}

function HeaderContent({ activeProvider: propActiveProvider }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Detect provider from URL (e.g., /aws/us-east-1 -> AWS)
  const detectedProvider = React.useMemo(() => {
    let p: string | undefined = pathname.split("/")[1]?.toLowerCase();

    if (pathname === "/compare") {
      p = searchParams.get("provider")?.toLowerCase();
    }

    if (p === "aws") return "AWS";
    if (p === "gcp") return "GCP";
    if (p === "azure") return "Azure";
    return propActiveProvider || "AWS";
  }, [pathname, searchParams, propActiveProvider]);

  const [localActive, setLocalActive] = useState(detectedProvider);

  // Keep local state in sync with URL
  useEffect(() => {
    setLocalActive(detectedProvider);
  }, [detectedProvider]);

  const handleProviderChange = (provider: string) => {
    setLocalActive(provider);
    const defaultRegion = DEFAULT_REGIONS[provider] || "eastus";
    router.push(`/${provider.toLowerCase()}/${defaultRegion}`);
  };

  const handleHomeClick = () => {
    const defaultRegion = DEFAULT_REGIONS[localActive] || "eastus";
    router.push(`/${localActive.toLowerCase()}/${defaultRegion}`);
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-black/80 backdrop-blur-md border-b border-neutral-900">
      <div className="mx-auto w-full flex h-16 items-center justify-between px-4 sm:px-6">
        
        {/* Left: Brand */}
        <div
          onClick={handleHomeClick}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="text-white"
          >
            <path
              d="M12 1L22 6.5V17.5L12 23L2 17.5V6.5L12 1Z"
              fill="currentColor"
            />
            <path
              d="M2 6.5L12 12L22 6.5"
              stroke="black"
              strokeWidth="1.5"
              strokeLinejoin="miter"
            />
            <path
              d="M12 23V12"
              stroke="black"
              strokeWidth="1.5"
              strokeLinejoin="miter"
            />
          </svg>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-normal text-neutral-800 transition-colors group-hover:text-neutral-600">
              /
            </span>
          </div>
          <span className="text-[18px] font-semibold tracking-tight text-white transition-opacity group-hover:opacity-80">
            WhichVM
          </span>
        </div>

        {/* Center: Navigation */}
        <nav className="flex items-center h-full gap-2 overflow-x-auto">
          {providers.map((provider) => {
            const defaultRegion = DEFAULT_REGIONS[provider] || "eastus";
            return (
              <Link
                key={provider}
                href={`/${provider.toLowerCase()}/${defaultRegion}`}
                onClick={() => setLocalActive(provider)}
                prefetch={true}
                className={cn(
                  "relative flex h-full items-center px-1 text-[15px] font-medium transition-colors duration-200 cursor-pointer",
                  localActive === provider
                    ? "text-white"
                    : "text-neutral-500 hover:text-neutral-200",
                )}
              >
                <span
                  className={cn(
                    "rounded-md px-3 py-1.5 transition-colors flex items-center gap-1.5",
                    localActive === provider
                      ? "bg-neutral-900 text-white"
                      : "hover:bg-neutral-900",
                  )}
                >
                  {provider.toLowerCase() === "aws" && (
                    <AmazonWebServices className="w-4 h-4" />
                  )}
                  {provider.toLowerCase() === "azure" && (
                    <MicrosoftAzure className="w-4 h-4" />
                  )}
                  {provider.toLowerCase() === "gcp" && (
                    <GoogleCloud className="w-4 h-4" />
                  )}
                  {provider}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <GlobalSearch />
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/compare")}
            className="h-10 gap-2.5 pl-1.5 pr-4 rounded-lg border border-neutral-800! transition-colors cursor-pointer flex items-center bg-black/50 hover:bg-neutral-900/75!"
          >
            <div className="flex items-center -space-x-2.5">
              <div className="w-7 h-7 rounded-full bg-[#0a0a0a] border border-neutral-800 flex items-center justify-center p-1.5 overflow-hidden">
                <AmazonWebServices className="w-full h-full" />
              </div>
              <div className="w-7 h-7 rounded-full bg-[#0a0a0a] border border-neutral-800 flex items-center justify-center p-1.5 overflow-hidden">
                <MicrosoftAzure className="w-full h-full" />
              </div>
              <div className="w-7 h-7 rounded-full bg-[#0a0a0a] border border-neutral-800 flex items-center justify-center p-1.5 overflow-hidden">
                <GoogleCloud className="w-full h-full" />
              </div>
            </div>
            <span className="text-[14px] font-semibold text-white">
              Compare
            </span>
          </Button>
          {/* <Button
            variant="outline"
            size="sm"
            asChild
            className="h-10 gap-1.5 px-3 rounded-lg border border-neutral-800! bg-black/50 hover:bg-neutral-900/75! transition-colors cursor-pointer flex items-center"
          >
            <a
              href="https://github.com/Jayanth1312/whichVM"
              target="_blank"
              rel="noopener noreferrer"
            >
              <GitHub className="w-4 h-4 text-white" fill="none" />
              <span className="text-[13px] font-medium text-white">Star</span>
            </a>
          </Button> */}
        </div>

      </div>
    </header>
  );
}

export function Header(props: HeaderProps) {
  return (
    <Suspense
      fallback={
        <header className="sticky top-0 z-50 w-full h-16 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-xl" />
      }
    >
      <HeaderContent {...props} />
    </Suspense>
  );
}
