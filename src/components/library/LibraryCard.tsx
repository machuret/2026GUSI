"use client";

import { memo, useState } from "react";
import {
  Copy, Check, Pencil, Send, Trash2, Tag, Calendar,
  X, ChevronDown, ChevronUp,
} from "lucide-react";
import { SchedulePicker } from "@/components/content/SchedulePicker";
import { CATEGORIES, type ContentWithMeta } from "@/lib/content";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  APPROVED:  { label: "Approved",   cls: "bg-green-100 text-green-700" },
  PUBLISHED: { label: "Published",  cls: "bg-purple-100 text-purple-700" },
};

interface Props {
  item: ContentWithMeta & { isEdited?: boolean; scheduledAt?: string | null };
  onPublish:        (id: string, category: string) => Promise<void>;
  onEdit:           (id: string, category: string, output: string) => Promise<void>;
  onDelete:         (id: string, category: string) => Promise<void>;
  onChangeCategory: (id: string, category: string, newCategory: string) => Promise<void>;
  onScheduled?:     (id: string, date: string | null) => void;
}

function LibraryCardInner({ item, onPublish, onEdit, onDelete, onChangeCategory, onScheduled }: Props) {
  const [expanded, setExpanded]         = useState(false);
  const [editMode, setEditMode]         = useState(false);
  const [editText, setEditText]         = useState(item.output);
  const [editSaving, setEditSaving]     = useState(false);
  const [copied, setCopied]             = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [scheduledAt, setScheduledAt]   = useState<string | null | undefined>(item.scheduledAt);

  const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.APPROVED;
  const preview = item.output.slice(0, 220);
  const isLong  = item.output.length > 220;

  const handleCopy = () => {
    navigator.clipboard.writeText(item.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePublish = async () => {
    setActionLoading(true);
    try { await onPublish(item.id, item.category); } finally { setActionLoading(false); }
  };

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    setEditSaving(true);
    try {
      await onEdit(item.id, item.category, editText);
      setEditMode(false);
    } finally { setEditSaving(false); }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try { await onDelete(item.id, item.category); } finally { setActionLoading(false); setShowDeleteConfirm(false); }
  };

  const handleChangeCategory = async (newCat: string) => {
    setActionLoading(true);
    try {
      await onChangeCategory(item.id, item.category, newCat);
    } finally { setActionLoading(false); setShowCategoryPicker(false); }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-sm">
      {/* Header row */}
      <div className="mb-3 flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
            {badge.label}
          </span>
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
            {item.categoryLabel}
          </span>
          {item.isEdited && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              Edited
            </span>
          )}
          {scheduledAt && (
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(scheduledAt).toLocaleDateString()}
            </span>
          )}
          {item.revisionNumber > 0 && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              v{item.revisionNumber + 1}
            </span>
          )}
        </div>
        <div className="text-right shrink-0">
          {item.user && <p className="text-xs font-medium text-gray-500">{item.user.name}</p>}
          <p className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Prompt */}
      <p className="mb-2 text-xs text-gray-500 italic truncate">
        &ldquo;{item.prompt}&rdquo;
      </p>

      {/* Output / Edit */}
      {editMode ? (
        <div className="mt-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={10}
            className="w-full rounded-lg border border-brand-300 px-3 py-2 text-sm leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={editSaving}
              className="flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {editSaving ? "Saving…" : "Save Changes"}
            </button>
            <button
              onClick={() => { setEditMode(false); setEditText(item.output); }}
              className="rounded-md border border-gray-300 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-gray-50 p-4 text-sm leading-relaxed text-gray-800">
          <p className="whitespace-pre-wrap">
            {expanded || !isLong ? item.output : preview + "…"}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 flex items-center gap-1 text-xs text-brand-600 hover:underline"
            >
              {expanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Show more</>}
            </button>
          )}
        </div>
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 flex items-center justify-between gap-3">
          <p className="text-sm text-red-700">Delete this content permanently?</p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleDelete}
              disabled={actionLoading}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {actionLoading ? "Deleting…" : "Yes, delete"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Category picker */}
      {showCategoryPicker && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">Move to category:</p>
            <button onClick={() => setShowCategoryPicker(false)}>
              <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.filter((c) => c.key !== item.category).map((c) => (
              <button
                key={c.key}
                onClick={() => handleChangeCategory(c.key)}
                disabled={actionLoading}
                className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-600 hover:border-brand-400 hover:text-brand-700 disabled:opacity-50 transition-colors"
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {!editMode && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.status === "APPROVED" && (
            <button
              onClick={handlePublish}
              disabled={actionLoading}
              className="flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" /> Mark Published
            </button>
          )}

          <SchedulePicker
            contentId={item.id}
            scheduledAt={scheduledAt}
            onScheduled={(date) => {
              setScheduledAt(date);
              onScheduled?.(item.id, date);
            }}
          />

          <button
            onClick={() => { setEditMode(true); setEditText(item.output); }}
            className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>

          <button
            onClick={() => { setShowCategoryPicker((v) => !v); setShowDeleteConfirm(false); }}
            className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            <Tag className="h-3.5 w-3.5" /> Change Type
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            {copied
              ? <><Check className="h-3.5 w-3.5 text-green-500" /> Copied</>
              : <><Copy className="h-3.5 w-3.5" /> Copy</>
            }
          </button>

          <button
            onClick={() => { setShowDeleteConfirm((v) => !v); setShowCategoryPicker(false); }}
            className="flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

export const LibraryCard = memo(LibraryCardInner);
