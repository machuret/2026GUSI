"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Save, Loader2, CheckCircle, Target, Building2, MapPin, DollarSign, Tag, Star, ArrowLeft, Trophy, PenLine, Rss, KanbanSquare } from "lucide-react";
import { authFetch } from "@/lib/authFetch";

const ORG_TYPES = ["Non-profit / Charity", "Social Enterprise", "SME (Small-Medium Business)", "Startup", "University / Research Institute", "Government / Council", "Indigenous Organisation", "Other"];
const SECTORS = ["Health & Medical", "Education & Training", "Technology & Innovation", "Environment & Sustainability", "Arts & Culture", "Community Services", "Agriculture & Food", "Export & Trade", "Manufacturing", "Other"];
const STAGES = ["Pre-revenue / Concept", "Early Stage (0-2 years)", "Growth Stage (2-5 years)", "Established (5+ years)"];
const TEAM_SIZES = ["Solo / 1 person", "2-5", "6-20", "21-50", "50+"];
const REVENUES = ["Pre-revenue", "Under $250k", "$250k–$500k", "$500k–$1M", "$1M–$5M", "$5M+"];
const DURATIONS = ["Under 6 months", "6–12 months", "1–2 years", "2+ years", "Any"];
const FOCUS_AREA_OPTIONS = ["R&D / Innovation", "Export & International", "Training & Workforce", "Capital Equipment", "Marketing & Promotion", "Environmental / Sustainability", "Community Impact", "Digital Transformation", "Product Development", "Research & Collaboration"];

interface GrantProfile {
  orgType?: string;
  sector?: string;
  subSector?: string;
  location?: string;
  country?: string;
  stage?: string;
  teamSize?: string;
  annualRevenue?: string;
  yearFounded?: string;
  focusAreas?: string[];
  targetFundingMin?: number | null;
  targetFundingMax?: number | null;
  preferredDuration?: string;
  isRegisteredCharity?: boolean;
  hasABN?: boolean;
  hasACN?: boolean;
  indigenousOwned?: boolean;
  womanOwned?: boolean;
  regionalOrRural?: boolean;
  missionStatement?: string;
  keyActivities?: string;
  pastGrantsWon?: string;
  uniqueStrengths?: string;
}

const EMPTY: GrantProfile = {
  orgType: "", sector: "", subSector: "", location: "", country: "Australia",
  stage: "", teamSize: "", annualRevenue: "", yearFounded: "",
  focusAreas: [], targetFundingMin: null, targetFundingMax: null, preferredDuration: "",
  isRegisteredCharity: false, hasABN: true, hasACN: false,
  indigenousOwned: false, womanOwned: false, regionalOrRural: false,
  missionStatement: "", keyActivities: "", pastGrantsWon: "", uniqueStrengths: "",
};

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-brand-600" />
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <div
        onClick={onChange}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-brand-600" : "bg-gray-300"}`}
      >
        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

