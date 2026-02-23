"use client";

import { useState } from "react";
import {
  Building2, Search, Loader2, Save, Trash2,
  MapPin, Globe, Sparkles, Plus, Pencil, X, Check,
  ChevronDown, ChevronUp, Hospital, UserSearch,
} from "lucide-react";
import { useHospitals, STATUS_STYLES, type HospitalLead } from "@/hooks/useHospitals";
import { HospitalRow } from "./components/HospitalRow";
import { US_STATES, US_STATE_CITIES } from "@/lib/usCities";

export default function HospitalsPage() {
  const h = useHospitals();

  // Local UI state
  const [showLibrary, setShowLibrary]   = useState(true);
  const [showAdd, setShowAdd]           = useState(false);
  const [addForm, setAddForm]           = useState({ name: "", address: "", city: "", state: US_STATES[0], url: "", phone: "", type: "Public" });
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [editForm, setEditForm]         = useState<Partial<HospitalLead>>({});
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [bulkFinding, setBulkFinding]   = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === h.hospitals.length ? new Set() : new Set(h.hospitals.map((x) => x.id)));
  };

  const startEdit = (hospital: HospitalLead) => {
    setEditingId(hospital.id);
    setEditForm({ name: hospital.name, address: hospital.address, city: hospital.city, state: hospital.state, url: hospital.url, phone: hospital.phone, type: hospital.type, notes: hospital.notes, status: hospital.status });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await h.updateHospital(editingId, editForm);
    setEditingId(null);
  };

  const handleAdd = async () => {
    if (!addForm.name.trim()) return;
    const ok = await h.addHospital(addForm);
    if (ok) {
      setShowAdd(false);
      setAddForm({ name: "", address: "", city: "", state: US_STATES[0], url: "", phone: "", type: "Public" });
    }
  };

  const handleBulkFind = async () => {
    if (selectedIds.size === 0) return;
    setBulkFinding(true);
    await h.bulkFindDirectors(Array.from(selectedIds));
    setSelectedIds(new Set());
    setBulkFinding(false);
  };

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Hospital className="h-8 w-8 text-brand-600" />
          Hospital Scraper
        </h1>
        <p className="mt-1 text-gray-500">Search and store hospitals across US states for lead generation</p>
      </div>

      {/* Error banner */}
      {h.error && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="flex-1">{h.error}</span>
          <button onClick={() => h.fetchHospitals()} className="text-xs font-medium text-red-700 hover:bg-red-100 rounded px-2 py-0.5">Retry</button>
        </div>
      )}

      {/* Stats bar */}
      {h.hospitals.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-center">
            <p className="text-xl font-bold text-gray-700">{h.hospitals.length}</p>
            <p className="text-[10px] text-gray-500 uppercase">Total</p>
          </div>
          {Object.entries(h.stateGroups).sort((a, b) => b[1] - a[1]).map(([state, count]) => (
            <button key={state} onClick={() => h.setStateFilter(h.stateFilter === state ? "" : state)}
              className={`rounded-lg border px-4 py-2 text-center transition-colors ${h.stateFilter === state ? "border-brand-500 bg-brand-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
              <p className="text-xl font-bold text-gray-700">{count}</p>
              <p className="text-[10px] text-gray-500 uppercase truncate max-w-[80px]">{state}</p>
            </button>
          ))}
        </div>
      )}

      {/* Search Panel */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Search className="h-5 w-5 text-brand-600" />
          Search Hospitals by State &amp; City
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1"><MapPin className="inline h-4 w-4 mr-1" /> State</label>
            <select value={h.searchState} onChange={(e) => { h.setSearchState(e.target.value); h.setSearchCity(""); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500">
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1"><Building2 className="inline h-4 w-4 mr-1" /> City</label>
            <select value={h.searchCity} onChange={(e) => h.setSearchCity(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500">
              <option value="">All cities (statewide)</option>
              {(US_STATE_CITIES[h.searchState] ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Results</label>
            <select value={h.searchCount} onChange={(e) => h.setSearchCount(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500">
              {[5, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n} hospitals</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={h.handleSearch} disabled={h.searching}
              className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {h.searching ? <><Loader2 className="inline h-4 w-4 mr-1 animate-spin" /> Searching...</> : <><Search className="inline h-4 w-4 mr-1" /> Search</>}
            </button>
          </div>
        </div>

        {/* Quick city chips */}
        {(US_STATE_CITIES[h.searchState] ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            <span className="text-xs text-gray-500 mr-1 self-center">Quick:</span>
            {(US_STATE_CITIES[h.searchState] ?? []).slice(0, 15).map((c) => (
              <button key={c} onClick={() => h.setSearchCity(h.searchCity === c ? "" : c)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${h.searchCity === c ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {c}
              </button>
            ))}
          </div>
        )}

        {h.searchCity && (
          <p className="mb-3 text-sm text-brand-700 bg-brand-50 rounded-lg px-3 py-2">
            Searching hospitals in <strong>{h.searchCity}, {h.searchState}</strong>
          </p>
        )}
        {h.searchError && (
          <p className={`mt-3 text-sm rounded-lg p-3 ${h.searchError.includes("Saved") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {h.searchError}
          </p>
        )}
      </div>

      {/* Search Results Preview */}
      {h.results.length > 0 && (
        <div className="mb-6 rounded-xl border-2 border-brand-200 bg-brand-50/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Found {h.results.length} Hospitals — Review & Save</h2>
            <button onClick={h.handleSaveAll} disabled={h.saving}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
              {h.saving ? <><Loader2 className="inline h-4 w-4 mr-1 animate-spin" />Saving...</> : <><Save className="inline h-4 w-4 mr-1" />Save All</>}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="pb-2 pr-3">Hospital</th><th className="pb-2 pr-3">City</th><th className="pb-2 pr-3">Type</th><th className="pb-2 pr-3">URL</th><th className="pb-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {h.results.map((r, idx) => (
                  <tr key={idx} className="hover:bg-white">
                    <td className="py-2 pr-3"><p className="font-medium text-gray-900">{r.name}</p>{r.address && <p className="text-xs text-gray-500">{r.address}</p>}</td>
                    <td className="py-2 pr-3 text-gray-600">{r.city ?? "—"}</td>
                    <td className="py-2 pr-3">{r.type && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{r.type}</span>}</td>
                    <td className="py-2 pr-3">{r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline text-xs flex items-center gap-1"><Globe className="h-3 w-3" /> Visit</a> : "—"}</td>
                    <td className="py-2"><button onClick={() => h.removeFromResults(idx)} className="rounded p-1 text-gray-400 hover:text-red-500 hover:bg-red-50"><X className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Toast */}
      {h.toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-lg text-sm text-gray-800 max-w-sm animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
            <span>{h.toast}</span>
            <button onClick={() => h.setToast(null)} className="ml-2 text-gray-400 hover:text-gray-600"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}

      {/* Library */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <button onClick={() => setShowLibrary(!showLibrary)}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-brand-600" /> Hospital Database
            <span className="text-sm font-normal text-gray-500">({h.hospitals.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); handleBulkFind(); }}
              disabled={selectedIds.size === 0 || bulkFinding}
              className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-40 flex items-center gap-1">
              {bulkFinding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserSearch className="h-3.5 w-3.5" />}
              {bulkFinding ? "Finding..." : `Find Directors${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
            </button>
            <button onClick={(e) => { e.stopPropagation(); setShowAdd(!showAdd); }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" /> Add Manual
            </button>
            {showLibrary ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
          </div>
        </button>

        {/* Add manual form */}
        {showAdd && (
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <input placeholder="Hospital name *" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input placeholder="Address" value={addForm.address} onChange={(e) => setAddForm({ ...addForm, address: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input placeholder="City" value={addForm.city} onChange={(e) => setAddForm({ ...addForm, city: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <select value={addForm.state} onChange={(e) => setAddForm({ ...addForm, state: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input placeholder="Website URL" value={addForm.url} onChange={(e) => setAddForm({ ...addForm, url: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input placeholder="Phone" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <select value={addForm.type} onChange={(e) => setAddForm({ ...addForm, type: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option>Academic Medical Center</option><option>Teaching Hospital</option><option>Community Hospital</option><option>VA Hospital</option><option>Private</option>
              </select>
              <button onClick={handleAdd} disabled={!addForm.name.trim()} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
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
                <input type="text" placeholder="Search hospitals..." value={h.textSearch} onChange={(e) => h.setTextSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-1.5 pl-9 pr-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
              </div>
              <select value={h.stateFilter} onChange={(e) => { h.setStateFilter(e.target.value); h.setCityFilter(""); }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
                <option value="">All States</option>
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {h.stateFilter && (
                <select value={h.cityFilter} onChange={(e) => h.setCityFilter(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
                  <option value="">All Cities</option>
                  {(US_STATE_CITIES[h.stateFilter] ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {h.loading ? (
                <div className="py-12 text-center text-gray-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
              ) : h.hospitals.length === 0 ? (
                <div className="py-12 text-center">
                  <Hospital className="mx-auto h-10 w-10 text-gray-300" />
                  <p className="mt-3 font-medium text-gray-500">No hospitals yet</p>
                  <p className="mt-1 text-sm text-gray-400">Search a state above to get started</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase bg-gray-50">
                      <th className="pl-4 py-3 w-8">
                        <input type="checkbox" checked={selectedIds.size === h.hospitals.length && h.hospitals.length > 0} onChange={toggleSelectAll} className="rounded border-gray-300" />
                      </th>
                      <th className="px-3 py-3">Hospital</th><th className="px-3 py-3">City</th><th className="px-3 py-3">State</th>
                      <th className="px-3 py-3">Type</th><th className="px-3 py-3">Director / Contact</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {h.hospitals.map((hospital) =>
                      editingId === hospital.id ? (
                        <tr key={hospital.id} className="bg-brand-50/30">
                          <td className="pl-4 py-2"></td>
                          <td className="px-3 py-2">
                            <input value={editForm.name ?? ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full rounded border border-gray-300 px-2 py-1 text-sm" />
                            <input value={editForm.address ?? ""} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} placeholder="Address" className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs" />
                          </td>
                          <td className="px-3 py-2"><input value={editForm.city ?? ""} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} className="w-full rounded border border-gray-300 px-2 py-1 text-sm" /></td>
                          <td className="px-3 py-2 text-xs text-gray-600">{hospital.state}</td>
                          <td className="px-3 py-2">
                            <select value={editForm.type ?? ""} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} className="rounded border border-gray-300 px-2 py-1 text-xs">
                              <option>Academic Medical Center</option><option>Teaching Hospital</option><option>Community Hospital</option><option>VA Hospital</option><option>Private</option>
                            </select>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">—</td>
                          <td className="px-3 py-2">
                            <select value={editForm.status ?? "new"} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="rounded border border-gray-300 px-2 py-1 text-xs">
                              {Object.keys(STATUS_STYLES).map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={saveEdit} className="rounded p-1 text-green-600 hover:bg-green-50 mr-1"><Check className="h-4 w-4" /></button>
                            <button onClick={() => setEditingId(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
                          </td>
                        </tr>
                      ) : (
                        <HospitalRow
                          key={hospital.id}
                          hospital={hospital}
                          selected={selectedIds.has(hospital.id)}
                          onSelect={toggleSelect}
                          onEdit={startEdit}
                          onDelete={h.deleteHospital}
                          onEnrich={h.enrichHospital}
                          enrichingId={h.enrichingId}
                          onFindDirector={h.findDirector}
                          findingDirectorId={h.findingDirectorId}
                          onConvertToLead={h.convertToLead}
                          convertingId={h.convertingId}
                        />
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
