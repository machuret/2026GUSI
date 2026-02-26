"use client";

import { useState } from "react";
import { Plus, Search, Loader2, ChevronDown, ChevronUp, Download, Sparkles, BarChart3, UserCheck, KanbanSquare, Trophy, PenLine, Rss, Clock, Trash2, CheckSquare, FlaskConical } from "lucide-react";
import Link from "next/link";
import { useGrants, type Grant } from "@/hooks/useGrants";
import { authFetch } from "@/lib/authFetch";
import { exportToCsv } from "@/lib/exportCsv";
import { GrantRow } from "./components/GrantRow";
import { AddGrantModal } from "./components/AddGrantModal";
import { GrantSearchModal } from "./components/GrantSearchModal";

export default function GrantsPage() {
  const { grants, loading, companyDNA, updateGrant: updateGrantRaw, deleteGrant, addGrant, fetchGrants } = useGrants();
  const updateGrant = async (id: string, d: Partial<Grant>) => { return await updateGrantRaw(id, d); };
  const [showAdd, setShowAdd] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const [decisionFilter, setDecisionFilter] = useState("All");
  const [deadlineFilter, setDeadlineFilter] = useState<"all" | "active" | "7" | "14" | "30" | "expired">("all");
  const [sortField, setSortField] = useState<"deadlineDate" | "fitScore" | "matchScore" | "complexityScore" | "name" | "geographicScope" | "amount">("matchScore");
  const [sortAsc, setSortAsc] = useState(false);
  const [ranking, setRanking] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkAnalysing, setBulkAnalysing] = useState(false);
  const [deletingExpired, setDeletingExpired] = useState(false);
  const [perPage, setPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const toggleSelect = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((g) => g.id)));
  };

  const bulkSendToCRM = async (status: string) => {
    setBulkBusy(true);
    setActionMsg(null);
    let ok = 0;
    for (const id of Array.from(selected)) {
      try {
        const res = await updateGrantRaw(id, { crmStatus: status as Grant["crmStatus"] });
        if (res.success) ok++;
      } catch { /* skip */ }
    }
    setActionMsg(`✓ Moved ${ok} grant${ok !== 1 ? "s" : ""} to ${status}`);
    setSelected(new Set());
    setBulkBusy(false);
  };

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} grant${selected.size !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBulkBusy(true);
    setActionMsg(null);
    let ok = 0;
    for (const id of Array.from(selected)) {
      try {
        const res = await deleteGrant(id);
        if (res.success) ok++;
      } catch { /* skip */ }
    }
    setMsg(`✓ Deleted ${ok} grant${ok !== 1 ? "s" : ""}`);
    setSelected(new Set());
    setBulkBusy(false);
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(v => !v);
    else { setSortField(field); setSortAsc(field === "name"); }
  };

  const handleRank = async () => {
    setRanking(true);
    setActionMsg(null);
    try {
      const res = await authFetch("/api/grants/rank", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error ?? "Ranking failed"); return; }
      setMsg(`✓ Ranked ${data.ranked} grants by profile match`);
      await fetchGrants();
      setSortField("matchScore");
      setSortAsc(false);
    } catch { setMsg("Ranking failed — try again"); }
    finally { setRanking(false); }
  };

  const setMsg = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 5000);
  };

  const handleScoreComplexity = async () => {
    setScoring(true);
    setActionMsg(null);
    try {
      const ids = selected.size > 0 ? Array.from(selected) : grants.map((g) => g.id);
      let scored = 0;
      for (let i = 0; i < ids.length; i += 20) {
        const batch = ids.slice(i, i + 20);
        const res = await authFetch("/api/grants/score-complexity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grantIds: batch }),
        });
        const data = await res.json();
        if (res.ok && data.results) scored += data.results.length;
      }
      setMsg(`✓ Complexity scored ${scored} grants`);
      await fetchGrants();
    } catch { setMsg("Scoring failed — try again"); }
    finally { setScoring(false); }
  };

  const handleBulkAnalyse = async () => {
    const ids = selected.size > 0 ? Array.from(selected) : grants.map((g) => g.id);
    if (ids.length === 0) return;
    if (!companyDNA) { setMsg("No company profile found — fill in Grant Profile or Settings → Company Info first"); return; }
    if (!confirm(`Run AI Fit analysis on ${ids.length} grant${ids.length !== 1 ? "s" : ""}? This may take a while.`)) return;
    setBulkAnalysing(true); setActionMsg(null);
    let ok = 0;
    let errors = 0;
    for (const id of ids) {
      try {
        const grant = grants.find((g) => g.id === id);
        if (!grant) continue;
        const res = await authFetch("/api/grants/analyse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grant, companyDNA }),
        });
        const data = await res.json();
        if (data.success && data.analysis) {
          const a = data.analysis;
          const fitScore = typeof a.score === "number" ? Math.max(1, Math.min(5, Math.round(a.score / 20))) : undefined;
          const decision = a.verdict === "Strong Fit" || a.verdict === "Good Fit" ? "Apply"
            : a.verdict === "Not Eligible" ? "No" : "Maybe";
          await updateGrantRaw(id, { fitScore, decision });
          ok++;
        } else { errors++; }
      } catch { errors++; }
    }
    await fetchGrants();
    setMsg(ok > 0 ? `✓ AI Fit analysed ${ok} of ${ids.length} grants${errors > 0 ? ` (${errors} failed)` : ""}` : `Analysis failed for all ${ids.length} grants — check Company Info or Grant Profile`);
    setSelected(new Set());
    setBulkAnalysing(false);
  };

  const handleDeleteExpired = async () => {
    const expiredIds = grants
      .filter(g => g.deadlineDate && new Date(g.deadlineDate).getTime() < Date.now())
      .map(g => g.id);
    if (expiredIds.length === 0) { setMsg("No expired grants found"); return; }
    if (!confirm(`Permanently delete ${expiredIds.length} expired grant${expiredIds.length !== 1 ? "s" : ""}?`)) return;
    setDeletingExpired(true); setActionMsg(null);
    let ok = 0;
    let fail = 0;
    for (const id of expiredIds) {
      try { const r = await deleteGrant(id); if (r.success) ok++; else fail++; } catch { fail++; }
    }
    setMsg(ok > 0
      ? `✓ Deleted ${ok} expired grant${ok !== 1 ? "s" : ""}${fail > 0 ? ` (${fail} failed)` : ""}`
      : `Failed to delete expired grants — try again`);
    setDeadlineFilter("all");
    setDeletingExpired(false);
  };

  const now = Date.now();
  const DAY = 86400000;

  const deadlineCounts = {
    active: grants.filter(g => !g.deadlineDate || new Date(g.deadlineDate).getTime() >= now).length,
    closing7: grants.filter(g => { if (!g.deadlineDate) return false; const d = new Date(g.deadlineDate).getTime() - now; return d >= 0 && d <= 7 * DAY; }).length,
    closing14: grants.filter(g => { if (!g.deadlineDate) return false; const d = new Date(g.deadlineDate).getTime() - now; return d >= 0 && d <= 14 * DAY; }).length,
    closing30: grants.filter(g => { if (!g.deadlineDate) return false; const d = new Date(g.deadlineDate).getTime() - now; return d >= 0 && d <= 30 * DAY; }).length,
    expired: grants.filter(g => { if (!g.deadlineDate) return false; return new Date(g.deadlineDate).getTime() < now; }).length,
  };

  const filtered = grants
    .filter((g) => {
      const q = search.toLowerCase();
      const matchSearch = !search || g.name.toLowerCase().includes(q) || (g.founder ?? "").toLowerCase().includes(q) || (g.notes ?? "").toLowerCase().includes(q);
      const matchDecision = decisionFilter === "All" || g.decision === decisionFilter;
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
      return matchSearch && matchDecision && matchDeadline;
    })
    .sort((a, b) => {
      let av: string | number = 0, bv: string | number = 0;
      if (sortField === "deadlineDate") { av = a.deadlineDate ? new Date(a.deadlineDate).getTime() : Infinity; bv = b.deadlineDate ? new Date(b.deadlineDate).getTime() : Infinity; }
      else if (sortField === "fitScore") { av = a.fitScore ?? 0; bv = b.fitScore ?? 0; }
      else if (sortField === "matchScore") { av = a.matchScore ?? -1; bv = b.matchScore ?? -1; }
      else if (sortField === "complexityScore") { av = a.complexityScore ?? -1; bv = b.complexityScore ?? -1; }
      else if (sortField === "geographicScope") { av = (a.geographicScope ?? "zzz").toLowerCase(); bv = (b.geographicScope ?? "zzz").toLowerCase(); }
      else if (sortField === "amount") { av = (a.amount ?? "").toLowerCase(); bv = (b.amount ?? "").toLowerCase(); }
      else { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      return av < bv ? (sortAsc ? -1 : 1) : av > bv ? (sortAsc ? 1 : -1) : 0;
    });

  const counts = {
    Apply:    grants.filter(g => g.decision === "Apply").length,
    Maybe:    grants.filter(g => g.decision === "Maybe").length,
    No:       grants.filter(g => g.decision === "No").length,
    Rejected: grants.filter(g => g.decision === "Rejected").length,
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
        {actionMsg && <span className="text-sm text-brand-700 font-medium">{actionMsg}</span>}
      </div>

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
          {deadlineCounts.expired > 0 && (
            <button
              onClick={handleDeleteExpired}
              disabled={deletingExpired}
              title="Delete all expired grants"
              className="flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
            >
              {deletingExpired ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Delete expired
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-20 text-center text-gray-400"><Loader2 className="mx-auto h-8 w-8 animate-spin mb-3" />Loading grants…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-20 text-center">
          <p className="text-gray-400">{grants.length === 0 ? "No grants yet. Click \"Add Grant\" to get started." : "No grants match the current filter."}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-2 py-3 w-8">
                  <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length}
                    onChange={toggleSelectAll} className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                </th>
                <th className="px-3 py-3 text-left">{renderSortBtn("name", "Grant")}</th>
                <th className="px-2 py-3 text-left w-[90px]">{renderSortBtn("geographicScope", "Country")}</th>
                <th className="px-2 py-3 text-left w-[100px]">{renderSortBtn("deadlineDate", "Deadline")}</th>
                <th className="px-2 py-3 text-left w-[100px]">{renderSortBtn("amount", "Amount")}</th>
                <th className="px-2 py-3 text-left w-[80px]">{renderSortBtn("matchScore", "Match")}</th>
                <th className="px-2 py-3 text-left w-[60px]">{renderSortBtn("fitScore", "Fit")}</th>
                <th className="px-2 py-3 text-left w-[90px] text-xs font-semibold uppercase tracking-wide text-gray-500">Decision</th>
                <th className="px-2 py-3 text-center w-[50px] text-xs font-semibold uppercase tracking-wide text-gray-500">···</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice((currentPage - 1) * perPage, currentPage * perPage).map((grant) => (
                <GrantRow key={grant.id} grant={grant} onUpdate={updateGrant} onDelete={deleteGrant} companyDNA={companyDNA}
                  selected={selected.has(grant.id)} onToggleSelect={() => toggleSelect(grant.id)} />
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
          <button onClick={() => bulkSendToCRM("Researching")} disabled={bulkBusy}
            className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50">
            → Researching
          </button>
          <button onClick={() => bulkSendToCRM("Pipeline")} disabled={bulkBusy}
            className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
            → Pipeline
          </button>
          <button onClick={() => bulkSendToCRM("Active")} disabled={bulkBusy}
            className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
            → Active
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <button onClick={bulkDelete} disabled={bulkBusy}
            className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <button onClick={() => setSelected(new Set())}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
