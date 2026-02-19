"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus, ExternalLink, Trash2, ChevronDown, ChevronUp,
  Search, FileText, Loader2, X, Save,
} from "lucide-react";
import { DEMO_COMPANY_ID } from "@/lib/constants";

interface Grant {
  id: string;
  companyId: string;
  name: string;
  founder?: string | null;
  url?: string | null;
  deadlineDate?: string | null;
  howToApply?: string | null;
  geographicScope?: string | null;
  eligibility?: string | null;
  amount?: string | null;
  projectDuration?: string | null;
  fitScore?: number | null;
  submissionEffort?: "Low" | "Medium" | "High" | null;
  decision?: "Apply" | "Maybe" | "No" | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

type Decision = "Apply" | "Maybe" | "No";
type Effort = "Low" | "Medium" | "High";

const DECISION_STYLES: Record<Decision, string> = {
  Apply: "bg-green-100 text-green-800 border-green-300",
  Maybe: "bg-yellow-100 text-yellow-800 border-yellow-300",
  No:    "bg-red-100 text-red-700 border-red-300",
};

const EFFORT_STYLES: Record<Effort, string> = {
  Low:    "bg-blue-50 text-blue-700",
  Medium: "bg-orange-50 text-orange-700",
  High:   "bg-red-50 text-red-700",
};

const EMPTY_FORM = (): Partial<Grant> => ({
  name: "", founder: "", url: "", deadlineDate: "", howToApply: "",
  geographicScope: "", eligibility: "", amount: "", projectDuration: "",
  fitScore: null, submissionEffort: null, decision: "Maybe", notes: "",
});

function FitStars({ value, onChange }: { value?: number | null; onChange?: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button"
          onClick={() => onChange?.(n)}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}
          className={`text-base transition-colors ${n <= (hover || value || 0) ? "text-amber-400" : "text-gray-200"} ${onChange ? "cursor-pointer" : "cursor-default"}`}
        >★</button>
      ))}
    </div>
  );
}

function DecisionBadge({ value }: { value?: Decision | null }) {
  if (!value) return <span className="text-xs text-gray-300">—</span>;
  return <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${DECISION_STYLES[value]}`}>{value}</span>;
}

function EffortBadge({ value }: { value?: Effort | null }) {
  if (!value) return <span className="text-xs text-gray-300">—</span>;
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${EFFORT_STYLES[value]}`}>{value}</span>;
}

function DeadlineBadge({ date }: { date?: string | null }) {
  if (!date) return <span className="text-xs text-gray-300">—</span>;
  const d = new Date(date);
  const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000);
  const fmt = d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  const cls = daysLeft < 0 ? "text-gray-400 line-through" : daysLeft <= 14 ? "text-red-600 font-semibold" : daysLeft <= 30 ? "text-orange-600 font-medium" : "text-gray-700";
  return <span className={`text-xs ${cls}`}>{fmt}{daysLeft >= 0 && daysLeft <= 60 && <span className="ml-1 text-gray-400">({daysLeft}d)</span>}</span>;
}

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelCls = "mb-1 block text-xs font-medium text-gray-600";

function GrantFormFields({ form, set }: { form: Partial<Grant>; set: (k: keyof Grant, v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Grant Name <span className="text-red-400">*</span></label>
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
          <input value={form.geographicScope ?? ""} onChange={(e) => set("geographicScope", e.target.value)} className={inputCls} placeholder="e.g. Australia-wide" />
        </div>
        <div>
          <label className={labelCls}>Project Duration Allowed</label>
          <input value={form.projectDuration ?? ""} onChange={(e) => set("projectDuration", e.target.value)} className={inputCls} placeholder="e.g. 6–24 months" />
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
            <option>Apply</option><option>Maybe</option><option>No</option>
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

function AddGrantModal({ onClose, onSaved }: { onClose: () => void; onSaved: (g: Grant) => void }) {
  const [form, setForm] = useState<Partial<Grant>>(EMPTY_FORM());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Grant, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.name?.trim()) { setError("Grant name is required"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/grants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, companyId: DEMO_COMPANY_ID }) });
      const data = await res.json();
      if (data.success) { onSaved(data.grant); onClose(); }
      else setError(data.error || "Failed to save");
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Add Grant</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>
        <div className="p-6">
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <GrantFormFields form={form} set={set} />
        </div>
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-100 bg-white px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Grant
          </button>
        </div>
      </div>
    </div>
  );
}

