"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { GlobalSearch } from "@/components/ui/global-search";
import { AmazonWebServices } from "@/app/icons/amazonIcon";
import { MicrosoftAzure } from "@/app/icons/azureIcon";
import { GoogleCloud } from "@/app/icons/gcpIcon";

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

  const [isScrolled, setIsScrolled] = useState(false);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const transitionLockRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const [localActive, setLocalActive] = useState(detectedProvider);

  // Keep local state in sync with URL
  useEffect(() => {
    setLocalActive(detectedProvider);
  }, [detectedProvider]);

  const handleProviderChange = (provider: string) => {
    // Lock indicator position during route transition to prevent jitter
    transitionLockRef.current = true;
    setLocalActive(provider);
    const defaultRegion = DEFAULT_REGIONS[provider] || "eastus";
    router.push(`/${provider.toLowerCase()}/${defaultRegion}`);

    // Release lock after animation completes
    setTimeout(() => {
      transitionLockRef.current = false;
    }, 600);
  };

  const handleHomeClick = () => {
    const defaultRegion = DEFAULT_REGIONS[localActive] || "eastus";
    router.push(`/${localActive.toLowerCase()}/${defaultRegion}`);
  };

  useEffect(() => {
    const SCROLL_IN_THRESHOLD = 90;
    const SCROLL_OUT_THRESHOLD = 10;

    const handleScroll = () => {
      const y = window.scrollY;
      setIsScrolled((prev) => {
        if (!prev && y > SCROLL_IN_THRESHOLD) return true;
        if (prev && y < SCROLL_OUT_THRESHOLD) return false;
        return prev;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Update sliding indicator position whenever active tab changes
  useEffect(() => {
    const updateIndicator = () => {
      const el = tabRefs.current[localActive];
      if (el) {
        setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
      }
    };

    // Always update immediately on tab change (this is intentional)
    updateIndicator();

    // ResizeObserver only updates when NOT transitioning
    const resizeObserver = new ResizeObserver(() => {
      if (transitionLockRef.current) return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateIndicator);
    });

    const activeEl = tabRefs.current[localActive];
    if (activeEl) {
      resizeObserver.observe(activeEl.parentElement!);
    }

    return () => {
      resizeObserver.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [localActive]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        isScrolled ? "bg-black/80 backdrop-blur-md" : "bg-black",
      )}
    >
      <div className="relative mx-auto w-full border-b border-neutral-900">
        <div
          onClick={handleHomeClick}
          className="pointer-events-auto cursor-pointer absolute left-4 sm:left-6 z-10 flex items-center transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{
            top: "20px",
            transform: isScrolled
              ? "translateY(-4px) scale(0.85)"
              : "translateY(0px) scale(1)",
          }}
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
        </div>

        {/* Global Search & Compare Button - Top Right Absolute Position */}
        <div
          className="absolute right-4 sm:right-6 top-3 flex items-center gap-3 z-30 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{
            transform: isScrolled ? "translateY(-4px)" : "translateY(0px)",
          }}
        >
          <GlobalSearch />
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/compare")}
            className="h-10 gap-2.5 pl-1.5 pr-4 rounded-full border border-neutral-800! transition-colors cursor-pointer flex items-center bg-black/50 hover:bg-neutral-900/75!"
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
        </div>

        <div
          className={cn(
            "flex items-center justify-between px-4 sm:px-6 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
            isScrolled
              ? "h-0 opacity-0 translate-y-[-10px] overflow-hidden"
              : "h-16 opacity-100 translate-y-0",
          )}
        >
          <div
            onClick={handleHomeClick}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-[28px]" />
            <div className="flex items-center gap-2">
              <span className="text-2xl font-normal text-neutral-800 transition-colors group-hover:text-neutral-600">
                /
              </span>
            </div>
            <span className="text-[18px] font-semibold tracking-tight text-white transition-opacity group-hover:opacity-80">
              WhichVM
            </span>
          </div>
        </div>

        {/* Bottom Row: Navigation + Persistent Elements */}
        <nav className="flex h-14 items-center justify-between px-4 sm:px-6 relative">
          <div className="flex items-center h-full">
            <div
              className="flex items-center transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
              style={{ width: isScrolled ? "38px" : "0px" }}
            >
              {/* Spacer for the absolute icon when scrolled */}
            </div>

            {/* Tab list */}
            <div className="relative flex h-full items-center gap-2">
              {providers.map((provider) => (
                <button
                  key={provider}
                  ref={(el) => {
                    tabRefs.current[provider] = el;
                  }}
                  onClick={() => handleProviderChange(provider)}
                  className={cn(
                    "relative flex h-full items-center px-2 text-[15px] font-medium transition-colors duration-200 cursor-pointer",
                    localActive === provider
                      ? "text-white"
                      : "text-neutral-500 hover:text-neutral-200",
                  )}
                >
                  <span
                    className={cn(
                      "rounded-md px-3 py-2 transition-colors flex items-center gap-1.5",
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
                </button>
              ))}
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}

export function Header(props: HeaderProps) {
  return (
    <Suspense fallback={<header className="sticky top-0 z-50 w-full h-16 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-xl" />}>
      <HeaderContent {...props} />
    </Suspense>
  );
}
