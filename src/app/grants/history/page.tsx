"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Trophy, KanbanSquare, PenLine, UserCheck, Rss, ShieldCheck,
  History, Loader2, Sparkles, Upload, Download, X, AlertTriangle,
  CheckCircle2, Clock, Search, Filter,
} from "lucide-react";
import { authFetch, edgeFn } from "@/lib/authFetch";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/exportCsv";

// ── Types ────────────────────────────────────────────────────────────────────

export interface GrantHistoryRow {
  id: string;
  companyId: string;
  funderName: string;
  grantName?: string | null;
  partnerOrg?: string | null;
  region?: string | null;
  outcome?: "Won" | "Submitted" | "Rejected" | "Shortlisted" | "NotSubmitted" | "Exploratory" | "Active" | "Pending" | null;
  amount?: string | null;
  rejectionReason?: string | null;
  notes?: string | null;
  submittedAt?: string | null;
  createdAt: string;
}

// ── Outcome badge config ──────────────────────────────────────────────────────

const OUTCOME_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  Won:          { label: "Won",           bg: "bg-green-100",   text: "text-green-800" },
  Active:       { label: "Active",        bg: "bg-blue-100",    text: "text-blue-800" },
  Submitted:    { label: "Submitted",     bg: "bg-orange-100",  text: "text-orange-700" },
  Pending:      { label: "Pending",       bg: "bg-yellow-100",  text: "text-yellow-700" },
  Shortlisted:  { label: "Shortlisted",   bg: "bg-purple-100",  text: "text-purple-700" },
  Rejected:     { label: "Rejected",      bg: "bg-red-100",     text: "text-red-700" },
  NotSubmitted: { label: "Not Submitted", bg: "bg-gray-100",    text: "text-gray-600" },
  Exploratory:  { label: "Exploratory",   bg: "bg-teal-100",    text: "text-teal-700" },
};

const ALL_OUTCOMES = Object.keys(OUTCOME_CONFIG);
const ALL_REGIONS = ["Africa", "Southeast Asia", "Philippines", "Europe", "North America", "Global"];

