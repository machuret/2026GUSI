"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Save, FileText } from "lucide-react";
import { CATEGORIES as BASE_CATEGORIES } from "@/lib/content";
import { fetchJSON } from "@/lib/fetchJSON";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LivePromptViewer } from "./components/LivePromptViewer";
import { PromptCard, type Prompt } from "./components/PromptCard";

const CATEGORIES = [
  ...BASE_CATEGORIES.map(({ key, label }) => ({ key, label })),
  { key: "general", label: "General" },
];

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", systemPrompt: "", contentType: "general" });
  const [saving, setSaving] = useState(false);

  const fetchPrompts = useCallback(async () => {
    try {
      const data = await fetchJSON<{ prompts: Prompt[] }>("/api/prompts");
      setPrompts(data.prompts || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load prompts");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPrompts(); }, [fetchPrompts]);

  const handleCreate = async () => {
    setSaving(true); setActionError(null);
    try {
      await fetchJSON("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setShowForm(false);
      setForm({ name: "", description: "", systemPrompt: "", contentType: "general" });
      fetchPrompts();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save prompt");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this prompt template?")) return;
    try {
      await fetchJSON(`/api/prompts/${id}`, { method: "DELETE" });
      fetchPrompts();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete prompt");
    }
  };

  const handleToggleActive = async (p: Prompt) => {
    try {
      await fetchJSON(`/api/prompts/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !p.active }),
      });
      fetchPrompts();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update prompt");
    }
  };

  const handleSaveEdit = async (id: string, editForm: { name: string; description: string; systemPrompt: string }) => {
    await fetchJSON(`/api/prompts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    fetchPrompts();
  };

  return (
    <div className="mx-auto max-w-4xl">
      {error && <ErrorBanner message={error} onRetry={fetchPrompts} onDismiss={() => setError(null)} className="mb-4" />}
      {actionError && <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} className="mb-4" />}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prompt Management</h1>
          <p className="mt-1 text-gray-500">View the live system prompt, add custom overrides per content type</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> New Override
        </button>
      </div>

      <LivePromptViewer />

      {/* New override form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="mb-4 font-semibold text-gray-800">New Custom Prompt Override</h3>
          <p className="mb-4 text-xs text-gray-500">This will be injected into the &ldquo;Custom Instructions&rdquo; section of the live prompt for the selected content type.</p>
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Template name (e.g. Newsletter — Clinical Tone)"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            <select value={form.contentType} onChange={(e) => setForm({ ...form, contentType: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
              {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <input placeholder="Description (optional)" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
          <textarea
            placeholder={"Examples:\n- Always open with a clinical statistic or patient outcome\n- Keep paragraphs to 2 sentences max\n- End every newsletter with a single CTA button label"}
            value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
            rows={7} className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
          <div className="mt-4 flex gap-2">
            <button onClick={handleCreate} disabled={saving || !form.name || !form.systemPrompt}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Override"}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {/* Prompt list */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">Custom Overrides ({prompts.length})</h2>
        {prompts.length === 0 && !loading && (
          <p className="text-xs text-gray-400">None yet — the base prompt runs without overrides</p>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-400">Loading...</div>
      ) : prompts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-gray-500">No custom overrides yet.</p>
          <p className="text-sm text-gray-400 mt-1">The base prompt runs as-is. Add overrides to fine-tune specific content types.</p>
          <button onClick={() => setShowForm(true)} className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Add First Override
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {prompts.map((p) => (
            <PromptCard
              key={p.id}
              prompt={p}
              categoryLabel={CATEGORIES.find((c) => c.key === p.contentType)?.label ?? p.contentType}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
              onSaveEdit={handleSaveEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
