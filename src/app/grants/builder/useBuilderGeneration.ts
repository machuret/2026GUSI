"use client";

import { useState, useRef, useCallback } from "react";
import { authFetch, edgeFn } from "@/lib/authFetch";
import { ALL_SECTIONS } from "./types";
import type { SectionName, WritingBrief, FunderRequirements, Grant, SavedDraft, Tone, Length } from "./types";

interface Options {
  selectedGrantId: string;
  brief: WritingBrief | null;
  enabledList: SectionName[];
  tone: Tone;
  length: Length;
  sections: Record<string, string>;
  setSections: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setSaved: (v: boolean) => void;
  customInstructions: Record<string, string>;
  requirements: FunderRequirements | null;
  grants: Grant[];
  drafts: SavedDraft[];
  hasSections: boolean;
  setDrafts: React.Dispatch<React.SetStateAction<SavedDraft[]>>;
  setActiveTab: (tab: "builder" | "drafts") => void;
}

const BUDGET_SECTIONS = new Set(["Budget & Budget Narrative"]);

function detectFundingConflict(content: string, suggestedAsk?: string, section?: string): string | null {
  if (!suggestedAsk) return null;
  if (section && BUDGET_SECTIONS.has(section)) return null;
  const askAmounts = suggestedAsk.match(/\$[\d,]+(?:\.?\d+)?(?:\s*[kKmM])?/g) ?? [];
  if (askAmounts.length === 0) return null;
  const normalize = (s: string): number | null => {
    const m = s.replace(/[$,\s]/g, "").match(/^([\d.]+)([kKmM])?$/);
    if (!m) return null;
    let n = parseFloat(m[1]);
    if (isNaN(n)) return null;
    const suf = m[2]?.toLowerCase();
    if (suf === "k") n *= 1000;
    if (suf === "m") n *= 1_000_000;
    return n;
  };
  const askNorms = new Set(askAmounts.map(normalize).filter((n): n is number => n !== null));
  const askNormsArr = Array.from(askNorms);
  const maxAsk = Math.max(...askNormsArr);
  const contentAmounts = content.match(/\$[\d,]+(?:\.?\d+)?(?:\s*[kKmM])?/g) ?? [];
  const conflicts = Array.from(new Set(
    contentAmounts.filter((a) => {
      const n = normalize(a);
      if (n === null) return false;
      const ratio = n / maxAsk;
      if (ratio < 0.25 || ratio > 4) return false;
      return !askNormsArr.some((ref) => Math.abs(n - ref) / ref < 0.001);
    })
  ));
  return conflicts.length > 0
    ? `Contains ${conflicts.join(", ")} — verify against locked ask (${suggestedAsk})`
    : null;
}

