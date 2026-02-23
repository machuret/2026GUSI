"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2, Search, Loader2, Save, Trash2, ExternalLink,
  MapPin, Phone, Globe, Sparkles, Plus, Pencil, X, Check,
  ChevronDown, ChevronUp, Hospital, RefreshCw,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";

// ── Types ────────────────────────────────────────────────────────────────────

interface HospitalLead {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state: string;
  country: string;
  url?: string | null;
  phone?: string | null;
  type?: string | null;
  beds?: number | null;
  notes?: string | null;
  status: string;
  enriched: boolean;
  createdAt: string;
}

interface SearchResult {
  name: string;
  address?: string | null;
  city?: string | null;
  state: string;
  country: string;
  url?: string | null;
  phone?: string | null;
  type?: string | null;
  beds?: number | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California",
  "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
  "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri",
  "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
  "District of Columbia",
];

const STATUS_STYLES: Record<string, string> = {
  new:       "bg-blue-100 text-blue-700 border-blue-200",
  contacted: "bg-purple-100 text-purple-700 border-purple-200",
  scraped:   "bg-amber-100 text-amber-700 border-amber-200",
  active:    "bg-green-100 text-green-700 border-green-200",
  archived:  "bg-gray-100 text-gray-500 border-gray-200",
};

// ── Main Page ────────────────────────────────────────────────────────────────

