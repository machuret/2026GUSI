"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/authFetch";
import {
  DEFAULT_GLOBAL_RULES, LANG_DEFAULT_RULES,
  RULES_KEY, loadAllRules, saveAllRules,
} from "../types";

const SETTINGS_KEY = RULES_KEY; // single source of truth from types.ts

export function useRules() {
  const [allRules, setAllRules] = useState<Record<string, string>>({});
  const [globalRules, setGlobalRules] = useState(DEFAULT_GLOBAL_RULES);
  const [rulesSaved, setRulesSaved] = useState(false);
  const [rulesTab, setRulesTab] = useState("global");

  // Load from DB first, fall back to localStorage
  const loadRules = useCallback(async () => {
    try {
      const res = await authFetch(`/api/settings?key=${SETTINGS_KEY}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.value) {
          const parsed: Record<string, string> = JSON.parse(data.value);
          setAllRules(parsed);
          if (parsed["global"]) setGlobalRules(parsed["global"]);
          saveAllRules(parsed); // keep localStorage in sync
          return;
        }
      }
    } catch { /* fall through to localStorage */ }

    // Fallback: localStorage
    const stored = loadAllRules();
    setAllRules(stored);
    if (stored["global"]) setGlobalRules(stored["global"]);
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  const getLangRules = (lang: string) => allRules[lang] ?? LANG_DEFAULT_RULES[lang] ?? "";
  const setLangRules = (lang: string, v: string) => setAllRules((p) => ({ ...p, [lang]: v }));

  const buildCombinedRules = (lang: string) => {
    const parts: string[] = [];
    if (globalRules.trim()) parts.push(`GLOBAL RULES:\n${globalRules.trim()}`);
    const ls = getLangRules(lang);
    if (ls.trim()) parts.push(`${lang.toUpperCase()} SPECIFIC RULES:\n${ls.trim()}`);
    return parts.join("\n\n");
  };

  const handleSaveRules = async () => {
    const toSave = { ...allRules, global: globalRules };
    // Persist to DB
    try {
      await authFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: SETTINGS_KEY, value: JSON.stringify(toSave) }),
      });
    } catch { /* non-fatal — also saved to localStorage below */ }
    // Always save to localStorage as backup
    saveAllRules(toSave);
    setAllRules(toSave);
    setRulesSaved(true);
    setTimeout(() => setRulesSaved(false), 2000);
  };

  return {
    allRules, globalRules, rulesTab, rulesSaved,
    setGlobalRules, setRulesTab, setLangRules,
    getLangRules, buildCombinedRules, handleSaveRules,
  };
}
