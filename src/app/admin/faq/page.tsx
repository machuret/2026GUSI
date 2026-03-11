"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Plus, Trash2, Loader2, X, Save,
  ChevronDown, ChevronUp, Eye, EyeOff, GripVertical,
  ExternalLink, HelpCircle,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category?: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

type FormData = {
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  active: boolean;
};

const emptyForm: FormData = {
  question: "", answer: "", category: "", sortOrder: 0, active: true,
};

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelCls = "mb-1 block text-xs font-medium text-gray-700";

function FaqForm({
  initial, onSave, onCancel, saving,
}: {
  initial: FormData;
  onSave: (data: FormData) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormData>(initial);
  const set = (k: keyof FormData, v: string | number | boolean) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Question *</label>
        <input className={inputCls} value={form.question} onChange={(e) => set("question", e.target.value)} placeholder="What is your return policy?" />
      </div>

      <div>
        <label className={labelCls}>Answer *</label>
        <textarea className={inputCls + " resize-y"} rows={5} value={form.answer} onChange={(e) => set("answer", e.target.value)} placeholder="Write the answer..." />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelCls}>Category</label>
          <input className={inputCls} value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="General" />
          <p className="mt-0.5 text-[10px] text-gray-400">Used to group FAQs on the public page</p>
        </div>
        <div>
          <label className={labelCls}>Sort Order</label>
          <input type="number" className={inputCls} value={form.sortOrder} onChange={(e) => set("sortOrder", parseInt(e.target.value) || 0)} />
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <button type="button" onClick={() => set("active", !form.active)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${form.active ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-500"}`}>
            {form.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {form.active ? "Active" : "Hidden"}
          </button>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={() => onSave(form)} disabled={saving || !form.question || !form.answer}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save FAQ"}
        </button>
        <button onClick={onCancel} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
      </div>
    </div>
  );
}

function FaqRow({ faq, onUpdate, onDelete }: {
  faq: FaqItem;
  onUpdate: (id: string, data: Partial<FaqItem>) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (form: FormData) => {
    setSaving(true); setError(null);
    try { await onUpdate(faq.id, form); setExpanded(false); }
    catch (err) { setError(err instanceof Error ? err.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this FAQ?")) return;
    setDeleting(true);
    try { onDelete(faq.id); } finally { setDeleting(false); }
  };

  const handleToggleActive = async () => {
    setSaving(true);
    try { await onUpdate(faq.id, { active: !faq.active }); } finally { setSaving(false); }
  };

  return (
    <div className={`rounded-xl border bg-white transition-shadow hover:shadow-sm ${!faq.active ? "opacity-60" : ""} ${expanded ? "border-brand-300 shadow-md" : "border-gray-200"}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <GripVertical className="h-4 w-4 shrink-0 text-gray-300" />

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 text-sm truncate">{faq.question}</p>
          <p className="text-xs text-gray-400 truncate">{faq.answer.slice(0, 80)}{faq.answer.length > 80 ? "…" : ""}</p>
        </div>

        {faq.category && (
          <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-600">{faq.category}</span>
        )}

        <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-[10px] font-mono text-gray-500">#{faq.sortOrder}</span>

        <button onClick={handleToggleActive} disabled={saving}
          className={`shrink-0 flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${faq.active ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-400"}`}>
          {faq.active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          {faq.active ? "Active" : "Hidden"}
        </button>

        <button onClick={() => setExpanded((v) => !v)} className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-gray-100">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        <button onClick={handleDelete} disabled={deleting} className="shrink-0 rounded p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40">
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4">
          {error && <p className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}
          <FaqForm
            initial={{ question: faq.question, answer: faq.answer, category: faq.category ?? "", sortOrder: faq.sortOrder, active: faq.active }}
            onSave={handleSave} onCancel={() => setExpanded(false)} saving={saving}
          />
        </div>
      )}
    </div>
  );
}

export default function AdminFaqPage() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await authFetch("/api/faq?all=true");
      const data = await res.json();
      setFaqs(data.faqs ?? []);
    } catch { setError("Failed to load FAQs"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async (form: FormData) => {
    setCreating(true); setError(null);
    try {
      const res = await authFetch("/api/faq", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setFaqs((prev) => [data.faq, ...prev]);
      setShowCreate(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Create failed"); }
    finally { setCreating(false); }
  };

  const handleUpdate = async (id: string, patch: Partial<FaqItem>) => {
    const res = await authFetch(`/api/faq/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Update failed");
    setFaqs((prev) => prev.map((f) => (f.id === id ? data.faq : f)));
  };

  const handleDelete = async (id: string) => {
    const res = await authFetch(`/api/faq/${id}`, { method: "DELETE" });
    if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Delete failed"); }
    setFaqs((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin" className="flex items-center gap-1 text-sm text-gray-400 hover:text-brand-600">
              <ArrowLeft className="h-4 w-4" /> Admin
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <HelpCircle className="h-7 w-7 text-brand-600" /> FAQ Management
          </h1>
          <p className="mt-1 text-gray-500">Add, edit, and manage frequently asked questions</p>
        </div>
        <div className="flex gap-2">
          <Link href="/faq" className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            <ExternalLink className="h-4 w-4" /> View Page
          </Link>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" /> Add FAQ
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {showCreate && (
        <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50/30 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">New FAQ</h2>
          <FaqForm initial={emptyForm} onSave={handleCreate} onCancel={() => setShowCreate(false)} saving={creating} />
        </div>
      )}

      {loading && <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-300" /></div>}

      {!loading && faqs.length === 0 && !showCreate && (
        <div className="rounded-2xl border border-dashed border-gray-300 py-20 text-center">
          <HelpCircle className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No FAQs yet</p>
          <p className="text-sm text-gray-400 mt-1">Click &quot;Add FAQ&quot; to create one.</p>
        </div>
      )}

      {!loading && faqs.length > 0 && (
        <div className="space-y-3">
          {faqs.map((f) => (
            <FaqRow key={f.id} faq={f} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {!loading && faqs.length > 0 && (
        <div className="mt-6 flex gap-4 text-xs text-gray-400">
          <span>{faqs.length} total</span>
          <span>{faqs.filter((f) => f.active).length} active</span>
          <span>{faqs.filter((f) => !f.active).length} hidden</span>
        </div>
      )}
    </div>
  );
}
