"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, CheckCircle2, X } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { VAULT_CATEGORIES, type VaultItem } from "./vaultTypes";

const inp = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const lbl = "mb-1 block text-xs font-medium text-gray-600";

interface Props {
  onSaved: (item: VaultItem) => void;
  onError: (msg: string) => void;
}

export function FileTab({ onSaved, onError }: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ name: string; chars: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", category);
      if (title.trim()) fd.append("title", title.trim());
      const res = await authFetch("/api/vault/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { onError(data.error || "Upload failed"); return; }
      onSaved(data.item);
      setResult({ name: data.item.filename, chars: data.charCount });
      setTitle(""); setCategory("general");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed");
    } finally { setUploading(false); }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Title (optional — defaults to filename)</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inp} placeholder="Override filename…" />
        </div>
        <div>
          <label className={lbl}>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inp}>
            {VAULT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={lbl}>File (PDF, DOCX, TXT, MD — max 10MB)</label>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-8 hover:border-brand-400 hover:bg-brand-50 transition-colors">
          <Upload className="mb-2 h-8 w-8 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Click to choose file</span>
          <span className="mt-1 text-xs text-gray-400">PDF, DOCX, TXT, MD supported</span>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
          />
        </label>
      </div>
      {uploading && (
        <div className="flex items-center gap-2 text-sm text-brand-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Parsing file…
        </div>
      )}
      {result && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span><strong>{result.name}</strong> saved — {result.chars.toLocaleString()} characters</span>
          <button onClick={() => setResult(null)} className="ml-auto"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
    </div>
  );
}
