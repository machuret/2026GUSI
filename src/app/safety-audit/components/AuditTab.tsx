"use client";

import { useState, useCallback, useEffect } from "react";
import { Search, ScanLine, CheckCircle2, XCircle, AlertTriangle, Loader2, ChevronDown } from "lucide-react";
import { CATEGORIES } from "@/lib/content";
import { DEMO_COMPANY_ID } from "@/lib/constants";

interface LibraryItem {
  id: string;
  category: string;
  categoryLabel: string;
  output: string;
  status: string;
  createdAt: string;
}

interface Violation {
  ruleId: string;
  ruleTitle: string;
  ruleType: string;
  severity: string;
  explanation: string;
}

interface ScanResult {
  passed: boolean;
  violations: Violation[];
  summary: string;
  ruleCount: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high:     "bg-orange-100 text-orange-700 border-orange-200",
  medium:   "bg-amber-100 text-amber-700 border-amber-200",
  low:      "bg-blue-100 text-blue-700 border-blue-200",
};

const TYPE_COLORS: Record<string, string> = {
  legal:   "bg-blue-50 text-blue-700",
  medical: "bg-red-50 text-red-700",
  ethical: "bg-purple-50 text-purple-700",
};

export function AuditTab() {
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLibrary = async () => {
      setLoadingLibrary(true);
      try {
        const res = await fetch(`/api/content/library?companyId=${DEMO_COMPANY_ID}&limit=200`);
        const data = await res.json();
        setLibraryItems(data.items ?? []);
      } finally {
        setLoadingLibrary(false);
      }
    };
    fetchLibrary();
  }, []);

  const filtered = libraryItems.filter((item) => {
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return item.output.toLowerCase().includes(q);
    }
    return true;
  });

  const handleScan = useCallback(async () => {
    if (!selectedItem) return;
    setScanning(true);
    setScanError(null);
    setResult(null);
    try {
      const res = await fetch("/api/compliance/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId:       selectedItem.id,
          contentCategory: selectedItem.category,
          contentText:     selectedItem.output,
          companyId:       DEMO_COMPANY_ID,
          saveResult:      true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setResult(data);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }, [selectedItem]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Left: content picker */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-gray-800">Select Content to Audit</h2>

        {/* Filters */}
        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search content…"
              className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-600 bg-white focus:outline-none"
          >
            <option value="all">All Types</option>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Content list */}
        <div className="max-h-[480px] overflow-y-auto space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-2">
          {loadingLibrary ? (
            <div className="py-10 text-center text-sm text-gray-400">
              <Loader2 className="mx-auto h-5 w-5 animate-spin mb-2" />
              Loading library…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">
              No approved content found.{" "}
              {libraryItems.length === 0 ? "Approve content in History first." : "Try adjusting filters."}
            </div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => { setSelectedItem(item); setResult(null); setScanError(null); }}
                className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                  selectedItem?.id === item.id
                    ? "border-brand-400 bg-brand-50 ring-1 ring-brand-300"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {item.categoryLabel}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    item.status === "APPROVED" ? "bg-green-100 text-green-700" : "bg-purple-100 text-purple-700"
                  }`}>
                    {item.status}
                  </span>
                  <span className="ml-auto text-xs text-gray-400">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="line-clamp-2 text-xs text-gray-600 leading-relaxed">
                  {item.output.slice(0, 150)}…
                </p>
              </button>
            ))
          )}
        </div>

        {/* Scan button */}
        <button
          onClick={handleScan}
          disabled={!selectedItem || scanning}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {scanning ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Scanning…</>
          ) : (
            <><ScanLine className="h-4 w-4" /> Run Safety Audit</>
          )}
        </button>
        {!selectedItem && (
          <p className="mt-1.5 text-center text-xs text-gray-400">Select a piece of content above to audit it</p>
        )}
      </div>

      {/* Right: results */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-gray-800">Audit Result</h2>

        {scanError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{scanError}</div>
        )}

        {!result && !scanning && !scanError && (
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50">
            <div className="text-center">
              <ScanLine className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-3 text-sm font-medium text-gray-400">No scan run yet</p>
              <p className="mt-1 text-xs text-gray-400">Select content and click Run Safety Audit</p>
            </div>
          </div>
        )}

        {scanning && (
          <div className="flex h-64 items-center justify-center rounded-xl border border-gray-200 bg-white">
            <div className="text-center">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-brand-500" />
              <p className="mt-3 text-sm font-medium text-gray-600">Scanning against compliance rules…</p>
              <p className="mt-1 text-xs text-gray-400">This may take a few seconds</p>
            </div>
          </div>
        )}

        {result && !scanning && (
          <div className="space-y-4">
            {/* Overall verdict */}
            <div className={`rounded-xl border px-5 py-4 ${
              result.passed
                ? "border-green-200 bg-green-50"
                : result.violations.some((v) => v.severity === "critical")
                  ? "border-red-300 bg-red-50"
                  : "border-orange-200 bg-orange-50"
            }`}>
              <div className="flex items-center gap-3">
                {result.passed
                  ? <CheckCircle2 className="h-7 w-7 text-green-600 shrink-0" />
                  : <XCircle className="h-7 w-7 text-red-600 shrink-0" />}
                <div>
                  <p className={`text-lg font-bold ${result.passed ? "text-green-800" : "text-red-800"}`}>
                    {result.passed ? "✅ PASSED" : "❌ FAILED"}
                  </p>
                  <p className="text-sm text-gray-600">{result.summary}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Checked against {result.ruleCount} active rule{result.ruleCount !== 1 ? "s" : ""} ·{" "}
                {result.violations.length} violation{result.violations.length !== 1 ? "s" : ""} found
              </p>
            </div>

            {/* Violations */}
            {result.violations.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Violations ({result.violations.length})
                </h3>
                {result.violations.map((v, i) => (
                  <div key={i} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${SEVERITY_COLORS[v.severity] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                        {v.severity.toUpperCase()}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[v.ruleType] ?? "bg-gray-100 text-gray-600"}`}>
                        {v.ruleType}
                      </span>
                    </div>
                    <p className="font-medium text-sm text-gray-800">{v.ruleTitle}</p>
                    <p className="mt-1 text-xs text-gray-500 leading-relaxed">{v.explanation}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
