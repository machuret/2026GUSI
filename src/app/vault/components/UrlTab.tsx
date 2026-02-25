"use client";

import { useState } from "react";
import { Globe, Loader2, CheckCircle2, AlertCircle, AlertTriangle, X } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { VAULT_CATEGORIES, type VaultItem } from "./vaultTypes";

const inp = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const lbl = "mb-1 block text-xs font-medium text-gray-600";

interface Props {
  onSaved: (item: VaultItem) => void;
  onError: (msg: string) => void;
  checkDuplicate?: (content: string) => VaultItem | null;
}

export function UrlTab({ onSaved, onError, checkDuplicate }: Props) {
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("general");
  const [crawling, setCrawling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; content: string } | null>(null);
  const [dupItem, setDupItem] = useState<VaultItem | null>(null);

  const handleCrawl = async () => {
    if (!url.trim()) return;
    setCrawling(true); setCrawlError(null); setPreview(null); setDupItem(null);
    try {
      const res = await authFetch("/api/vault/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setCrawlError(data.error || "Crawl failed"); return; }
      const p = { title: data.title, content: data.content };
      setPreview(p);
      if (checkDuplicate) {
        const dup = checkDuplicate(data.content);
        if (dup) setDupItem(dup);
      }
    } catch (err) {
      setCrawlError(err instanceof Error ? err.message : "Network error");
    } finally { setCrawling(false); }
  };

  const handleSave = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: preview.title, content: preview.content, fileType: `url:${category}` }),
      });
      const data = await res.json();
      if (!res.ok) { onError(data.error || "Save failed"); return; }
      onSaved(data.item);
      setPreview(null); setUrl(""); setCategory("general"); setDupItem(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Network error");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Paste any public URL — the AI extracts and summarises the content, then stores it in the vault.</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className={lbl}>URL *</label>
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCrawl()}
              placeholder="https://example.com/about"
              className={inp}
            />
            <button
              onClick={handleCrawl}
              disabled={crawling || !url.trim()}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {crawling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              {crawling ? "Crawling…" : "Crawl"}
            </button>
          </div>
        </div>
        <div>
          <label className={lbl}>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inp}>
            {VAULT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {crawlError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{crawlError}
        </div>
      )}

      {preview && (
        <div className="space-y-2">
          {dupItem && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-amber-800">Possible duplicate of <span className="font-semibold">"{dupItem.filename}"</span></p>
                <p className="text-xs text-amber-600 mt-0.5">This URL content looks very similar to an existing vault entry.</p>
                <button onClick={() => setDupItem(null)} className="mt-1.5 text-xs text-amber-700 underline">Dismiss and save anyway</button>
              </div>
            </div>
          )}
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <p className="font-semibold text-green-800 text-sm">{preview.title}</p>
              </div>
              <button onClick={() => { setPreview(null); setDupItem(null); }} className="text-green-400 hover:text-green-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-green-700 mb-3 line-clamp-4 whitespace-pre-wrap">{preview.content}</p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving || (dupItem !== null)}
                className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save to Vault
              </button>
              <span className="text-xs text-green-600">{preview.content.length.toLocaleString()} chars extracted</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
