"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2, Copy, RefreshCw, CheckCircle, Download, Save, FileUp, FileDown, RotateCcw, ShieldCheck, ChevronsRight, ClipboardList, MessageSquarePlus, X } from "lucide-react";
import { SECTION_META, SectionName, wordCount, FunderRequirements } from "./types";

interface Props {
  enabledList: readonly SectionName[];
  sections: Record<string, string>;
  generatingSection: string | null;
  generating: boolean;
  copied: string | null;
  saving: boolean;
  saveMsg: string | null;
  totalWords: number;
  onCopySection: (key: string, text: string) => void;
  onCopyAll: () => void;
  onRegenSection: (s: SectionName, note?: string) => Promise<boolean>;
  onRegenAll: () => void;
  onEditSection: (s: SectionName, value: string) => void;
  onDownload: () => void;
  onDownloadPdf: () => void;
  exportingPdf: boolean;
  onSaveDraft: () => void;
  onExportDoc: () => void;
  exportingDoc: boolean;
  hasSections: boolean;
  requirements: FunderRequirements | null;
  checkedCriteria: Set<string>;
}

export default function DocumentPanel({
  enabledList, sections, generatingSection, generating,
  copied, saving, saveMsg, totalWords,
  onCopySection, onCopyAll, onRegenSection, onRegenAll, onEditSection,
  onDownload, onDownloadPdf, exportingPdf, onSaveDraft, onExportDoc, exportingDoc, hasSections,
  requirements, checkedCriteria,
}: Props) {
  const [regenNotes, setRegenNotes] = useState<Partial<Record<SectionName, string>>>({});
  const [openNotes, setOpenNotes] = useState<Set<SectionName>>(new Set());

  const toggleNote = (s: SectionName) => {
    setOpenNotes((prev) => {
      const next = new Set(prev);
      if (next.has(s)) { next.delete(s); } else { next.add(s); }
      return next;
    });
  };

  const handleRegen = async (s: SectionName) => {
    const note = regenNotes[s]?.trim();
    const ok = await onRegenSection(s, note || undefined);
    // Clear note and collapse only on success — preserve on failure so user can retry
    if (ok) {
      setRegenNotes((prev) => ({ ...prev, [s]: "" }));
      setOpenNotes((prev) => { const next = new Set(prev); next.delete(s); return next; });
    }
  };

  const totalCriteria = requirements
    ? requirements.criteria.length + requirements.mandatoryRequirements.length
    : 0;
  const coveredCount = totalCriteria > 0 ? checkedCriteria.size : 0;
  const coveragePct  = totalCriteria > 0 ? Math.round((coveredCount / totalCriteria) * 100) : 0;
  if (!hasSections && !generating) {
    return (
      <div className="flex-1 min-w-0 rounded-xl border border-dashed border-gray-300 py-32 text-center">
        <Sparkles className="mx-auto h-10 w-10 text-gray-200 mb-3" />
        <p className="text-gray-400 text-sm font-medium">Your grant application will appear here</p>
        <p className="text-gray-300 text-xs mt-1">
          Select a grant → Run Pre-Analysis → Generate Application
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-4">
      {/* Toolbar */}
      {hasSections && (
        <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5">
          <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            <span className="font-semibold text-gray-800">{totalWords.toLocaleString()}</span> total words
            &nbsp;·&nbsp;
            <span className="font-semibold text-gray-800">
              {enabledList.filter((s) => sections[s]).length}
            </span> / {enabledList.length} sections
          </p>
          <div className="flex items-center gap-2">
            {saveMsg && (
              <span className={`text-xs font-medium ${saveMsg.startsWith("✓") ? "text-green-600" : "text-red-600"}`}>
                {saveMsg}
              </span>
            )}
            <button
              onClick={onRegenAll}
              disabled={!!generatingSection || generating}
              title="Regenerate all sections with current custom instructions"
              className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-40"
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Regen All
            </button>
            <button
              onClick={onCopyAll}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              {copied === "all" ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              Copy all
            </button>
            <button
              onClick={onDownload}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <Download className="h-3.5 w-3.5" /> Download .txt
            </button>
            <button
              onClick={onDownloadPdf}
              disabled={exportingPdf}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
            >
              {exportingPdf
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <FileDown className="h-3.5 w-3.5" />}
              {exportingPdf ? "Generating…" : "Download PDF"}
            </button>
            <button
              onClick={onExportDoc}
              disabled={exportingDoc}
              className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60"
            >
              {exportingDoc
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <FileUp className="h-3.5 w-3.5" />}
              {exportingDoc ? "Exporting…" : "Export to Google Docs"}
            </button>
            <button
              onClick={onSaveDraft}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save draft
            </button>
          </div>
          </div>
          {/* Criteria coverage bar */}
          {totalCriteria > 0 && (
            <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
              <ClipboardList className="h-3.5 w-3.5 shrink-0 text-violet-500" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-medium text-violet-700">Funder criteria covered</span>
                  <span className="text-[10px] font-bold text-violet-700">{coveredCount}/{totalCriteria} ({coveragePct}%)</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${coveragePct >= 80 ? "bg-green-500" : coveragePct >= 50 ? "bg-violet-500" : "bg-amber-400"}`}
                    style={{ width: `${coveragePct}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Next Step CTA — shown after draft is saved */}
      {saveMsg && saveMsg.startsWith("✓") && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <ChevronsRight className="h-5 w-5 shrink-0 text-amber-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-800">Next step — audit your draft</p>
            <p className="text-xs text-amber-600 mt-0.5">Draft saved. Let AI check for gaps, weak sections, and improvements.</p>
          </div>
          <Link
            href="/grants/auditor"
            className="shrink-0 flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Audit Draft →
          </Link>
        </div>
      )}

      {/* Section cards */}
      <div className="space-y-4 pb-8">
        {enabledList.map((s) => {
          const isGenerating = generatingSection === s;
          const content = sections[s] ?? "";
          const hasContent = content.length > 0;

          return (
            <div
              key={s}
              className={`rounded-xl border bg-white overflow-hidden transition-shadow ${
                isGenerating ? "border-brand-300 shadow-md shadow-brand-100" : "border-gray-200"
              }`}
            >
              {/* Section header */}
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{SECTION_META[s].icon}</span>
                  <span className="text-sm font-semibold text-gray-800">{s}</span>
                  {hasContent && (
                    <span className="text-xs text-gray-400 ml-1">
                      ({wordCount(content).toLocaleString()} words)
                    </span>
                  )}
                  {isGenerating && (
                    <span className="ml-1 flex items-center gap-1 text-xs text-brand-600 font-medium">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Writing…
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {hasContent && (
                    <>
                      <button
                        onClick={() => onCopySection(s, content)}
                        title="Copy section"
                        className="rounded p-1 text-gray-400 hover:text-brand-600 hover:bg-brand-50"
                      >
                        {copied === s
                          ? <CheckCircle className="h-4 w-4 text-green-500" />
                          : <Copy className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => toggleNote(s)}
                        disabled={!!generatingSection}
                        title={openNotes.has(s) ? "Hide instruction" : "Add regen instruction"}
                        aria-label={openNotes.has(s) ? "Hide regen instruction" : "Add regen instruction"}
                        className={`rounded p-1 transition-colors disabled:opacity-40 ${
                          openNotes.has(s)
                            ? "text-violet-600 bg-violet-50"
                            : "text-gray-400 hover:text-violet-600 hover:bg-violet-50"
                        }`}
                      >
                        <MessageSquarePlus className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleRegen(s)}
                        disabled={!!generatingSection}
                        title="Regenerate section"
                        className="rounded p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Inline regen instruction */}
              {openNotes.has(s) && (
                <div className="border-b border-violet-100 bg-violet-50/60 px-4 py-2.5 flex items-start gap-2">
                  <MessageSquarePlus className="h-3.5 w-3.5 mt-2 shrink-0 text-violet-400" />
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-500 mb-1">Regen instruction</p>
                    <textarea
                      value={regenNotes[s] ?? ""}
                      onChange={(e) => setRegenNotes((prev) => ({ ...prev, [s]: e.target.value }))}
                      onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !generatingSection) { e.preventDefault(); handleRegen(s); } }}
                      placeholder="e.g. Fix org type to NGO, update impact numbers, emphasise youth reach… (Ctrl+Enter to regen)"
                      rows={2}
                      className="w-full resize-none rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs text-gray-700 placeholder:text-gray-300 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
                    />
                  </div>
                  <button
                    onClick={() => toggleNote(s)}
                    aria-label="Close regen instruction"
                    className="mt-1 text-violet-300 hover:text-violet-500"
                    title="Close"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Section body */}
              {isGenerating && !hasContent ? (
                <div className="flex items-center justify-center py-12 text-sm text-brand-400 gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating {s}…
                </div>
              ) : (
                <textarea
                  value={content}
                  onChange={(e) => onEditSection(s, e.target.value)}
                  placeholder={`${s} will appear here after generation…`}
                  rows={hasContent ? Math.max(6, Math.ceil(wordCount(content) / 12)) : 4}
                  className="w-full resize-y px-4 py-3 text-sm text-gray-800 leading-relaxed placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-200 font-mono"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
