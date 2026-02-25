"use client";

import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { VAULT_CATEGORIES, type VaultItem } from "./vaultTypes";

const inp = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const lbl = "mb-1 block text-xs font-medium text-gray-600";

const CHAR_WARN = 20000;
const CHAR_MAX  = 50000;

interface Props {
  onSaved: (item: VaultItem) => void;
  onError: (msg: string) => void;
  checkDuplicate?: (content: string) => VaultItem | null;
}

export function PasteTab({ onSaved, onError, checkDuplicate }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [saving, setSaving] = useState(false);
  const [dupItem, setDupItem] = useState<VaultItem | null>(null);
  const [forceSubmit, setForceSubmit] = useState(false);

  const chars = content.length;
  const charColor = chars > CHAR_MAX ? "text-red-600 font-semibold" : chars > CHAR_WARN ? "text-orange-500 font-medium" : "text-gray-400";
  const charLabel = chars > CHAR_MAX ? `${chars.toLocaleString()} — exceeds ${CHAR_MAX.toLocaleString()} char limit` : chars > CHAR_WARN ? `${chars.toLocaleString()} — large entry, may slow AI` : `${chars.toLocaleString()} characters`;

  const handleContentChange = (val: string) => {
    setContent(val);
    setDupItem(null);
    setForceSubmit(false);
  };

  const handleSave = async (force = false) => {
    if (!title.trim() || !content.trim()) return;
    if (chars > CHAR_MAX) return;

    if (!force && checkDuplicate) {
      const dup = checkDuplicate(content.trim());
      if (dup) { setDupItem(dup); return; }
    }

    setSaving(true);
    try {
      const res = await authFetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: title.trim(), content: content.trim().replace(/[ \t]+$/gm, ""), fileType: `text:${category}` }),
      });
      const data = await res.json();
      if (!res.ok) { onError(data.error || "Save failed"); return; }
      onSaved(data.item);
      setTitle(""); setContent(""); setCategory("general"); setDupItem(null); setForceSubmit(false);
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
          onChange={(e) => handleContentChange(e.target.value)}
          rows={9}
          className={`${inp} ${chars > CHAR_MAX ? "border-red-400 focus:border-red-500 focus:ring-red-400" : chars > CHAR_WARN ? "border-orange-300 focus:border-orange-400 focus:ring-orange-300" : ""}`}
          placeholder="Paste any text — brand guidelines, research notes, product descriptions, competitor info, industry data…"
        />
        <div className="mt-1 flex items-center justify-between">
          <span className={`text-xs ${charColor}`}>{charLabel}</span>
          {chars > CHAR_WARN && chars <= CHAR_MAX && (
            <span className="text-xs text-orange-500">Consider splitting into smaller entries</span>
          )}
        </div>
      </div>

      {/* Duplicate warning */}
      {dupItem && !forceSubmit && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-amber-800">Possible duplicate of <span className="font-semibold">"{dupItem.filename}"</span></p>
            <p className="text-xs text-amber-600 mt-0.5">This content looks very similar to an existing vault entry.</p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => { setForceSubmit(true); handleSave(true); }}
                className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200">
                Save anyway
              </button>
              <button onClick={() => setDupItem(null)}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end">
        <button
          onClick={() => handleSave(false)}
          disabled={saving || !title.trim() || !content.trim() || chars > CHAR_MAX}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save to Vault
        </button>
      </div>
    </div>
  );
}
