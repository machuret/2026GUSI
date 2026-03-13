"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Play, RefreshCw, Loader2, X, Save, Trash2,
  FolderOpen, Tag, Clock, Search,
  ExternalLink, Grid3X3, List, Palette,
  FileText, MessageSquareText, ChevronDown,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";

/* ── Types ── */
interface VideoCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface Video {
  id: string;
  categoryId: string | null;
  vimeoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  duration: number;
  vimeoUrl: string;
  embedHtml: string;
  width: number;
  height: number;
  status: string;
  tags: string[];
  transcript?: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

interface SyncLogEntry {
  id: string;
  type: string;
  status: string;
  synced: number;
  updated: number;
  errors: number;
  totalProcessed: number;
  durationMs: number;
  createdAt: string;
}

/* ── Helpers ── */
function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const VIDEOS_PER_PAGE = 40;

const CATEGORY_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelCls = "mb-1 block text-xs font-medium text-gray-600";

export default function VideosPage() {
  /* ── State ── */
  const [videos, setVideos] = useState<Video[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [categories, setCategories] = useState<VideoCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ page: number; totalPages: number; synced: number; updated: number; total: number } | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Transcript sync
  const [syncingTranscripts, setSyncingTranscripts] = useState(false);
  const [transcriptMsg, setTranscriptMsg] = useState<string | null>(null);

  // Sync log
  const [lastVideoSync, setLastVideoSync] = useState<SyncLogEntry | null>(null);
  const [lastTranscriptSync, setLastTranscriptSync] = useState<SyncLogEntry | null>(null);

  // Filters — server-side
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Category management
  const [showAddCat, setShowAddCat] = useState(false);
  const [catForm, setCatForm] = useState({ name: "", description: "", color: "#6366f1" });
  const [catSaving, setCatSaving] = useState(false);
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editCatForm, setEditCatForm] = useState({ name: "", description: "", color: "" });

