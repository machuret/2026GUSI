"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { FileText, BookOpen, PenLine, Trophy, ShieldCheck, Sparkles, Loader2, X } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { ALL_SECTIONS, SectionName, Tone, Length, Grant, SavedDraft, wordCount, downloadTxt } from "./types";
import LeftPanel from "./LeftPanel";
import DocumentPanel from "./DocumentPanel";
import DraftsTab from "./DraftsTab";
import { useBuilderBrief } from "./useBuilderBrief";
import { useBuilderGeneration } from "./useBuilderGeneration";
import { useBuilderDrafts } from "./useBuilderDrafts";
import { useBuilderValidation } from "./useBuilderValidation";
import { ValidationWarnings } from "./ValidationWarnings";

export default function GrantBuilderPage() {
  const searchParams  = useSearchParams();
  const preselectedId = searchParams.get("grantId") ?? "";

  // ── Shared state ────────────────────────────────────────────────────────────
  const [grants,         setGrants]         = useState<Grant[]>([]);
  const [drafts,         setDrafts]         = useState<SavedDraft[]>([]);
  const [loadingGrants,  setLoadingGrants]  = useState(true);
  const [selectedGrantId, setSelectedGrantId] = useState(preselectedId);
  const [enabledSections, setEnabledSections] = useState<Set<SectionName>>(new Set(ALL_SECTIONS));
  const [tone,   setTone]   = useState<Tone>("first_person");
  const [length, setLength] = useState<Length>("standard");
  const [customInstructions, setCustomInstructions] = useState<Record<string, string>>({});
  const [sections,  setSections]  = useState<Record<string, string>>({});
  const [saved,     setSaved]     = useState(false);
  const [activeTab, setActiveTab] = useState<"builder" | "drafts">("builder");
  const [copied,    setCopied]    = useState<string | null>(null);
  const [validationAcknowledged, setValidationAcknowledged] = useState(false);

  // ── Derived (memoized to avoid redundant recomputation on every render) ──────
  const selectedGrant = useMemo(() => grants.find((g) => g.id === selectedGrantId) ?? null, [grants, selectedGrantId]);
  const enabledList   = useMemo(() => ALL_SECTIONS.filter((s) => enabledSections.has(s)), [enabledSections]);
  const hasSections   = useMemo(() => Object.values(sections).some((v) => v.length > 0), [sections]);
  const doneCount     = useMemo(() => enabledList.filter((s) => sections[s]).length, [enabledList, sections]);
  const totalWords    = useMemo(() => Object.values(sections).reduce((sum, t) => sum + wordCount(t), 0), [sections]);

  // ── Unsaved-changes warning ──────────────────────────────────────────────────
  useEffect(() => {
    if (!hasSections || saved) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasSections, saved]);

  // ── Load grants + drafts ─────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      authFetch(`/api/grants?companyId=${DEMO_COMPANY_ID}`).then((r) => r.json()),
      authFetch("/api/grants/drafts").then((r) => r.json()),
    ])
      .then(([gData, dData]) => {
        const all: Grant[] = gData.grants ?? [];
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

  // ── Feature hooks ────────────────────────────────────────────────────────────
  const brief = useBuilderBrief({ selectedGrantId, grants });

  const validation = useBuilderValidation({ grant: selectedGrant });

  const generation = useBuilderGeneration({
    selectedGrantId, brief: brief.brief, enabledList, tone, length,
    sections, setSections, setSaved, customInstructions,
    requirements: brief.requirements, grants, drafts, hasSections,
    setDrafts, setActiveTab,
  });

  const draftOps = useBuilderDrafts({
    selectedGrant, sections, setSections, brief: brief.brief, setBrief: brief.setBrief,
    tone, setTone, length, setLength, hasSections,
    drafts, setDrafts, enabledList,
    setSelectedGrantId, setCustomInstructions, setSaved, setActiveTab,
    resetGenerationState: generation.resetGenerationState,
  });

  // ── Simple handlers ──────────────────────────────────────────────────────────
  const handleSelectGrant = useCallback((id: string) => {
    setSelectedGrantId(id);
    brief.setBrief(null);
    brief.clearBriefError();
    setSections({});
    setCustomInstructions({});
    generation.resetGenerationState();
    setValidationAcknowledged(false);
  }, [brief.setBrief, brief.clearBriefError, generation.resetGenerationState]);

  const handleToggleSection = useCallback((s: SectionName, on: boolean) => {
    setEnabledSections((prev) => {
      const next = new Set(prev);
      on ? next.add(s) : next.delete(s);
      return next;
    });
  }, []);

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

  // ── Mass-gen button label ────────────────────────────────────────────────────
  const massGenLabel = useMemo(() => {
    const allCrm     = grants.filter((g) => !!g.crmStatus).length;
    const draftedIds = new Set(drafts.map((d) => d.grantId));
    const pending    = grants.filter((g) => !!g.crmStatus && !draftedIds.has(g.id)).length;
    return pending === 0
      ? `All CRM Built (${allCrm})`
      : `Build CRM (${pending} pending${allCrm - pending > 0 ? `, ${allCrm - pending} done` : ""})`;
  }, [grants, drafts]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <PenLine className="h-7 w-7 text-brand-600" /> Grant Builder
          </h1>
          <p className="mt-1 text-gray-500">
            Professional grant application writer — 10 sections, 6 data sources, strategic pre-analysis
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["builder", "drafts"] as const).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === t ? "bg-brand-600 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t === "builder"
                ? <><FileText className="inline h-4 w-4 mr-1.5 -mt-0.5" />Builder</>
                : <><BookOpen className="inline h-4 w-4 mr-1.5 -mt-0.5" />Drafts ({drafts.length})</>}
            </button>
          ))}
          <button
            onClick={generation.massGenerateCRM}
            disabled={generation.massGenerating || loadingGrants}
            title="Generate full applications for all CRM grants"
            className="flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
          >
            {generation.massGenerating ? <Loader2 className="inline h-4 w-4 animate-spin" /> : <Sparkles className="inline h-4 w-4" />}
            {generation.massGenerating
              ? `Generating… (${generation.massProgress?.done ?? 0}/${generation.massProgress?.total ?? 0})`
              : massGenLabel}
          </button>
          <Link href="/grants/examples" className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors">
            <Trophy className="inline h-4 w-4 mr-1.5 -mt-0.5" />Examples
          </Link>
          <Link href="/grants/auditor" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors">
            <ShieldCheck className="inline h-4 w-4 mr-1.5 -mt-0.5" />Auditor
          </Link>
        </div>
      </div>

      {/* Mass generation progress bar */}
      {generation.massProgress && (
        <div className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-indigo-700">
            <span>
              Generating CRM grants — {generation.massProgress.done} / {generation.massProgress.total} complete
              {generation.massProgress.current ? ` · Now: ${generation.massProgress.current}` : ""}
            </span>
            <div className="flex items-center gap-2">
              <span>{Math.round((generation.massProgress.done / generation.massProgress.total) * 100)}%</span>
              <button onClick={generation.stopMassGeneration} title="Cancel generation"
                className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-indigo-600 hover:bg-indigo-200"
              >
                <X className="h-3 w-3" /> Cancel
              </button>
            </div>
          </div>
          <div className="h-2 w-full rounded-full bg-indigo-100 overflow-hidden">
            <div className="h-full rounded-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${(generation.massProgress.done / generation.massProgress.total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Drafts tab */}
      {activeTab === "drafts" && (
        <DraftsTab
          drafts={drafts}
          onLoad={draftOps.loadDraft}
          onDelete={draftOps.deleteDraft}
          onDeleteNoConfirm={draftOps.deleteDraftNoConfirm}
          onRedo={draftOps.redoDraft}
          onBulkExport={draftOps.bulkExportDrafts}
          exportingIds={draftOps.exportingIds}
          onRestoreSnapshot={draftOps.restoreSnapshot}
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
            brief={brief.brief}
            briefLoading={brief.briefLoading}
            briefError={brief.briefError}
            briefExpanded={brief.briefExpanded}
            onToggleBriefExpanded={() => brief.setBriefExpanded((v) => !v)}
            onRunBrief={brief.runBrief}
            sections={sections}
            generating={generation.generating}
            generatingSection={generation.generatingSection}
            progress={generation.progress}
            enabledList={enabledList}
            genError={generation.genError}
            onGenerateAll={generation.generateAll}
            onStopGeneration={generation.stopGeneration}
            doneCount={doneCount}
            customInstructions={customInstructions}
            onCustomInstructions={setCustomInstructions}
            requirements={brief.requirements}
            requirementsLoading={brief.requirementsLoading}
            checkedCriteria={brief.checkedCriteria}
            onToggleCriteria={(c) => brief.setCheckedCriteria((prev) => {
              const next = new Set(prev);
              next.has(c) ? next.delete(c) : next.add(c);
              return next;
            })}
            validation={validation}
            validationAcknowledged={validationAcknowledged}
            onAcknowledgeValidation={() => setValidationAcknowledged(true)}
          />
          <DocumentPanel
            enabledList={enabledList}
            sections={sections}
            generatingSection={generation.generatingSection}
            generating={generation.generating}
            copied={copied}
            saving={draftOps.saving}
            saveMsg={draftOps.saveMsg}
            totalWords={totalWords}
            onCopySection={copySection}
            onCopyAll={copyAll}
            onRegenSection={generation.regenSection}
            onRegenAll={generation.regenAll}
            onEditSection={(s, val) => { setSections((prev) => ({ ...prev, [s]: val })); setSaved(false); }}
            onDownload={() => downloadTxt(selectedGrant?.name ?? "grant", sections, enabledList)}
            onDownloadPdf={() => draftOps.handleDownloadPdf(selectedGrant?.name ?? "grant")}
            exportingPdf={draftOps.exportingPdf}
            onSaveDraft={draftOps.saveDraft}
            onExportDoc={draftOps.exportDoc}
            exportingDoc={draftOps.exportingDoc}
            hasSections={hasSections}
            requirements={brief.requirements}
            checkedCriteria={brief.checkedCriteria}
            customInstructions={customInstructions}
            onCustomInstructions={setCustomInstructions}
            fundingConflicts={generation.fundingConflicts}
            onClearFundingConflict={generation.clearFundingConflict}
          />
        </div>
      )}
    </div>
  );
}
