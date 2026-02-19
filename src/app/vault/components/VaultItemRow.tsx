"use client";

import { useState } from "react";
import { Globe, FileText, Trash2, ChevronDown, ChevronUp } from "lucide-react";
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
}

export function VaultItemRow({ item, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);

  const itemType = getItemType(item.fileType);
  const itemCat = getItemCategory(item.fileType);

  const typeIcon =
    itemType === "url" ? <Globe className="h-3.5 w-3.5 text-blue-600" /> :
    itemType === "csv" ? <span className="text-xs font-bold text-teal-600">CSV</span> :
    <FileText className="h-3.5 w-3.5 text-gray-600" />;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
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
        <div className="flex shrink-0 items-center gap-1.5 ml-3">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-md border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="rounded-md border border-red-100 p-1.5 text-red-400 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
          <pre className="whitespace-pre-wrap text-xs text-gray-700 leading-relaxed max-h-64 overflow-y-auto">
            {item.content}
          </pre>
        </div>
      )}
    </div>
  );
}
