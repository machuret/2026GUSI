"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Library, Search, X, BookOpen, ArrowUpDown, Globe } from "lucide-react";
import { LibraryCard } from "@/components/library/LibraryCard";
import { CATEGORIES, type ContentWithMeta } from "@/lib/content";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { DESTINATIONS } from "@/components/library/DestinationPicker";

const STATUS_FILTERS = [
  { value: "all",      label: "All" },
  { value: "APPROVED", label: "Approved" },
  { value: "PUBLISHED",label: "Published" },
] as const;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
] as const;

type LibraryItem = ContentWithMeta & { isEdited?: boolean; scheduledAt?: string | null };

export default function LibraryPage() {
  const [allItems, setAllItems]     = useState<LibraryItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter]   = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sort, setSort]             = useState<"newest" | "oldest">("newest");
  const [destinationFilter, setDestinationFilter] = useState<string>("all");

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Always fetch ALL approved+published — filtering/sorting done client-side
  // so counts are always accurate regardless of active filters
  const fetchLibrary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ companyId: DEMO_COMPANY_ID, limit: "200" });
      const res = await fetch(`/api/content/library?${params}`);
      if (!res.ok) throw new Error(`Failed to load library (${res.status})`);
      const data = await res.json();
      setAllItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load library");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLibrary(); }, [fetchLibrary]);

  // Client-side filter + sort
  const items = useMemo(() => {
    let filtered = allItems;
    if (statusFilter !== "all") filtered = filtered.filter((i) => i.status === statusFilter);
    if (categoryFilter !== "all") filtered = filtered.filter((i) => i.category === categoryFilter);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      filtered = filtered.filter((i) => i.output.toLowerCase().includes(q) || i.prompt.toLowerCase().includes(q));
    }
    if (destinationFilter !== "all") {
      filtered = filtered.filter((i) => {
        const d = i.destinations;
        return Array.isArray(d) && d.includes(destinationFilter);
      });
    }
    return sort === "oldest"
      ? [...filtered].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      : filtered;
  }, [allItems, statusFilter, categoryFilter, debouncedSearch, sort, destinationFilter]);

  const handlePublish = useCallback(async (id: string, category: string) => {
    setActionError(null);
    const res = await fetch("/api/content/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentId: id, category, action: "publish" }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setActionError(d.error || "Publish failed"); return; }
    // Optimistic update
    setAllItems((prev) => prev.map((i) => i.id === id ? { ...i, status: "PUBLISHED" } : i));
  }, []);

  const handleEdit = useCallback(async (id: string, category: string, output: string) => {
    setActionError(null);
    const res = await fetch("/api/content/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentId: id, category, action: "edit", output }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setActionError(d.error || "Edit failed"); return; }
    // Optimistic update — also sync output so editText re-initialises correctly
    setAllItems((prev) => prev.map((i) => i.id === id ? { ...i, output, isEdited: true } : i));
  }, []);

  const handleDelete = useCallback(async (id: string, category: string) => {
    setActionError(null);
    const res = await fetch("/api/content/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentId: id, category, action: "delete" }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setActionError(d.error || "Delete failed"); return; }
    // Optimistic remove
    setAllItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleDestinationsChanged = useCallback((id: string, destinations: string[]) => {
    setAllItems((prev) => prev.map((i) => i.id === id ? { ...i, destinations } : i));
  }, []);

  const handleChangeCategory = useCallback(async (id: string, category: string, newCategory: string) => {
    setActionError(null);
    const res = await fetch("/api/content/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentId: id, category, action: "change-category", newCategory }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setActionError(d.error || "Category change failed"); return; }
    // Refetch — new row was inserted in a different table
    fetchLibrary();
  }, [fetchLibrary]);

  // Counts always from full unfiltered set
  const counts = useMemo(() => ({
    all:       allItems.length,
    APPROVED:  allItems.filter((i) => i.status === "APPROVED").length,
    PUBLISHED: allItems.filter((i) => i.status === "PUBLISHED").length,
  }), [allItems]);

  const hasFilters = statusFilter !== "all" || categoryFilter !== "all" || search || destinationFilter !== "all";

  const clearFilters = () => {
    setStatusFilter("all");
    setCategoryFilter("all");
    setSearch("");
    setDestinationFilter("all");
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Library className="h-6 w-6 text-brand-600" />
            <h1 className="text-3xl font-bold text-gray-900">Content Library</h1>
          </div>
          <p className="text-gray-500">
            Your approved content — ready to publish, schedule, or reuse
          </p>
        </div>
        {!loading && (
          <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
            <span className="font-medium text-gray-700">{allItems.length}</span> pieces of approved content
          </div>
        )}
      </div>

      {/* AI learning notice */}
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
        <BookOpen className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
        <p className="text-sm text-green-800">
          <strong>AI is learning from this library.</strong> Every piece of approved content becomes a style reference — the AI uses it to match your voice when generating new content.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {actionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      {/* Filters */}
      <div className="mb-5 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search content…"
            className="w-full rounded-lg border border-gray-300 pl-9 pr-9 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-200"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label} ({counts[f.value as keyof typeof counts] ?? items.length})
            </button>
          ))}
        </div>

        {/* Category + sort + clear */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 focus:border-brand-500 focus:outline-none bg-white"
          >
            <option value="all">All Content Types</option>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>

          <div className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1.5 bg-white">
            <Globe className="h-3 w-3 text-gray-400" />
            <select
              value={destinationFilter}
              onChange={(e) => setDestinationFilter(e.target.value)}
              className="text-xs text-gray-600 focus:outline-none bg-transparent"
            >
              <option value="all">All Destinations</option>
              {DESTINATIONS.map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1.5 bg-white">
            <ArrowUpDown className="h-3 w-3 text-gray-400" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
              className="text-xs text-gray-600 focus:outline-none bg-transparent"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
              <X className="h-3 w-3" /> Clear filters
            </button>
          )}

          {!loading && (
            <span className="ml-auto text-xs text-gray-400">{items.length} item{items.length !== 1 ? "s" : ""}</span>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 animate-pulse">
              <div className="mb-3 flex gap-2">
                <div className="h-5 w-20 rounded-full bg-gray-200" />
                <div className="h-5 w-24 rounded-full bg-gray-200" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full rounded bg-gray-100" />
                <div className="h-4 w-5/6 rounded bg-gray-100" />
                <div className="h-4 w-4/6 rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-20 text-center">
          <Library className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-lg font-medium text-gray-500">
            {hasFilters ? "No content matches your filters" : "Your library is empty"}
          </p>
          <p className="mt-1 text-sm text-gray-400">
            {hasFilters
              ? "Try adjusting your search or filters"
              : "Approve content in the History page and it will appear here"}
          </p>
          {hasFilters && (
            <button onClick={clearFilters} className="mt-4 text-sm text-brand-600 hover:underline">
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <LibraryCard
              key={item.id}
              item={item}
              onPublish={handlePublish}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onChangeCategory={handleChangeCategory}
              onScheduled={(id, date) => {
                setAllItems((prev) =>
                  prev.map((i) => i.id === id ? { ...i, scheduledAt: date } : i)
                );
              }}
              onDestinationsChanged={handleDestinationsChanged}
            />
          ))}
        </div>
      )}
    </div>
  );
}
