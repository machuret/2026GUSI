"use client";

import { useCallback, useEffect, useState } from "react";
import { Vault, Loader2 } from "lucide-react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { VaultItemRow } from "./components/VaultItemRow";
import { PasteTab } from "./components/PasteTab";
import { FileTab } from "./components/FileTab";
import { CsvTab } from "./components/CsvTab";
import { UrlTab } from "./components/UrlTab";
import { VAULT_CATEGORIES, getItemCategory, type VaultItem } from "./components/vaultTypes";

type Tab = "paste" | "file" | "csv" | "url";

const TABS: { id: Tab; label: string }[] = [
  { id: "paste", label: "📋 Paste Content" },
  { id: "file",  label: "📄 Upload File" },
  { id: "csv",   label: "📊 Upload CSV" },
  { id: "url",   label: "🌐 Crawl URL" },
];

export default function VaultPage() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState("all");
  const [activeTab, setActiveTab] = useState<Tab>("paste");

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

  const handleSaved = (item: VaultItem) => {
    setItems((prev) => [item, ...prev]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this item from the vault?")) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    try { await fetch(`/api/vault?id=${id}`, { method: "DELETE" }); }
    catch { fetchItems(); }
  };

  const totalChars = items.reduce((sum, i) => sum + (i.content?.length ?? 0), 0);
  const filtered = filterCat === "all" ? items : items.filter((i) => getItemCategory(i.fileType) === filterCat);

  return (
    <div className="mx-auto max-w-4xl">
      {error && <ErrorBanner message={error} onRetry={fetchItems} onDismiss={() => setError(null)} className="mb-4" />}
      {actionError && <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} className="mb-4" />}

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Vault className="h-8 w-8 text-brand-600" /> Content Vault
        </h1>
        <p className="mt-1 text-gray-500">Store reference material the AI learns from — injected into every generation.</p>
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
          {activeTab === "paste" && <PasteTab onSaved={handleSaved} onError={setActionError} />}
          {activeTab === "file"  && <FileTab  onSaved={handleSaved} onError={setActionError} />}
          {activeTab === "csv"   && <CsvTab   onSaved={handleSaved} onError={setActionError} />}
          {activeTab === "url"   && <UrlTab   onSaved={handleSaved} onError={setActionError} />}
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
          {filtered.map((item) => (
            <VaultItemRow key={item.id} item={item} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
