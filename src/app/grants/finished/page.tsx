"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, Trophy, PenLine, ShieldCheck,
  ExternalLink, Loader2, Download, FileDown, Sparkles,
  Clock, ChevronDown, ChevronUp, FileText,
} from "lucide-react";
import { authFetch, edgeFn } from "@/lib/authFetch";
import { DEMO_COMPANY_ID } from "@/lib/constants";

interface Grant {
  id: string;
  name: string;
  founder?: string | null;
  url?: string | null;
  amount?: string | null;
  deadlineDate?: string | null;
  matchScore?: number | null;
  crmStatus?: string | null;
  crmNotes?: string | null;
  updatedAt: string;
}

interface Draft {
  id: string;
  grantId: string;
  grantName: string;
  sections: Record<string, string>;
  updatedAt: string;
}

interface Audit {
  id: string;
  draftId: string;
  grantName: string;
  overallScore: number;
  overallVerdict: string;
  summary: string;
  improvedAt: string | null;
  createdAt: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function scoreColor(s: number) {
  if (s >= 80) return "text-emerald-600";
  if (s >= 60) return "text-amber-600";
  return "text-red-600";
}

function scoreBg(s: number) {
  if (s >= 80) return "bg-emerald-50 border-emerald-200";
  if (s >= 60) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

export default function FinishedGrantsPage() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [gRes, dRes, aRes] = await Promise.all([
          authFetch(`/api/grants?companyId=${DEMO_COMPANY_ID}`),
          authFetch("/api/grants/drafts"),
          authFetch(edgeFn("grant-audit")),
        ]);
        const gData = await gRes.json();
        const dData = await dRes.json();
        const aData = await aRes.json();
        setGrants(gData.grants ?? []);
        setDrafts(dData.drafts ?? []);
        setAudits(aData.audits ?? []);
      } catch (err) {
        console.error("Failed to load finished grants data:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Finished = grants with crmStatus "Improved"
  const finished = useMemo(
    () => grants.filter((g) => g.crmStatus === "Improved"),
    [grants],
  );

  // Map grantId → latest draft
  const draftByGrant = useMemo(() => {
    const map: Record<string, Draft> = {};
    for (const d of drafts) {
      if (!map[d.grantId] || d.updatedAt > map[d.grantId].updatedAt) {
        map[d.grantId] = d;
      }
    }
    return map;
  }, [drafts]);

  // Map draftId → latest audit
  const auditByDraft = useMemo(() => {
    const map: Record<string, Audit> = {};
    for (const a of audits) {
      if (!map[a.draftId] || a.createdAt > map[a.draftId].createdAt) {
        map[a.draftId] = a;
      }
    }
    return map;
  }, [audits]);

  // Stats
  const totalSections = finished.reduce((sum, g) => {
    const d = draftByGrant[g.id];
    return sum + (d?.sections ? Object.keys(d.sections).length : 0);
  }, 0);
  const totalWords = finished.reduce((sum, g) => {
    const d = draftByGrant[g.id];
    if (!d?.sections) return sum;
    return sum + Object.values(d.sections).reduce((s, t) => s + wordCount(t), 0);
  }, 0);
  const avgScore = finished.length > 0
    ? Math.round(
        finished.reduce((sum, g) => {
          const d = draftByGrant[g.id];
          const a = d ? auditByDraft[d.id] : null;
          return sum + (a?.overallScore ?? 0);
        }, 0) / finished.length,
      )
    : 0;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" /> Finished Grants
          </h1>
          <p className="mt-1 text-gray-500">
            Grants that have been built, audited, and improved — ready for submission
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/grants/crm" className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            <ArrowLeft className="h-4 w-4" /> CRM
          </Link>
          <Link href="/grants/builder" className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700">
            <PenLine className="h-4 w-4" /> Grant Builder
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs text-emerald-600">Finished</p>
          <p className="text-2xl font-bold text-emerald-800">{finished.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-400">Total Sections</p>
          <p className="text-2xl font-bold text-gray-900">{totalSections}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-400">Total Words</p>
          <p className="text-2xl font-bold text-gray-900">{totalWords.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <p className="text-xs text-brand-600">Avg Audit Score</p>
          <p className={`text-2xl font-bold ${scoreColor(avgScore)}`}>{avgScore || "—"}</p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24 text-gray-400 gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading finished grants…
        </div>
      )}

      {/* Empty */}
      {!loading && finished.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 py-24 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">No finished grants yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Grants appear here once they&apos;ve been built, audited, and improved
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Link href="/grants/crm" className="text-sm text-brand-600 hover:underline">Open CRM →</Link>
            <Link href="/grants/builder" className="text-sm text-emerald-600 hover:underline">Open Builder →</Link>
          </div>
        </div>
      )}

      {/* Grant cards */}
      {!loading && finished.length > 0 && (
        <div className="space-y-4">
          {finished.map((grant) => {
            const draft = draftByGrant[grant.id];
            const audit = draft ? auditByDraft[draft.id] : null;
            const expanded = expandedId === grant.id;
            const sectionCount = draft?.sections ? Object.keys(draft.sections).length : 0;
            const words = draft?.sections
              ? Object.values(draft.sections).reduce((s, t) => s + wordCount(t), 0)
              : 0;

            return (
              <div key={grant.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                {/* Card header */}
                <button
                  onClick={() => setExpandedId(expanded ? null : grant.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  {/* Score badge */}
                  {audit ? (
                    <div className={`shrink-0 flex flex-col items-center justify-center rounded-lg border px-3 py-2 ${scoreBg(audit.overallScore)}`}>
                      <span className={`text-2xl font-bold leading-none ${scoreColor(audit.overallScore)}`}>{audit.overallScore}</span>
                      <span className="text-[10px] font-semibold text-gray-500 mt-0.5">{audit.overallVerdict}</span>
                    </div>
                  ) : (
                    <div className="shrink-0 flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                      <span className="text-2xl font-bold leading-none text-gray-300">—</span>
                      <span className="text-[10px] font-semibold text-gray-400 mt-0.5">No audit</span>
                    </div>
                  )}

                  {/* Grant info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-base font-semibold text-gray-900 truncate">{grant.name}</p>
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <Sparkles className="h-3 w-3" /> Improved
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      {grant.founder && <span>{grant.founder}</span>}
                      {grant.amount && <span className="font-medium text-gray-600">{grant.amount}</span>}
                      {draft && <span>{sectionCount} sections · {words.toLocaleString()} words</span>}
                      {draft && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Updated {fmtDate(draft.updatedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-2">
                    {grant.url && (
                      <a
                        href={grant.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:text-brand-600 hover:border-brand-200"
                        title="Open grant URL"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <Link
                      href={`/grants/builder?grantId=${grant.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-600 hover:bg-emerald-100"
                      title="Open in Builder"
                    >
                      <PenLine className="h-4 w-4" />
                    </Link>
                    {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </div>
                </button>

                {/* Expanded details */}
                {expanded && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Pipeline journey */}
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Pipeline Journey</h3>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="flex items-center gap-1 rounded-full bg-blue-100 border border-blue-200 px-2.5 py-1 font-medium text-blue-700">
                            <Trophy className="h-3 w-3" /> CRM
                          </span>
                          <span className="text-gray-300">→</span>
                          <span className="flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-1 font-medium text-emerald-700">
                            <PenLine className="h-3 w-3" /> Built
                          </span>
                          <span className="text-gray-300">→</span>
                          <span className="flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-2.5 py-1 font-medium text-amber-700">
                            <ShieldCheck className="h-3 w-3" /> Audited
                          </span>
                          <span className="text-gray-300">→</span>
                          <span className="flex items-center gap-1 rounded-full bg-teal-100 border border-teal-200 px-2.5 py-1 font-medium text-teal-700">
                            <Sparkles className="h-3 w-3" /> Improved
                          </span>
                        </div>

                        {/* Audit summary */}
                        {audit && (
                          <div className="mt-4">
                            <h4 className="text-xs font-semibold text-gray-600 mb-1">Audit Summary</h4>
                            <p className="text-sm text-gray-600 leading-relaxed">{audit.summary}</p>
                            {audit.improvedAt && (
                              <p className="mt-1 text-xs text-teal-600">
                                Improved on {fmtDate(audit.improvedAt)}
                              </p>
                            )}
                          </div>
                        )}

                        {grant.crmNotes && (
                          <div className="mt-3">
                            <h4 className="text-xs font-semibold text-gray-600 mb-1">CRM Notes</h4>
                            <p className="text-sm text-gray-500">{grant.crmNotes}</p>
                          </div>
                        )}
                      </div>

                      {/* Sections preview */}
                      {draft?.sections && (
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
                            Sections ({sectionCount})
                          </h3>
                          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                            {Object.entries(draft.sections).map(([name, text]) => (
                              <div key={name} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                                <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                <span className="text-sm font-medium text-gray-700 truncate flex-1">{name}</span>
                                <span className="text-xs text-gray-400 shrink-0">{wordCount(text)} words</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action bar */}
                    <div className="mt-4 pt-3 border-t border-gray-200 flex items-center gap-2">
                      <Link
                        href={`/grants/builder?grantId=${grant.id}`}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                      >
                        <PenLine className="h-3.5 w-3.5" /> Open in Builder
                      </Link>
                      <Link
                        href="/grants/auditor"
                        className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" /> Re-audit
                      </Link>
                      {grant.url && (
                        <a
                          href={grant.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Grant Page
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
