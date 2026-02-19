"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquare, Send, Trash2, Loader2 } from "lucide-react";
import { DEMO_COMPANY_ID } from "@/lib/constants";

interface Comment {
  id: string;
  text: string;
  authorName: string;
  createdAt: string;
}

interface Props {
  contentId: string;
  contentTable: string;
}

export function ContentComments({ contentId, contentTable }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/content/comments?contentId=${contentId}`);
      const data = await res.json();
      setComments(data.comments ?? []);
    } finally {
      setLoading(false);
    }
  }, [contentId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const submit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/content/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId,
          contentTable,
          companyId: DEMO_COMPANY_ID,
          text: text.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setComments((prev) => [...prev, data.comment]);
        setText("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    await fetch(`/api/content/comments?id=${id}`, { method: "DELETE" });
    setComments((prev) => prev.filter((c) => c.id !== id));
  };

  const count = comments.length;

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-600 transition-colors"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {open ? "Hide" : "Comments"}{count > 0 ? ` (${count})` : ""}
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
            </div>
          )}

          {!loading && comments.length === 0 && (
            <p className="text-xs text-gray-400">No comments yet.</p>
          )}

          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2 group">
              <div className="flex-1 rounded-md bg-white border border-gray-200 px-3 py-2">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium text-gray-700">{c.authorName}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(c.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-xs text-gray-600 whitespace-pre-wrap">{c.text}</p>
              </div>
              <button
                onClick={() => remove(c.id)}
                className="mt-1 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {/* Input */}
          <div className="flex items-end gap-2 pt-1">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              placeholder="Add a note… (Enter to send)"
              rows={2}
              className="flex-1 resize-none rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
            <button
              onClick={submit}
              disabled={submitting || !text.trim()}
              className="flex items-center gap-1 rounded-md bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
