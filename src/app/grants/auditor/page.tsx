"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, ShieldCheck, Loader2, ChevronDown, ChevronUp,
  CheckCircle, AlertTriangle, XCircle, Info, Trophy, PenLine,
  KanbanSquare, UserCheck, Rss, Settings, BookOpen, Sparkles,
  Clock, Zap, Trash2, ChevronsRight,
} from "lucide-react";
import { authFetch, edgeFn } from "@/lib/authFetch";

interface SavedDraft {
  id: string;
  grantName: string;
  published?: boolean;
  updatedAt: string;
}

interface SectionAudit {
  section: string;
  score: number;
  issues: string[];
  improvements: string[];
}

interface AuditResult {
  overallScore: number;
  overallVerdict: "Excellent" | "Good" | "Needs Work" | "Poor";
  summary: string;
  sectionAudits: SectionAudit[];
  topRecommendations: string[];
}

interface SavedAudit {
  id: string;
  draftId: string;
  grantName: string;
  overallScore: number;
  overallVerdict: string;
  summary: string;
  sectionAudits: SectionAudit[];
  topRecommendations: string[];
  improvedAt: string | null;
  createdAt: string;
}

interface ImproveChange {
  section: string;
  changesSummary: string;
  scoreBefore: number;
}

const verdictColor = (v: string) => {
  if (v === "Excellent") return "text-green-700 bg-green-100 border-green-300";
  if (v === "Good")      return "text-blue-700 bg-blue-100 border-blue-300";
  if (v === "Needs Work") return "text-orange-700 bg-orange-100 border-orange-300";
  return "text-red-700 bg-red-100 border-red-300";
};

const scoreColor = (s: number) => {
  if (s >= 80) return "text-green-700";
  if (s >= 60) return "text-blue-600";
  if (s >= 40) return "text-orange-600";
  return "text-red-600";
};

