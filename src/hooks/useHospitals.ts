"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { US_STATES } from "@/lib/usCities";

// ── Types ────────────────────────────────────────────────────────────────────

export interface HospitalLead {
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
  directorName?: string | null;
  directorEmail?: string | null;
  directorPhone?: string | null;
  directorTitle?: string | null;
  createdAt: string;
}

export interface SearchResult {
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

export const STATUS_STYLES: Record<string, string> = {
  new:       "bg-blue-100 text-blue-700 border-blue-200",
  contacted: "bg-purple-100 text-purple-700 border-purple-200",
  scraped:   "bg-amber-100 text-amber-700 border-amber-200",
  active:    "bg-green-100 text-green-700 border-green-200",
  archived:  "bg-gray-100 text-gray-500 border-gray-200",
};

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useHospitals() {
  // Library state
  const [hospitals, setHospitals]       = useState<HospitalLead[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [stateFilter, setStateFilter]   = useState("");
  const [cityFilter, setCityFilter]     = useState("");
  const [textSearch, setTextSearch]     = useState("");

  // Search state
  const [searchState, setSearchState]   = useState(US_STATES[0]);
  const [searchCity, setSearchCity]     = useState("");
  const [searchCount, setSearchCount]   = useState(10);
  const [searching, setSearching]       = useState(false);
  const [searchError, setSearchError]   = useState<string | null>(null);
  const [results, setResults]           = useState<SearchResult[]>([]);
  const [saving, setSaving]             = useState(false);

  // Action state
  const [enrichingId, setEnrichingId]           = useState<string | null>(null);
  const [findingDirectorId, setFindingDirectorId] = useState<string | null>(null);
  const [convertingId, setConvertingId]         = useState<string | null>(null);
  const [toast, setToast]                       = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }, []);

  // ── Fetch library ──────────────────────────────────────────────────────────

