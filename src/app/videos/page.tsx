"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Play, RefreshCw, Loader2, Plus, X, Save, Trash2,
  FolderOpen, Tag, Clock, Search, ChevronDown, ChevronUp,
  ExternalLink, Grid3X3, List, Palette, GripVertical,
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
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ── Helpers ── */
function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const CATEGORY_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelCls = "mb-1 block text-xs font-medium text-gray-600";

export default function VideosPage() {
  /* ── State ── */
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<VideoCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [view, setView] = useState<"grid" | "list">("grid");

  // Category management
  const [showAddCat, setShowAddCat] = useState(false);
  const [catForm, setCatForm] = useState({ name: "", description: "", color: "#6366f1" });
  const [catSaving, setCatSaving] = useState(false);
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editCatForm, setEditCatForm] = useState({ name: "", description: "", color: "" });

  // Video detail / assign
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  /* ── Data fetching ── */
  const fetchData = useCallback(async () => {
    try {
      const [vRes, cRes] = await Promise.all([
        authFetch("/api/videos"),
        authFetch("/api/videos/categories"),
      ]);
      const vData = await vRes.json();
      const cData = await cRes.json();
      setVideos(vData.videos ?? []);
      setCategories(cData.categories ?? []);
    } catch { setError("Failed to load data"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Sync from Vimeo ── */
  const handleSync = async () => {
    setSyncing(true); setSyncMsg(null); setError(null);
    try {
      const res = await authFetch("/api/videos/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setSyncMsg(`Synced ${data.synced} new, updated ${data.updated} existing (${data.total} total from Vimeo)`);
      setTimeout(() => setSyncMsg(null), 6000);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally { setSyncing(false); }
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
      setVideos((prev) => prev.map((v) => (v.categoryId === id ? { ...v, categoryId: null } : v)));
      if (filterCat === id) setFilterCat("all");
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
      setVideos((prev) => prev.map((v) => (v.id === videoId ? data.video : v)));
      if (selectedVideo?.id === videoId) setSelectedVideo(data.video);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setAssigningId(null); }
  };

  /* ── Filtering ── */
  const filtered = videos.filter((v) => {
    const q = search.toLowerCase();
    const matchSearch = !search || v.title.toLowerCase().includes(q) || v.description.toLowerCase().includes(q) || v.tags.some((t) => t.toLowerCase().includes(q));
    const matchCat = filterCat === "all" || (filterCat === "uncategorized" ? !v.categoryId : v.categoryId === filterCat);
    return matchSearch && matchCat;
  });

  const getCat = (id: string | null) => categories.find((c) => c.id === id);
  const uncategorizedCount = videos.filter((v) => !v.categoryId).length;

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
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowAddCat(true)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <FolderOpen className="h-4 w-4" /> Add Category
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? "Syncing…" : "Sync from Vimeo"}
          </button>
        </div>
      </div>

      {/* Messages */}
      {syncMsg && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700 font-medium flex items-center justify-between">
          {syncMsg}
          <button onClick={() => setSyncMsg(null)} className="text-green-400 hover:text-green-600"><X className="h-4 w-4" /></button>
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
              All ({videos.length})
            </button>
            {categories.map((cat) => {
              const count = videos.filter((v) => v.categoryId === cat.id).length;
              return (
                <div key={cat.id} className="flex items-center gap-0 shrink-0">
                  <button onClick={() => setFilterCat(cat.id)}
                    className={`rounded-l-full px-3.5 py-1.5 text-xs font-semibold transition-all ${filterCat === cat.id ? "text-white" : "text-gray-600 hover:opacity-80"}`}
                    style={{ backgroundColor: filterCat === cat.id ? cat.color : `${cat.color}20`, color: filterCat === cat.id ? "white" : cat.color }}>
                    {cat.name} ({count})
                  </button>
                  {editCatId !== cat.id && (
                    <button onClick={() => { setEditCatId(cat.id); setEditCatForm({ name: cat.name, description: cat.description, color: cat.color }); }}
                      className="rounded-r-full px-2 py-1.5 text-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-100" title="Edit category">
                      <Palette className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
            <button onClick={() => setFilterCat("uncategorized")}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${filterCat === "uncategorized" ? "bg-gray-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
              Uncategorized ({uncategorizedCount})
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
        <p className="text-xs text-gray-400 ml-auto">{filtered.length} video{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="py-20 text-center text-gray-400">
          <Loader2 className="mx-auto h-8 w-8 animate-spin mb-3" />Loading videos…
        </div>
      )}

      {/* Empty states */}
      {!loading && videos.length === 0 && (
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

      {/* Video grid */}
      {!loading && filtered.length > 0 && view === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((v) => {
            const cat = getCat(v.categoryId);
            return (
              <div key={v.id} className="group rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-lg transition-shadow">
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gray-100 cursor-pointer" onClick={() => setSelectedVideo(v)}>
                  {v.thumbnailUrl ? (
                    <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="h-8 w-8 text-gray-300" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <Play className="h-10 w-10 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                  </div>
                  <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-mono text-white">
                    {formatDuration(v.duration)}
                  </span>
                </div>
                {/* Info */}
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1 cursor-pointer hover:text-indigo-600" onClick={() => setSelectedVideo(v)}>
                    {v.title}
                  </h3>
                  {v.publishedAt && (
                    <p className="text-[10px] text-gray-400 flex items-center gap-1 mb-2">
                      <Clock className="h-3 w-3" /> {new Date(v.publishedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                  {/* Category badge + assign */}
                  <div className="flex items-center gap-1.5">
                    <select
                      value={v.categoryId || ""}
                      onChange={(e) => handleAssign(v.id, e.target.value || null)}
                      disabled={assigningId === v.id}
                      className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600 focus:border-indigo-400 focus:outline-none bg-white truncate"
                      style={cat ? { borderColor: cat.color, color: cat.color } : {}}
                    >
                      <option value="">Uncategorized</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
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
      {!loading && filtered.length > 0 && view === "list" && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">
          {filtered.map((v) => {
            const cat = getCat(v.categoryId);
            return (
              <div key={v.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="relative w-28 aspect-video rounded-lg overflow-hidden bg-gray-100 shrink-0 cursor-pointer" onClick={() => setSelectedVideo(v)}>
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
                  <h3 className="text-sm font-semibold text-gray-900 truncate cursor-pointer hover:text-indigo-600" onClick={() => setSelectedVideo(v)}>
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
                <select
                  value={v.categoryId || ""}
                  onChange={(e) => handleAssign(v.id, e.target.value || null)}
                  disabled={assigningId === v.id}
                  className="w-36 shrink-0 rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-600 focus:border-indigo-400 focus:outline-none bg-white"
                  style={cat ? { borderColor: cat.color, color: cat.color } : {}}
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <a href={v.vimeoUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-gray-400 hover:text-indigo-600">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            );
          })}
        </div>
      )}

      {!loading && videos.length > 0 && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center">
          <p className="text-gray-400">No videos match the current filter.</p>
        </div>
      )}

      {/* Video detail modal */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelectedVideo(null)}>
          <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedVideo(null)} className="absolute top-3 right-3 z-10 rounded-full bg-white/90 p-1.5 text-gray-500 hover:text-gray-800 shadow">
              <X className="h-5 w-5" />
            </button>
            {/* Embedded video */}
            <div className="aspect-video bg-black" dangerouslySetInnerHTML={{ __html: selectedVideo.embedHtml.replace(/width="\d+"/, 'width="100%"').replace(/height="\d+"/, 'height="100%"') }} />
            {/* Details */}
            <div className="p-5">
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
              {/* Category assign */}
              <div className="mt-4 flex items-center gap-3">
                <label className="text-xs font-medium text-gray-600">Category:</label>
                <select
                  value={selectedVideo.categoryId || ""}
                  onChange={(e) => handleAssign(selectedVideo.id, e.target.value || null)}
                  disabled={assigningId === selectedVideo.id}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none bg-white"
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {assigningId === selectedVideo.id && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer stats */}
      {!loading && videos.length > 0 && (
        <div className="mt-6 flex gap-4 text-xs text-gray-400">
          <span>{videos.length} videos</span>
          <span>{categories.length} categories</span>
          <span>{uncategorizedCount} uncategorized</span>
        </div>
      )}
    </div>
  );
}
