"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Vault, Plus, Trash2, Globe, FileText, Loader2,
  AlertCircle, CheckCircle2, ExternalLink, RefreshCw, X,
} from "lucide-react";
import { ErrorBanner } from "@/components/ErrorBanner";

interface VaultItem {
  id: string;
  filename: string;
  content: string;
  fileType: string;
  createdAt: string;
}

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelCls = "mb-1 block text-xs font-medium text-gray-600";

export default function VaultPage() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // URL crawl mode
  const [url, setUrl] = useState("");
  const [crawling, setCrawling] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [crawlPreview, setCrawlPreview] = useState<{ title: string; content: string } | null>(null);

  // Manual text mode
  const [showManual, setShowManual] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualContent, setManualContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Expanded item
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/vault");
      if (!res.ok) throw new Error(`Failed to load vault (${res.status})`);
      const data = await res.json();
      setItems(data.items ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vault");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleCrawl = async () => {
    if (!url.trim()) return;
    setCrawling(true); setCrawlError(null); setCrawlPreview(null);
    try {
      const res = await fetch("/api/vault/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setCrawlError(data.error || "Crawl failed"); return; }
      setCrawlPreview({ title: data.title, content: data.content });
    } catch (err) {
      setCrawlError(err instanceof Error ? err.message : "Network error");
    } finally { setCrawling(false); }
  };

  const handleSaveCrawled = async () => {
    if (!crawlPreview) return;
    setSaving(true); setActionError(null);
    try {
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: crawlPreview.title,
          content: crawlPreview.content,
          fileType: "url",
        }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error || "Save failed"); return; }
      setItems((prev) => [data.item, ...prev]);
      setCrawlPreview(null);
      setUrl("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
    } finally { setSaving(false); }
  };

  const handleSaveManual = async () => {
    if (!manualTitle.trim() || !manualContent.trim()) return;
    setSaving(true); setActionError(null);
    try {
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: manualTitle.trim(),
          content: manualContent.trim(),
          fileType: "text",
        }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error || "Save failed"); return; }
      setItems((prev) => [data.item, ...prev]);
      setManualTitle(""); setManualContent(""); setShowManual(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this item from the vault?")) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await fetch(`/api/vault?id=${id}`, { method: "DELETE" });
    } catch {
      fetchItems();
    }
  };

  const totalChars = items.reduce((sum, i) => sum + (i.content?.length ?? 0), 0);

  return (
    <div className="mx-auto max-w-4xl">
      {error && <ErrorBanner message={error} onRetry={fetchItems} onDismiss={() => setError(null)} className="mb-4" />}
      {actionError && <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} className="mb-4" />}

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Vault className="h-8 w-8 text-brand-600" /> Content Vault
          </h1>
          <p className="mt-1 text-gray-500">
            Store URLs and text the AI crawls and learns from — everything here is injected into every generation.
          </p>
          {items.length > 0 && (
            <p className="mt-1 text-xs text-gray-400">
              {items.length} item{items.length !== 1 ? "s" : ""} · ~{Math.round(totalChars / 1000)}k characters of context
            </p>
          )}
        </div>
        <button
          onClick={() => setShowManual(!showManual)}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          <Plus className="h-4 w-4" /> Add Text
        </button>
      </div>

      {/* URL Crawl Panel */}
      <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-1 font-semibold text-gray-800 flex items-center gap-2">
          <Globe className="h-4 w-4 text-brand-500" /> Crawl a URL
        </h2>
        <p className="mb-3 text-xs text-gray-500">
          Paste any public URL — the AI will extract and summarise the content, then store it in the vault.
        </p>
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCrawl()}
            placeholder="https://example.com/about"
            className={inputCls}
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

        {crawlError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{crawlError}
          </div>
        )}

        {crawlPreview && (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <p className="font-semibold text-green-800 text-sm">{crawlPreview.title}</p>
              </div>
              <button onClick={() => setCrawlPreview(null)} className="text-green-400 hover:text-green-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-green-700 mb-3 line-clamp-4 whitespace-pre-wrap">{crawlPreview.content}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveCrawled}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Save to Vault
              </button>
              <span className="text-xs text-green-600">{crawlPreview.content.length.toLocaleString()} chars extracted</span>
            </div>
          </div>
        )}
      </div>

      {/* Manual Text Panel */}
      {showManual && (
        <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 font-semibold text-gray-800 flex items-center gap-2">
            <FileText className="h-4 w-4 text-brand-500" /> Add Text Manually
          </h2>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Title</label>
              <input value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} className={inputCls} placeholder="e.g. Brand Voice Guide, Competitor Analysis…" />
            </div>
            <div>
              <label className={labelCls}>Content</label>
              <textarea
                value={manualContent}
                onChange={(e) => setManualContent(e.target.value)}
                rows={8}
                className={inputCls}
                placeholder="Paste any text — brand guidelines, research notes, product descriptions, competitor info, industry data…"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveManual}
                disabled={saving || !manualTitle.trim() || !manualContent.trim()}
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Save to Vault
              </button>
              <button onClick={() => setShowManual(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vault Items */}
      {loading ? (
        <div className="py-12 text-center text-gray-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <Vault className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 font-medium text-gray-500">Vault is empty</p>
          <p className="mt-1 text-sm text-gray-400">Crawl a URL or add text above — everything stored here feeds the AI on every generation.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            const isUrl = item.fileType === "url";
            return (
              <div key={item.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isUrl ? "bg-blue-100" : "bg-gray-100"}`}>
                      {isUrl ? <Globe className="h-3.5 w-3.5 text-blue-600" /> : <FileText className="h-3.5 w-3.5 text-gray-600" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{item.filename}</p>
                      <p className="text-xs text-gray-400">
                        {isUrl ? "Crawled URL" : "Manual text"} · {(item.content?.length ?? 0).toLocaleString()} chars · {new Date(item.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-1.5 ml-3">
                    <button onClick={() => setExpandedId(isExpanded ? null : item.id)} className="rounded-md border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="rounded-md border border-red-100 p-1.5 text-red-400 hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                    <pre className="whitespace-pre-wrap text-xs text-gray-700 leading-relaxed max-h-64 overflow-y-auto">
                      {item.content}
                    </pre>
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
