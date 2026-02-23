"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Sparkles, Loader2, Check, Trash2, ThumbsUp, ThumbsDown,
  ChevronDown, ChevronUp, Save, Hash, Users, Copy, CheckCircle2,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";

// ── Types ────────────────────────────────────────────────────────────────────

type ReasonStatus = "PENDING" | "APPROVED" | "REJECTED";

interface Reason {
  id: string;
  reasonNumber: number;
  audience: string;
  output: string;
  status: ReasonStatus;
  feedback?: string | null;
  createdAt: string;
}

interface GeneratedReason {
  reasonNumber: number;
  audience: string;
  output: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_AUDIENCES = [
  "Doctors",
  "Nurses",
  "Pediatricians",
  "Hospitals",
  "Dentists",
  "Pharmacists",
  "Therapists",
  "Healthcare Professionals",
];

const STATUS_FILTERS: { key: ReasonStatus | ""; label: string }[] = [
  { key: "",         label: "All" },
  { key: "PENDING",  label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReasonStatus }) {
  const styles: Record<ReasonStatus, string> = {
    PENDING:  "bg-amber-100 text-amber-700 border-amber-200",
    APPROVED: "bg-green-100 text-green-700 border-green-200",
    REJECTED: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ReasonsPage() {
  // Generator state
  const [audience, setAudience]           = useState(DEFAULT_AUDIENCES[0]);
  const [customAudience, setCustomAudience] = useState("");
  const [useCustom, setUseCustom]         = useState(false);
  const [count, setCount]                 = useState(10);
  const [generating, setGenerating]       = useState(false);
  const [genError, setGenError]           = useState<string | null>(null);
  const [freshReasons, setFreshReasons]   = useState<GeneratedReason[]>([]);
  const [saving, setSaving]               = useState(false);

  // Library state
  const [reasons, setReasons]             = useState<Reason[]>([]);
  const [loading, setLoading]             = useState(true);
  const [libError, setLibError]           = useState<string | null>(null);
  const [showLibrary, setShowLibrary]     = useState(true);
  const [statusFilter, setStatusFilter]   = useState<ReasonStatus | "">("");
  const [audienceFilter, setAudienceFilter] = useState("");
  const [copiedId, setCopiedId]           = useState<string | null>(null);

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

  // ── Generate ───────────────────────────────────────────────────────────────

  const effectiveAudience = useCustom ? customAudience.trim() : audience;

  const handleGenerate = async () => {
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
  };

  // ── Save all generated ─────────────────────────────────────────────────────

  const handleSaveAll = async () => {
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
  };

  // ── Remove from preview ────────────────────────────────────────────────────

  const removeFromPreview = (idx: number) => {
    setFreshReasons((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Approve / Reject / Delete ──────────────────────────────────────────────

  const updateReason = async (id: string, updates: Record<string, unknown>) => {
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
      console.error(err);
    }
  };

  const deleteReason = async (id: string) => {
    if (!confirm("Delete this reason?")) return;
    try {
      await authFetch(`/api/reasons/${id}`, { method: "DELETE" });
      setReasons((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const copyReason = (reason: Reason) => {
    const text = `Reason #${reason.reasonNumber} why ${reason.audience} Love GUSI\n\n${reason.output}`;
    navigator.clipboard.writeText(text);
    setCopiedId(reason.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Unique audiences from saved reasons ────────────────────────────────────

  const savedAudiences = Array.from(new Set(reasons.map((r) => r.audience)));

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = {
    total: reasons.length,
    approved: reasons.filter((r) => r.status === "APPROVED").length,
    pending: reasons.filter((r) => r.status === "PENDING").length,
    rejected: reasons.filter((r) => r.status === "REJECTED").length,
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Hash className="h-8 w-8 text-brand-600" />
          Reasons Generator
        </h1>
        <p className="mt-1 text-gray-500">
          Generate &ldquo;Reasons why [Audience] Love GUSI&rdquo; for social media posts
        </p>
      </div>

      {/* Stats bar */}
      {stats.total > 0 && (
        <div className="mb-6 grid grid-cols-4 gap-3">
          {[
            { label: "Total",    value: stats.total,    color: "text-gray-700" },
            { label: "Approved", value: stats.approved, color: "text-green-600" },
            { label: "Pending",  value: stats.pending,  color: "text-amber-600" },
            { label: "Rejected", value: stats.rejected, color: "text-red-600" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Generator Panel */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand-600" />
          Generate Reasons
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Audience selector */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Users className="inline h-4 w-4 mr-1" />
              Audience
            </label>
            {!useCustom ? (
              <div className="flex gap-2">
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                >
                  {DEFAULT_AUDIENCES.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <button
                  onClick={() => setUseCustom(true)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Custom
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customAudience}
                  onChange={(e) => setCustomAudience(e.target.value)}
                  placeholder="Enter custom audience..."
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
                <button
                  onClick={() => { setUseCustom(false); setCustomAudience(""); }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Preset
                </button>
              </div>
            )}
          </div>

          {/* Count */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Count</label>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            >
              {[5, 10, 15, 20, 30, 50].map((n) => (
                <option key={n} value={n}>{n} reasons</option>
              ))}
            </select>
          </div>
        </div>

        {/* Preview of what will be generated */}
        <div className="mb-4 rounded-lg bg-gray-50 border border-gray-200 p-3">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">Preview format:</span>{" "}
            Reason #{reasons.length > 0 ? reasons[0].reasonNumber + 1 : 1} why{" "}
            <span className="font-semibold text-brand-700">{effectiveAudience || "..."}</span>{" "}
            Love GUSI
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating || !effectiveAudience}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {generating ? (
            <><Loader2 className="inline h-4 w-4 mr-2 animate-spin" />Generating {count} reasons...</>
          ) : (
            <><Sparkles className="inline h-4 w-4 mr-2" />Generate {count} Reasons</>
          )}
        </button>

        {genError && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg p-3">{genError}</p>
        )}
      </div>

      {/* Fresh Generated Preview */}
      {freshReasons.length > 0 && (
        <div className="mb-6 rounded-xl border-2 border-brand-200 bg-brand-50/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              ✨ Generated {freshReasons.length} Reasons — Review & Save
            </h2>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <><Loader2 className="inline h-4 w-4 mr-1 animate-spin" />Saving...</>
              ) : (
                <><Save className="inline h-4 w-4 mr-1" />Save All to Library</>
              )}
            </button>
          </div>

          <div className="space-y-2">
            {freshReasons.map((reason, idx) => (
              <div key={idx} className="flex items-start gap-3 rounded-lg bg-white border border-gray-200 p-3">
                <span className="shrink-0 mt-0.5 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-700">
                  #{reason.reasonNumber}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 mb-0.5">
                    Reason #{reason.reasonNumber} why {reason.audience} Love GUSI
                  </p>
                  <p className="text-sm text-gray-900">{reason.output}</p>
                </div>
                <button
                  onClick={() => removeFromPreview(idx)}
                  className="shrink-0 rounded p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
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
            📚 Reasons Library
            <span className="text-sm font-normal text-gray-500">({stats.total})</span>
          </h2>
          {showLibrary ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
        </button>

        {showLibrary && (
          <div className="border-t border-gray-200">
            {/* Filters */}
            <div className="flex flex-wrap gap-2 px-6 py-3 bg-gray-50 border-b border-gray-200">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    statusFilter === f.key
                      ? "bg-brand-600 text-white border-brand-600"
                      : "border-gray-300 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}

              {savedAudiences.length > 1 && (
                <>
                  <div className="w-px h-6 bg-gray-300 mx-1" />
                  <button
                    onClick={() => setAudienceFilter("")}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      !audienceFilter ? "bg-brand-600 text-white border-brand-600" : "border-gray-300 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    All audiences
                  </button>
                  {savedAudiences.map((a) => (
                    <button
                      key={a}
                      onClick={() => setAudienceFilter(a)}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                        audienceFilter === a
                          ? "bg-brand-600 text-white border-brand-600"
                          : "border-gray-300 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* List */}
            <div className="divide-y divide-gray-100">
              {loading ? (
                <div className="py-12 text-center text-gray-400">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                </div>
              ) : libError ? (
                <div className="py-12 text-center text-red-500 text-sm">{libError}</div>
              ) : reasons.length === 0 ? (
                <div className="py-12 text-center">
                  <Hash className="mx-auto h-10 w-10 text-gray-300" />
                  <p className="mt-3 font-medium text-gray-500">No reasons yet</p>
                  <p className="mt-1 text-sm text-gray-400">Generate some above to get started</p>
                </div>
              ) : (
                reasons.map((reason) => (
                  <div key={reason.id} className="flex items-start gap-3 px-6 py-4 hover:bg-gray-50 transition-colors">
                    <span className="shrink-0 mt-0.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-600">
                      #{reason.reasonNumber}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-500 mb-0.5">
                        Reason #{reason.reasonNumber} why {reason.audience} Love GUSI
                      </p>
                      <p className="text-sm text-gray-900">{reason.output}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <StatusBadge status={reason.status} />
                      <button
                        onClick={() => copyReason(reason)}
                        className="rounded p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        title="Copy"
                      >
                        {copiedId === reason.id ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                      {reason.status !== "APPROVED" && (
                        <button
                          onClick={() => updateReason(reason.id, { status: "APPROVED" })}
                          className="rounded p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                          title="Approve"
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </button>
                      )}
                      {reason.status !== "REJECTED" && (
                        <button
                          onClick={() => updateReason(reason.id, { status: "REJECTED" })}
                          className="rounded p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Reject"
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteReason(reason.id)}
                        className="rounded p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
