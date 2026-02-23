"use client";

import { useCallback, useState } from "react";
import {
  UserCheck, Search, Loader2, X, RefreshCw, Download, AlertCircle,
  CheckSquare, Trash2, Sparkles, Star, ArrowLeft, Building2,
} from "lucide-react";
import Link from "next/link";
import { useLeads, LEAD_STATUSES, STATUS_STYLES, type Lead } from "@/hooks/useLeads";
import { exportToCsv } from "@/lib/exportCsv";
import { leadToCsvRow } from "@/lib/leadExport";
import { LeadRow } from "@/app/leads/components/LeadRow";
import { authFetch } from "@/lib/authFetch";

export default function DirectorsPage() {
  const {
    leads, loading, error, total, page, setPage,
    search, setSearch,
    statusFilter, setStatusFilter,
    updateLead, deleteLead, addLeads, fetchLeads,
  } = useLeads({ source: "residency_director" });

  const [dismissedError, setDismissedError] = useState<string | null>(null);

  // ── Selection state ──────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set());
  const [bulkEnriching, setBulkEnriching]   = useState(false);
  const [bulkDeleting, setBulkDeleting]     = useState(false);
  const [bulkQualifying, setBulkQualifying] = useState(false);
  const [bulkMsg, setBulkMsg]               = useState<string | null>(null);

  const allSelected  = leads.length > 0 && leads.every((l) => selectedIds.has(l.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(leads.map((l) => l.id)));
  };

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);

  // ── Single-lead enrich ─────────────────────────────────────────────────
  const handleEnrich = useCallback(async (id: string) => {
    setBulkMsg(null);
    const res = await authFetch("/api/leads/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadIds: [id] }),
    });
    const data = await res.json();
    if (res.ok && data.updatedCount > 0) {
      await fetchLeads();
      setBulkMsg("✓ Lead re-enriched");
    } else {
      const err = data.enriched?.[0]?.error ?? data.error ?? "Enrichment failed";
      setBulkMsg(`⚠ ${err}`);
    }
  }, [fetchLeads]);

  // ── Bulk enrich ────────────────────────────────────────────────────────
  const handleBulkEnrich = async () => {
    if (selectedIds.size === 0) return;
    setBulkEnriching(true);
    setBulkMsg(null);
    try {
      const res = await authFetch("/api/leads/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enrichment failed");
      await fetchLeads();
      setBulkMsg(`✓ ${data.updatedCount} of ${data.total} leads re-enriched`);
      setSelectedIds(new Set());
    } catch (err) {
      setBulkMsg(`⚠ ${err instanceof Error ? err.message : "Enrichment failed"}`);
    } finally {
      setBulkEnriching(false);
    }
  };

  // ── Bulk qualify ───────────────────────────────────────────────────────
  const handleBulkQualify = async () => {
    if (selectedIds.size === 0) return;
    setBulkQualifying(true);
    setBulkMsg(null);
    try {
      const res = await authFetch("/api/leads/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: Array.from(selectedIds), updates: { status: "qualified" } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bulk qualify failed");
      await fetchLeads();
      setBulkMsg(`✓ ${data.updatedCount} director${data.updatedCount !== 1 ? "s" : ""} moved to Qualified`);
      setSelectedIds(new Set());
    } catch (err) {
      setBulkMsg(`⚠ ${err instanceof Error ? err.message : "Some updates failed"}`);
    } finally {
      setBulkQualifying(false);
    }
  };

  // ── Bulk delete ────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected director${selectedIds.size !== 1 ? "s" : ""}?`)) return;
    setBulkDeleting(true);
    setBulkMsg(null);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => deleteLead(id)));
      setBulkMsg(`✓ ${selectedIds.size} directors deleted`);
      setSelectedIds(new Set());
    } catch {
      setBulkMsg("⚠ Some deletes failed");
    } finally {
      setBulkDeleting(false);
    }
  };

  // ── Export CSV ─────────────────────────────────────────────────────────
  const handleExport = () => {
    const toExport = someSelected ? leads.filter((l) => selectedIds.has(l.id)) : leads;
    exportToCsv(`directors-${new Date().toISOString().slice(0, 10)}.csv`, toExport.map(leadToCsvRow));
  };

  const statusCounts = LEAD_STATUSES.reduce((acc, s) => {
    acc[s] = leads.filter((l) => l.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="mx-auto max-w-7xl">
      {error && error !== dismissedError && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="flex-1 text-sm text-amber-800">{error}</p>
          <button onClick={() => setDismissedError(error)} className="text-amber-500 hover:text-amber-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100">
              <UserCheck className="h-5 w-5 text-purple-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Residency Program Directors</h1>
          </div>
          <p className="mt-1 text-gray-500 ml-11">
            Full lead management for residency program directors exported from the Hospital Scraper
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/hospitals"
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <Building2 className="h-4 w-4" /> Hospital Scraper
          </Link>
          <button onClick={fetchLeads} title="Refresh" className="rounded-lg border border-gray-200 p-2.5 hover:bg-gray-50">
            <RefreshCw className="h-4 w-4 text-gray-500" />
          </button>
          <button
            onClick={handleExport}
            disabled={leads.length === 0}
            title={someSelected ? `Export ${selectedIds.size} selected` : "Export all directors"}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            {someSelected ? `Export (${selectedIds.size})` : "Export CSV"}
          </button>
        </div>
      </div>

      {/* Pipeline stats */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {LEAD_STATUSES.map((s) => (
          <button key={s}
            onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
            className={`shrink-0 rounded-xl border px-4 py-2.5 text-left transition-colors ${statusFilter === s ? STATUS_STYLES[s] : "border-gray-200 bg-white hover:border-gray-300"}`}
          >
            <p className="text-xs font-medium capitalize text-current">{s}</p>
            <p className="text-xl font-bold">{statusCounts[s] ?? 0}</p>
          </button>
        ))}
        <div className="shrink-0 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5">
          <p className="text-xs font-medium text-purple-600">Total Directors</p>
          <p className="text-xl font-bold text-purple-700">{total}</p>
        </div>
      </div>

      {/* Bulk action toolbar */}
      {someSelected && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5">
          <CheckSquare className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-medium text-purple-800">
            {selectedIds.size} director{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleBulkQualify}
              disabled={bulkQualifying}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {bulkQualifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />}
              Move to Qualified
            </button>
            <button
              onClick={handleBulkEnrich}
              disabled={bulkEnriching}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {bulkEnriching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Re-enrich
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              {bulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bulk feedback */}
      {bulkMsg && (
        <div className={`mb-3 flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm ${
          bulkMsg.startsWith("✓") ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-800"
        }`}>
          {bulkMsg}
          <button onClick={() => setBulkMsg(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Search */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search director name, email, hospital…"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-20 text-center text-gray-400">
          <Loader2 className="mx-auto h-8 w-8 animate-spin mb-3" />
          Loading directors…
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-purple-200 bg-purple-50 py-20 text-center">
          <UserCheck className="mx-auto h-12 w-12 text-purple-200 mb-3" />
          <p className="text-gray-500 font-medium">No residency program directors yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Go to{" "}
            <Link href="/hospitals" className="text-brand-600 hover:underline font-medium">
              Hospital Scraper
            </Link>
            , find directors, then click <strong>Export Directors</strong> to add them here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-purple-50">
                <th className="pl-4 pr-2 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    title={allSelected ? "Deselect all" : "Select all"}
                  />
                </th>
                <th className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Name</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Hospital</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Phone</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Email</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Location</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Source</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Added</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  selected={selectedIds.has(lead.id)}
                  onSelect={handleSelect}
                  onUpdate={updateLead}
                  onDelete={deleteLead}
                  onEnrich={handleEnrich}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 50 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Showing {Math.min((page - 1) * 50 + 1, total)}–{Math.min(page * 50, total)} of {total} directors
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              ← Previous
            </button>
            <span className="text-xs text-gray-500">Page {page} of {Math.ceil(total / 50)}</span>
            <button
              onClick={() => setPage(Math.min(Math.ceil(total / 50), page + 1))}
              disabled={page >= Math.ceil(total / 50)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
