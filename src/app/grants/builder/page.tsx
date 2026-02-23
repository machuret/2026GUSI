"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, BookOpen, PenLine } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import {
  ALL_SECTIONS, SectionName, Tone, Length,
  Grant, WritingBrief, SavedDraft,
  wordCount, downloadTxt,
} from "./types";
import LeftPanel from "./LeftPanel";
import DocumentPanel from "./DocumentPanel";
import DraftsTab from "./DraftsTab";

export default function GrantBuilderPage() {
  const searchParams   = useSearchParams();
  const preselectedId  = searchParams.get("grantId") ?? "";

  // ── Data ──────────────────────────────────────────────────────────────────
  const [grants, setGrants]           = useState<Grant[]>([]);
  const [drafts, setDrafts]           = useState<SavedDraft[]>([]);
  const [loadingGrants, setLoadingGrants] = useState(true);

  // ── Config ─────────────────────────────────────────────────────────────────
  const [selectedGrantId, setSelectedGrantId] = useState(preselectedId);
  const [enabledSections, setEnabledSections] = useState<Set<SectionName>>(new Set(ALL_SECTIONS));
  const [tone,   setTone]   = useState<Tone>("first_person");
  const [length, setLength] = useState<Length>("standard");

  // ── Brief ──────────────────────────────────────────────────────────────────
  const [brief,          setBrief]          = useState<WritingBrief | null>(null);
  const [briefLoading,   setBriefLoading]   = useState(false);
  const [briefError,     setBriefError]     = useState<string | null>(null);
  const [briefExpanded,  setBriefExpanded]  = useState(true);

  // ── Generation ─────────────────────────────────────────────────────────────
  const [sections,          setSections]          = useState<Record<string, string>>({});
  const [generating,        setGenerating]        = useState(false);
  const [generatingSection, setGeneratingSection] = useState<string | null>(null);
  const [progress,          setProgress]          = useState(0);
  const [genError,          setGenError]          = useState<string | null>(null);
  const abortRef = useRef(false);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"builder" | "drafts">("builder");
  const [saving,    setSaving]    = useState(false);
  const [saveMsg,   setSaveMsg]   = useState<string | null>(null);
  const [copied,    setCopied]    = useState<string | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedGrant = grants.find((g) => g.id === selectedGrantId) ?? null;
  const enabledList   = ALL_SECTIONS.filter((s) => enabledSections.has(s));
  const doneCount     = enabledList.filter((s) => sections[s]).length;
  const totalWords    = Object.values(sections).reduce((sum, t) => sum + wordCount(t), 0);
  const hasSections   = Object.values(sections).some((v) => v.length > 0);

  // ── Load grants + drafts ───────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      authFetch(`/api/grants?companyId=${DEMO_COMPANY_ID}`).then((r) => r.json()),
      authFetch("/api/grants/drafts").then((r) => r.json()),
    ])
      .then(([gData, dData]) => {
        const all: Grant[] = gData.grants ?? [];
        // Sort: Apply + CRM grants first, then the rest
        all.sort((a, b) => {
          const aPri = (a.decision === "Apply" || a.crmStatus != null) ? 0 : 1;
          const bPri = (b.decision === "Apply" || b.crmStatus != null) ? 0 : 1;
          return aPri - bPri;
        });
        setGrants(all);
        setDrafts(dData.drafts ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingGrants(false));
  }, []);

  // ── Brief ──────────────────────────────────────────────────────────────────
  const runBrief = useCallback(async () => {
    if (!selectedGrantId) return;
    setBriefLoading(true);
    setBriefError(null);
    setBrief(null);
    try {
      const res  = await authFetch("/api/grants/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantId: selectedGrantId, mode: "brief" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Brief failed");
      setBrief(data.brief);
      setBriefExpanded(true);
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : "Brief failed");
    } finally {
      setBriefLoading(false);
    }
  }, [selectedGrantId]);

  // ── Generate all ───────────────────────────────────────────────────────────
  const generateAll = useCallback(async () => {
    if (!selectedGrantId || !brief) return;
    setGenerating(true);
    setGenError(null);
    abortRef.current = false;
    setProgress(0);

    for (let i = 0; i < enabledList.length; i++) {
      if (abortRef.current) break;
      const section = enabledList[i];
      setGeneratingSection(section);
      try {
        const res  = await authFetch("/api/grants/write", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grantId: selectedGrantId, mode: "section", section, brief, tone, length }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Section failed");
        setSections((prev) => ({ ...prev, [section]: data.content }));
      } catch (err) {
        setGenError(`Failed on "${section}": ${err instanceof Error ? err.message : "Error"}`);
        break;
      }
      setProgress(i + 1);
    }

    setGeneratingSection(null);
    setGenerating(false);
  }, [selectedGrantId, brief, enabledList, tone, length]);

  // ── Regen single section ───────────────────────────────────────────────────
  const regenSection = useCallback(async (section: SectionName) => {
    if (!selectedGrantId || !brief) return;
    setGeneratingSection(section);
    try {
      const res  = await authFetch("/api/grants/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantId: selectedGrantId, mode: "section", section, brief, tone, length }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSections((prev) => ({ ...prev, [section]: data.content }));
    } catch (err) {
      setGenError(`Regen failed: ${err instanceof Error ? err.message : "Error"}`);
    } finally {
      setGeneratingSection(null);
    }
  }, [selectedGrantId, brief, tone, length]);

  // ── Save draft ─────────────────────────────────────────────────────────────
  const saveDraft = useCallback(async () => {
    if (!selectedGrant || !hasSections) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res  = await authFetch("/api/grants/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grantId: selectedGrant.id,
          grantName: selectedGrant.name,
          sections, brief, tone, length,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSaveMsg("✓ Draft saved");
      const dRes = await authFetch("/api/grants/drafts");
      setDrafts((await dRes.json()).drafts ?? []);
    } catch (err) {
      setSaveMsg(`⚠ ${err instanceof Error ? err.message : "Save failed"}`);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  }, [selectedGrant, sections, brief, tone, length, hasSections]);

  // ── Load draft ─────────────────────────────────────────────────────────────
  const loadDraft = useCallback(async (draftId: string) => {
    const res  = await authFetch(`/api/grants/drafts/${draftId}`);
    const data = await res.json();
    if (!res.ok || !data.draft) return;
    const d = data.draft;
    setSelectedGrantId(d.grantId);
    setSections(d.sections ?? {});
    setBrief(d.brief ?? null);
    setTone(d.tone ?? "first_person");
    setLength(d.length ?? "standard");
    setActiveTab("builder");
  }, []);

  // ── Delete draft ───────────────────────────────────────────────────────────
  const deleteDraft = useCallback(async (draftId: string) => {
    if (!confirm("Delete this draft?")) return;
    await authFetch(`/api/grants/drafts/${draftId}`, { method: "DELETE" });
    setDrafts((prev) => prev.filter((d) => d.id !== draftId));
  }, []);

  // ── Copy helpers ───────────────────────────────────────────────────────────
  const copySection = useCallback((key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const copyAll = useCallback(() => {
    const text = enabledList
      .filter((s) => sections[s])
      .map((s) => `${s.toUpperCase()}\n${"─".repeat(s.length)}\n\n${sections[s]}`)
      .join("\n\n\n");
    navigator.clipboard.writeText(text);
    setCopied("all");
    setTimeout(() => setCopied(null), 2000);
  }, [enabledList, sections]);

  // ── Select grant (reset state) ─────────────────────────────────────────────
  const handleSelectGrant = useCallback((id: string) => {
    setSelectedGrantId(id);
    setBrief(null);
    setSections({});
    setGenError(null);
    setProgress(0);
  }, []);

  // ── Toggle section ─────────────────────────────────────────────────────────
  const handleToggleSection = useCallback((s: SectionName, on: boolean) => {
    setEnabledSections((prev) => {
      const next = new Set(prev);
      on ? next.add(s) : next.delete(s);
      return next;
    });
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-7xl">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <PenLine className="h-7 w-7 text-brand-600" /> Grant Builder
          </h1>
          <p className="mt-1 text-gray-500">
            Professional grant application writer — 10 sections, 6 data sources, strategic pre-analysis
          </p>
        </div>
        <div className="flex gap-2">
          {(["builder", "drafts"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === t
                  ? "bg-brand-600 text-white"
                  : "border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t === "builder" ? (
                <><FileText className="inline h-4 w-4 mr-1.5 -mt-0.5" />Builder</>
              ) : (
                <><BookOpen className="inline h-4 w-4 mr-1.5 -mt-0.5" />Drafts ({drafts.length})</>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Drafts tab */}
      {activeTab === "drafts" && (
        <DraftsTab
          drafts={drafts}
          onLoad={loadDraft}
          onDelete={deleteDraft}
        />
      )}

      {/* Builder tab */}
      {activeTab === "builder" && (
        <div className="flex gap-6 items-start">
          <LeftPanel
            grants={grants}
            loadingGrants={loadingGrants}
            selectedGrantId={selectedGrantId}
            onSelectGrant={handleSelectGrant}
            enabledSections={enabledSections}
            onToggleSection={handleToggleSection}
            tone={tone}
            onTone={setTone}
            length={length}
            onLength={setLength}
            brief={brief}
            briefLoading={briefLoading}
            briefError={briefError}
            briefExpanded={briefExpanded}
            onToggleBriefExpanded={() => setBriefExpanded((v) => !v)}
            onRunBrief={runBrief}
            sections={sections}
            generating={generating}
            generatingSection={generatingSection}
            progress={progress}
            enabledList={enabledList}
            genError={genError}
            onGenerateAll={generateAll}
            onStopGeneration={() => { abortRef.current = true; }}
            doneCount={doneCount}
          />

          <DocumentPanel
            enabledList={enabledList}
            sections={sections}
            generatingSection={generatingSection}
            generating={generating}
            copied={copied}
            saving={saving}
            saveMsg={saveMsg}
            totalWords={totalWords}
            grantName={selectedGrant?.name ?? "grant"}
            onCopySection={copySection}
            onCopyAll={copyAll}
            onRegenSection={regenSection}
            onEditSection={(s, val) => setSections((prev) => ({ ...prev, [s]: val }))}
            onDownload={() => downloadTxt(selectedGrant?.name ?? "grant", sections, enabledList)}
            onSaveDraft={saveDraft}
            hasSections={hasSections}
          />
        </div>
      )}
    </div>
  );
}
