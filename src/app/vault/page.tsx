"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Vault, Loader2, Search, ChevronDown, ChevronUp, CheckCircle2, X } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { ErrorBanner } from "@/components/ErrorBanner";
import { VaultItemRow } from "./components/VaultItemRow";
import { PasteTab } from "./components/PasteTab";
import { FileTab } from "./components/FileTab";
import { CsvTab } from "./components/CsvTab";
import { UrlTab } from "./components/UrlTab";
import { VAULT_CATEGORIES, getItemCategory, type VaultItem } from "./components/vaultTypes";

type Tab = "paste" | "file" | "csv" | "url";
type SortField = "newest" | "oldest" | "az" | "za" | "largest" | "smallest";

const TABS: { id: Tab; label: string }[] = [
  { id: "paste", label: "📋 Paste" },
  { id: "file",  label: "📄 Upload File" },
  { id: "csv",   label: "📊 Upload CSV" },
  { id: "url",   label: "🌐 Crawl URL" },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "newest",   label: "Newest first" },
  { value: "oldest",   label: "Oldest first" },
  { value: "az",       label: "A → Z" },
  { value: "za",       label: "Z → A" },
  { value: "largest",  label: "Largest first" },
  { value: "smallest", label: "Smallest first" },
];

const PAGE_SIZE = 10;

export default function VaultPage() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState("all");
  const [activeTab, setActiveTab] = useState<Tab>("paste");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("newest");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const fetchItems = useCallback(async () => {
    try {
      const res = await authFetch("/api/vault?limit=1000");
      if (!res.ok) throw new Error(`Failed to load vault (${res.status})`);
      const data = await res.json();
      setItems(data.items ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vault");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const checkDuplicate = (content: string): VaultItem | null => {
    const normalised = content.trim().replace(/\s+/g, " ");
    return items.find((i) => {
      const existing = (i.content ?? "").trim().replace(/\s+/g, " ");
      return existing === normalised || (normalised.length > 100 && existing.includes(normalised.slice(0, 100)));
    }) ?? null;
  };

  const handleSaved = (item: VaultItem) => {
    setItems((prev) => [item, ...prev]);
    setPage(1);
    showToast(`✓ "${item.filename}" saved to vault`);
  };

  const handleUpdated = (updated: VaultItem) => {
    setItems((prev) => prev.map((i) => i.id === updated.id ? updated : i));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this item from the vault?")) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    try { await authFetch(`/api/vault?id=${id}`, { method: "DELETE" }); }
    catch { fetchItems(); }
  };

  const totalChars = items.reduce((sum, i) => sum + (i.content?.length ?? 0), 0);

  const filtered = items
    .filter((i) => {
      const matchCat = filterCat === "all" || getItemCategory(i.fileType) === filterCat;
      const q = search.toLowerCase();
      const matchSearch = !q || i.filename.toLowerCase().includes(q) || (i.content ?? "").toLowerCase().includes(q);
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      if (sortField === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortField === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortField === "az") return a.filename.localeCompare(b.filename);
      if (sortField === "za") return b.filename.localeCompare(a.filename);
      if (sortField === "largest") return (b.content?.length ?? 0) - (a.content?.length ?? 0);
      if (sortField === "smallest") return (a.content?.length ?? 0) - (b.content?.length ?? 0);
      return 0;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="mx-auto max-w-7xl">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-xl border border-green-200 bg-white px-4 py-3 shadow-lg text-sm font-medium text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
          {toast}
          <button onClick={() => setToast(null)} className="ml-2 text-green-400 hover:text-green-700"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {error && <ErrorBanner message={error} onRetry={fetchItems} onDismiss={() => setError(null)} className="mb-4" />}
      {actionError && <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} className="mb-4" />}

      <div className="mb-5">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Vault className="h-8 w-8 text-brand-600" /> Content Vault
        </h1>
        <p className="mt-1 text-gray-500">Store reference material the AI learns from — injected into every generation.</p>
        {items.length > 0 && (
          <p className="mt-0.5 text-xs text-gray-400">
            {items.length} item{items.length !== 1 ? "s" : ""} · ~{Math.round(totalChars / 1000)}k characters of context
          </p>
        )}
      </div>

      <div className="flex gap-6 items-start">
        {/* LEFT: Input panel */}
        <div className="w-[420px] shrink-0">
          <div className="sticky top-4 rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div className="flex border-b border-gray-200 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
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
              {activeTab === "paste" && <PasteTab onSaved={handleSaved} onError={setActionError} checkDuplicate={checkDuplicate} />}
              {activeTab === "file"  && <FileTab  onSaved={handleSaved} onError={setActionError} />}
              {activeTab === "csv"   && <CsvTab   onSaved={handleSaved} onError={setActionError} />}
              {activeTab === "url"   && <UrlTab   onSaved={handleSaved} onError={setActionError} checkDuplicate={checkDuplicate} />}
            </div>
          </div>
        </div>

        {/* RIGHT: Vault entries */}
        <div className="flex-1 min-w-0">
          {/* Search + sort + category filters */}
          <div className="mb-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search vault…"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <select
                value={sortField}
                onChange={(e) => { setSortField(e.target.value as SortField); setPage(1); }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => { setFilterCat("all"); setPage(1); }}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${filterCat === "all" ? "bg-brand-600 text-white border-brand-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
              >
                All ({items.length})
              </button>
              {VAULT_CATEGORIES.filter((c) => items.some((i) => getItemCategory(i.fileType) === c.value)).map((c) => {
                const count = items.filter((i) => getItemCategory(i.fileType) === c.value).length;
                return (
                  <button key={c.value} onClick={() => { setFilterCat(c.value); setPage(1); }}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${filterCat === c.value ? "bg-brand-600 text-white border-brand-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                    {c.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Items */}
          {loading ? (
            <div className="py-12 text-center text-gray-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center">
              <Vault className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-3 font-medium text-gray-500">{items.length === 0 ? "Vault is empty" : "No items match your search"}</p>
              <p className="mt-1 text-sm text-gray-400">Everything stored here feeds the AI on every generation.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {paginated.map((item) => (
                  <VaultItemRow key={item.id} item={item} onDelete={handleDelete} onUpdated={handleUpdated} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-2.5">
                  <p className="text-xs text-gray-500">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(1)} disabled={page === 1}
                      className="rounded px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40">First</button>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-40">
                      <ChevronUp className="h-4 w-4 rotate-[-90deg]" />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pg: number;
                      if (totalPages <= 5) pg = i + 1;
                      else if (page <= 3) pg = i + 1;
                      else if (page >= totalPages - 2) pg = totalPages - 4 + i;
                      else pg = page - 2 + i;
                      return (
                        <button key={pg} onClick={() => setPage(pg)}
                          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${page === pg ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                          {pg}
                        </button>
                      );
                    })}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-40">
                      <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
                    </button>
                    <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                      className="rounded px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40">Last</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
