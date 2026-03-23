"use client";

import { useState, useMemo } from "react";
import { Plus, Search, Loader2, ChevronDown, ChevronUp, Download, Sparkles, BarChart3, UserCheck, KanbanSquare, Trophy, PenLine, Rss, Clock, Trash2, CheckSquare, FlaskConical, ListPlus, AlertTriangle, ShieldCheck, Copy, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useGrantsContext, type Grant } from "@/hooks/GrantsContext";
import { authFetch, edgeFn } from "@/lib/authFetch";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/exportCsv";
import { GrantRow } from "./components/GrantRow";
import { AddGrantModal } from "./components/AddGrantModal";
import { GrantSearchModal } from "./components/GrantSearchModal";
import { DuplicatesModal } from "./components/DuplicatesModal";
import { fuzzyMatchesExisting } from "@/lib/fuzzyMatch";

export default function GrantsPage() {
  const { grants, loading, error, companyDNA, updateGrant, deleteGrant, addGrant, fetchGrants, patchGrantsLocal, removeGrantsLocal } = useGrantsContext();
  const [showAdd, setShowAdd] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const [decisionFilter, setDecisionFilter] = useState("All");
  const [deadlineFilter, setDeadlineFilter] = useState<"all" | "active" | "7" | "14" | "30" | "expired">("active");
  const [sortField, setSortField] = useState<"deadlineDate" | "fitScore" | "matchScore" | "complexityScore" | "name" | "geographicScope" | "amount">("matchScore");
  const [sortAsc, setSortAsc] = useState(false);
  const [ranking, setRanking] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkAnalysing, setBulkAnalysing] = useState(false);
  const [bulkRevalidating, setBulkRevalidating] = useState(false);
  const [allFilteredSelected, setAllFilteredSelected] = useState(false);

  // Progress tracking
  const [analyseProgress, setAnalyseProgress]       = useState<{ done: number; total: number; errors: number } | null>(null);
  const [scoreProgress, setScoreProgress]           = useState<{ done: number; total: number; errors: number } | null>(null);
  const [rankProgress, setRankProgress]             = useState<{ done: number; total: number } | null>(null);
  const [revalidateProgress, setRevalidateProgress] = useState<{ done: number; total: number; errors: number } | null>(null);
  const [deletingExpired, setDeletingExpired] = useState(false);
  const [crmFilter, setCrmFilter] = useState<"all" | "in" | "out">("all");
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [perPage, setPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const toggleSelect = (id: string) => {
    setAllFilteredSelected(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkAddToCRM = async () => {
    const ids = Array.from(selected);
    if (!confirm(`Add ${ids.length} grant${ids.length !== 1 ? "s" : ""} to CRM?`)) return;
    setBulkBusy(true);
    try {
      const res = await authFetch(edgeFn("grant-bulk-update"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, data: { crmStatus: "Researching" } }),
      });
      const result = await res.json();
      if (result.success) {
        patchGrantsLocal(ids, { crmStatus: "Researching" as Grant["crmStatus"] });
        const actual = result.updated ?? ids.length;
        if (actual < ids.length) {
          toast.warning(`Only ${actual} of ${ids.length} grants updated in DB — check Vercel logs`);
        } else {
          toast.success(`Added ${actual} grant${actual !== 1 ? "s" : ""} to CRM`);
        }
      } else {
        toast.error(`Failed to add to CRM: ${result.error ?? "unknown error"}`);
      }
    } catch {
      toast.error("Network error — could not add to CRM. Please try again.");
    }
    setSelected(new Set());
    setBulkBusy(false);
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (!confirm(`Delete ${ids.length} grant${ids.length !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBulkBusy(true);
    try {
      const res = await authFetch(edgeFn("grant-bulk-delete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const result = await res.json();
      if (result.success) {
        removeGrantsLocal(ids);
        toast.success(`Deleted ${ids.length} grant${ids.length !== 1 ? "s" : ""}`);
      } else {
        toast.error(`Failed to delete: ${result.error ?? "unknown error"}`);
      }
    } catch {
      toast.error("Network error — could not delete. Please try again.");
    }
    setSelected(new Set());
    setBulkBusy(false);
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(v => !v);
    else { setSortField(field); setSortAsc(field === "name"); }
  };

  const handleRank = async () => {
    setRanking(true);
    const total = grants.length;
    setRankProgress({ done: 0, total });
    try {
      const res = await authFetch("/api/grants/rank", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Ranking failed"); return; }
      setRankProgress({ done: total, total });
      toast.success(`Ranked ${data.ranked} grants by profile match`);
      await fetchGrants();
      setSortField("matchScore");
      setSortAsc(false);
    } catch { toast.error("Ranking failed — try again"); }
    finally { setRanking(false); setRankProgress(null); }
  };


  const handleScoreComplexity = async () => {
    setScoring(true);
    const ids = selected.size > 0 ? Array.from(selected) : grants.map((g) => g.id);
    const BATCH = 20;
    const totalBatches = Math.ceil(ids.length / BATCH);
    setScoreProgress({ done: 0, total: ids.length, errors: 0 });
    let scored = 0;
    let errors = 0;
    try {
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        try {
          const res = await authFetch("/api/grants/score-complexity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ grantIds: batch }),
          });
          const data = await res.json();
          const batchScored = res.ok && data.results ? data.results.length : 0;
          scored += batchScored;
          if (!res.ok || batchScored === 0) errors += batch.length;
        } catch { errors += batch.length; }
        // Only count as errors if the whole batch failed (batchScored=0)
        setScoreProgress({ done: Math.min(i + BATCH, ids.length), total: ids.length, errors });
      }
      toast.success(`Complexity scored ${scored} of ${ids.length} grants${errors > 0 ? ` (${errors} failed)` : ""}`);
      await fetchGrants();
    } catch { toast.error("Scoring failed — try again"); }
    finally { setScoring(false); setScoreProgress(null); }
  };

  const handleBulkAnalyse = async () => {
    const nowMs = Date.now();
    const allIds = selected.size > 0 ? Array.from(selected) : grants.map((g) => g.id);
    const ids = allIds.filter(id => {
      const g = grants.find(gr => gr.id === id);
      if (!g) return false;
      return !g.deadlineDate || new Date(g.deadlineDate).getTime() >= nowMs;
    });
    if (ids.length === 0) { toast.warning("No active grants to analyse (all selected grants have expired deadlines)"); return; }
    const skipped = allIds.length - ids.length;
    const skipNote = skipped > 0 ? ` (${skipped} expired skipped)` : "";
    if (!confirm(`Run AI Fit analysis on ${ids.length} grant${ids.length !== 1 ? "s" : ""}${skipNote}? This may take a while.`)) return;
    setBulkAnalysing(true);
    setAnalyseProgress({ done: 0, total: ids.length, errors: 0 });
    let ok = 0;
    let errors = 0;
    for (let i = 0; i < ids.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 500));
      try {
        const res = await authFetch("/api/grants/analyse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grantId: ids[i] }),
        });
        const data = await res.json();
        if (data.success) { ok++; } else { errors++; }
      } catch { errors++; }
      setAnalyseProgress({ done: i + 1, total: ids.length, errors });
    }
    await fetchGrants();
    if (ok > 0) toast.success(`AI Fit analysed ${ok} of ${ids.length} grants${errors > 0 ? ` (${errors} failed)` : ""}`);
    else toast.error(`Analysis failed for all ${ids.length} grants — check Company Info or Grant Profile`);
    setSelected(new Set());
    setBulkAnalysing(false);
    setAnalyseProgress(null);
  };

  const handleBulkRevalidate = async () => {
    const ids = selected.size > 0 ? Array.from(selected) : grants.map((g) => g.id);
    if (ids.length === 0) { toast.warning("No grants to revalidate"); return; }
    if (!confirm(`Re-validate ${ids.length} grant${ids.length !== 1 ? "s" : ""}? This checks each URL is live and asks AI to confirm it\'s a real grant.\n\nThis may take a minute.`)) return;
    setBulkRevalidating(true);
    setRevalidateProgress({ done: 0, total: ids.length, errors: 0 });
    let ok = 0;
    let errors = 0;
    for (let i = 0; i < ids.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 300));
      try {
        const res = await authFetch("/api/grants/revalidate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grantId: ids[i] }),
        });
        const data = await res.json();
        if (data.success) ok++; else errors++;
      } catch { errors++; }
      setRevalidateProgress({ done: i + 1, total: ids.length, errors });
    }
    await fetchGrants();
    if (ok > 0) toast.success(`Revalidated ${ok} of ${ids.length} grant${ids.length !== 1 ? "s" : ""}${errors > 0 ? ` (${errors} failed)` : ""}`);
    else toast.error(`Revalidation failed for all ${ids.length} grants — check the edge function is deployed`);
    setSelected(new Set());
    setBulkRevalidating(false);
    setRevalidateProgress(null);
  };

  const handleDeleteExpired = async () => {
    const staleThreshold = Date.now() - (365 * 86400000);
    const expiredIds = grants
      .filter(g => g.deadlineDate && new Date(g.deadlineDate).getTime() < staleThreshold)
      .map(g => g.id);
    if (expiredIds.length === 0) { toast.info("No stale grants found (expired > 12 months)"); return; }
    if (!confirm(`Permanently delete ${expiredIds.length} grant${expiredIds.length !== 1 ? "s" : ""} expired over 12 months? Recently expired grants will be kept.`)) return;
    setDeletingExpired(true);
    let ok = 0;
    let fail = 0;
    for (const id of expiredIds) {
      try { const r = await deleteGrant(id); if (r.success) ok++; else fail++; } catch { fail++; }
    }
    if (ok > 0) toast.success(`Deleted ${ok} expired grant${ok !== 1 ? "s" : ""}${fail > 0 ? ` (${fail} failed)` : ""}`);
    else toast.error("Failed to delete expired grants — try again");
    setDeadlineFilter("all");
    setDeletingExpired(false);
  };

  const now = Date.now();
  const DAY = 86400000;
  const YEAR = 365 * DAY;

  // Shared base filter — applies search + deadline + CRM filters.
  // Decision filter is intentionally excluded so counts can be computed per-decision.
  const applyBaseFilters = (g: Grant) => {
    const q = search.toLowerCase();
    const matchSearch = !search || g.name.toLowerCase().includes(q) || (g.founder ?? "").toLowerCase().includes(q) || (g.notes ?? "").toLowerCase().includes(q);
    const matchCrm = crmFilter === "all" || (crmFilter === "in" ? !!g.crmStatus : !g.crmStatus);
    let matchDeadline = true;
    if (deadlineFilter === "active") {
      matchDeadline = !g.deadlineDate || new Date(g.deadlineDate).getTime() >= now;
    } else if (deadlineFilter !== "all" && g.deadlineDate) {
      const diff = new Date(g.deadlineDate).getTime() - now;
      if (deadlineFilter === "expired") matchDeadline = diff < 0;
      else matchDeadline = diff >= 0 && diff <= parseInt(deadlineFilter) * DAY;
    } else if (deadlineFilter !== "all" && !g.deadlineDate) {
      matchDeadline = false;
    }
    return matchSearch && matchDeadline && matchCrm;
  };

  const deadlineCounts = {
    active: grants.filter(g => !g.deadlineDate || new Date(g.deadlineDate).getTime() >= now).length,
    closing7: grants.filter(g => { if (!g.deadlineDate) return false; const d = new Date(g.deadlineDate).getTime() - now; return d >= 0 && d <= 7 * DAY; }).length,
    closing14: grants.filter(g => { if (!g.deadlineDate) return false; const d = new Date(g.deadlineDate).getTime() - now; return d >= 0 && d <= 14 * DAY; }).length,
    closing30: grants.filter(g => { if (!g.deadlineDate) return false; const d = new Date(g.deadlineDate).getTime() - now; return d >= 0 && d <= 30 * DAY; }).length,
    expired: grants.filter(g => { if (!g.deadlineDate) return false; return new Date(g.deadlineDate).getTime() < now; }).length,
    stale: grants.filter(g => { if (!g.deadlineDate) return false; return (now - new Date(g.deadlineDate).getTime()) > YEAR; }).length,
  };

  const filtered = grants
    .filter((g) => applyBaseFilters(g) && (decisionFilter === "All" || g.decision === decisionFilter))
    .sort((a, b) => {
      let av: string | number = 0, bv: string | number = 0;
      if (sortField === "deadlineDate") { av = a.deadlineDate ? new Date(a.deadlineDate).getTime() : Infinity; bv = b.deadlineDate ? new Date(b.deadlineDate).getTime() : Infinity; }
      else if (sortField === "fitScore") { av = a.aiScore ?? (a.fitScore != null ? a.fitScore * 20 : -1); bv = b.aiScore ?? (b.fitScore != null ? b.fitScore * 20 : -1); }
      else if (sortField === "matchScore") { av = a.matchScore ?? -1; bv = b.matchScore ?? -1; }
      else if (sortField === "complexityScore") { av = a.complexityScore ?? -1; bv = b.complexityScore ?? -1; }
      else if (sortField === "geographicScope") { av = (a.geographicScope ?? "zzz").toLowerCase(); bv = (b.geographicScope ?? "zzz").toLowerCase(); }
      else if (sortField === "amount") { av = (a.amount ?? "").toLowerCase(); bv = (b.amount ?? "").toLowerCase(); }
      else { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      return av < bv ? (sortAsc ? -1 : 1) : av > bv ? (sortAsc ? 1 : -1) : 0;
    });

  const pageItems = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);
  const allPageSelected = pageItems.length > 0 && pageItems.every(g => selected.has(g.id));
  const toggleSelectAll = () => {
    setAllFilteredSelected(false);
    if (allPageSelected) {
      setSelected(prev => { const next = new Set(prev); pageItems.forEach(g => next.delete(g.id)); return next; });
    } else {
      setSelected(prev => { const next = new Set(prev); pageItems.forEach(g => next.add(g.id)); return next; });
    }
  };
  const selectAllFiltered = () => {
    setSelected(new Set(filtered.map(g => g.id)));
    setAllFilteredSelected(true);
  };
  const clearAllSelected = () => {
    setSelected(new Set());
    setAllFilteredSelected(false);
  };

  // Counts scoped to base filters only (not decision) so badges match what clicking each decision tab would show.
  const filteredIgnoringDecision = grants.filter(applyBaseFilters);

  const counts = {
    Apply:    filteredIgnoringDecision.filter(g => g.decision === "Apply").length,
    Maybe:    filteredIgnoringDecision.filter(g => g.decision === "Maybe").length,
    No:       filteredIgnoringDecision.filter(g => g.decision === "No").length,
    Rejected: filteredIgnoringDecision.filter(g => g.decision === "Rejected").length,
  };

  const renderSortBtn = (field: typeof sortField, label: string) => (
    <button onClick={() => toggleSort(field)} className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800 uppercase tracking-wide">
      {label}{sortField === field ? (sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
    </button>
  );

  const complexityColor = (label?: string | null) => {
    if (label === "Low") return "bg-green-100 text-green-700";
    if (label === "Medium") return "bg-yellow-100 text-yellow-700";
    if (label === "High") return "bg-orange-100 text-orange-700";
    if (label === "Very High") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-500";
  };

  const existingNames = new Set(grants.map((g) => g.name.toLowerCase()));

  // Build duplicate id set for badge display only
  const duplicateIds = useMemo(() => {
    const ids = new Set<string>();
    for (let i = 0; i < grants.length; i++) {
      for (let j = i + 1; j < grants.length; j++) {
        const a = grants[i];
        const b = grants[j];
        if (fuzzyMatchesExisting(a.name, new Set([b.name.toLowerCase()]))) {
          ids.add(a.id);
          ids.add(b.id);
        }
      }
    }
    return ids;
  }, [grants]);

  return (
    <div className="mx-auto max-w-7xl">
      {showAdd && <AddGrantModal onClose={() => setShowAdd(false)} onSaved={(g) => addGrant(g)} />}
      {showSearch && (
        <GrantSearchModal
          onClose={() => setShowSearch(false)}
          onAdded={(g) => addGrant(g)}
          companyDNA={companyDNA}
          existingNames={existingNames}
        />
      )}
      {showDuplicatesModal && (
        <DuplicatesModal
          grants={grants}
          onClose={() => setShowDuplicatesModal(false)}
          onDeleted={(ids) => { removeGrantsLocal(ids); toast.success(`Removed ${ids.length} duplicate grant${ids.length !== 1 ? "s" : ""}`); }}
        />
      )}

      {/* Grants suite nav */}
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5">
        <span className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 border border-brand-200">
          <Trophy className="h-3.5 w-3.5" /> All Grants
        </span>
        <Link href="/grants/crm" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:text-indigo-600">
          <KanbanSquare className="h-3.5 w-3.5" /> CRM
        </Link>
        <Link href="/grants/builder" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:text-emerald-600">
          <PenLine className="h-3.5 w-3.5" /> Builder
        </Link>
        <Link href="/grants/profile" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:text-brand-600">
          <UserCheck className="h-3.5 w-3.5" /> Profile
        </Link>
        <Link href="/grants/crawler" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:text-brand-600">
          <Rss className="h-3.5 w-3.5" /> Crawler
        </Link>
        <Link href="/grants/auditor" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:text-amber-600">
          <ShieldCheck className="h-3.5 w-3.5" /> Auditor
        </Link>
      </div>

      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Grants</h1>
          <p className="mt-1 text-gray-500">Track, research, and prioritise grant opportunities</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const rows = filtered.map((g) => ({
                Name: g.name, Founder: g.founder ?? "", URL: g.url ?? "",
                Deadline: g.deadlineDate ? new Date(g.deadlineDate).toLocaleDateString("en-AU") : "",
                Amount: g.amount ?? "", "Geographic Scope": g.geographicScope ?? "",
                "Project Duration": g.projectDuration ?? "", Eligibility: g.eligibility ?? "",
                "How to Apply": g.howToApply ?? "", "Fit Score": g.fitScore ?? "",
                "Match Score": g.matchScore ?? "", "Complexity": g.complexityLabel ?? "",
                "Submission Effort": g.submissionEffort ?? "", Decision: g.decision ?? "",
                Notes: g.notes ?? "", Added: new Date(g.createdAt).toLocaleDateString("en-AU"),
              }));
              exportToCsv(`grants-${new Date().toISOString().slice(0, 10)}.csv`, rows);
            }}
            disabled={filtered.length === 0}
            title="Export visible grants to CSV"
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button onClick={() => setShowSearch(true)} className="flex items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-100">
            <Search className="h-4 w-4" /> Search Grants
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" /> Add Grant
          </button>
        </div>
      </div>

      {/* AI Actions bar */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
        <Link href="/grants/profile" className="flex items-center gap-2 rounded-lg border border-brand-300 bg-white px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100">
          <UserCheck className="h-4 w-4" /> Grant Profile
        </Link>
        <Link href="/grants/crm" className="flex items-center gap-2 rounded-lg border border-indigo-300 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50">
          <KanbanSquare className="h-4 w-4" /> Grants CRM
        </Link>
        <Link href="/grants/examples" className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50">
          <Trophy className="h-4 w-4" /> Examples
        </Link>
        <button
          onClick={handleRank}
          disabled={ranking || grants.length === 0}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {ranking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {ranking ? "Ranking…" : "Rank by Profile Match"}
        </button>
        <button
          onClick={handleScoreComplexity}
          disabled={scoring || grants.length === 0}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {scoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
          {scoring ? "Scoring…" : "Score Complexity"}
        </button>
        <button
          onClick={handleBulkAnalyse}
          disabled={bulkAnalysing || grants.length === 0}
          title={selected.size > 0 ? `Run AI Fit on ${selected.size} selected` : "Run AI Fit on all grants"}
          className="flex items-center gap-2 rounded-lg border border-purple-300 bg-white px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-60"
        >
          {bulkAnalysing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
          {bulkAnalysing ? "Analysing…" : selected.size > 0 ? `AI Fit (${selected.size} selected)` : "AI Fit (all)"}
        </button>
        <button
          onClick={handleBulkRevalidate}
          disabled={bulkRevalidating || grants.length === 0}
          title={selected.size > 0 ? `Re-validate ${selected.size} selected` : "Re-validate all grants"}
          className="flex items-center gap-2 rounded-lg border border-teal-300 bg-white px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-60"
        >
          {bulkRevalidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
          {bulkRevalidating ? "Revalidating…" : selected.size > 0 ? `Re-validate (${selected.size})` : "Re-validate (all)"}
        </button>
      </div>

      {/* Progress bars */}
      {(analyseProgress || scoreProgress || rankProgress || revalidateProgress) && (
        <div className="mt-3 space-y-2">
          {analyseProgress && (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-purple-700 font-medium">
                <span>AI Fit Analysis — {analyseProgress.done} / {analyseProgress.total} done{analyseProgress.errors > 0 ? ` · ${analyseProgress.errors} failed` : ""}</span>
                <span>{Math.round((analyseProgress.done / analyseProgress.total) * 100)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-purple-100 overflow-hidden">
                <div className="h-full rounded-full bg-purple-500 transition-all duration-300" style={{ width: `${(analyseProgress.done / analyseProgress.total) * 100}%` }} />
              </div>
            </div>
          )}
          {scoreProgress && (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-gray-600 font-medium">
                <span>Score Complexity — {scoreProgress.done} / {scoreProgress.total} done{scoreProgress.errors > 0 ? ` · ${scoreProgress.errors} failed` : ""}</span>
                <span>{Math.round((scoreProgress.done / scoreProgress.total) * 100)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                <div className="h-full rounded-full bg-gray-500 transition-all duration-300" style={{ width: `${(scoreProgress.done / scoreProgress.total) * 100}%` }} />
              </div>
            </div>
          )}
          {rankProgress && (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-brand-700 font-medium">
                <span>Ranking by Profile Match — {rankProgress.total} grants…</span>
                <span className="animate-pulse">Processing</span>
              </div>
              <div className="h-2 w-full rounded-full bg-brand-100 overflow-hidden">
                <div className="h-full rounded-full bg-brand-500 animate-pulse" style={{ width: rankProgress.done === rankProgress.total ? "100%" : "60%" }} />
              </div>
            </div>
          )}
          {revalidateProgress && (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-teal-700 font-medium">
                <span>Re-validating — {revalidateProgress.done} / {revalidateProgress.total} done{revalidateProgress.errors > 0 ? ` · ${revalidateProgress.errors} failed` : ""}</span>
                <span>{Math.round((revalidateProgress.done / revalidateProgress.total) * 100)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-teal-100 overflow-hidden">
                <div className="h-full rounded-full bg-teal-500 transition-all duration-300" style={{ width: `${(revalidateProgress.done / revalidateProgress.total) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-6">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-400">Total</p>
          <p className="text-2xl font-bold text-gray-900">{grants.length}</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-xs text-green-600">Apply</p>
          <p className="text-2xl font-bold text-green-800">{counts.Apply}</p>
        </div>
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
          <p className="text-xs text-yellow-600">Maybe</p>
          <p className="text-2xl font-bold text-yellow-800">{counts.Maybe}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-xs text-red-500">No</p>
          <p className="text-2xl font-bold text-red-700">{counts.No}</p>
        </div>
        <div className="rounded-xl border border-gray-300 bg-gray-100 px-4 py-3">
          <p className="text-xs text-gray-500">Rejected</p>
          <p className="text-2xl font-bold text-gray-700">{counts.Rejected}</p>
        </div>
        <button
          onClick={() => { setDeadlineFilter(deadlineFilter === "14" ? "all" : "14"); setSortField("deadlineDate"); setSortAsc(true); }}
          className={`rounded-xl border px-4 py-3 text-left transition-colors ${
            deadlineCounts.closing14 > 0
              ? "border-orange-300 bg-orange-50 hover:bg-orange-100"
              : "border-gray-200 bg-white"
          }`}
        >
          <p className="text-xs text-orange-600 flex items-center gap-1"><Clock className="h-3 w-3" /> Closing Soon</p>
          <p className={`text-2xl font-bold ${deadlineCounts.closing14 > 0 ? "text-orange-700" : "text-gray-400"}`}>{deadlineCounts.closing14}</p>
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="Search grants…"
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
        </div>
        <div className="flex flex-shrink-0 gap-1.5">
          {["All", "Apply", "Maybe", "No", "Rejected"].map((d) => (
            <button key={d} onClick={() => { setDecisionFilter(d); setCurrentPage(1); }}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${decisionFilter === d ? (d === "Rejected" ? "bg-gray-600 text-white" : "bg-brand-600 text-white") : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {d}{d !== "All" && counts[d as keyof typeof counts] > 0 ? ` (${counts[d as keyof typeof counts]})` : ""}
            </button>
          ))}
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-1.5 items-center">
          {(["all", "active", "7", "14", "30", "expired"] as const).map((d) => {
            const label = d === "all" ? "Any deadline" : d === "active" ? "Non-expired" : d === "expired" ? "Expired" : `≤ ${d}d`;
            const count = d === "active" ? deadlineCounts.active : d === "7" ? deadlineCounts.closing7 : d === "14" ? deadlineCounts.closing14 : d === "30" ? deadlineCounts.closing30 : d === "expired" ? deadlineCounts.expired : null;
            return (
              <button key={d} onClick={() => { setDeadlineFilter(d); setCurrentPage(1); if (d !== "all" && d !== "active") { setSortField("deadlineDate"); setSortAsc(true); } }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  deadlineFilter === d
                    ? d === "expired" ? "bg-red-600 text-white" : d === "active" ? "bg-green-600 text-white" : "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {label}{count != null && count > 0 ? ` (${count})` : ""}
              </button>
            );
          })}
          {deadlineCounts.stale > 0 && (
            <button
              onClick={handleDeleteExpired}
              disabled={deletingExpired}
              title={`Delete ${deadlineCounts.stale} grant${deadlineCounts.stale !== 1 ? 's' : ''} expired over 12 months`}
              className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50 whitespace-nowrap"
            >
              {deletingExpired ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Purge stale ({deadlineCounts.stale})
            </button>
          )}
        </div>
        <div className="flex flex-shrink-0 gap-1.5 items-center">
          {duplicateIds.size > 0 && (
            <button
              onClick={() => setShowDuplicatesModal(true)}
              className="flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100 px-3 py-2 text-sm font-medium whitespace-nowrap"
            >
              <Copy className="h-3.5 w-3.5" />
              Duplicates ({Math.floor(duplicateIds.size / 2)} pairs)
            </button>
          )}
        </div>
        <div className="flex flex-shrink-0 gap-1.5 items-center">
          <span className="text-xs text-gray-400 font-medium">CRM:</span>
          {([["all", "All"], ["out", "Not in CRM"], ["in", "In CRM"]] as const).map(([val, label]) => (
            <button key={val} onClick={() => { setCrmFilter(val); setCurrentPage(1); }}
              className={`rounded-full px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                crmFilter === val
                  ? val === "in" ? "bg-indigo-600 text-white" : val === "out" ? "bg-amber-500 text-white" : "bg-gray-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {label}{val === "in" ? ` (${grants.filter(g => !!g.crmStatus).length})` : val === "out" ? ` (${grants.filter(g => !g.crmStatus).length})` : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Duplicates warning banner */}
      {duplicateIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Copy className="h-4 w-4 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            {Math.floor(duplicateIds.size / 2)} possible duplicate pair{Math.floor(duplicateIds.size / 2) !== 1 ? "s" : ""} detected in your grant list
          </p>
          <button
            onClick={() => setShowDuplicatesModal(true)}
            className="ml-auto rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
          >
            Review &amp; Remove
          </button>
        </div>
      )}

      {/* Expired batch action banner */}
      {deadlineFilter === "expired" && filtered.length > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            {filtered.length} expired grant{filtered.length !== 1 ? "s" : ""} shown
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set(filtered.map(g => g.id)))}
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              Select all {filtered.length}
            </button>
            <button
              onClick={async () => {
                if (!confirm(`Permanently delete all ${filtered.length} expired grant${filtered.length !== 1 ? "s" : ""}?`)) return;
                setBulkBusy(true);
                try {
                  const ids = filtered.map(g => g.id);
                  const res = await authFetch(edgeFn("grant-bulk-delete"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ids }),
                  });
                  const result = await res.json();
                  if (result.success) {
                    removeGrantsLocal(ids);
                    toast.success(`Deleted ${result.deleted ?? ids.length} expired grant${ids.length !== 1 ? "s" : ""}`);
                    setDeadlineFilter("active");
                  } else {
                    toast.error(`Failed to delete: ${result.error ?? "unknown error"}`);
                  }
                } catch {
                  toast.error("Network error — could not delete. Please try again.");
                }
                clearAllSelected();
                setBulkBusy(false);
              }}
              disabled={bulkBusy}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {bulkBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Delete all expired
            </button>
          </div>
        </div>
      )}

      {/* Select-all-filtered banner */}
      {allPageSelected && filtered.length > pageItems.length && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5">
          {allFilteredSelected ? (
            <p className="text-sm text-brand-800 font-medium">All <span className="font-bold">{filtered.length}</span> grants selected</p>
          ) : (
            <p className="text-sm text-brand-800 font-medium">All <span className="font-bold">{pageItems.length}</span> grants on this page are selected</p>
          )}
          {allFilteredSelected ? (
            <button onClick={clearAllSelected} className="text-sm font-medium text-brand-700 hover:underline">Clear selection</button>
          ) : (
            <button onClick={selectAllFiltered} className="text-sm font-medium text-brand-700 hover:underline">Select all {filtered.length} results</button>
          )}
        </div>
      )}

      {/* Table */}
      {error && (
        <div className="py-20 text-center">
          <p className="text-red-600 font-medium mb-2">Failed to load grants</p>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button onClick={fetchGrants} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Retry</button>
        </div>
      )}

      {loading && (
        <div className="py-20 text-center text-gray-400"><Loader2 className="mx-auto h-8 w-8 animate-spin mb-3" />Loading grants…</div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 py-20 text-center">
          <p className="text-gray-400">{grants.length === 0 ? "No grants yet. Click \"Add Grant\" to get started." : "No grants match the current filter."}</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 sticky top-0 z-10">
                <th className="px-2 py-3 w-8 bg-gray-50">
                  <input type="checkbox" checked={allPageSelected}
                    onChange={toggleSelectAll} className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                </th>
                <th className="px-3 py-3 text-left bg-gray-50">{renderSortBtn("name", "Grant")}</th>
                <th className="px-2 py-3 text-left w-[90px] bg-gray-50">{renderSortBtn("geographicScope", "Country")}</th>
                <th className="px-2 py-3 text-left w-[100px] bg-gray-50">{renderSortBtn("deadlineDate", "Deadline")}</th>
                <th className="px-2 py-3 text-left w-[160px] bg-gray-50">{renderSortBtn("amount", "Amount")}</th>
                <th className="px-2 py-3 text-left w-[80px] bg-gray-50" title="AI Profile Match score (0–100) — how well this grant matches your Grant Profile">{renderSortBtn("matchScore", "Match")}</th>
                <th className="px-2 py-3 text-left w-[60px] bg-gray-50" title="Your manual Fit rating (1–5 stars) — set this yourself to track personal priority">{renderSortBtn("fitScore", "Fit ★")}</th>
                <th className="px-2 py-3 text-left w-[90px] bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">Decision</th>
                <th className="px-2 py-3 text-center w-[50px] bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">···</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((grant) => (
                <GrantRow key={grant.id} grant={grant} onUpdate={updateGrant} onDelete={deleteGrant} companyDNA={companyDNA}
                  selected={selected.has(grant.id)} onToggleSelect={() => toggleSelect(grant.id)}
                  duplicateOf={duplicateIds.has(grant.id) ? "duplicate" : undefined} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && filtered.length > 0 && (() => {
        const totalPages = Math.ceil(filtered.length / perPage);
        return (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Show</span>
              <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
                {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span>per page</span>
              <span className="ml-2 text-gray-400">·</span>
              <span className="text-gray-500">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                  className="rounded-lg px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40">First</button>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="rounded-lg px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40">Prev</button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 7) page = i + 1;
                  else if (currentPage <= 4) page = i + 1;
                  else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
                  else page = currentPage - 3 + i;
                  return (
                    <button key={page} onClick={() => setCurrentPage(page)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                        currentPage === page ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"
                      }`}>{page}</button>
                  );
                })}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="rounded-lg px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40">Next</button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                  className="rounded-lg px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40">Last</button>
              </div>
            )}
          </div>
        );
      })()}


      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-3 shadow-xl">
          <span className="text-sm font-semibold text-gray-800">
            <CheckSquare className="inline h-4 w-4 mr-1 text-brand-600" />
            {selected.size} selected
          </span>
          <div className="h-5 w-px bg-gray-200" />
          <span className="text-xs text-gray-400">
            {allFilteredSelected ? `All ${filtered.length} results` : `${selected.size} on page`}
          </span>
          <div className="h-5 w-px bg-gray-200" />
          <button onClick={bulkAddToCRM} disabled={bulkBusy}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
            <ListPlus className="h-3.5 w-3.5" /> Add to CRM
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <button onClick={handleBulkRevalidate} disabled={bulkRevalidating}
            className="flex items-center gap-1.5 rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100 disabled:opacity-50">
            {bulkRevalidating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />} Re-validate
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <button onClick={bulkDelete} disabled={bulkBusy}
            className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <button onClick={clearAllSelected}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
