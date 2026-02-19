"use client";

import { useState } from "react";
import {
  Users, Search, Loader2, X, Zap, RefreshCw, Download, AlertCircle,
} from "lucide-react";
import { useLeads, LEAD_STATUSES, STATUS_STYLES } from "@/hooks/useLeads";
import { exportToCsv } from "@/lib/exportCsv";
import { ScraperModal } from "./components/ScraperModal";
import { LeadRow } from "./components/LeadRow";

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
          <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
          <p className="mt-1 text-gray-500">Scrape, import, and manage your lead pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchLeads} title="Refresh" className="rounded-lg border border-gray-200 p-2.5 hover:bg-gray-50">
            <RefreshCw className="h-4 w-4 text-gray-500" />
          </button>
          <button
            onClick={() => {
              const rows = leads.map((l) => ({
                "Full Name": l.fullName ?? "", "Job Title": l.jobTitle ?? "",
                Company: l.company ?? "", Email: l.email ?? "",
                Phone: l.phone ?? "", Location: l.location ?? "",
                Source: l.source ?? "", Status: l.status ?? "",
                LinkedIn: l.linkedinUrl ?? "", "Profile URL": l.profileUrl ?? "",
                Specialties: Array.isArray(l.specialties) ? l.specialties.join("; ") : "",
                Notes: l.notes ?? "",
                Added: l.createdAt ? new Date(l.createdAt).toLocaleDateString("en-AU") : "",
              }));
              exportToCsv(`leads-${new Date().toISOString().slice(0, 10)}.csv`, rows);
            }}
            disabled={leads.length === 0}
            title="Export visible leads to CSV"
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button onClick={() => setShowScraper(true)} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
            <Zap className="h-4 w-4" /> Scrape Leads
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
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Name</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Company</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Email</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Location</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Source</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <LeadRow key={lead.id} lead={lead} onUpdate={updateLead} onDelete={deleteLead} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
