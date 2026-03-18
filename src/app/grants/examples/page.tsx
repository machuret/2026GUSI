"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Plus, Trash2, Loader2, Save, X, BookOpen,
  ChevronDown, ChevronUp, Tag, PenLine, FileText, Search,
} from "lucide-react";
import { authFetch, edgeFn } from "@/lib/authFetch";

interface GrantExample {
  id: string;
  title: string;
  grantName: string;
  funder: string;
  amount: string;
  outcome: string;
  section: string;
  content: string;
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

const SECTION_OPTIONS = [
  "",
  "Cover Letter",
  "Executive Summary",
  "Organisational Background",
  "Needs Statement",
  "Goals & Objectives",
  "Project Description & Narrative",
  "Evaluation Plan",
  "Budget & Budget Narrative",
  "Sustainability Plan",
  "Appendices & Supporting Documents",
  "Full Application",
];

const OUTCOME_OPTIONS = ["", "Won", "Shortlisted", "Rejected", "Pending", "Unknown"];

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelCls = "mb-1 block text-xs font-medium text-gray-600";

const EMPTY_FORM = (): Omit<GrantExample, "id" | "createdAt" | "updatedAt"> => ({
  title: "",
  grantName: "",
  funder: "",
  amount: "",
  outcome: "",
  section: "",
  content: "",
  notes: "",
  tags: [],
});

export default function GrantExamplesPage() {
  const [examples, setExamples] = useState<GrantExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<GrantExample>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");

  const fetchExamples = useCallback(async () => {
    try {
      const res = await authFetch(edgeFn("grant-examples"));
      const data = await res.json();
      setExamples(data.examples ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchExamples(); }, [fetchExamples]);

  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleAdd = async () => {
    if (!form.content.trim()) {
      setSaveError("Content is required — paste your grant text");
      return;
    }
    // Auto-generate title from first ~60 chars of content if left blank
    const payload = form.title.trim()
      ? form
      : {
          ...form,
          title: form.content.trim().replace(/\s+/g, " ").slice(0, 60) +
            (form.content.trim().length > 60 ? "…" : ""),
        };
    setSaving(true);
    setSaveError(null);
    try {
      const res = await authFetch(edgeFn("grant-examples"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setExamples((prev) => [data.example, ...prev]);
      setForm(EMPTY_FORM());
      setShowAdd(false);
      setMsg("✓ Example added");
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    setEditSaving(true);
    try {
      const res = await authFetch(`${edgeFn("grant-examples")}?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setExamples((prev) => prev.map((e) => (e.id === id ? data.example : e)));
      setEditingId(null);
      setMsg("✓ Example updated");
      setTimeout(() => setMsg(null), 3000);
    } catch { /* ignore */ }
    finally { setEditSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this example?")) return;
    setDeletingId(id);
    try {
      await authFetch(`${edgeFn("grant-examples")}?id=${id}`, { method: "DELETE" });
      setExamples((prev) => prev.filter((e) => e.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  };

  const startEdit = (ex: GrantExample) => {
    setEditingId(ex.id);
    setEditForm({ ...ex });
    setExpandedId(ex.id);
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) {
      set("tags", [...form.tags, t]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => set("tags", form.tags.filter((t) => t !== tag));

  const filtered = examples.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch = !search || e.title.toLowerCase().includes(q) || e.grantName.toLowerCase().includes(q) || e.funder.toLowerCase().includes(q) || e.content.toLowerCase().includes(q);
    const matchSection = !filterSection || e.section === filterSection;
    return matchSearch && matchSection;
  });

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/grants" className="flex items-center gap-1 text-sm text-gray-400 hover:text-brand-600">
              <ArrowLeft className="h-4 w-4" /> Grants
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-emerald-600" /> Grant Examples
          </h1>
          <p className="mt-1 text-gray-500">
            Store successful grant applications as references — the Grant Builder uses these to write better applications
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/grants/builder" className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            <PenLine className="h-4 w-4" /> Grant Builder
          </Link>
          <button
            onClick={() => { setShowAdd(true); setSaveError(null); }}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" /> Add Example
          </button>
        </div>
      </div>

      {/* Status message */}
      {msg && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700 font-medium">{msg}</div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Add Grant Example</h2>
            <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Content first — paste-first flow */}
            <div className="md:col-span-2">
              <label className={labelCls}>Content <span className="text-red-500">*</span> <span className="text-gray-400 font-normal">— paste your grant document here, everything else is optional</span></label>
              <textarea
                autoFocus
                value={form.content}
                onChange={(e) => set("content", e.target.value)}
                rows={12}
                className={inputCls + " resize-y font-mono text-xs"}
                placeholder="Paste the full or partial grant application text here…"
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Title <span className="text-gray-400 font-normal">— optional, auto-filled from content if blank</span></label>
              <input value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} placeholder="e.g. AIATSIS Grant 2024 — Won (leave blank to auto-fill)" />
            </div>
            <div>
              <label className={labelCls}>Grant Name <span className="text-gray-400 font-normal">(optional)</span></label>
              <input value={form.grantName} onChange={(e) => set("grantName", e.target.value)} className={inputCls} placeholder="e.g. AIATSIS Research Grant" />
            </div>
            <div>
              <label className={labelCls}>Funder <span className="text-gray-400 font-normal">(optional)</span></label>
              <input value={form.funder} onChange={(e) => set("funder", e.target.value)} className={inputCls} placeholder="e.g. AIATSIS" />
            </div>
            <div>
              <label className={labelCls}>Amount <span className="text-gray-400 font-normal">(optional)</span></label>
              <input value={form.amount} onChange={(e) => set("amount", e.target.value)} className={inputCls} placeholder="e.g. $50,000" />
            </div>
            <div>
              <label className={labelCls}>Outcome <span className="text-gray-400 font-normal">(optional)</span></label>
              <select value={form.outcome} onChange={(e) => set("outcome", e.target.value)} className={inputCls}>
                {OUTCOME_OPTIONS.map((o) => <option key={o} value={o}>{o || "Select…"}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Section <span className="text-gray-400 font-normal">(optional)</span></label>
              <select value={form.section} onChange={(e) => set("section", e.target.value)} className={inputCls}>
                {SECTION_OPTIONS.map((s) => <option key={s} value={s}>{s || "Select section…"}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Tags <span className="text-gray-400 font-normal">(optional)</span></label>
              <div className="flex gap-2">
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  className={inputCls} placeholder="Type and press Enter" />
                <button onClick={addTag} className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">
                  <Tag className="h-3.5 w-3.5" />
                </button>
              </div>
              {form.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {form.tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      {t}
                      <button onClick={() => removeTag(t)} className="text-emerald-400 hover:text-emerald-700"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Notes <span className="text-gray-400 font-normal">— why was this successful? (optional)</span></label>
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                className={inputCls + " resize-y"}
                placeholder="e.g. Strong needs statement backed by ABS data, clear SMART objectives…"
              />
            </div>
          </div>
          {saveError && <p className="mt-3 text-sm text-red-600">{saveError}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={handleAdd} disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Example
            </button>
            <button onClick={() => setShowAdd(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-white">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search examples…"
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <select value={filterSection} onChange={(e) => setFilterSection(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
          <option value="">All sections</option>
          {SECTION_OPTIONS.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <p className="text-xs text-gray-400 ml-auto">{filtered.length} example{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Loading / Empty */}
      {loading ? (
        <div className="py-20 text-center text-gray-400"><Loader2 className="mx-auto h-8 w-8 animate-spin mb-3" />Loading examples…</div>
      ) : examples.length === 0 && !showAdd ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-20 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No grant examples yet</p>
          <p className="text-sm text-gray-400 mt-1">Add winning grant applications as references for the AI writer</p>
          <button onClick={() => setShowAdd(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            <Plus className="h-4 w-4" /> Add Your First Example
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center">
          <p className="text-gray-400">No examples match the current filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ex) => {
            const isExpanded = expandedId === ex.id;
            const isEditing = editingId === ex.id;
            const wordCount = ex.content.trim().split(/\s+/).filter(Boolean).length;
            const outcomeCls = ex.outcome === "Won" ? "bg-green-100 text-green-700" : ex.outcome === "Rejected" ? "bg-red-100 text-red-600" : ex.outcome === "Shortlisted" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500";

            return (
              <div key={ex.id} className="rounded-xl border border-gray-200 bg-white">
                {/* Card header */}
                <div className="flex items-start gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : ex.id)}>
                  <FileText className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{ex.title}</p>
                      {ex.outcome && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${outcomeCls}`}>{ex.outcome}</span>}
                      {ex.section && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">{ex.section}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      {ex.grantName && <span>{ex.grantName}</span>}
                      {ex.funder && <span>by {ex.funder}</span>}
                      {ex.amount && <span>{ex.amount}</span>}
                      <span>{wordCount.toLocaleString()} words</span>
                    </div>
                    {ex.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {ex.tags.map((t) => (
                          <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); startEdit(ex); }} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-brand-600" title="Edit">
                      <PenLine className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(ex.id); }} disabled={deletingId === ex.id} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40" title="Delete">
                      {deletingId === ex.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </div>
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-4">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div>
                            <label className={labelCls}>Title</label>
                            <input value={editForm.title ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} className={inputCls} />
                          </div>
                          <div>
                            <label className={labelCls}>Grant Name</label>
                            <input value={editForm.grantName ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, grantName: e.target.value }))} className={inputCls} />
                          </div>
                          <div>
                            <label className={labelCls}>Funder</label>
                            <input value={editForm.funder ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, funder: e.target.value }))} className={inputCls} />
                          </div>
                          <div>
                            <label className={labelCls}>Amount</label>
                            <input value={editForm.amount ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))} className={inputCls} />
                          </div>
                          <div>
                            <label className={labelCls}>Outcome</label>
                            <select value={editForm.outcome ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, outcome: e.target.value }))} className={inputCls}>
                              {OUTCOME_OPTIONS.map((o) => <option key={o} value={o}>{o || "Select…"}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className={labelCls}>Section</label>
                            <select value={editForm.section ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, section: e.target.value }))} className={inputCls}>
                              {SECTION_OPTIONS.map((s) => <option key={s} value={s}>{s || "Select…"}</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>Content</label>
                          <textarea value={editForm.content ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, content: e.target.value }))} rows={12} className={inputCls + " resize-y font-mono text-xs"} />
                        </div>
                        <div>
                          <label className={labelCls}>Notes</label>
                          <textarea value={editForm.notes ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} rows={3} className={inputCls + " resize-y"} />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleUpdate(ex.id)} disabled={editSaving}
                            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                            {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                          </button>
                          <button onClick={() => setEditingId(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-white">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {ex.notes && (
                          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                            <p className="text-xs font-semibold text-amber-700 mb-0.5">Why this works</p>
                            <p className="text-xs text-amber-800 whitespace-pre-wrap">{ex.notes}</p>
                          </div>
                        )}
                        <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 max-h-[400px] overflow-y-auto">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{ex.content}</p>
                        </div>
                        <p className="text-xs text-gray-400">
                          Added {new Date(ex.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                          {" · "}Last updated {new Date(ex.updatedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
