"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Vault, Trash2, Globe, FileText, Loader2,
  AlertCircle, CheckCircle2, Upload, X, ChevronDown, ChevronUp,
} from "lucide-react";
import { ErrorBanner } from "@/components/ErrorBanner";

interface VaultItem {
  id: string;
  filename: string;
  content: string;
  fileType: string;
  createdAt: string;
}

const VAULT_CATEGORIES = [
  { value: "general",    label: "General" },
  { value: "brand",      label: "Brand & Voice" },
  { value: "competitor", label: "Competitor Research" },
  { value: "product",    label: "Product / Service" },
  { value: "industry",   label: "Industry / Market" },
  { value: "audience",   label: "Audience Insights" },
  { value: "seo",        label: "SEO / Keywords" },
  { value: "legal",      label: "Legal / Compliance" },
  { value: "training",   label: "AI Training Data" },
];

const CAT_COLORS: Record<string, string> = {
  general:    "bg-gray-100 text-gray-600",
  brand:      "bg-purple-100 text-purple-700",
  competitor: "bg-orange-100 text-orange-700",
  product:    "bg-blue-100 text-blue-700",
  industry:   "bg-teal-100 text-teal-700",
  audience:   "bg-pink-100 text-pink-700",
  seo:        "bg-yellow-100 text-yellow-700",
  legal:      "bg-red-100 text-red-700",
  training:   "bg-green-100 text-green-700",
};

const inp = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const lbl = "mb-1 block text-xs font-medium text-gray-600";

type Tab = "paste" | "file" | "csv" | "url";

function getItemCategory(fileType: string) { return fileType.split(":")[1] ?? "general"; }
function getItemType(fileType: string) { return fileType.split(":")[0]; }

