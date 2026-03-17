"use client";

import { useState, useMemo } from "react";
import { X, Trash2, Loader2, Copy } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { fuzzyMatchesExisting } from "@/lib/fuzzyMatch";
import type { Grant } from "@/hooks/useGrants";

interface Props {
  grants: Grant[];
  onClose: () => void;
  onDeleted: (ids: string[]) => void;
}

interface Pair {
  keep: Grant;
  remove: Grant;
}

export function DuplicatesModal({ grants, onClose, onDeleted }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<Set<string>>(new Set());

  // Build duplicate pairs once
  const pairs = useMemo<Pair[]>(() => {
    const seen = new Set<string>();
    const result: Pair[] = [];
    for (let i = 0; i < grants.length; i++) {
      for (let j = i + 1; j < grants.length; j++) {
        const a = grants[i];
        const b = grants[j];
        const pairKey = [a.id, b.id].sort().join("|");
        if (seen.has(pairKey)) continue;
        const otherNames = new Set([b.name.toLowerCase()]);
        if (fuzzyMatchesExisting(a.name, otherNames)) {
          seen.add(pairKey);
          // Default: keep newer (later createdAt), remove older
          const older = new Date(a.createdAt) <= new Date(b.createdAt) ? a : b;
          const newer = older.id === a.id ? b : a;
          result.push({ keep: newer, remove: older });
        }
      }
    }
    return result;
  }, [grants]);

  // Initialise toRemove with the older of each pair
  useMemo(() => {
    setToRemove(new Set(pairs.map(p => p.remove.id)));
  }, [pairs]);

  const toggleRemove = (pairIdx: number) => {
    const pair = pairs[pairIdx];
    setToRemove(prev => {
      const next = new Set(prev);
      if (next.has(pair.remove.id)) {
        // Swap: remove the keep instead
        next.delete(pair.remove.id);
        next.add(pair.keep.id);
      } else {
        // Swap back
        next.delete(pair.keep.id);
        next.add(pair.remove.id);
      }
      return next;
    });
  };

  const handleDelete = async () => {
    const ids = Array.from(toRemove);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} grant${ids.length !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await authFetch("/api/grants/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (data.success) {
        onDeleted(ids);
        onClose();
      } else {
        setMsg(data.error ?? "Delete failed — please try again.");
      }
    } catch {
      setMsg("Network error — please try again.");
    }
    setBusy(false);
  };

  if (pairs.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl text-center">
          <Copy className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-600 font-medium">No duplicates found</p>
          <p className="text-sm text-gray-400 mt-1">All your grants appear to be unique.</p>
          <button onClick={onClose} className="mt-5 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Duplicate Grants</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {pairs.length} possible duplicate pair{pairs.length !== 1 ? "s" : ""} found — choose which to delete
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Pairs list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {pairs.map((pair, idx) => {
            const removeId = Array.from(toRemove).find(id => id === pair.keep.id || id === pair.remove.id);
            const keepingNewer = removeId === pair.remove.id;
            return (
              <div key={idx} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">
                  Pair {idx + 1}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[pair.keep, pair.remove].map((grant) => {
                    const isMarkedDelete = toRemove.has(grant.id);
                    return (
                      <div
                        key={grant.id}
                        className={`rounded-lg border p-3 transition-colors ${
                          isMarkedDelete
                            ? "border-red-300 bg-red-50 opacity-70"
                            : "border-green-300 bg-green-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-semibold text-gray-900 leading-tight">{grant.name}</p>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            isMarkedDelete ? "bg-red-200 text-red-700" : "bg-green-200 text-green-700"
                          }`}>
                            {isMarkedDelete ? "DELETE" : "KEEP"}
                          </span>
                        </div>
                        {grant.founder && <p className="text-xs text-gray-500">{grant.founder}</p>}
                        <p className="text-xs text-gray-400 mt-1">
                          Added {new Date(grant.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => toggleRemove(idx)}
                  className="mt-2 text-xs text-amber-700 underline hover:text-amber-900"
                >
                  {keepingNewer ? "Switch — keep older instead" : "Switch — keep newer instead"}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between gap-3">
          {msg && <p className="text-sm text-red-600">{msg}</p>}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-500">{toRemove.size} selected for deletion</span>
            <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={busy || toRemove.size === 0}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete {toRemove.size} grant{toRemove.size !== 1 ? "s" : ""}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
