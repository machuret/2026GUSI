"use client";

import { useState, useCallback } from "react";
import { BookOpen, Trash2, FileUp, Loader2, RefreshCw, History, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { SavedDraft, DraftSnapshot, fmtDate } from "./types";
import { authFetch } from "@/lib/authFetch";

interface Props {
  drafts: SavedDraft[];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteNoConfirm: (id: string) => Promise<void>;
  onRedo: (draft: SavedDraft) => void;
  onBulkExport: (ids: string[]) => Promise<void>;
  exportingIds: Set<string>;
  onRestoreSnapshot: (snapshot: { sections: Record<string, string>; brief: Record<string, unknown> | null; tone: string; length: string; grantId: string }) => void;
}

export default function DraftsTab({ drafts, onLoad, onDelete, onDeleteNoConfirm, onRedo, onBulkExport, exportingIds, onRestoreSnapshot }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [historyOpen, setHistoryOpen] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Record<string, DraftSnapshot[]>>({});
  const [loadingHistory, setLoadingHistory] = useState<string | null>(null);

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleAll = () => setSelected(selected.size === drafts.length ? new Set() : new Set(drafts.map(d => d.id)));

  const loadHistory = useCallback(async (draftId: string) => {
    if (historyOpen === draftId) { setHistoryOpen(null); return; }
    setHistoryOpen(draftId);
    if (snapshots[draftId]) return;
    setLoadingHistory(draftId);
    try {
      const res = await authFetch(`/api/grants/draft-history?draftId=${draftId}`);
      const data = await res.json();
      setSnapshots((prev) => ({ ...prev, [draftId]: data.history ?? [] }));
    } catch { /* ignore */ }
    finally { setLoadingHistory(null); }
  }, [historyOpen, snapshots]);

  const restoreSnapshot = useCallback(async (snap: DraftSnapshot) => {
    if (!confirm(`Restore snapshot "${snap.label ?? fmtDate(snap.snapshotAt)}"?\n\nThe current builder content will be replaced.`)) return;
    const res = await authFetch(`/api/grants/draft-history/${snap.id}`);
    const data = await res.json();
    if (!res.ok || !data.snapshot) { alert("Failed to load snapshot"); return; }
    const s = data.snapshot;
    onRestoreSnapshot({ sections: s.sections, brief: s.brief, tone: s.tone, length: s.length, grantId: s.grantId });
  }, [onRestoreSnapshot]);

  const deleteSnapshot = useCallback(async (snapId: string, draftId: string) => {
    if (!confirm("Delete this snapshot?")) return;
    await authFetch(`/api/grants/draft-history/${snapId}`, { method: "DELETE" });
    setSnapshots((prev) => ({ ...prev, [draftId]: (prev[draftId] ?? []).filter(s => s.id !== snapId) }));
  }, []);

  if (drafts.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white py-20 text-center">
        <BookOpen className="mx-auto h-10 w-10 text-gray-200 mb-3" />
        <p className="text-gray-400 text-sm font-medium">No saved drafts yet</p>
        <p className="text-gray-300 text-xs mt-1">Generate and save an application to see it here.</p>
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
              catch { /* keep selection */ }
            }}
            disabled={busyExporting}
            className="flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            {busyExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
            Export to Google Docs
          </button>
          <button
            onClick={async () => {
              if (!confirm(`Delete ${selected.size} selected draft${selected.size === 1 ? '' : 's'}?\n\nThis action cannot be undone.`)) return;
              const ids = Array.from(selected);
              try {
                await Promise.all(ids.map(id => onDeleteNoConfirm(id)));
                setSelected(new Set());
              } catch (err) {
                alert(`Failed to delete some drafts: ${err instanceof Error ? err.message : 'Unknown error'}`);
              }
            }}
            className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Selected
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
            <>
              <tr key={d.id} className={`border-b border-gray-100 hover:bg-gray-50 ${historyOpen === d.id ? "" : "last:border-0"} ${selected.has(d.id) ? "bg-blue-50/40" : ""}`}>
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
                      onClick={() => loadHistory(d.id)}
                      className={`flex items-center gap-0.5 text-xs font-medium transition-colors ${historyOpen === d.id ? "text-purple-600" : "text-gray-400 hover:text-purple-500"}`}
                      title="View version history"
                    >
                      <History className="h-3.5 w-3.5" />
                      {historyOpen === d.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
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
              {historyOpen === d.id && (
                <tr key={`${d.id}-history`} className="border-b border-purple-100 bg-purple-50/30">
                  <td colSpan={6} className="px-6 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <History className="h-3.5 w-3.5 text-purple-500" />
                      <span className="text-xs font-semibold text-purple-700">Version History</span>
                      <span className="text-xs text-purple-400">(last 10 snapshots — auto-created on save &amp; regen)</span>
                    </div>
                    {loadingHistory === d.id ? (
                      <div className="flex items-center gap-2 text-xs text-purple-400 py-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading snapshots…
                      </div>
                    ) : (snapshots[d.id] ?? []).length === 0 ? (
                      <p className="text-xs text-gray-400 py-1">No snapshots yet. Snapshots are created automatically when you save or regen a draft.</p>
                    ) : (
                      <div className="space-y-1">
                        {(snapshots[d.id] ?? []).map((snap) => (
                          <div key={snap.id} className="flex items-center justify-between rounded-lg bg-white border border-purple-100 px-3 py-2">
                            <div>
                              <span className="text-xs font-medium text-gray-700">{snap.label ?? "Snapshot"}</span>
                              <span className="ml-2 text-xs text-gray-400">{new Date(snap.snapshotAt).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                              <span className="ml-2 text-xs text-gray-400 capitalize">{snap.tone.replace("_", " ")} · {snap.length}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => restoreSnapshot(snap)}
                                className="flex items-center gap-1 text-xs text-purple-600 hover:underline font-medium"
                              >
                                <RotateCcw className="h-3 w-3" /> Restore
                              </button>
                              <button onClick={() => deleteSnapshot(snap.id, d.id)} className="text-gray-300 hover:text-red-400" title="Delete snapshot">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
