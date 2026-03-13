"use client";

import { useState, useEffect } from "react";
import {
  Play, RefreshCw, Loader2, X, Save,
  Search, Grid3X3, List, ChevronDown, FileText,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { Video } from "./types";
import { CATEGORY_COLORS, inputCls, labelCls } from "./helpers";
import { useVideoFetch } from "./hooks/useVideoFetch";
import { useVideoSync } from "./hooks/useVideoSync";
import { useTranscriptSync } from "./hooks/useTranscriptSync";
import { useCategories } from "./hooks/useCategories";
import { useSyncLog } from "./hooks/useSyncLog";
import { SyncControls } from "./components/SyncControls";
import { CategoryBar } from "./components/CategoryBar";
import { VideoCard } from "./components/VideoCard";
import { VideoListRow } from "./components/VideoListRow";
import { VideoDetailModal } from "./components/VideoDetailModal";
import { TranscriptBrowser } from "./components/TranscriptBrowser";

export default function VideosPage() {
  /* ── Hooks ── */
  const {
    videos, setVideos, pagination, categories, setCategories,
    loading, loadingMore, error, setError,
    search, setSearch, debouncedSearch, filterCat, setFilterCat,
    fetchData, loadMore,
  } = useVideoFetch();

  const { syncing, syncProgress, syncMsg, setSyncMsg, handleSync } = useVideoSync();
  const { syncingTranscripts, transcriptMsg, setTranscriptMsg, handleTranscriptSync } = useTranscriptSync();
  const { lastVideoSync, lastTranscriptSync, fetchSyncLog } = useSyncLog();

  const catHook = useCategories(categories, setCategories, setError);
  const {
    showAddCat, setShowAddCat, catForm, setCatForm, catSaving,
    editCatId, setEditCatId, editCatForm, setEditCatForm,
    handleAddCategory, handleUpdateCategory, handleDeleteCategory,
  } = catHook;

  const [view, setView] = useState<"grid" | "list" | "transcripts">("grid");
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  // Load sync log on mount
  useEffect(() => { fetchSyncLog(); }, [fetchSyncLog]);

  /* ── Sync wrappers (refresh data after sync) ── */
  const onSync = async () => {
    try {
      await handleSync(async () => { await fetchData(); await fetchSyncLog(); });
    } catch (err) { setError(err instanceof Error ? err.message : "Sync failed"); }
  };

  const onTranscriptSync = async () => {
    try {
      await handleTranscriptSync(async () => { await fetchSyncLog(); });
    } catch (err) { setError(err instanceof Error ? err.message : "Transcript sync failed"); }
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

  /* ── Render ── */
  return (
    <div className="mx-auto max-w-7xl">
      <SyncControls
        syncing={syncing} syncProgress={syncProgress}
        syncMsg={syncMsg} setSyncMsg={setSyncMsg}
        syncingTranscripts={syncingTranscripts}
        transcriptMsg={transcriptMsg} setTranscriptMsg={setTranscriptMsg}
        error={error} setError={setError}
        lastVideoSync={lastVideoSync} lastTranscriptSync={lastTranscriptSync}
        onSync={onSync} onTranscriptSync={onTranscriptSync}
        onAddCategory={() => setShowAddCat(true)}
      />

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
        <CategoryBar
          categories={categories} filterCat={filterCat} setFilterCat={setFilterCat}
          totalCount={pagination?.totalCount ?? null}
          editCatId={editCatId} setEditCatId={setEditCatId}
          editCatForm={editCatForm} setEditCatForm={setEditCatForm}
          catSaving={catSaving}
          onUpdate={handleUpdateCategory}
          onDelete={(id) => handleDeleteCategory(id, filterCat === id ? () => setFilterCat("all") : undefined, fetchData)}
        />
      )}

      {/* Search + View toggle */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search videos…"
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-0.5">
          <button onClick={() => setView("grid")} title="Grid view" className={`rounded-md p-1.5 transition-colors ${view === "grid" ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-600"}`}>
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button onClick={() => setView("list")} title="List view" className={`rounded-md p-1.5 transition-colors ${view === "list" ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-600"}`}>
            <List className="h-4 w-4" />
          </button>
          <button onClick={() => setView("transcripts")} title="Transcripts" className={`rounded-md p-1.5 transition-colors ${view === "transcripts" ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-600"}`}>
            <FileText className="h-4 w-4" />
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
          <button onClick={onSync} disabled={syncing}
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
          {videos.map((v) => (
            <VideoCard key={v.id} video={v} categories={categories} assigningId={assigningId}
              onSelect={(v) => setSelectedVideo(v)} onAssign={handleAssign} />
          ))}
        </div>
      )}

      {/* Video list view */}
      {!loading && videos.length > 0 && view === "list" && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">
          {videos.map((v) => (
            <VideoListRow key={v.id} video={v} categories={categories} assigningId={assigningId}
              onSelect={(v) => setSelectedVideo(v)} onAssign={handleAssign} />
          ))}
        </div>
      )}

      {/* Transcripts view */}
      {view === "transcripts" && <TranscriptBrowser />}

      {/* Load More */}
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
        <VideoDetailModal
          video={selectedVideo} categories={categories} assigningId={assigningId}
          onClose={() => setSelectedVideo(null)}
          onAssign={handleAssign}
          onVideoLoaded={(v) => setSelectedVideo(v)}
        />
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
