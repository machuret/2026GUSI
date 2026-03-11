"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft, Plus, Trash2, Loader2, X, Save,
  ChevronDown, ChevronUp, Eye, EyeOff, GripVertical,
  ExternalLink, Users,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";

interface Ambassador {
  id: string;
  name: string;
  title?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  slug: string;
  sortOrder: number;
  active: boolean;
  linkedinUrl?: string | null;
  websiteUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

type FormData = {
  name: string;
  title: string;
  bio: string;
  photoUrl: string;
  slug: string;
  sortOrder: number;
  active: boolean;
  linkedinUrl: string;
  websiteUrl: string;
};

const emptyForm: FormData = {
  name: "", title: "", bio: "", photoUrl: "",
  slug: "", sortOrder: 0, active: true,
  linkedinUrl: "", websiteUrl: "",
};

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelCls = "mb-1 block text-xs font-medium text-gray-700";

function AmbassadorForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: FormData;
  onSave: (data: FormData) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormData>(initial);
  const [autoSlug, setAutoSlug] = useState(!initial.name);
  const set = (k: keyof FormData, v: string | number | boolean) =>
    setForm((p) => {
      const next = { ...p, [k]: v };
      if (k === "name" && autoSlug) next.slug = slugify(v as string);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Full Name *</label>
          <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Dr. Jane Smith" />
        </div>
        <div>
          <label className={labelCls}>Title / Role</label>
          <input className={inputCls} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Clinical Psychologist" />
        </div>
      </div>

      <div>
        <label className={labelCls}>Bio</label>
        <textarea
          className={inputCls + " resize-y"}
          rows={5}
          value={form.bio}
          onChange={(e) => set("bio", e.target.value)}
          placeholder="Write a bio for this ambassador..."
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Photo URL</label>
          <input className={inputCls} value={form.photoUrl} onChange={(e) => set("photoUrl", e.target.value)} placeholder="https://example.com/photo.jpg" />
          {form.photoUrl && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-10 w-10 rounded-full overflow-hidden border border-gray-200 bg-gray-50">
                <Image src={form.photoUrl} alt="Preview" width={40} height={40} className="h-full w-full object-cover" unoptimized />
              </div>
              <span className="text-xs text-gray-400">Preview</span>
            </div>
          )}
        </div>
        <div>
          <label className={labelCls}>
            URL Slug *
            {autoSlug && <span className="text-gray-400 font-normal ml-1">(auto)</span>}
          </label>
          <input
            className={inputCls}
            value={form.slug}
            onChange={(e) => { setAutoSlug(false); set("slug", e.target.value); }}
            placeholder="jane-smith"
          />
          <p className="mt-0.5 text-[10px] text-gray-400">/ambassadors/{form.slug || "..."}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>LinkedIn URL</label>
          <input className={inputCls} value={form.linkedinUrl} onChange={(e) => set("linkedinUrl", e.target.value)} placeholder="https://linkedin.com/in/..." />
        </div>
        <div>
          <label className={labelCls}>Website URL</label>
          <input className={inputCls} value={form.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} placeholder="https://..." />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Sort Order</label>
          <input type="number" className={inputCls} value={form.sortOrder} onChange={(e) => set("sortOrder", parseInt(e.target.value) || 0)} />
          <p className="mt-0.5 text-[10px] text-gray-400">Lower numbers appear first</p>
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <button
            type="button"
            onClick={() => set("active", !form.active)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              form.active
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-gray-200 bg-gray-50 text-gray-500"
            }`}
          >
            {form.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {form.active ? "Active (visible)" : "Hidden (draft)"}
          </button>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.name || !form.slug}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save Ambassador"}
        </button>
        <button onClick={onCancel} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </div>
  );
}

function AmbassadorRow({
  ambassador: a,
  onUpdate,
  onDelete,
}: {
  ambassador: Ambassador;
  onUpdate: (id: string, data: Partial<Ambassador>) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (form: FormData) => {
    setSaving(true);
    setError(null);
    try {
      await onUpdate(a.id, form);
      setExpanded(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${a.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      onDelete(a.id);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async () => {
    setSaving(true);
    try {
      await onUpdate(a.id, { active: !a.active });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`rounded-xl border bg-white transition-shadow hover:shadow-sm ${!a.active ? "opacity-60" : ""} ${expanded ? "border-brand-300 shadow-md" : "border-gray-200"}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <GripVertical className="h-4 w-4 shrink-0 text-gray-300" />

        {/* Photo */}
        <div className="h-10 w-10 shrink-0 rounded-full overflow-hidden border-2 border-brand-300 bg-gray-100">
          {a.photoUrl ? (
            <Image src={a.photoUrl} alt={a.name} width={40} height={40} className="h-full w-full object-cover" unoptimized />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-brand-50 text-xs font-bold text-brand-400">
              {a.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 text-sm truncate">{a.name}</p>
          <p className="text-xs text-gray-400 truncate">{a.title || a.slug}</p>
        </div>

        {/* Order badge */}
        <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-[10px] font-mono text-gray-500">#{a.sortOrder}</span>

        {/* Active toggle */}
        <button
          onClick={handleToggleActive}
          disabled={saving}
          className={`shrink-0 flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${
            a.active ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-400"
          }`}
        >
          {a.active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          {a.active ? "Active" : "Hidden"}
        </button>

        {/* View */}
        <Link
          href={`/ambassadors/${a.slug}`}
          className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-brand-50 hover:text-brand-600"
          title="View profile"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>

        {/* Expand */}
        <button onClick={() => setExpanded((v) => !v)} className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-gray-100">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {/* Delete */}
        <button onClick={handleDelete} disabled={deleting} className="shrink-0 rounded p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40">
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Expanded edit form */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4">
          {error && <p className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}
          <AmbassadorForm
            initial={{
              name: a.name,
              title: a.title ?? "",
              bio: a.bio ?? "",
              photoUrl: a.photoUrl ?? "",
              slug: a.slug,
              sortOrder: a.sortOrder,
              active: a.active,
              linkedinUrl: a.linkedinUrl ?? "",
              websiteUrl: a.websiteUrl ?? "",
            }}
            onSave={handleSave}
            onCancel={() => setExpanded(false)}
            saving={saving}
          />
        </div>
      )}
    </div>
  );
}

export default function AdminAmbassadorsPage() {
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await authFetch("/api/ambassadors?all=true");
      const data = await res.json();
      setAmbassadors(data.ambassadors ?? []);
    } catch {
      setError("Failed to load ambassadors");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async (form: FormData) => {
    setCreating(true);
    setError(null);
    try {
      const res = await authFetch("/api/ambassadors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setAmbassadors((prev) => [data.ambassador, ...prev]);
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (id: string, patch: Partial<Ambassador>) => {
    const res = await authFetch(`/api/ambassadors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Update failed");
    setAmbassadors((prev) => prev.map((a) => (a.id === id ? data.ambassador : a)));
  };

  const handleDelete = async (id: string) => {
    const res = await authFetch(`/api/ambassadors/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Delete failed");
    }
    setAmbassadors((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin" className="flex items-center gap-1 text-sm text-gray-400 hover:text-brand-600">
              <ArrowLeft className="h-4 w-4" /> Admin
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-7 w-7 text-brand-600" /> Ambassadors
          </h1>
          <p className="mt-1 text-gray-500">Add, edit, and manage ambassador profiles</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/ambassadors"
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <ExternalLink className="h-4 w-4" /> View Page
          </Link>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Add Ambassador
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50/30 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">New Ambassador</h2>
          <AmbassadorForm
            initial={emptyForm}
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
            saving={creating}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="py-12 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-300" />
        </div>
      )}

      {/* List */}
      {!loading && ambassadors.length === 0 && !showCreate && (
        <div className="rounded-2xl border border-dashed border-gray-300 py-20 text-center">
          <Users className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No ambassadors yet</p>
          <p className="text-sm text-gray-400 mt-1">Click &quot;Add Ambassador&quot; to create one.</p>
        </div>
      )}

      {!loading && ambassadors.length > 0 && (
        <div className="space-y-3">
          {ambassadors.map((a) => (
            <AmbassadorRow
              key={a.id}
              ambassador={a}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Stats */}
      {!loading && ambassadors.length > 0 && (
        <div className="mt-6 flex gap-4 text-xs text-gray-400">
          <span>{ambassadors.length} total</span>
          <span>{ambassadors.filter((a) => a.active).length} active</span>
          <span>{ambassadors.filter((a) => !a.active).length} hidden</span>
        </div>
      )}
    </div>
  );
}
