"use client";

import { useState } from "react";
import { Loader2, Sparkles, Upload, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { authFetch, edgeFn } from "@/lib/authFetch";
import { toast } from "sonner";
import { OutcomeBadge } from "./OutcomeBadge";
import type { GrantHistoryRow } from "./types";

interface ParsedRow {
  funderName: string;
  grantName?: string | null;
  partnerOrg?: string | null;
  region?: string | null;
  outcome?: string | null;
  amount?: string | null;
  rejectionReason?: string | null;
  notes?: string | null;
  submittedAt?: string | null;
}

interface Props {
  onClose: () => void;
  onImported: (rows: GrantHistoryRow[]) => void;
}

export function ImportModal({ onClose, onImported }: Props) {
  const [rawText, setRawText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!rawText.trim()) return;
    setParsing(true);
    setParseError(null);
    setParsed(null);
    try {
      const res = await authFetch("/api/grants/history/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      const data = await res.json();
      if (!res.ok) { setParseError(data.error ?? "Parse failed"); return; }
      setParsed(data.rows ?? []);
    } catch {
      setParseError("Network error — please try again");
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!parsed || parsed.length === 0) return;
    setSaving(true);
    try {
      const res = await authFetch(edgeFn("grant-history-crud"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsed }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Import failed"); return; }
      toast.success(`Imported ${data.inserted?.length ?? parsed.length} history records`);
      onImported(data.inserted ?? []);
      onClose();
    } catch {
      toast.error("Network error — import failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Import History via AI</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Paste raw text — partnership notes, handover docs, meeting notes. The AI will parse it into structured records.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {!parsed ? (
            <>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste your grant history text here..."
                rows={12}
                className="w-full rounded-xl border border-gray-300 p-3 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none font-mono"
              />
              {parseError && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {parseError}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>AI parsed <strong>{parsed.length} records</strong>. Review below then click Import.</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Funder</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Partner</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Region</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Outcome</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map((row, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">{row.funderName}</td>
                        <td className="px-3 py-2 text-gray-500">{row.partnerOrg ?? "—"}</td>
                        <td className="px-3 py-2 text-gray-500">{row.region ?? "—"}</td>
                        <td className="px-3 py-2"><OutcomeBadge outcome={row.outcome} /></td>
                        <td className="px-3 py-2 text-gray-500">{row.amount ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          {parsed ? (
            <>
              <button onClick={() => setParsed(null)} className="text-sm font-medium text-gray-500 hover:text-gray-700">
                ← Edit text
              </button>
              <button
                onClick={handleImport}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {saving ? "Importing…" : `Import ${parsed.length} records`}
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="text-sm font-medium text-gray-500 hover:text-gray-700">
                Cancel
              </button>
              <button
                onClick={handleParse}
                disabled={parsing || !rawText.trim()}
                className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {parsing ? "Parsing…" : "Parse with AI"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