function CategoryBadge({ cat }: { cat: string }) {
  const label = VAULT_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CAT_COLORS[cat] ?? "bg-gray-100 text-gray-600"}`}>
      {label}
    </span>
  );
}

export default function VaultPage() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState("all");
  const [activeTab, setActiveTab] = useState<Tab>("paste");

  // Paste tab
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [pasteCategory, setPasteCategory] = useState("general");

  // File upload tab
  const [fileTitle, setFileTitle] = useState("");
  const [fileCategory, setFileCategory] = useState("general");
  const [fileUploading, setFileUploading] = useState(false);
  const [fileResult, setFileResult] = useState<{ name: string; chars: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // CSV tab
  const [csvTitle, setCsvTitle] = useState("");
  const [csvCategory, setCsvCategory] = useState("general");
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState<{ name: string; chars: number } | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  // URL crawl tab
  const [url, setUrl] = useState("");
  const [urlCategory, setUrlCategory] = useState("general");
  const [crawling, setCrawling] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [crawlPreview, setCrawlPreview] = useState<{ title: string; content: string } | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/vault");
      if (!res.ok) throw new Error(`Failed to load vault (${res.status})`);
      const data = await res.json();
      setItems(data.items ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vault");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const saveItem = async (filename: string, content: string, fileType: string) => {
    setSaving(true); setActionError(null);
    try {
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, content, fileType }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error || "Save failed"); return false; }
      setItems((prev) => [data.item, ...prev]);
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
      return false;
    } finally { setSaving(false); }
  };

  const handleSavePaste = async () => {
    if (!pasteTitle.trim() || !pasteContent.trim()) return;
    const ok = await saveItem(pasteTitle.trim(), pasteContent.trim(), `text:${pasteCategory}`);
    if (ok) { setPasteTitle(""); setPasteContent(""); setPasteCategory("general"); }
  };

  const handleFileUpload = async (file: File, isCSV = false) => {
    const setUploading = isCSV ? setCsvUploading : setFileUploading;
    const setResult = isCSV ? setCsvResult : setFileResult;
    const title = isCSV ? csvTitle : fileTitle;
    const category = isCSV ? csvCategory : fileCategory;
    setUploading(true); setActionError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", category);
      if (title.trim()) fd.append("title", title.trim());
      const res = await fetch("/api/vault/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error || "Upload failed"); return; }
      setItems((prev) => [data.item, ...prev]);
      setResult({ name: data.item.filename, chars: data.charCount });
      if (isCSV) { setCsvTitle(""); setCsvCategory("general"); if (csvRef.current) csvRef.current.value = ""; }
      else { setFileTitle(""); setFileCategory("general"); if (fileRef.current) fileRef.current.value = ""; }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Upload failed");
    } finally { setUploading(false); }
  };

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
    const ok = await saveItem(crawlPreview.title, crawlPreview.content, `url:${urlCategory}`);
    if (ok) { setCrawlPreview(null); setUrl(""); setUrlCategory("general"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this item from the vault?")) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    try { await fetch(`/api/vault?id=${id}`, { method: "DELETE" }); }
    catch { fetchItems(); }
  };

  const totalChars = items.reduce((sum, i) => sum + (i.content?.length ?? 0), 0);
  const filtered = filterCat === "all" ? items : items.filter((i) => getItemCategory(i.fileType) === filterCat);

  const TABS: { id: Tab; label: string }[] = [
    { id: "paste", label: "📋 Paste Content" },
    { id: "file",  label: "📄 Upload File" },
    { id: "csv",   label: "📊 Upload CSV" },
    { id: "url",   label: "🌐 Crawl URL" },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      {error && <ErrorBanner message={error} onRetry={fetchItems} onDismiss={() => setError(null)} className="mb-4" />}
      {actionError && <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} className="mb-4" />}

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Vault className="h-8 w-8 text-brand-600" /> Content Vault
        </h1>
        <p className="mt-1 text-gray-500">
          Store reference material the AI learns from — injected into every generation.
        </p>
        {items.length > 0 && (
          <p className="mt-1 text-xs text-gray-400">
            {items.length} item{items.length !== 1 ? "s" : ""} · ~{Math.round(totalChars / 1000)}k characters of context
          </p>
        )}
      </div>

      {/* Add Content Panel */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`shrink-0 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.id
                  ? "border-brand-600 text-brand-700 bg-brand-50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* PASTE TAB */}
          {activeTab === "paste" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Title *</label>
                  <input value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} className={inp} placeholder="e.g. Brand Voice Guide" />
                </div>
                <div>
                  <label className={lbl}>Category</label>
                  <select value={pasteCategory} onChange={(e) => setPasteCategory(e.target.value)} className={inp}>
                    {VAULT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={lbl}>Content *</label>
                <textarea
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  rows={8}
                  className={inp}
                  placeholder="Paste any text — brand guidelines, research notes, product descriptions, competitor info, industry data…"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{pasteContent.length.toLocaleString()} characters</span>
                <button
                  onClick={handleSavePaste}
                  disabled={saving || !pasteTitle.trim() || !pasteContent.trim()}
                  className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save to Vault
                </button>
              </div>
            </div>
          )}

          {/* FILE UPLOAD TAB */}
          {activeTab === "file" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Title (optional — defaults to filename)</label>
                  <input value={fileTitle} onChange={(e) => setFileTitle(e.target.value)} className={inp} placeholder="Override filename…" />
                </div>
                <div>
                  <label className={lbl}>Category</label>
                  <select value={fileCategory} onChange={(e) => setFileCategory(e.target.value)} className={inp}>
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
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, false); }}
                  />
                </label>
              </div>
              {fileUploading && (
                <div className="flex items-center gap-2 text-sm text-brand-600">
                  <Loader2 className="h-4 w-4 animate-spin" /> Parsing file…
                </div>
              )}
              {fileResult && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span><strong>{fileResult.name}</strong> saved — {fileResult.chars.toLocaleString()} characters</span>
                  <button onClick={() => setFileResult(null)} className="ml-auto"><X className="h-3.5 w-3.5" /></button>
                </div>
              )}
            </div>
          )}

          {/* CSV UPLOAD TAB */}
          {activeTab === "csv" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">CSV files are stored as-is — useful for keyword lists, competitor data, product catalogues, etc.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Title (optional)</label>
                  <input value={csvTitle} onChange={(e) => setCsvTitle(e.target.value)} className={inp} placeholder="e.g. Keyword List Q1 2026" />
                </div>
                <div>
                  <label className={lbl}>Category</label>
                  <select value={csvCategory} onChange={(e) => setCsvCategory(e.target.value)} className={inp}>
                    {VAULT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={lbl}>CSV File (max 10MB)</label>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-8 hover:border-brand-400 hover:bg-brand-50 transition-colors">
                  <Upload className="mb-2 h-8 w-8 text-gray-400" />
                  <span className="text-sm font-medium text-gray-600">Click to choose CSV file</span>
                  <input
                    ref={csvRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, true); }}
                  />
                </label>
              </div>
              {csvUploading && (
                <div className="flex items-center gap-2 text-sm text-brand-600">
                  <Loader2 className="h-4 w-4 animate-spin" /> Parsing CSV…
                </div>
              )}
              {csvResult && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span><strong>{csvResult.name}</strong> saved — {csvResult.chars.toLocaleString()} characters</span>
                  <button onClick={() => setCsvResult(null)} className="ml-auto"><X className="h-3.5 w-3.5" /></button>
                </div>
              )}
            </div>
          )}

          {/* URL CRAWL TAB */}
          {activeTab === "url" && (
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
                  <select value={urlCategory} onChange={(e) => setUrlCategory(e.target.value)} className={inp}>
                    {VAULT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              {crawlError && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{crawlError}
                </div>
              )}

              {crawlPreview && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
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
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSaveCrawled}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Save to Vault
                    </button>
                    <span className="text-xs text-green-600">{crawlPreview.content.length.toLocaleString()} chars extracted</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filter bar */}
      {items.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setFilterCat("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${filterCat === "all" ? "bg-brand-600 text-white border-brand-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
          >
            All ({items.length})
          </button>
          {VAULT_CATEGORIES.filter((c) => items.some((i) => getItemCategory(i.fileType) === c.value)).map((c) => {
            const count = items.filter((i) => getItemCategory(i.fileType) === c.value).length;
            return (
              <button
                key={c.value}
                onClick={() => setFilterCat(c.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${filterCat === c.value ? "bg-brand-600 text-white border-brand-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
              >
                {c.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Vault Items */}
      {loading ? (
        <div className="py-12 text-center text-gray-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <Vault className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 font-medium text-gray-500">{items.length === 0 ? "Vault is empty" : "No items in this category"}</p>
          <p className="mt-1 text-sm text-gray-400">Everything stored here feeds the AI on every generation.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const isExpanded = expandedId === item.id;
            const itemType = getItemType(item.fileType);
            const itemCat = getItemCategory(item.fileType);
            const typeIcon = itemType === "url" ? <Globe className="h-3.5 w-3.5 text-blue-600" /> :
                             itemType === "csv" ? <span className="text-xs font-bold text-teal-600">CSV</span> :
                             <FileText className="h-3.5 w-3.5 text-gray-600" />;
            return (
              <div key={item.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                      {typeIcon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="truncate text-sm font-medium text-gray-900">{item.filename}</p>
                        <CategoryBadge cat={itemCat} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {(item.content?.length ?? 0).toLocaleString()} chars · {new Date(item.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-1.5 ml-3">
                    <button onClick={() => setExpandedId(isExpanded ? null : item.id)} className="rounded-md border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50">
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
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
