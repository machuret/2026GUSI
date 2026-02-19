"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Languages, Trash2, Save, Loader2, ChevronDown, ChevronUp,
  Settings, Sparkles, CheckCircle2, Plus, X,
} from "lucide-react";
import { ErrorBanner } from "@/components/ErrorBanner";

interface Translation {
  id: string;
  title: string;
  originalText: string;
  translatedText: string;
  language: string;
  category: string;
  publishedAt: string;
  createdAt: string;
}

const LANGUAGES = [
  "Spanish", "French", "German", "Italian", "Portuguese", "Dutch",
  "Polish", "Russian", "Japanese", "Chinese (Simplified)", "Chinese (Traditional)",
  "Korean", "Arabic", "Hindi", "Turkish", "Swedish", "Norwegian", "Danish",
  "Finnish", "Greek", "Hebrew", "Thai", "Vietnamese", "Indonesian", "Malay",
];

const CONTENT_CATEGORIES = [
  "Newsletter", "Blog Post", "Social Media", "Press Release",
  "Announcement", "Sales Page", "Cold Email", "Webinar", "Course Content", "General",
];

const inp = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const lbl = "mb-1 block text-xs font-medium text-gray-600";

const LANG_COLORS: Record<string, string> = {
  Spanish: "bg-red-100 text-red-700",
  French: "bg-blue-100 text-blue-700",
  German: "bg-yellow-100 text-yellow-700",
  Italian: "bg-green-100 text-green-700",
  Portuguese: "bg-orange-100 text-orange-700",
  Japanese: "bg-pink-100 text-pink-700",
  Chinese: "bg-purple-100 text-purple-700",
  Arabic: "bg-teal-100 text-teal-700",
  Korean: "bg-indigo-100 text-indigo-700",
  Hindi: "bg-amber-100 text-amber-700",
};

const DEFAULT_GLOBAL_RULES = `- Preserve the original tone and voice exactly
- Keep all proper nouns, brand names, and product names untranslated
- Maintain paragraph structure and formatting
- Use formal register unless the original is casual
- Do not add or remove content`;

const LANG_DEFAULT_RULES: Record<string, string> = {
  Spanish: `- Use Latin American Spanish (not Castilian) unless specified otherwise
- Use "usted" for formal content, "tú" for casual
- Avoid literal translations of idioms — find natural Spanish equivalents
- Currency: keep original currency symbols`,
  French: `- Use standard French (not Canadian French) unless specified
- Use "vous" for formal content
- Avoid anglicisms where a natural French equivalent exists
- Maintain formal punctuation rules (spaces before : ; ! ?)`,
  German: `- Use formal "Sie" for professional content
- Compound nouns should follow German conventions
- Maintain sentence structure — avoid overly literal translations
- Use Oxford-style clarity for technical content`,
  Arabic: `- Write right-to-left — ensure formatting is preserved
- Use Modern Standard Arabic (MSA) unless a dialect is specified
- Dates and numbers: use Arabic-Indic numerals where appropriate
- Maintain formal register for business content`,
  Japanese: `- Use polite form (丁寧語) for business content
- Katakana for foreign brand names and technical terms
- Avoid over-literal translations — prioritise natural Japanese flow
- Maintain appropriate keigo level throughout`,
  Chinese: `- Use Simplified Chinese unless Traditional is specified
- Maintain professional tone with appropriate formality
- Technical terms: use established Chinese equivalents where they exist
- Dates: use Chinese date format (年月日)`,
};

