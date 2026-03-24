"use client";

import * as React from "react";
import { ChevronDown, Search, Check } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  label: string;
  value: string;
  options: FilterOption[];
  onSelect: (val: string) => void;
  searchable?: boolean;
  className?: string;
  placeholder?: string;
  dropdownWidth?: string;
}

export function FilterDropdown({
  label,
  value,
  options,
  onSelect,
  searchable = false,
  className = "",
  placeholder,
  dropdownWidth = "w-full min-w-[200px]",
}: FilterDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [dropdownStyle, setDropdownStyle] = React.useState<React.CSSProperties>({});
  const ref = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    setActiveIndex(-1);
  }, [search, open]);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  React.useEffect(() => {
    if (open && searchable) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open, searchable]);

  // Compute dropdown position to keep it within the viewport on mobile
  React.useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const SIDE_MARGIN = 16; // 1rem padding from screen edges

    // Default: align to left edge of the trigger button
    let left = 0;
    let right: number | undefined = undefined;

    // If the dropdown would overflow the right side, pin it to the right screen edge instead
    const estimatedWidth = Math.min(rect.width, viewportWidth - SIDE_MARGIN * 2);
    if (rect.left + estimatedWidth > viewportWidth - SIDE_MARGIN) {
      // Shift left so the dropdown stays within the screen
      const overflow = rect.left + estimatedWidth - (viewportWidth - SIDE_MARGIN);
      left = -overflow;
      // Don't go past the left screen margin either
      if (rect.left + left < SIDE_MARGIN) {
        left = -rect.left + SIDE_MARGIN;
      }
    }

    setDropdownStyle({ left, maxWidth: `${viewportWidth - SIDE_MARGIN * 2}px` });
  }, [open]);

  const filtered =
    searchable && search
      ? options.filter(
          (o) =>
            o.label.toLowerCase().includes(search.toLowerCase()) ||
            o.value.toLowerCase().includes(search.toLowerCase()),
        )
      : options;

  const selectedOption = options.find((o) => o.value === value);
  const selectedLabel = selectedOption?.label || value;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        onSelect(filtered[activeIndex].value);
        setOpen(false);
        setSearch("");
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className={`relative ${className}`} onKeyDown={handleKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-border bg-secondary px-4 text-sm text-foreground transition-colors hover:bg-accent cursor-pointer"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown
          className={`ml-2 h-4 w-4 text-muted-foreground transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          className={`absolute top-full z-50 mt-1 ${dropdownWidth} overflow-hidden rounded-lg border border-border bg-popover shadow-2xl`}
          style={dropdownStyle}
        >
          {searchable && (
            <div className="p-2 border-b border-border relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder || `Search ${label.toLowerCase()}...`}
                className="w-full h-8 rounded-md bg-secondary px-3 pl-9 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
          )}

          {/* Custom Header for Regions (Main Regions) */}
          {label === "Region" && searchable && !search && (
            <div className="px-4 py-2 border-b border-border bg-popover/50">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Main Regions
              </span>
            </div>
          )}

          <div className="max-h-[300px] overflow-y-auto custom-scrollbar translate-z-0">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-xs text-muted-foreground italic text-center">
                No results found
              </div>
            ) : (
              filtered.map((opt, i) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onSelect(opt.value);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm transition-colors cursor-pointer group ${
                    opt.value === value || i === activeIndex
                      ? "bg-accent/50 text-foreground"
                      : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {opt.value === value && (
                      <Check className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    )}
                    <span
                      className={`truncate ${
                        opt.value === value ? "font-medium text-foreground" : ""
                      }`}
                    >
                      {opt.label}
                    </span>
                  </div>
                  {searchable && (
                    <span className="text-[10px] text-muted-foreground font-mono group-hover:text-muted-foreground/80 transition-colors">
                      {opt.value}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