export function useBuilderGeneration({
  selectedGrantId, brief, enabledList, tone, length,
  sections, setSections, setSaved, customInstructions, requirements,
  grants, drafts, hasSections, setDrafts, setActiveTab,
}: Options) {
  const [generating,        setGenerating]        = useState(false);
  const [generatingSection, setGeneratingSection] = useState<string | null>(null);
  const [progress,          setProgress]          = useState(0);
  const [genError,          setGenError]          = useState<string | null>(null);
  const [massGenerating,    setMassGenerating]    = useState(false);
  const [massProgress,      setMassProgress]      = useState<{ done: number; total: number; current: string } | null>(null);
  const abortRef     = useRef(false);
  const massAbortRef = useRef(false);
  const sectionsRef  = useRef(sections);
  sectionsRef.current = sections;
  const [fundingConflicts, setFundingConflicts] = useState<Record<string, string>>({});

  const resetGenerationState = useCallback(() => {
    setGenError(null);
    setProgress(0);
    setFundingConflicts({});
  }, []);

  const clearFundingConflict = useCallback((section: string) => {
    setFundingConflicts((p) => { const n = { ...p }; delete n[section]; return n; });
  }, []);

  const stopGeneration     = useCallback(() => { abortRef.current = true; }, []);
  const stopMassGeneration = useCallback(() => { massAbortRef.current = true; }, []);

  // Shared sequential section-generation loop used by generateAll and regenAll
  const runSectionLoop = useCallback(async (
    sectionList: SectionName[],
    seedSections: Record<string, string>,
  ) => {
    const current: Record<string, string> = { ...seedSections };
    for (let i = 0; i < sectionList.length; i++) {
      if (abortRef.current) break;
      const section = sectionList[i];
      setGeneratingSection(section);
      try {
        const prev: Record<string, string> = {};
        for (let j = 0; j < i; j++) {
          const ps = sectionList[j];
          if (current[ps]) prev[ps] = current[ps];
        }
        const ci  = customInstructions[section]?.trim() || undefined;
        const res = await authFetch(edgeFn("grant-write"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grantId: selectedGrantId, mode: "section", section, brief, tone, length, previousSections: prev, customInstructions: ci, requirements: requirements ?? undefined }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Section failed"); }
        if (!res.body) throw new Error("No response body");
        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let content = "";
        while (true) {
          if (abortRef.current) { reader.cancel(); break; }
          const { done, value } = await reader.read();
          if (done) break;
          content += decoder.decode(value, { stream: true });
          setSections((p) => ({ ...p, [section]: content }));
        }
        current[section] = content;
        const conflict = detectFundingConflict(content, (brief as unknown as Record<string, unknown>).suggestedAsk as string | undefined, section);
        if (conflict) setFundingConflicts((p) => ({ ...p, [section]: conflict }));
        else setFundingConflicts((p) => { const n = { ...p }; delete n[section]; return n; });
        setSaved(false);
      } catch (err) {
        setGenError(`Failed on "${section}": ${err instanceof Error ? err.message : "Error"}`);
        setGeneratingSection(null);
        return false;
      }
      setProgress(i + 1);
    }
    setGeneratingSection(null);
    return true;
  }, [selectedGrantId, brief, tone, length, customInstructions, requirements, setSections, setSaved]);

  const generateAll = useCallback(async () => {
    if (!selectedGrantId || !brief) return;
    setGenerating(true);
    setGenError(null);
    abortRef.current = false;
    setProgress(0);
    await runSectionLoop(enabledList, { ...sectionsRef.current });
    setGenerating(false);
  }, [selectedGrantId, brief, enabledList, runSectionLoop]);

  const regenSection = useCallback(async (section: SectionName, note?: string): Promise<boolean> => {
    if (!selectedGrantId || !brief) return false;
    setGeneratingSection(section);
    try {
      const prev: Record<string, string> = {};
      for (const s of enabledList) {
        if (s !== section && sectionsRef.current[s]) prev[s] = sectionsRef.current[s];
      }
      const ci = customInstructions[section]?.trim() || undefined;
      const rn = note?.trim() || undefined;
      const res = await authFetch(edgeFn("grant-write"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantId: selectedGrantId, mode: "section", section, brief, tone, length, previousSections: prev, customInstructions: ci, regenNote: rn, requirements: requirements ?? undefined }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      if (!res.body) throw new Error("No response body");
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let content = "";
      while (true) {
        if (abortRef.current) { reader.cancel(); break; }
        const { done, value } = await reader.read();
        if (done) break;
        content += decoder.decode(value, { stream: true });
        setSections((p) => ({ ...p, [section]: content }));
      }
      const conflict = detectFundingConflict(content, (brief as unknown as Record<string, unknown>).suggestedAsk as string | undefined, section);
      if (conflict) setFundingConflicts((p) => ({ ...p, [section]: conflict }));
      else setFundingConflicts((p) => { const n = { ...p }; delete n[section]; return n; });
      setSaved(false);
      return content.length > 0;
    } catch (err) {
      setGenError(`Regen failed: ${err instanceof Error ? err.message : "Error"}`);
      return false;
    } finally {
      setGeneratingSection(null);
    }
  }, [selectedGrantId, brief, tone, length, enabledList, customInstructions, requirements, setSections, setSaved]);

  const regenAll = useCallback(async () => {
    if (!selectedGrantId || !brief) return;
    if (!confirm("Regenerate ALL sections with the current custom instructions?\n\nA snapshot of the current draft will be saved first so you can restore it.")) return;

    const existingDraft = drafts.find((d) => d.grantId === selectedGrantId);
    if (existingDraft && hasSections) {
      try {
        await authFetch("/api/grants/draft-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftId: existingDraft.id, grantId: existingDraft.grantId,
            grantName: existingDraft.grantName, sections: sectionsRef.current, brief, tone, length,
            label: "Before Regen All",
          }),
        });
      } catch { /* non-critical */ }
    }

    setSections({});
    setProgress(0);
    setGenError(null);
    setGenerating(true);
    abortRef.current = false;
    await runSectionLoop(enabledList, {});
    setGenerating(false);
  }, [selectedGrantId, brief, enabledList, tone, length, drafts, hasSections, setSections, runSectionLoop]);

  const massGenerateCRM = useCallback(async () => {
    const allCrmGrants = grants.filter((g) => !!g.crmStatus);
    if (allCrmGrants.length === 0) { alert("No CRM grants found. Add grants to CRM first."); return; }
    const draftedGrantIds = new Set(drafts.map((d) => d.grantId));
    const crmGrants   = allCrmGrants.filter((g) => !draftedGrantIds.has(g.id));
    const alreadyBuilt = allCrmGrants.length - crmGrants.length;
    if (crmGrants.length === 0) {
      alert(`All ${allCrmGrants.length} CRM grant${allCrmGrants.length !== 1 ? "s" : ""} already have a saved draft. Nothing to generate.`);
      return;
    }
    const skipNote = alreadyBuilt > 0 ? ` (${alreadyBuilt} already built — skipped)` : "";
    if (!confirm(`Generate full applications for ${crmGrants.length} CRM grant${crmGrants.length !== 1 ? "s" : ""}${skipNote}? This will run sequentially and may take several minutes.`)) return;

    massAbortRef.current = false;
    setMassGenerating(true);
    setMassProgress({ done: 0, total: crmGrants.length, current: "" });
    const currentTone   = tone;
    const currentLength = length;

    for (let i = 0; i < crmGrants.length; i++) {
      if (massAbortRef.current) break;
      const grant = crmGrants[i];
      setMassProgress({ done: i, total: crmGrants.length, current: grant.name });
      try {
        let grantBrief: WritingBrief | null = null;
        if (grant.aiBrief && typeof grant.aiBrief === "object" &&
            "funderPriorities" in grant.aiBrief &&
            Array.isArray((grant.aiBrief as Record<string, unknown>).funderPriorities)) {
          grantBrief = grant.aiBrief as unknown as WritingBrief;
        }
        if (!grantBrief) {
          const bRes  = await authFetch(edgeFn("grant-write"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ grantId: grant.id, mode: "brief" }),
          });
          const bData = await bRes.json();
          if (!bRes.ok || !bData.brief) continue;
          grantBrief = bData.brief as WritingBrief;
        }
        const grantReqs = (grant as Record<string, unknown>).aiRequirements as FunderRequirements | null | undefined;
        const generatedSections: Record<string, string> = {};
        for (const section of ALL_SECTIONS) {
          if (massAbortRef.current) break;
          try {
            const sRes = await authFetch(edgeFn("grant-write"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ grantId: grant.id, mode: "section", section, brief: grantBrief, tone: currentTone, length: currentLength, previousSections: generatedSections, requirements: grantReqs ?? undefined }),
            });
            if (sRes.ok && sRes.body) {
              const sReader  = sRes.body.getReader();
              const sDecoder = new TextDecoder();
              let sContent = "";
              while (true) {
                if (massAbortRef.current) { sReader.cancel(); break; }
                const { done: sd, value: sv } = await sReader.read();
                if (sd) break;
                sContent += sDecoder.decode(sv, { stream: true });
              }
              if (sContent) generatedSections[section] = sContent;
            }
          } catch { /* skip section */ }
        }
        if (Object.keys(generatedSections).length > 0) {
          await authFetch("/api/grants/drafts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ grantId: grant.id, grantName: grant.name, sections: generatedSections, brief: grantBrief, tone: currentTone, length: currentLength }),
          });
        }
      } catch { /* skip grant */ }
    }
    const dRes = await authFetch("/api/grants/drafts");
    setDrafts((await dRes.json()).drafts ?? []);
    setMassGenerating(false);
    setMassProgress(null);
    setActiveTab("drafts");
  }, [grants, drafts, tone, length, setDrafts, setActiveTab]);

  return {
    generating, generatingSection, progress, genError,
    massGenerating, massProgress,
    generateAll, regenSection, regenAll, massGenerateCRM,
    resetGenerationState, stopGeneration, stopMassGeneration,
    fundingConflicts, clearFundingConflict,
  };
}
