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
  variant = "circle",
  start = "top-right",
  blur = false,
}: ThemeToggleProps) {
  const { isDark, toggleTheme } = useThemeToggle({ variant, start, blur });

  return (
    <button
      type="button"
      className={cn(
        "h-9 w-9 md:h-9 md:w-9 rounded-full bg-transparent border-none shadow-none cursor-pointer flex items-center justify-center active:scale-95",
        className,
      )}
      onClick={toggleTheme}
      aria-label="Toggle theme"
    >
      <span className="sr-only">Toggle theme</span>
      <svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <motion.g
          animate={{ rotate: isDark ? -180 : 0 }}
          transition={{ ease: "easeInOut", duration: 0.5 }}
        >
          {/* Outer Ring Circle Outline filled with White */}
          <circle
            cx="120"
            cy="120"
            r="117"
            stroke={isDark ? "white" : "black"}
            strokeWidth="3.5"
            fill="white"
          />

          {/* Inner Center-Left Half Circle - Black */}
          <path
            d="M120 67.5 A 52.5 52.5 0 0 0 67.5 120 A 52.5 52.5 0 0 0 120 172.5 Z"
            fill="black"
          />

          {/* Outer Concentric Crescent - Black - Meets center at 52.5 radius */}
          <path
            d="M120 18 A 102 102 0 0 1 222 120 A 102 102 0 0 1 120 222 L 120 172.5 A 52.5 52.5 0 0 0 172.5 120 A 52.5 52.5 0 0 0 120 67.5 Z"
            fill="black"
          />
        </motion.g>
      </svg>
    </button>
  );
}
