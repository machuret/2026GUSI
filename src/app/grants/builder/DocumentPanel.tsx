"use client";

import { Sparkles, Loader2, Copy, RefreshCw, CheckCircle, Download, Save } from "lucide-react";
import { SECTION_META, SectionName, wordCount } from "./types";

interface Props {
  enabledList: readonly SectionName[];
  sections: Record<string, string>;
  generatingSection: string | null;
  generating: boolean;
  copied: string | null;
  saving: boolean;
  saveMsg: string | null;
  totalWords: number;
  grantName: string;
  onCopySection: (key: string, text: string) => void;
  onCopyAll: () => void;
  onRegenSection: (s: SectionName) => void;
  onEditSection: (s: SectionName, value: string) => void;
  onDownload: () => void;
  onSaveDraft: () => void;
  hasSections: boolean;
}

export default function DocumentPanel({
  enabledList, sections, generatingSection, generating,
  copied, saving, saveMsg, totalWords, grantName,
  onCopySection, onCopyAll, onRegenSection, onEditSection,
  onDownload, onSaveDraft, hasSections,
}: Props) {
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
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-2.5">
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
              onClick={onSaveDraft}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save draft
            </button>
          </div>
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
                        onClick={() => onRegenSection(s)}
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
