"use client";

import { useCallback, useState } from "react";
import {
  Star, Search, Loader2, X, RefreshCw, Download, AlertCircle,
  CheckSquare, Trash2, ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { useLeads, STATUS_STYLES, type Lead } from "@/hooks/useLeads";
import { exportToCsv } from "@/lib/exportCsv";
import { LeadRow } from "@/app/leads/components/LeadRow";
import { authFetch } from "@/lib/authFetch";

export default function QualifiedPage() {
  const {
    leads, loading, error, total,
    search, setSearch,
    sourceFilter, setSourceFilter,
    updateLead, deleteLead, fetchLeads,
  } = useLeads({ status: "qualified" });

  const [dismissedError, setDismissedError] = useState<string | null>(null);

  // ── Selection state ───────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting]     = useState(false);
  const [bulkRemoving, setBulkRemoving]     = useState(false);
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

  // ── Single-lead enrich (no-op placeholder — reuse from leads page) ────────
  const handleEnrich = useCallback(async (id: string) => {
    await authFetch("/api/leads/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadIds: [id] }),
    });
    await fetchLeads();
  }, [fetchLeads]);

  // ── Remove from Qualified (set back to "new") ─────────────────────────────
  const handleBulkRemove = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Move ${selectedIds.size} lead${selectedIds.size !== 1 ? "s" : ""} back to Scrape Leads?`)) return;
    setBulkRemoving(true);
    setBulkMsg(null);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          authFetch(`/api/leads/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "new" }),
          })
        )
      );
      await fetchLeads();
      setBulkMsg(`✓ ${selectedIds.size} lead${selectedIds.size !== 1 ? "s" : ""} moved back to Scrape Leads`);
      setSelectedIds(new Set());
    } catch {
      setBulkMsg("⚠ Some updates failed");
    } finally {
      setBulkRemoving(false);
    }
  };

  // ── Bulk delete ───────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Permanently delete ${selectedIds.size} lead${selectedIds.size !== 1 ? "s" : ""}?`)) return;
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

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
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
    exportToCsv(`qualified-leads-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
              <Star className="h-5 w-5 text-amber-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Qualified Leads</h1>
          </div>
          <p className="mt-1 text-gray-500 ml-11">
            Your best leads — handpicked for future exploration and outreach
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/leads"
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" /> Scrape Leads
          </Link>
          <button onClick={fetchLeads} title="Refresh" className="rounded-lg border border-gray-200 p-2.5 hover:bg-gray-50">
            <RefreshCw className="h-4 w-4 text-gray-500" />
          </button>
          <button
            onClick={handleExport}
            disabled={leads.length === 0}
            title={someSelected ? `Export ${selectedIds.size} selected` : "Export all qualified leads"}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            {someSelected ? `Export (${selectedIds.size})` : "Export CSV"}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="mb-5 flex items-center gap-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3">
          <p className="text-xs font-medium text-amber-600">Qualified Leads</p>
          <p className="text-2xl font-bold text-amber-700">{total}</p>
        </div>
        <div className="flex-1 rounded-xl border border-gray-200 bg-white px-5 py-3">
          <p className="text-xs font-medium text-gray-500">These leads have been manually selected as high-potential.</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Select leads in <Link href="/leads" className="text-brand-600 hover:underline">Scrape Leads</Link> and click <strong>Move to Qualified</strong> to add them here.
          </p>
        </div>
      </div>

      {/* Bulk action toolbar */}
      {someSelected && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
          <CheckSquare className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-800">
            {selectedIds.size} lead{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleBulkRemove}
              disabled={bulkRemoving}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {bulkRemoving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowLeft className="h-3.5 w-3.5" />}
              Move back to Leads
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

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, company…"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        >
          <option value="">All sources</option>
          <option value="linkedin">LinkedIn</option>
          <option value="webmd">WebMD</option>
          <option value="doctolib">Doctolib</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-20 text-center text-gray-400">
          <Loader2 className="mx-auto h-8 w-8 animate-spin mb-3" />
          Loading qualified leads…
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 py-20 text-center">
          <Star className="mx-auto h-12 w-12 text-amber-200 mb-3" />
          <p className="text-gray-500 font-medium">No qualified leads yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Go to{" "}
            <Link href="/leads" className="text-brand-600 hover:underline font-medium">
              Scrape Leads
            </Link>
            , select leads, and click <strong>Move to Qualified</strong>.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-amber-50">
                <th className="pl-4 pr-2 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400 cursor-pointer"
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
