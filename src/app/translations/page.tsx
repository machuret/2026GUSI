"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Languages, Save, Loader2, Settings, Sparkles,
  CheckCircle2, Copy, BookOpen, Upload,
} from "lucide-react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { authFetch } from "@/lib/authFetch";
import { RulesPanel } from "./RulesPanel";
import { LibraryTab } from "./LibraryTab";
import { BulkUploadTab } from "./BulkUploadTab";
import {
  type Translation, type TranslationStatus,
  LANGUAGES, CONTENT_CATEGORIES,
  DEFAULT_GLOBAL_RULES, LANG_DEFAULT_RULES,
  loadAllRules, saveAllRules,
} from "./types";

const inp = "w-full rounded-lg border border-gray-400 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";
const lbl = "mb-1 block text-xs font-medium text-gray-700";

type PageTab = "translate" | "bulk" | "library";

export default function TranslationsPage() {
  const [pageTab, setPageTab] = useState<PageTab>("translate");
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Rules
  const [showRules, setShowRules] = useState(false);
  const [rulesTab, setRulesTab] = useState("global");
  const [allRules, setAllRules] = useState<Record<string, string>>({});
  const [globalRules, setGlobalRules] = useState(DEFAULT_GLOBAL_RULES);
  const [rulesSaved, setRulesSaved] = useState(false);

  // Single translate
  const [transcript, setTranscript] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("Spanish");
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState("");
  const [edgeConfirmed, setEdgeConfirmed] = useState(false);

  // Save form
  const [saveTitle, setSaveTitle] = useState("");
  const [saveCategory, setSaveCategory] = useState("General");
  const [saveDate, setSaveDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  const fetchTranslations = useCallback(async () => {
    try {
      const res = await fetch("/api/translations");
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = await res.json();
      setTranslations(data.translations ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load translations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTranslations(); }, [fetchTranslations]);

  useEffect(() => {
    const stored = loadAllRules();
    setAllRules(stored);
    if (stored["global"]) setGlobalRules(stored["global"]);
  }, []);

  const getLangRules = (lang: string) => allRules[lang] ?? LANG_DEFAULT_RULES[lang] ?? "";
  const setLangRules = (lang: string, v: string) => setAllRules((p) => ({ ...p, [lang]: v }));

  const handleSaveRules = () => {
    const toSave = { ...allRules, global: globalRules };
    saveAllRules(toSave);
    setAllRules(toSave);
    setRulesSaved(true);
    setTimeout(() => setRulesSaved(false), 2000);
  };

  const buildCombinedRules = (lang: string) => {
    const parts: string[] = [];
    if (globalRules.trim()) parts.push(`GLOBAL RULES:\n${globalRules.trim()}`);
    const ls = getLangRules(lang);
    if (ls.trim()) parts.push(`${lang.toUpperCase()} SPECIFIC RULES:\n${ls.trim()}`);
    return parts.join("\n\n");
  };

  const handleTranslate = async () => {
    if (!transcript.trim()) return;
    setTranslating(true);
    setActionError(null);
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
      if (!res.ok) { setActionError(data.error || "Translation failed"); return; }
      setTranslated(data.translated);
      setEdgeConfirmed(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
    } finally {
      setTranslating(false);
    }
  };

  const handleSave = async () => {
    if (!saveTitle.trim() || !translated) return;
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch("/api/translations", {
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
      if (!res.ok) { setActionError(data.error || "Save failed"); return; }
      setTranslations((p) => [data.translation, ...p]);
      setSavedOk(true);
      setTranscript(""); setTranslated(""); setSaveTitle("");
      setSaveCategory("General"); setSaveDate(new Date().toISOString().slice(0, 10));
      setEdgeConfirmed(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  };

  // Library actions
  const handleStatusChange = async (id: string, status: TranslationStatus) => {
    try {
      const res = await fetch(`/api/translations?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error || "Update failed"); return; }
      setTranslations((p) => p.map((t) => t.id === id ? { ...t, status } : t));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
    }
  };

  const handleSaveEdit = async (id: string, title: string, translatedText: string) => {
    try {
      const res = await fetch(`/api/translations?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, translatedText }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error || "Update failed"); return; }
      setTranslations((p) => p.map((t) => t.id === id ? data.translation : t));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
    }
  };

  const handleSaveRecheck = async (id: string, feedback: string) => {
    try {
      const res = await fetch(`/api/translations?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error || "Update failed"); return; }
      setTranslations((p) => p.map((t) => t.id === id ? data.translation : t));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this translation permanently?")) return;
    setTranslations((p) => p.filter((t) => t.id !== id));
    try { await fetch(`/api/translations?id=${id}`, { method: "DELETE" }); }
    catch { fetchTranslations(); }
  };

  const langsWithRules = LANGUAGES.filter((l) => allRules[l] && allRules[l].trim());

  const TABS: { id: PageTab; label: string; Icon: React.ElementType }[] = [
    { id: "translate", label: "Translate", Icon: Sparkles },
    { id: "bulk",      label: "Bulk Upload", Icon: Upload },
    { id: "library",   label: "Library", Icon: BookOpen },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      {error && <ErrorBanner message={error} onRetry={fetchTranslations} onDismiss={() => setError(null)} className="mb-4" />}
      {actionError && <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} className="mb-4" />}

      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Languages className="h-8 w-8 text-brand-600" /> Translations
          </h1>
          <p className="mt-1 text-gray-500">
            Translate content with AI · bulk upload TXT files · manage approvals.
          </p>
          {langsWithRules.length > 0 && (
            <p className="mt-1 text-xs text-gray-500">Custom rules active: {langsWithRules.join(", ")}</p>
          )}
        </div>
        <button
          onClick={() => setShowRules(!showRules)}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${showRules ? "border-brand-300 bg-brand-50 text-brand-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
        >
          <Settings className="h-4 w-4" /> Translation Rules
        </button>
      </div>

      {/* Rules panel */}
      {showRules && (
        <RulesPanel
          allRules={allRules}
          globalRules={globalRules}
          rulesTab={rulesTab}
          rulesSaved={rulesSaved}
          setRulesTab={setRulesTab}
          setGlobalRules={setGlobalRules}
          setLangRules={setLangRules}
          getLangRules={getLangRules}
          buildCombinedRules={buildCombinedRules}
          onSave={handleSaveRules}
        />
      )}

      {/* Page tabs */}
      <div className="mb-5 flex border-b border-gray-300">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setPageTab(id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${pageTab === id ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            <Icon className="h-4 w-4" />
            {label}
            {id === "library" && translations.length > 0 && (
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">{translations.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── TRANSLATE TAB ── */}
      {pageTab === "translate" && (
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
            <button onClick={handleTranslate} disabled={translating || !transcript.trim()}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 shadow-sm">
              {translating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {translating ? "Translating via Edge…" : "Translate with AI"}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label className={lbl}>Original Text / Transcript</label>
              <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={14}
                className={inp} placeholder="Paste the content you want to translate here…" />
              <p className="mt-1 text-xs text-gray-500">{transcript.split(/\s+/).filter(Boolean).length} words</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={lbl.replace("mb-1 ", "")}>Translation — {targetLanguage}</label>
                {translated && (
                  <button onClick={() => navigator.clipboard.writeText(translated)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
                    <Copy className="h-3 w-3" /> Copy all
                  </button>
                )}
              </div>
              <textarea value={translated} onChange={(e) => setTranslated(e.target.value)} rows={14}
                className={`${inp} ${!translated ? "bg-gray-50" : ""}`}
                placeholder="Translation will appear here — you can edit before saving…" />
              <div className="mt-1 flex items-center justify-between">
                <p className="text-xs text-gray-500">{translated.split(/\s+/).filter(Boolean).length} words</p>
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
                  <input value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)}
                    className="w-full rounded-lg border border-green-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                    placeholder="e.g. Q1 Newsletter — Spanish" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-green-800">Category</label>
                  <select value={saveCategory} onChange={(e) => setSaveCategory(e.target.value)}
                    className="w-full rounded-lg border border-green-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none">
                    {CONTENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-green-800">Date</label>
                  <input type="date" value={saveDate} onChange={(e) => setSaveDate(e.target.value)}
                    className="w-full rounded-lg border border-green-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleSave} disabled={saving || !saveTitle.trim()}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 shadow-sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving…" : "Save to Library"}
                </button>
                {savedOk && (
                  <span className="flex items-center gap-1.5 text-sm text-green-700 font-semibold">
                    <CheckCircle2 className="h-4 w-4" /> Saved as Draft ·{" "}
                    <button onClick={() => setPageTab("library")}
                      className="underline text-green-600 hover:text-green-800 text-xs font-medium">
                      View in Library →
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BULK UPLOAD TAB ── */}
      {pageTab === "bulk" && (
        <BulkUploadTab
          buildCombinedRules={buildCombinedRules}
          getLangRules={getLangRules}
          onSaved={(t) => setTranslations((p) => [t, ...p])}
        />
      )}

      {/* ── LIBRARY TAB ── */}
      {pageTab === "library" && (
        <LibraryTab
          translations={translations}
          loading={loading}
          onStatusChange={handleStatusChange}
          onSaveEdit={handleSaveEdit}
          onSaveRecheck={handleSaveRecheck}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
