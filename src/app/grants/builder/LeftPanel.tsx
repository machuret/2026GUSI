"use client";

import Link from "next/link";
import {
  Sparkles, Loader2, RefreshCw, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, Lightbulb, Target,
} from "lucide-react";
import {
  ALL_SECTIONS, SECTION_META, SectionName, Grant, WritingBrief, Tone, Length,
} from "./types";

interface Props {
  grants: Grant[];
  loadingGrants: boolean;
  selectedGrantId: string;
  onSelectGrant: (id: string) => void;
  enabledSections: Set<SectionName>;
  onToggleSection: (s: SectionName, on: boolean) => void;
  tone: Tone;
  onTone: (t: Tone) => void;
  length: Length;
  onLength: (l: Length) => void;
  brief: WritingBrief | null;
  briefLoading: boolean;
  briefError: string | null;
  briefExpanded: boolean;
  onToggleBriefExpanded: () => void;
  onRunBrief: () => void;
  sections: Record<string, string>;
  generating: boolean;
  generatingSection: string | null;
  progress: number;
  enabledList: readonly SectionName[];
  genError: string | null;
  onGenerateAll: () => void;
  onStopGeneration: () => void;
  doneCount: number;
}

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export default function LeftPanel({
  grants, loadingGrants, selectedGrantId, onSelectGrant,
  enabledSections, onToggleSection,
  tone, onTone, length, onLength,
  brief, briefLoading, briefError, briefExpanded, onToggleBriefExpanded, onRunBrief,
  sections, generating, generatingSection, progress, enabledList, genError,
  onGenerateAll, onStopGeneration, doneCount,
}: Props) {
  const selectedGrant = grants.find((g) => g.id === selectedGrantId) ?? null;

  return (
    <div className="w-80 shrink-0 space-y-4">

      {/* Grant selector */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Target className="h-4 w-4 text-brand-600" /> Select Grant
        </h2>
        {loadingGrants ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : grants.length === 0 ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            No grants found.{" "}
            <Link href="/grants" className="underline font-medium">Go to Grants →</Link>
          </div>
        ) : (
          <select
            value={selectedGrantId}
            onChange={(e) => onSelectGrant(e.target.value)}
            className={inputCls}
          >
            <option value="">Select a grant…</option>
            {grants.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {g.amount ? ` — ${g.amount}` : ""}
                {g.matchScore != null ? ` (${g.matchScore}%)` : ""}
              </option>
            ))}
          </select>
        )}
        {selectedGrant && (
          <div className="mt-3 space-y-1 text-xs text-gray-500 border-t border-gray-100 pt-3">
            {selectedGrant.founder && (
              <p><span className="font-medium text-gray-700">Funder:</span> {selectedGrant.founder}</p>
            )}
            {selectedGrant.amount && (
              <p><span className="font-medium text-gray-700">Amount:</span> {selectedGrant.amount}</p>
            )}
            {selectedGrant.deadlineDate && (
              <p>
                <span className="font-medium text-gray-700">Deadline:</span>{" "}
                {new Date(selectedGrant.deadlineDate).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            )}
            {selectedGrant.aiVerdict && (
              <p><span className="font-medium text-gray-700">AI Fit:</span> {selectedGrant.aiVerdict}</p>
            )}
            {!selectedGrant.url && (
              <p className="text-amber-600 mt-1">⚠ No URL — live crawl unavailable</p>
            )}
          </div>
        )}
      </div>

      {/* Intelligence Brief */}
      {selectedGrantId && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-brand-800 flex items-center gap-2">
              <Lightbulb className="h-4 w-4" /> Intelligence Brief
            </h2>
            {brief && (
              <button onClick={onToggleBriefExpanded} className="text-brand-400 hover:text-brand-600">
                {briefExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
          </div>

          {!brief ? (
            <>
              <p className="text-xs text-brand-700 mb-3">
                Reads all 6 data sources (grant record, profile, company DNA, vault docs, live URL crawl,
                fit analysis) to identify the winning angle, funder priorities, and eligibility risks before writing.
              </p>
              <button
                onClick={onRunBrief}
                disabled={briefLoading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {briefLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {briefLoading ? "Analysing…" : "Run Pre-Analysis"}
              </button>
              {briefError && <p className="mt-2 text-xs text-red-600">{briefError}</p>}
            </>
          ) : briefExpanded ? (
            <div className="space-y-2.5 text-xs">
              <div className="rounded-lg bg-white border border-brand-100 p-2.5">
                <p className="font-semibold text-brand-800 mb-1">🎯 Winning Angle</p>
                <p className="text-brand-700 italic leading-relaxed">{brief.winningAngle}</p>
              </div>
              <div>
                <p className="font-semibold text-brand-800 mb-1">📌 Funder Priorities</p>
                <ul className="list-disc list-inside text-brand-700 space-y-0.5">
                  {brief.funderPriorities.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
              {brief.suggestedAsk && (
                <div>
                  <p className="font-semibold text-brand-800 mb-1">💰 Suggested Ask</p>
                  <p className="text-brand-700">{brief.suggestedAsk}</p>
                </div>
              )}
              <div>
                <p className="font-semibold text-green-700 mb-1">✅ Eligibility Strengths</p>
                <ul className="list-disc list-inside text-green-700 space-y-0.5">
                  {brief.eligibilityStrengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
              {brief.eligibilityRisks.length > 0 && (
                <div>
                  <p className="font-semibold text-amber-700 mb-1">⚠ Risks to Address</p>
                  <ul className="list-disc list-inside text-amber-700 space-y-0.5">
                    {brief.eligibilityRisks.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
              <div>
                <p className="font-semibold text-brand-800 mb-1">🔑 Keywords to Use</p>
                <p className="text-brand-700">{brief.keywordsToUse.join(", ")}</p>
              </div>
              <div>
                <p className="font-semibold text-brand-800 mb-1">🗣 Tone Guidance</p>
                <p className="text-brand-700">{brief.toneGuidance}</p>
              </div>
              <button
                onClick={onRunBrief}
                disabled={briefLoading}
                className="text-brand-500 hover:underline text-xs flex items-center gap-1 mt-1"
              >
                <RefreshCw className="h-3 w-3" /> Re-run analysis
              </button>
            </div>
          ) : (
            <button onClick={onToggleBriefExpanded} className="text-xs text-brand-700 hover:underline">
              Brief ready — click to expand ↓
            </button>
          )}
        </div>
      )}

      {/* Sections checklist */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-800">Sections</h2>
          <span className="text-xs text-gray-400">{doneCount}/{enabledList.length} done</span>
        </div>
        <div className="space-y-2">
          {ALL_SECTIONS.map((s) => (
            <label key={s} className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enabledSections.has(s)}
                onChange={(e) => onToggleSection(s, e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-brand-600 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-700 leading-tight">
                  {SECTION_META[s].icon} {s}
                </p>
                <p className="text-xs text-gray-400 leading-tight mt-0.5">{SECTION_META[s].hint}</p>
              </div>
              {sections[s] && (
                <CheckCircle className="h-3.5 w-3.5 text-green-500 ml-auto shrink-0 mt-0.5" />
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Options */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Options</h2>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Tone</label>
          <div className="flex gap-2">
            {(["first_person", "third_person"] as const).map((t) => (
              <button
                key={t}
                onClick={() => onTone(t)}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                  tone === t
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {t === "first_person" ? "We / Our" : "They / The org"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Section length</label>
          <div className="flex gap-2">
            {(["concise", "standard", "detailed"] as const).map((l) => (
              <button
                key={l}
                onClick={() => onLength(l)}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium capitalize transition-colors ${
                  length === l
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {length === "concise" ? "~150" : length === "standard" ? "~300" : "~500"} words/section
          </p>
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={onGenerateAll}
        disabled={!selectedGrantId || !brief || generating}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
        {generating ? `Writing "${generatingSection}"…` : "Generate Application"}
      </button>

      {!brief && selectedGrantId && (
        <p className="text-center text-xs text-amber-600 -mt-2">↑ Run Pre-Analysis first</p>
      )}

      {/* Progress */}
      {generating && (
        <div className="-mt-2">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Generating sections…</span>
            <span>{progress} / {enabledList.length}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-brand-600 transition-all duration-300"
              style={{ width: `${enabledList.length > 0 ? (progress / enabledList.length) * 100 : 0}%` }}
            />
          </div>
          <button
            onClick={onStopGeneration}
            className="mt-2 text-xs text-red-500 hover:underline"
          >
            Stop generation
          </button>
        </div>
      )}

      {/* Error */}
      {genError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {genError}
        </div>
      )}
    </div>
  );
}