  const fetchHospitals = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (stateFilter) params.set("state", stateFilter);
      if (cityFilter)  params.set("city", cityFilter);
      if (textSearch)  params.set("search", textSearch);
      const res = await authFetch(`/api/hospitals?${params}`);
      if (!res.ok) throw new Error(`Failed to load hospitals (${res.status})`);
      const data = await res.json();
      setHospitals(data.hospitals ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load hospitals");
    } finally {
      setLoading(false);
    }
  }, [stateFilter, cityFilter, textSearch]);

  useEffect(() => { fetchHospitals(); }, [fetchHospitals]);

  // ── Search via AI ──────────────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    setSearching(true);
    setSearchError(null);
    setResults([]);
    try {
      const res = await authFetch("/api/hospitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: searchState, city: searchCity || undefined, count: searchCount }),
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
  }, [searchState, searchCity, searchCount]);

  // ── Save all search results ────────────────────────────────────────────────

  const handleSaveAll = useCallback(async () => {
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
        showToast(`Saved ${data.saved}, skipped ${data.skipped} duplicates`);
      } else {
        showToast(`Saved ${data.saved} hospitals`);
      }
      fetchHospitals();
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [results, fetchHospitals, showToast]);

  const removeFromResults = useCallback((idx: number) => {
    setResults((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ── Edit hospital ──────────────────────────────────────────────────────────

  const updateHospital = useCallback(async (id: string, fields: Partial<HospitalLead>) => {
    try {
      const res = await authFetch(`/api/hospitals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error("Update failed");
      const data = await res.json();
      setHospitals((prev) => prev.map((h) => (h.id === id ? data.hospital : h)));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Update failed");
    }
  }, [showToast]);

  // ── Delete hospital ────────────────────────────────────────────────────────

  const deleteHospital = useCallback(async (id: string) => {
    if (!confirm("Delete this hospital?")) return;
    try {
      await authFetch(`/api/hospitals/${id}`, { method: "DELETE" });
      setHospitals((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed");
    }
  }, [showToast]);

  // ── Enrich hospital ────────────────────────────────────────────────────────

  const enrichHospital = useCallback(async (id: string) => {
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
      const fields = (data.fieldsUpdated as string[]) ?? [];
      showToast(fields.length > 0 ? `Enriched: ${fields.join(", ")}` : "No new fields to enrich");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Enrich failed");
    } finally {
      setEnrichingId(null);
    }
  }, [showToast]);

  // ── Find Director ──────────────────────────────────────────────────────────

  const findDirector = useCallback(async (id: string, residencyCategory?: string) => {
    setFindingDirectorId(id);
    try {
      const res = await authFetch(`/api/hospitals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findDirector: true, ...(residencyCategory ? { residencyCategory } : {}) }),
      });
      if (!res.ok) throw new Error("Find Director failed");
      const data = await res.json();
      setHospitals((prev) => prev.map((h) => (h.id === id ? data.hospital : h)));
      const fields = (data.fieldsUpdated as string[]) ?? [];
      const conf = data.confidence ?? "";
      const leadNote = data.leadCreated ? " → added to Directors" : fields.length > 0 ? " (already in Directors)" : "";
      showToast(fields.length > 0 ? `Found director (${conf}): ${fields.join(", ")}${leadNote}` : "No director info found");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Find Director failed");
    } finally {
      setFindingDirectorId(null);
    }
  }, [showToast]);

  // ── Convert hospital director to Lead ──────────────────────────────────────

  const convertToLead = useCallback(async (h: HospitalLead) => {
    if (!h.directorName) { showToast("No director info — find director first"); return; }
    setConvertingId(h.id);
    try {
      const res = await authFetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: DEMO_COMPANY_ID,
          source: "residency_director",
          fullName: h.directorName,
          email: h.directorEmail || null,
          phone: h.directorPhone || null,
          jobTitle: h.directorTitle || "Residency Program Director",
          company: h.name,
          city: h.city || null,
          state: h.state,
          country: h.country,
          website: h.url || null,
          notes: `Converted from Hospital DB. Hospital: ${h.name}, ${h.city ?? ""} ${h.state}`,
          status: "new",
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✓ ${h.directorName} added to Leads`);
      } else {
        showToast(data.error || "Failed to convert");
      }
    } catch {
      showToast("Failed to convert to lead");
    } finally {
      setConvertingId(null);
    }
  }, [showToast]);

  // ── Bulk convert directors to Leads ────────────────────────────────────────

  const bulkConvertToLeads = useCallback(async (ids: string[]) => {
    const withDirector = hospitals.filter((h) => ids.includes(h.id) && h.directorName);
    if (withDirector.length === 0) { showToast("No directors found in selection — find directors first"); return; }
    try {
      const leads = withDirector.map((h) => ({
        companyId: DEMO_COMPANY_ID,
        source: "residency_director",
        fullName: h.directorName,
        email: h.directorEmail || null,
        phone: h.directorPhone || null,
        jobTitle: h.directorTitle || "Residency Program Director",
        company: h.name,
        city: h.city || null,
        state: h.state,
        country: h.country,
        website: h.url || null,
        notes: `Converted from Hospital DB. Hospital: ${h.name}, ${h.city ?? ""} ${h.state}`,
        status: "new",
      }));
      const res = await authFetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Export failed");
      const skipped = data.skipped ?? 0;
      const inserted = data.inserted ?? 0;
      showToast(`✓ ${inserted} director${inserted !== 1 ? "s" : ""} exported to leads${skipped > 0 ? ` (${skipped} duplicates skipped)` : ""}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Bulk export failed");
    }
  }, [hospitals, showToast]);

  // ── Add manual hospital ────────────────────────────────────────────────────

  const addHospital = useCallback(async (form: Record<string, string>) => {
    try {
      const res = await authFetch("/api/hospitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.duplicate) { showToast("Hospital already exists"); return false; }
        throw new Error("Add failed");
      }
      fetchHospitals();
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Add failed");
      return false;
    }
  }, [fetchHospitals, showToast]);

  // ── Bulk find directors ────────────────────────────────────────────────────

  const bulkFindDirectors = useCallback(async (ids: string[], residencyCategory?: string) => {
    let found = 0;
    for (const id of ids) {
      try {
        const res = await authFetch(`/api/hospitals/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ findDirector: true, ...(residencyCategory ? { residencyCategory } : {}) }),
        });
        if (res.ok) {
          const data = await res.json();
          setHospitals((prev) => prev.map((h) => (h.id === id ? data.hospital : h)));
          if ((data.fieldsUpdated as string[])?.length > 0) found++;
        }
      } catch { /* continue */ }
    }
    showToast(`Director search complete: ${found}/${ids.length} hospitals updated`);
  }, [showToast]);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stateGroups = hospitals.reduce<Record<string, number>>((acc, h) => {
    acc[h.state] = (acc[h.state] ?? 0) + 1;
    return acc;
  }, {});

  return {
    // Library
    hospitals, loading, error, stateFilter, setStateFilter,
    cityFilter, setCityFilter, textSearch, setTextSearch,
    fetchHospitals, stateGroups,
    // Search
    searchState, setSearchState, searchCity, setSearchCity,
    searchCount, setSearchCount, searching, searchError,
    results, saving,
    handleSearch, handleSaveAll, removeFromResults,
    // Actions
    updateHospital, deleteHospital, enrichHospital, enrichingId,
    findDirector, findingDirectorId, bulkFindDirectors,
    convertToLead, convertingId, bulkConvertToLeads, addHospital,
    // Toast
    toast, setToast, showToast,
  };
}
