"use client";

import { useState } from "react";
import {
  Sparkles, Loader2, Trash2, ThumbsUp, ThumbsDown,
  ChevronDown, ChevronUp, Save, Hash, Users, Copy, CheckCircle2,
} from "lucide-react";
import {
  useReasons, DEFAULT_AUDIENCES, STATUS_FILTERS,
  type ReasonStatus,
} from "@/hooks/useReasons";

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

export default function ReasonsPage() {
  const h = useReasons();

  const [showLibrary, setShowLibrary] = useState(true);
  const [copiedId, setCopiedId]       = useState<string | null>(null);

  const copyReason = (reason: { id: string; reasonNumber: number; audience: string; output: string }) => {
    const text = `Reason #${reason.reasonNumber} why ${reason.audience} Love ${h.companyName}\n\n${reason.output}`;
    navigator.clipboard.writeText(text);
    setCopiedId(reason.id);
    setTimeout(() => setCopiedId(null), 2000);
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
          Generate &ldquo;Reasons why [Audience] Love {h.companyName}&rdquo; for social media posts
        </p>
      </div>

      {/* Action error banner */}
      {h.actionError && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="flex-1">{h.actionError}</span>
          <button onClick={() => h.setActionError(null)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
        </div>
      )}

      {/* Stats bar */}
      {h.stats.total > 0 && (
        <div className="mb-6 grid grid-cols-4 gap-3">
          {[
            { label: "Total",    value: h.stats.total,    color: "text-gray-700" },
            { label: "Approved", value: h.stats.approved, color: "text-green-600" },
            { label: "Pending",  value: h.stats.pending,  color: "text-amber-600" },
            { label: "Rejected", value: h.stats.rejected, color: "text-red-600" },
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
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Users className="inline h-4 w-4 mr-1" /> Audience
            </label>
            {!h.useCustom ? (
              <div className="flex gap-2">
                <select value={h.audience} onChange={(e) => h.setAudience(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500">
                  {DEFAULT_AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                <button onClick={() => h.setUseCustom(true)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50">Custom</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input type="text" value={h.customAudience} onChange={(e) => h.setCustomAudience(e.target.value)}
                  placeholder="Enter custom audience..."
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
                <button onClick={() => { h.setUseCustom(false); h.setCustomAudience(""); }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50">Preset</button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Count</label>
            <select value={h.count} onChange={(e) => h.setCount(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500">
              {[5, 10, 15, 20, 30, 50].map((n) => <option key={n} value={n}>{n} reasons</option>)}
            </select>
          </div>
        </div>

        <div className="mb-4 rounded-lg bg-gray-50 border border-gray-200 p-3">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">Preview format:</span>{" "}
            Reason #{h.reasons.length > 0 ? h.reasons[0].reasonNumber + 1 : 1} why{" "}
            <span className="font-semibold text-brand-700">{h.effectiveAudience || "..."}</span>{" "}
            Love {h.companyName}
          </p>
        </div>

        <button onClick={h.handleGenerate} disabled={h.generating || !h.effectiveAudience}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {h.generating ? <><Loader2 className="inline h-4 w-4 mr-2 animate-spin" />Generating {h.count} reasons...</> : <><Sparkles className="inline h-4 w-4 mr-2" />Generate {h.count} Reasons</>}
        </button>

        {h.genError && <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg p-3">{h.genError}</p>}
      </div>

      {/* Fresh Generated Preview */}
      {h.freshReasons.length > 0 && (
        <div className="mb-6 rounded-xl border-2 border-brand-200 bg-brand-50/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              ✨ Generated {h.freshReasons.length} Reasons — Review & Save
            </h2>
            <button onClick={h.handleSaveAll} disabled={h.saving}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
              {h.saving ? <><Loader2 className="inline h-4 w-4 mr-1 animate-spin" />Saving...</> : <><Save className="inline h-4 w-4 mr-1" />Save All to Library</>}
            </button>
          </div>

          <div className="space-y-2">
            {h.freshReasons.map((reason, idx) => (
              <div key={idx} className="flex items-start gap-3 rounded-lg bg-white border border-gray-200 p-3">
                <span className="shrink-0 mt-0.5 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-700">#{reason.reasonNumber}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 mb-0.5">Reason #{reason.reasonNumber} why {reason.audience} Love {h.companyName}</p>
                  <p className="text-sm text-gray-900">{reason.output}</p>
                </div>
                <button onClick={() => h.removeFromPreview(idx)} className="shrink-0 rounded p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Remove">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Library */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <button onClick={() => setShowLibrary(!showLibrary)}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            📚 Reasons Library
            <span className="text-sm font-normal text-gray-500">({h.stats.total})</span>
          </h2>
          {showLibrary ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
        </button>

        {showLibrary && (
          <div className="border-t border-gray-200">
            {/* Filters */}
            <div className="flex flex-wrap gap-2 px-6 py-3 bg-gray-50 border-b border-gray-200">
              {STATUS_FILTERS.map((f) => (
                <button key={f.key} onClick={() => h.setStatusFilter(f.key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${h.statusFilter === f.key ? "bg-brand-600 text-white border-brand-600" : "border-gray-300 text-gray-600 hover:bg-gray-100"}`}>
                  {f.label}
                </button>
              ))}

              {h.savedAudiences.length > 1 && (
                <>
                  <div className="w-px h-6 bg-gray-300 mx-1" />
                  <button onClick={() => h.setAudienceFilter("")}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${!h.audienceFilter ? "bg-brand-600 text-white border-brand-600" : "border-gray-300 text-gray-600 hover:bg-gray-100"}`}>
                    All audiences
                  </button>
                  {h.savedAudiences.map((a) => (
                    <button key={a} onClick={() => h.setAudienceFilter(a)}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${h.audienceFilter === a ? "bg-brand-600 text-white border-brand-600" : "border-gray-300 text-gray-600 hover:bg-gray-100"}`}>
                      {a}
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* List */}
            <div className="divide-y divide-gray-100">
              {h.loading ? (
                <div className="py-12 text-center text-gray-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
              ) : h.libError ? (
                <div className="py-12 text-center text-red-500 text-sm">{h.libError}</div>
              ) : h.reasons.length === 0 ? (
                <div className="py-12 text-center">
                  <Hash className="mx-auto h-10 w-10 text-gray-300" />
                  <p className="mt-3 font-medium text-gray-500">No reasons yet</p>
                  <p className="mt-1 text-sm text-gray-400">Generate some above to get started</p>
                </div>
              ) : (
                h.reasons.map((reason) => (
                  <div key={reason.id} className="flex items-start gap-3 px-6 py-4 hover:bg-gray-50 transition-colors">
                    <span className="shrink-0 mt-0.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-600">#{reason.reasonNumber}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-500 mb-0.5">Reason #{reason.reasonNumber} why {reason.audience} Love {h.companyName}</p>
                      <p className="text-sm text-gray-900">{reason.output}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <StatusBadge status={reason.status} />
                      <button onClick={() => copyReason(reason)} className="rounded p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Copy">
                        {copiedId === reason.id ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                      {reason.status !== "APPROVED" && (
                        <button onClick={() => h.updateReason(reason.id, { status: "APPROVED" })} className="rounded p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors" title="Approve">
                          <ThumbsUp className="h-4 w-4" />
                        </button>
                      )}
                      {reason.status !== "REJECTED" && (
                        <button onClick={() => h.updateReason(reason.id, { status: "REJECTED" })} className="rounded p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Reject">
                          <ThumbsDown className="h-4 w-4" />
                        </button>
                      )}
                      <button onClick={() => h.deleteReason(reason.id)} className="rounded p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
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
