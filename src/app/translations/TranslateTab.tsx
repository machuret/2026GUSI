"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, Loader2, Copy, Save, CheckCircle2, Plus, X } from "lucide-react";
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

  // Load persisted custom categories on mount
  useEffect(() => {
    setCustomCats(loadCustomCategories());
  }, []);

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
          <label className={lbl}>Original Text / Transcript</label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={14}
            className={inp}
            placeholder="Paste the content you want to translate here…"
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
    </div>
  );
}
