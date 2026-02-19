"use client";

import { useState } from "react";
import { Sparkles, Loader2, Copy, Save, CheckCircle2 } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { LANGUAGES, CONTENT_CATEGORIES, type Translation } from "./types";

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

  const [saveTitle, setSaveTitle] = useState("");
  const [saveCategory, setSaveCategory] = useState("General");
  const [saveDate, setSaveDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

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
    if (!saveTitle.trim() || !translated) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/translations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: saveTitle.trim(),
          originalText: transcript,
          translatedText: translated,
          language: targetLanguage,
          category: saveCategory,
          publishedAt: new Date(saveDate).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { onError(data.error || "Save failed"); return; }
      onSaved(data.translation);
      setSavedOk(true);
      setTranscript(""); setTranslated(""); setSaveTitle("");
      setSaveCategory("General"); setSaveDate(new Date().toISOString().slice(0, 10));
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
        <div className="flex-1 min-w-48">
          <label className={lbl}>Target Language</label>
          <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} className={inp}>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>{l}{allRules[l] ? " ✓" : ""}</option>
            ))}
          </select>
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
          {translating ? "Translating via Edge…" : "Translate with AI"}
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
            {edgeConfirmed && <p className="text-xs text-brand-600 font-medium">✓ GPT-4o · Edge Function</p>}
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
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                className="w-full rounded-lg border border-green-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                placeholder="e.g. Q1 Newsletter — Spanish"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-green-800">Category</label>
              <select
                value={saveCategory}
                onChange={(e) => setSaveCategory(e.target.value)}
                className="w-full rounded-lg border border-green-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none"
              >
                {CONTENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
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
              disabled={saving || !saveTitle.trim()}
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
