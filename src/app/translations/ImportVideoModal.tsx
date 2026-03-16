"use client";

import { useState, useEffect, useRef } from "react";
import { PlayCircle, Search, X, Loader2, FileText, ChevronDown, Clock } from "lucide-react";
import { authFetch } from "@/lib/authFetch";

interface ImportVideo {
  id: string;
  title: string;
  transcript: string;
  duration: number;
  thumbnailUrl: string;
  publishedAt: string | null;
}

interface Props {
  onPick: (video: ImportVideo) => void;
  onClose: () => void;
}

export function ImportVideoModal({ onPick, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [videos, setVideos] = useState<ImportVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<{ hasMore: boolean; page: number; totalCount: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on Escape
  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  // Debounce search
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(search), 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [search]);

  // Fetch on open / search change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: "1", limit: "20" });
        if (debounced) params.set("search", debounced);
        const res = await authFetch(`/api/translations/transcripts?${params}`);
        const data = await res.json();
        if (!cancelled) {
          setVideos(data.videos ?? []);
          setPagination(data.pagination ? { hasMore: data.pagination.hasMore, page: data.pagination.page, totalCount: data.pagination.totalCount } : null);
        }
      } catch (err) { console.error("ImportVideoModal fetch:", err); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [debounced]);

  const loadMore = async () => {
    if (!pagination?.hasMore) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pagination.page + 1), limit: "20" });
      if (debounced) params.set("search", debounced);
      const res = await authFetch(`/api/translations/transcripts?${params}`);
      const data = await res.json();
      setVideos((prev) => [...prev, ...(data.videos ?? [])]);
      if (data.pagination) setPagination({ hasMore: data.pagination.hasMore, page: data.pagination.page, totalCount: data.pagination.totalCount });
    } catch (err) { console.error("ImportVideoModal loadMore:", err); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="relative w-full max-w-2xl max-h-[80vh] rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-indigo-600" /> Import Transcript from Videos
          </h3>
          <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search videos by title or transcript content…"
              className="w-full rounded-lg border border-gray-300 pl-9 pr-9 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-200" />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {pagination && (
            <p className="mt-1.5 text-xs text-gray-400">{pagination.totalCount} video{pagination.totalCount !== 1 ? "s" : ""} with transcripts</p>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading && videos.length === 0 && (
            <div className="py-12 text-center text-gray-400">
              <Loader2 className="mx-auto h-5 w-5 animate-spin mb-2" /> Loading videos…
            </div>
          )}
          {!loading && videos.length === 0 && (
            <div className="py-12 text-center">
              <FileText className="mx-auto h-8 w-8 text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">{debounced ? "No videos match your search" : "No video transcripts available"}</p>
            </div>
          )}

          <div className="space-y-1.5">
            {videos.map((v) => {
              const words = v.transcript.split(/\s+/).filter(Boolean).length;
              return (
                <button key={v.id} onClick={() => onPick(v)}
                  className="w-full flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 text-left hover:bg-indigo-50 hover:border-indigo-200 transition-colors">
                  <div className="relative w-12 aspect-video rounded overflow-hidden bg-gray-100 shrink-0">
                    {v.thumbnailUrl ? (
                      <img src={v.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><PlayCircle className="h-3 w-3 text-gray-300" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{v.title}</p>
                    <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">
                      {v.transcript.length > 100 ? v.transcript.slice(0, 100).trimEnd() + "…" : v.transcript}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-gray-400">{words.toLocaleString()} words</span>
                      {v.publishedAt && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" /> {new Date(v.publishedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-indigo-600 font-medium shrink-0">Import</span>
                </button>
              );
            })}
          </div>

          {pagination?.hasMore && (
            <div className="mt-3 text-center">
              <button onClick={loadMore} disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
                Load More
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
