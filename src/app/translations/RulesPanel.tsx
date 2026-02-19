"use client";

import { Save, Settings, CheckCircle2 } from "lucide-react";
import { LANGUAGES, LANG_DEFAULT_RULES, DEFAULT_GLOBAL_RULES } from "./types";

const inp = "w-full rounded-lg border border-gray-400 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

interface Props {
  allRules: Record<string, string>;
  globalRules: string;
  rulesTab: string;
  rulesSaved: boolean;
  setRulesTab: (t: string) => void;
  setGlobalRules: (v: string) => void;
  setLangRules: (lang: string, v: string) => void;
  getLangRules: (lang: string) => string;
  buildCombinedRules: (lang: string) => string;
  onSave: () => void;
}

export function RulesPanel({
  allRules, globalRules, rulesTab, rulesSaved,
  setRulesTab, setGlobalRules, setLangRules, getLangRules, buildCombinedRules, onSave,
}: Props) {
  return (
    <div className="mb-5 rounded-xl border border-brand-200 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-5 py-3 border-b border-brand-100 bg-brand-50">
        <div>
          <h3 className="font-semibold text-brand-800 flex items-center gap-2"><Settings className="h-4 w-4" /> Translation Rules</h3>
          <p className="text-xs text-brand-600 mt-0.5">Global rules apply to every translation. Language-specific rules layer on top.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onSave} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            <Save className="h-3.5 w-3.5" /> Save All Rules
          </button>
          {rulesSaved && <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle2 className="h-3.5 w-3.5" /> Saved</span>}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50">
        {["global", ...LANGUAGES].map((lang) => {
          const hasCustom = lang === "global" ? globalRules !== DEFAULT_GLOBAL_RULES : !!allRules[lang];
          return (
            <button key={lang} onClick={() => setRulesTab(lang)}
              className={`shrink-0 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${rulesTab === lang ? "border-brand-600 text-brand-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {lang === "global" ? "🌐 Global" : lang}
              {hasCustom && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-brand-500 align-middle" />}
            </button>
          );
        })}
      </div>

      <div className="p-5">
        {rulesTab === "global" ? (
          <div>
            <p className="mb-2 text-xs text-gray-600">These rules apply to <strong>every</strong> translation regardless of language.</p>
            <textarea value={globalRules} onChange={(e) => setGlobalRules(e.target.value)} rows={7} className={inp} />
            <button onClick={() => setGlobalRules(DEFAULT_GLOBAL_RULES)} className="mt-2 text-xs text-brand-500 hover:underline">Reset to defaults</button>
          </div>
        ) : (
          <div>
            <p className="mb-2 text-xs text-gray-600">
              Rules for <strong>{rulesTab}</strong> — added on top of global rules.
              {LANG_DEFAULT_RULES[rulesTab] && !allRules[rulesTab] && <span className="ml-1 text-gray-400">(showing suggested defaults)</span>}
            </p>
            <textarea value={getLangRules(rulesTab)} onChange={(e) => setLangRules(rulesTab, e.target.value)} rows={7} className={inp} placeholder={`Specific rules for ${rulesTab}…`} />
            <div className="mt-2 flex gap-3">
              {LANG_DEFAULT_RULES[rulesTab] && (
                <button onClick={() => setLangRules(rulesTab, LANG_DEFAULT_RULES[rulesTab])} className="text-xs text-brand-500 hover:underline">Reset to defaults</button>
              )}
              {allRules[rulesTab] && (
                <button onClick={() => setLangRules(rulesTab, "")} className="text-xs text-red-400 hover:underline">Clear</button>
              )}
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">Preview combined rules for {rulesTab}</summary>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-700">{buildCombinedRules(rulesTab) || "(no rules set)"}</pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