function OutcomeBadge({ outcome }: { outcome?: string | null }) {
  if (!outcome) return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">—</span>;
  const cfg = OUTCOME_CONFIG[outcome] ?? { label: outcome, bg: "bg-gray-100", text: "text-gray-600" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", { month: "short", year: "numeric" });
}

// ── Summary stats ─────────────────────────────────────────────────────────────

function SummaryStats({ rows }: { rows: GrantHistoryRow[] }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) {
      c[r.outcome ?? "Unknown"] = (c[r.outcome ?? "Unknown"] ?? 0) + 1;
    }
    return c;
  }, [rows]);

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      {ALL_OUTCOMES.map((o) => {
        const cfg = OUTCOME_CONFIG[o];
        return (
          <div key={o} className={`rounded-xl border px-3 py-2.5 ${cfg.bg}`}>
            <p className={`text-[11px] font-medium ${cfg.text}`}>{cfg.label}</p>
            <p className={`text-xl font-bold ${cfg.text}`}>{counts[o] ?? 0}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Import modal ──────────────────────────────────────────────────────────────

interface ParsedRow {
  funderName: string;
  grantName?: string | null;
  partnerOrg?: string | null;
  region?: string | null;
  outcome?: string | null;
  amount?: string | null;
  rejectionReason?: string | null;
  notes?: string | null;
  submittedAt?: string | null;
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: (rows: GrantHistoryRow[]) => void }) {
  const [rawText, setRawText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!rawText.trim()) return;
    setParsing(true);
    setParseError(null);
    setParsed(null);
    try {
      const res = await authFetch("/api/grants/history/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      const data = await res.json();
      if (!res.ok) { setParseError(data.error ?? "Parse failed"); return; }
      setParsed(data.rows ?? []);
    } catch {
      setParseError("Network error — please try again");
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!parsed || parsed.length === 0) return;
    setSaving(true);
    try {
      const res = await authFetch(edgeFn("grant-history-crud"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsed }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Import failed"); return; }
      toast.success(`Imported ${data.inserted?.length ?? parsed.length} history records`);
      onImported(data.inserted ?? []);
      onClose();
    } catch {
      toast.error("Network error — import failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Import History via AI</h2>
            <p className="text-sm text-gray-500 mt-0.5">Paste raw text — partnership notes, handover docs, meeting notes. The AI will parse it into structured records.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {!parsed ? (
            <>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste your grant history text here..."
                rows={12}
                className="w-full rounded-xl border border-gray-300 p-3 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none font-mono"
              />
              {parseError && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {parseError}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>AI parsed <strong>{parsed.length} records</strong>. Review below then click Import.</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Funder</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Partner</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Region</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Outcome</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map((row, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">{row.funderName}</td>
                        <td className="px-3 py-2 text-gray-500">{row.partnerOrg ?? "—"}</td>
                        <td className="px-3 py-2 text-gray-500">{row.region ?? "—"}</td>
                        <td className="px-3 py-2"><OutcomeBadge outcome={row.outcome} /></td>
                        <td className="px-3 py-2 text-gray-500">{row.amount ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          {parsed ? (
            <>
              <button onClick={() => setParsed(null)} className="text-sm font-medium text-gray-500 hover:text-gray-700">← Edit text</button>
              <button onClick={handleImport} disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {saving ? "Importing…" : `Import ${parsed.length} records`}
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={handleParse} disabled={parsing || !rawText.trim()}
                className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
                {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {parsing ? "Parsing…" : "Parse with AI"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GrantHistoryPage() {
  const [rows, setRows] = useState<GrantHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("All");
  const [regionFilter, setRegionFilter] = useState<string>("All");

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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      const matchSearch = !search
        || r.funderName.toLowerCase().includes(q)
        || (r.grantName ?? "").toLowerCase().includes(q)
        || (r.partnerOrg ?? "").toLowerCase().includes(q)
        || (r.notes ?? "").toLowerCase().includes(q);
      const matchOutcome = outcomeFilter === "All" || r.outcome === outcomeFilter;
      const matchRegion = regionFilter === "All" || r.region === regionFilter;
      return matchSearch && matchOutcome && matchRegion;
    });
  }, [rows, search, outcomeFilter, regionFilter]);

  const handleImported = (newRows: GrantHistoryRow[]) => {
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
    const csvRows = filtered.map((r) => ({
      Funder: r.funderName,
      Grant: r.grantName ?? "",
      Partner: r.partnerOrg ?? "",
      Region: r.region ?? "",
      Outcome: r.outcome ?? "",
      Amount: r.amount ?? "",
      "Rejection Reason": r.rejectionReason ?? "",
      Notes: r.notes ?? "",
      "Submitted At": fmtDate(r.submittedAt),
    }));
    exportToCsv(`grant-history-${new Date().toISOString().slice(0, 10)}.csv`, csvRows);
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
            disabled={filtered.length === 0}
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

      {/* Summary stats */}
      {!loading && rows.length > 0 && <SummaryStats rows={rows} />}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search funder, partner, notes…"
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Filter className="h-3.5 w-3.5 text-gray-400" />
          {["All", ...ALL_OUTCOMES].map((o) => (
            <button key={o} onClick={() => setOutcomeFilter(o)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${outcomeFilter === o ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {o === "All" ? "All outcomes" : (OUTCOME_CONFIG[o]?.label ?? o)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {["All", ...ALL_REGIONS].map((r) => (
            <button key={r} onClick={() => setRegionFilter(r)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${regionFilter === r ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {r === "All" ? "All regions" : r}
            </button>
          ))}
        </div>
      </div>

      {/* States */}
      {loading && (
        <div className="py-20 text-center text-gray-400">
          <Loader2 className="mx-auto h-8 w-8 animate-spin mb-3" />
          Loading history…
        </div>
      )}

      {error && (
        <div className="py-20 text-center">
          <p className="text-red-600 font-medium mb-2">Failed to load history</p>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button onClick={fetchHistory} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Retry</button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 py-20 text-center">
          <History className="mx-auto h-8 w-8 text-gray-300 mb-3" />
          <p className="text-gray-400">
            {rows.length === 0
              ? "No history yet. Click \"Import via AI\" to add past submissions."
              : "No records match the current filter."}
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Funder / Grant</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-[160px]">Partner</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-[110px]">Region</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-[120px]">Outcome</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-[80px]">Amount</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-[80px]">Date</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Notes / Rejection</th>
                <th className="px-2 py-3 w-8 bg-gray-50" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 text-sm">{row.funderName}</p>
                    {row.grantName && row.grantName !== row.funderName && (
                      <p className="text-xs text-gray-400 mt-0.5">{row.grantName}</p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">{row.partnerOrg ?? "—"}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{row.region ?? "—"}</td>
                  <td className="px-3 py-3"><OutcomeBadge outcome={row.outcome} /></td>
                  <td className="px-3 py-3 text-xs text-gray-500">{row.amount ?? "—"}</td>
                  <td className="px-3 py-3 text-xs text-gray-400 whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {fmtDate(row.submittedAt)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500 max-w-xs">
                    {row.rejectionReason && (
                      <p className="text-red-600 font-medium mb-0.5">↳ {row.rejectionReason}</p>
                    )}
                    {row.notes && <p className="line-clamp-2">{row.notes}</p>}
                  </td>
                  <td className="px-2 py-3">
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                      title="Remove record"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-400">
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}{filtered.length !== rows.length ? ` (filtered from ${rows.length})` : ""}
          </div>
        </div>
      )}
    </div>
  );
}
