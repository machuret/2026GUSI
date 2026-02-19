"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { HistoryItem, type GeneratedItem } from "@/components/history/HistoryItem";

import { DEMO_COMPANY_ID } from "@/lib/constants";

const STATUS_FILTERS = ["All", "PENDING", "APPROVED", "PUBLISHED", "REJECTED", "REVISED"] as const;

export default function HistoryPage() {
  const [items, setItems] = useState<GeneratedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/content/history?companyId=${DEMO_COMPANY_ID}&limit=100`);
      const data = await res.json();
      setItems(data.history || []);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleApprove = useCallback(async (id: string, category: string) => {
    await fetch("/api/content/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentId: id, category, action: "approve" }),
    });
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
    await fetch("/api/content/revise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentId: id }),
    });
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
  const pendingCount = useMemo(
    () => items.filter((i) => i.status === "PENDING").length,
    [items]
  );
  const filtered = useMemo(
    () => items.filter((item) => {
      const statusMatch = statusFilter === "All" || item.status === statusFilter;
      const categoryMatch = categoryFilter === "All" || item.categoryLabel === categoryFilter;
      return statusMatch && categoryMatch;
    }),
    [items, statusFilter, categoryFilter]
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Content History</h1>
        <p className="mt-1 text-gray-500">
          Review, approve, or reject generated content — rejections become lessons
        </p>
      </div>

      {/* Filters */}
      {items.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUS_FILTERS.map((s) => {
              const count = s === "All" ? items.length : items.filter((i) => i.status === s).length;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? "bg-brand-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {s === "PENDING" && pendingCount > 0 ? `Pending (${pendingCount})` : s === "All" ? `All (${count})` : `${s.charAt(0) + s.slice(1).toLowerCase()} (${count})`}
                </button>
              );
            })}
          </div>
          {categories.length > 2 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1 text-xs text-gray-600 focus:border-brand-500 focus:outline-none"
            >
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          )}
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
