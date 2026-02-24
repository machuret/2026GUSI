"use client";

import { useState } from "react";
import { Globe, FileText, Trash2, ChevronDown, ChevronUp, Pencil, Check, X } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { VAULT_CATEGORIES, CAT_COLORS, getItemCategory, getItemType, type VaultItem } from "./vaultTypes";

function CategoryBadge({ cat }: { cat: string }) {
  const label = VAULT_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CAT_COLORS[cat] ?? "bg-gray-100 text-gray-600"}`}>
      {label}
    </span>
  );
}

interface Props {
  item: VaultItem;
  onDelete: (id: string) => void;
  onUpdated?: (item: VaultItem) => void;
}

export function VaultItemRow({ item, onDelete, onUpdated }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.filename);
  const [editCat, setEditCat] = useState(getItemCategory(item.fileType));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const itemType = getItemType(item.fileType);
  const itemCat  = getItemCategory(item.fileType);

  const typeIcon =
    itemType === "url" ? <Globe className="h-3.5 w-3.5 text-blue-600" /> :
    itemType === "csv" ? <span className="text-xs font-bold text-teal-600">CSV</span> :
    <FileText className="h-3.5 w-3.5 text-gray-600" />;

  const startEdit = () => {
    setEditTitle(item.filename);
    setEditCat(getItemCategory(item.fileType));
    setSaveError(null);
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setSaveError(null); };

  const saveEdit = async () => {
    if (!editTitle.trim()) return;
    setSaving(true); setSaveError(null);
    try {
      const newFileType = itemType + ":" + editCat;
      const res = await authFetch("/api/vault", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, filename: editTitle.trim(), fileType: newFileType }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error || "Save failed"); return; }
      setEditing(false);
      onUpdated?.(data.item);
    } catch {
      setSaveError("Network error");
    } finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        {editing ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 mr-2">
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
              className="min-w-0 flex-1 rounded-lg border border-brand-400 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              autoFocus
            />
            <select
              value={editCat}
              onChange={(e) => setEditCat(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {VAULT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        ) : (
          <button
            onClick={() => setExpanded((v) => !v)}
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
                {(item.content?.length ?? 0).toLocaleString()} chars ·{" "}
                {new Date(item.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          </button>
        )}

        <div className="flex shrink-0 items-center gap-1.5 ml-2">
          {editing ? (
            <>
              <button onClick={saveEdit} disabled={saving}
                className="rounded-md border border-green-200 p-1.5 text-green-600 hover:bg-green-50 disabled:opacity-50">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button onClick={cancelEdit}
                className="rounded-md border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50">
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <button onClick={startEdit}
                className="rounded-md border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50 hover:text-brand-600"
                title="Edit title or category">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setExpanded((v) => !v)}
                className="rounded-md border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50">
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              <button onClick={() => onDelete(item.id)}
                className="rounded-md border border-red-100 p-1.5 text-red-400 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {saveError && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">{saveError}</div>
      )}

      {expanded && !editing && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
          <pre className="whitespace-pre-wrap text-xs text-gray-700 leading-relaxed max-h-64 overflow-y-auto">
            {item.content}
          </pre>
        </div>
      )}
    </div>
  );
}
