"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, ChevronDown, ChevronUp, History } from "lucide-react";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { CATEGORIES } from "@/lib/content";

interface Violation {
  ruleId: string;
  ruleTitle: string;
  ruleType: string;
  severity: string;
  explanation: string;
}

interface AuditResult {
  id: string;
  contentId: string;
  contentCategory: string;
  contentSnippet: string;
  passed: boolean;
  violations: Violation[];
  scannedAt: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high:     "bg-orange-100 text-orange-700 border-orange-200",
  medium:   "bg-amber-100 text-amber-700 border-amber-200",
  low:      "bg-blue-100 text-blue-700 border-blue-200",
};

export function ResultsTab() {
  const [results, setResults] = useState<AuditResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/compliance/results?companyId=${DEMO_COMPANY_ID}&limit=100`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load results");
      setResults(data.results ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load results");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  const getCategoryLabel = (key: string) =>
    CATEGORIES.find((c) => c.key === key)?.label ?? key;

  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-500" />
        <p className="mt-3 text-sm text-gray-400">Loading audit history…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 py-20 text-center">
        <History className="mx-auto h-10 w-10 text-gray-300" />
        <p className="mt-3 font-medium text-gray-500">No audits run yet</p>
        <p className="mt-1 text-sm text-gray-400">Run your first audit from the Scanner tab or approve content with rules active.</p>
      </div>
    );
  }

  const passCount = results.filter((r) => r.passed).length;
  const failCount = results.length - passCount;

  return (
    <div>
      {/* Summary stats */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center">
          <p className="text-2xl font-bold text-gray-800">{results.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Audits</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-center">
          <p className="text-2xl font-bold text-green-700">{passCount}</p>
          <p className="text-xs text-green-600 mt-0.5">Passed</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center">
          <p className="text-2xl font-bold text-red-700">{failCount}</p>
          <p className="text-xs text-red-600 mt-0.5">Failed</p>
        </div>
      </div>

      {/* Results list */}
      <div className="space-y-3">
        {results.map((result) => (
          <div key={result.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <button
              onClick={() => setExpanded((v) => v === result.id ? null : result.id)}
              className="w-full px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {result.passed
                  ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  : <XCircle className="h-5 w-5 text-red-500 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {getCategoryLabel(result.contentCategory)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${result.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {result.passed ? "PASSED" : `FAILED · ${result.violations.length} violation${result.violations.length !== 1 ? "s" : ""}`}
                    </span>
                    <span className="ml-auto text-xs text-gray-400">
                      {new Date(result.scannedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-gray-500">{result.contentSnippet}</p>
                </div>
                {expanded === result.id
                  ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
                  : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
              </div>
            </button>

            {expanded === result.id && result.violations.length > 0 && (
              <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                <h4 className="mb-2 text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                  Violations
                </h4>
                <div className="space-y-2">
                  {result.violations.map((v, i) => (
                    <div key={i} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${SEVERITY_COLORS[v.severity] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                          {v.severity.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">{v.ruleType}</span>
                      </div>
                      <p className="text-xs font-medium text-gray-800">{v.ruleTitle}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{v.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
