"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Search, Globe, Upload, Database, ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";

interface KBItem {
  id: string;
  title: string;
  category: "support" | "sales" | "general";
  source: string;
  sourceUrl?: string;
  createdAt: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  support: "bg-blue-100 text-blue-700",
  sales:   "bg-green-100 text-green-700",
  general: "bg-gray-100 text-gray-600",
};

export default function KnowledgePage({ params }: { params: { id: string } }) {
  const [items, setItems] = useState<KBItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<"manual" | "url">("manual");
  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [form, setForm] = useState({
    title: "",
    content: "",
    category: "general" as "support" | "sales" | "general",
    source: "manual" as "manual" | "url",
    sourceUrl: "",
  });

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params_str = new URLSearchParams();
      if (search) params_str.set("search", search);
      if (categoryFilter !== "all") params_str.set("category", categoryFilter);
      const res = await fetch(`/api/chatbots/${params.id}/knowledge?${params_str}`);
      const data = await res.json();
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, [search, categoryFilter]);

  const handleScrapeUrl = async () => {
    if (!form.sourceUrl) return;
    setScraping(true);
    setMsg(null);
    try {
      const res = await fetch("/api/content/scrape-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: form.sourceUrl }),
      });
      const data = await res.json();
      if (data.content) {
        setForm((p) => ({
          ...p,
          title: data.title || new URL(form.sourceUrl).hostname,
          content: data.content,
          source: "url",
        }));
        setMsg({ type: "success", text: "Content scraped — review and save below" });
      } else {
        setMsg({ type: "error", text: data.error ?? "Could not scrape URL" });
      }
    } catch {
      setMsg({ type: "error", text: "Scrape failed" });
    } finally {
      setScraping(false);
    }
  };

  const handleSave = async () => {
    if (!form.title || !form.content) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/chatbots/${params.id}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: "success", text: "Article saved to knowledge base" });
        setForm({ title: "", content: "", category: "general", source: "manual", sourceUrl: "" });
        setShowAdd(false);
        fetchItems();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this knowledge article?")) return;
    await fetch(`/api/chatbots/${params.id}/knowledge?itemId=${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleImportVault = async () => {
    setImporting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/vault`);
      const data = await res.json();
      const docs = data.documents ?? [];
      if (docs.length === 0) { setMsg({ type: "error", text: "No vault documents found" }); return; }

      const rows = docs.map((d: { filename: string; content: string }) => ({
        title: d.filename,
        content: d.content,
        category: "general",
        source: "vault",
      }));

      const res2 = await fetch(`/api/chatbots/${params.id}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });
      const result = await res2.json();
      if (result.success) {
        setMsg({ type: "success", text: `Imported ${result.items?.length ?? docs.length} documents from Vault` });
        fetchItems();
      }
    } catch {
      setMsg({ type: "error", text: "Import failed" });
    } finally {
      setImporting(false);
    }
  };

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/chatbots" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
          <p className="text-sm text-gray-500">Train your chatbot with support and sales content</p>
        </div>
        <button onClick={handleImportVault} disabled={importing} className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60">
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          Import from Vault
        </button>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Add Article
        </button>
      </div>

      {msg && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${msg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </div>
      )}

      {/* Add article panel */}
      {showAdd && (
        <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 p-5">
          <div className="mb-4 flex items-center gap-3">
            <button onClick={() => setAddMode("manual")} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${addMode === "manual" ? "bg-brand-600 text-white" : "bg-white text-gray-600 border border-gray-200"}`}>
              <BookOpen className="mr-1.5 inline h-3.5 w-3.5" />Manual
            </button>
            <button onClick={() => setAddMode("url")} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${addMode === "url" ? "bg-brand-600 text-white" : "bg-white text-gray-600 border border-gray-200"}`}>
              <Globe className="mr-1.5 inline h-3.5 w-3.5" />From URL
            </button>
          </div>

          {addMode === "url" && (
            <div className="mb-3 flex gap-2">
              <input className={inputCls} placeholder="https://your-site.com/support-article" value={form.sourceUrl} onChange={(e) => setForm((p) => ({ ...p, sourceUrl: e.target.value }))} />
              <button onClick={handleScrapeUrl} disabled={scraping || !form.sourceUrl} className="flex items-center gap-1.5 rounded-lg bg-white border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 whitespace-nowrap">
                {scraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                {scraping ? "Scraping…" : "Scrape"}
              </button>
            </div>
          )}

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-700">Title</label>
                <input className={inputCls} placeholder="e.g. How to reset your password" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Category</label>
                <select className={inputCls} value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as "support" | "sales" | "general" }))}>
                  <option value="support">Support</option>
                  <option value="sales">Sales</option>
                  <option value="general">General</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Content</label>
              <textarea rows={6} className={inputCls} placeholder="Paste or write the article content here…" value={form.content} onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving || !form.title || !form.content} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {saving ? "Saving…" : "Save Article"}
              </button>
              <button onClick={() => { setShowAdd(false); setForm({ title: "", content: "", category: "general", source: "manual", sourceUrl: "" }); }} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-white">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search articles…" className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
        {["all", "support", "sales", "general"].map((c) => (
          <button key={c} onClick={() => setCategoryFilter(c)} className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${categoryFilter === c ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {c}
          </button>
        ))}
      </div>

      {/* Items list */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-brand-500" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <BookOpen className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <p className="text-gray-400">No articles yet. Add your first one above.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {items.map((item, i) => (
            <div key={item.id} className={`flex items-center gap-3 px-4 py-3 ${i < items.length - 1 ? "border-b border-gray-100" : ""}`}>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-400">{item.source} · {new Date(item.createdAt).toLocaleDateString("en-AU")}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[item.category]}`}>{item.category}</span>
              <button onClick={() => handleDelete(item.id)} className="text-gray-300 hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
