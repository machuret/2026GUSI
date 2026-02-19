"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, BookOpen, ToggleLeft, ToggleRight } from "lucide-react";
import { CATEGORIES } from "@/lib/content";

interface LessonItem {
  id: string;
  contentType: string | null;
  feedback: string;
  source: string | null;
  severity: string;
  active: boolean;
  createdAt: string;
}

const CONTENT_TYPES = CATEGORIES.map(({ key, label }) => ({ key, label }));

const SEVERITY_COLORS: Record<string, string> = {
  high:   "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low:    "bg-blue-100 text-blue-700 border-blue-200",
};

const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export default function LessonsPage() {
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ feedback: "", contentType: "", severity: "medium" });
  const [saving, setSaving] = useState(false);
  const [groupBy, setGroupBy] = useState<"category" | "severity">("category");

  const fetchLessons = useCallback(async () => {
    try {
      const res = await fetch("/api/lessons");
      if (!res.ok) throw new Error(`Failed to load lessons (${res.status})`);
      const data = await res.json();
      setLessons(data.lessons || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load lessons");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLessons(); }, [fetchLessons]);

  const handleCreate = useCallback(async () => {
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback: form.feedback,
          contentType: form.contentType || null,
          severity: form.severity,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ feedback: "", contentType: "", severity: "medium" });
        fetchLessons();
      } else {
        const d = await res.json().catch(() => ({}));
        setActionError(d.error || "Failed to save lesson");
      }
    } finally { setSaving(false); }
  }, [form, fetchLessons]);

  const toggleActive = useCallback((lesson: LessonItem) => {
    setLessons((prev) =>
      prev.map((l) => l.id === lesson.id ? { ...l, active: !l.active } : l)
    );
    fetch(`/api/lessons/${lesson.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !lesson.active }),
    }).catch(() => {
      setLessons((prev) =>
        prev.map((l) => l.id === lesson.id ? { ...l, active: lesson.active } : l)
      );
    });
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this lesson?")) return;
    setLessons((prev) => prev.filter((l) => l.id !== id));
    await fetch(`/api/lessons/${id}`, { method: "DELETE" }).catch(() => fetchLessons());
  }, [fetchLessons]);

  const activeCount = useMemo(
    () => lessons.filter((l) => l.active).length,
    [lessons]
  );

  const sorted = useMemo(
    () => [...lessons].sort((a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3)
    ),
    [lessons]
  );

  const groups = useMemo<{ label: string; items: LessonItem[] }[]>(
    () => groupBy === "category"
      ? [
          { label: "Global (all categories)", items: sorted.filter((l) => !l.contentType) },
          ...CONTENT_TYPES.map((t) => ({
            label: t.label,
            items: sorted.filter((l) => l.contentType === t.key),
          })),
        ].filter((g) => g.items.length > 0)
      : [
          { label: "High priority", items: sorted.filter((l) => l.severity === "high") },
          { label: "Medium priority", items: sorted.filter((l) => l.severity === "medium") },
          { label: "Low priority", items: sorted.filter((l) => l.severity === "low") },
        ].filter((g) => g.items.length > 0),
    [sorted, groupBy]
  );

  return (
    <div className="mx-auto max-w-4xl">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {actionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lessons</h1>
          <p className="mt-1 text-gray-500">
            <span className="font-medium text-brand-700">{activeCount} active</span> of {lessons.length} lessons — each one improves future content
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Add Lesson
        </button>
      </div>

      {/* Add lesson form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="mb-1 font-semibold text-gray-800">New Lesson</h3>
          <p className="mb-4 text-xs text-gray-500">Write a clear instruction the AI should follow — be specific about what to do or avoid.</p>
          <textarea
            placeholder="e.g. 'Always end cold emails with a specific, low-friction CTA like booking a 15-min call — never say contact us' or 'Use clinical verbs: identify, confirm, guide, integrate — avoid passive constructions'"
            value={form.feedback}
            onChange={(e) => setForm({ ...form, feedback: e.target.value })}
            rows={3}
            autoFocus
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Apply to</label>
              <select
                value={form.contentType}
                onChange={(e) => setForm({ ...form, contentType: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">All categories (global)</option>
                {CONTENT_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Priority</label>
              <select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="high">High — always apply</option>
                <option value="medium">Medium — apply when relevant</option>
                <option value="low">Low — soft preference</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !form.feedback.trim()}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Lesson"}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm({ feedback: "", contentType: "", severity: "medium" }); }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-400">Loading...</div>
      ) : lessons.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 font-medium text-gray-500">No lessons yet</p>
          <p className="mt-1 text-sm text-gray-400">Reject generated content with feedback to auto-create lessons, or add them manually above.</p>
        </div>
      ) : (
        <>
          {/* Group toggle */}
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs text-gray-500">Group by:</span>
            {(["category", "severity"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  groupBy === g ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.label}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {group.label} <span className="text-gray-300">({group.items.length})</span>
                </h3>
                <div className="space-y-2">
                  {group.items.map((l) => (
                    <div
                      key={l.id}
                      className={`rounded-xl border bg-white px-5 py-4 transition-opacity ${l.active ? "border-gray-200" : "border-gray-100 opacity-50"}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[l.severity] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                              {l.severity}
                            </span>
                            {l.contentType ? (
                              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                                {CONTENT_TYPES.find((t) => t.key === l.contentType)?.label ?? l.contentType}
                              </span>
                            ) : (
                              <span className="rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-500">global</span>
                            )}
                            {l.source && (
                              <span className="text-xs text-gray-400">· from {l.source}</span>
                            )}
                            {!l.active && (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">disabled</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-800 leading-relaxed">{l.feedback}</p>
                          <p className="mt-1 text-xs text-gray-400">{new Date(l.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            onClick={() => toggleActive(l)}
                            title={l.active ? "Disable lesson" : "Enable lesson"}
                            className="rounded-md border border-gray-200 p-1.5 hover:bg-gray-50"
                          >
                            {l.active
                              ? <ToggleRight className="h-4 w-4 text-green-600" />
                              : <ToggleLeft className="h-4 w-4 text-gray-400" />}
                          </button>
                          <button
                            onClick={() => handleDelete(l.id)}
                            className="rounded-md border border-red-100 p-1.5 text-red-400 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
