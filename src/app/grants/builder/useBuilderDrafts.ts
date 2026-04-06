"use client";

import { useState, useCallback } from "react";
import { authFetch, edgeFn } from "@/lib/authFetch";
import type { Grant, SavedDraft, WritingBrief, Tone, Length, SectionName } from "./types";
import { downloadTxt, downloadPdf } from "./types";

interface Options {
  selectedGrant: Grant | null;
  sections: Record<string, string>;
  setSections: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  brief: WritingBrief | null;
  setBrief: (b: WritingBrief | null) => void;
  tone: Tone;
  setTone: (t: Tone) => void;
  length: Length;
  setLength: (l: Length) => void;
  hasSections: boolean;
  drafts: SavedDraft[];
  setDrafts: React.Dispatch<React.SetStateAction<SavedDraft[]>>;
  enabledList: SectionName[];
  setSelectedGrantId: (id: string) => void;
  setCustomInstructions: (ci: Record<string, string>) => void;
  setSaved: (v: boolean) => void;
  setActiveTab: (tab: "builder" | "drafts") => void;
  resetGenerationState: () => void;
}

export function useBuilderDrafts({
  selectedGrant, sections, setSections, brief, setBrief,
  tone, setTone, length, setLength, hasSections,
  drafts, setDrafts, enabledList,
  setSelectedGrantId, setCustomInstructions, setSaved, setActiveTab,
  resetGenerationState,
}: Options) {
  const [saving,       setSaving]       = useState(false);
  const [saveMsg,      setSaveMsg]      = useState<string | null>(null);
  const [exportingDoc, setExportingDoc] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingIds, setExportingIds] = useState<Set<string>>(new Set());

  const saveDraft = useCallback(async () => {
    if (!selectedGrant || !hasSections) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const existingDraft = drafts.find((d) => d.grantId === selectedGrant.id);
      if (existingDraft) {
        try {
          await authFetch("/api/grants/draft-history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              draftId:   existingDraft.id,
              grantId:   existingDraft.grantId,
              grantName: existingDraft.grantName,
              sections:  existingDraft.sections ?? sections,
              brief:     existingDraft.brief    ?? brief,
              tone:      existingDraft.tone     ?? tone,
              length:    existingDraft.length   ?? length,
              label:     new Date().toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
            }),
          });
        } catch { /* non-critical */ }
      }
      const res  = await authFetch("/api/grants/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantId: selectedGrant.id, grantName: selectedGrant.name, sections, brief, tone, length }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSaveMsg("✓ Draft saved");
      setSaved(true);
      try {
        await authFetch(`${edgeFn("grant-crud")}?id=${selectedGrant.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ crmStatus: "Built" }),
        });
      } catch { /* non-critical */ }
      const dRes = await authFetch("/api/grants/drafts");
      setDrafts((await dRes.json()).drafts ?? []);
    } catch (err) {
      setSaveMsg(`⚠ ${err instanceof Error ? err.message : "Save failed"}`);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  }, [selectedGrant, sections, brief, tone, length, hasSections, drafts, setDrafts, setSaved]);

  const loadDraft = useCallback(async (draftId: string) => {
    const res  = await authFetch(`/api/grants/drafts/${draftId}`);
    const data = await res.json();
    if (!res.ok || !data.draft) { alert("Failed to load draft — please try again."); return; }
    const d = data.draft;
    setSelectedGrantId(d.grantId);
    setSections(d.sections ?? {});
    setBrief(d.brief ?? null);
    setTone(d.tone   ?? "first_person");
    setLength(d.length ?? "standard");
    setCustomInstructions({});
    setSaved(true);
    setActiveTab("builder");
  }, [setSelectedGrantId, setSections, setBrief, setTone, setLength, setCustomInstructions, setSaved, setActiveTab]);

  const restoreSnapshot = useCallback((snapshot: {
    sections: Record<string, string>;
    brief: Record<string, unknown> | null;
    tone: string;
    length: string;
    grantId: string;
  }) => {
    setSelectedGrantId(snapshot.grantId);
    setSections(snapshot.sections);
    setBrief(snapshot.brief as WritingBrief | null);
    setTone((snapshot.tone   as Tone)   ?? "first_person");
    setLength((snapshot.length as Length) ?? "standard");
    setSaved(false);
    setActiveTab("builder");
  }, [setSelectedGrantId, setSections, setBrief, setTone, setLength, setSaved, setActiveTab]);

  const deleteDraft = useCallback(async (draftId: string) => {
    if (!confirm("Delete this draft?")) return;
    const res = await authFetch(`/api/grants/drafts/${draftId}`, { method: "DELETE" });
    if (!res.ok) { alert("Delete failed — please try again."); return; }
    setDrafts((prev) => prev.filter((d) => d.id !== draftId));
  }, [setDrafts]);

  const deleteDraftNoConfirm = useCallback(async (draftId: string) => {
    const res = await authFetch(`/api/grants/drafts/${draftId}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");
    setDrafts((prev) => prev.filter((d) => d.id !== draftId));
  }, [setDrafts]);

  const redoDraft = useCallback(async (draft: SavedDraft) => {
    if (!confirm(`Re-do "${draft.grantName}" from scratch?\n\nThis will delete the current draft and let you regenerate it.`)) return;
    const res = await authFetch(`/api/grants/drafts/${draft.id}`, { method: "DELETE" });
    if (!res.ok) { alert("Delete failed — please try again."); return; }
    setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
    setSelectedGrantId(draft.grantId);
    setSections({});
    setBrief(null);
    setCustomInstructions({});
    resetGenerationState();
    setSaved(false);
    setActiveTab("builder");
  }, [setDrafts, setSelectedGrantId, setSections, setBrief, setCustomInstructions, resetGenerationState, setSaved, setActiveTab]);

  const exportDoc = useCallback(async () => {
    if (!hasSections) return;
    setExportingDoc(true);
    try {
      const res  = await authFetch("/api/grants/export-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantName: selectedGrant?.name ?? "Grant Application", sections, enabledList }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Export failed");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      alert(`Export failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setExportingDoc(false);
    }
  }, [hasSections, selectedGrant, sections, enabledList]);

  const bulkExportDrafts = useCallback(async (ids: string[]) => {
    setExportingIds(new Set(ids));
    const settled = await Promise.allSettled(
      ids.map(async (id) => {
        const res  = await authFetch(`/api/grants/drafts/${id}`);
        const data = await res.json();
        if (!res.ok || !data.draft) throw new Error("Draft not found");
        const d       = data.draft;
        const expRes  = await authFetch("/api/grants/export-doc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grantName: d.grantName, sections: d.sections ?? {}, enabledList: Object.keys(d.sections ?? {}) }),
        });
        const expData = await expRes.json();
        if (!expRes.ok || !expData.url) throw new Error("Export failed");
        return { name: d.grantName as string, url: expData.url as string };
      }),
    );
    setExportingIds(new Set());
    const results = settled.filter((r): r is PromiseFulfilledResult<{ name: string; url: string }> => r.status === "fulfilled").map((r) => r.value);
    if (results.length === 0) { alert("Export failed — check Google service account configuration."); return; }
    if (results.length === 1) {
      window.open(results[0].url, "_blank", "noopener,noreferrer");
    } else {
      const links = results.map((r) => `${r.name}: ${r.url}`).join("\n");
      alert(`Exported ${results.length} grant docs to Google Docs:\n\n${links}\n\nCopy links above to open each doc.`);
    }
  }, []);

  const handleDownloadPdf = useCallback(async (grantName: string) => {
    setExportingPdf(true);
    try { await downloadPdf(grantName, sections, enabledList); }
    catch (err) { alert(`PDF failed: ${err instanceof Error ? err.message : "Unknown error"}`); }
    finally { setExportingPdf(false); }
  }, [sections, enabledList]);

  return {
    saving, saveMsg,
    exportingDoc, exportingPdf, exportingIds,
    saveDraft, loadDraft, restoreSnapshot, deleteDraft, deleteDraftNoConfirm, redoDraft,
    exportDoc, bulkExportDrafts, handleDownloadPdf,
  };
}
