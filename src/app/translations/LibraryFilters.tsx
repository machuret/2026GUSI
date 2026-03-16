"use client";

import { Search, X } from "lucide-react";
import type { TranslationStatus } from "./types";

interface Props {
  search: string;
  filterStatus: "all" | TranslationStatus;
  filterLang: string;
  filterCat: string;
  dateFrom: string;
  dateTo: string;
  sort: "newest" | "oldest";
  usedLangs: string[];
  usedCats: string[];
  hasActiveFilters: boolean;
  resultCount: number;
  totalCount: number;
  hasOrder: boolean;
  allSelected: boolean;
  someSelected: boolean;
  onSearch: (v: string) => void;
  onFilterStatus: (v: "all" | TranslationStatus) => void;
  onFilterLang: (v: string) => void;
  onFilterCat: (v: string) => void;
  onDateFrom: (v: string) => void;
  onDateTo: (v: string) => void;
  onSort: (v: "newest" | "oldest") => void;
  onClearFilters: () => void;
  onResetOrder: () => void;
  onToggleSelectAll: () => void;
}

export function LibraryFilters({
  search, filterLang, filterCat, dateFrom, dateTo, sort,
  usedLangs, usedCats, hasActiveFilters,
  resultCount, totalCount, hasOrder, allSelected,
  onSearch, onFilterLang, onFilterCat, onDateFrom, onDateTo, onSort,
  onClearFilters, onResetOrder, onToggleSelectAll,
}: Props) {
  return (
    <div className="mb-4 space-y-2">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search by title or content…"
          className="w-full rounded-lg border border-gray-300 pl-9 pr-9 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-200"
        />
        {search && (
          <button onClick={() => onSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Dropdowns row */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={filterLang} onChange={(e) => onFilterLang(e.target.value)}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-700 focus:outline-none bg-white">
          <option value="all">All Languages</option>
          {usedLangs.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={filterCat} onChange={(e) => onFilterCat(e.target.value)}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-700 focus:outline-none bg-white">
          <option value="all">All Categories</option>
          {usedCats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500">From</label>
          <input type="date" value={dateFrom} onChange={(e) => onDateFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-600 focus:border-brand-500 focus:outline-none" />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500">To</label>
          <input type="date" value={dateTo} onChange={(e) => onDateTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-600 focus:border-brand-500 focus:outline-none" />
        </div>
        <select value={sort} onChange={(e) => onSort(e.target.value as "newest" | "oldest")}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-700 focus:outline-none bg-white">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        {hasActiveFilters && (
          <button onClick={onClearFilters} className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
            <X className="h-3 w-3" /> Clear all
          </button>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-gray-500">{resultCount} of {totalCount}</span>
          {hasOrder && (
            <button onClick={onResetOrder} className="text-xs text-gray-400 hover:text-gray-600 hover:underline">Reset order</button>
          )}
          {resultCount > 0 && (
            <button onClick={onToggleSelectAll}
              className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
