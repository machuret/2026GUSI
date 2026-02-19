"use client";

import { useState } from "react";
import {
  ChevronDown, ChevronUp, Copy, Check, ThumbsUp, Archive,
  Trash2, Pencil, Save, Loader2, X, RefreshCw, MessageSquare,
} from "lucide-react";
import type { Translation, TranslationStatus } from "./types";
import { CONTENT_CATEGORIES, LANG_COLORS, STATUS_STYLES } from "./types";

function LangBadge({ lang }: { lang: string }) {
  const key = Object.keys(LANG_COLORS).find((k) => lang.startsWith(k));
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${key ? LANG_COLORS[key] : "bg-gray-100 text-gray-600"}`}>{lang}</span>;
}

function StatusBadge({ status }: { status: TranslationStatus }) {
  const labels = { draft: "Draft", approved: "Approved", archived: "Archived" };
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>{labels[status]}</span>;
}

interface Props {
  translations: Translation[];
  loading: boolean;
  onStatusChange: (id: string, status: TranslationStatus) => Promise<void>;
  onSaveEdit: (id: string, title: string, text: string) => Promise<void>;
  onSaveRecheck: (id: string, feedback: string) => Promise<void>;
  onDelete: (id: string) => void;
}

export function LibraryTab({ translations, loading, onStatusChange, onSaveEdit, onSaveRecheck, onDelete }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [recheckId, setRecheckId] = useState<string | null>(null);
  const [recheckFeedback, setRecheckFeedback] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | TranslationStatus>("all");
  const [filterLang, setFilterLang] = useState("all");
  const [filterCat, setFilterCat] = useState("all");

  const usedLangs = Array.from(new Set(translations.map((t) => t.language)));
  const usedCats = Array.from(new Set(translations.map((t) => t.category)));

  const counts = {
    draft: translations.filter((t) => t.status === "draft").length,
    approved: translations.filter((t) => t.status === "approved").length,
    archived: translations.filter((t) => t.status === "archived").length,
  };

  const filtered = translations.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterLang !== "all" && t.language !== filterLang) return false;
    if (filterCat !== "all" && t.category !== filterCat) return false;
    return true;
  });

  const handleCopy = (t: Translation) => {
    navigator.clipboard.writeText(t.translatedText);
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const startEdit = (t: Translation) => {
    setEditingId(t.id);
    setEditTitle(t.title);
    setEditText(t.translatedText);
    setExpandedId(t.id);
    setRecheckId(null);
  };

  const startRecheck = (t: Translation) => {
    setRecheckId(t.id);
    setRecheckFeedback(t.feedback ?? "");
    setExpandedId(t.id);
    setEditingId(null);
  };

  const handleStatus = async (id: string, status: TranslationStatus) => {
    setUpdatingId(id);
    await onStatusChange(id, status);
    setUpdatingId(null);
  };

  const handleEdit = async (id: string) => {
    setUpdatingId(id);
    await onSaveEdit(id, editTitle, editText);
    setEditingId(null);
    setUpdatingId(null);
  };

  const handleRecheck = async (id: string) => {
    if (!recheckFeedback.trim()) return;
    setUpdatingId(id);
    await onSaveRecheck(id, recheckFeedback);
    setRecheckId(null);
    setRecheckFeedback("");
    setUpdatingId(null);
  };

  return (
    <div>
      {/* Status summary cards */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        {(["draft", "approved", "archived"] as TranslationStatus[]).map((s) => (
          <button key={s} onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
            className={`rounded-xl border p-4 text-left transition-colors shadow-sm ${filterStatus === s ? "border-brand-400 bg-brand-50" : "border-gray-300 bg-white hover:bg-gray-50"}`}>
            <p className="text-xs font-medium text-gray-600 capitalize">{s}</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{counts[s]}</p>
            <div className="mt-1"><StatusBadge status={s} /></div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <span className="text-xs font-medium text-gray-600">Filter:</span>
        {usedLangs.length > 1 && (
          <select value={filterLang} onChange={(e) => setFilterLang(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-700 focus:outline-none bg-white">
            <option value="all">All Languages</option>
            {usedLangs.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
        {usedCats.length > 1 && (
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-700 focus:outline-none bg-white">
            <option value="all">All Categories</option>
            {usedCats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {(filterStatus !== "all" || filterLang !== "all" || filterCat !== "all") && (
          <button onClick={() => { setFilterStatus("all"); setFilterLang("all"); setFilterCat("all"); }}
            className="text-xs text-brand-600 hover:underline">Clear filters</button>
        )}
        <span className="ml-auto text-xs text-gray-500">{filtered.length} of {translations.length}</span>
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <p className="font-medium text-gray-500">No translations match your filters</p>
          <p className="mt-1 text-sm text-gray-400">Save translations from the Translate tab to see them here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const isExpanded = expandedId === t.id;
            const isEditing = editingId === t.id;
            const isRechecking = recheckId === t.id;
            const isUpdating = updatingId === t.id;

            return (
              <div key={t.id} className={`rounded-xl border bg-white overflow-hidden shadow-sm transition-colors ${t.status === "approved" ? "border-green-200" : t.status === "archived" ? "border-amber-200" : "border-gray-300"}`}>
                {/* Row header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => setExpandedId(isExpanded ? null : t.id)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{t.title}</p>
                        <LangBadge lang={t.language} />
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{t.category}</span>
                        <StatusBadge status={t.status} />
                        {t.feedback && (
                          <span className="flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                            <MessageSquare className="h-3 w-3" /> Has feedback
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {new Date(t.publishedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                        {" · "}{t.translatedText.split(/\s+/).filter(Boolean).length} words
                      </p>
                    </div>
                  </button>

                  {/* Action buttons */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    {/* Copy */}
                    <button onClick={() => handleCopy(t)} title="Copy translation"
                      className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50">
                      {copiedId === t.id ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    {/* Edit */}
                    <button onClick={() => isEditing ? setEditingId(null) : startEdit(t)} title="Edit"
                      className={`rounded-md border p-1.5 ${isEditing ? "border-brand-300 bg-brand-50 text-brand-600" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {/* Re-check */}
                    <button onClick={() => isRechecking ? setRecheckId(null) : startRecheck(t)} title="Re-check / add feedback"
                      className={`rounded-md border p-1.5 ${isRechecking ? "border-purple-300 bg-purple-50 text-purple-600" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    {/* Approve */}
                    {t.status !== "approved" && (
                      <button onClick={() => handleStatus(t.id, "approved")} disabled={isUpdating} title="Approve"
                        className="rounded-md border border-green-200 p-1.5 text-green-600 hover:bg-green-50 disabled:opacity-40">
                        {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    {/* Archive */}
                    {t.status !== "archived" && (
                      <button onClick={() => handleStatus(t.id, "archived")} disabled={isUpdating} title="Archive"
                        className="rounded-md border border-amber-200 p-1.5 text-amber-600 hover:bg-amber-50 disabled:opacity-40">
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {/* Restore to draft */}
                    {t.status !== "draft" && (
                      <button onClick={() => handleStatus(t.id, "draft")} disabled={isUpdating} title="Move to Draft"
                        className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {/* Expand */}
                    <button onClick={() => setExpandedId(isExpanded ? null : t.id)}
                      className="rounded-md border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50">
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    {/* Delete */}
                    <button onClick={() => onDelete(t.id)}
                      className="rounded-md border border-red-100 p-1.5 text-red-400 hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {/* Edit mode */}
                    {isEditing ? (
                      <div className="p-4 space-y-3 bg-brand-50">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-700">Title</label>
                          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full rounded-lg border border-gray-400 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-700">Translated Text</label>
                          <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={8}
                            className="w-full rounded-lg border border-gray-400 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleEdit(t.id)} disabled={isUpdating}
                            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                            {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Changes
                          </button>
                          <button onClick={() => setEditingId(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                        </div>
                      </div>
                    ) : isRechecking ? (
                      /* Re-check mode */
                      <div className="p-4 bg-purple-50 border-t border-purple-100">
                        <div className="flex items-center gap-2 mb-3">
                          <RefreshCw className="h-4 w-4 text-purple-600" />
                          <p className="text-sm font-semibold text-purple-800">Re-check Feedback</p>
                          <p className="text-xs text-purple-600">Add notes on what to improve — this is stored with the translation for future reference.</p>
                        </div>
                        <textarea value={recheckFeedback} onChange={(e) => setRecheckFeedback(e.target.value)} rows={4}
                          className="w-full rounded-lg border border-purple-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                          placeholder="e.g. The tone is too formal for social media. The third paragraph loses the original humour. Brand name 'Acme' should stay in English…" />
                        <div className="mt-3 flex gap-2">
                          <button onClick={() => handleRecheck(t.id)} disabled={isUpdating || !recheckFeedback.trim()}
                            className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50">
                            {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Feedback
                          </button>
                          <button onClick={() => setRecheckId(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                        </div>
                        {t.feedback && (
                          <div className="mt-3 rounded-lg border border-purple-200 bg-white p-3">
                            <p className="text-xs font-semibold text-purple-700 mb-1">Previous feedback:</p>
                            <p className="text-xs text-gray-700 whitespace-pre-wrap">{t.feedback}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Read mode */
                      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
                        {t.originalText && (
                          <div className="px-4 py-3">
                            <p className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Original</p>
                            <pre className="whitespace-pre-wrap text-xs text-gray-700 leading-relaxed max-h-56 overflow-y-auto">{t.originalText}</pre>
                          </div>
                        )}
                        <div className="px-4 py-3">
                          <p className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">{t.language}</p>
                          <pre className="whitespace-pre-wrap text-xs text-gray-700 leading-relaxed max-h-56 overflow-y-auto">{t.translatedText}</pre>
                        </div>
                        {t.feedback && (
                          <div className="lg:col-span-2 px-4 py-3 border-t border-purple-100 bg-purple-50">
                            <p className="mb-1 text-xs font-semibold text-purple-600 uppercase tracking-wide">Re-check Feedback</p>
                            <p className="text-xs text-gray-700 whitespace-pre-wrap">{t.feedback}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