export default function GrantProfilePage() {
  const [profile, setProfile] = useState<GrantProfile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    authFetch("/api/grant-profile")
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (d.profile && typeof d.profile === "object") {
          // Ensure focusAreas is always an array
          const p = { ...d.profile };
          if (p.focusAreas && !Array.isArray(p.focusAreas)) {
            try { p.focusAreas = JSON.parse(p.focusAreas); } catch { p.focusAreas = []; }
          }
          setProfile({ ...EMPTY, ...p });
        }
      })
      .catch((err) => { console.error("Grant profile load error:", err); })
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof GrantProfile, value: unknown) =>
    setProfile((p) => ({ ...p, [key]: value }));

  const toggleFocus = (area: string) => {
    const current = profile.focusAreas ?? [];
    set("focusAreas", current.includes(area) ? current.filter((a) => a !== area) : [...current, area]);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await authFetch("/api/grant-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
  const selectCls = inputCls;
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl">
      {/* Grants suite nav */}
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5">
        <Link href="/grants" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:text-brand-600">
          <Trophy className="h-3.5 w-3.5" /> All Grants
        </Link>
        <Link href="/grants/crm" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:text-indigo-600">
          <KanbanSquare className="h-3.5 w-3.5" /> CRM
        </Link>
        <Link href="/grants/builder" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:text-emerald-600">
          <PenLine className="h-3.5 w-3.5" /> Builder
        </Link>
        <span className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 border border-brand-200">
          <Target className="h-3.5 w-3.5" /> Profile
        </span>
        <Link href="/grants/crawler" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:text-brand-600">
          <Rss className="h-3.5 w-3.5" /> Crawler
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Grant Profile</h1>
          <p className="mt-1 text-gray-500">Define your eligibility criteria so the system can rank and match grants intelligently</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : saved ? "Saved!" : "Save Profile"}
        </button>
      </div>

      <div className="space-y-5">
        {/* Organisation Identity */}
        <Section icon={Building2} title="Organisation Identity">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Organisation Type</label>
              <select className={selectCls} value={profile.orgType ?? ""} onChange={(e) => set("orgType", e.target.value)}>
                <option value="">Select…</option>
                {ORG_TYPES.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Primary Sector</label>
              <select className={selectCls} value={profile.sector ?? ""} onChange={(e) => set("sector", e.target.value)}>
                <option value="">Select…</option>
                {SECTORS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Sub-sector / Niche</label>
              <input className={inputCls} placeholder="e.g. Medical Imaging, EdTech, AgriFood" value={profile.subSector ?? ""} onChange={(e) => set("subSector", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Year Founded</label>
              <input className={inputCls} placeholder="e.g. 2018" value={profile.yearFounded ?? ""} onChange={(e) => set("yearFounded", e.target.value)} />
            </div>
          </div>
        </Section>

        {/* Location */}
        <Section icon={MapPin} title="Location">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>State / Region</label>
              <input className={inputCls} placeholder="e.g. Victoria, NSW, Queensland" value={profile.location ?? ""} onChange={(e) => set("location", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Country</label>
              <input className={inputCls} placeholder="Australia" value={profile.country ?? ""} onChange={(e) => set("country", e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <Toggle label="Regional or Rural location" checked={!!profile.regionalOrRural} onChange={() => set("regionalOrRural", !profile.regionalOrRural)} />
            <Toggle label="Indigenous-owned organisation" checked={!!profile.indigenousOwned} onChange={() => set("indigenousOwned", !profile.indigenousOwned)} />
            <Toggle label="Woman-owned / led organisation" checked={!!profile.womanOwned} onChange={() => set("womanOwned", !profile.womanOwned)} />
          </div>
        </Section>

        {/* Stage & Size */}
        <Section icon={Target} title="Stage & Size">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Organisation Stage</label>
              <select className={selectCls} value={profile.stage ?? ""} onChange={(e) => set("stage", e.target.value)}>
                <option value="">Select…</option>
                {STAGES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Team Size</label>
              <select className={selectCls} value={profile.teamSize ?? ""} onChange={(e) => set("teamSize", e.target.value)}>
                <option value="">Select…</option>
                {TEAM_SIZES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Annual Revenue</label>
              <select className={selectCls} value={profile.annualRevenue ?? ""} onChange={(e) => set("annualRevenue", e.target.value)}>
                <option value="">Select…</option>
                {REVENUES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <Toggle label="Registered Charity / DGR" checked={!!profile.isRegisteredCharity} onChange={() => set("isRegisteredCharity", !profile.isRegisteredCharity)} />
            <Toggle label="Has ABN" checked={!!profile.hasABN} onChange={() => set("hasABN", !profile.hasABN)} />
            <Toggle label="Has ACN (incorporated company)" checked={!!profile.hasACN} onChange={() => set("hasACN", !profile.hasACN)} />
          </div>
        </Section>

        {/* Funding Preferences */}
        <Section icon={DollarSign} title="Funding Preferences">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Min Grant Amount (AUD)</label>
              <input type="number" className={inputCls} placeholder="e.g. 10000" value={profile.targetFundingMin ?? ""} onChange={(e) => set("targetFundingMin", e.target.value ? parseInt(e.target.value) : null)} />
            </div>
            <div>
              <label className={labelCls}>Max Grant Amount (AUD)</label>
              <input type="number" className={inputCls} placeholder="e.g. 500000" value={profile.targetFundingMax ?? ""} onChange={(e) => set("targetFundingMax", e.target.value ? parseInt(e.target.value) : null)} />
            </div>
            <div>
              <label className={labelCls}>Preferred Project Duration</label>
              <select className={selectCls} value={profile.preferredDuration ?? ""} onChange={(e) => set("preferredDuration", e.target.value)}>
                <option value="">Any</option>
                {DURATIONS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </Section>

        {/* Focus Areas */}
        <Section icon={Tag} title="Grant Focus Areas">
          <p className="text-sm text-gray-500">Select all areas your organisation could apply for grants in</p>
          <div className="flex flex-wrap gap-2">
            {FOCUS_AREA_OPTIONS.map((area) => {
              const active = (profile.focusAreas ?? []).includes(area);
              return (
                <button
                  key={area}
                  onClick={() => toggleFocus(area)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${active ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  {area}
                </button>
              );
            })}
          </div>
        </Section>

        {/* AI Context */}
        <Section icon={Star} title="AI Context (improves matching accuracy)">
          <div>
            <label className={labelCls}>Mission Statement</label>
            <textarea rows={3} className={inputCls} placeholder="What is your organisation's core mission and purpose?" value={profile.missionStatement ?? ""} onChange={(e) => set("missionStatement", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Key Activities & Programs</label>
            <textarea rows={3} className={inputCls} placeholder="What do you actually do? What programs, products, or services do you deliver?" value={profile.keyActivities ?? ""} onChange={(e) => set("keyActivities", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Unique Strengths</label>
            <textarea rows={2} className={inputCls} placeholder="What makes your organisation stand out as a grant applicant?" value={profile.uniqueStrengths ?? ""} onChange={(e) => set("uniqueStrengths", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Past Grants Won (optional)</label>
            <textarea rows={2} className={inputCls} placeholder="List any grants you've previously been awarded — helps AI understand your track record" value={profile.pastGrantsWon ?? ""} onChange={(e) => set("pastGrantsWon", e.target.value)} />
          </div>
        </Section>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : saved ? "Saved!" : "Save Grant Profile"}
        </button>
      </div>
    </div>
  );
}