  // Video detail / assign
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  /* ── Debounced search ── */
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  /* ── Build API URL ── */
  const buildUrl = useCallback((page: number) => {
    const params = new URLSearchParams({ page: String(page), limit: String(VIDEOS_PER_PAGE) });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filterCat && filterCat !== "all") params.set("categoryId", filterCat);
    return `/api/videos?${params}`;
  }, [debouncedSearch, filterCat]);

  /* ── Fetch videos (page 1) + categories ── */
  const fetchData = useCallback(async (resetVideos = true) => {
    if (resetVideos) setLoading(true);
    try {
      const [vRes, cRes] = await Promise.all([
        authFetch(buildUrl(1)),
        authFetch("/api/videos/categories"),
      ]);
      const vData = await vRes.json();
      const cData = await cRes.json();
      setVideos(vData.videos ?? []);
      setPagination(vData.pagination ?? null);
      setCategories(cData.categories ?? []);
    } catch { setError("Failed to load data"); }
    finally { setLoading(false); }
  }, [buildUrl]);

  /* ── Load more (append next page) ── */
  const loadMore = async () => {
    if (!pagination?.hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await authFetch(buildUrl(pagination.page + 1));
      const data = await res.json();
      setVideos((prev) => [...prev, ...(data.videos ?? [])]);
      setPagination(data.pagination ?? null);
    } catch { setError("Failed to load more"); }
    finally { setLoadingMore(false); }
  };

  /* ── Fetch sync log ── */
  const fetchSyncLog = useCallback(async () => {
    try {
      const res = await authFetch("/api/videos/sync-log");
      const data = await res.json();
      setLastVideoSync(data.lastVideoSync ?? null);
      setLastTranscriptSync(data.lastTranscriptSync ?? null);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchData(); fetchSyncLog(); }, [fetchData, fetchSyncLog]);

  // Re-fetch when search or category filter changes
  useEffect(() => { fetchData(); }, [debouncedSearch, filterCat, fetchData]);

  /* ── Open video detail (loads transcript on demand) ── */
  const openVideoDetail = async (video: Video) => {
    setSelectedVideo(video);
    setLoadingDetail(true);
    try {
      const res = await authFetch(`/api/videos/${video.id}`);
      const data = await res.json();
      if (data.video) setSelectedVideo(data.video);
    } catch { /* use existing data */ }
    finally { setLoadingDetail(false); }
  };

  /* ── Paginated Sync from Vimeo ── */
  const handleSync = async () => {
    setSyncing(true); setSyncMsg(null); setError(null);
    let page = 1;
    let totalSynced = 0;
    let totalUpdated = 0;
    let totalVimeo = 0;
    const startTime = Date.now();

    try {
      while (true) {
        const res = await authFetch(`/api/videos/sync?page=${page}`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Sync failed");

        totalSynced += data.synced;
        totalUpdated += data.updated;
        totalVimeo = data.total;
        setSyncProgress({ page: data.page, totalPages: data.totalPages, synced: totalSynced, updated: totalUpdated, total: data.total });

        if (!data.hasMore) break;
        page++;
      }

      // Log the sync
      const durationMs = Date.now() - startTime;
      await authFetch("/api/videos/sync-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "videos", status: "completed", synced: totalSynced, updated: totalUpdated, errors: 0, totalProcessed: totalVimeo, durationMs }),
      }).catch(() => {});

      setSyncMsg(`Done! ${totalSynced} new, ${totalUpdated} updated (${totalVimeo} total) in ${(durationMs / 1000).toFixed(1)}s`);
      setSyncProgress(null);
      setTimeout(() => setSyncMsg(null), 10000);
      await fetchData();
      await fetchSyncLog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
      setSyncProgress(null);
    } finally { setSyncing(false); }
  };

  /* ── Transcript Sync ── */
  const handleTranscriptSync = async () => {
    setSyncingTranscripts(true); setTranscriptMsg(null); setError(null);
    let totalFetched = 0;
    let totalNoTrack = 0;
    let totalErrors = 0;
    const startTime = Date.now();

    try {
      while (true) {
        const res = await authFetch("/api/videos/transcripts?batch=10", { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Transcript sync failed");

        totalFetched += data.fetched;
        totalNoTrack += data.noTrack;
        totalErrors += data.errors;
        setTranscriptMsg(`Fetching transcripts… ${totalFetched} found, ${totalNoTrack} no track, ${data.remaining} remaining`);

        if (!data.hasMore) break;
      }

      const durationMs = Date.now() - startTime;
      await authFetch("/api/videos/sync-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "transcripts", status: "completed", synced: totalFetched, updated: 0, errors: totalErrors, totalProcessed: totalFetched + totalNoTrack + totalErrors, durationMs }),
      }).catch(() => {});

      setTranscriptMsg(`Done! ${totalFetched} transcripts fetched, ${totalNoTrack} had no captions (${(durationMs / 1000).toFixed(1)}s)`);
      setTimeout(() => setTranscriptMsg(null), 10000);
      await fetchSyncLog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcript sync failed");
    } finally { setSyncingTranscripts(false); }
  };

  /* ── Category CRUD ── */
  const handleAddCategory = async () => {
    if (!catForm.name.trim()) return;
    setCatSaving(true);
    try {
      const res = await authFetch("/api/videos/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(catForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setCategories((prev) => [...prev, data.category]);
      setCatForm({ name: "", description: "", color: "#6366f1" });
      setShowAddCat(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setCatSaving(false); }
  };

  const handleUpdateCategory = async (id: string) => {
    setCatSaving(true);
    try {
      const res = await authFetch(`/api/videos/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editCatForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setCategories((prev) => prev.map((c) => (c.id === id ? data.category : c)));
      setEditCatId(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setCatSaving(false); }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Delete this category? Videos will become uncategorized.")) return;
    try {
      await authFetch(`/api/videos/categories/${id}`, { method: "DELETE" });
      setCategories((prev) => prev.filter((c) => c.id !== id));
      if (filterCat === id) setFilterCat("all");
      else await fetchData();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  };

  /* ── Assign video to category ── */
  const handleAssign = async (videoId: string, categoryId: string | null) => {
    setAssigningId(videoId);
    try {
      const res = await authFetch(`/api/videos/${videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setVideos((prev) => prev.map((v) => (v.id === videoId ? { ...data.video, transcript: v.transcript } : v)));
      if (selectedVideo?.id === videoId) setSelectedVideo((prev) => prev ? { ...prev, categoryId: data.video.categoryId } : prev);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setAssigningId(null); }
  };

  const getCat = (id: string | null) => categories.find((c) => c.id === id);

  /* ── Render ── */
  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Play className="h-7 w-7 text-indigo-600" /> Videos
          </h1>
          <p className="mt-1 text-gray-500">
            Sync and organize your Vimeo video library by category
          </p>
          {/* Last sync info */}
          <div className="mt-1.5 flex gap-4 text-[10px] text-gray-400">
            {lastVideoSync && <span>Last sync: {timeAgo(lastVideoSync.createdAt)} ({lastVideoSync.totalProcessed} videos, {(lastVideoSync.durationMs / 1000).toFixed(1)}s)</span>}
            {lastTranscriptSync && <span>Transcripts: {timeAgo(lastTranscriptSync.createdAt)} ({lastTranscriptSync.synced} fetched)</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowAddCat(true)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <FolderOpen className="h-4 w-4" /> Add Category
          </button>
          <button
            onClick={handleTranscriptSync}
            disabled={syncingTranscripts || syncing}
            className="flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
          >
            {syncingTranscripts ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
            {syncingTranscripts ? "Fetching…" : "Fetch Transcripts"}
          </button>
          <button
            onClick={handleSync}
            disabled={syncing || syncingTranscripts}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? "Syncing…" : "Sync from Vimeo"}
          </button>
        </div>
      </div>

      {/* Sync progress bar */}
      {syncProgress && (
        <div className="mb-4 rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-indigo-700">
              Syncing page {syncProgress.page} of {syncProgress.totalPages} ({syncProgress.total} videos)
            </span>
            <span className="text-xs text-indigo-500">
              {syncProgress.synced} new, {syncProgress.updated} updated
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-indigo-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${Math.round((syncProgress.page / syncProgress.totalPages) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Messages */}
      {syncMsg && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700 font-medium flex items-center justify-between">
          {syncMsg}
          <button onClick={() => setSyncMsg(null)} className="text-green-400 hover:text-green-600"><X className="h-4 w-4" /></button>
        </div>
      )}
      {transcriptMsg && (
        <div className="mb-4 rounded-lg bg-purple-50 border border-purple-200 px-4 py-2 text-sm text-purple-700 font-medium flex items-center justify-between">
          {transcriptMsg}
          <button onClick={() => setTranscriptMsg(null)} className="text-purple-400 hover:text-purple-600"><X className="h-4 w-4" /></button>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700 font-medium flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Add Category Form */}
      {showAddCat && (
        <div className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">New Category</h2>
            <button onClick={() => setShowAddCat(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Name *</label>
              <input value={catForm.name} onChange={(e) => setCatForm((p) => ({ ...p, name: e.target.value }))} className={inputCls} placeholder="e.g. Training Videos" />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <input value={catForm.description} onChange={(e) => setCatForm((p) => ({ ...p, description: e.target.value }))} className={inputCls} placeholder="Optional description" />
            </div>
            <div>
              <label className={labelCls}>Color</label>
              <div className="flex gap-1.5 flex-wrap">
                {CATEGORY_COLORS.map((c) => (
                  <button key={c} onClick={() => setCatForm((p) => ({ ...p, color: c }))}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${catForm.color === c ? "border-gray-900 scale-110" : "border-transparent hover:border-gray-300"}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleAddCategory} disabled={catSaving || !catForm.name.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {catSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
            </button>
            <button onClick={() => setShowAddCat(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-white">Cancel</button>
          </div>
        </div>
      )}

      {/* Categories bar */}
      {categories.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <button onClick={() => setFilterCat("all")}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${filterCat === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              All {pagination ? `(${pagination.totalCount})` : ""}
            </button>
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-0 shrink-0">
                <button onClick={() => setFilterCat(cat.id)}
                  className={`rounded-l-full px-3.5 py-1.5 text-xs font-semibold transition-all ${filterCat === cat.id ? "text-white" : "text-gray-600 hover:opacity-80"}`}
                  style={{ backgroundColor: filterCat === cat.id ? cat.color : `${cat.color}20`, color: filterCat === cat.id ? "white" : cat.color }}>
                  {cat.name}
                </button>
                {editCatId !== cat.id && (
                  <button onClick={() => { setEditCatId(cat.id); setEditCatForm({ name: cat.name, description: cat.description, color: cat.color }); }}
                    className="rounded-r-full px-2 py-1.5 text-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-100" title="Edit category">
                    <Palette className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
            <button onClick={() => setFilterCat("uncategorized")}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${filterCat === "uncategorized" ? "bg-gray-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
              Uncategorized
            </button>
          </div>

          {/* Edit category inline */}
          {editCatId && (() => {
            const cat = categories.find((c) => c.id === editCatId);
            if (!cat) return null;
            return (
              <div className="mt-3 rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Edit: {cat.name}</h3>
                  <div className="flex gap-2">
                    <button onClick={() => handleDeleteCategory(cat.id)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                    <button onClick={() => setEditCatId(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Name</label>
                    <input value={editCatForm.name} onChange={(e) => setEditCatForm((p) => ({ ...p, name: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Description</label>
                    <input value={editCatForm.description} onChange={(e) => setEditCatForm((p) => ({ ...p, description: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Color</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {CATEGORY_COLORS.map((c) => (
                        <button key={c} onClick={() => setEditCatForm((p) => ({ ...p, color: c }))}
                          className={`h-6 w-6 rounded-full border-2 transition-all ${editCatForm.color === c ? "border-gray-900 scale-110" : "border-transparent hover:border-gray-300"}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => handleUpdateCategory(cat.id)} disabled={catSaving}
                    className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                    {catSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
                  </button>
                  <button onClick={() => setEditCatId(null)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Search + View toggle */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search videos…"
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-0.5">
          <button onClick={() => setView("grid")} className={`rounded-md p-1.5 transition-colors ${view === "grid" ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-600"}`}>
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button onClick={() => setView("list")} className={`rounded-md p-1.5 transition-colors ${view === "list" ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-600"}`}>
            <List className="h-4 w-4" />
          </button>
        </div>
        {pagination && (
          <p className="text-xs text-gray-400 ml-auto">
            Showing {videos.length} of {pagination.totalCount} video{pagination.totalCount !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="py-20 text-center text-gray-400">
          <Loader2 className="mx-auto h-8 w-8 animate-spin mb-3" />Loading videos…
        </div>
      )}

      {/* Empty states */}
      {!loading && videos.length === 0 && !debouncedSearch && filterCat === "all" && (
        <div className="rounded-xl border border-dashed border-gray-300 py-20 text-center">
          <Play className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No videos yet</p>
          <p className="text-sm text-gray-400 mt-1">Click &quot;Sync from Vimeo&quot; to import your video library</p>
          <button onClick={handleSync} disabled={syncing}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sync from Vimeo
          </button>
        </div>
      )}

      {!loading && videos.length === 0 && (debouncedSearch || filterCat !== "all") && (
        <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center">
          <p className="text-gray-400">No videos match your filter.</p>
        </div>
      )}

      {/* Video grid */}
      {!loading && videos.length > 0 && view === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((v) => {
            const cat = getCat(v.categoryId);
            return (
              <div key={v.id} className="group rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative aspect-video bg-gray-100 cursor-pointer" onClick={() => openVideoDetail(v)}>
                  {v.thumbnailUrl ? (
                    <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Play className="h-8 w-8 text-gray-300" /></div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <Play className="h-10 w-10 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                  </div>
                  <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-mono text-white">
                    {formatDuration(v.duration)}
                  </span>
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1 cursor-pointer hover:text-indigo-600" onClick={() => openVideoDetail(v)}>
                    {v.title}
                  </h3>
                  {v.publishedAt && (
                    <p className="text-[10px] text-gray-400 flex items-center gap-1 mb-2">
                      <Clock className="h-3 w-3" /> {new Date(v.publishedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5">
                    <select value={v.categoryId || ""} onChange={(e) => handleAssign(v.id, e.target.value || null)} disabled={assigningId === v.id}
                      className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600 focus:border-indigo-400 focus:outline-none bg-white truncate"
                      style={cat ? { borderColor: cat.color, color: cat.color } : {}}>
                      <option value="">Uncategorized</option>
                      {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                    </select>
                    {assigningId === v.id && <Loader2 className="h-3 w-3 animate-spin text-gray-400 shrink-0" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Video list view */}
      {!loading && videos.length > 0 && view === "list" && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">
          {videos.map((v) => {
            const cat = getCat(v.categoryId);
            return (
              <div key={v.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="relative w-28 aspect-video rounded-lg overflow-hidden bg-gray-100 shrink-0 cursor-pointer" onClick={() => openVideoDetail(v)}>
                  {v.thumbnailUrl ? (
                    <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Play className="h-5 w-5 text-gray-300" /></div>
                  )}
                  <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-mono text-white">
                    {formatDuration(v.duration)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 truncate cursor-pointer hover:text-indigo-600" onClick={() => openVideoDetail(v)}>
                    {v.title}
                  </h3>
                  {v.description && <p className="text-xs text-gray-400 truncate mt-0.5">{v.description}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    {v.publishedAt && (
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {new Date(v.publishedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                    {v.tags.length > 0 && (
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Tag className="h-3 w-3" /> {v.tags.slice(0, 3).join(", ")}
                      </span>
                    )}
                  </div>
                </div>
                <select value={v.categoryId || ""} onChange={(e) => handleAssign(v.id, e.target.value || null)} disabled={assigningId === v.id}
                  className="w-36 shrink-0 rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-600 focus:border-indigo-400 focus:outline-none bg-white"
                  style={cat ? { borderColor: cat.color, color: cat.color } : {}}>
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
                <a href={v.vimeoUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-gray-400 hover:text-indigo-600">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            );
          })}
        </div>
      )}

      {/* Load More button */}
      {!loading && pagination?.hasMore && (
        <div className="mt-6 text-center">
          <button onClick={loadMore} disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
            {loadingMore ? "Loading…" : `Load More (${pagination.totalCount - videos.length} remaining)`}
          </button>
        </div>
      )}

      {/* Video detail modal */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelectedVideo(null)}>
          <div className="relative w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedVideo(null)} className="absolute top-3 right-3 z-10 rounded-full bg-white/90 p-1.5 text-gray-500 hover:text-gray-800 shadow">
              <X className="h-5 w-5" />
            </button>
            <div className="aspect-video bg-black shrink-0" dangerouslySetInnerHTML={{ __html: selectedVideo.embedHtml.replace(/width="\d+"/, 'width="100%"').replace(/height="\d+"/, 'height="100%"') }} />
            <div className="p-5 overflow-y-auto">
              <h2 className="text-lg font-bold text-gray-900 mb-1">{selectedVideo.title}</h2>
              {selectedVideo.description && <p className="text-sm text-gray-500 whitespace-pre-wrap mb-3 max-h-32 overflow-y-auto">{selectedVideo.description}</p>}
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatDuration(selectedVideo.duration)}</span>
                <span>{selectedVideo.width}×{selectedVideo.height}</span>
                {selectedVideo.publishedAt && <span>{new Date(selectedVideo.publishedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</span>}
                <a href={selectedVideo.vimeoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-indigo-500 hover:text-indigo-700">
                  <ExternalLink className="h-3.5 w-3.5" /> View on Vimeo
                </a>
              </div>
              {selectedVideo.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedVideo.tags.map((t) => (
                    <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">{t}</span>
                  ))}
                </div>
              )}
              <div className="mt-4 flex items-center gap-3">
                <label className="text-xs font-medium text-gray-600">Category:</label>
                <select value={selectedVideo.categoryId || ""} onChange={(e) => handleAssign(selectedVideo.id, e.target.value || null)} disabled={assigningId === selectedVideo.id}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none bg-white">
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
                {assigningId === selectedVideo.id && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
              </div>
              {/* Transcript — loaded on demand */}
              {loadingDetail ? (
                <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading transcript…
                </div>
              ) : selectedVideo.transcript ? (
                <div className="mt-4">
                  <h3 className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" /> Transcript
                  </h3>
                  <div className="max-h-48 overflow-y-auto rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {selectedVideo.transcript}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-xs text-gray-400 flex items-center gap-1">
                  <FileText className="h-3 w-3" /> No transcript available
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer stats */}
      {!loading && pagination && pagination.totalCount > 0 && (
        <div className="mt-6 flex gap-4 text-xs text-gray-400">
          <span>{pagination.totalCount} total videos</span>
          <span>{categories.length} categories</span>
          <span>Showing {videos.length}</span>
        </div>
      )}
    </div>
  );
}