export default function HospitalsPage() {
  // Search state
  const [searchState, setSearchState]   = useState(US_STATES[0]);
  const [searchCount, setSearchCount]   = useState(10);
  const [searching, setSearching]       = useState(false);
  const [searchError, setSearchError]   = useState<string | null>(null);
  const [results, setResults]           = useState<SearchResult[]>([]);
  const [saving, setSaving]             = useState(false);

  // Library state
  const [hospitals, setHospitals]       = useState<HospitalLead[]>([]);
  const [loading, setLoading]           = useState(true);
  const [stateFilter, setStateFilter]   = useState("");
  const [textSearch, setTextSearch]     = useState("");
  const [showLibrary, setShowLibrary]   = useState(true);

  // Edit state
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [editForm, setEditForm]         = useState<Partial<HospitalLead>>({});

  // Add manual state
  const [showAdd, setShowAdd]           = useState(false);
  const [addForm, setAddForm]           = useState({ name: "", address: "", city: "", state: US_STATES[0], url: "", phone: "", type: "Public" });

  // Enriching
  const [enrichingId, setEnrichingId]   = useState<string | null>(null);

  // ── Fetch library ──────────────────────────────────────────────────────────

  const fetchHospitals = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (stateFilter) params.set("state", stateFilter);
      if (textSearch)  params.set("search", textSearch);
      const res = await authFetch(`/api/hospitals?${params}`);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = await res.json();
      setHospitals(data.hospitals ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [stateFilter, textSearch]);

  useEffect(() => { fetchHospitals(); }, [fetchHospitals]);

  // ── Search via AI ──────────────────────────────────────────────────────────

  const handleSearch = async () => {
    setSearching(true);
    setSearchError(null);
    setResults([]);
    try {
      const res = await authFetch("/api/hospitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: searchState, count: searchCount }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed (${res.status})`);
      }
      const data = await res.json();
      setResults(data.hospitals ?? []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  // ── Save all search results ────────────────────────────────────────────────

  const handleSaveAll = async () => {
    if (results.length === 0) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/hospitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hospitals: results }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setResults([]);
      setSearchError(null);
      if (data.skipped > 0) {
        setSearchError(`Saved ${data.saved}, skipped ${data.skipped} duplicates`);
      }
      fetchHospitals();
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ── Remove from preview ────────────────────────────────────────────────────

  const removeFromResults = (idx: number) => {
    setResults((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Edit hospital ──────────────────────────────────────────────────────────

  const startEdit = (h: HospitalLead) => {
    setEditingId(h.id);
    setEditForm({ name: h.name, address: h.address, city: h.city, state: h.state, url: h.url, phone: h.phone, type: h.type, notes: h.notes, status: h.status });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const res = await authFetch(`/api/hospitals/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Update failed");
      const data = await res.json();
      setHospitals((prev) => prev.map((h) => (h.id === editingId ? data.hospital : h)));
      setEditingId(null);
    } catch (err) {
      console.error(err);
    }
  };

  // ── Delete hospital ────────────────────────────────────────────────────────

  const deleteHospital = async (id: string) => {
    if (!confirm("Delete this hospital?")) return;
    try {
      await authFetch(`/api/hospitals/${id}`, { method: "DELETE" });
      setHospitals((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  // ── Enrich hospital ────────────────────────────────────────────────────────

  const enrichHospital = async (id: string) => {
    setEnrichingId(id);
    try {
      const res = await authFetch(`/api/hospitals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrich: true }),
      });
      if (!res.ok) throw new Error("Enrich failed");
      const data = await res.json();
      setHospitals((prev) => prev.map((h) => (h.id === id ? data.hospital : h)));
    } catch (err) {
      console.error(err);
    } finally {
      setEnrichingId(null);
    }
  };

  // ── Add manual hospital ────────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!addForm.name.trim()) return;
    try {
      const res = await authFetch("/api/hospitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.duplicate) { alert("Hospital already exists"); return; }
        throw new Error("Add failed");
      }
      setShowAdd(false);
      setAddForm({ name: "", address: "", city: "", state: US_STATES[0], url: "", phone: "", type: "Public" });
      fetchHospitals();
    } catch (err) {
      console.error(err);
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stateGroups = hospitals.reduce<Record<string, number>>((acc, h) => {
    acc[h.state] = (acc[h.state] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Hospital className="h-8 w-8 text-brand-600" />
          Hospital Scraper
        </h1>
        <p className="mt-1 text-gray-500">
          Search and store hospitals across US states for lead generation
        </p>
      </div>

      {/* Stats bar */}
      {hospitals.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-center">
            <p className="text-xl font-bold text-gray-700">{hospitals.length}</p>
            <p className="text-[10px] text-gray-500 uppercase">Total</p>
          </div>
          {Object.entries(stateGroups).sort((a, b) => b[1] - a[1]).map(([state, count]) => (
            <button
              key={state}
              onClick={() => setStateFilter(stateFilter === state ? "" : state)}
              className={`rounded-lg border px-4 py-2 text-center transition-colors ${
                stateFilter === state ? "border-brand-500 bg-brand-50" : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <p className="text-xl font-bold text-gray-700">{count}</p>
              <p className="text-[10px] text-gray-500 uppercase truncate max-w-[80px]">{state.replace(/ /g, " ")}</p>
            </button>
          ))}
        </div>
      )}

      {/* Search Panel */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Search className="h-5 w-5 text-brand-600" />
          Search Hospitals by State
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin className="inline h-4 w-4 mr-1" /> State
            </label>
            <select
              value={searchState}
              onChange={(e) => setSearchState(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            >
              {US_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Results</label>
            <select
              value={searchCount}
              onChange={(e) => setSearchCount(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            >
              {[5, 10, 15, 20, 30].map((n) => (
                <option key={n} value={n}>{n} hospitals</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={searching}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {searching ? (
            <><Loader2 className="inline h-4 w-4 mr-2 animate-spin" />Searching hospitals in {searchState}...</>
          ) : (
            <><Search className="inline h-4 w-4 mr-2" />Search {searchCount} Hospitals in {searchState}</>
          )}
        </button>

        {searchError && (
          <p className={`mt-3 text-sm rounded-lg p-3 ${searchError.includes("Saved") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {searchError}
          </p>
        )}
      </div>

      {/* Search Results Preview */}
      {results.length > 0 && (
        <div className="mb-6 rounded-xl border-2 border-brand-200 bg-brand-50/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Found {results.length} Hospitals — Review & Save
            </h2>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <><Loader2 className="inline h-4 w-4 mr-1 animate-spin" />Saving...</>
              ) : (
                <><Save className="inline h-4 w-4 mr-1" />Save All</>
              )}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="pb-2 pr-3">Hospital</th>
                  <th className="pb-2 pr-3">City</th>
                  <th className="pb-2 pr-3">Type</th>
                  <th className="pb-2 pr-3">URL</th>
                  <th className="pb-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map((r, idx) => (
                  <tr key={idx} className="hover:bg-white">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-gray-900">{r.name}</p>
                      {r.address && <p className="text-xs text-gray-500">{r.address}</p>}
                    </td>
                    <td className="py-2 pr-3 text-gray-600">{r.city ?? "—"}</td>
                    <td className="py-2 pr-3">
                      {r.type && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{r.type}</span>}
                    </td>
                    <td className="py-2 pr-3">
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline text-xs flex items-center gap-1">
                          <Globe className="h-3 w-3" /> Visit
                        </a>
                      ) : "—"}
                    </td>
                    <td className="py-2">
                      <button onClick={() => removeFromResults(idx)} className="rounded p-1 text-gray-400 hover:text-red-500 hover:bg-red-50">
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Library */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <button
          onClick={() => setShowLibrary(!showLibrary)}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
        >
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-brand-600" />
            Hospital Database
            <span className="text-sm font-normal text-gray-500">({hospitals.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setShowAdd(!showAdd); }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Add Manual
            </button>
            {showLibrary ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
          </div>
        </button>

        {/* Add manual form */}
        {showAdd && (
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <input placeholder="Hospital name *" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input placeholder="Address" value={addForm.address} onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input placeholder="City" value={addForm.city} onChange={(e) => setAddForm({ ...addForm, city: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <select value={addForm.state} onChange={(e) => setAddForm({ ...addForm, state: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input placeholder="Website URL" value={addForm.url} onChange={(e) => setAddForm({ ...addForm, url: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input placeholder="Phone" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <select value={addForm.type} onChange={(e) => setAddForm({ ...addForm, type: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option>Academic Medical Center</option><option>Teaching Hospital</option><option>Community Hospital</option><option>VA Hospital</option><option>Private</option>
              </select>
              <button onClick={handleAdd} disabled={!addForm.name.trim()}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                <Plus className="inline h-4 w-4 mr-1" /> Add Hospital
              </button>
            </div>
          </div>
        )}

        {showLibrary && (
          <div className="border-t border-gray-200">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 px-6 py-3 bg-gray-50 border-b border-gray-200">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search hospitals..."
                  value={textSearch}
                  onChange={(e) => setTextSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-1.5 pl-9 pr-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="">All States</option>
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {loading ? (
                <div className="py-12 text-center text-gray-400">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                </div>
              ) : hospitals.length === 0 ? (
                <div className="py-12 text-center">
                  <Hospital className="mx-auto h-10 w-10 text-gray-300" />
                  <p className="mt-3 font-medium text-gray-500">No hospitals yet</p>
                  <p className="mt-1 text-sm text-gray-400">Search a state above to get started</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase bg-gray-50">
                      <th className="px-6 py-3">Hospital</th>
                      <th className="px-3 py-3">City</th>
                      <th className="px-3 py-3">State</th>
                      <th className="px-3 py-3">Type</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">URL</th>
                      <th className="px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {hospitals.map((h) =>
                      editingId === h.id ? (
                        <tr key={h.id} className="bg-brand-50/30">
                          <td className="px-6 py-2">
                            <input value={editForm.name ?? ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm" />
                            <input value={editForm.address ?? ""} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                              placeholder="Address" className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs" />
                          </td>
                          <td className="px-3 py-2">
                            <input value={editForm.city ?? ""} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm" />
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">{h.state}</td>
                          <td className="px-3 py-2">
                            <select value={editForm.type ?? ""} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                              className="rounded border border-gray-300 px-2 py-1 text-xs">
                              <option>Academic Medical Center</option><option>Teaching Hospital</option><option>Community Hospital</option><option>VA Hospital</option><option>Private</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select value={editForm.status ?? "new"} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                              className="rounded border border-gray-300 px-2 py-1 text-xs">
                              {Object.keys(STATUS_STYLES).map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input value={editForm.url ?? ""} onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                              placeholder="URL" className="w-full rounded border border-gray-300 px-2 py-1 text-xs" />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={saveEdit} className="rounded p-1 text-green-600 hover:bg-green-50 mr-1"><Check className="h-4 w-4" /></button>
                            <button onClick={() => setEditingId(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
                          </td>
                        </tr>
                      ) : (
                        <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3">
                            <p className="font-medium text-gray-900">{h.name}</p>
                            {h.address && <p className="text-xs text-gray-500 mt-0.5">{h.address}</p>}
                            {h.phone && <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{h.phone}</p>}
                          </td>
                          <td className="px-3 py-3 text-gray-600">{h.city ?? "—"}</td>
                          <td className="px-3 py-3 text-xs text-gray-500">{h.state}</td>
                          <td className="px-3 py-3">
                            {h.type && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{h.type}</span>}
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[h.status] ?? STATUS_STYLES.new}`}>
                              {h.status}
                            </span>
                            {h.enriched && <span className="ml-1 text-[10px] text-green-600">enriched</span>}
                          </td>
                          <td className="px-3 py-3">
                            {h.url ? (
                              <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline text-xs flex items-center gap-1">
                                <ExternalLink className="h-3 w-3" /> Visit
                              </a>
                            ) : <span className="text-xs text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => enrichHospital(h.id)} disabled={enrichingId === h.id}
                                className="rounded p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Enrich with AI">
                                {enrichingId === h.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                              </button>
                              <button onClick={() => startEdit(h)}
                                className="rounded p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit">
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button onClick={() => deleteHospital(h.id)}
                                className="rounded p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
