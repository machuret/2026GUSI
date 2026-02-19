"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Save, FileText, ChevronDown, ChevronUp, Eye, EyeOff, Pencil, X, Check } from "lucide-react";
import { CATEGORIES as BASE_CATEGORIES } from "@/lib/content";

interface Prompt {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  contentType: string;
  active: boolean;
}

const CATEGORIES = [
  ...BASE_CATEGORIES.map(({ key, label }) => ({ key, label })),
  { key: "general", label: "General" },
];

const LIVE_SYSTEM_PROMPT = `You are the content writer for {company.name} ({company.industry}). You are writing a {categoryLabel}.

═══ COMPANY WRITING DNA — FOLLOW THIS PRECISELY ═══
{companyInfo.bulkContent}
═══ END OF WRITING DNA ═══

COMPANY IDENTITY:
- Values: {companyInfo.values}
- Philosophy: {companyInfo.corePhilosophy}
- Founders/Team: {companyInfo.founders}
- History: {companyInfo.history}
- Achievements: {companyInfo.achievements}

ANALYSED STYLE PROFILE (from ingested content):
- Tone: {styleProfile.tone}
- Avg word count: {styleProfile.avgWordCount}
- Signature vocabulary: {styleProfile.vocabulary}
- Common phrases: {styleProfile.commonPhrases}
- Preferred formats: {styleProfile.preferredFormats}
- Summary: {styleProfile.summary}

EXAMPLE POSTS FROM THIS COMPANY (match this style exactly):
--- Example 1 ({platform}, {contentType}) ---
{recentPost.body}

RULES FOR {CATEGORY}:
- Style: {rules.style}
- Must include: {rules.mustDo}
- Must avoid: {rules.mustNot}
- Target word count: {rules.wordCount}
- Brand rules: {rules.brandRules}

CUSTOM INSTRUCTIONS FOR {CATEGORY}:
{promptTemplate.systemPrompt}

LESSONS FROM PAST REJECTIONS — APPLY ALL OF THESE STRICTLY:
1. [HIGH] (newsletter) Tone does not match the brand voice
2. [HIGH] (blog_post) No clear call-to-action at the end
... (up to 30 most recent lessons)

OUTPUT RULES:
1. Follow the Writing DNA above as your primary instruction.
2. Content type: {categoryLabel}. Write content appropriate for this format.
3. Output ONLY the finished content — no meta-commentary, no explanations.
4. Target length: ~{styleProfile.avgWordCount} words unless the format demands otherwise.
5. Apply every lesson from past rejections — these are mandatory corrections.
6. Never use: game-changer, unlock, next-level, crushing it, skyrocketing, disrupt, or any hype adjectives.`;

