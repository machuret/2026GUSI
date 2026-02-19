"use client";

import { useState } from "react";
import {
  Plus, ExternalLink, Trash2, ChevronDown, ChevronUp,
  Search, FileText, Loader2, X, Save, Sparkles, FlaskConical,
  CheckCircle2, AlertCircle, TrendingUp, Globe, BadgeCheck, ShieldAlert,
} from "lucide-react";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { useGrants, type Grant } from "@/hooks/useGrants";

// ─── Dropdown options ─────────────────────────────────────────────────────────
const GEO_SCOPES = [
  "Global", "United States", "UK", "Australia", "Europe", "Asia",
  "Africa", "Sub-Saharan Africa", "Latin America", "Middle East", "Canada",
  "New Zealand", "Singapore", "India", "Germany", "France",
];

const PROJECT_DURATIONS = [
  "Up to 6 months", "6–12 months", "6–18 months", "6–24 months",
  "1–2 years", "1–3 years", "2–3 years", "Up to 3 years",
  "Up to 5 years", "Ongoing",
];

// ─── AI Analysis types ────────────────────────────────────────────────────────
interface GrantAnalysis {
  score: number;
  verdict: string;
  summary: string;
  strengths: string[];
  gaps: string[];
  recommendation: string;
}

interface SearchResult {
  name: string;
  founder: string;
  url: string;
  deadlineDate?: string | null;
  geographicScope?: string;
  amount?: string;
  eligibility?: string;
  howToApply?: string;
  projectDuration?: string;
  submissionEffort?: "Low" | "Medium" | "High";
  fitReason?: string;
  confidence?: "High" | "Medium" | "Low";
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

function GrantFormFields({
  form, set, onResearch,
}: {
  form: Partial<Grant>;
  set: (k: keyof Grant, v: unknown) => void;
  onResearch?: () => void;
  researching?: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Name + Research button */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className={labelCls}>Grant Name <span className="text-red-400">*</span></label>
          {onResearch && (
            <button
              type="button"
              onClick={onResearch}
              className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
            >
              <Sparkles className="h-3.5 w-3.5" /> AI Auto-fill
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

const CONFIDENCE_STYLES: Record<string, string> = {
  High:   "bg-green-100 text-green-700 border-green-300",
  Medium: "bg-yellow-100 text-yellow-700 border-yellow-300",
  Low:    "bg-gray-100 text-gray-500 border-gray-300",
};

function GrantSearchModal({
  onClose,
  onAdded,
  companyDNA,
  existingNames,
}: {
  onClose: () => void;
  onAdded: (g: Grant) => void;
  companyDNA: string;
  existingNames: Set<string>;
}) {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const [geoFilter, setGeoFilter] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<Record<number, boolean>>({});
  const [added, setAdded] = useState<Record<number, boolean>>({});

  const handleSearch = async () => {
    if (!query.trim() && !sector.trim()) { setError("Enter a search query or sector"); return; }
    setSearching(true); setError(null); setResults([]);
    try {
      const res = await fetch("/api/grants/search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, sector, geographicScope: geoFilter || undefined, companyDNA }),
      });
      const data = await res.json();
      if (data.success) setResults(data.results ?? []);
      else setError(data.error || "Search failed");
    } catch { setError("Network error"); }
    finally { setSearching(false); }
  };

  const handleAdd = async (result: SearchResult, idx: number) => {
    setAdding((p) => ({ ...p, [idx]: true }));
    try {
      const res = await fetch("/api/grants", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: DEMO_COMPANY_ID,
          name: result.name,
          founder: result.founder,
          url: result.url,
          deadlineDate: result.deadlineDate || null,
          geographicScope: result.geographicScope || null,
          amount: result.amount || null,
          eligibility: result.eligibility || null,
          howToApply: result.howToApply || null,
          projectDuration: result.projectDuration || null,
          submissionEffort: result.submissionEffort || null,
          decision: "Maybe",
          notes: result.fitReason ? `AI search note: ${result.fitReason}` : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onAdded(data.grant);
        setAdded((p) => ({ ...p, [idx]: true }));
      } else setError(data.error || "Failed to add");
    } catch { setError("Network error"); }
    finally { setAdding((p) => ({ ...p, [idx]: false })); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Grant Search</h2>
            <p className="text-xs text-gray-400 mt-0.5">AI-powered discovery — find grants, add to your list, research deeper later</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>

        {/* Search inputs */}
        <div className="border-b border-gray-100 px-6 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className={labelCls}>Keywords / Topic</label>
              <input
                value={query} onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className={inputCls} placeholder="e.g. health innovation, women founders…"
              />
            </div>
            <div>
              <label className={labelCls}>Sector / Focus</label>
              <input
                value={sector} onChange={(e) => setSector(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className={inputCls} placeholder="e.g. healthcare, education, tech…"
              />
            </div>
            <div>
              <label className={labelCls}>Geographic Scope</label>
              <select value={geoFilter} onChange={(e) => setGeoFilter(e.target.value)} className={inputCls}>
                <option value="">Any location</option>
                {GEO_SCOPES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleSearch} disabled={searching}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {searching ? "Searching…" : "Search Grants"}
            </button>
            {!companyDNA && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5" /> Add company info for personalised results
              </p>
            )}
          </div>
          {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {searching && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin mb-3 text-brand-400" />
              <p className="text-sm">AI is searching for matching grants…</p>
            </div>
          )}

          {!searching && results.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-300">
              <Globe className="h-10 w-10 mb-3" />
              <p className="text-sm text-gray-400">Enter a topic and click Search to discover grants</p>
            </div>
          )}

          {!searching && results.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">{results.length} result{results.length !== 1 ? "s" : ""} found</p>
              {results.map((r, idx) => {
                const alreadyInList = existingNames.has(r.name.toLowerCase());
                const isAdded = added[idx] || alreadyInList;
                const confidenceCls = CONFIDENCE_STYLES[r.confidence ?? "Low"] ?? CONFIDENCE_STYLES.Low;
                return (
                  <div key={idx} className={`rounded-xl border p-4 transition-colors ${isAdded ? "border-green-200 bg-green-50" : "border-gray-200 bg-white hover:border-brand-200"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-900 text-sm">{r.name}</p>
                          {r.confidence && (
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${confidenceCls}`}>
                              {r.confidence} confidence
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{r.founder}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                          {r.geographicScope && <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{r.geographicScope}</span>}
                          {r.amount && <span className="font-medium text-gray-700">{r.amount}</span>}
                          {r.deadlineDate && <span>Deadline: {new Date(r.deadlineDate).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</span>}
                          {r.submissionEffort && <EffortBadge value={r.submissionEffort} />}
                        </div>
                        {r.fitReason && (
                          <p className="mt-2 text-xs text-brand-700 bg-brand-50 rounded-lg px-2.5 py-1.5 border border-brand-100">
                            ✦ {r.fitReason}
                          </p>
                        )}
                        {r.eligibility && <p className="mt-1.5 text-xs text-gray-500 line-clamp-2">{r.eligibility}</p>}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {r.url && (
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:text-brand-700" title="Open URL">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        <button
                          onClick={() => !isAdded && handleAdd(r, idx)}
                          disabled={isAdded || adding[idx]}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            isAdded
                              ? "bg-green-100 text-green-700 cursor-default"
                              : "bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                          }`}
                        >
                          {adding[idx] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isAdded ? <BadgeCheck className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                          {isAdded ? "Added" : "Add to List"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddGrantModal({ onClose, onSaved }: { onClose: () => void; onSaved: (g: Grant) => void }) {
  const [form, setForm] = useState<Partial<Grant>>(EMPTY_FORM());
  const [saving, setSaving] = useState(false);
  const [researching, setResearching] = useState(false);
  const [researchMsg, setResearchMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Grant, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleResearch = async () => {
    if (!form.name?.trim() && !form.url?.trim()) { setError("Enter a grant name or URL first"); return; }
    setResearching(true); setResearchMsg(null); setError(null);
    try {
      const res = await fetch("/api/grants/research", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, url: form.url, founder: form.founder, existingData: form }),
      });
      const data = await res.json();
      if (data.success && data.filled) {
        setForm((p) => ({ ...p, ...data.filled }));
        const count = Object.keys(data.filled).length;
        setResearchMsg(`✓ AI filled ${count} field${count !== 1 ? "s" : ""}`);
      } else setError(data.error || "Research failed");
    } catch { setError("Network error"); }
    finally { setResearching(false); }
  };

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
          {researchMsg && <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{researchMsg}</p>}
          {researching && <div className="mb-4 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700"><Loader2 className="h-4 w-4 animate-spin" /> AI is researching this grant…</div>}
          <GrantFormFields form={form} set={set} onResearch={handleResearch} researching={researching} />
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

const VERDICT_STYLES: Record<string, string> = {
  "Strong Fit":   "bg-green-100 text-green-800 border-green-300",
  "Good Fit":     "bg-emerald-100 text-emerald-800 border-emerald-300",
  "Possible Fit": "bg-yellow-100 text-yellow-800 border-yellow-300",
  "Weak Fit":     "bg-orange-100 text-orange-800 border-orange-300",
  "Not Eligible": "bg-red-100 text-red-700 border-red-300",
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? "#16a34a" : score >= 50 ? "#ca8a04" : score >= 30 ? "#ea580c" : "#dc2626";
  const r = 20, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
  return (
    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
      <svg className="absolute" width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#e5e7eb" strokeWidth="5" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 32 32)" />
      </svg>
      <span className="text-sm font-bold" style={{ color }}>{score}%</span>
    </div>
  );
}

function AnalysisPanel({ analysis, onClose }: { analysis: GrantAnalysis; onClose: () => void }) {
  const verdictCls = VERDICT_STYLES[analysis.verdict] ?? "bg-gray-100 text-gray-700 border-gray-300";
  return (
    <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-4">
          <ScoreRing score={analysis.score} />
          <div>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${verdictCls}`}>{analysis.verdict}</span>
            <p className="mt-1.5 text-sm text-gray-700 max-w-lg">{analysis.summary}</p>
          </div>
        </div>
        <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {analysis.strengths.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /> Strengths</p>
            <ul className="space-y-1">{analysis.strengths.map((s, i) => <li key={i} className="text-xs text-gray-700">• {s}</li>)}</ul>
          </div>
        )}
        {analysis.gaps.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-red-600"><AlertCircle className="h-3.5 w-3.5" /> Gaps</p>
            <ul className="space-y-1">{analysis.gaps.map((g, i) => <li key={i} className="text-xs text-gray-700">• {g}</li>)}</ul>
          </div>
        )}
      </div>
      {analysis.recommendation && (
        <div className="mt-3 rounded-lg border border-brand-200 bg-white px-3 py-2">
          <p className="text-xs font-semibold text-brand-700 flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> Recommendation</p>
          <p className="mt-0.5 text-xs text-gray-700">{analysis.recommendation}</p>
        </div>
      )}
    </div>
  );
}

function GrantRow({ grant, onUpdate, onDelete, companyDNA }: {
  grant: Grant;
  onUpdate: (id: string, d: Partial<Grant>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  companyDNA: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Grant>>({ ...grant });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [researching, setResearching] = useState(false);
  const [analysis, setAnalysis] = useState<GrantAnalysis | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [researchMsg, setResearchMsg] = useState<string | null>(null);
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

  const handleAnalyse = async () => {
    if (!companyDNA) { setAiError("No company DNA found. Add company info first."); setExpanded(true); return; }
    setAnalysing(true); setAiError(null); setAnalysis(null); setExpanded(true);
    try {
      const res = await fetch("/api/grants/analyse", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grant, companyDNA }),
      });
      const data = await res.json();
      if (data.success) setAnalysis(data.analysis);
      else setAiError(data.error || "Analysis failed");
    } catch { setAiError("Network error"); }
    finally { setAnalysing(false); }
  };

  const handleResearch = async () => {
    setResearching(true); setAiError(null); setResearchMsg(null); setExpanded(true);
    try {
      const res = await fetch("/api/grants/research", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: grant.name, url: grant.url, founder: grant.founder, existingData: grant }),
      });
      const data = await res.json();
      if (data.success && data.filled) {
        await onUpdate(grant.id, data.filled);
        setForm((p) => ({ ...p, ...data.filled }));
        const count = Object.keys(data.filled).length;
        setResearchMsg(`✓ AI filled ${count} field${count !== 1 ? "s" : ""}`);
        setEditing(true);
      } else setAiError(data.error || "Research failed");
    } catch { setAiError("Network error"); }
    finally { setResearching(false); }
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
          <div className="flex items-center gap-1.5">
            {grant.url && (
              <a href={grant.url} target="_blank" rel="noopener noreferrer" title="Open URL" className="text-brand-500 hover:text-brand-700">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <button onClick={handleAnalyse} disabled={analysing} title="AI Fit Calculator" className="text-purple-400 hover:text-purple-600 disabled:opacity-40">
              {analysing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            </button>
            <button onClick={handleResearch} disabled={researching} title="AI Auto-fill missing fields" className="text-brand-400 hover:text-brand-600 disabled:opacity-40">
              {researching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </button>
            <button onClick={() => { setEditing(true); setExpanded(true); }} title="Edit" className="text-gray-400 hover:text-brand-600">
              <FileText className="h-4 w-4" />
            </button>
            <button onClick={del} disabled={deleting} title="Delete" className="text-gray-300 hover:text-red-500 disabled:opacity-40">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-gray-100 bg-gray-50">
          <td colSpan={7} className="px-6 py-5">
            {aiError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{aiError}</p>}
            {researchMsg && <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{researchMsg}</p>}
            {(analysing || researching) && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                {analysing ? "AI is analysing your fit for this grant…" : "AI is researching and filling missing fields…"}
              </div>
            )}
            {analysis && <AnalysisPanel analysis={analysis} onClose={() => setAnalysis(null)} />}
            {editing ? (
              <div>
                <GrantFormFields form={form} set={set} onResearch={handleResearch} researching={researching} />
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
                  {!grant.eligibility && !grant.howToApply && !grant.notes && (
                    <p className="text-sm text-gray-400">No details yet — click <span className="text-brand-600">✦ Auto-fill</span> to let AI research this grant.</p>
                  )}
                </div>
                <div className="lg:col-span-2 flex items-center gap-4">
                  <button onClick={() => setEditing(true)} className="text-xs text-brand-600 hover:underline">Edit all fields →</button>
                  <button onClick={handleAnalyse} disabled={analysing} className="flex items-center gap-1 text-xs text-purple-600 hover:underline disabled:opacity-50">
                    <FlaskConical className="h-3 w-3" /> Run fit analysis
                  </button>
                  <button onClick={handleResearch} disabled={researching} className="flex items-center gap-1 text-xs text-brand-600 hover:underline disabled:opacity-50">
                    <Sparkles className="h-3 w-3" /> AI auto-fill missing fields
                  </button>
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
  const { grants, loading, companyDNA, updateGrant, deleteGrant, addGrant } = useGrants();
  const [showAdd, setShowAdd] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const [decisionFilter, setDecisionFilter] = useState("All");
  const [sortField, setSortField] = useState<"deadlineDate" | "fitScore" | "name">("deadlineDate");
  const [sortAsc, setSortAsc] = useState(true);

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

  const existingNames = new Set(grants.map((g) => g.name.toLowerCase()));

  return (
    <div className="mx-auto max-w-7xl">
      {showAdd && <AddGrantModal onClose={() => setShowAdd(false)} onSaved={(g) => addGrant(g)} />}
      {showSearch && (
        <GrantSearchModal
          onClose={() => setShowSearch(false)}
          onAdded={(g) => addGrant(g)}
          companyDNA={companyDNA}
          existingNames={existingNames}
        />
      )}

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Grants</h1>
          <p className="mt-1 text-gray-500">Track, research, and prioritise grant opportunities</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSearch(true)} className="flex items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-100">
            <Search className="h-4 w-4" /> Search Grants
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" /> Add Grant
          </button>
        </div>
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
                <GrantRow key={grant.id} grant={grant} onUpdate={updateGrant} onDelete={deleteGrant} companyDNA={companyDNA} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
