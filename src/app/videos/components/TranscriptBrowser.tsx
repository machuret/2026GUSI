"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, X, Loader2, ChevronDown, FileText, Clock,
  Play, Pencil, Save, Check, Copy,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";

interface TranscriptVideo {
  id: string;
  vimeoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  duration: number;
  transcript: string;
  categoryId: string | null;
  publishedAt: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TranscriptBrowser() {
  const [videos, setVideos] = useState<TranscriptVideo[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const fetchTranscripts = useCallback(async (page = 1, append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await authFetch(`/api/translations/transcripts?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      if (append) {
        setVideos((prev) => [...prev, ...(data.videos ?? [])]);
      } else {
        setVideos(data.videos ?? []);
      }
      setPagination(data.pagination ?? null);
    } catch { /* silent */ }
    finally { setLoading(false); setLoadingMore(false); }
  }, [debouncedSearch]);

  useEffect(() => { fetchTranscripts(); }, [fetchTranscripts]);

  const loadMore = () => {
    if (!pagination?.hasMore || loadingMore) return;
    fetchTranscripts(pagination.page + 1, true);
  };

  const handleEditStart = (v: TranscriptVideo) => {
    setEditText(v.transcript);
    setEditingId(v.id);
    setExpandedId(v.id);
    setSavedId(null);
  };

  const handleSave = async (v: TranscriptVideo) => {
    setSavingId(v.id);
    try {
      const res = await authFetch(`/api/videos/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: editText }),
      });
      const data = await res.json();
      if (res.ok && data.video) {
        setVideos((prev) => prev.map((vid) => vid.id === v.id ? { ...vid, transcript: data.video.transcript } : vid));
        setEditingId(null);
        setSavedId(v.id);
        setTimeout(() => setSavedId(null), 3000);
      }
    } catch { /* silent */ }
    finally { setSavingId(null); }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div>
      {/* Search + stats */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transcripts by title or content…"
            className="w-full rounded-lg border border-gray-300 pl-9 pr-9 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-200" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {pagination && (
          <span className="text-xs text-gray-400">{pagination.totalCount} video{pagination.totalCount !== 1 ? "s" : ""} with transcripts</span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="py-16 text-center text-gray-400">
          <Loader2 className="mx-auto h-6 w-6 animate-spin mb-2" /> Loading transcripts…
        </div>
      )}

      {/* Empty */}
      {!loading && videos.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <FileText className="mx-auto h-8 w-8 text-gray-300 mb-2" />
          <p className="font-medium text-gray-500">
            {debouncedSearch ? "No transcripts match your search" : "No transcripts available yet"}
          </p>
          <p className="mt-1 text-sm text-gray-400">
            {debouncedSearch ? "Try a different search term." : "Click \"Fetch Transcripts\" above to download them from Vimeo."}
          </p>
        </div>
      )}

      {/* Transcript list */}
      {!loading && videos.length > 0 && (
        <div className="space-y-2">
          {videos.map((v) => {
            const isExpanded = expandedId === v.id;
            const isEditing = editingId === v.id;
            const isSaving = savingId === v.id;
            const wasSaved = savedId === v.id;
            const wasCopied = copiedId === v.id;
            const wordCount = v.transcript.split(/\s+/).filter(Boolean).length;

            return (
              <div key={v.id}
                className={`rounded-xl border bg-white overflow-hidden shadow-sm transition-all ${isExpanded ? "border-indigo-200 ring-1 ring-indigo-100" : "border-gray-200"}`}>
                {/* Row header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Thumbnail */}
                  <div className="relative w-14 aspect-video rounded-lg overflow-hidden bg-gray-100 shrink-0">
                    {v.thumbnailUrl ? (
                      <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Play className="h-4 w-4 text-gray-300" /></div>
                    )}
                    <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 py-0.5 text-[8px] font-mono text-white">
                      {formatDuration(v.duration)}
                    </span>
                  </div>

                  {/* Title + meta */}
                  <button onClick={() => { setExpandedId(isExpanded ? null : v.id); if (isEditing && !isExpanded) { /* keep open */ } }}
                    className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-gray-900 truncate">{v.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {v.publishedAt && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {new Date(v.publishedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <FileText className="h-3 w-3" /> {wordCount.toLocaleString()} words
                      </span>
                      <span className="text-[10px] text-gray-400">{v.transcript.length.toLocaleString()} chars</span>
                    </div>
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {wasSaved && (
                      <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
                        <Check className="h-3 w-3" /> Saved
                      </span>
                    )}
                    <button onClick={() => handleCopy(v.transcript, v.id)} title="Copy transcript"
                      className="rounded-md border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50">
                      {wasCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => isEditing ? setEditingId(null) : handleEditStart(v)} title="Edit transcript"
                      className={`rounded-md border p-1.5 ${isEditing ? "border-indigo-300 bg-indigo-50 text-indigo-600" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setExpandedId(isExpanded ? null : v.id)}
                      className="rounded-md border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50">
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                    {isEditing ? (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Editing Transcript</p>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => handleSave(v)} disabled={isSaving}
                              className="flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                              {isSaving ? "Saving…" : "Save"}
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="rounded-md border border-gray-200 px-2 py-1 text-[10px] font-medium text-gray-500 hover:bg-gray-50">
                              Cancel
                            </button>
                          </div>
                        </div>
                        <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={16}
                          className="w-full rounded-lg border border-indigo-300 bg-white p-3 text-xs text-gray-700 leading-relaxed focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Full Transcript</p>
                          <span className="text-xs text-gray-400">{wordCount.toLocaleString()} words · {v.transcript.length.toLocaleString()} chars</span>
                        </div>
                        <pre className="whitespace-pre-wrap text-xs text-gray-700 leading-relaxed max-h-80 overflow-y-auto rounded-lg bg-white border border-gray-200 p-3">
                          {v.transcript}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {!loading && pagination?.hasMore && (
        <div className="mt-4 text-center">
          <button onClick={loadMore} disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
            {loadingMore ? "Loading…" : `Load More (${pagination.totalCount - videos.length} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
}
