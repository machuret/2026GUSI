"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";

export interface Template {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  contentType: string;
  active: boolean;
}

interface Props {
  template: Template;
  onToggle: (t: Template) => void;
  onDelete: (id: string) => void;
  onSaveEdit: (id: string, form: { name: string; description: string; systemPrompt: string }) => Promise<void>;
}

export function TemplateCard({ template: t, onToggle, onDelete, onSaveEdit }: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: t.name, description: t.description ?? "", systemPrompt: t.systemPrompt });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try { await onSaveEdit(t.id, form); setEditing(false); }
    finally { setSaving(false); }
  };

  return (
    <div className={`px-5 py-4 ${!t.active ? "opacity-50" : ""}`}>
      {editing ? (
        <div className="space-y-2">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="Template name" />
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="Description (optional)" />
          <textarea value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
            rows={6} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              <Check className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => { setEditing(false); setForm({ name: t.name, description: t.description ?? "", systemPrompt: t.systemPrompt }); }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
              {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button onClick={() => onToggle(t)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium border ${t.active ? "border-green-300 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-500"}`}>
                {t.active ? "Active" : "Inactive"}
              </button>
              <button onClick={() => setEditing(true)} className="rounded-md border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => onDelete(t.id)} className="rounded-md border border-red-100 p-1.5 text-red-400 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2.5 text-xs leading-relaxed text-gray-700">
            {t.systemPrompt}
          </pre>
        </div>
      )}
    </div>
  );
}
