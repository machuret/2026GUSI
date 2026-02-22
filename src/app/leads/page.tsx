"use client";

import { useCallback, useState } from "react";
import {
  Users, Search, Loader2, X, Zap, RefreshCw, Download, AlertCircle,
  CheckSquare, Trash2, Sparkles, Star,
} from "lucide-react";
import { useLeads, LEAD_STATUSES, STATUS_STYLES, type Lead } from "@/hooks/useLeads";
import { exportToCsv } from "@/lib/exportCsv";
import { ScraperModal } from "./components/ScraperModal";
import { LeadRow } from "./components/LeadRow";
import { authFetch } from "@/lib/authFetch";

export default function LeadsPage() {
  const {
    leads, loading, error, total,
    search, setSearch,
    statusFilter, setStatusFilter,
    sourceFilter, setSourceFilter,
    updateLead, deleteLead, addLeads, fetchLeads,
  } = useLeads();

  const [showScraper, setShowScraper] = useState(false);
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  // ── Selection state ──────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEnriching, setBulkEnriching]   = useState(false);
  const [bulkDeleting, setBulkDeleting]     = useState(false);
  const [bulkQualifying, setBulkQualifying] = useState(false);
  const [bulkMsg, setBulkMsg]               = useState<string | null>(null);

  const allSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)));
    }
  };

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);

  // ── Single-lead enrich ───────────────────────────────────────────────────
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
      setBulkMsg(`✓ Lead re-enriched`);
    } else {
      const err = data.enriched?.[0]?.error ?? data.error ?? "Enrichment failed";
      setBulkMsg(`⚠ ${err}`);
    }
  }, [fetchLeads]);

  // ── Bulk enrich ──────────────────────────────────────────────────────────
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

  // ── Bulk qualify ─────────────────────────────────────────────────────────
  const handleBulkQualify = async () => {
    if (selectedIds.size === 0) return;
    setBulkQualifying(true);
    setBulkMsg(null);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          authFetch(`/api/leads/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "qualified" }),
          })
        )
      );
      await fetchLeads();
      setBulkMsg(`✓ ${selectedIds.size} lead${selectedIds.size !== 1 ? "s" : ""} moved to Qualified`);
      setSelectedIds(new Set());
    } catch {
      setBulkMsg("⚠ Some updates failed");
    } finally {
      setBulkQualifying(false);
    }
  };

  // ── Bulk delete ──────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected lead${selectedIds.size !== 1 ? "s" : ""}?`)) return;
    setBulkDeleting(true);
    setBulkMsg(null);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => deleteLead(id)));
      setBulkMsg(`✓ ${selectedIds.size} leads deleted`);
      setSelectedIds(new Set());
    } catch {
      setBulkMsg("⚠ Some deletes failed");
    } finally {
      setBulkDeleting(false);
    }
  };

  // ── Bulk export ──────────────────────────────────────────────────────────
  const handleBulkExport = () => {
    const toExport = someSelected ? leads.filter((l) => selectedIds.has(l.id)) : leads;
    const rows = toExport.map((l: Lead) => ({
      "Full Name": l.fullName ?? "", "First Name": l.firstName ?? "", "Last Name": l.lastName ?? "",
      "Job Title": l.jobTitle ?? "", Company: l.company ?? "", Email: l.email ?? "",
      Phone: l.phone ?? "", City: l.city ?? "", State: l.state ?? "", Country: l.country ?? "",
      Location: l.location ?? "", Source: l.source ?? "", Status: l.status ?? "",
      LinkedIn: l.linkedinUrl ?? "", "Profile URL": l.profileUrl ?? "", Website: l.website ?? "",
      Specialties: Array.isArray(l.specialties) ? l.specialties.join("; ") : "",
      Rating: l.rating ?? "", Notes: l.notes ?? "",
      Added: l.createdAt ? new Date(l.createdAt).toLocaleString() : "",
    }));
    exportToCsv(`leads-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const statusCounts = LEAD_STATUSES.reduce((acc, s) => {
    acc[s] = leads.filter((l) => l.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="mx-auto max-w-7xl">
      {showScraper && (
        <ScraperModal
          onClose={() => setShowScraper(false)}
          onImported={(newLeads) => { addLeads(newLeads); setShowScraper(false); }}
        />
      )}

      {error && error !== dismissedError && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="flex-1 text-sm text-amber-800">{error}</p>
          <button onClick={() => setDismissedError(error)} className="text-amber-500 hover:text-amber-700"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scrape Leads</h1>
          <p className="mt-1 text-gray-500">Scrape, import, and manage your lead pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchLeads} title="Refresh" className="rounded-lg border border-gray-200 p-2.5 hover:bg-gray-50">
            <RefreshCw className="h-4 w-4 text-gray-500" />
          </button>
          <button
            onClick={handleBulkExport}
            disabled={leads.length === 0}
            title={someSelected ? `Export ${selectedIds.size} selected leads` : "Export all visible leads"}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <Download className="h-4 w-4" />{someSelected ? `Export (${selectedIds.size})` : "Export CSV"}
          </button>
          <button onClick={() => setShowScraper(true)} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
            <Zap className="h-4 w-4" /> Scrape Leads
          </button>
        </div>
      </div>

      {/* Bulk action toolbar */}
      {someSelected && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5">
          <CheckSquare className="h-4 w-4 text-brand-600" />
          <span className="text-sm font-medium text-brand-800">{selectedIds.size} lead{selectedIds.size !== 1 ? "s" : ""} selected</span>
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

      {/* Bulk action feedback */}
      {bulkMsg && (
        <div className={`mb-3 flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm ${
          bulkMsg.startsWith("✓") ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-800"
        }`}>
          {bulkMsg}
          <button onClick={() => setBulkMsg(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

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
        <div className="shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-2.5">
          <p className="text-xs font-medium text-gray-400">Total</p>
          <p className="text-xl font-bold text-gray-900">{total}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, company…"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
        </div>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
          <option value="">All sources</option>
          <option value="linkedin">LinkedIn</option>
          <option value="webmd">WebMD</option>
          <option value="doctolib">Doctolib</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-20 text-center text-gray-400"><Loader2 className="mx-auto h-8 w-8 animate-spin mb-3" />Loading leads…</div>
      ) : leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-20 text-center">
          <Users className="mx-auto h-10 w-10 text-gray-200 mb-3" />
          <p className="text-gray-400 text-sm">{total === 0 ? "No leads yet — click \"Scrape Leads\" to get started." : "No leads match the current filter."}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="pl-4 pr-2 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    title={allSelected ? "Deselect all" : "Select all"}
                  />
                </th>
                <th className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Name</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Workplace</th>
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
    </div>
  );
}
