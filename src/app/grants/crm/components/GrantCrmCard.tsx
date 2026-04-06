"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  PenLine, Sparkles, ExternalLink, Loader2,
  ChevronDown, ChevronUp, StickyNote, X, AlertTriangle, History,
} from "lucide-react";
import { authFetch, edgeFn } from "@/lib/authFetch";
import type { Grant } from "@/hooks/GrantsContext";
import type { GrantHistoryRow } from "@/app/grants/history/components/types";
import { COLUMNS, STATUS_OPTIONS, type CrmStatus, type ColumnDef } from "./crmConstants";

interface Props {
  grant: Grant;
  onUpdate: (id: string, d: Partial<Grant>) => Promise<unknown>;
}

export function GrantCrmCard({ grant, onUpdate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(grant.crmNotes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [status, setStatus] = useState<CrmStatus | null>(grant.crmStatus ?? null);
  const [removingFromCrm, setRemovingFromCrm] = useState(false);
  const [researching, setResearching] = useState(false);
  const [researchMsg, setResearchMsg] = useState<string | null>(null);
  const [researchErr, setResearchErr] = useState<string | null>(null);
  const [historyMatches, setHistoryMatches] = useState<GrantHistoryRow[] | null>(null);
  const historyFetched = useRef(false);
  const prevFounderRef = useRef(grant.founder);

  // Sync local state when parent grant prop changes (e.g. after research auto-fill)
  useEffect(() => { setNotes(grant.crmNotes ?? ""); }, [grant.crmNotes]);
  useEffect(() => { setStatus(grant.crmStatus ?? null); }, [grant.crmStatus]);

  // Reset history when founder changes (e.g. after AI Research fills it in)
  useEffect(() => {
    if (prevFounderRef.current !== grant.founder) {
      prevFounderRef.current = grant.founder;
      historyFetched.current = false;
      setHistoryMatches(null);
    }
  }, [grant.founder]);

  // Fetch previous engagement on first expand; guard empty-string founder
  useEffect(() => {
    if (!expanded || historyFetched.current || !grant.founder?.trim()) return;
    historyFetched.current = true;
    authFetch(`/api/grants/history/check?funderName=${encodeURIComponent(grant.founder.trim())}`)
      .then((res) => res.json())
      .then((data) => setHistoryMatches(data.matches ?? []))
      .catch(() => setHistoryMatches([]));
  }, [expanded, grant.founder]);

  const saveNotes = async () => {
    setSavingNotes(true);
    setNoteError(null);
    try {
      const result = await onUpdate(grant.id, { crmNotes: notes }) as { success?: boolean } | undefined;
      if (result && result.success === false) setNoteError("Failed to save notes");
    } catch {
      setNoteError("Network error — notes not saved");
    } finally {
      setSavingNotes(false);
    }
  };

  const moveStatus = async (s: CrmStatus) => {
    if (s === status) return;
    setStatus(s);
    await onUpdate(grant.id, { crmStatus: s });
  };

  const removeFromCrm = async () => {
    setRemovingFromCrm(true);
    try { await onUpdate(grant.id, { crmStatus: null }); }
    finally { setRemovingFromCrm(false); }
  };

  const handleResearch = async () => {
    setResearching(true);
    setResearchErr(null);
    setResearchMsg(null);
    try {
      const res = await authFetch(edgeFn("grant-research"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantId: grant.id, name: grant.name, url: grant.url, founder: grant.founder, existingData: grant }),
      });
      const data = await res.json();
      if (data.success && data.filled) {
        const updateResult = await onUpdate(grant.id, { ...data.filled, aiResearched: true }) as { success?: boolean; error?: string };
        if (updateResult?.success !== false) {
          const count = Object.keys(data.filled).length;
          setResearchMsg(`✓ AI filled ${count} field${count !== 1 ? "s" : ""}`);
        } else {
          setResearchErr(updateResult.error || "Failed to update grant");
        }
      } else {
        setResearchErr(data.error || "Research failed");
      }
    } catch {
      setResearchErr("Network error");
    } finally {
      setResearching(false);
    }
  };

  const col = COLUMNS.find((c: ColumnDef) => c.status === status);
  const deadlineMs = grant.deadlineDate ? new Date(grant.deadlineDate).getTime() : null;
  const daysLeft = deadlineMs ? Math.ceil((deadlineMs - Date.now()) / 86_400_000) : null;
  const deadlineUrgent = daysLeft !== null && daysLeft <= 14;
  const isExpired = daysLeft !== null && daysLeft < 0;
  const isStaleAnalysis = isExpired && grant.aiScore != null;

  return (
    <div className={`rounded-xl border shadow-sm hover:shadow-md transition-shadow ${isExpired ? "border-red-200 bg-red-50/30" : "border-gray-200 bg-white"}`}>
      {/* Expired banner */}
      {isExpired && (
        <div className="flex items-center gap-1.5 rounded-t-xl bg-red-100 px-3 py-1.5 text-[11px] font-semibold text-red-700">
          <AlertTriangle className="h-3 w-3" /> Deadline expired {Math.abs(daysLeft!)}d ago
          {isStaleAnalysis && <span className="ml-auto text-[10px] font-medium text-red-500">⚠ Fit score may be stale</span>}
        </div>
      )}

      {/* Card header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{grant.name}</p>
            {grant.founder && <p className="text-xs text-gray-400 mt-0.5">{grant.founder}</p>}
          </div>
          <button onClick={() => setExpanded((v) => !v)} className="shrink-0 text-gray-400 hover:text-brand-600 mt-0.5">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Meta row */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {grant.amount && (
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">{grant.amount}</span>
          )}
          {daysLeft !== null && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${deadlineUrgent ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-500"}`}>
              {daysLeft < 0 ? "Overdue" : daysLeft === 0 ? "Due today" : `${daysLeft}d left`}
            </span>
          )}
          {grant.matchScore != null && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${grant.matchScore >= 70 ? "bg-green-100 text-green-700" : grant.matchScore >= 40 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-600"}`}>
              {grant.matchScore}% match
            </span>
          )}
          {grant.complexityLabel && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              grant.complexityLabel === "Low" ? "bg-green-100 text-green-700" :
              grant.complexityLabel === "Medium" ? "bg-yellow-100 text-yellow-700" :
              grant.complexityLabel === "High" ? "bg-orange-100 text-orange-700" :
              "bg-red-100 text-red-700"
            }`}>{grant.complexityLabel}</span>
          )}
        </div>

        {/* Status selector */}
        <div className="mt-3">
          <select
            value={status ?? ""}
            onChange={(e) => moveStatus(e.target.value as CrmStatus)}
            className={`w-full rounded-lg border px-2 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-brand-500 ${col ? `${col.bg} ${col.color} ${col.border}` : "border-gray-200 bg-gray-50 text-gray-500"}`}
          >
            <option value="" disabled>Move to stage…</option>
            {STATUS_OPTIONS.map((s: CrmStatus) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Research feedback (always visible above fold) */}
        {researchMsg && <p className="mt-2 rounded-lg bg-green-50 border border-green-200 px-3 py-1.5 text-xs text-green-700">{researchMsg}</p>}
        {researchErr && <p className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs text-red-700">{researchErr}</p>}

        {/* Action buttons */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {grant.url && (
            <a href={grant.url} target="_blank" rel="noopener noreferrer" title="Open grant URL"
              className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:text-brand-600 hover:border-brand-300">
              <ExternalLink className="h-3 w-3" /> URL
            </a>
          )}
          <button onClick={handleResearch} disabled={researching} title={grant.aiResearched ? "Already researched - click to re-research" : "AI Research"}
            className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-40 ${
              grant.aiResearched 
                ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100" 
                : "border-gray-200 text-gray-500 hover:text-brand-600 hover:border-brand-300"
            }`}>
            {researching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {researching ? "Researching…" : grant.aiResearched ? "Researched ✓" : "Research"}
          </button>
          <Link href={`/grants/builder?grantId=${grant.id}`}
            className="flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
            <PenLine className="h-3 w-3" /> Write App
          </Link>
          <button onClick={removeFromCrm} disabled={removingFromCrm} title="Remove from CRM"
            className="ml-auto flex items-center gap-1 rounded-md border border-red-100 px-2 py-1 text-xs text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40">
            {removingFromCrm ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            Remove
          </button>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          {/* Previous engagement alert */}
          {historyMatches && historyMatches.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  Previously approached ({historyMatches.length} record{historyMatches.length !== 1 ? "s" : ""})
                </p>
                <Link href="/grants/history" className="text-[10px] font-medium text-amber-700 hover:underline">View all →</Link>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {historyMatches.map((m) => (
                  <span key={m.id} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    m.outcome === "Won"      ? "bg-green-100 text-green-800" :
                    m.outcome === "Rejected" ? "bg-red-100 text-red-700" :
                    m.outcome === "Active"   ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {m.outcome ?? "Unknown"}{m.submittedAt ? ` · ${new Date(m.submittedAt).getFullYear()}` : ""}{m.amount ? ` · ${m.amount}` : ""}
                  </span>
                ))}
              </div>
              {historyMatches[0]?.rejectionReason && (
                <p className="text-[10px] text-amber-700">↳ {historyMatches[0].rejectionReason}</p>
              )}
            </div>
          )}

          {/* Grant details */}
          <div className="space-y-2 text-xs text-gray-600">
            {grant.eligibility && (
              <div><p className="font-semibold uppercase tracking-wide text-gray-400 text-[10px]">Eligibility</p><p className="mt-0.5 whitespace-pre-wrap">{grant.eligibility}</p></div>
            )}
            {grant.howToApply && (
              <div><p className="font-semibold uppercase tracking-wide text-gray-400 text-[10px]">How to Apply</p><p className="mt-0.5 whitespace-pre-wrap">{grant.howToApply}</p></div>
            )}
            {grant.geographicScope && (
              <div><p className="font-semibold uppercase tracking-wide text-gray-400 text-[10px]">Scope</p><p className="mt-0.5">{grant.geographicScope}</p></div>
            )}
            {grant.notes && (
              <div><p className="font-semibold uppercase tracking-wide text-gray-400 text-[10px]">Grant Notes</p><p className="mt-0.5 whitespace-pre-wrap">{grant.notes}</p></div>
            )}
            {!grant.eligibility && !grant.howToApply && !grant.notes && (
              <p className="text-gray-400 italic">No details yet — click Research to auto-fill.</p>
            )}
          </div>

          {/* CRM Notes */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <StickyNote className="h-3 w-3 text-gray-400" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">CRM Notes</p>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add research notes, contacts, action items…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 resize-none"
            />
            <button
              onClick={saveNotes}
              disabled={savingNotes || notes === (grant.crmNotes ?? "")}
              className="mt-1.5 flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40"
            >
              {savingNotes ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Save Notes
            </button>
            {noteError && <p className="mt-1 text-xs text-red-600">{noteError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
