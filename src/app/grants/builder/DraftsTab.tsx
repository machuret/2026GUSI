"use client";

import { useState } from "react";
import { BookOpen, Trash2, FileUp, Loader2, RefreshCw } from "lucide-react";
import { SavedDraft, fmtDate } from "./types";

interface Props {
  drafts: SavedDraft[];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onRedo: (draft: SavedDraft) => void;
  onBulkExport: (ids: string[]) => Promise<void>;
  exportingIds: Set<string>;
}

export default function DraftsTab({ drafts, onLoad, onDelete, onRedo, onBulkExport, exportingIds }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleAll = () => setSelected(selected.size === drafts.length ? new Set() : new Set(drafts.map(d => d.id)));

  if (drafts.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white py-20 text-center">
        <BookOpen className="mx-auto h-10 w-10 text-gray-200 mb-3" />
        <p className="text-gray-400 text-sm font-medium">No saved drafts yet</p>
        <p className="text-gray-300 text-xs mt-1">
          Generate and save an application to see it here.
        </p>
      </div>
    );
  }

  const busyExporting = exportingIds.size > 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {selected.size > 0 && (
        <div className="flex items-center gap-3 border-b border-blue-100 bg-blue-50 px-4 py-2.5">
          <span className="text-xs font-semibold text-blue-700">{selected.size} selected</span>
          <button
            onClick={async () => {
              try { await onBulkExport(Array.from(selected)); setSelected(new Set()); }
              catch { /* keep selection so user can retry */ }
            }}
            disabled={busyExporting}
            className="flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            {busyExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
            Export to Google Docs
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-blue-400 hover:text-blue-700">Clear</button>
        </div>
      )}
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-3 py-3 w-8">
              <input type="checkbox" checked={drafts.length > 0 && selected.size === drafts.length}
                onChange={toggleAll} className="h-3.5 w-3.5 rounded border-gray-300" />
            </th>
            {["Grant", "Tone", "Length", "Last Saved", "Actions"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {drafts.map((d) => (
            <tr key={d.id} className={`border-b border-gray-100 hover:bg-gray-50 last:border-0 ${selected.has(d.id) ? "bg-blue-50/40" : ""}`}>
              <td className="px-3 py-3">
                <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} className="h-3.5 w-3.5 rounded border-gray-300" />
              </td>
              <td className="px-4 py-3 font-medium text-sm text-gray-900">{d.grantName}</td>
              <td className="px-3 py-3 text-xs text-gray-500 capitalize">{d.tone.replace("_", " ")}</td>
              <td className="px-3 py-3 text-xs text-gray-500 capitalize">{d.length}</td>
              <td className="px-3 py-3 text-xs text-gray-400">{fmtDate(d.updatedAt)}</td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => onLoad(d.id)} className="text-xs text-brand-600 hover:underline font-medium">Load</button>
                  <button onClick={() => onRedo(d)} className="text-amber-400 hover:text-amber-600 transition-colors" title="Re-do from scratch">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onBulkExport([d.id])}
                    disabled={exportingIds.has(d.id)}
                    className="text-blue-400 hover:text-blue-600 disabled:opacity-40" title="Export to Google Docs"
                  >
                    {exportingIds.has(d.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => onDelete(d.id)} className="text-gray-300 hover:text-red-500 transition-colors" title="Delete draft">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
