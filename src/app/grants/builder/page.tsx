"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { FileText, BookOpen, PenLine, Trophy, ShieldCheck, Sparkles, Loader2, X } from "lucide-react";
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
  const [customInstructions, setCustomInstructions] = useState<Record<string, string>>({});

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
  const [saving,       setSaving]       = useState(false);
  const [saveMsg,      setSaveMsg]      = useState<string | null>(null);
  const [copied,       setCopied]       = useState<string | null>(null);
  const [exportingDoc, setExportingDoc] = useState(false);
  const [exportingIds, setExportingIds] = useState<Set<string>>(new Set());
  const [massGenerating, setMassGenerating] = useState(false);
  const [massProgress, setMassProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const massAbortRef = useRef(false);

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedGrant = grants.find((g) => g.id === selectedGrantId) ?? null;
  const enabledList   = ALL_SECTIONS.filter((s) => enabledSections.has(s));
  const doneCount     = enabledList.filter((s) => sections[s]).length;
  const totalWords    = Object.values(sections).reduce((sum, t) => sum + wordCount(t), 0);
  const hasSections   = Object.values(sections).some((v) => v.length > 0);

  // ── Unsaved changes warning ────────────────────────────────────────────────
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!hasSections || saved) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasSections, saved]);

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
      // Check if this grant already has a pre-generated brief
      const grant = grants.find((g) => g.id === selectedGrantId);
      if (grant?.aiBrief && typeof grant.aiBrief === "object") {
        setBrief(grant.aiBrief as unknown as WritingBrief);
        setBriefExpanded(true);
        setBriefLoading(false);
        return;
      }

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
  }, [selectedGrantId, grants]);

  // ── Generate all ───────────────────────────────────────────────────────────
  const generateAll = useCallback(async () => {
    if (!selectedGrantId || !brief) return;
    setGenerating(true);
    setGenError(null);
    abortRef.current = false;
    setProgress(0);
    // Track sections as they're generated for coherence
    const currentSections: Record<string, string> = { ...sections };

    for (let i = 0; i < enabledList.length; i++) {
      if (abortRef.current) break;
      const section = enabledList[i];
      setGeneratingSection(section);
      try {
        // Build previousSections from what's already been generated
        const prev: Record<string, string> = {};
        for (let j = 0; j < i; j++) {
          const prevSection = enabledList[j];
          const prevText = currentSections[prevSection];
          if (prevText) prev[prevSection] = prevText;
        }
        const ci = customInstructions[section]?.trim() || undefined;
        const res  = await authFetch("/api/grants/write", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grantId: selectedGrantId, mode: "section", section, brief, tone, length, previousSections: prev, customInstructions: ci }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Section failed");
        const content = data.content;
        currentSections[section] = content;
        setSections((p) => ({ ...p, [section]: content }));
        setSaved(false);
      } catch (err) {
        setGenError(`Failed on "${section}": ${err instanceof Error ? err.message : "Error"}`);
        break;
      }
      setProgress(i + 1);
    }

    setGeneratingSection(null);
    setGenerating(false);
  }, [selectedGrantId, brief, enabledList, tone, length, customInstructions]);

  // ── Regen single section ───────────────────────────────────────────────────
  const regenSection = useCallback(async (section: SectionName) => {
    if (!selectedGrantId || !brief) return;
    setGeneratingSection(section);
    try {
      // Pass all other completed sections as context for coherence
      const prev: Record<string, string> = {};
      for (const s of enabledList) {
        if (s !== section && sections[s]) prev[s] = sections[s];
      }
      const ci = customInstructions[section]?.trim() || undefined;
      const res  = await authFetch("/api/grants/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantId: selectedGrantId, mode: "section", section, brief, tone, length, previousSections: prev, customInstructions: ci }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSections((prev) => ({ ...prev, [section]: data.content }));
      setSaved(false);
    } catch (err) {
      setGenError(`Regen failed: ${err instanceof Error ? err.message : "Error"}`);
    } finally {
      setGeneratingSection(null);
    }
  }, [selectedGrantId, brief, tone, length, sections, enabledList, customInstructions]);

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
      setSaved(true);
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
    setCustomInstructions({});
    setSaved(true);
    setActiveTab("builder");
  }, []);

  // ── Delete draft ───────────────────────────────────────────────────────────
  const deleteDraft = useCallback(async (draftId: string) => {
    if (!confirm("Delete this draft?")) return;
    await authFetch(`/api/grants/drafts/${draftId}`, { method: "DELETE" });
    setDrafts((prev) => prev.filter((d) => d.id !== draftId));
  }, []);

  // ── Mass generate all CRM grants ─────────────────────────────────────────────
  const massGenerateCRM = useCallback(async () => {
    const crmGrants = grants.filter(g => !!g.crmStatus);
    if (crmGrants.length === 0) { alert("No CRM grants found. Add grants to CRM first."); return; }
    if (!confirm(`Generate full applications for all ${crmGrants.length} CRM grant${crmGrants.length !== 1 ? "s" : ""}? This will run sequentially and may take several minutes.`)) return;
    massAbortRef.current = false;
    setMassGenerating(true);
    setMassProgress({ done: 0, total: crmGrants.length, current: "" });
    const currentTone = tone;
    const currentLength = length;
    for (let i = 0; i < crmGrants.length; i++) {
      if (massAbortRef.current) break;
      const grant = crmGrants[i];
      setMassProgress({ done: i, total: crmGrants.length, current: grant.name });
      try {
        // 1. Get brief
        let brief: WritingBrief | null = null;
        if (grant.aiBrief && typeof grant.aiBrief === "object" &&
            "funderPriorities" in grant.aiBrief && Array.isArray((grant.aiBrief as Record<string,unknown>).funderPriorities)) {
          brief = grant.aiBrief as unknown as WritingBrief;
        }
        if (!brief) {
          const bRes = await authFetch("/api/grants/write", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ grantId: grant.id, mode: "brief" }),
          });
          const bData = await bRes.json();
          if (!bRes.ok || !bData.brief) continue;
          brief = bData.brief as WritingBrief;
        }
        // 2. Generate each section
        const generatedSections: Record<string, string> = {};
        for (const section of ALL_SECTIONS) {
          if (massAbortRef.current) break;
          try {
            const sRes = await authFetch("/api/grants/write", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ grantId: grant.id, mode: "section", section, brief, tone: currentTone, length: currentLength, previousSections: generatedSections }),
            });
            const sData = await sRes.json();
            if (sRes.ok && sData.content) generatedSections[section] = sData.content;
          } catch { /* skip section */ }
        }
        // 3. Save draft
        if (Object.keys(generatedSections).length > 0) {
          await authFetch("/api/grants/drafts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ grantId: grant.id, grantName: grant.name, sections: generatedSections, brief, tone: currentTone, length: currentLength }),
          });
        }
      } catch { /* skip grant */ }
    }
    // Refresh drafts list
    const dRes = await authFetch("/api/grants/drafts");
    setDrafts((await dRes.json()).drafts ?? []);
    setMassGenerating(false);
    setMassProgress(null);
    setActiveTab("drafts");
  }, [grants, tone, length]);

  // ── Bulk export drafts to Google Docs ────────────────────────────────────────
  const bulkExportDrafts = useCallback(async (ids: string[]) => {
    setExportingIds(new Set(ids));
    const results: { name: string; url: string }[] = [];
    for (const id of ids) {
      try {
        const res  = await authFetch(`/api/grants/drafts/${id}`);
        const data = await res.json();
        if (!res.ok || !data.draft) continue;
        const d = data.draft;
        const expRes  = await authFetch("/api/grants/export-doc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grantName: d.grantName, sections: d.sections ?? {}, enabledList: Object.keys(d.sections ?? {}) }),
        });
        const expData = await expRes.json();
        if (expRes.ok && expData.url) results.push({ name: d.grantName, url: expData.url });
      } catch { /* skip */ }
    }
    setExportingIds(new Set());
    if (results.length === 0) { alert("Export failed — check Google service account configuration."); return; }
    if (results.length === 1) {
      // Single export — safe to open directly (user-initiated)
      window.open(results[0].url, "_blank", "noopener,noreferrer");
    } else {
      // Multiple exports — browsers block sequential window.open calls not tied to gesture.
      // Show a summary with clickable links instead.
      const links = results.map(r => `${r.name}: ${r.url}`).join("\n");
      alert(`Exported ${results.length} grant docs to Google Docs:\n\n${links}\n\nCopy links above to open each doc.`);
    }
  }, []);

  // ── Export to Google Docs ───────────────────────────────────────────────────
  const exportDoc = useCallback(async () => {
    if (!hasSections) return;
    setExportingDoc(true);
    try {
      const res  = await authFetch("/api/grants/export-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grantName: selectedGrant?.name ?? "Grant Application",
          sections,
          enabledList,
        }),
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
    setCustomInstructions({});
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
        <div className="flex gap-2 flex-wrap">
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
          <button
            onClick={massGenerateCRM}
            disabled={massGenerating || loadingGrants}
            title="Generate full applications for all CRM grants"
            className="flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
          >
            {massGenerating ? <Loader2 className="inline h-4 w-4 animate-spin" /> : <Sparkles className="inline h-4 w-4" />}
            {massGenerating ? `Generating… (${massProgress?.done ?? 0}/${massProgress?.total ?? 0})` : "Generate All CRM"}
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
      {massProgress && (
        <div className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-indigo-700">
            <span>Generating CRM grants — {massProgress.done} / {massProgress.total} complete{massProgress.current ? ` · Now: ${massProgress.current}` : ""}</span>
            <div className="flex items-center gap-2">
              <span>{Math.round((massProgress.done / massProgress.total) * 100)}%</span>
              <button
                onClick={() => { massAbortRef.current = true; }}
                title="Cancel generation"
                className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-indigo-600 hover:bg-indigo-200"
              >
                <X className="h-3 w-3" /> Cancel
              </button>
            </div>
          </div>
          <div className="h-2 w-full rounded-full bg-indigo-100 overflow-hidden">
            <div className="h-full rounded-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${(massProgress.done / massProgress.total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Drafts tab */}
      {activeTab === "drafts" && (
        <DraftsTab
          drafts={drafts}
          onLoad={loadDraft}
          onDelete={deleteDraft}
          onBulkExport={bulkExportDrafts}
          exportingIds={exportingIds}
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
            customInstructions={customInstructions}
            onCustomInstructions={setCustomInstructions}
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
            onEditSection={(s, val) => { setSections((prev) => ({ ...prev, [s]: val })); setSaved(false); }}
            onDownload={() => downloadTxt(selectedGrant?.name ?? "grant", sections, enabledList)}
            onSaveDraft={saveDraft}
            onExportDoc={exportDoc}
            exportingDoc={exportingDoc}
            hasSections={hasSections}
          />
        </div>
      )}
    </div>
  );
}
