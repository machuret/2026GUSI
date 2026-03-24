"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Trophy, KanbanSquare, PenLine, UserCheck, Rss, ShieldCheck,
  History, Sparkles, Download,
} from "lucide-react";
import { authFetch, edgeFn } from "@/lib/authFetch";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/exportCsv";
import { ImportModal } from "./components/ImportModal";
import { HistoryTable } from "./components/HistoryTable";
import { fmtDate } from "./components/types";

export type { GrantHistoryRow } from "./components/types";

export default function GrantHistoryPage() {
  const [rows, setRows] = useState<import("./components/types").GrantHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("All");
  const [regionFilter, setRegionFilter] = useState("All");

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(edgeFn("grant-history-crud"));
      if (!res.ok) throw new Error(`Failed to load history (${res.status})`);
      const data = await res.json();
      setRows(data.history ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  const handleImported = (newRows: import("./components/types").GrantHistoryRow[]) => {
    setRows((prev) => [...newRows, ...prev]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this history record?")) return;
    try {
      const res = await authFetch(`${edgeFn("grant-history-crud")}?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setRows((prev) => prev.filter((r) => r.id !== id));
        toast.success("Record removed");
      } else {
        toast.error(data.error ?? "Delete failed");
      }
    } catch {
      toast.error("Network error — delete failed");
    }
  };

  const handleExport = () => {
    const q = search.toLowerCase();
    const filtered = rows.filter((r) => {
      const matchSearch = !search
        || r.funderName.toLowerCase().includes(q)
        || (r.grantName ?? "").toLowerCase().includes(q)
        || (r.partnerOrg ?? "").toLowerCase().includes(q)
        || (r.notes ?? "").toLowerCase().includes(q);
      return matchSearch
        && (outcomeFilter === "All" || r.outcome === outcomeFilter)
        && (regionFilter === "All" || r.region === regionFilter);
    });
    exportToCsv(`grant-history-${new Date().toISOString().slice(0, 10)}.csv`, filtered.map((r) => ({
      Funder: r.funderName,
      Grant: r.grantName ?? "",
      Partner: r.partnerOrg ?? "",
      Region: r.region ?? "",
      Outcome: r.outcome ?? "",
      Amount: r.amount ?? "",
      "Rejection Reason": r.rejectionReason ?? "",
      Notes: r.notes ?? "",
      "Submitted At": fmtDate(r.submittedAt),
    })));
  };

  return (
    <div className="mx-auto max-w-7xl">
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={handleImported} />}

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
        <Link href="/grants/crawler" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:text-brand-600">
          <Rss className="h-3.5 w-3.5" /> Crawler
        </Link>
        <Link href="/grants/auditor" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:text-amber-600">
          <ShieldCheck className="h-3.5 w-3.5" /> Auditor
        </Link>
        <span className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 border border-brand-200">
          <History className="h-3.5 w-3.5" /> History
        </span>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Grant History</h1>
          <p className="mt-1 text-gray-500">Past submissions, funder approaches, and outcomes. Used by AI to flag previous engagement when analysing new grants.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={rows.length === 0}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Sparkles className="h-4 w-4" /> Import via AI
          </button>
        </div>
      </div>

      <HistoryTable
        rows={rows}
        loading={loading}
        error={error}
        search={search}
        outcomeFilter={outcomeFilter}
        regionFilter={regionFilter}
        onSearchChange={setSearch}
        onOutcomeChange={setOutcomeFilter}
        onRegionChange={setRegionFilter}
        onDelete={handleDelete}
        onRetry={fetchHistory}
      />
    </div>
  );
}
