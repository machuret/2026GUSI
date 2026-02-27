"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ExternalLink, Trash2, ChevronDown, ChevronUp,
  FileText, Loader2, Save, Sparkles, FlaskConical, PenLine, KanbanSquare, ChevronsRight, MoreHorizontal,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import type { Grant } from "@/hooks/useGrants";
import type { GrantAnalysis } from "./grantTypes";
import { FitStars, DecisionBadge, EffortBadge, DeadlineBadge } from "./GrantBadges";
import { GrantFormFields } from "./GrantFormFields";
import { AnalysisPanel } from "./GrantAnalysisPanel";
import type { Effort } from "./grantTypes";

interface Props {
  grant: Grant;
  onUpdate: (id: string, d: Partial<Grant>) => Promise<{ success: boolean; grant?: Grant }>;
  onDelete: (id: string) => Promise<{ success: boolean }>;
  companyDNA: string;
  selected?: boolean;
  onToggleSelect?: () => void;
}

export function GrantRow({ grant, onUpdate, onDelete, companyDNA, selected, onToggleSelect }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Grant>>({ ...grant });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [researching, setResearching] = useState(false);
  const [sendingToCrm, setSendingToCrm] = useState(false);
  const [analysis, setAnalysis] = useState<GrantAnalysis | null>(
    grant.aiAnalysis ? (grant.aiAnalysis as unknown as GrantAnalysis) : null
  );
  const [aiError, setAiError] = useState<string | null>(null);
  const [researchMsg, setResearchMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [sendCrmError, setSendCrmError] = useState<string | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const inCrm = !!grant.crmStatus;
  const set = (k: keyof Grant, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  // Close actions dropdown on outside click
  useEffect(() => {
    if (!showActions) return;
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setShowActions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showActions]);

  // Bug fix: sync form when grant prop updates (e.g. after save/update from parent)
  useEffect(() => {
    if (!editing) setForm({ ...grant });
    if (grant.aiAnalysis && !analysis) setAnalysis(grant.aiAnalysis as unknown as GrantAnalysis);
  }, [grant, editing]);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const result = await onUpdate(grant.id, form);
      if (result.success) {
        setEditing(false);
        setForm({ ...form, ...result.grant });
      } else {
        setSaveError("Save failed — please try again.");
      }
    } catch {
      setSaveError("Network error — changes were not saved.");
    } finally { setSaving(false); }
  };

  const del = async () => {
    if (!confirm(`Delete "${grant.name}"?`)) return;
    setDeleting(true);
    try { await onDelete(grant.id); }
    finally { setDeleting(false); }
  };

  const sendToCrm = async (status: Grant["crmStatus"] = "Researching") => {
    setSendingToCrm(true);
    setSendCrmError(null);
    try {
      const res = await onUpdate(grant.id, { crmStatus: status });
      if (!res.success) setSendCrmError("Failed to add to CRM — please try again.");
      else setShowActions(false);
    } catch {
      setSendCrmError("Network error — could not add to CRM.");
    } finally { setSendingToCrm(false); }
  };

  const handleAnalyse = async () => {
    if (!companyDNA) { setAiError("No company info found — please fill in Settings → Company Info first."); setExpanded(true); return; }
    setAnalysing(true); setAiError(null); setAnalysis(null); setExpanded(true);
    try {
      const res = await authFetch("/api/grants/analyse", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grant, companyDNA }),
      });
      const data = await res.json();
      if (data.success && data.analysis) {
        setAnalysis(data.analysis);
        const a = data.analysis;
        const fitScore = typeof a.score === "number" ? Math.max(1, Math.min(5, Math.round(a.score / 20))) : undefined;
        const decision = a.verdict === "Strong Fit" || a.verdict === "Good Fit" ? "Apply"
          : a.verdict === "Not Eligible" ? "No" : "Maybe";
        await onUpdate(grant.id, {
          fitScore: fitScore ?? undefined,
          decision,
          aiScore: a.score ?? undefined,
          aiVerdict: a.verdict ?? undefined,
          aiAnalysis: a,
        });
      } else setAiError(data.error || "Analysis failed");
    } catch { setAiError("Network error"); }
    finally { setAnalysing(false); }
  };

  const handleResearch = async () => {
    setResearching(true); setAiError(null); setResearchMsg(null); setExpanded(true);
    try {
      const res = await authFetch("/api/grants/research", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: grant.name, url: grant.url, founder: grant.founder, existingData: grant }),
      });
      const data = await res.json();
      if (data.success && data.filled) {
        await onUpdate(grant.id, { ...data.filled, aiResearched: true });
        setForm((p) => ({ ...p, ...data.filled }));
        const count = Object.keys(data.filled).length;
        setResearchMsg(`✓ AI filled ${count} field${count !== 1 ? "s" : ""}`);
        setEditing(true);
      } else setAiError(data.error || "Research failed");
    } catch { setAiError("Network error"); }
    finally { setResearching(false); }
  };

  return (
    <>
      <tr className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${expanded ? "bg-gray-50" : ""} ${selected ? "bg-brand-50" : ""}`}>
        {onToggleSelect && (
          <td className="px-2 py-3 w-8">
            <input type="checkbox" checked={!!selected} onChange={onToggleSelect}
              className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
          </td>
        )}
        <td className="px-4 py-3">
          <div className="flex items-start gap-2">
            <button onClick={() => setExpanded(v => !v)} className="mt-0.5 shrink-0 text-gray-400 hover:text-brand-600">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-gray-900 text-sm">{grant.name}</p>
                {grant.aiAnalysis && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">✦ AI Fit</span>
                )}
                {grant.aiResearched && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">⬡ AI Filled</span>
                )}
                {grant.crmStatus && (
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    grant.crmStatus === "Won"       ? "bg-green-100 text-green-700" :
                    grant.crmStatus === "Lost"      ? "bg-gray-100 text-gray-500" :
                    grant.crmStatus === "Active"    ? "bg-brand-100 text-brand-700" :
                    grant.crmStatus === "Submitted" ? "bg-orange-100 text-orange-700" :
                    grant.crmStatus === "Pipeline"  ? "bg-purple-100 text-purple-700" :
                    "bg-blue-100 text-blue-700"
                  }`}>{grant.crmStatus}</span>
                )}
              </div>
              {grant.founder && <p className="text-xs text-gray-400 mt-0.5">{grant.founder}</p>}
              <p className="text-xs text-gray-300 mt-0.5">Added {new Date(grant.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</p>
            </div>
          </div>
        </td>
        <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{grant.geographicScope || <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-3 whitespace-nowrap"><DeadlineBadge date={grant.deadlineDate} /></td>
        <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap">{grant.amount || <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-3">
          {grant.matchScore != null ? (
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${grant.matchScore >= 70 ? "bg-green-100 text-green-700" : grant.matchScore >= 40 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-600"}`}>{grant.matchScore}%</span>
          ) : <span className="text-gray-300 text-xs">—</span>}
        </td>
        <td className="px-3 py-3"><FitStars value={grant.fitScore} /></td>
        <td className="px-3 py-3"><DecisionBadge value={grant.decision as "Apply" | "Maybe" | "No" | "Rejected" | null} /></td>
        <td className="px-2 py-3">
          <div className="relative" ref={actionsRef}>
            <button onClick={() => setShowActions(v => !v)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showActions && (
              <div className="absolute right-0 top-8 z-[999] w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
                {grant.url && (
                  <a href={grant.url} target="_blank" rel="noopener noreferrer" onClick={() => setShowActions(false)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
                    <ExternalLink className="h-3.5 w-3.5 text-brand-500" /> Open URL
                  </a>
                )}
                <button onClick={() => { handleAnalyse(); setShowActions(false); }} disabled={analysing}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                  {analysing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5 text-purple-500" />} AI Fit Analysis
                </button>
                <button onClick={() => { handleResearch(); setShowActions(false); }} disabled={researching}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                  {researching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-brand-500" />} AI Auto-fill
                </button>
                <button onClick={() => { setEditing(true); setExpanded(true); setShowActions(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
                  <FileText className="h-3.5 w-3.5 text-gray-500" /> Edit Fields
                </button>
                <Link href={`/grants/builder?grantId=${grant.id}`} onClick={() => setShowActions(false)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
                  <PenLine className="h-3.5 w-3.5 text-emerald-500" /> Write Application
                </Link>
                <div className="my-1 border-t border-gray-100" />
                {inCrm ? (
                  <Link href="/grants/crm" onClick={() => setShowActions(false)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
                    <KanbanSquare className="h-3.5 w-3.5 text-indigo-500" /> View in CRM
                  </Link>
                ) : (
                  <>
                    {sendCrmError && <p className="mx-3 mb-1 rounded bg-red-50 px-2 py-1 text-[10px] text-red-600">{sendCrmError}</p>}
                    <button onClick={() => sendToCrm("Researching")} disabled={sendingToCrm}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                      {sendingToCrm ? <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" /> : <ChevronsRight className="h-3.5 w-3.5 text-indigo-400" />} Add to CRM
                    </button>
                  </>
                )}
                <div className="my-1 border-t border-gray-100" />
                <button onClick={() => { del(); setShowActions(false); }} disabled={deleting}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40">
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
                </button>
              </div>
            )}
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-gray-100 bg-gray-50">
          <td colSpan={9} className="px-6 py-5">
            {saveError && <p className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 font-medium">{saveError}</p>}
            {aiError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{aiError}</p>}
            {researchMsg && <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{researchMsg}</p>}
            {(analysing || researching) && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                {analysing ? "AI is analysing your fit for this grant…" : "AI is researching and filling missing fields…"}
              </div>
            )}
            {analysis && (
              <AnalysisPanel
                analysis={analysis}
                onClose={() => setAnalysis(null)}
                onMarkNo={async () => { await onUpdate(grant.id, { decision: "No" }); }}
                onAddToCrm={async () => { await onUpdate(grant.id, { crmStatus: "Researching" }); }}
              />
            )}
            {editing ? (
              <div>
                <GrantFormFields form={form} set={set} onResearch={handleResearch} researching={researching} />
                <div className="mt-4 flex gap-2">
                  <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
                  </button>
                  <button onClick={() => { setEditing(false); setForm({ ...grant }); }} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-white">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="space-y-3">
                  {grant.eligibility && <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Eligibility</p><p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{grant.eligibility}</p></div>}
                  {grant.howToApply && <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">How to Apply</p><p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{grant.howToApply}</p></div>}
                  {grant.geographicScope && <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Geographic Scope</p><p className="mt-1 text-sm text-gray-700">{grant.geographicScope}</p></div>}
                  {grant.projectDuration && <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Project Duration</p><p className="mt-1 text-sm text-gray-700">{grant.projectDuration}</p></div>}
                </div>
                <div className="space-y-3">
                  {grant.notes && <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Notes</p><p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{grant.notes}</p></div>}
                  {!grant.eligibility && !grant.howToApply && !grant.notes && (
                    <p className="text-sm text-gray-400">No details yet — click <span className="text-brand-600">✦ Auto-fill</span> to let AI research this grant.</p>
                  )}
                </div>
                {/* Show complexity & effort in expanded view */}
                {(grant.complexityLabel || grant.submissionEffort) && (
                  <div className="lg:col-span-2 flex items-center gap-4 flex-wrap">
                    {grant.complexityLabel && (
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 mr-1.5">Complexity</span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          grant.complexityLabel === "Low" ? "bg-green-100 text-green-700" :
                          grant.complexityLabel === "Medium" ? "bg-yellow-100 text-yellow-700" :
                          grant.complexityLabel === "High" ? "bg-orange-100 text-orange-700" :
                          "bg-red-100 text-red-700"
                        }`}>{grant.complexityLabel}</span>
                      </div>
                    )}
                    {grant.submissionEffort && (
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 mr-1.5">Effort</span>
                        <EffortBadge value={grant.submissionEffort as Effort | null} />
                      </div>
                    )}
                  </div>
                )}
                <div className="lg:col-span-2 flex items-center gap-4 flex-wrap">
                  <span className="text-xs text-gray-400">
                    Added {new Date(grant.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                    {" · "}Last updated {new Date(grant.updatedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <button onClick={() => setEditing(true)} className="text-xs text-brand-600 hover:underline">Edit all fields →</button>
                  <button onClick={handleAnalyse} disabled={analysing} className="flex items-center gap-1 text-xs text-purple-600 hover:underline disabled:opacity-50">
                    <FlaskConical className="h-3 w-3" /> Run fit analysis
                  </button>
                  <button onClick={handleResearch} disabled={researching} className="flex items-center gap-1 text-xs text-brand-600 hover:underline disabled:opacity-50">
                    <Sparkles className="h-3 w-3" /> AI auto-fill missing fields
                  </button>
                  <Link href={`/grants/builder?grantId=${grant.id}`} className="flex items-center gap-1 text-xs text-emerald-600 hover:underline font-medium">
                    <PenLine className="h-3 w-3" /> Write Application →
                  </Link>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