const scoreBarColor = (s: number) => {
  if (s >= 80) return "bg-green-500";
  if (s >= 60) return "bg-blue-500";
  if (s >= 40) return "bg-orange-500";
  return "bg-red-500";
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function GrantAuditorPage() {
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [selectedDraftId, setSelectedDraftId] = useState<string>("");
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [auditId, setAuditId] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [hasCustomPrompt, setHasCustomPrompt] = useState(false);

  // Saved audits
  const [savedAudits, setSavedAudits] = useState<SavedAudit[]>([]);
  const [loadingAudits, setLoadingAudits] = useState(true);

  // Improve
  const [improving, setImproving] = useState(false);
  const [improveResult, setImproveResult] = useState<{ changes: ImproveChange[]; message: string } | null>(null);
  const [improveError, setImproveError] = useState<string | null>(null);

  const fetchDrafts = useCallback(async () => {
    try {
      const res  = await authFetch("/api/grants/drafts");
      const data = await res.json();
      const unpublished = (data.drafts ?? []).filter((d: SavedDraft) => !d.published);
      setDrafts(unpublished);
      if (unpublished.length > 0) setSelectedDraftId(unpublished[0].id);
    } catch { /* ignore */ }
    finally { setLoadingDrafts(false); }
  }, []);

  const fetchSavedAudits = useCallback(async () => {
    try {
      const res = await authFetch(edgeFn("grant-audit"));
      const data = await res.json();
      setSavedAudits(data.audits ?? []);
    } catch { /* ignore */ }
    finally { setLoadingAudits(false); }
  }, []);

  const deleteAudit = useCallback(async (auditId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this saved audit?")) return;
    try {
      await authFetch(`${edgeFn("grant-audit")}?id=${auditId}`, { method: "DELETE" });
      setSavedAudits((prev) => prev.filter((a) => a.id !== auditId));
    } catch { /* ignore */ }
  }, []);

  const checkPrompt = useCallback(async () => {
    try {
      const res  = await authFetch("/api/prompts?limit=100");
      const data = await res.json();
      setHasCustomPrompt((data.prompts ?? []).some((p: { contentType: string }) => p.contentType === "grant_audit"));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchDrafts();
    fetchSavedAudits();
    checkPrompt();
  }, [fetchDrafts, fetchSavedAudits, checkPrompt]);

  const runAudit = async () => {
    if (!selectedDraftId) return;
    setAuditing(true);
    setAuditResult(null);
    setAuditId(null);
    setAuditError(null);
    setImproveResult(null);
    setImproveError(null);
    try {
      const res = await authFetch(edgeFn("grant-audit"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: selectedDraftId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Audit failed");
      setAuditResult(data.audit);
      setAuditId(data.auditId ?? null);
      setExpandedSection(null);
      fetchSavedAudits();
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setAuditing(false);
    }
  };

  const runImprove = async () => {
    if (!auditId) return;
    if (!confirm("This will rewrite all flagged sections in your draft based on the audit findings. Continue?")) return;
    setImproving(true);
    setImproveResult(null);
    setImproveError(null);
    try {
      const res = await authFetch(edgeFn("grant-improve"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Improve failed");
      setImproveResult({ changes: data.changes ?? [], message: data.message ?? "Done" });
      fetchSavedAudits();
      fetchDrafts();
    } catch (err) {
      setImproveError(err instanceof Error ? err.message : "Improve failed");
    } finally {
      setImproving(false);
    }
  };

  const selectedDraftName = drafts.find(d => d.id === selectedDraftId)?.grantName ?? "";

  return (
    <div className="mx-auto max-w-4xl">
      {/* Grants suite nav */}
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5">
        <Link href="/grants" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:text-brand-600">
          <Trophy className="h-3.5 w-3.5" /> All Grants
        </Link>
        <Link href="/grants/crm" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:text-indigo-600">
          <KanbanSquare className="h-3.5 w-3.5" /> CRM
        </Link>
        <Link href="/grants/builder" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:text-emerald-600">
          <PenLine className="h-3.5 w-3.5" /> Builder
        </Link>
        <Link href="/grants/profile" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:text-brand-600">
          <UserCheck className="h-3.5 w-3.5" /> Profile
        </Link>
        <Link href="/grants/examples" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:text-emerald-600">
          <BookOpen className="h-3.5 w-3.5" /> Examples
        </Link>
        <Link href="/grants/crawler" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:text-brand-600">
          <Rss className="h-3.5 w-3.5" /> Crawler
        </Link>
        <span className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 border border-amber-200">
          <ShieldCheck className="h-3.5 w-3.5" /> Auditor
        </span>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/grants" className="flex items-center gap-1 text-sm text-gray-400 hover:text-brand-600">
              <ArrowLeft className="h-4 w-4" /> Grants
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-amber-600" /> Grant Auditor
          </h1>
          <p className="mt-1 text-gray-500">
            AI-powered accuracy check — audit your draft, then auto-improve every section
          </p>
        </div>
        <Link
          href="/prompts"
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 shrink-0"
          title="Customise the audit prompt in Prompt Manager"
        >
          <Settings className="h-4 w-4" />
          {hasCustomPrompt ? "Edit Audit Prompt" : "Customise Prompt"}
        </Link>
      </div>

      {/* Prompt hint */}
      {!hasCustomPrompt && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Using the default audit prompt. Go to{" "}
            <Link href="/prompts" className="font-semibold underline">Prompt Manager</Link>{" "}
            and create a prompt with content type <code className="bg-amber-100 px-1 rounded text-xs">grant_audit</code> to customise the auditor&apos;s behaviour.
          </p>
        </div>
      )}

      {/* Audit panel */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Select a Grant Draft to Audit</h2>

        {loadingDrafts ? (
          <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading drafts…</div>
        ) : drafts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 py-10 text-center">
            <p className="text-gray-500 text-sm">No saved drafts yet.</p>
            <Link href="/grants/builder" className="mt-2 inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline">
              <PenLine className="h-4 w-4" /> Go to Grant Builder
            </Link>
          </div>
        ) : (
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-600">Draft</label>
              <select
                value={selectedDraftId}
                onChange={(e) => { setSelectedDraftId(e.target.value); setAuditResult(null); setAuditId(null); setAuditError(null); setImproveResult(null); }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {drafts.map((d) => (
                  <option key={d.id} value={d.id}>{d.grantName}</option>
                ))}
              </select>
            </div>
            <button
              onClick={runAudit}
              disabled={auditing || !selectedDraftId}
              className="flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {auditing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {auditing ? "Auditing…" : "Run Audit"}
            </button>
          </div>
        )}

        {auditError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{auditError}</div>
        )}
      </div>

      {/* Saved audits history */}
      {!loadingAudits && savedAudits.length > 0 && !auditResult && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" /> Saved Audits
          </h2>
          <p className="text-xs text-gray-400 mb-3">Click an audit to view details and improve the draft</p>
          <div className="space-y-2">
            {savedAudits.map((a) => (
              <div
                key={a.id}
                className="group w-full flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-3 hover:bg-gray-50 hover:border-amber-200 transition-colors"
              >
                <button
                  onClick={() => {
                    setAuditResult({
                      overallScore: a.overallScore,
                      overallVerdict: a.overallVerdict as AuditResult["overallVerdict"],
                      summary: a.summary,
                      sectionAudits: a.sectionAudits ?? [],
                      topRecommendations: a.topRecommendations ?? [],
                    });
                    setAuditId(a.id);
                    setSelectedDraftId(a.draftId);
                    setImproveResult(null);
                    setImproveError(null);
                  }}
                  className="flex flex-1 min-w-0 items-center gap-3 text-left"
                >
                  <div className={`shrink-0 text-lg font-bold w-10 ${scoreColor(a.overallScore)}`}>{a.overallScore}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.grantName}</p>
                    <p className="text-xs text-gray-400">{fmtDate(a.createdAt)}</p>
                  </div>
                  <div className={`shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${verdictColor(a.overallVerdict)}`}>
                    {a.overallVerdict}
                  </div>
                  {a.improvedAt && (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      <Zap className="h-3 w-3" /> Improved
                    </span>
                  )}
                </button>
                <button
                  onClick={(e) => deleteAudit(a.id, e)}
                  className="shrink-0 ml-1 rounded p-1.5 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
                  title="Delete audit"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit results */}
      {auditResult && (
        <div className="space-y-5">
          {/* Back button */}
          {savedAudits.length > 0 && (
            <button
              onClick={() => { setAuditResult(null); setAuditId(null); setImproveResult(null); setImproveError(null); }}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-brand-600"
            >
              <ArrowLeft className="h-4 w-4" /> Back to saved audits
            </button>
          )}
          {/* Overall + Improve button */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Audit Result: {selectedDraftName}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{auditResult.summary}</p>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-4xl font-bold ${scoreColor(auditResult.overallScore)}`}>{auditResult.overallScore}</div>
                <div className={`mt-1 inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${verdictColor(auditResult.overallVerdict)}`}>
                  {auditResult.overallVerdict}
                </div>
              </div>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden mb-4">
              <div
                className={`h-full rounded-full transition-all duration-500 ${scoreBarColor(auditResult.overallScore)}`}
                style={{ width: `${auditResult.overallScore}%` }}
              />
            </div>

            {/* IMPROVE button */}
            {auditId && (
              <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                <button
                  onClick={runImprove}
                  disabled={improving}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 transition-all"
                >
                  {improving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {improving ? "Improving sections…" : "Improve Draft"}
                </button>
                <p className="text-xs text-gray-400">
                  AI will rewrite all flagged sections using your audit findings, vault documents, and profile data
                </p>
              </div>
            )}
          </div>

          {/* Improve result */}
          {improveResult && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <h3 className="text-sm font-semibold text-emerald-900 mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600" /> {improveResult.message}
              </h3>
              {improveResult.changes.length > 0 && (
                <div className="space-y-2">
                  {improveResult.changes.map((c, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg bg-white border border-emerald-100 px-4 py-3">
                      <div className="shrink-0">
                        <span className={`text-sm font-bold ${scoreColor(c.scoreBefore)}`}>{c.scoreBefore}</span>
                        <span className="text-gray-300 mx-1">&rarr;</span>
                        <span className="text-sm font-bold text-emerald-600">Fixed</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{c.section}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{c.changesSummary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-emerald-700">
                Your draft has been updated. Go to{" "}
                <Link href="/grants/builder" className="font-semibold underline">Grant Builder</Link>{" "}
                to review the improved sections, or run another audit to verify the improvements.
              </p>
            </div>
          )}

          {/* Next Step CTA — after improve or after high score audit */}
          {(improveResult || (auditResult && auditResult.overallScore >= 70 && !improving)) && (
            <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
              <ChevronsRight className="h-5 w-5 shrink-0 text-indigo-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-indigo-800">
                  {improveResult ? "Draft improved — ready to finalise" : "Strong audit score — ready to submit?"}
                </p>
                <p className="text-xs text-indigo-600 mt-0.5">
                  {improveResult
                    ? "Review the improved draft, then export it or mark this grant as Submitted in the CRM."
                    : "Your draft scored well. Export it, or track your submission in the CRM pipeline."}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/grants/builder"
                  className="flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                >
                  <PenLine className="h-3.5 w-3.5" /> Review Draft
                </Link>
                <Link
                  href="/grants/crm"
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  <KanbanSquare className="h-3.5 w-3.5" /> Update CRM →
                </Link>
              </div>
            </div>
          )}
          {improveError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{improveError}</div>
          )}

          {/* Top recommendations */}
          {auditResult.topRecommendations?.length > 0 && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
              <h3 className="text-sm font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-indigo-600" /> Top Recommendations
              </h3>
              <ol className="space-y-2">
                {auditResult.topRecommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-indigo-800">
                    <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-200 text-xs font-bold text-indigo-700">{i + 1}</span>
                    {r}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Section audits */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Section-by-Section Audit</h3>
            <div className="space-y-2">
              {auditResult.sectionAudits?.map((s) => {
                const isOpen = expandedSection === s.section;
                return (
                  <div key={s.section} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                    <button
                      onClick={() => setExpandedSection(isOpen ? null : s.section)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                    >
                      <div className={`shrink-0 text-lg font-bold w-10 ${scoreColor(s.score)}`}>{s.score}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{s.section}</p>
                        <div className="mt-1 h-1.5 w-full max-w-xs rounded-full bg-gray-100 overflow-hidden">
                          <div className={`h-full rounded-full ${scoreBarColor(s.score)}`} style={{ width: `${s.score}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {s.issues.length === 0
                          ? <CheckCircle className="h-4 w-4 text-green-500" />
                          : s.score < 50
                            ? <XCircle className="h-4 w-4 text-red-400" />
                            : <AlertTriangle className="h-4 w-4 text-orange-400" />}
                        {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="border-t border-gray-100 px-4 py-4 space-y-3">
                        {s.issues.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-red-600 mb-1.5">Issues Found</p>
                            <ul className="space-y-1">
                              {s.issues.map((issue, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                  <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" /> {issue}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {s.improvements.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-emerald-700 mb-1.5">Suggested Improvements</p>
                            <ul className="space-y-1">
                              {s.improvements.map((imp, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" /> {imp}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {s.issues.length === 0 && s.improvements.length === 0 && (
                          <p className="text-sm text-gray-400 italic">No issues found in this section.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
