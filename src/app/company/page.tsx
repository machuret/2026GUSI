"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, Star, Globe, Loader2, Sparkles, Link, Youtube, Facebook, Hash, Package, Building2 } from "lucide-react";
import { fetchJSON } from "@/lib/fetchJSON";
import { authFetch } from "@/lib/authFetch";
import { ErrorBanner } from "@/components/ErrorBanner";

interface CompanyFormData {
  companyName: string;
  website: string;
  linkedinUrl: string;
  youtubeUrl: string;
  facebookUrl: string;
  hashtags: string;
  products: string;
  values: string;
  corePhilosophy: string;
  founders: string;
  history: string;
  achievements: string;
  bulkContent: string;
}

const empty: CompanyFormData = {
  companyName: "", website: "", linkedinUrl: "", youtubeUrl: "",
  facebookUrl: "", hashtags: "", products: "",
  values: "", corePhilosophy: "", founders: "",
  history: "", achievements: "", bulkContent: "",
};

function TextField({ label, icon, value, placeholder, onChange }: {
  label: string; icon?: React.ReactNode; value: string;
  placeholder?: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
        {icon}{label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}

function TextArea({ label, hint, value, rows, placeholder, onChange, highlight }: {
  label: string; hint?: string; value: string; rows?: number;
  placeholder?: string; onChange: (v: string) => void; highlight?: boolean;
}) {
  const wordCount = useMemo(() => value.trim() ? value.trim().split(/\s+/).length : 0, [value]);
  return (
    <div className={highlight ? "rounded-xl border-2 border-brand-200 bg-brand-50 p-4" : ""}>
      <div className="mb-1 flex items-center justify-between">
        <label className={`text-sm font-semibold ${highlight ? "text-brand-800" : "text-gray-700"}`}>
          {highlight && <Star className="inline h-3.5 w-3.5 mr-1 text-brand-600" />}{label}
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
  const [form, setForm] = useState<CompanyFormData>(empty);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchJSON<{ company: Record<string, string> | null; info: Record<string, string> | null }>("/api/company");
        setForm({
          companyName:   data.company?.name        || "",
          website:       data.company?.website     || data.info?.website     || "",
          linkedinUrl:   data.info?.linkedinUrl    || "",
          youtubeUrl:    data.info?.youtubeUrl     || "",
          facebookUrl:   data.info?.facebookUrl    || "",
          hashtags:      data.info?.hashtags       || "",
          products:      data.info?.products       || "",
          values:        data.info?.values         || "",
          corePhilosophy: data.info?.corePhilosophy || "",
          founders:      data.info?.founders       || "",
          history:       data.info?.history        || "",
          achievements:  data.info?.achievements   || "",
          bulkContent:   data.info?.bulkContent    || "",
        });
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load company info");
      } finally { setLoading(false); }
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true); setSaved(false); setSaveError(null);
    try {
      await fetchJSON("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  };

  const handleResearch = async () => {
    const url = form.website.trim() || "https://globalultrasoundinstitute.com/";
    setResearching(true); setResearchError(null);
    try {
      const res = await authFetch("/api/vault/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) { setResearchError(data.error || "Research failed"); return; }

      // Ask AI to extract structured company info from the crawled content
      const aiRes = await fetch("/api/company/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, content: data.content }),
      });
      const aiData = await aiRes.json();
      if (!aiRes.ok) { setResearchError(aiData.error || "AI extraction failed"); return; }

      // Merge AI-extracted fields into form (only fill empty fields)
      setForm((prev) => ({
        companyName:    prev.companyName    || aiData.companyName    || prev.companyName,
        website:        prev.website        || url,
        linkedinUrl:    prev.linkedinUrl    || aiData.linkedinUrl    || "",
        youtubeUrl:     prev.youtubeUrl     || aiData.youtubeUrl     || "",
        facebookUrl:    prev.facebookUrl    || aiData.facebookUrl    || "",
        hashtags:       prev.hashtags       || aiData.hashtags       || "",
        products:       aiData.products     || prev.products,
        values:         aiData.values       || prev.values,
        corePhilosophy: aiData.corePhilosophy || prev.corePhilosophy,
        founders:       aiData.founders     || prev.founders,
        history:        aiData.history      || prev.history,
        achievements:   aiData.achievements || prev.achievements,
        bulkContent:    aiData.bulkContent  || prev.bulkContent,
      }));
    } catch (err) {
      setResearchError(err instanceof Error ? err.message : "Research failed");
    } finally { setResearching(false); }
  };

  const set = (key: keyof CompanyFormData) => (v: string) => setForm((p) => ({ ...p, [key]: v }));

  if (loading) return <div className="py-12 text-center text-gray-400">Loading...</div>;
  if (loadError) return <ErrorBanner message={loadError} className="m-6" />;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Company Info</h1>
          <p className="mt-1 text-gray-500">
            Everything here feeds the AI when generating content. Writing DNA is the most important field.
          </p>
        </div>
        <button
          onClick={handleResearch}
          disabled={researching}
          className="flex items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50"
        >
          {researching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {researching ? "Researching…" : "Research from Website"}
        </button>
      </div>

      {researchError && <ErrorBanner message={researchError} onDismiss={() => setResearchError(null)} className="mb-4" />}

      <div className="space-y-5">

        {/* Identity */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Identity</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Company Name" icon={<Building2 className="h-3.5 w-3.5 text-gray-400" />}
              value={form.companyName} placeholder="Global Ultrasound Institute" onChange={set("companyName")} />
            <TextField label="Website URL" icon={<Globe className="h-3.5 w-3.5 text-gray-400" />}
              value={form.website} placeholder="https://globalultrasoundinstitute.com" onChange={set("website")} />
            <TextField label="LinkedIn URL" icon={<Link className="h-3.5 w-3.5 text-gray-400" />}
              value={form.linkedinUrl} placeholder="https://linkedin.com/company/…" onChange={set("linkedinUrl")} />
            <TextField label="YouTube URL" icon={<Youtube className="h-3.5 w-3.5 text-gray-400" />}
              value={form.youtubeUrl} placeholder="https://youtube.com/@…" onChange={set("youtubeUrl")} />
            <TextField label="Facebook URL" icon={<Facebook className="h-3.5 w-3.5 text-gray-400" />}
              value={form.facebookUrl} placeholder="https://facebook.com/…" onChange={set("facebookUrl")} />
          </div>
          <TextArea label="Hashtags" hint="Used in social media content generation"
            value={form.hashtags} rows={2}
            placeholder="#GUSI #PointOfCareUltrasound #POCUS #MedicalEducation #Ultrasound"
            onChange={set("hashtags")} />
          <TextArea label="Products & Services" hint="Courses, programs, certifications — the AI references these when writing"
            value={form.products} rows={4}
            placeholder="List your main products, courses, programs, or services…"
            onChange={set("products")} />
        </div>

        {/* Writing DNA */}
        <TextArea
          label="Writing DNA"
          hint="Your brand voice, writing principles, tone, vocabulary, guardrails, and style rules. This is the primary instruction the AI follows for every piece of content."
          value={form.bulkContent} rows={12}
          placeholder="Paste your full brand voice guide, writing DNA, style manifesto, or any detailed instructions about how your company writes..."
          onChange={set("bulkContent")} highlight
        />

        {/* Supporting context */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Supporting Context</p>
          <TextArea label="Core Values" hint="Used to ensure content reflects your brand's principles"
            value={form.values} rows={3}
            placeholder="e.g. Mission-driven, hands-on, operational. Builders, not activists or academics."
            onChange={set("values")} />
          <TextArea label="Core Philosophy" hint="What your company believes and how it positions itself"
            value={form.corePhilosophy} rows={4}
            placeholder="What does your company believe in? How do you position yourselves in the market?"
            onChange={set("corePhilosophy")} />
          <TextArea label="Founders & Team" hint="Adds credibility context to generated content"
            value={form.founders} rows={3}
            placeholder="Who founded the company? Key team members and their backgrounds"
            onChange={set("founders")} />
          <TextArea label="Achievements & Milestones" hint="Proof points the AI can reference for credibility"
            value={form.achievements} rows={3}
            placeholder="Awards, milestones, notable metrics, press coverage, global reach"
            onChange={set("achievements")} />
          <TextArea label="Company History" hint="Timeline context for narrative-style content"
            value={form.history} rows={3}
            placeholder="Key milestones, pivots, and growth moments"
            onChange={set("history")} />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Company Info"}
            </button>
            {saved && <span className="text-sm font-medium text-green-600">✓ Saved</span>}
          </div>
          {saveError && <ErrorBanner message={saveError} onDismiss={() => setSaveError(null)} />}
        </div>
      </div>
    </div>
  );
}
