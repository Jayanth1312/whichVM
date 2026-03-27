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
import { ThemeToggle } from "@/components/theme-toggle";
import { Columns2 } from "lucide-react";

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
      return "none";
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

  const navItems = providers.map((provider) => {
    const defaultRegion = DEFAULT_REGIONS[provider] || "eastus";
    return (
      <Link
        key={provider}
        href={`/${provider.toLowerCase()}/${defaultRegion}`}
        onClick={() => setLocalActive(provider)}
        prefetch={true}
        className={cn(
          "relative flex h-full items-center px-1 text-[13px] sm:text-[15px] font-medium transition-colors duration-200 cursor-pointer",
          localActive === provider
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span
          className={cn(
            "rounded-md px-2 sm:px-3 py-1 sm:py-1.5 transition-colors flex items-center gap-1.5",
            localActive === provider
              ? "bg-secondary text-foreground"
              : "hover:bg-secondary",
          )}
        >
          {provider.toLowerCase() === "aws" && (
            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-zinc-900 dark:bg-transparent flex items-center justify-center overflow-hidden">
              <AmazonWebServices className="w-3 h-3 sm:w-3.5 sm:h-3.5 translate-y-px dark:translate-y-0 dark:w-4 dark:h-4 sm:dark:w-5 sm:dark:h-5" />
            </div>
          )}
          {provider.toLowerCase() === "azure" && (
            <MicrosoftAzure className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          )}
          {provider.toLowerCase() === "gcp" && (
            <GoogleCloud className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          )}
          {provider}
        </span>
      </Link>
    );
  });

  const compareBtn = (
    <Button
      variant="outline"
      size="sm"
      onClick={() => router.push("/compare")}
      className="h-9 w-9 md:h-10 md:w-10 lg:w-auto p-0 lg:pl-3 lg:pr-4 aspect-square lg:aspect-auto flex items-center justify-center gap-1.5 lg:gap-2 rounded-lg border border-border! transition-colors cursor-pointer bg-card/50 hover:bg-secondary! shrink-0"
    >
      <Columns2 className="w-4 h-4 md:w-[18px] md:h-[18px] text-foreground" strokeWidth={2} />
      <span className="hidden lg:inline-block text-[13px] md:text-[14px] font-semibold text-foreground">
        Compare
      </span>
    </Button>
  );

  return (
    <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border">
      <div className="mx-auto w-full flex flex-col md:flex-row md:h-16 items-center justify-between px-4 sm:px-6 py-3 md:py-0 gap-3 md:gap-0">

        {/* Mobile Top Row / Desktop Left Brand */}
        <div className="flex items-center justify-between w-full md:w-auto">
          {/* Brand */}
          <div
            onClick={handleHomeClick}
            className="flex items-center gap-1.5 sm:gap-2.5 cursor-pointer group shrink-0"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              className="text-foreground sm:w-6 sm:h-6"
            >
              <path
                d="M12 1L22 6.5V17.5L12 23L2 17.5V6.5L12 1Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="dark:fill-white dark:stroke-black"
              />
              <path
                d="M2 6.5L12 12L22 6.5"
                stroke="black"
                strokeWidth="1.5"
                strokeLinejoin="miter"
                className="dark:stroke-black"
              />
              <path
                d="M12 23V12"
                stroke="black"
                strokeWidth="1.5"
                strokeLinejoin="miter"
                className="dark:stroke-black"
              />
            </svg>
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-xl sm:text-2xl font-normal text-muted-foreground transition-colors group-hover:text-muted-foreground/70">
                /
              </span>
            </div>
            <span className="text-[15px] sm:text-[18px] font-semibold tracking-tight text-foreground transition-opacity group-hover:opacity-80">
              WhichVM
            </span>
          </div>

          {/* Mobile Search & Compare (Hidden on md) */}
          <div className="flex md:hidden items-center gap-2 overflow-visible ml-8 flex-1 justify-end">
            <div className="flex-1 w-full min-w-0">
              <GlobalSearch />
            </div>
            {compareBtn}
          </div>
        </div>

        {/* Center: Navigation (Hidden on mobile) */}
        <nav className="hidden md:flex items-center h-full gap-2 overflow-x-auto no-scrollbar">
          {navItems}
        </nav>

        {/* Right: Actions / Mobile Bottom Row */}
        <div className="flex items-center w-full md:w-auto gap-3 md:gap-3 lg:gap-5 justify-start md:justify-end mt-2 md:mt-0">
          {/* Mobile Navigation */}
          <div className="flex md:hidden items-center h-full overflow-hidden shrink w-auto max-w-[calc(100vw-80px)]">
            <nav className="flex items-center h-full gap-6 sm:gap-5 overflow-x-auto no-scrollbar w-full">
              {navItems}
            </nav>
          </div>

          <div className="hidden md:flex flex-1 md:flex-initial">
            <GlobalSearch />
          </div>
          <div className="hidden md:block">
            {compareBtn}
          </div>
          <ThemeToggle className="shrink-0 ml-auto md:ml-0" />
        </div>

      </div>
    </header>
  );
}

export function Header(props: HeaderProps) {
  return (
    <Suspense
      fallback={
        <header className="sticky top-0 z-50 w-full h-16 border-b border-border bg-background/80 backdrop-blur-xl" />
      }
    >
      <HeaderContent {...props} />
    </Suspense>
  );
}
