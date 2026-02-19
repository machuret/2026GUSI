"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { VAULT_CATEGORIES, type VaultItem } from "./vaultTypes";

const inp = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const lbl = "mb-1 block text-xs font-medium text-gray-600";

interface Props {
  onSaved: (item: VaultItem) => void;
  onError: (msg: string) => void;
}

export function PasteTab({ onSaved, onError }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: title.trim(), content: content.trim(), fileType: `text:${category}` }),
      });
      const data = await res.json();
      if (!res.ok) { onError(data.error || "Save failed"); return; }
      onSaved(data.item);
      setTitle(""); setContent(""); setCategory("general");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Network error");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inp} placeholder="e.g. Brand Voice Guide" />
        </div>
        <div>
          <label className={lbl}>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inp}>
            {VAULT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={lbl}>Content *</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          className={inp}
          placeholder="Paste any text — brand guidelines, research notes, product descriptions, competitor info, industry data…"
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{content.length.toLocaleString()} characters</span>
        <button
          onClick={handleSave}
          disabled={saving || !title.trim() || !content.trim()}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save to Vault
        </button>
      </div>
    </div>
  );
}
