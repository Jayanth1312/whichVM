"use client";

import { motion } from "framer-motion";
import { useTheme } from "@/components/theme-provider";
import React, { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const useThemeToggle = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(resolvedTheme === "dark");
  }, [resolvedTheme]);

  const toggleTheme = useCallback(() => {
    setIsDark(!isDark);
    const currentTheme = resolvedTheme;
    setTheme(currentTheme === "light" ? "dark" : "light");
  }, [resolvedTheme, setTheme, isDark]);

  return { isDark, toggleTheme };
};

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useThemeToggle();
  const uniqueId = React.useId().replace(/:/g, "");

  return (
    <button
      type="button"
      className={cn(
        "h-9 w-9 md:h-10 md:w-10 cursor-pointer rounded-full flex items-center justify-center p-1 bg-background text-foreground border border-border hover:bg-accent/50 hover:text-accent-foreground",
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
