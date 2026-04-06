"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ExternalLink, Trash2, ChevronDown, ChevronUp,
  FileText, Loader2, Save, Sparkles, FlaskConical, PenLine, KanbanSquare, ChevronsRight, MoreHorizontal,
  ShieldCheck, ShieldX, ShieldAlert,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import type { Grant } from "@/hooks/GrantsContext";
import type { GrantAnalysis } from "./grantTypes";
import { FitBadge, DecisionBadge, EffortBadge, DeadlineBadge, FocusBadge } from "./GrantBadges";
import { GrantFormFields } from "./GrantFormFields";
import { AnalysisPanel } from "./GrantAnalysisPanel";
import type { Effort } from "./grantTypes";

interface Props {
  grant: Grant;
  onUpdate: (id: string, d: Partial<Grant>) => Promise<{ success: boolean; grant?: Grant }>;
  onDelete: (id: string) => Promise<{ success: boolean }>;
  companyDNA?: string;
  selected?: boolean;
  onToggleSelect?: () => void;
  duplicateOf?: string;
}

export function GrantRow({ grant, onUpdate, onDelete, companyDNA, selected, onToggleSelect, duplicateOf }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Grant>>({ ...grant });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [researching, setResearching] = useState(false);
  const [sendingToCrm, setSendingToCrm] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  const [revalidateResult, setRevalidateResult] = useState<{
    status: "VALIDATED" | "FAILED";
    reasons: string[];
    linkAlive: boolean;
    aiConfidence: number;
    grantSignals: string[];
    failSignals: string[];
  } | null>(null);
  const [revalidateError, setRevalidateError] = useState<string | null>(null);
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

  const handleRevalidate = async () => {
    setRevalidating(true);
    setRevalidateError(null);
    setRevalidateResult(null);
    setExpanded(true);
    try {
      const res = await authFetch("/api/grants/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantId: grant.id }),
      });
      const data = await res.json();
      if (data.success && data.validationStatus) {
        setRevalidateResult({
          status:       data.validationStatus,
          reasons:      data.validationResult?.reasons      ?? [],
          linkAlive:    data.validationResult?.linkAlive    ?? false,
          aiConfidence: data.validationResult?.aiConfidence ?? 0,
          grantSignals: data.validationResult?.grantSignals ?? [],
          failSignals:  data.validationResult?.failSignals  ?? [],
        });
        // Push validationStatus + validatedAt directly into parent state so badges appear immediately
        await onUpdate(grant.id, {
          validationStatus: data.validationStatus,
          validatedAt:      data.validationResult?.validatedAt ?? new Date().toISOString(),
          validationResult: data.validationResult ?? null,
        });
      } else {
        setRevalidateError(data.error || "Revalidation failed — check the edge function is deployed");
      }
    } catch {
      setRevalidateError("Network error — revalidation failed");
    } finally {
      setRevalidating(false);
    }
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
    setAnalysing(true); setAiError(null); setAnalysis(null); setExpanded(true);
    try {
      const res = await authFetch("/api/grants/analyse", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantId: grant.id }),
      });
      const data = await res.json();
      if (data.success && data.analysis) {
        setAnalysis(data.analysis);
        // Route persists aiScore, aiVerdict, aiAnalysis, decision server-side
        // Just refresh the grant in parent to pick up new values
        await onUpdate(grant.id, {});
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
        <td className="px-4 py-3 max-w-[280px]">
          <div className="flex items-start gap-2">
            <button onClick={() => setExpanded(v => !v)} className="mt-0.5 shrink-0 text-gray-400 hover:text-brand-600">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-gray-900 text-sm break-words">{grant.name}</p>
                {grant.aiAnalysis && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">✦ AI Fit</span>
                )}
                {grant.aiResearched && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">⬡ AI Filled</span>
                )}
                {duplicateOf && (
                  <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700" title={`Possible duplicate of: ${duplicateOf}`}>
                    ⚠ Duplicate
                  </span>
                )}
                {grant.validationStatus === "VALIDATED" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-300" title={`Validated ${grant.validatedAt ? new Date(grant.validatedAt).toLocaleDateString("en-AU") : ""}`}>
                    <ShieldCheck className="h-2.5 w-2.5" /> VALIDATED
                  </span>
                )}
                {grant.validationStatus === "FAILED" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-300" title={`Validation failed ${grant.validatedAt ? new Date(grant.validatedAt).toLocaleDateString("en-AU") : ""}`}>
                    <ShieldX className="h-2.5 w-2.5" /> FAILED
                  </span>
                )}
                {grant.aiBrief && (grant.aiBrief as Record<string,unknown>).focusArea
                  ? <FocusBadge
                      primary={((grant.aiBrief as Record<string,unknown>).focusArea as { primary: string }).primary}
                      tags={((grant.aiBrief as Record<string,unknown>).focusArea as { tags?: string[] }).tags}
                      size="xs"
                    />
                  : null}
                {grant.crmStatus && (
                  <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                    grant.crmStatus === "Won"       ? "bg-green-100 text-green-700 border-green-300" :
                    grant.crmStatus === "Lost"      ? "bg-gray-100 text-gray-500 border-gray-300" :
                    grant.crmStatus === "Active"    ? "bg-brand-100 text-brand-700 border-brand-300" :
                    grant.crmStatus === "Submitted" ? "bg-orange-100 text-orange-700 border-orange-300" :
                    grant.crmStatus === "Pipeline"  ? "bg-purple-100 text-purple-700 border-purple-300" :
                    "bg-indigo-100 text-indigo-700 border-indigo-300"
                  }`}>✓ CRM · {grant.crmStatus}</span>
                )}
              </div>
              {grant.founder && <p className="text-xs text-gray-400 mt-0.5">{grant.founder}</p>}
              <p className="text-xs text-gray-300 mt-0.5">Added {new Date(grant.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</p>
            </div>
          </div>
        </td>
        <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{grant.geographicScope || <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-3 whitespace-nowrap"><DeadlineBadge date={grant.deadlineDate} /></td>
        <td className="px-3 py-3 text-sm text-gray-700 max-w-[160px]"><span className="block truncate" title={grant.amount ?? undefined}>{grant.amount || <span className="text-gray-300">—</span>}</span></td>
        <td className="px-3 py-3">
          {grant.matchScore != null ? (
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${grant.matchScore >= 70 ? "bg-green-100 text-green-700" : grant.matchScore >= 40 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-600"}`}>{grant.matchScore}%</span>
          ) : <span className="text-gray-300 text-xs">—</span>}
        </td>
        <td className="px-3 py-3"><FitBadge aiScore={grant.aiScore} aiVerdict={grant.aiVerdict} fitScore={grant.fitScore} stale={!!(grant.deadlineDate && new Date(grant.deadlineDate).getTime() < Date.now() && grant.aiScore != null)} /></td>
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
                <button onClick={() => { handleRevalidate(); setShowActions(false); }} disabled={revalidating}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                  {revalidating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5 text-teal-500" />}
                  Re-validate
                </button>
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
            {revalidateError && <p className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{revalidateError}</p>}
            {researchMsg && <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{researchMsg}</p>}
            {revalidating && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-teal-50 border border-teal-200 px-3 py-2 text-sm text-teal-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                Re-validating — checking link liveness and AI authenticity…
              </div>
            )}
            {revalidateResult && (
              <div className={`mb-4 rounded-xl border px-4 py-4 ${
                revalidateResult.status === "VALIDATED"
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-red-200 bg-red-50"
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  {revalidateResult.status === "VALIDATED"
                    ? <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    : <ShieldX className="h-5 w-5 text-red-600" />}
                  <p className={`font-semibold text-sm ${
                    revalidateResult.status === "VALIDATED" ? "text-emerald-800" : "text-red-800"
                  }`}>
                    {revalidateResult.status === "VALIDATED" ? "Grant Validated" : "Validation Failed"}
                    <span className="ml-2 text-xs font-normal opacity-70">AI confidence: {revalidateResult.aiConfidence}%</span>
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                  <div>
                    <p className="font-semibold text-gray-500 uppercase tracking-wide mb-1">Link</p>
                    <p className={revalidateResult.linkAlive ? "text-emerald-700" : "text-red-600"}>
                      {revalidateResult.linkAlive ? "✓ URL is live" : "✗ URL is dead or redirected"}
                    </p>
                  </div>
                  {revalidateResult.reasons.length > 0 && (
                    <div className="sm:col-span-2">
                      <p className="font-semibold text-gray-500 uppercase tracking-wide mb-1">Reasons</p>
                      <ul className="space-y-0.5">
                        {revalidateResult.reasons.map((r, i) => (
                          <li key={i} className="text-gray-700">· {r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {revalidateResult.grantSignals.length > 0 && (
                    <div>
                      <p className="font-semibold text-emerald-600 uppercase tracking-wide mb-1">Grant signals</p>
                      <ul className="space-y-0.5">
                        {revalidateResult.grantSignals.map((s, i) => (
                          <li key={i} className="text-emerald-700">✓ {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {revalidateResult.failSignals.length > 0 && (
                    <div>
                      <p className="font-semibold text-red-600 uppercase tracking-wide mb-1">Fail signals</p>
                      <ul className="space-y-0.5">
                        {revalidateResult.failSignals.map((s, i) => (
                          <li key={i} className="text-red-700">✗ {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
            {(analysing || researching) && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                {analysing ? "AI is analysing your fit for this grant…" : "AI is researching and filling missing fields…"}
              </div>
            )}
            {analysis && (
              <>
                <AnalysisPanel
                  analysis={analysis}
                  onClose={() => setAnalysis(null)}
                  onMarkNo={async () => { await onUpdate(grant.id, { decision: "No" }); }}
                  onAddToCrm={async () => { await onUpdate(grant.id, { crmStatus: "Researching" }); }}
                />
                {analysis.score >= 50 ? (
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <ChevronsRight className="h-5 w-5 shrink-0 text-emerald-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-emerald-800">Next step — write your application</p>
                      <p className="text-xs text-emerald-600 mt-0.5">Good fit score. Start writing your grant application now.</p>
                    </div>
                    <Link
                      href={`/grants/builder?grantId=${grant.id}`}
                      className="shrink-0 flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      <PenLine className="h-3.5 w-3.5" /> Write Application →
                    </Link>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <ChevronsRight className="h-5 w-5 shrink-0 text-amber-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-amber-800">Low fit — consider skipping this grant</p>
                      <p className="text-xs text-amber-600 mt-0.5">AI score is below 50%. Review the gaps before writing.</p>
                    </div>
                    <Link
                      href={`/grants/builder?grantId=${grant.id}`}
                      className="shrink-0 flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                    >
                      <PenLine className="h-3.5 w-3.5" /> Write Anyway →
                    </Link>
                  </div>
                )}
              </>
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
                  <button onClick={handleRevalidate} disabled={revalidating} className="flex items-center gap-1 text-xs text-teal-600 hover:underline disabled:opacity-50">
                    <ShieldAlert className="h-3 w-3" /> Re-validate
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
