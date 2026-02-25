"use client";

import { Sparkles, Loader2 } from "lucide-react";
import type { Grant } from "@/hooks/useGrants";
import { GEO_SCOPES, PROJECT_DURATIONS, inputCls, labelCls } from "./grantTypes";
import { FitStars } from "./GrantBadges";

interface Props {
  form: Partial<Grant>;
  set: (k: keyof Grant, v: unknown) => void;
  onResearch?: () => void;
  researching?: boolean;
}

export function GrantFormFields({ form, set, onResearch, researching }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className={labelCls}>Grant Name <span className="text-red-400">*</span></label>
          {onResearch && (
            <button type="button" onClick={onResearch} disabled={researching}
              className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50">
              {researching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {researching ? "Researching…" : "AI Auto-fill"}
            </button>
          )}
        </div>
        <input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} className={inputCls} placeholder="e.g. Innovate UK Smart Grant" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Founder / Organisation</label>
          <input value={form.founder ?? ""} onChange={(e) => set("founder", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>URL</label>
          <input value={form.url ?? ""} onChange={(e) => set("url", e.target.value)} className={inputCls} placeholder="https://..." />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Deadline Date</label>
          <input type="date" value={form.deadlineDate?.slice(0, 10) ?? ""} onChange={(e) => set("deadlineDate", e.target.value || null)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Amount</label>
          <input value={form.amount ?? ""} onChange={(e) => set("amount", e.target.value)} className={inputCls} placeholder="e.g. Up to $50,000" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Geographic Scope</label>
          <select value={form.geographicScope ?? ""} onChange={(e) => set("geographicScope", e.target.value || null)} className={inputCls}>
            <option value="">— Select —</option>
            {GEO_SCOPES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Project Duration Allowed</label>
          <select value={form.projectDuration ?? ""} onChange={(e) => set("projectDuration", e.target.value || null)} className={inputCls}>
            <option value="">— Select —</option>
            {PROJECT_DURATIONS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Eligibility</label>
        <textarea value={form.eligibility ?? ""} onChange={(e) => set("eligibility", e.target.value)} rows={2} className={inputCls} placeholder="Who can apply?" />
      </div>

      <div>
        <label className={labelCls}>How to Apply</label>
        <textarea value={form.howToApply ?? ""} onChange={(e) => set("howToApply", e.target.value)} rows={2} className={inputCls} placeholder="Application process, portal, steps…" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Fit Score (1–5)</label>
          <FitStars value={form.fitScore} onChange={(v) => set("fitScore", v)} />
        </div>
        <div>
          <label className={labelCls}>Submission Effort</label>
          <select value={form.submissionEffort ?? ""} onChange={(e) => set("submissionEffort", e.target.value || null)} className={inputCls}>
            <option value="">— Select —</option>
            <option>Low</option><option>Medium</option><option>High</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Decision</label>
          <select value={form.decision ?? "Maybe"} onChange={(e) => set("decision", e.target.value)} className={inputCls}>
            <option>Apply</option><option>Maybe</option><option>No</option><option>Rejected</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Notes</label>
        <textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={3} className={inputCls} placeholder="Internal notes, contacts, strategy…" />
      </div>
    </div>
  );
}
