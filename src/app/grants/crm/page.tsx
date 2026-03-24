"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, PenLine, Sparkles, Loader2, X,
  LayoutList, Columns2, History,
} from "lucide-react";
import { useGrantsContext, type Grant } from "@/hooks/GrantsContext";
import { authFetch } from "@/lib/authFetch";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { GrantCrmCard } from "./components/GrantCrmCard";
import { CrmListView } from "./components/CrmListView";
import { CrmStats, DeadlineAlertStrip, MassResearchProgress, CrmEmptyState } from "./components/CrmStats";
import { COLUMNS, sortByUrgency, formatCurrency, parseAmount, type CrmStatus, type ViewMode } from "./components/crmConstants";

export default function GrantsCrmPage() {
  const { grants, loading, optimisticUpdate } = useGrantsContext();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [dragError, setDragError] = useState<string | null>(null);
  const [massResearching, setMassResearching] = useState(false);
  const [researchProgress, setResearchProgress] = useState<{ done: number; total: number; errors: number } | null>(null);
  const researchAbortRef = useRef(false);
  const [resetting, setResetting] = useState(false);

  const safeUpdate = useCallback(async (id: string, data: Partial<Grant>) => {
    const result = await optimisticUpdate(id, data);
    if (!result.success) {
      toast.error(`Update failed: ${result.error ?? "unknown error"} — try refreshing the page`);
    }
    return result;
  }, [optimisticUpdate]);

  const handleMassResearch = useCallback(async () => {
    const crmGrants = grants.filter(g => !!g.crmStatus);
    if (crmGrants.length === 0) return;
    if (!confirm(`Run AI Research on all ${crmGrants.length} CRM grants to auto-fill missing fields?`)) return;
    researchAbortRef.current = false;
    setMassResearching(true);
    setResearchProgress({ done: 0, total: crmGrants.length, errors: 0 });
    let ok = 0; let errors = 0;
    for (let i = 0; i < crmGrants.length; i++) {
      if (researchAbortRef.current) break;
      const g = crmGrants[i];
      try {
        const res = await authFetch("/api/grants/research", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grantId: g.id }),
        });
        const data = await res.json();
        if (res.ok && data.success) ok++; else errors++;
      } catch { errors++; }
      setResearchProgress({ done: i + 1, total: crmGrants.length, errors });
    }
    setMassResearching(false);
    setResearchProgress(null);
    alert(`✓ Researched ${ok} of ${crmGrants.length} CRM grants${errors > 0 ? ` (${errors} failed)` : ""}.`);
  }, [grants]);

  const handleResetCrm = useCallback(async () => {
    const crmGrants = grants.filter(g => !!g.crmStatus);
    if (crmGrants.length === 0) return;
    if (!confirm(`Remove all ${crmGrants.length} grants from CRM? This only clears their CRM status — the grants themselves are not deleted.`)) return;
    setResetting(true);
    let ok = 0; let failed = 0;
    for (const g of crmGrants) {
      try {
        const r = await safeUpdate(g.id, { crmStatus: null });
        if (r.success) ok++; else failed++;
      } catch { failed++; }
    }
    if (failed > 0) toast.error(`${failed} of ${crmGrants.length} grants failed to remove from CRM`);
    else toast.success(`Removed all ${ok} grants from CRM`);
    setResetting(false);
  }, [grants, safeUpdate]);

  const onDragEnd = useCallback(async (result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;
    const newStatus = destination.droppableId as CrmStatus;
    const grant = grants.find((g) => g.id === draggableId);
    if (!grant || grant.crmStatus === newStatus) return;
    setDragError(null);
    const res = await safeUpdate(draggableId, { crmStatus: newStatus });
    if (!res.success) setDragError(`Failed to move "${grant.name.slice(0, 40)}" — please try again`);
  }, [grants, safeUpdate]);

  const crmGrants = grants.filter((g) => g.crmStatus != null);
  const filtered = crmGrants.filter((g) => {
    const q = search.toLowerCase();
    return !search || g.name.toLowerCase().includes(q) || (g.founder ?? "").toLowerCase().includes(q);
  });
  const getColumn = (status: CrmStatus) => sortByUrgency(filtered.filter((g) => g.crmStatus === status));

  return (
    <div className="mx-auto max-w-[1600px]">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/grants" className="flex items-center gap-1 text-sm text-gray-400 hover:text-brand-600">
              <ArrowLeft className="h-4 w-4" /> Grants
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Grants CRM</h1>
          <p className="mt-1 text-gray-500">Manage your grant pipeline — research, track progress, and write applications</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            <button onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "kanban" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              <Columns2 className="h-3.5 w-3.5" /> Kanban
            </button>
            <button onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "list" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              <LayoutList className="h-3.5 w-3.5" /> List
            </button>
          </div>
          <button onClick={handleMassResearch}
            disabled={massResearching || loading || grants.filter(g => !!g.crmStatus).length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50">
            {massResearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {massResearching ? `Researching… (${researchProgress?.done ?? 0}/${researchProgress?.total ?? 0})` : "Research All"}
          </button>
          <button onClick={handleResetCrm}
            disabled={resetting || loading || grants.filter(g => !!g.crmStatus).length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
            title="Remove all grants from CRM (does not delete the grants)">
            {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            Reset CRM
          </button>
          <Link href="/grants" className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            ← All Grants
          </Link>
          <Link href="/grants/history" className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-100">
            <History className="h-4 w-4" /> History
          </Link>
          <Link href="/grants/builder" className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700">
            <PenLine className="h-4 w-4" /> Grant Builder
          </Link>
        </div>
      </div>

      <CrmStats crmGrants={crmGrants} />
      <DeadlineAlertStrip crmGrants={crmGrants} />
      {researchProgress && (
        <MassResearchProgress
          done={researchProgress.done}
          total={researchProgress.total}
          errors={researchProgress.errors}
          onCancel={() => { researchAbortRef.current = true; }}
        />
      )}

      {/* Search */}
      <div className="mb-5">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search CRM grants…"
          className="w-full max-w-sm rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {dragError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{dragError}</div>
      )}

      {!loading && crmGrants.length === 0 && <CrmEmptyState />}

      {/* List view */}
      {!loading && crmGrants.length > 0 && viewMode === "list" && (
        <CrmListView grants={filtered} onUpdate={safeUpdate} />
      )}

      {/* Kanban view */}
      {(loading || crmGrants.length > 0) && viewMode === "kanban" && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-[900px]">
              {COLUMNS.map((col) => {
                const cards = getColumn(col.status);
                const colValue = cards.reduce((sum, g) => sum + (parseAmount(g.amount) ?? 0), 0);
                return (
                  <div key={col.status} className="flex-1 min-w-[220px]">
                    <div className={`mb-3 rounded-lg px-3 py-2 ${col.bg} border ${col.border}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${col.bg} ${col.color}`}>{cards.length}</span>
                      </div>
                      {colValue > 0 && (
                        <p className={`text-xs mt-0.5 font-medium ${col.color} opacity-70`}>{formatCurrency(colValue)}</p>
                      )}
                    </div>
                    <Droppable droppableId={col.status}>
                      {(provided, snapshot) => (
                        <div ref={provided.innerRef} {...provided.droppableProps}
                          className={`space-y-3 min-h-[80px] rounded-lg p-1 transition-colors ${snapshot.isDraggingOver ? `${col.bg} ring-2 ring-inset ${col.border.replace("border-", "ring-")}` : ""}`}>
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
                                  <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}
                                    className={dragSnapshot.isDragging ? "opacity-90 rotate-1 scale-[1.02]" : ""}>
                                    <GrantCrmCard grant={grant} onUpdate={safeUpdate} />
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
