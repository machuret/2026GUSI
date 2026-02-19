"use client";

import { useState } from "react";
import { Calendar, X, Check, Loader2 } from "lucide-react";

interface Props {
  contentId: string;
  scheduledAt?: string | null;
  onScheduled: (date: string | null) => void;
}

export function SchedulePicker({ contentId, scheduledAt, onScheduled }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(
    scheduledAt ? scheduledAt.slice(0, 16) : ""
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/content/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId,
          scheduledAt: value ? new Date(value).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onScheduled(value ? new Date(value).toISOString() : null);
        setOpen(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setSaving(true);
    try {
      await fetch("/api/content/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, scheduledAt: null }),
      });
      setValue("");
      onScheduled(null);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const displayDate = scheduledAt
    ? new Date(scheduledAt).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
          scheduledAt
            ? "border-blue-300 bg-blue-50 text-blue-700"
            : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
        }`}
      >
        <Calendar className="h-3.5 w-3.5" />
        {displayDate ?? "Schedule"}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold text-gray-700">Set publish date</p>
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={save}
              disabled={saving || !value}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand-600 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Save
            </button>
            {scheduledAt && (
              <button
                onClick={clear}
                disabled={saving}
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
