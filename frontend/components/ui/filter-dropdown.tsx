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
  const ref = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

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

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 text-sm text-white transition-colors hover:bg-neutral-800 cursor-pointer"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown
          className={`ml-2 h-4 w-4 text-neutral-500 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          className={`absolute left-0 top-full z-50 mt-1 ${dropdownWidth} overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 shadow-2xl`}
        >
          {searchable && (
            <div className="p-2 border-b border-neutral-800 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder || `Search ${label.toLowerCase()}...`}
                className="w-full h-8 rounded-md bg-neutral-800 px-3 pl-9 text-xs text-white placeholder:text-neutral-600 focus:outline-none"
              />
            </div>
          )}

          {/* Custom Header for Regions (Main Regions) */}
          {label === "Region" && searchable && !search && (
            <div className="px-4 py-2 border-b border-neutral-800 bg-neutral-900/50">
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                Main Regions
              </span>
            </div>
          )}

          <div className="max-h-[300px] overflow-y-auto custom-scrollbar translate-z-0">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-xs text-neutral-500 italic text-center">
                No results found
              </div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onSelect(opt.value);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm transition-colors cursor-pointer group ${
                    opt.value === value
                      ? "bg-neutral-800/50 text-white"
                      : "text-neutral-300 hover:bg-neutral-800"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {opt.value === value && (
                      <Check className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    )}
                    <span
                      className={`truncate ${
                        opt.value === value ? "font-medium text-white" : ""
                      }`}
                    >
                      {opt.label}
                    </span>
                  </div>
                  {searchable && (
                    <span className="text-[10px] text-neutral-500 font-mono group-hover:text-neutral-400 transition-colors">
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
