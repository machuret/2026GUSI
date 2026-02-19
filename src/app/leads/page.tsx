"use client";

import { useRef, useState } from "react";
import {
  Users, Search, Plus, Trash2, ExternalLink, Loader2, X,
  ChevronDown, ChevronUp, Linkedin, Globe, Zap, Save,
  Mail, Phone, Building2, MapPin, Star, Tag, RefreshCw,
  AlertCircle, Code2,
} from "lucide-react";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import {
  useLeads, type Lead, LEAD_STATUSES, STATUS_STYLES, SOURCE_STYLES,
} from "@/hooks/useLeads";

// ─── Source config (mirrors API) ──────────────────────────────────────────────
interface SourceField {
  key: string;
  label: string;
  type: "text" | "number" | "tags";
  placeholder?: string;
  default?: number;
  min?: number;
  max?: number;
}

interface ScrapeSrc {
  id: string;
  label: string;
  description: string;
  inputFields: SourceField[];
}

const SOURCES: ScrapeSrc[] = [
  {
    id: "linkedin",
    label: "LinkedIn Profiles",
    description: "Search LinkedIn by keyword, job title, or company name",
    inputFields: [
      { key: "keywords", label: "Keywords (comma-separated)", type: "tags", placeholder: "nurse, cardiologist, CEO" },
      { key: "limit", label: "Max results", type: "number", default: 10, min: 1, max: 100 },
    ],
  },
  {
    id: "doctolib",
    label: "Doctolib Doctors",
    description: "Scrape doctor profiles from Doctolib (France)",
    inputFields: [
      { key: "searchUrl", label: "Doctolib search URL", type: "text", placeholder: "https://www.doctolib.fr/medecin-generaliste/paris" },
      { key: "maxItems", label: "Max results", type: "number", default: 20, min: 1, max: 200 },
    ],
  },
  {
    id: "webmd",
    label: "WebMD Doctors",
    description: "Extract doctor profiles from WebMD search results",
    inputFields: [
      { key: "searchUrl", label: "WebMD search URL", type: "text", placeholder: "https://doctor.webmd.com/results?q=cardiologist&city=New+York&state=NY" },
      { key: "maxItems", label: "Max results", type: "number", default: 30, min: 1, max: 200 },
    ],
  },
];

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelCls = "mb-1 block text-xs font-medium text-gray-600";

// ─── Tag Input ─────────────────────────────────────────────────────────────────
function TagInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (tags: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (val: string) => {
    const trimmed = val.trim();
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed]);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const handleBlur = () => { if (input.trim()) addTag(input); };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className="flex min-h-[42px] flex-wrap gap-1.5 rounded-lg border border-gray-300 px-3 py-2 cursor-text focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500"
    >
      {tags.map((tag) => (
        <span key={tag} className="flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-800">
          {tag}
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange(tags.filter((t) => t !== tag)); }} className="text-brand-500 hover:text-brand-800">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={tags.length === 0 ? (placeholder ?? "Type and press Enter or comma") : "Add more…"}
        className="min-w-[140px] flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
      />
    </div>
  );
}

