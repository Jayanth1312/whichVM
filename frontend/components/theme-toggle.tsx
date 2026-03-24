"use client";

import { motion } from "framer-motion";
import { useTheme } from "@/components/theme-provider";
import React, { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type AnimationVariant =
  | "circle"
  | "rectangle"
  | "gif"
  | "polygon"
  | "circle-blur";

export type AnimationStart =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center"
  | "top-center"
  | "bottom-center"
  | "bottom-up"
  | "top-down"
  | "left-right"
  | "right-left";

interface Animation {
  name: string;
  css: string;
}

const getPositionCoords = (position: AnimationStart) => {
  switch (position) {
    case "top-left":
      return { cx: "0", cy: "0" };
    case "top-right":
      return { cx: "40", cy: "0" };
    case "bottom-left":
      return { cx: "0", cy: "40" };
    case "bottom-right":
      return { cx: "40", cy: "40" };
    case "top-center":
      return { cx: "20", cy: "0" };
    case "bottom-center":
      return { cx: "20", cy: "40" };
    default:
      return { cx: "20", cy: "20" };
  }
};

const generateSVG = (variant: AnimationVariant, start: AnimationStart) => {
  if (variant === "circle-blur") {
    if (start === "center") {
      return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><filter id="blur"><feGaussianBlur stdDeviation="2"/></filter></defs><circle cx="20" cy="20" r="18" fill="white" filter="url(%23blur)"/></svg>`;
    }
    const positionCoords = getPositionCoords(start);
    if (!positionCoords) return "";
    const { cx, cy } = positionCoords;
    return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><filter id="blur"><feGaussianBlur stdDeviation="2"/></filter></defs><circle cx="${cx}" cy="${cy}" r="18" fill="white" filter="url(%23blur)"/></svg>`;
  }

  if (start === "center") return "";
  if (variant === "rectangle") return "";

  const positionCoords = getPositionCoords(start);
  if (!positionCoords) return "";
  const { cx, cy } = positionCoords;

  if (variant === "circle") {
    return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="${cx}" cy="${cy}" r="20" fill="white"/></svg>`;
  }

  return "";
};

const getTransformOrigin = (start: AnimationStart) => {
  switch (start) {
    case "top-left":
      return "top left";
    case "top-right":
      return "top right";
    case "bottom-left":
      return "bottom left";
    case "bottom-right":
      return "bottom right";
    case "top-center":
      return "top center";
    case "bottom-center":
      return "bottom center";
    default:
      return "center";
  }
};

export const createAnimation = (
  variant: AnimationVariant,
  start: AnimationStart = "center",
  blur = false,
  url?: string,
): Animation => {
  const svg = generateSVG(variant, start);
  const transformOrigin = getTransformOrigin(start);

  if (variant === "rectangle") {
    const getClipPath = (direction: AnimationStart) => {
      switch (direction) {
        case "bottom-up":
          return {
            from: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)",
            to: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
          };
        case "top-down":
          return {
            from: "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)",
            to: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
          };
        case "left-right":
          return {
            from: "polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)",
            to: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
          };
        case "right-left":
          return {
            from: "polygon(100% 0%, 100% 0%, 100% 100%, 100% 100%)",
            to: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
          };
        default:
          return {
            from: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)",
            to: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
          };
      }
    };

    const clipPath = getClipPath(start);

    return {
      name: `${variant}-${start}${blur ? "-blur" : ""}`,
      css: `
       ::view-transition-group(root) { animation-duration: 1.1s; animation-timing-function: var(--expo-out); }
       ::view-transition-new(root) { animation-name: reveal-light-${start}${blur ? "-blur" : ""}; ${blur ? "filter: blur(2px);" : ""} }
       ::view-transition-old(root), .dark::view-transition-old(root) { animation: none; z-index: -1; }
       .dark::view-transition-new(root) { animation-name: reveal-dark-${start}${blur ? "-blur" : ""}; ${blur ? "filter: blur(2px);" : ""} }
       @keyframes reveal-dark-${start}${blur ? "-blur" : ""} { from { clip-path: ${clipPath.from}; ${blur ? "filter: blur(8px);" : ""} } to { clip-path: ${clipPath.to}; ${blur ? "filter: blur(0px);" : ""} } }
       @keyframes reveal-light-${start}${blur ? "-blur" : ""} { from { clip-path: ${clipPath.from}; ${blur ? "filter: blur(8px);" : ""} } to { clip-path: ${clipPath.to}; ${blur ? "filter: blur(0px);" : ""} } }
      `,
    };
  }

  if (variant === "circle") {
    const origin = getTransformOrigin(start);
    return {
      name: `${variant}-${start}${blur ? "-blur" : ""}`,
      css: `
       ::view-transition-group(root) { animation-duration: 1.1s; animation-timing-function: var(--expo-out); }
       ::view-transition-new(root) { animation-name: reveal-light-${start}${blur ? "-blur" : ""}; ${blur ? "filter: blur(2px);" : ""} }
       ::view-transition-old(root), .dark::view-transition-old(root) { animation: none; z-index: -1; }
       .dark::view-transition-new(root) { animation-name: reveal-dark-${start}${blur ? "-blur" : ""}; ${blur ? "filter: blur(2px);" : ""} }
       @keyframes reveal-dark-${start}${blur ? "-blur" : ""} { from { clip-path: circle(0% at ${origin}); ${blur ? "filter: blur(8px);" : ""} } to { clip-path: circle(150% at ${origin}); ${blur ? "filter: blur(0px);" : ""} } }
       @keyframes reveal-light-${start}${blur ? "-blur" : ""} { from { clip-path: circle(0% at ${origin}); ${blur ? "filter: blur(8px);" : ""} } to { clip-path: circle(150% at ${origin}); ${blur ? "filter: blur(0px);" : ""} } }
      `,
    };
  }

  return { name: "", css: "" };
};

export const useThemeToggle = ({
  variant = "circle",
  start = "center",
  blur = false,
  gifUrl = "",
}: {
  variant?: AnimationVariant;
  start?: AnimationStart;
  blur?: boolean;
  gifUrl?: string;
} = {}) => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(resolvedTheme === "dark");
  }, [resolvedTheme]);

  const styleId = "theme-transition-styles";

  const updateStyles = useCallback((css: string) => {
    if (typeof window === "undefined") return;
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;
    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }
    styleElement.textContent = css;
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark(!isDark);
    const animation = createAnimation(variant, start, blur, gifUrl);
    updateStyles(animation.css);

    if (typeof window === "undefined") return;

    // Use current frame's resolvedTheme explicitly to prevent closure race bounds
    const currentTheme = resolvedTheme;
    const switchTheme = () => {
      setTheme(currentTheme === "light" ? "dark" : "light");
    };

    if (!document.startViewTransition) {
      switchTheme();
      return;
    }

    document.startViewTransition(switchTheme);
  }, [resolvedTheme, setTheme, variant, start, blur, gifUrl, updateStyles, isDark]);

  return { isDark, toggleTheme };
};

interface ThemeToggleProps {
  className?: string;
  variant?: AnimationVariant;
  start?: AnimationStart;
  blur?: boolean;
}

export function ThemeToggle({
  className,
  variant: forcedVariant,
  start: forcedStart,
  blur = false,
}: ThemeToggleProps) {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const variant = forcedVariant || (isMobile ? "rectangle" : "circle");
  const start = forcedStart || (isMobile ? "top-down" : "top-right");

  const { isDark, toggleTheme } = useThemeToggle({ variant, start, blur });
  const uniqueId = React.useId().replace(/:/g, "");

  return (
    <button
      type="button"
      className={cn(
        "h-9 w-9 md:h-10 md:w-10 cursor-pointer rounded-full transition-all duration-300 active:scale-95 flex items-center justify-center p-1 bg-background text-foreground border border-border hover:bg-accent/50 hover:text-accent-foreground",
        className,
      )}
      onClick={toggleTheme}
      aria-label="Toggle theme"
    >
      <span className="sr-only">Toggle theme</span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        fill="currentColor"
        strokeLinecap="round"
        viewBox="0 0 32 32"
        className="w-[20px] h-[20px] md:w-[24px] md:h-[24px] stroke-foreground fill-foreground"
      >
        <clipPath id={`skiper-btn-${uniqueId}`}>
          <motion.path
            animate={{ y: isDark ? 10 : 0, x: isDark ? -12 : 0 }}
            transition={{ ease: "easeInOut", duration: 0.35 }}
            d="M0-5h30a1 1 0 0 0 9 13v24H0Z"
          />
        </clipPath>
        <g clipPath={`url(#skiper-btn-${uniqueId})`}>
          <motion.circle
            animate={{ r: isDark ? 10 : 8 }}
            transition={{ ease: "easeInOut", duration: 0.35 }}
            cx="16"
            cy="16"
          />
          <motion.g
            animate={{
              rotate: isDark ? -100 : 0,
              scale: isDark ? 0.5 : 1,
              opacity: isDark ? 0 : 1,
            }}
            transition={{ ease: "easeInOut", duration: 0.35 }}
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M16 5.5v-4" />
            <path d="M16 30.5v-4" />
            <path d="M1.5 16h4" />
            <path d="M26.5 16h4" />
            <path d="m23.4 8.6 2.8-2.8" />
            <path d="m5.7 26.3 2.9-2.9" />
            <path d="m5.8 5.8 2.8 2.8" />
            <path d="m23.4 23.4 2.9 2.9" />
          </motion.g>
        </g>
      </svg>
    </button>
  );
}
