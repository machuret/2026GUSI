"use client";

import { useState } from "react";
import { Eye, EyeOff, Pencil, Trash2, Check, X } from "lucide-react";

export interface Prompt {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  contentType: string;
  active: boolean;
}

interface Props {
  prompt: Prompt;
  categoryLabel: string;
  onToggleActive: (p: Prompt) => void;
  onDelete: (id: string) => void;
  onSaveEdit: (id: string, form: { name: string; description: string; systemPrompt: string }) => Promise<void>;
}

export function PromptCard({ prompt: p, categoryLabel, onToggleActive, onDelete, onSaveEdit }: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: p.name, description: p.description ?? "", systemPrompt: p.systemPrompt });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try { await onSaveEdit(p.id, form); setEditing(false); }
    finally { setSaving(false); }
  };

  return (
    <div className={`rounded-xl border bg-white overflow-hidden ${p.active ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-gray-900">{p.name}</h3>
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">{categoryLabel}</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${p.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {p.active ? "Active" : "Inactive"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => onToggleActive(p)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${p.active ? "border-green-300 text-green-700 hover:bg-green-50" : "border-gray-300 text-gray-500 hover:bg-gray-50"}`}>
            {p.active ? <><EyeOff className="inline h-3 w-3 mr-1" />Disable</> : <><Eye className="inline h-3 w-3 mr-1" />Enable</>}
          </button>
          <button onClick={() => setEditing(true)} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDelete(p.id)} className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="border-t border-gray-100 px-5 pb-4 pt-3">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="Template name" />
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="Description (optional)" />
          <textarea value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
            rows={6} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          <div className="mt-2 flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              <Check className="h-3.5 w-3.5" />{saving ? "Saving..." : "Save"}
            </button>
            <button onClick={() => { setEditing(false); setForm({ name: p.name, description: p.description ?? "", systemPrompt: p.systemPrompt }); }}
              className="rounded-md border border-gray-300 px-4 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-gray-100 px-5 pb-4 pt-3">
          {p.description && <p className="mb-2 text-xs text-gray-500">{p.description}</p>}
          <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-700">
            {p.systemPrompt}
          </pre>
        </div>
      )}
    </div>
  );
}
