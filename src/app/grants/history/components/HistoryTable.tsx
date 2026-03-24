"use client";

import { useMemo } from "react";
import { Clock, X, Loader2, History, Search, Filter } from "lucide-react";
import { OutcomeBadge } from "./OutcomeBadge";
import { ALL_OUTCOMES, ALL_REGIONS, OUTCOME_CONFIG, fmtDate, type GrantHistoryRow } from "./types";

interface Props {
  rows: GrantHistoryRow[];
  loading: boolean;
  error: string | null;
  search: string;
  outcomeFilter: string;
  regionFilter: string;
  onSearchChange: (v: string) => void;
  onOutcomeChange: (v: string) => void;
  onRegionChange: (v: string) => void;
  onDelete: (id: string) => void;
  onRetry: () => void;
}

export function SummaryStats({ rows }: { rows: GrantHistoryRow[] }) {
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

export function HistoryTable({
  rows, loading, error,
  search, outcomeFilter, regionFilter,
  onSearchChange, onOutcomeChange, onRegionChange,
  onDelete, onRetry,
}: Props) {
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

  return (
    <>
      {!loading && !error && rows.length > 0 && <SummaryStats rows={rows} />}

      {/* Filters — hidden while loading or in error state */}
      {!loading && !error && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search funder, partner, notes…"
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-gray-400" />
            {["All", ...ALL_OUTCOMES].map((o) => (
              <button
                key={o}
                onClick={() => onOutcomeChange(o)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  outcomeFilter === o ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {o === "All" ? "All outcomes" : (OUTCOME_CONFIG[o]?.label ?? o)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {["All", ...ALL_REGIONS].map((r) => (
              <button
                key={r}
                onClick={() => onRegionChange(r)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  regionFilter === r ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {r === "All" ? "All regions" : r}
              </button>
            ))}
          </div>
        </div>
      )}

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
          <button
            onClick={onRetry}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Retry
          </button>
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
                      onClick={() => onDelete(row.id)}
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
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
            {filtered.length !== rows.length ? ` (filtered from ${rows.length})` : ""}
          </div>
        </div>
      )}
    </>
  );
}
