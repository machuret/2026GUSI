"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, Loader2, Copy, Save, CheckCircle2, Plus, X, PlayCircle, Search, ChevronDown, FileText, Clock } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { LANGUAGES, CONTENT_CATEGORIES, type Translation, loadCustomCategories, saveCustomCategories } from "./types";

const inp = "w-full rounded-lg border border-gray-400 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";
const lbl = "mb-1 block text-xs font-medium text-gray-700";

interface Props {
  allRules: Record<string, string>;
  buildCombinedRules: (lang: string) => string;
  getLangRules: (lang: string) => string;
  onSaved: (t: Translation) => void;
  onError: (msg: string) => void;
  onNavigateToLibrary: () => void;
}

export function TranslateTab({
  allRules, buildCombinedRules, getLangRules,
  onSaved, onError, onNavigateToLibrary,
}: Props) {
  const [transcript, setTranscript] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("Spanish");
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState("");
  const [edgeConfirmed, setEdgeConfirmed] = useState(false);

  // Category — selected at translate time, pre-fills save panel
  const [category, setCategory] = useState("General");
  const [customCats, setCustomCats] = useState<string[]>([]);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatInput, setNewCatInput] = useState("");
  const newCatRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [saveDate, setSaveDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  // Import from Videos
  const [showImport, setShowImport] = useState(false);
  const [importSearch, setImportSearch] = useState("");
  const [importDebounced, setImportDebounced] = useState("");
  const [importVideos, setImportVideos] = useState<{ id: string; title: string; transcript: string; duration: number; thumbnailUrl: string; publishedAt: string | null }[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importPagination, setImportPagination] = useState<{ hasMore: boolean; page: number; totalCount: number } | null>(null);
  const importTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted custom categories on mount
  useEffect(() => {
    setCustomCats(loadCustomCategories());
  }, []);

  // Debounce import search
  useEffect(() => {
    if (importTimer.current) clearTimeout(importTimer.current);
    importTimer.current = setTimeout(() => setImportDebounced(importSearch), 350);
    return () => { if (importTimer.current) clearTimeout(importTimer.current); };
  }, [importSearch]);

  // Fetch videos for import picker
  useEffect(() => {
    if (!showImport) return;
    let cancelled = false;
    (async () => {
      setImportLoading(true);
      try {
        const params = new URLSearchParams({ page: "1", limit: "20" });
        if (importDebounced) params.set("search", importDebounced);
        const res = await authFetch(`/api/translations/transcripts?${params}`);
        const data = await res.json();
        if (!cancelled) {
          setImportVideos(data.videos ?? []);
          setImportPagination(data.pagination ? { hasMore: data.pagination.hasMore, page: data.pagination.page, totalCount: data.pagination.totalCount } : null);
        }
      } catch { /* silent */ }
      finally { if (!cancelled) setImportLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [showImport, importDebounced]);

  const handleImportMore = async () => {
    if (!importPagination?.hasMore) return;
    setImportLoading(true);
    try {
      const params = new URLSearchParams({ page: String(importPagination.page + 1), limit: "20" });
      if (importDebounced) params.set("search", importDebounced);
      const res = await authFetch(`/api/translations/transcripts?${params}`);
      const data = await res.json();
      setImportVideos((prev) => [...prev, ...(data.videos ?? [])]);
      if (data.pagination) setImportPagination({ hasMore: data.pagination.hasMore, page: data.pagination.page, totalCount: data.pagination.totalCount });
    } catch { /* silent */ }
    finally { setImportLoading(false); }
  };

  const handlePickVideo = (video: typeof importVideos[0]) => {
    setTranscript(video.transcript);
    if (!title.trim()) setTitle(video.title);
    setShowImport(false);
    setImportSearch("");
  };

  const allCategories = [...CONTENT_CATEGORIES, ...customCats.filter(c => !CONTENT_CATEGORIES.includes(c))];

  const handleAddCategory = () => {
    const trimmed = newCatInput.trim();
    if (!trimmed || allCategories.map(c => c.toLowerCase()).includes(trimmed.toLowerCase())) {
      setShowAddCat(false);
      setNewCatInput("");
      return;
    }
    const updated = [...customCats, trimmed];
    setCustomCats(updated);
    saveCustomCategories(updated);
    setCategory(trimmed);
    setShowAddCat(false);
    setNewCatInput("");
  };

  const handleRemoveCustomCat = (cat: string) => {
    const updated = customCats.filter(c => c !== cat);
    setCustomCats(updated);
    saveCustomCategories(updated);
    if (category === cat) setCategory("General");
  };

  const handleTranslate = async () => {
    if (!transcript.trim()) return;
    setTranslating(true);
    setTranslated("");
    setEdgeConfirmed(false);
    setSavedOk(false);
    try {
      const res = await authFetch("/api/translations/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: transcript,
          targetLanguage,
          category,
          rules: buildCombinedRules(targetLanguage),
        }),
      });
      const data = await res.json();
      if (!res.ok) { onError(data.error || "Translation failed"); return; }
      setTranslated(data.translated);
      setEdgeConfirmed(true);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Network error");
    } finally {
      setTranslating(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !translated) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/translations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          originalText: transcript,
          translatedText: translated,
          language: targetLanguage,
          category,
          publishedAt: new Date(saveDate).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { onError(data.error || "Save failed"); return; }
      onSaved(data.translation);
      setSavedOk(true);
      setTranscript(""); setTranslated(""); setTitle("");
      setSaveDate(new Date().toISOString().slice(0, 10));
      setEdgeConfirmed(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  };

  const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

  return (
    <div className="rounded-xl border border-gray-300 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-40">
          <label className={lbl}>Target Language</label>
          <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} className={inp}>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>{l}{allRules[l] ? " ✓" : ""}</option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div className="flex-1 min-w-48">
          <label className={lbl}>Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Q1 Newsletter — Spanish"
            className={inp}
          />
        </div>

        {/* Content Category */}
        <div className="flex-1 min-w-40">
          <label className={lbl}>Content Category</label>
          <div className="flex gap-1.5">
            {showAddCat ? (
              <div className="flex flex-1 gap-1">
                <input
                  ref={newCatRef}
                  autoFocus
                  value={newCatInput}
                  onChange={e => setNewCatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleAddCategory(); if (e.key === "Escape") { setShowAddCat(false); setNewCatInput(""); } }}
                  placeholder="e.g. Medical Report"
                  className={`${inp} flex-1`}
                />
                <button onClick={handleAddCategory} className="rounded-lg bg-brand-600 px-2.5 text-white hover:bg-brand-700 text-xs font-semibold">Add</button>
                <button onClick={() => { setShowAddCat(false); setNewCatInput(""); }} className="rounded-lg border border-gray-300 px-2 text-gray-500 hover:bg-gray-50"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <>
                <select value={category} onChange={e => setCategory(e.target.value)} className={`${inp} flex-1`}>
                  {allCategories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button
                  onClick={() => { setShowAddCat(true); setTimeout(() => newCatRef.current?.focus(), 50); }}
                  title="Add custom category"
                  className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" /> New
                </button>
              </>
            )}
          </div>
          {/* Custom category chips */}
          {customCats.length > 0 && !showAddCat && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {customCats.map(c => (
                <span key={c} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${
                  category === c ? "bg-brand-100 text-brand-700 border-brand-300" : "bg-gray-100 text-gray-600 border-gray-200"
                }`}>
                  <button onClick={() => setCategory(c)} className="hover:underline">{c}</button>
                  <button onClick={() => handleRemoveCustomCat(c)} className="text-gray-400 hover:text-red-500 ml-0.5"><X className="h-2.5 w-2.5" /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {getLangRules(targetLanguage) && (
          <div className="flex items-center gap-1.5 rounded-lg bg-brand-50 border border-brand-200 px-3 py-2 text-xs text-brand-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Custom rules active
          </div>
        )}
        <button
          onClick={handleTranslate}
          disabled={translating || !transcript.trim()}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 shadow-sm"
        >
          {translating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {translating ? "Translating…" : "Translate with AI"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={lbl.replace("mb-1 ", "")}>Original Text / Transcript</label>
            <button onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100">
              <PlayCircle className="h-3.5 w-3.5" /> Import from Videos
            </button>
          </div>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={14}
            className={inp}
            placeholder="Paste the content you want to translate here… or import a video transcript"
          />
          <p className="mt-1 text-xs text-gray-500">{wordCount(transcript)} words</p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={lbl.replace("mb-1 ", "")}>Translation — {targetLanguage}</label>
            {translated && (
              <button
                onClick={() => navigator.clipboard.writeText(translated)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
              >
                <Copy className="h-3 w-3" /> Copy all
              </button>
            )}
          </div>
          <textarea
            value={translated}
            onChange={(e) => setTranslated(e.target.value)}
            rows={14}
            className={`${inp} ${!translated ? "bg-gray-50" : ""}`}
            placeholder="Translation will appear here — you can edit before saving…"
          />
          <div className="mt-1 flex items-center justify-between">
            <p className="text-xs text-gray-500">{wordCount(translated)} words</p>
            {edgeConfirmed && <p className="text-xs text-brand-600 font-medium">✓ GPT-4o</p>}
          </div>
        </div>
      </div>

      {translated && (
        <div className="mt-5 rounded-xl border border-green-300 bg-green-50 p-4">
          <h3 className="mb-3 font-semibold text-green-800 text-sm flex items-center gap-2">
            <Save className="h-4 w-4" /> Save to Library
            <span className="text-xs font-normal text-green-600">(saved as Draft — approve in Library tab)</span>
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="mb-1 block text-xs font-medium text-green-800">Title *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-green-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                placeholder="e.g. Q1 Newsletter — Spanish"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-green-800">Category</label>
              <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-white px-3 py-2 text-sm text-gray-700">
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">{category}</span>
                <span className="text-xs text-gray-400">(set above)</span>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-green-800">Date</label>
              <input
                type="date"
                value={saveDate}
                onChange={(e) => setSaveDate(e.target.value)}
                className="w-full rounded-lg border border-green-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none"
              />
            </div>
            <div className="col-span-2 sm:col-span-1 flex items-end">
              <p className="text-xs text-green-700">
                {wordCount(translated).toLocaleString()} words · {translated.length.toLocaleString()} characters
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 shadow-sm"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : "Save to Library"}
            </button>
            {savedOk && (
              <span className="flex items-center gap-1.5 text-sm text-green-700 font-semibold">
                <CheckCircle2 className="h-4 w-4" /> Saved as Draft ·{" "}
                <button
                  onClick={onNavigateToLibrary}
                  className="underline text-green-600 hover:text-green-800 text-xs font-medium"
                >
                  View in Library →
                </button>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Import from Videos Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowImport(false)}>
          <div className="relative w-full max-w-2xl max-h-[80vh] rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <PlayCircle className="h-5 w-5 text-indigo-600" /> Import Transcript from Videos
              </h3>
              <button onClick={() => setShowImport(false)} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input value={importSearch} onChange={(e) => setImportSearch(e.target.value)}
                  placeholder="Search videos by title or transcript content…"
                  className="w-full rounded-lg border border-gray-300 pl-9 pr-9 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-200" />
                {importSearch && (
                  <button onClick={() => setImportSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {importPagination && (
                <p className="mt-1.5 text-xs text-gray-400">{importPagination.totalCount} video{importPagination.totalCount !== 1 ? "s" : ""} with transcripts</p>
              )}
            </div>

            {/* Video list */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {importLoading && importVideos.length === 0 && (
                <div className="py-12 text-center text-gray-400">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin mb-2" /> Loading videos…
                </div>
              )}

              {!importLoading && importVideos.length === 0 && (
                <div className="py-12 text-center">
                  <FileText className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">{importDebounced ? "No videos match your search" : "No video transcripts available"}</p>
                </div>
              )}

              <div className="space-y-1.5">
                {importVideos.map((v) => {
                  const words = v.transcript.split(/\s+/).filter(Boolean).length;
                  return (
                    <button key={v.id} onClick={() => handlePickVideo(v)}
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

              {/* Load more */}
              {importPagination?.hasMore && (
                <div className="mt-3 text-center">
                  <button onClick={handleImportMore} disabled={importLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                    {importLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
                    Load More
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