function GrantRow({ grant, onUpdate, onDelete }: { grant: Grant; onUpdate: (id: string, d: Partial<Grant>) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Grant>>({ ...grant });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = (k: keyof Grant, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try { await onUpdate(grant.id, form); setEditing(false); }
    finally { setSaving(false); }
  };

  const del = async () => {
    if (!confirm(`Delete "${grant.name}"?`)) return;
    setDeleting(true);
    try { await onDelete(grant.id); }
    finally { setDeleting(false); }
  };

  return (
    <>
      <tr className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${expanded ? "bg-gray-50" : ""}`}>
        <td className="px-4 py-3">
          <div className="flex items-start gap-2">
            <button onClick={() => setExpanded(v => !v)} className="mt-0.5 shrink-0 text-gray-400 hover:text-brand-600">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 text-sm">{grant.name}</p>
              {grant.founder && <p className="text-xs text-gray-400 mt-0.5">{grant.founder}</p>}
            </div>
          </div>
        </td>
        <td className="px-3 py-3 whitespace-nowrap"><DeadlineBadge date={grant.deadlineDate} /></td>
        <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap">{grant.amount || <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-3"><FitStars value={grant.fitScore} /></td>
        <td className="px-3 py-3"><EffortBadge value={grant.submissionEffort as Effort | null} /></td>
        <td className="px-3 py-3"><DecisionBadge value={grant.decision as Decision | null} /></td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            {grant.url && <a href={grant.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:text-brand-800"><ExternalLink className="h-4 w-4" /></a>}
            <button onClick={() => { setEditing(true); setExpanded(true); }} className="text-gray-400 hover:text-brand-600"><FileText className="h-4 w-4" /></button>
            <button onClick={del} disabled={deleting} className="text-gray-300 hover:text-red-500 disabled:opacity-50">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-gray-100 bg-gray-50">
          <td colSpan={7} className="px-6 py-5">
            {editing ? (
              <div>
                <GrantFormFields form={form} set={set} />
                <div className="mt-4 flex gap-2">
                  <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
                  </button>
                  <button onClick={() => { setEditing(false); setForm({ ...grant }); }} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-white">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="space-y-3">
                  {grant.eligibility && <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Eligibility</p><p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{grant.eligibility}</p></div>}
                  {grant.howToApply && <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">How to Apply</p><p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{grant.howToApply}</p></div>}
                  {grant.geographicScope && <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Geographic Scope</p><p className="mt-1 text-sm text-gray-700">{grant.geographicScope}</p></div>}
                  {grant.projectDuration && <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Project Duration</p><p className="mt-1 text-sm text-gray-700">{grant.projectDuration}</p></div>}
                </div>
                <div className="space-y-3">
                  {grant.notes && <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Notes</p><p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{grant.notes}</p></div>}
                  {!grant.eligibility && !grant.howToApply && !grant.notes && <p className="text-sm text-gray-400">No additional details yet.</p>}
                </div>
                <div className="lg:col-span-2">
                  <button onClick={() => setEditing(true)} className="text-xs text-brand-600 hover:underline">Edit all fields →</button>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function GrantsPage() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [decisionFilter, setDecisionFilter] = useState("All");
  const [sortField, setSortField] = useState<"deadlineDate" | "fitScore" | "name">("deadlineDate");
  const [sortAsc, setSortAsc] = useState(true);

  const fetchGrants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/grants?companyId=${DEMO_COMPANY_ID}`);
      const data = await res.json();
      setGrants(data.grants ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGrants(); }, [fetchGrants]);

  const handleUpdate = useCallback(async (id: string, data: Partial<Grant>) => {
    const res = await fetch(`/api/grants/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const result = await res.json();
    if (result.success) setGrants((prev) => prev.map((g) => g.id === id ? { ...g, ...result.grant } : g));
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    const res = await fetch(`/api/grants/${id}`, { method: "DELETE" });
    const result = await res.json();
    if (result.success) setGrants((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(v => !v);
    else { setSortField(field); setSortAsc(true); }
  };

  const filtered = grants
    .filter((g) => {
      const q = search.toLowerCase();
      const matchSearch = !search || g.name.toLowerCase().includes(q) || (g.founder ?? "").toLowerCase().includes(q) || (g.notes ?? "").toLowerCase().includes(q);
      const matchDecision = decisionFilter === "All" || g.decision === decisionFilter;
      return matchSearch && matchDecision;
    })
    .sort((a, b) => {
      let av: string | number = 0, bv: string | number = 0;
      if (sortField === "deadlineDate") { av = a.deadlineDate ? new Date(a.deadlineDate).getTime() : Infinity; bv = b.deadlineDate ? new Date(b.deadlineDate).getTime() : Infinity; }
      else if (sortField === "fitScore") { av = a.fitScore ?? 0; bv = b.fitScore ?? 0; }
      else { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      return av < bv ? (sortAsc ? -1 : 1) : av > bv ? (sortAsc ? 1 : -1) : 0;
    });

  const counts = { Apply: grants.filter(g => g.decision === "Apply").length, Maybe: grants.filter(g => g.decision === "Maybe").length, No: grants.filter(g => g.decision === "No").length };

  const SortBtn = ({ field, label }: { field: typeof sortField; label: string }) => (
    <button onClick={() => toggleSort(field)} className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800 uppercase tracking-wide">
      {label}{sortField === field ? (sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
    </button>
  );

  return (
    <div className="mx-auto max-w-7xl">
      {showAdd && <AddGrantModal onClose={() => setShowAdd(false)} onSaved={(g) => setGrants(p => [g, ...p])} />}

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Grants</h1>
          <p className="mt-1 text-gray-500">Track, research, and prioritise grant opportunities</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Add Grant
        </button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-400">Total</p>
          <p className="text-2xl font-bold text-gray-900">{grants.length}</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-xs text-green-600">Apply</p>
          <p className="text-2xl font-bold text-green-800">{counts.Apply}</p>
        </div>
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
          <p className="text-xs text-yellow-600">Maybe</p>
          <p className="text-2xl font-bold text-yellow-800">{counts.Maybe}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-xs text-red-500">No</p>
          <p className="text-2xl font-bold text-red-700">{counts.No}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search grants…" className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
        </div>
        <div className="flex gap-1.5">
          {["All", "Apply", "Maybe", "No"].map((d) => (
            <button key={d} onClick={() => setDecisionFilter(d)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${decisionFilter === d ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-20 text-center text-gray-400"><Loader2 className="mx-auto h-8 w-8 animate-spin mb-3" />Loading grants…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-20 text-center">
          <p className="text-gray-400">{grants.length === 0 ? "No grants yet. Click \"Add Grant\" to get started." : "No grants match the current filter."}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left"><SortBtn field="name" label="Grant" /></th>
                <th className="px-3 py-3 text-left"><SortBtn field="deadlineDate" label="Deadline" /></th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Amount</th>
                <th className="px-3 py-3 text-left"><SortBtn field="fitScore" label="Fit" /></th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Effort</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Decision</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((grant) => (
                <GrantRow key={grant.id} grant={grant} onUpdate={handleUpdate} onDelete={handleDelete} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
