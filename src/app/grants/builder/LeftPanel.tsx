"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Sparkles, Loader2, RefreshCw, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, Lightbulb, Target, MessageSquarePlus, AlertTriangle, Filter,
  Building2, Plus, Trash2, Pencil, X, ClipboardList,
} from "lucide-react";
import {
  ALL_SECTIONS, SECTION_META, SectionName, Grant, WritingBrief, Tone, Length, FunderTemplate, FunderRequirements,
} from "./types";
import { authFetch } from "@/lib/authFetch";

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
  customInstructions: Record<string, string>;
  onCustomInstructions: (v: Record<string, string>) => void;
  requirements: FunderRequirements | null;
  requirementsLoading: boolean;
  checkedCriteria: Set<string>;
  onToggleCriteria: (c: string) => void;
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
  customInstructions, onCustomInstructions,
  requirements, requirementsLoading, checkedCriteria, onToggleCriteria,
}: Props) {
  const [criteriaOpen, setCriteriaOpen] = useState(true);
  const [ciOpen, setCiOpen] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // ── Funder Templates ──────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<FunderTemplate[]>([]);
  const [tmplOpen, setTmplOpen] = useState(false);
  const [editingTmpl, setEditingTmpl] = useState<FunderTemplate | null>(null);
  const [newTmpl, setNewTmpl] = useState<Partial<FunderTemplate>>({});
  const [addingTmpl, setAddingTmpl] = useState(false);
  const [savingTmpl, setSavingTmpl] = useState(false);

  useEffect(() => {
    authFetch("/api/grants/funder-templates")
      .then(r => r.json())
      .then(d => setTemplates(d.templates ?? []))
      .catch(() => {});
  }, []);

  const saveTmpl = async (tmpl: Partial<FunderTemplate>) => {
    if (!tmpl.funderName?.trim()) return;
    setSavingTmpl(true);
    try {
      const res = await authFetch("/api/grants/funder-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tmpl),
      });
      const d = await res.json();
      if (d.template) {
        setTemplates(prev => {
          const idx = prev.findIndex(t => t.id === d.template.id);
          return idx >= 0 ? prev.map((t, i) => i === idx ? d.template : t) : [...prev, d.template];
        });
      }
      setEditingTmpl(null);
      setAddingTmpl(false);
      setNewTmpl({});
    } finally { setSavingTmpl(false); }
  };

  const deleteTmpl = async (id: string, name: string) => {
    if (!confirm(`Delete template for "${name}"?`)) return;
    await authFetch(`/api/grants/funder-templates?id=${id}`, { method: "DELETE" });
    setTemplates(prev => prev.filter(t => t.id !== id));
  };
  const [fCountry, setFCountry] = useState("");
  const [fDifficulty, setFDifficulty] = useState("");
  const [fMinFit, setFMinFit] = useState("");
  const [fDecision, setFDecision] = useState("");
  const selectedGrant = grants.find((g) => g.id === selectedGrantId) ?? null;

  // Derive unique countries from grants
  const countries = Array.from(new Set(grants.map(g => g.geographicScope).filter(Boolean))) as string[];

  // Filter grants
  const filteredGrants = grants.filter(g => {
    if (fCountry && g.geographicScope !== fCountry) return false;
    if (fDifficulty && g.complexityLabel !== fDifficulty) return false;
    if (fMinFit && (g.matchScore ?? g.fitScore ?? 0) < Number(fMinFit)) return false;
    if (fDecision && g.decision !== fDecision) return false;
    if (!g.deadlineDate) return true;
    return new Date(g.deadlineDate).getTime() + 86_400_000 >= Date.now();
  });
  const hasActiveFilters = !!(fCountry || fDifficulty || fMinFit || fDecision);

  return (
    <div className="w-80 shrink-0 space-y-4">

      {/* Grant selector */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Target className="h-4 w-4 text-brand-600" /> Select Grant
          </h2>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              hasActiveFilters ? "bg-brand-100 text-brand-700" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Filter className="h-3 w-3" />{hasActiveFilters ? "Filtered" : "Filter"}
          </button>
        </div>
        {showFilters && (
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Country / Scope</label>
              <select value={fCountry} onChange={e => setFCountry(e.target.value)} className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs">
                <option value="">All</option>
                {countries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Difficulty</label>
              <select value={fDifficulty} onChange={e => setFDifficulty(e.target.value)} className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs">
                <option value="">All</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Very High">Very High</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Min Fit %</label>
              <select value={fMinFit} onChange={e => setFMinFit(e.target.value)} className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs">
                <option value="">Any</option>
                <option value="50">50%+</option>
                <option value="70">70%+</option>
                <option value="80">80%+</option>
                <option value="90">90%+</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Decision</label>
              <select value={fDecision} onChange={e => setFDecision(e.target.value)} className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs">
                <option value="">All</option>
                <option value="Apply">Apply</option>
                <option value="Maybe">Maybe</option>
                <option value="No">No</option>
              </select>
            </div>
            {hasActiveFilters && (
              <button onClick={() => { setFCountry(""); setFDifficulty(""); setFMinFit(""); setFDecision(""); }} className="col-span-2 text-[10px] text-brand-600 hover:underline">
                Clear all filters
              </button>
            )}
          </div>
        )}
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
            <option value="">Select a grant… ({filteredGrants.length})</option>
            {filteredGrants.map((g) => (
              <option key={g.id} value={g.id}>
                {g.crmStatus ? `[${g.crmStatus}] ` : ""}{g.name}
                {g.amount ? ` — ${g.amount}` : ""}
                {g.matchScore != null ? ` (${g.matchScore}%)` : ""}
              </option>
            ))}
          </select>
        )}
        {selectedGrant && (
          <div className="mt-3 space-y-1 text-xs text-gray-500 border-t border-gray-100 pt-3">
            {selectedGrant.crmStatus && (
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  selectedGrant.crmStatus === "Won"       ? "bg-green-100 text-green-700" :
                  selectedGrant.crmStatus === "Lost"      ? "bg-gray-100 text-gray-500" :
                  selectedGrant.crmStatus === "Active"    ? "bg-brand-100 text-brand-700" :
                  selectedGrant.crmStatus === "Submitted" ? "bg-orange-100 text-orange-700" :
                  selectedGrant.crmStatus === "Pipeline"  ? "bg-purple-100 text-purple-700" :
                  "bg-blue-100 text-blue-700"
                }`}>CRM: {selectedGrant.crmStatus}</span>
                <Link href="/grants/crm" className="text-indigo-500 hover:underline text-[10px] font-medium">View in CRM →</Link>
              </div>
            )}
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
            {selectedGrant.deadlineDate && new Date(selectedGrant.deadlineDate).getTime() + 86_400_000 < Date.now() && (
              <p className="text-red-600 mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Deadline expired</p>
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

      {/* Funder Criteria Checklist */}
      {(requirements && (requirements.criteria.length > 0 || requirements.mandatoryRequirements.length > 0)) && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
          <button
            onClick={() => setCriteriaOpen(v => !v)}
            className="w-full flex items-center justify-between mb-2"
          >
            <h2 className="text-sm font-semibold text-violet-800 flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Funder Criteria
              <span className="ml-1 rounded-full bg-violet-200 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                {checkedCriteria.size}/{requirements.criteria.length + requirements.mandatoryRequirements.length}
              </span>
            </h2>
            {criteriaOpen ? <ChevronUp className="h-4 w-4 text-violet-400" /> : <ChevronDown className="h-4 w-4 text-violet-400" />}
          </button>

          {criteriaOpen && (
            <div className="space-y-1.5">
              {requirements.mandatoryRequirements.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 mt-1 mb-1">Mandatory Requirements</p>
                  {requirements.mandatoryRequirements.map((req, i) => {
                    const key = `mandatory:${req}`;
                    const checked = checkedCriteria.has(key);
                    return (
                      <label key={i} className="flex items-start gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleCriteria(key)}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-red-300 text-red-600 focus:ring-red-400"
                        />
                        <span className={`text-xs leading-relaxed ${checked ? "line-through text-gray-400" : "text-red-700"}`}>{req}</span>
                      </label>
                    );
                  })}
                  {requirements.criteria.length > 0 && <div className="border-t border-violet-200 my-2" />}
                </>
              )}
              {requirements.criteria.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600 mb-1">Evaluation Criteria</p>
                  {requirements.criteria.map((criterion, i) => {
                    const key = `criterion:${criterion}`;
                    const checked = checkedCriteria.has(key);
                    return (
                      <label key={i} className="flex items-start gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleCriteria(key)}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-violet-300 text-violet-600 focus:ring-violet-400"
                        />
                        <span className={`text-xs leading-relaxed ${checked ? "line-through text-gray-400" : "text-violet-800"}`}>{criterion}</span>
                      </label>
                    );
                  })}
                </>
              )}
              {requirements.evaluationRubric.length > 0 && (
                <div className="mt-2 rounded-lg bg-white border border-violet-100 p-2">
                  <p className="text-[10px] font-semibold text-violet-600 mb-1">Scoring Rubric</p>
                  {requirements.evaluationRubric.map((r, i) => (
                    <p key={i} className="text-xs text-violet-700">• {r}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Loading state for requirements */}
      {requirementsLoading && (
        <div className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-xs text-violet-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Extracting funder criteria…
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
            <div key={s}>
              <label className="flex items-start gap-2 cursor-pointer">
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
                <div className="ml-auto flex items-center gap-1 shrink-0">
                  {sections[s] && (
                    <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5" />
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setCiOpen(ciOpen === s ? null : s); }}
                    title="Custom instructions for this section"
                    className={`rounded p-0.5 transition-colors mt-0.5 ${customInstructions[s]?.trim() ? "text-brand-600" : "text-gray-300 hover:text-gray-500"}`}
                  >
                    <MessageSquarePlus className="h-3 w-3" />
                  </button>
                </div>
              </label>
              {ciOpen === s && (
                <div className="ml-5 mt-1 mb-1">
                  <textarea
                    value={customInstructions[s] ?? ""}
                    onChange={(e) => onCustomInstructions({ ...customInstructions, [s]: e.target.value })}
                    placeholder="e.g. Mention our partnership with UQ, emphasize rural health…"
                    rows={2}
                    className="w-full rounded-md border border-brand-200 bg-brand-50 px-2 py-1.5 text-xs text-gray-700 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 resize-y placeholder:text-gray-400"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Funder Templates */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <button
          onClick={() => setTmplOpen(v => !v)}
          className="flex w-full items-center justify-between"
        >
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-indigo-500" /> Funder Templates
            {templates.length > 0 && (
              <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">{templates.length}</span>
            )}
          </h2>
          {tmplOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </button>
        {tmplOpen && (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-gray-400">Store per-funder preferences. Automatically injected when that funder is selected.</p>
            {templates.map(t => (
              <div key={t.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                {editingTmpl?.id === t.id ? (
                  <div className="space-y-2">
                    <input
                      className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-semibold focus:border-indigo-400 focus:outline-none"
                      value={editingTmpl.funderName}
                      onChange={e => setEditingTmpl({...editingTmpl, funderName: e.target.value})}
                      placeholder="Funder name"
                    />
                    <textarea rows={2} className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none resize-y" placeholder="What this funder loves…" value={editingTmpl.preferences ?? ""} onChange={e => setEditingTmpl({...editingTmpl, preferences: e.target.value})} />
                    <textarea rows={2} className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none resize-y" placeholder="Winning patterns from past applications…" value={editingTmpl.patterns ?? ""} onChange={e => setEditingTmpl({...editingTmpl, patterns: e.target.value})} />
                    <textarea rows={2} className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none resize-y" placeholder="What to AVOID with this funder…" value={editingTmpl.avoid ?? ""} onChange={e => setEditingTmpl({...editingTmpl, avoid: e.target.value})} />
                    <textarea rows={2} className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none resize-y" placeholder="Extra notes…" value={editingTmpl.notes ?? ""} onChange={e => setEditingTmpl({...editingTmpl, notes: e.target.value})} />
                    <div className="flex gap-2">
                      <button onClick={() => saveTmpl(editingTmpl)} disabled={savingTmpl} className="flex-1 rounded-lg bg-indigo-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
                        {savingTmpl ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : "Save"}
                      </button>
                      <button onClick={() => setEditingTmpl(null)} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100"><X className="h-3 w-3" /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{t.funderName}</p>
                      {t.preferences && <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">{t.preferences}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => setEditingTmpl(t)} className="rounded p-1 text-gray-400 hover:text-indigo-600"><Pencil className="h-3 w-3" /></button>
                      <button onClick={() => deleteTmpl(t.id, t.funderName)} className="rounded p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {addingTmpl ? (
              <div className="space-y-2 rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/30 p-3">
                <input className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-semibold focus:border-indigo-400 focus:outline-none" placeholder="Funder name (e.g. Gates Foundation)" value={newTmpl.funderName ?? ""} onChange={e => setNewTmpl({...newTmpl, funderName: e.target.value})} />
                <textarea rows={2} className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none resize-y" placeholder="What this funder loves (language, evidence types, focus areas)…" value={newTmpl.preferences ?? ""} onChange={e => setNewTmpl({...newTmpl, preferences: e.target.value})} />
                <textarea rows={2} className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none resize-y" placeholder="Winning patterns from past applications…" value={newTmpl.patterns ?? ""} onChange={e => setNewTmpl({...newTmpl, patterns: e.target.value})} />
                <textarea rows={2} className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none resize-y" placeholder="What to AVOID with this funder…" value={newTmpl.avoid ?? ""} onChange={e => setNewTmpl({...newTmpl, avoid: e.target.value})} />
                <textarea rows={2} className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none resize-y" placeholder="Extra notes…" value={newTmpl.notes ?? ""} onChange={e => setNewTmpl({...newTmpl, notes: e.target.value})} />
                <div className="flex gap-2">
                  <button onClick={() => saveTmpl(newTmpl)} disabled={savingTmpl || !newTmpl.funderName?.trim()} className="flex-1 rounded-lg bg-indigo-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
                    {savingTmpl ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : "Add Template"}
                  </button>
                  <button onClick={() => { setAddingTmpl(false); setNewTmpl({}); }} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100"><X className="h-3 w-3" /></button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingTmpl(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-200 py-2 text-xs font-medium text-gray-400 hover:border-indigo-300 hover:text-indigo-600"
              >
                <Plus className="h-3.5 w-3.5" /> Add Funder Template
              </button>
            )}
          </div>
        )}
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
