"use client";

import { memo, useState } from "react";
import { ThumbsUp, ThumbsDown, RefreshCw, Copy, Check, BookOpen, X, Pencil, Send } from "lucide-react";
import { QUICK_ISSUES } from "@/components/generate/OutputReview";

export interface GeneratedItem {
  id: string;
  prompt: string;
  output: string;
  category: string;
  categoryLabel: string;
  status: string;
  feedback: string | null;
  revisionOf: string | null;
  revisionNumber: number;
  createdAt: string;
  user?: { name: string; email: string } | null;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: "Pending Review", cls: "bg-yellow-100 text-yellow-700" },
  APPROVED:  { label: "Approved",       cls: "bg-green-100 text-green-700" },
  REJECTED:  { label: "Rejected",       cls: "bg-red-100 text-red-700" },
  REVISED:   { label: "Revised",        cls: "bg-blue-100 text-blue-700" },
  PUBLISHED: { label: "To Be Published",cls: "bg-purple-100 text-purple-700" },
};

interface Props {
  item: GeneratedItem;
  onApprove: (id: string, category: string) => Promise<void>;
  onReject: (id: string, category: string, feedback: string, tags: string[]) => Promise<void>;
  onRevise: (id: string) => Promise<void>;
  onEdit: (id: string, category: string, output: string) => Promise<void>;
  onMarkPublish: (id: string, category: string) => Promise<void>;
}

function HistoryItemInner({ item, onApprove, onReject, onRevise, onEdit, onMarkPublish }: Props) {
  const [copiedId, setCopiedId] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState(item.output);
  const [editSaving, setEditSaving] = useState(false);

  const toggleTag = (id: string) =>
    setSelectedTags((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);

  const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.PENDING;
  const isPending = item.status === "PENDING";
  const isRejected = item.status === "REJECTED";

  const handleCopy = () => {
    navigator.clipboard.writeText(item.output);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try { await onApprove(item.id, item.category); } finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    if (selectedTags.length === 0 && !feedbackText.trim()) return;
    const tagLabels = selectedTags.map((id) => QUICK_ISSUES.find((q) => q.id === id)?.label ?? id);
    const combined = [...tagLabels, feedbackText.trim()].filter(Boolean).join(". ");
    setActionLoading(true);
    try {
      await onReject(item.id, item.category, combined, selectedTags);
      setShowRejectForm(false);
      setFeedbackText("");
      setSelectedTags([]);
    } finally { setActionLoading(false); }
  };

  const handleRevise = async () => {
    setActionLoading(true);
    try { await onRevise(item.id); } finally { setActionLoading(false); }
  };

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    setEditSaving(true);
    try {
      await onEdit(item.id, item.category, editText);
      setEditMode(false);
    } finally { setEditSaving(false); }
  };

  const handleMarkPublish = async () => {
    setActionLoading(true);
    try { await onMarkPublish(item.id, item.category); } finally { setActionLoading(false); }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
            {badge.label}
          </span>
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
            {item.categoryLabel}
          </span>
          {item.revisionNumber > 0 && (
            <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
              v{item.revisionNumber + 1}
            </span>
          )}
        </div>
        <div className="text-right shrink-0">
          {item.user && <p className="text-xs font-medium text-gray-500">{item.user.name}</p>}
          <span className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleString()}</span>
        </div>
      </div>

      {/* Prompt */}
      <p className="mb-2 text-sm font-medium text-gray-600">
        Prompt: &ldquo;{item.prompt}&rdquo;
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
            <button onClick={handleSaveEdit} disabled={editSaving} className="flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              <Send className="h-3.5 w-3.5" />{editSaving ? "Saving..." : "Save Changes"}
            </button>
            <button onClick={() => { setEditMode(false); setEditText(item.output); }} className="rounded-md border border-gray-300 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm leading-relaxed text-gray-800">
          {item.output}
        </div>
      )}

      {/* Rejection feedback display */}
      {item.feedback && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <strong>Feedback:</strong> {item.feedback}
        </div>
      )}

      {/* Reject form */}
      {showRejectForm && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-semibold text-amber-800">
                What's wrong? This becomes a lesson for the AI.
              </p>
            </div>
            <button onClick={() => { setShowRejectForm(false); setFeedbackText(""); setSelectedTags([]); }}>
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
          {/* Quick-pick tags */}
          <div className="mb-3 flex flex-wrap gap-2">
            {QUICK_ISSUES.map((issue) => (
              <button
                key={issue.id}
                onClick={() => toggleTag(issue.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  selectedTags.includes(issue.id)
                    ? "border-amber-500 bg-amber-500 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-amber-300 hover:text-amber-700"
                }`}
              >
                {issue.label}
              </button>
            ))}
          </div>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Add specific detail… e.g. 'Opening paragraph is too long, cut to one sentence'"
            rows={2}
            autoFocus
            className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleReject}
              disabled={(selectedTags.length === 0 && !feedbackText.trim()) || actionLoading}
              className="rounded-md bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {actionLoading ? "Submitting..." : "Submit Feedback + Create Lesson"}
            </button>
            <button
              onClick={() => { setShowRejectForm(false); setFeedbackText(""); setSelectedTags([]); }}
              className="rounded-md border border-gray-300 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      {!editMode && (
        <div className="mt-3 flex flex-wrap gap-2">
          {isPending && (
            <>
              <button onClick={handleApprove} disabled={actionLoading} className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">
                <ThumbsUp className="h-3.5 w-3.5" /> Approve
              </button>
              <button onClick={() => setShowRejectForm(true)} className="flex items-center gap-1 rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100">
                <ThumbsDown className="h-3.5 w-3.5" /> Reject
              </button>
            </>
          )}
          {isRejected && (
            <button onClick={handleRevise} disabled={actionLoading} className="flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${actionLoading ? "animate-spin" : ""}`} />
              {actionLoading ? "Revising..." : "Revise with Feedback"}
            </button>
          )}
          {item.status === "APPROVED" && (
            <button onClick={handleMarkPublish} disabled={actionLoading} className="flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50">
              <Send className="h-3.5 w-3.5" /> Mark to Publish
            </button>
          )}
          <button onClick={() => { setEditMode(true); setEditText(item.output); }} className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button onClick={handleCopy} className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
            {copiedId ? <><Check className="h-3.5 w-3.5 text-green-500" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
          </button>
        </div>
      )}
    </div>
  );
}

export const HistoryItem = memo(HistoryItemInner);
