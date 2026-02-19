"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, Star } from "lucide-react";

interface CompanyInfoData {
  values: string;
  corePhilosophy: string;
  founders: string;
  history: string;
  achievements: string;
  bulkContent: string;
}

const empty: CompanyInfoData = {
  values: "", corePhilosophy: "", founders: "",
  history: "", achievements: "", bulkContent: "",
};

function Field({
  label, hint, value, rows, placeholder, onChange, highlight,
}: {
  label: string; hint?: string; value: string; rows?: number;
  placeholder?: string; onChange: (v: string) => void; highlight?: boolean;
}) {
  const wordCount = useMemo(
    () => value.trim() ? value.trim().split(/\s+/).length : 0,
    [value]
  );
  return (
    <div className={highlight ? "rounded-xl border-2 border-brand-200 bg-brand-50 p-4" : ""}>
      <div className="mb-1 flex items-center justify-between">
        <label className={`text-sm font-semibold ${highlight ? "text-brand-800" : "text-gray-700"}`}>
          {highlight && <Star className="inline h-3.5 w-3.5 mr-1 text-brand-600" />}
          {label}
        </label>
        {value && <span className="text-xs text-gray-400">{wordCount} words</span>}
      </div>
      {hint && <p className="mb-2 text-xs text-gray-500">{hint}</p>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows ?? 4}
        placeholder={placeholder}
        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
          highlight
            ? "border-brand-300 bg-white focus:border-brand-500 focus:ring-brand-500"
            : "border-gray-300 focus:border-brand-500 focus:ring-brand-500"
        }`}
      />
    </div>
  );
}

export default function CompanyPage() {
  const [form, setForm] = useState<CompanyInfoData>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/company");
        const data = await res.json();
        if (data.info) {
          setForm({
            values: data.info.values || "",
            corePhilosophy: data.info.corePhilosophy || "",
            founders: data.info.founders || "",
            history: data.info.history || "",
            achievements: data.info.achievements || "",
            bulkContent: data.info.bulkContent || "",
          });
        }
      } catch { console.error("Failed to load company info"); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const res = await fetch("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSaved(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error || `Save failed (${res.status})`);
      }
    } catch {
      setSaveError("Network error — could not reach server");
    } finally { setSaving(false); }
  };

  const set = (key: keyof CompanyInfoData) => (v: string) => setForm({ ...form, [key]: v });

  if (loading) return <div className="py-12 text-center text-gray-400">Loading...</div>;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Company Info</h1>
        <p className="mt-1 text-gray-500">
          Everything here is fed directly to the AI when generating content. The Writing DNA is the most important field.
        </p>
      </div>

      <div className="space-y-5">
        {/* Writing DNA — most important, highlighted */}
        <Field
          label="Writing DNA"
          hint="Your brand voice, writing principles, tone, vocabulary, guardrails, and style rules. This is the primary instruction the AI follows for every piece of content."
          value={form.bulkContent}
          rows={12}
          placeholder="Paste your full brand voice guide, writing DNA, style manifesto, or any detailed instructions about how your company writes..."
          onChange={set("bulkContent")}
          highlight
        />

        {/* Supporting fields */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Supporting Context</p>

          <Field
            label="Core Values"
            hint="Used to ensure content reflects your brand's principles"
            value={form.values}
            rows={3}
            placeholder="e.g. Mission-driven, hands-on, operational. Builders, not activists or academics."
            onChange={set("values")}
          />
          <Field
            label="Core Philosophy"
            hint="What your company believes and how it positions itself"
            value={form.corePhilosophy}
            rows={4}
            placeholder="What does your company believe in? How do you position yourselves in the market?"
            onChange={set("corePhilosophy")}
          />
          <Field
            label="Founders & Team"
            hint="Adds credibility context to generated content"
            value={form.founders}
            rows={3}
            placeholder="Who founded the company? Key team members and their backgrounds"
            onChange={set("founders")}
          />
          <Field
            label="Achievements & Milestones"
            hint="Proof points the AI can reference for credibility"
            value={form.achievements}
            rows={3}
            placeholder="Awards, milestones, notable metrics, press coverage, global reach"
            onChange={set("achievements")}
          />
          <Field
            label="Company History"
            hint="Timeline context for narrative-style content"
            value={form.history}
            rows={3}
            placeholder="Key milestones, pivots, and growth moments"
            onChange={set("history")}
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Company Info"}
            </button>
            {saved && <span className="text-sm font-medium text-green-600">✓ Saved</span>}
          </div>
          {saveError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {saveError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