const PROMPT_SECTIONS = [
  { id: "dna",      label: "Writing DNA",          color: "bg-purple-50 border-purple-200 text-purple-800",  desc: "Primary voice instruction — your ingested content bulk-pasted into Company Info" },
  { id: "identity", label: "Company Identity",      color: "bg-blue-50 border-blue-200 text-blue-800",        desc: "Values, philosophy, founders, history, achievements from Company Settings" },
  { id: "style",    label: "Style Profile",         color: "bg-green-50 border-green-200 text-green-800",     desc: "Auto-extracted from ingested posts: tone, vocabulary, avg word count, phrases" },
  { id: "examples", label: "Example Posts",         color: "bg-yellow-50 border-yellow-200 text-yellow-800",  desc: "Last 5 ingested posts shown as style examples — the more you ingest, the better" },
  { id: "rules",    label: "Category Rules",        color: "bg-orange-50 border-orange-200 text-orange-800",  desc: "Per-category style rules extracted from ingested posts for that type" },
  { id: "custom",   label: "Custom Prompt Override",color: "bg-brand-50 border-brand-200 text-brand-800",     desc: "Your custom prompt templates from this page — layered on top of everything else" },
  { id: "lessons",  label: "Lessons (Feedback)",    color: "bg-red-50 border-red-200 text-red-800",           desc: "Every rejection/regeneration feedback stored as a lesson — applied to every generation" },
  { id: "output",   label: "Output Rules",          color: "bg-gray-50 border-gray-200 text-gray-700",        desc: "Hard rules: no hype words, output only content, target word count" },
];

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showLivePrompt, setShowLivePrompt] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", systemPrompt: "", contentType: "general" });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", systemPrompt: "" });
  const [editSaving, setEditSaving] = useState(false);

  const fetchPrompts = async () => {
    try {
      const res = await fetch("/api/prompts");
      const data = await res.json();
      setPrompts(data.prompts || []);
    } catch { console.error("Failed to fetch prompts"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPrompts(); }, []);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ name: "", description: "", systemPrompt: "", contentType: "general" });
        fetchPrompts();
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this prompt template?")) return;
    await fetch(`/api/prompts/${id}`, { method: "DELETE" });
    fetchPrompts();
  };

  const toggleActive = async (p: Prompt) => {
    await fetch(`/api/prompts/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    });
    fetchPrompts();
  };

  const startEdit = (p: Prompt) => {
    setEditingId(p.id);
    setEditForm({ name: p.name, description: p.description || "", systemPrompt: p.systemPrompt });
  };

  const handleSaveEdit = async (id: string) => {
    setEditSaving(true);
    try {
      await fetch(`/api/prompts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      setEditingId(null);
      fetchPrompts();
    } finally { setEditSaving(false); }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prompt Management</h1>
          <p className="mt-1 text-gray-500">
            View the live system prompt, add custom overrides per content type
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> New Override
        </button>
      </div>

      {/* Live System Prompt Viewer */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white overflow-hidden">
        <button
          onClick={() => setShowLivePrompt(v => !v)}
          className="flex w-full items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-900">Live System Prompt</p>
              <p className="text-xs text-gray-500">The exact prompt structure sent to GPT-4o on every generation</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Active</span>
            {showLivePrompt ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </button>

        {showLivePrompt && (
          <div className="border-t border-gray-100 px-5 pb-5">
            {/* Section breakdown */}
            <div className="mt-4 mb-4">
              <p className="mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Prompt sections — what feeds each part</p>
              <div className="grid grid-cols-2 gap-2">
                {PROMPT_SECTIONS.map(s => (
                  <div key={s.id} className={`rounded-lg border px-3 py-2 ${s.color}`}>
                    <p className="text-xs font-semibold">{s.label}</p>
                    <p className="text-xs opacity-75 mt-0.5">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Raw prompt */}
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Raw prompt template (variables shown in {"{}"} )</p>
              <pre className="whitespace-pre-wrap rounded-lg bg-gray-900 p-4 text-xs leading-relaxed text-green-300 overflow-x-auto max-h-96 overflow-y-auto">
                {LIVE_SYSTEM_PROMPT}
              </pre>
            </div>

            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
              <strong>How to improve generation quality:</strong> The most impactful levers are (1) ingest more example posts, (2) fill in Company Info fully, (3) reject with specific feedback to build lessons, (4) add custom prompt overrides below for specific content types.
            </div>
          </div>
        )}
      </div>

      {/* New override form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="mb-4 font-semibold text-gray-800">New Custom Prompt Override</h3>
          <p className="mb-4 text-xs text-gray-500">This will be injected into the &ldquo;Custom Instructions&rdquo; section of the live prompt for the selected content type. Use it to add specific rules, tone guidance, or structural requirements.</p>
          <div className="grid grid-cols-2 gap-4">
            <input
              placeholder="Template name (e.g. Newsletter — Clinical Tone)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <select
              value={form.contentType}
              onChange={(e) => setForm({ ...form, contentType: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>
          <input
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <textarea
            placeholder={"Examples:\n- Always open with a clinical statistic or patient outcome\n- Keep paragraphs to 2 sentences max\n- End every newsletter with a single CTA button label\n- Never use first-person plural (we/our) — use second-person (you/your)"}
            value={form.systemPrompt}
            onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
            rows={7}
            className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !form.name || !form.systemPrompt}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
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
            <div key={p.id} className={`rounded-xl border bg-white overflow-hidden ${p.active ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
              <div className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900">{p.name}</h3>
                  <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                    {CATEGORIES.find(c => c.key === p.contentType)?.label ?? p.contentType}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${p.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {p.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => toggleActive(p)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium ${p.active ? "border-green-300 text-green-700 hover:bg-green-50" : "border-gray-300 text-gray-500 hover:bg-gray-50"}`}
                  >
                    {p.active ? <><EyeOff className="inline h-3 w-3 mr-1" />Disable</> : <><Eye className="inline h-3 w-3 mr-1" />Enable</>}
                  </button>
                  <button onClick={() => startEdit(p)} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {editingId === p.id ? (
                <div className="border-t border-gray-100 px-5 pb-4 pt-3">
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                    placeholder="Template name"
                  />
                  <input
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                    placeholder="Description (optional)"
                  />
                  <textarea
                    value={editForm.systemPrompt}
                    onChange={(e) => setEditForm({ ...editForm, systemPrompt: e.target.value })}
                    rows={6}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  />
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => handleSaveEdit(p.id)} disabled={editSaving} className="flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                      <Check className="h-3.5 w-3.5" />{editSaving ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => setEditingId(null)} className="rounded-md border border-gray-300 px-4 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-t border-gray-100 px-5 pb-4 pt-3">
                  {p.description && <p className="mb-2 text-xs text-gray-500">{p.description}</p>}
                  <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-700">
                    {p.systemPrompt}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