// ─── Scraper Modal ─────────────────────────────────────────────────────────────
function ScraperModal({ onClose, onImported }: { onClose: () => void; onImported: (leads: Lead[]) => void }) {
  const [selectedSource, setSelectedSource] = useState<ScrapeSrc>(SOURCES[0]);
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [running, setRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<string>(""); // e.g. "Starting…" | "Running…" | "Fetching results…"
  const [results, setResults] = useState<Partial<Lead>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);

  const setField = (key: string, value: unknown) => setFields((p) => ({ ...p, [key]: value }));

  const handleRun = async () => {
    setRunning(true); setError(null); setResults([]); setImported(false); setRunStatus("Starting actor…");
    try {
      // 1. Start the run — returns immediately with runId
      const startRes = await fetch("/api/leads/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: selectedSource.id, inputFields: fields }),
      });
      const startData = await startRes.json();
      if (startData.error) { setError(startData.error); setRunStatus(""); return; }

      const { runId, datasetId, sourceId } = startData;
      setRunStatus("Actor running…");

      // 2. Poll GET /api/leads/scrape?runId=xxx every 3s until done
      let attempts = 0;
      while (attempts < 60) { // max 3 min client-side
        await new Promise((r) => setTimeout(r, 3000));
        attempts++;

        const pollRes = await fetch(
          `/api/leads/scrape?runId=${runId}&datasetId=${datasetId}&sourceId=${encodeURIComponent(sourceId)}`
        );
        const pollData = await pollRes.json();

        if (pollData.error) { setError(pollData.error); setRunStatus(""); return; }
        if (pollData.running) {
          setRunStatus(`Actor running… (${attempts * 3}s)`);
          continue;
        }
        // SUCCEEDED
        setRunStatus("Fetching results…");
        setResults(pollData.leads ?? []);
        return;
      }
      setError("Timed out after 3 minutes. Check Apify console for run status.");
    } catch { setError("Network error"); }
    finally { setRunning(false); setRunStatus(""); }
  };

  const handleImport = async () => {
    if (!results.length) return;
    setImporting(true);
    try {
      const leads = results.map((r) => ({ ...r, companyId: DEMO_COMPANY_ID, status: "new" }));
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads }),
      });
      const data = await res.json();
      if (data.success) {
        onImported(data.leads ?? []);
        setImported(true);
      } else setError(data.error || "Import failed");
    } catch { setError("Network error"); }
    finally { setImporting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Zap className="h-5 w-5 text-brand-500" /> Lead Scraper
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Powered by Apify — scrape, preview, then import</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Source selector */}
          <div>
            <label className={labelCls}>Data Source</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {SOURCES.map((src) => (
                <button
                  key={src.id}
                  onClick={() => { setSelectedSource(src); setFields({}); setResults([]); setError(null); }}
                  className={`rounded-xl border p-3 text-left transition-colors ${selectedSource.id === src.id ? "border-brand-400 bg-brand-50" : "border-gray-200 hover:border-brand-200"}`}
                >
                  <p className="text-sm font-semibold text-gray-800">{src.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-tight">{src.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic input fields */}
          <div className="space-y-3">
            {selectedSource.inputFields.map((f) => (
              <div key={f.key}>
                <label className={labelCls}>{f.label}</label>
                {f.type === "number" ? (
                  <input
                    type="number" min={f.min} max={f.max}
                    value={(fields[f.key] as number) ?? f.default ?? ""}
                    onChange={(e) => setField(f.key, parseInt(e.target.value))}
                    className={inputCls}
                  />
                ) : f.type === "tags" ? (
                  <TagInput
                    tags={Array.isArray(fields[f.key]) ? (fields[f.key] as string[]) : []}
                    onChange={(tags) => setField(f.key, tags)}
                    placeholder={f.placeholder}
                  />
                ) : (
                  <input
                    type="text"
                    value={(fields[f.key] as string) ?? ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                    className={inputCls} placeholder={f.placeholder}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Run button */}
          <button
            onClick={handleRun} disabled={running}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {running ? <><Loader2 className="h-4 w-4 animate-spin" /> {runStatus || "Running…"}</> : <><Zap className="h-4 w-4" /> Run Scraper</>}
          </button>

          {error && (
            <div className="rounded-lg px-3 py-2 text-sm bg-red-50 text-red-700">{error}</div>
          )}

          {/* Preview results */}
          {results.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">{results.length} leads found — preview</p>
                <button
                  onClick={handleImport} disabled={importing || imported}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${imported ? "bg-green-100 text-green-700 cursor-default" : "bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"}`}
                >
                  {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  {imported ? `✓ Imported ${results.length}` : `Import All ${results.length}`}
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {results.slice(0, 20).map((r, i) => (
                  <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-sm font-medium text-gray-800">{r.fullName || "—"}</p>
                    <p className="text-xs text-gray-500">{[r.jobTitle, r.company, r.location].filter(Boolean).join(" · ")}</p>
                    {r.specialties?.length ? <p className="text-xs text-brand-600 mt-0.5">{r.specialties.slice(0, 3).join(", ")}</p> : null}
                  </div>
                ))}
                {results.length > 20 && <p className="text-xs text-center text-gray-400">+{results.length - 20} more</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Lead Row ─────────────────────────────────────────────────────────────────
function LeadRow({ lead, onUpdate, onDelete }: {
  lead: Lead;
  onUpdate: (id: string, d: Partial<Lead>) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [form, setForm] = useState<Partial<Lead>>({ ...lead });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = (k: keyof Lead, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try { await onUpdate(lead.id, form); setEditing(false); }
    finally { setSaving(false); }
  };

  const del = async () => {
    if (!confirm(`Delete "${lead.fullName || "this lead"}"?`)) return;
    setDeleting(true);
    try { await onDelete(lead.id); }
    finally { setDeleting(false); }
  };

  const statusCls = STATUS_STYLES[lead.status] ?? STATUS_STYLES.new;
  const sourceCls = SOURCE_STYLES[lead.source] ?? SOURCE_STYLES.manual;

  return (
    <>
      <tr className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${expanded ? "bg-gray-50" : ""}`}>
        <td className="px-4 py-3">
          <div className="flex items-start gap-2">
            <button onClick={() => setExpanded(v => !v)} className="mt-0.5 shrink-0 text-gray-400 hover:text-brand-600">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 text-sm">{lead.fullName || "—"}</p>
              <p className="text-xs text-gray-400 mt-0.5">{lead.jobTitle || ""}</p>
            </div>
          </div>
        </td>
        <td className="px-3 py-3 text-sm text-gray-600">{lead.company || <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-3 text-xs text-gray-500">{lead.email ? <a href={`mailto:${lead.email}`} className="text-brand-600 hover:underline">{lead.email}</a> : <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-3 text-xs text-gray-500">{lead.location || <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-3">
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${sourceCls}`}>{lead.source}</span>
        </td>
        <td className="px-3 py-3">
          <select
            value={lead.status}
            onChange={(e) => onUpdate(lead.id, { status: e.target.value })}
            className={`rounded-full border px-2 py-0.5 text-xs font-medium cursor-pointer focus:outline-none ${statusCls}`}
          >
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-1.5">
            {lead.linkedinUrl && <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" title="LinkedIn" className="text-blue-400 hover:text-blue-600"><Linkedin className="h-4 w-4" /></a>}
            {lead.profileUrl && !lead.linkedinUrl && <a href={lead.profileUrl} target="_blank" rel="noopener noreferrer" title="Profile" className="text-brand-400 hover:text-brand-600"><Globe className="h-4 w-4" /></a>}
            <button onClick={() => { setEditing(true); setExpanded(true); }} title="Edit" className="text-gray-400 hover:text-brand-600"><Save className="h-4 w-4" /></button>
            <button onClick={del} disabled={deleting} title="Delete" className="text-gray-300 hover:text-red-500 disabled:opacity-40">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-gray-100 bg-gray-50">
          <td colSpan={7} className="px-6 py-5">
            {editing ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { k: "fullName", label: "Full Name" }, { k: "email", label: "Email" },
                  { k: "phone", label: "Phone" }, { k: "jobTitle", label: "Job Title" },
                  { k: "company", label: "Company" }, { k: "location", label: "Location" },
                  { k: "linkedinUrl", label: "LinkedIn URL" }, { k: "profileUrl", label: "Profile URL" },
                ].map(({ k, label }) => (
                  <div key={k}>
                    <label className={labelCls}>{label}</label>
                    <input value={(form[k as keyof Lead] as string) ?? ""} onChange={(e) => set(k as keyof Lead, e.target.value)} className={inputCls} />
                  </div>
                ))}
                <div className="sm:col-span-3">
                  <label className={labelCls}>Notes</label>
                  <textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={2} className={inputCls} />
                </div>
                <div className="sm:col-span-3 flex gap-2 mt-1">
                  <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                  </button>
                  <button onClick={() => { setEditing(false); setForm({ ...lead }); }} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-white">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                {lead.email && <div className="flex items-center gap-2 text-gray-700"><Mail className="h-4 w-4 text-gray-400 shrink-0" /><a href={`mailto:${lead.email}`} className="text-brand-600 hover:underline truncate">{lead.email}</a></div>}
                {lead.phone && <div className="flex items-center gap-2 text-gray-700"><Phone className="h-4 w-4 text-gray-400 shrink-0" />{lead.phone}</div>}
                {lead.company && <div className="flex items-center gap-2 text-gray-700"><Building2 className="h-4 w-4 text-gray-400 shrink-0" />{lead.company}</div>}
                {lead.location && <div className="flex items-center gap-2 text-gray-700"><MapPin className="h-4 w-4 text-gray-400 shrink-0" />{lead.location}</div>}
                {lead.specialties?.length ? <div className="flex items-start gap-2 text-gray-700 sm:col-span-2"><Tag className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" /><span>{lead.specialties.join(", ")}</span></div> : null}
                {lead.notes && <div className="sm:col-span-3 text-gray-600 text-xs whitespace-pre-wrap bg-white rounded-lg border border-gray-100 px-3 py-2">{lead.notes}</div>}
                <div className="sm:col-span-3 flex items-center gap-4">
                  <button onClick={() => setEditing(true)} className="text-xs text-brand-600 hover:underline">Edit all fields →</button>
                  {lead.rawData && (
                    <button onClick={() => setShowRaw(v => !v)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                      <Code2 className="h-3.5 w-3.5" />
                      {showRaw ? "Hide raw data" : "View raw data"}
                    </button>
                  )}
                </div>
                {showRaw && lead.rawData && (
                  <div className="sm:col-span-3">
                    <pre className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-900 p-3 text-xs text-green-400 max-h-64">{JSON.stringify(lead.rawData, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
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

      {/* Error banner */}
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
          <button onClick={() => setShowScraper(true)} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
            <Zap className="h-4 w-4" /> Scrape Leads
          </button>
        </div>
      </div>

      {/* Pipeline stats */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {LEAD_STATUSES.map((s) => (
          <button
            key={s}
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
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, company…" className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
        </div>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
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
