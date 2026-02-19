"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Search, X } from "lucide-react";
import { HistoryItem, type GeneratedItem } from "@/components/history/HistoryItem";
import { DEMO_COMPANY_ID } from "@/lib/constants";

const STATUS_FILTERS = ["All", "PENDING", "APPROVED", "PUBLISHED", "REJECTED", "REVISED"] as const;
const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
] as const;

export default function HistoryPage() {
  const [items, setItems] = useState<GeneratedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [authorFilter, setAuthorFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/content/history?companyId=${DEMO_COMPANY_ID}&limit=100`);
      if (!res.ok) throw new Error(`Failed to load history (${res.status})`);
      const data = await res.json();
      setItems(data.history || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleApprove = useCallback(async (id: string, category: string) => {
    setActionError(null);
    const res = await fetch("/api/content/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentId: id, category, action: "approve" }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setActionError(d.error || "Approve failed"); return; }
    fetchHistory();
  }, [fetchHistory]);

  const handleReject = useCallback(async (id: string, category: string, feedback: string, tags: string[]) => {
    const lessonSaves = tags.length > 0
      ? tags.map((tag) =>
          fetch("/api/lessons", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ feedback, contentType: category, severity: "high", source: `reject:${tag}` }),
          })
        )
      : [fetch("/api/lessons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback, contentType: category, severity: "medium", source: "reject" }),
        })];
    await Promise.all([
      ...lessonSaves,
      fetch("/api/content/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId: id, category, action: "reject", feedback }),
      }),
    ]);
    fetchHistory();
  }, [fetchHistory]);

  const handleRevise = useCallback(async (id: string) => {
    setActionError(null);
    const res = await fetch("/api/content/revise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentId: id }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setActionError(d.error || "Revise failed"); return; }
    fetchHistory();
  }, [fetchHistory]);

  const handleEdit = useCallback(async (id: string, category: string, output: string) => {
    await fetch("/api/content/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentId: id, category, action: "edit", output }),
    });
    fetchHistory();
  }, [fetchHistory]);

  const handleMarkPublish = useCallback(async (id: string, category: string) => {
    await fetch("/api/content/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentId: id, category, action: "publish" }),
    });
    fetchHistory();
  }, [fetchHistory]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(items.map((i) => i.categoryLabel)))],
    [items]
  );
  const authors = useMemo(
    () => ["All", ...Array.from(new Set(items.filter((i) => i.user?.name).map((i) => i.user!.name)))],
    [items]
  );
  const pendingCount = useMemo(
    () => items.filter((i) => i.status === "PENDING").length,
    [items]
  );
  const hasActiveFilters = statusFilter !== "All" || categoryFilter !== "All" || authorFilter !== "All" || search || dateFrom || dateTo;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;

    let result = items.filter((item) => {
      if (statusFilter !== "All" && item.status !== statusFilter) return false;
      if (categoryFilter !== "All" && item.categoryLabel !== categoryFilter) return false;
      if (authorFilter !== "All" && item.user?.name !== authorFilter) return false;
      if (q && !item.prompt.toLowerCase().includes(q) && !item.output.toLowerCase().includes(q)) return false;
      const t = new Date(item.createdAt).getTime();
      if (from && t < from) return false;
      if (to && t > to) return false;
      return true;
    });

    if (sort === "oldest") result = [...result].reverse();
    return result;
  }, [items, statusFilter, categoryFilter, authorFilter, search, dateFrom, dateTo, sort]);

  const clearFilters = () => {
    setStatusFilter("All"); setCategoryFilter("All"); setAuthorFilter("All");
    setSearch(""); setDateFrom(""); setDateTo(""); setSort("newest");
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Content History</h1>
          <p className="mt-1 text-gray-500">
            Review, approve, or reject generated content — rejections become lessons
          </p>
        </div>
        {items.length > 0 && (
          <p className="text-sm text-gray-500 mt-2">
            {filtered.length} of {items.length} items
          </p>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {actionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      {/* Filters */}
      {items.length > 0 && (
        <div className="mb-6 space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search prompts and content…"
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
            {STATUS_FILTERS.map((s) => {
              const count = s === "All" ? items.length : items.filter((i) => i.status === s).length;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    statusFilter === s ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {s === "PENDING" && pendingCount > 0 ? `Pending (${pendingCount})` : s === "All" ? `All (${count})` : `${s.charAt(0) + s.slice(1).toLowerCase()} (${count})`}
                </button>
              );
            })}
          </div>

          {/* Dropdowns row */}
          <div className="flex flex-wrap items-center gap-2">
            {categories.length > 2 && (
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 focus:border-brand-500 focus:outline-none bg-white">
                <option value="All">All Categories</option>
                {categories.slice(1).map((c) => <option key={c}>{c}</option>)}
              </select>
            )}
            {authors.length > 2 && (
              <select value={authorFilter} onChange={(e) => setAuthorFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 focus:border-brand-500 focus:outline-none bg-white">
                <option value="All">All Authors</option>
                {authors.slice(1).map((a) => <option key={a}>{a}</option>)}
              </select>
            )}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-600 focus:border-brand-500 focus:outline-none" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-600 focus:border-brand-500 focus:outline-none" />
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 focus:border-brand-500 focus:outline-none bg-white">
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
                <X className="h-3 w-3" /> Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <Clock className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-gray-500">
            {items.length === 0 ? "No generated content yet." : "No items match the current filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => (
            <HistoryItem
              key={item.id}
              item={item}
              onApprove={handleApprove}
              onReject={handleReject}
              onRevise={handleRevise}
              onEdit={handleEdit}
              onMarkPublish={handleMarkPublish}
            />
          ))}
        </div>
      )}
    </div>
  );
}