function LangBadge({ lang }: { lang: string }) {
  const key = Object.keys(LANG_COLORS).find((k) => lang.startsWith(k));
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${key ? LANG_COLORS[key] : "bg-gray-100 text-gray-600"}`}>
      {lang}
    </span>
  );
}

const RULES_STORAGE_KEY = "translation_rules_v2";

function loadAllRules(): Record<string, string> {
  try {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveAllRules(rules: Record<string, string>) {
  localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
}

export default function TranslationsPage() {
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Rules panel
  const [showRules, setShowRules] = useState(false);
  const [rulesTab, setRulesTab] = useState<"global" | string>("global");
  const [allRules, setAllRules] = useState<Record<string, string>>({});
  const [globalRules, setGlobalRules] = useState(DEFAULT_GLOBAL_RULES);
  const [rulesSaved, setRulesSaved] = useState(false);

  // Translate form
  const [transcript, setTranscript] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("Spanish");
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState("");

  // Save form
  const [saveTitle, setSaveTitle] = useState("");
  const [saveCategory, setSaveCategory] = useState("General");
  const [saveDate, setSaveDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  // List
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterLang, setFilterLang] = useState("all");

  const fetchTranslations = useCallback(async () => {
    try {
      const res = await fetch("/api/translations");
      if (!res.ok) throw new Error(`Failed to load translations (${res.status})`);
      const data = await res.json();
      setTranslations(data.translations ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load translations");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTranslations(); }, [fetchTranslations]);

  useEffect(() => {
    const stored = loadAllRules();
    setAllRules(stored);
    if (stored["global"]) setGlobalRules(stored["global"]);
  }, []);

  const getLangRules = (lang: string): string => {
    return allRules[lang] ?? LANG_DEFAULT_RULES[lang] ?? "";
  };

  const setLangRules = (lang: string, value: string) => {
    setAllRules((prev) => ({ ...prev, [lang]: value }));
  };

  const handleSaveRules = () => {
    const toSave = { ...allRules, global: globalRules };
    saveAllRules(toSave);
    setAllRules(toSave);
    setRulesSaved(true);
    setTimeout(() => setRulesSaved(false), 2000);
  };

  const handleResetLangRules = (lang: string) => {
    const def = lang === "global" ? DEFAULT_GLOBAL_RULES : (LANG_DEFAULT_RULES[lang] ?? "");
    if (lang === "global") setGlobalRules(def);
    else setLangRules(lang, def);
  };

  const buildCombinedRules = (lang: string): string => {
    const parts: string[] = [];
    if (globalRules.trim()) parts.push(`GLOBAL RULES:\n${globalRules.trim()}`);
    const langSpecific = getLangRules(lang);
    if (langSpecific.trim()) parts.push(`${lang.toUpperCase()} SPECIFIC RULES:\n${langSpecific.trim()}`);
    return parts.join("\n\n");
  };

  const handleTranslate = async () => {
    if (!transcript.trim()) return;
    setTranslating(true); setActionError(null); setTranslated(""); setSavedOk(false);
    try {
      const combinedRules = buildCombinedRules(targetLanguage);
      const res = await fetch("/api/translations/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript, targetLanguage, rules: combinedRules }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error || "Translation failed"); return; }
      setTranslated(data.translated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
    } finally { setTranslating(false); }
  };

  const handleSave = async () => {
    if (!saveTitle.trim() || !translated) return;
    setSaving(true); setActionError(null);
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
      setTranslations((prev) => [data.translation, ...prev]);
      setSavedOk(true);
      setTranscript(""); setTranslated(""); setSaveTitle("");
      setSaveCategory("General"); setSaveDate(new Date().toISOString().slice(0, 10));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this translation?")) return;
    setTranslations((prev) => prev.filter((t) => t.id !== id));
    try { await fetch(`/api/translations?id=${id}`, { method: "DELETE" }); }
    catch { fetchTranslations(); }
  };

  const usedLangs = Array.from(new Set(translations.map((t) => t.language)));
  const filtered = filterLang === "all" ? translations : translations.filter((t) => t.language === filterLang);

  // Languages that have custom rules saved
  const langsWithRules = LANGUAGES.filter((l) => allRules[l] && allRules[l].trim());

  const rulesTabLangs = ["global", ...LANGUAGES];

  return (
    <div className="mx-auto max-w-4xl">
      {error && <ErrorBanner message={error} onRetry={fetchTranslations} onDismiss={() => setError(null)} className="mb-4" />}
      {actionError && <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} className="mb-4" />}

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Languages className="h-8 w-8 text-brand-600" /> Translations
          </h1>
          <p className="mt-1 text-gray-500">
            Paste a transcript, apply per-language rules, translate with AI, and store the result.
          </p>
          {langsWithRules.length > 0 && (
            <p className="mt-1 text-xs text-gray-400">
              Custom rules saved for: {langsWithRules.join(", ")}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowRules(!showRules)}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${showRules ? "border-brand-300 bg-brand-50 text-brand-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
        >
          <Settings className="h-4 w-4" /> Translation Rules
        </button>
      </div>

      {/* Rules Panel */}
      {showRules && (
        <div className="mb-5 rounded-xl border border-brand-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-brand-100 bg-brand-50">
            <div>
              <h3 className="font-semibold text-brand-800 flex items-center gap-2">
                <Settings className="h-4 w-4" /> Translation Rules
              </h3>
              <p className="text-xs text-brand-600 mt-0.5">
                Global rules apply to every translation. Language-specific rules are added on top — they override where they conflict.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveRules}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
              >
                <Save className="h-3.5 w-3.5" /> Save All Rules
              </button>
              {rulesSaved && (
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                </span>
              )}
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50">
            {rulesTabLangs.map((lang) => {
              const hasCustom = lang === "global" ? globalRules !== DEFAULT_GLOBAL_RULES : !!allRules[lang];
              return (
                <button
                  key={lang}
                  onClick={() => setRulesTab(lang)}
                  className={`shrink-0 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    rulesTab === lang
                      ? "border-brand-600 text-brand-700 bg-white"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {lang === "global" ? "🌐 Global" : lang}
                  {hasCustom && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-brand-500 align-middle" />}
                </button>
              );
            })}
          </div>

          <div className="p-5">
            {rulesTab === "global" ? (
              <div>
                <p className="mb-2 text-xs text-gray-500">These rules apply to <strong>every</strong> translation regardless of language.</p>
                <textarea
                  value={globalRules}
                  onChange={(e) => setGlobalRules(e.target.value)}
                  rows={7}
                  className={inp}
                  placeholder="- Rule 1&#10;- Rule 2"
                />
                <button onClick={() => handleResetLangRules("global")} className="mt-2 text-xs text-brand-500 hover:underline">
                  Reset to defaults
                </button>
              </div>
            ) : (
              <div>
                <p className="mb-2 text-xs text-gray-500">
                  Rules specific to <strong>{rulesTab}</strong> — applied in addition to global rules.
                  {LANG_DEFAULT_RULES[rulesTab] && !allRules[rulesTab] && (
                    <span className="ml-1 text-gray-400">(showing suggested defaults — edit to customise)</span>
                  )}
                </p>
                <textarea
                  value={getLangRules(rulesTab)}
                  onChange={(e) => setLangRules(rulesTab, e.target.value)}
                  rows={7}
                  className={inp}
                  placeholder={`Specific rules for ${rulesTab} translations…\ne.g. Use formal register\ne.g. Keep brand names in English`}
                />
                <div className="mt-2 flex gap-3">
                  {LANG_DEFAULT_RULES[rulesTab] && (
                    <button onClick={() => handleResetLangRules(rulesTab)} className="text-xs text-brand-500 hover:underline">
                      Reset to suggested defaults
                    </button>
                  )}
                  {allRules[rulesTab] && (
                    <button
                      onClick={() => setLangRules(rulesTab, "")}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Clear rules
                    </button>
                  )}
                </div>
                {/* Preview combined rules */}
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">Preview combined rules for {rulesTab}</summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    {buildCombinedRules(rulesTab) || "(no rules set)"}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Translate Panel */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-gray-800 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-500" /> Translate Content
        </h2>

        <div className="mb-3 flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-48">
            <label className={lbl}>Target Language</label>
            <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} className={inp}>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}{allRules[l] ? " ✓" : ""}
                </option>
              ))}
            </select>
          </div>
          {(allRules[targetLanguage] || getLangRules(targetLanguage)) && (
            <div className="flex items-center gap-1.5 rounded-lg bg-brand-50 border border-brand-200 px-3 py-2 text-xs text-brand-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Custom rules active for {targetLanguage}
            </div>
          )}
          <button
            onClick={handleTranslate}
            disabled={translating || !transcript.trim()}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {translating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {translating ? "Translating…" : "Translate"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <label className={lbl}>Original Text / Transcript</label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={12}
              className={inp}
              placeholder="Paste the content you want to translate here…"
            />
            <p className="mt-1 text-xs text-gray-400">{transcript.split(/\s+/).filter(Boolean).length} words</p>
          </div>
          <div>
            <label className={lbl}>Translation — {targetLanguage}</label>
            <textarea
              value={translated}
              onChange={(e) => setTranslated(e.target.value)}
              rows={12}
              className={`${inp} ${!translated ? "bg-gray-50" : ""}`}
              placeholder="Translation will appear here — you can edit before saving…"
            />
            <p className="mt-1 text-xs text-gray-400">{translated.split(/\s+/).filter(Boolean).length} words</p>
          </div>
        </div>

        {/* Save section */}
        {translated && (
          <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
            <h3 className="mb-3 font-semibold text-green-800 text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Save Translation
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="mb-1 block text-xs font-medium text-green-700">Title *</label>
                <input
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  className="w-full rounded-lg border border-green-300 bg-white px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                  placeholder="e.g. Q1 Newsletter — Spanish"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-green-700">Category</label>
                <select
                  value={saveCategory}
                  onChange={(e) => setSaveCategory(e.target.value)}
                  className="w-full rounded-lg border border-green-300 bg-white px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                >
                  {CONTENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-green-700">Date</label>
                <input
                  type="date"
                  value={saveDate}
                  onChange={(e) => setSaveDate(e.target.value)}
                  className="w-full rounded-lg border border-green-300 bg-white px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !saveTitle.trim()}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving…" : "Save Translation"}
              </button>
              {savedOk && (
                <span className="flex items-center gap-1 text-sm text-green-700 font-medium">
                  <CheckCircle2 className="h-4 w-4" /> Saved!
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Saved Translations List */}
      <div>
        <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold text-gray-800">Saved Translations ({translations.length})</h2>
          {usedLangs.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilterLang("all")}
                className={`rounded-full px-3 py-0.5 text-xs font-medium border ${filterLang === "all" ? "bg-brand-600 text-white border-brand-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
              >
                All
              </button>
              {usedLangs.map((l) => (
                <button
                  key={l}
                  onClick={() => setFilterLang(l)}
                  className={`rounded-full px-3 py-0.5 text-xs font-medium border ${filterLang === l ? "bg-brand-600 text-white border-brand-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center">
            <Languages className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 font-medium text-gray-500">No translations yet</p>
            <p className="mt-1 text-sm text-gray-400">Translate and save content above to see it here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((t) => {
              const isExpanded = expandedId === t.id;
              return (
                <div key={t.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : t.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900">{t.title}</p>
                          <LangBadge lang={t.language} />
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{t.category}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {new Date(t.publishedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                          {" · "}{t.translatedText.split(/\s+/).filter(Boolean).length} words
                        </p>
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-1.5 ml-3">
                      <button onClick={() => setExpandedId(isExpanded ? null : t.id)} className="rounded-md border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50">
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="rounded-md border border-red-100 p-1.5 text-red-400 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-gray-100 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
                      {t.originalText && (
                        <div className="px-4 py-3">
                          <p className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Original</p>
                          <pre className="whitespace-pre-wrap text-xs text-gray-700 leading-relaxed max-h-48 overflow-y-auto">{t.originalText}</pre>
                        </div>
                      )}
                      <div className="px-4 py-3">
                        <p className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">{t.language}</p>
                        <pre className="whitespace-pre-wrap text-xs text-gray-700 leading-relaxed max-h-48 overflow-y-auto">{t.translatedText}</pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
