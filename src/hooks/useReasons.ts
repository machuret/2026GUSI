"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/authFetch";

// ── Types ────────────────────────────────────────────────────────────────────

export type ReasonStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Reason {
  id: string;
  reasonNumber: number;
  audience: string;
  output: string;
  status: ReasonStatus;
  feedback?: string | null;
  createdAt: string;
}

export interface GeneratedReason {
  reasonNumber: number;
  audience: string;
  output: string;
}

export const DEFAULT_AUDIENCES = [
  "Doctors",
  "Nurses",
  "Pediatricians",
  "Hospitals",
  "Dentists",
  "Pharmacists",
  "Therapists",
  "Healthcare Professionals",
];

export const STATUS_FILTERS: { key: ReasonStatus | ""; label: string }[] = [
  { key: "",         label: "All" },
  { key: "PENDING",  label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useReasons() {
  // Generator state
  const [audience, setAudience]             = useState(DEFAULT_AUDIENCES[0]);
  const [customAudience, setCustomAudience] = useState("");
  const [useCustom, setUseCustom]           = useState(false);
  const [count, setCount]                   = useState(10);
  const [generating, setGenerating]         = useState(false);
  const [genError, setGenError]             = useState<string | null>(null);
  const [freshReasons, setFreshReasons]     = useState<GeneratedReason[]>([]);
  const [saving, setSaving]                 = useState(false);

  // Company name
  const [companyName, setCompanyName]       = useState("GUSI");

  // Library state
  const [reasons, setReasons]               = useState<Reason[]>([]);
  const [loading, setLoading]               = useState(true);
  const [libError, setLibError]             = useState<string | null>(null);
  const [statusFilter, setStatusFilter]     = useState<ReasonStatus | "">("");
  const [audienceFilter, setAudienceFilter] = useState("");
  const [actionError, setActionError]       = useState<string | null>(null);

  const effectiveAudience = useCustom ? customAudience.trim() : audience;

  // ── Fetch library ──────────────────────────────────────────────────────────

  const fetchReasons = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter)   params.set("status", statusFilter);
      if (audienceFilter) params.set("audience", audienceFilter);
      const res = await authFetch(`/api/reasons?${params}`);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = await res.json();
      setReasons(data.reasons ?? []);
      setLibError(null);
    } catch (err) {
      setLibError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, audienceFilter]);

  useEffect(() => { fetchReasons(); }, [fetchReasons]);

  // Fetch company name on mount
  useEffect(() => {
    authFetch("/api/company").then((r) => r.json()).then((d) => {
      if (d.company?.companyName) setCompanyName(d.company.companyName);
    }).catch(() => {});
  }, []);

  // ── Generate ───────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!effectiveAudience) return;
    setGenerating(true);
    setGenError(null);
    setFreshReasons([]);
    try {
      const res = await authFetch("/api/reasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience: effectiveAudience, count }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed (${res.status})`);
      }
      const data = await res.json();
      setFreshReasons(data.reasons ?? []);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [effectiveAudience, count]);

  // ── Save all generated ─────────────────────────────────────────────────────

  const handleSaveAll = useCallback(async () => {
    if (freshReasons.length === 0) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/reasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reasons: freshReasons }),
      });
      if (!res.ok) throw new Error("Save failed");
      setFreshReasons([]);
      fetchReasons();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [freshReasons, fetchReasons]);

  const removeFromPreview = useCallback((idx: number) => {
    setFreshReasons((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ── Update reason (approve/reject) ─────────────────────────────────────────

  const updateReason = useCallback(async (id: string, updates: Record<string, unknown>) => {
    setActionError(null);
    try {
      const res = await authFetch(`/api/reasons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Update failed");
      const data = await res.json();
      setReasons((prev) => prev.map((r) => (r.id === id ? data.reason : r)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Update failed");
    }
  }, []);

  // ── Delete reason ──────────────────────────────────────────────────────────

  const deleteReason = useCallback(async (id: string) => {
    if (!confirm("Delete this reason?")) return;
    setActionError(null);
    try {
      await authFetch(`/api/reasons/${id}`, { method: "DELETE" });
      setReasons((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Delete failed");
    }
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const savedAudiences = Array.from(new Set(reasons.map((r) => r.audience)));

  const stats = {
    total: reasons.length,
    approved: reasons.filter((r) => r.status === "APPROVED").length,
    pending: reasons.filter((r) => r.status === "PENDING").length,
    rejected: reasons.filter((r) => r.status === "REJECTED").length,
  };

  return {
    // Generator
    audience, setAudience, customAudience, setCustomAudience,
    useCustom, setUseCustom, count, setCount,
    effectiveAudience, generating, genError, freshReasons, saving,
    handleGenerate, handleSaveAll, removeFromPreview,
    // Library
    reasons, loading, libError, companyName,
    statusFilter, setStatusFilter, audienceFilter, setAudienceFilter,
    savedAudiences, stats, actionError, setActionError,
    // Actions
    updateReason, deleteReason, fetchReasons,
  };
}
