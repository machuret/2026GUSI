"use client";

import { useMemo, useState } from "react";
import {
  Copy, Check, ThumbsUp, ThumbsDown,
  RefreshCw, ArrowRight, RotateCcw,
} from "lucide-react";
import { CATEGORIES } from "./CategoryPicker";
import { FeedbackForm } from "./FeedbackForm";

export type ReviewStatus = "idle" | "approved" | "rejected";

export interface GeneratedResult {
  id: string;
  output: string;
  category: string;
}

interface Props {
  result: GeneratedResult;
  reviewStatus: ReviewStatus;
  regenerating: boolean;
  onApprove: () => Promise<void>;
  onReject: (feedback: string) => Promise<void>;
  onRevise: () => Promise<void>;
  onRegenerate: (feedback: string, tags: string[]) => Promise<void>;
  onCreateAnother: () => void;
}

export const QUICK_ISSUES = [
  { id: "tone",       label: "Wrong tone",           detail: "Tone does not match the brand voice" },
  { id: "length",     label: "Wrong length",          detail: "Content is too long or too short for this format" },
  { id: "cta",        label: "Missing CTA",           detail: "No clear call-to-action at the end" },
  { id: "clinical",   label: "Not clinical enough",   detail: "Lacks clinical language, workflow nouns, and procedural framing" },
  { id: "generic",    label: "Too generic",           detail: "Could have been written by anyone — not specific to GUSI" },
  { id: "hype",       label: "Too salesy / hyped",    detail: "Uses hype language, exaggerated claims, or marketing clichés" },
  { id: "structure",  label: "Poor structure",        detail: "Paragraphs or sections are not well organised" },
  { id: "opening",    label: "Weak opening",          detail: "First sentence or paragraph does not hook the reader" },
  { id: "closing",    label: "Weak closing",          detail: "Ending is flat, abrupt, or lacks a strong final line" },
  { id: "facts",      label: "Wrong facts / claims",  detail: "Contains inaccurate, outdated, or unverifiable claims" },
  { id: "audience",   label: "Wrong audience",        detail: "Written for the wrong reader — too technical, too basic, or wrong persona" },
  { id: "repetitive", label: "Repetitive",            detail: "Same ideas, words, or phrases repeated unnecessarily" },
];

export function OutputReview({
  result, reviewStatus, regenerating,
  onApprove, onReject, onRevise, onRegenerate, onCreateAnother,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showRegenerateForm, setShowRegenerateForm] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviseLoading, setReviseLoading] = useState(false);

  const wordCount = useMemo(
    () => result.output.trim().split(/\s+/).length,
    [result.output]
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(result.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApprove = async () => {
    setReviewLoading(true);
    try { await onApprove(); } finally { setReviewLoading(false); }
  };

  const handleRevise = async () => {
    setReviseLoading(true);
    try { await onRevise(); } finally { setReviseLoading(false); }
  };

  const handleReject = async (feedback: string) => {
    setReviewLoading(true);
    try {
      await onReject(feedback);
      setShowRejectForm(false);
    } finally { setReviewLoading(false); }
  };

  const handleRegenerate = async (feedback: string, tags: string[]) => {
    setShowRegenerateForm(false);
    await onRegenerate(feedback, tags);
  };

  // Suppress unused import warning — CATEGORIES is used by consumers of this file
  void CATEGORIES;

  return (
    <div className="mt-6 rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">3</span>
          <h3 className="text-sm font-semibold text-gray-700">Review &amp; approve</h3>
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">{wordCount} words</span>
          {reviewStatus === "approved" && (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">✓ Approved</span>
          )}
          {reviewStatus === "rejected" && (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">✗ Rejected</span>
          )}
        </div>
        <button onClick={handleCopy}
          className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
          {copied
            ? <><Check className="h-3.5 w-3.5 text-green-500" /> Copied</>
            : <><Copy className="h-3.5 w-3.5" /> Copy</>}
        </button>
      </div>

      {/* Output */}
      <div className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-800">
        {result.output}
      </div>

      {/* Regen feedback form */}
      {showRegenerateForm && (
        <FeedbackForm
          variant="regen"
          loading={regenerating}
          onSubmit={handleRegenerate}
          onCancel={() => setShowRegenerateForm(false)}
        />
      )}

      {/* Reject feedback form */}
      {showRejectForm && (
        <FeedbackForm
          variant="reject"
          loading={reviewLoading}
          onSubmit={handleReject}
          onCancel={() => setShowRejectForm(false)}
        />
      )}

      {/* Action buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        {reviewStatus === "idle" && !showRegenerateForm && (
          <>
            <button onClick={handleApprove} disabled={reviewLoading}
              className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              <ThumbsUp className="h-4 w-4" /> Approve
            </button>
            <button onClick={() => { setShowRegenerateForm(true); setShowRejectForm(false); }} disabled={regenerating}
              className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50">
              <RotateCcw className="h-4 w-4" /> Regenerate
            </button>
            <button onClick={() => { setShowRejectForm(true); setShowRegenerateForm(false); }}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100">
              <ThumbsDown className="h-4 w-4" /> Reject
            </button>
          </>
        )}
        {reviewStatus === "rejected" && (
          <button onClick={handleRevise} disabled={reviseLoading}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${reviseLoading ? "animate-spin" : ""}`} />
            {reviseLoading ? "Revising with AI..." : "Auto-Revise with Feedback"}
          </button>
        )}
        {reviewStatus === "approved" && (
          <button onClick={onCreateAnother}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <ArrowRight className="h-4 w-4" /> Create Another
          </button>
        )}
      </div>
    </div>
  );
}
