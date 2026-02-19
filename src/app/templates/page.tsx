"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Save, Trash2, ChevronDown, ChevronUp, LayoutTemplate, Check, X, Pencil } from "lucide-react";
import { CATEGORIES } from "@/lib/content";
import { fetchJSON } from "@/lib/fetchJSON";
import { ErrorBanner } from "@/components/ErrorBanner";

interface Template {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  contentType: string;
  active: boolean;
}

const CATEGORY_ICONS: Record<string, string> = {
  newsletter:     "📧",
  offer:          "🎯",
  webinar:        "🎙️",
  social_media:   "📱",
  announcement:   "📢",
  blog_post:      "✍️",
  course_content: "🎓",
  sales_page:     "💰",
  cold_email:     "📨",
};

const RULE_HINTS: Record<string, string> = {
  newsletter:     "e.g. Always open with a personal story. Subject line must be under 50 chars. End with one clear CTA.",
  offer:          "e.g. Lead with the transformation, not the product. Use scarcity language. Include a guarantee.",
  webinar:        "e.g. Open with a bold promise. Use 'you will learn' framing. End with urgency for registration.",
  social_media:   "e.g. First line must hook in 8 words. No hashtags in body. End with a question to drive comments.",
  announcement:   "e.g. Lead with the news, not the backstory. Keep under 150 words. Include date and next step.",
  blog_post:      "e.g. Use H2/H3 subheadings every 200 words. Include a TL;DR at top. End with a discussion question.",
  course_content: "e.g. Use second-person 'you'. Break into numbered steps. Each lesson ends with a practical exercise.",
  sales_page:     "e.g. Open with the problem. Use social proof early. Repeat the CTA 3 times. Address top 3 objections.",
  cold_email:     "e.g. Subject line under 6 words. First line references something specific about them. One CTA only.",
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // New template form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ name: string; description: string; systemPrompt: string; contentType: string }>({ name: "", description: "", systemPrompt: "", contentType: CATEGORIES[0].key });
  const [saving, setSaving] = useState(false);

  // Edit inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", systemPrompt: "" });
  const [editSaving, setEditSaving] = useState(false);

  // Expanded category
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const data = await fetchJSON<{ prompts: Template[] }>("/api/prompts");
      setTemplates(data.prompts || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.systemPrompt.trim()) return;
    setSaving(true); setActionError(null);
    try {
      await fetchJSON("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setShowForm(false);
      setForm({ name: "", description: "", systemPrompt: "", contentType: CATEGORIES[0].key });
      fetchTemplates();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save template");
    } finally { setSaving(false); }
  };

  const handleSaveEdit = async (id: string) => {
    setEditSaving(true); setActionError(null);
    try {
      await fetchJSON(`/api/prompts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      setEditingId(null);
      fetchTemplates();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update template");
    } finally { setEditSaving(false); }
  };

  const handleToggle = async (t: Template) => {
    try {
      await fetchJSON(`/api/prompts/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !t.active }),
      });
      fetchTemplates();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update template");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    try {
      await fetchJSON(`/api/prompts/${id}`, { method: "DELETE" });
      fetchTemplates();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete template");
    }
  };

  // Group templates by category
  const byCategory = CATEGORIES.map((cat) => ({
    ...cat,
    templates: templates.filter((t) => t.contentType === cat.key),
  }));

  const totalActive = templates.filter((t) => t.active).length;

  return (
    <div className="mx-auto max-w-4xl">
      {error && <ErrorBanner message={error} onRetry={fetchTemplates} onDismiss={() => setError(null)} className="mb-4" />}
      {actionError && <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} className="mb-4" />}

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <LayoutTemplate className="h-8 w-8 text-brand-600" /> Content Templates
          </h1>
          <p className="mt-1 text-gray-500">
            Per-category rules injected into every AI generation — the more specific, the better the output.
          </p>
          {templates.length > 0 && (
            <p className="mt-1 text-xs text-gray-400">
              {totalActive} active template{totalActive !== 1 ? "s" : ""} across {byCategory.filter((c) => c.templates.length > 0).length} categories
            </p>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> New Template
        </button>
      </div>

      {/* New template form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="mb-1 font-semibold text-gray-800">New Content Template</h3>
          <p className="mb-4 text-xs text-gray-500">
            Write specific rules for a content category. These are injected as "Custom Instructions" into every generation for that type.
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Category</label>
              <select
                value={form.contentType}
                onChange={(e) => setForm({ ...form, contentType: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{CATEGORY_ICONS[c.key]} {c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Template Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Clinical Newsletter Rules"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-gray-600">Description (optional)</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Short note about what this template does"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-gray-600">Rules / Instructions</label>
            <p className="mb-1.5 text-xs text-gray-400">{RULE_HINTS[form.contentType] ?? "Write specific rules the AI must follow for this content type."}</p>
            <textarea
              value={form.systemPrompt}
              onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
              rows={7}
              placeholder={"- Rule 1\n- Rule 2\n- Rule 3\n\nBe specific — vague rules produce vague output."}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !form.name.trim() || !form.systemPrompt.trim()}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Template"}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Category groups */}
      {loading ? (
        <div className="py-12 text-center text-gray-400">Loading…</div>
      ) : (
        <div className="space-y-3">
          {byCategory.map((cat) => {
            const isOpen = expandedCategory === cat.key || cat.templates.length > 0;
            const hasTemplates = cat.templates.length > 0;
            return (
              <div key={cat.key} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <button
                  onClick={() => setExpandedCategory(expandedCategory === cat.key ? null : cat.key)}
                  className="flex w-full items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{CATEGORY_ICONS[cat.key]}</span>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900 text-sm">{cat.label}</p>
                      <p className="text-xs text-gray-400">
                        {hasTemplates
                          ? `${cat.templates.length} template${cat.templates.length !== 1 ? "s" : ""} · ${cat.templates.filter((t) => t.active).length} active`
                          : "No templates — AI uses base rules only"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasTemplates && (
                      <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                        {cat.templates.filter((t) => t.active).length} active
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setForm({ ...form, contentType: cat.key }); setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      className="rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100"
                    >
                      + Add
                    </button>
                    {expandedCategory === cat.key ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </div>
                </button>

                {expandedCategory === cat.key && (
                  <div className="border-t border-gray-100">
                    {cat.templates.length === 0 ? (
                      <div className="px-5 py-4 text-sm text-gray-400">
                        No templates yet for {cat.label}. Click <strong>+ Add</strong> to create one.
                        <p className="mt-1 text-xs text-gray-300">{RULE_HINTS[cat.key]}</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {cat.templates.map((t) => (
                          <div key={t.id} className={`px-5 py-4 ${!t.active ? "opacity-50" : ""}`}>
                            {editingId === t.id ? (
                              <div className="space-y-2">
                                <input
                                  value={editForm.name}
                                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                                  placeholder="Template name"
                                />
                                <input
                                  value={editForm.description}
                                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                                  placeholder="Description (optional)"
                                />
                                <textarea
                                  value={editForm.systemPrompt}
                                  onChange={(e) => setEditForm({ ...editForm, systemPrompt: e.target.value })}
                                  rows={6}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                                />
                                <div className="flex gap-2">
                                  <button onClick={() => handleSaveEdit(t.id)} disabled={editSaving} className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                                    <Check className="h-3.5 w-3.5" /> {editSaving ? "Saving…" : "Save"}
                                  </button>
                                  <button onClick={() => setEditingId(null)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <div>
                                    <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                                    {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1.5">
                                    <button
                                      onClick={() => handleToggle(t)}
                                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium border ${t.active ? "border-green-300 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-500"}`}
                                    >
                                      {t.active ? "Active" : "Inactive"}
                                    </button>
                                    <button onClick={() => { setEditingId(t.id); setEditForm({ name: t.name, description: t.description || "", systemPrompt: t.systemPrompt }); }} className="rounded-md border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50">
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button onClick={() => handleDelete(t.id)} className="rounded-md border border-red-100 p-1.5 text-red-400 hover:bg-red-50">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2.5 text-xs leading-relaxed text-gray-700">
                                  {t.systemPrompt}
                                </pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
