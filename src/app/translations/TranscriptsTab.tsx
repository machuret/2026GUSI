"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, X, Loader2, ChevronDown, CheckSquare, Square,
  Play, Clock, FileText, Check, Languages, Ban,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { LANGUAGES, CONTENT_CATEGORIES, type Translation } from "./types";

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

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

interface Props {
  buildCombinedRules: (lang: string) => string;
  onSaved: (t: Translation) => void;
  onError: (msg: string) => void;
  onNavigateToLibrary: () => void;
}

export function TranscriptsTab({ buildCombinedRules, onSaved, onError, onNavigateToLibrary }: Props) {
  const [videos, setVideos] = useState<TranscriptVideo[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Search
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Bulk translate
  const [targetLanguage, setTargetLanguage] = useState("Spanish");
  const [category, setCategory] = useState("Course Content");
  const [translating, setTranslating] = useState(false);
  const [translateProgress, setTranslateProgress] = useState<{ current: number; total: number; saved: number } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const cancelRef = useRef(false);

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
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await authFetch(`/api/translations/transcripts?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load transcripts");
      if (append) {
        setVideos((prev) => [...prev, ...(data.videos ?? [])]);
      } else {
        setVideos(data.videos ?? []);
      }
      setPagination(data.pagination ?? null);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to load transcripts");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [debouncedSearch, onError]);

  useEffect(() => { fetchTranscripts(); }, [fetchTranscripts]);

  const loadMore = () => {
    if (!pagination?.hasMore || loadingMore) return;
    fetchTranscripts(pagination.page + 1, true);
  };

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allIds = videos.map((v) => v.id);
    const allSelected = allIds.every((id) => selected.has(id));
    if (allSelected) {
      setSelected((prev) => { const next = new Set(prev); allIds.forEach((id) => next.delete(id)); return next; });
    } else {
      setSelected(new Set(Array.from(selected).concat(allIds)));
    }
  };

  const selectedVideos = videos.filter((v) => selected.has(v.id));
  const allVisibleSelected = videos.length > 0 && videos.every((v) => selected.has(v.id));

  // Bulk translate selected transcripts
  const handleBulkTranslate = async () => {
    if (selectedVideos.length === 0) return;
    cancelRef.current = false;
    setTranslating(true);
    setTranslateProgress({ current: 0, total: selectedVideos.length, saved: 0 });

    // Check for existing translations to avoid duplicates
    let existingTitles = new Set<string>();
    try {
      const checkRes = await authFetch(`/api/translations?limit=1000&language=${encodeURIComponent(targetLanguage)}`);
      const checkData = await checkRes.json();
      if (checkData.translations) {
        existingTitles = new Set((checkData.translations as { title: string }[]).map((t) => t.title));
      }
    } catch { /* proceed without check */ }

    let saved = 0;
    let skipped = 0;
    for (let i = 0; i < selectedVideos.length; i++) {
      if (cancelRef.current) break;
      const video = selectedVideos[i];
      const expectedTitle = `${video.title} — ${targetLanguage}`;

      // Skip if translation already exists
      if (existingTitles.has(expectedTitle)) {
        skipped++;
        setTranslateProgress({ current: i + 1, total: selectedVideos.length, saved });
        continue;
      }

      setTranslateProgress({ current: i + 1, total: selectedVideos.length, saved });

      try {
        // Step 1: Translate via AI
        const translateRes = await authFetch("/api/translations/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: video.transcript,
            targetLanguage,
            category,
            rules: buildCombinedRules(targetLanguage),
          }),
        });
        const translateData = await translateRes.json();
        if (!translateRes.ok) {
          onError(`Failed to translate "${video.title}": ${translateData.error || "Unknown error"}`);
          continue;
        }

        if (cancelRef.current) break;

        // Step 2: Save to Translation library
        const saveRes = await authFetch("/api/translations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `${video.title} — ${targetLanguage}`,
            originalText: video.transcript,
            translatedText: translateData.translated,
            language: targetLanguage,
            category,
            publishedAt: video.publishedAt || new Date().toISOString(),
          }),
        });
        const saveData = await saveRes.json();
        if (saveRes.ok && saveData.translation) {
          onSaved(saveData.translation);
          saved++;
          setTranslateProgress({ current: i + 1, total: selectedVideos.length, saved });
        }
      } catch (err) {
        onError(`Error translating "${video.title}": ${err instanceof Error ? err.message : "Unknown"}`);
      }
    }

    const wasCancelled = cancelRef.current;
    setTranslateProgress({ current: wasCancelled ? saved : selectedVideos.length, total: selectedVideos.length, saved });
    setTranslating(false);
    setSelected(new Set());

    if (skipped > 0) {
      onError(`Skipped ${skipped} already-translated transcript${skipped !== 1 ? "s" : ""} (${targetLanguage})`);
    }

    // Keep the progress message visible for a bit
    setTimeout(() => setTranslateProgress(null), 8000);
  };

  const handleCancel = () => { cancelRef.current = true; };

  return (
    <div>
      {/* Header info */}
      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-sm text-blue-800 font-medium">
          <FileText className="inline h-4 w-4 mr-1.5 -mt-0.5" />
          Transcript Library — sourced from your Vimeo videos
        </p>
        <p className="text-xs text-blue-600 mt-0.5">
          Transcripts are fetched once and stored permanently. Search, select, and translate in bulk to any language.
        </p>
      </div>

      {/* Bulk translate bar */}
      {selected.size > 0 && !translating && (
        <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-brand-700">{selected.size} transcript{selected.size !== 1 ? "s" : ""} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)}
              className="rounded-lg border border-brand-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none">
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-brand-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none">
              {CONTENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={handleBulkTranslate}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 shadow-sm">
              <Languages className="h-3.5 w-3.5" /> Translate {selected.size} to {targetLanguage}
            </button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-brand-600 hover:underline">Clear</button>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {translateProgress && (
        <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-indigo-700">
              {translating ? (
                <>Translating {translateProgress.current} of {translateProgress.total}…</>
              ) : (
                <>Done! {translateProgress.saved} transcript{translateProgress.saved !== 1 ? "s" : ""} translated and saved to Library</>
              )}
            </span>
            {!translating && (
              <button onClick={onNavigateToLibrary} className="text-xs text-indigo-600 hover:underline font-medium">
                View in Library →
              </button>
            )}
          </div>
          <div className="h-2 w-full rounded-full bg-indigo-100 overflow-hidden">
            <div className="h-full rounded-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${Math.round((translateProgress.current / translateProgress.total) * 100)}%` }} />
          </div>
          {translating && (
            <div className="mt-1.5 flex items-center justify-between">
              <p className="text-xs text-indigo-500">{translateProgress.saved} saved so far · each is saved immediately</p>
              <button onClick={handleCancel}
                className="flex items-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                <Ban className="h-3 w-3" /> Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Search bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transcripts by title or content…"
            className="w-full rounded-lg border border-gray-300 pl-9 pr-9 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-200" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {pagination && (
          <span className="text-xs text-gray-400">{pagination.totalCount} transcript{pagination.totalCount !== 1 ? "s" : ""} available</span>
        )}
        {videos.length > 0 && (
          <button onClick={toggleSelectAll} className="ml-auto flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline">
            {allVisibleSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            {allVisibleSelected ? "Deselect all" : "Select all"}
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="py-16 text-center text-gray-400">
          <Loader2 className="mx-auto h-6 w-6 animate-spin mb-2" /> Loading transcripts…
        </div>
      )}

      {/* Empty state */}
      {!loading && videos.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <FileText className="mx-auto h-8 w-8 text-gray-300 mb-2" />
          <p className="font-medium text-gray-500">
            {debouncedSearch ? "No transcripts match your search" : "No transcripts available yet"}
          </p>
          <p className="mt-1 text-sm text-gray-400">
            {debouncedSearch ? "Try a different search term." : "Go to the Videos page to sync videos and fetch transcripts from Vimeo."}
          </p>
        </div>
      )}

      {/* Transcript list */}
      {!loading && videos.length > 0 && (
        <div className="space-y-2">
          {videos.map((v) => {
            const isSelected = selected.has(v.id);
            const isExpanded = expandedId === v.id;
            const wordCount = v.transcript.split(/\s+/).filter(Boolean).length;

            return (
              <div key={v.id}
                className={`rounded-xl border bg-white overflow-hidden shadow-sm transition-all ${isSelected ? "border-brand-300 ring-1 ring-brand-200" : "border-gray-200"}`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Checkbox */}
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(v.id)} disabled={translating}
                    className="h-4 w-4 rounded border-gray-300 accent-brand-600 cursor-pointer shrink-0" />

                  {/* Thumbnail */}
                  <div className="relative w-16 aspect-video rounded-lg overflow-hidden bg-gray-100 shrink-0">
                    {v.thumbnailUrl ? (
                      <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Play className="h-4 w-4 text-gray-300" /></div>
                    )}
                    <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 py-0.5 text-[8px] font-mono text-white">
                      {formatDuration(v.duration)}
                    </span>
                  </div>

                  {/* Info */}
                  <button onClick={() => setExpandedId(isExpanded ? null : v.id)} className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-gray-900 truncate">{v.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{truncate(v.transcript, 120)}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {v.publishedAt && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {new Date(v.publishedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <FileText className="h-3 w-3" /> {wordCount.toLocaleString()} words
                      </span>
                    </div>
                  </button>

                  {/* Quick actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isSelected && !translating && (
                      <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                        <Check className="inline h-3 w-3 -mt-0.5" /> Selected
                      </span>
                    )}
                    <button onClick={() => setExpandedId(isExpanded ? null : v.id)}
                      className="rounded-md border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50">
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                </div>

                {/* Expanded: full transcript */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Full Transcript</p>
                      <span className="text-xs text-gray-400">{wordCount.toLocaleString()} words · {v.transcript.length.toLocaleString()} chars</span>
                    </div>
                    <pre className="whitespace-pre-wrap text-xs text-gray-700 leading-relaxed max-h-64 overflow-y-auto rounded-lg bg-white border border-gray-200 p-3">
                      {v.transcript}
                    </pre>
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
