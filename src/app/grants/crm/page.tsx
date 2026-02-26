"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, PenLine, Sparkles, ExternalLink, Loader2,
  ChevronDown, ChevronUp, StickyNote, FlaskConical, X,
} from "lucide-react";
import { useGrants } from "@/hooks/useGrants";
import { authFetch } from "@/lib/authFetch";
import type { Grant } from "@/hooks/useGrants";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

type CrmStatus = "Researching" | "Pipeline" | "Active" | "Submitted" | "Won" | "Lost";

const COLUMNS: { status: CrmStatus; label: string; color: string; bg: string; border: string }[] = [
  { status: "Researching", label: "🔍 Researching",  color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200" },
  { status: "Pipeline",    label: "📋 Pipeline",     color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
  { status: "Active",      label: "✍️ Active",       color: "text-brand-700",  bg: "bg-brand-50",  border: "border-brand-200" },
  { status: "Submitted",   label: "📤 Submitted",    color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
  { status: "Won",         label: "🏆 Won",          color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200" },
  { status: "Lost",        label: "❌ Lost",         color: "text-gray-500",   bg: "bg-gray-50",   border: "border-gray-200" },
];

const STATUS_OPTIONS: CrmStatus[] = ["Researching", "Pipeline", "Active", "Submitted", "Won", "Lost"];

function GrantCrmCard({
  grant,
  onUpdate,
  companyDNA,
}: {
  grant: Grant;
  onUpdate: (id: string, d: Partial<Grant>) => Promise<unknown>;
  companyDNA: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(grant.crmNotes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [status, setStatus] = useState<CrmStatus | null>(grant.crmStatus ?? null);
  const [removingFromCrm, setRemovingFromCrm] = useState(false);

  // Sync local state when parent grant prop changes (e.g. after research auto-fill)
  useEffect(() => { setNotes(grant.crmNotes ?? ""); }, [grant.crmNotes]);
  useEffect(() => { setStatus(grant.crmStatus ?? null); }, [grant.crmStatus]);
  const [researching, setResearching] = useState(false);
  const [researchMsg, setResearchMsg] = useState<string | null>(null);
  const [researchErr, setResearchErr] = useState<string | null>(null);

  const [noteError, setNoteError] = useState<string | null>(null);

  const saveNotes = async () => {
    setSavingNotes(true); setNoteError(null);
    try {
      const result = await onUpdate(grant.id, { crmNotes: notes }) as { success?: boolean } | undefined;
      if (result && result.success === false) setNoteError("Failed to save notes");
    } catch { setNoteError("Network error — notes not saved"); }
    finally { setSavingNotes(false); }
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
    setResearching(true); setResearchErr(null); setResearchMsg(null);
    try {
      const res = await authFetch("/api/grants/research", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: grant.name, url: grant.url, founder: grant.founder, existingData: grant }),
      });
      const data = await res.json();
      if (data.success && data.filled) {
        await onUpdate(grant.id, data.filled);
        const count = Object.keys(data.filled).length;
        setResearchMsg(`✓ AI filled ${count} field${count !== 1 ? "s" : ""}`);
      } else setResearchErr(data.error || "Research failed");
    } catch { setResearchErr("Network error"); }
    finally { setResearching(false); }
  };

  const col = COLUMNS.find((c) => c.status === status);
  const deadlineMs = grant.deadlineDate ? new Date(grant.deadlineDate).getTime() : null;
  const daysLeft = deadlineMs ? Math.ceil((deadlineMs - Date.now()) / 86_400_000) : null;
  const deadlineUrgent = daysLeft !== null && daysLeft <= 14;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
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
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Action buttons */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {grant.url && (
            <a href={grant.url} target="_blank" rel="noopener noreferrer" title="Open grant URL"
              className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:text-brand-600 hover:border-brand-300">
              <ExternalLink className="h-3 w-3" /> URL
            </a>
          )}
          <button onClick={handleResearch} disabled={researching} title="AI Research"
            className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:text-brand-600 hover:border-brand-300 disabled:opacity-40">
            {researching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Research
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
          {researchMsg && <p className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">{researchMsg}</p>}
          {researchErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{researchErr}</p>}

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

export default function GrantsCrmPage() {
  const { grants, loading, companyDNA, updateGrant } = useGrants();
  const [search, setSearch] = useState("");

  const crmGrants = grants.filter((g) => g.crmStatus != null);
  const filtered = crmGrants.filter((g) => {
    const q = search.toLowerCase();
    return !search || g.name.toLowerCase().includes(q) || (g.founder ?? "").toLowerCase().includes(q);
  });

  const getColumn = (status: CrmStatus) => filtered.filter((g) => g.crmStatus === status);

  const [dragError, setDragError] = useState<string | null>(null);

  const onDragEnd = useCallback(async (result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;
    const newStatus = destination.droppableId as CrmStatus;
    const grant = grants.find((g) => g.id === draggableId);
    if (!grant || grant.crmStatus === newStatus) return;
    setDragError(null);
    const res = await updateGrant(draggableId, { crmStatus: newStatus });
    if (!res.success) {
      setDragError(`Failed to move "${grant.name.slice(0, 40)}" — please try again`);
    }
  }, [grants, updateGrant]);

  const totalInCrm = crmGrants.length;
  const wonCount = crmGrants.filter((g) => g.crmStatus === "Won").length;
  const activeCount = crmGrants.filter((g) => g.crmStatus === "Active" || g.crmStatus === "Submitted").length;
  const researchingCount = crmGrants.filter((g) => g.crmStatus === "Researching" || g.crmStatus === "Pipeline").length;

  return (
    <div className="mx-auto max-w-[1600px]">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/grants" className="flex items-center gap-1 text-sm text-gray-400 hover:text-brand-600">
              <ArrowLeft className="h-4 w-4" /> Grants
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Grants CRM</h1>
          <p className="mt-1 text-gray-500">Manage your grant pipeline — research, track progress, and write applications</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/grants" className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            ← All Grants
          </Link>
          <Link href="/grants/builder" className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700">
            <PenLine className="h-4 w-4" /> Grant Builder
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-400">Total in CRM</p>
          <p className="text-2xl font-bold text-gray-900">{totalInCrm}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-xs text-blue-600">Researching / Pipeline</p>
          <p className="text-2xl font-bold text-blue-800">{researchingCount}</p>
        </div>
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <p className="text-xs text-brand-600">Active / Submitted</p>
          <p className="text-2xl font-bold text-brand-800">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-xs text-green-600">Won</p>
          <p className="text-2xl font-bold text-green-800">{wonCount}</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search CRM grants…"
          className="w-full max-w-sm rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* Drag error */}
      {dragError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{dragError}</div>
      )}

      {/* Empty state */}
      {!loading && crmGrants.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 py-20 text-center">
          <FlaskConical className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No grants in CRM yet</p>
          <p className="text-sm text-gray-400 mt-1">Go to <Link href="/grants" className="text-brand-600 hover:underline">All Grants</Link> and click <strong>Send to CRM</strong> on any grant.</p>
        </div>
      )}

      {/* Kanban board */}
      {(loading || crmGrants.length > 0) && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-[900px]">
              {COLUMNS.map((col) => {
                const cards = getColumn(col.status);
                return (
                  <div key={col.status} className="flex-1 min-w-[220px]">
                    {/* Column header */}
                    <div className={`mb-3 flex items-center justify-between rounded-lg px-3 py-2 ${col.bg} border ${col.border}`}>
                      <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${col.bg} ${col.color}`}>{cards.length}</span>
                    </div>

                    {/* Droppable column */}
                    <Droppable droppableId={col.status}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`space-y-3 min-h-[80px] rounded-lg p-1 transition-colors ${snapshot.isDraggingOver ? `${col.bg} ring-2 ring-inset ${col.border.replace("border-", "ring-")}` : ""}`}
                        >
                          {loading ? (
                            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
                              <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-300" />
                            </div>
                          ) : cards.length === 0 && !snapshot.isDraggingOver ? (
                            <div className="rounded-xl border border-dashed border-gray-200 py-6 text-center">
                              <p className="text-xs text-gray-300">Drop grants here</p>
                            </div>
                          ) : (
                            cards.map((grant, index) => (
                              <Draggable key={grant.id} draggableId={grant.id} index={index}>
                                {(dragProvided, dragSnapshot) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    className={dragSnapshot.isDragging ? "opacity-90 rotate-1 scale-[1.02]" : ""}
                                  >
                                    <GrantCrmCard
                                      grant={grant}
                                      onUpdate={updateGrant}
                                      companyDNA={companyDNA}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))
                          )}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </div>
        </DragDropContext>
      )}
    </div>
  );
}
