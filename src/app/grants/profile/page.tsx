"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Save, Loader2, CheckCircle, Target, Building2, MapPin, DollarSign, Tag, Star, ArrowLeft, Trophy, PenLine, Rss, KanbanSquare, ShieldCheck, User, FileText, Plus, Trash2, Sparkles, X, History } from "lucide-react";
import { authFetch, edgeFn } from "@/lib/authFetch";

const ORG_TYPES = ["Non-profit / Charity", "Social Enterprise", "SME (Small-Medium Business)", "Startup", "University / Research Institute", "Government / Council", "Indigenous Organisation", "Other"];
const SECTORS = ["Health & Medical", "Education & Training", "Technology & Innovation", "Environment & Sustainability", "Arts & Culture", "Community Services", "Agriculture & Food", "Export & Trade", "Manufacturing", "Other"];
const STAGES = ["Pre-revenue / Concept", "Early Stage (0-2 years)", "Growth Stage (2-5 years)", "Established (5+ years)"];
const TEAM_SIZES = ["Solo / 1 person", "2-5", "6-20", "21-50", "50+"];
const REVENUES = ["Pre-revenue", "Under $250k", "$250k–$500k", "$500k–$1M", "$1M–$5M", "$5M+"];
const DURATIONS = ["Under 6 months", "6–12 months", "1–2 years", "2+ years", "Any"];
const FOCUS_AREA_OPTIONS = ["R&D / Innovation", "Export & International", "Training & Workforce", "Capital Equipment", "Marketing & Promotion", "Environmental / Sustainability", "Community Impact", "Digital Transformation", "Product Development", "Research & Collaboration"];

interface ContactPerson {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
}

interface GrantProfile {
  contacts?: ContactPerson[];
  contactName?: string;
  contactRole?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
  orgType?: string;
  orgType2?: string;
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
  hasEIN?: boolean;
  indigenousOwned?: boolean;
  womanOwned?: boolean;
  regionalOrRural?: boolean;
  missionStatement?: string;
  keyActivities?: string;
  pastGrantsWon?: string;
  uniqueStrengths?: string;
  extraDocs?: { title: string; content: string }[];
}

const EMPTY: GrantProfile = {
  contacts: [],
  contactName: "", contactRole: "", contactEmail: "", contactPhone: "", contactAddress: "",
  orgType: "", orgType2: "", sector: "", subSector: "", location: "", country: "United States",
  stage: "", teamSize: "", annualRevenue: "", yearFounded: "",
  focusAreas: [], targetFundingMin: null, targetFundingMax: null, preferredDuration: "",
  isRegisteredCharity: false, hasEIN: false,
  indigenousOwned: false, womanOwned: false, regionalOrRural: false,
  missionStatement: "", keyActivities: "", pastGrantsWon: "", uniqueStrengths: "",
  extraDocs: [],
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
    <button type="button" onClick={onChange} className="flex cursor-pointer items-center gap-3">
      <div
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-brand-600" : "bg-gray-300"}`}
      >
        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </button>
  );
}

export default function GrantProfilePage() {
  const [profile, setProfile] = useState<GrantProfile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [aiFilling, setAiFilling] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [editingDocIdx, setEditingDocIdx] = useState<number | null>(null);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocContent, setNewDocContent] = useState("");

  useEffect(() => {
    authFetch(edgeFn("grant-profile"))
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

  // ── Contacts helpers ──────────────────────────────────────────────────────
  const addContact = () => {
    set("contacts", [...(profile.contacts ?? []), { name: "", role: "", email: "", phone: "" }]);
  };
  const updateContact = (idx: number, field: keyof ContactPerson, value: string) => {
    const updated = (profile.contacts ?? []).map((c, i) => i === idx ? { ...c, [field]: value } : c);
    set("contacts", updated);
  };
  const removeContact = (idx: number) => {
    if (!confirm("Remove this contact?")) return;
    set("contacts", (profile.contacts ?? []).filter((_, i) => i !== idx));
  };

  const toggleFocus = (area: string) => {
    const current = profile.focusAreas ?? [];
    set("focusAreas", current.includes(area) ? current.filter((a) => a !== area) : [...current, area]);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const res = await authFetch(edgeFn("grant-profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
      else {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error || `Save failed (${res.status})`);
      }
    } catch {
      setSaveError("Network error — changes were not saved.");
    } finally {
      setSaving(false);
    }
  };

  // ── Extra docs helpers ─────────────────────────────────────────────────────
  const addExtraDoc = () => {
    if (!newDocTitle.trim() || !newDocContent.trim()) return;
    const docs = [...(profile.extraDocs ?? []), { title: newDocTitle.trim(), content: newDocContent.trim() }];
    set("extraDocs", docs);
    setNewDocTitle("");
    setNewDocContent("");
  };

  const updateExtraDoc = (idx: number, field: "title" | "content", value: string) => {
    const docs = [...(profile.extraDocs ?? [])];
    docs[idx] = { ...docs[idx], [field]: value };
    set("extraDocs", docs);
  };

  const removeExtraDoc = (idx: number) => {
    if (!confirm(`Delete "${(profile.extraDocs ?? [])[idx]?.title}"?`)) return;
    const docs = (profile.extraDocs ?? []).filter((_, i) => i !== idx);
    set("extraDocs", docs);
    if (editingDocIdx === idx) setEditingDocIdx(null);
  };

  // ── AI auto-fill from Vault ───────────────────────────────────────────────
  const handleAiFill = async () => {
    if (!confirm("Use AI to fill empty profile fields from your Vault documents?\n\nThis will only fill fields that are currently empty — existing values won't be overwritten.")) return;
    setAiFilling(true);
    setAiMsg(null);
    try {
      const res = await authFetch("/api/grants/profile-autofill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI fill failed");
      if (data.profile) {
        setProfile((prev) => {
          const merged = { ...prev };
          for (const [k, v] of Object.entries(data.profile)) {
            const key = k as keyof GrantProfile;
            const current = merged[key];
            if (v && (!current || (typeof current === "string" && !current.trim()))) {
              (merged as Record<string, unknown>)[key] = v;
            }
          }
          return merged;
        });
        setAiMsg(`Filled ${data.filledCount ?? 0} field(s) from Vault`);
        setTimeout(() => setAiMsg(null), 4000);
      }
    } catch (err) {
      setAiMsg(`Error: ${err instanceof Error ? err.message : "Failed"}`);
    } finally {
      setAiFilling(false);
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
        <Link href="/grants/auditor" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:text-amber-600">
          <ShieldCheck className="h-3.5 w-3.5" /> Auditor
        </Link>
        <Link href="/grants/history" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:text-amber-700">
          <History className="h-3.5 w-3.5" /> History
        </Link>
      </div>

      {saveError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium">{saveError}</div>
      )}

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Grant Profile</h1>
          <p className="mt-1 text-gray-500">Define your eligibility criteria so the system can rank and match grants intelligently</p>
        </div>
        <div className="flex items-center gap-2">
          {aiMsg && <span className={`text-xs font-medium ${aiMsg.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>{aiMsg}</span>}
          <button
            onClick={handleAiFill}
            disabled={aiFilling}
            className="flex items-center gap-2 rounded-lg border border-purple-300 bg-purple-50 px-4 py-2.5 text-sm font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-60"
          >
            {aiFilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {aiFilling ? "Filling…" : "AI Auto-fill"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : saved ? "Saved!" : "Save Profile"}
          </button>
        </div>
      </div>

      <div className="space-y-5">
        {/* Contacts */}
        <Section icon={User} title="Grant Contacts">
          <p className="text-sm text-gray-500">Add all founders and contact people for grant applications. The first contact is used as the primary applicant.</p>

          {(profile.contacts ?? []).length === 0 && (
            <p className="text-sm text-gray-400 italic">No contacts added yet. Click below to add your first founder or contact person.</p>
          )}

          <div className="space-y-4">
            {(profile.contacts ?? []).map((contact, idx) => (
              <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {idx === 0 ? "Primary Contact" : `Contact ${idx + 1}`}
                  </span>
                  <button
                    onClick={() => removeContact(idx)}
                    className="rounded p-1 text-gray-400 hover:text-red-500 hover:bg-white transition-colors"
                    title="Remove contact"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Full Name <span className="text-red-400">*</span></label>
                    <input
                      className={inputCls}
                      placeholder="e.g. Jane Smith"
                      value={contact.name}
                      onChange={(e) => updateContact(idx, "name", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Role / Title</label>
                    <input
                      className={inputCls}
                      placeholder="e.g. Co-Founder & CEO"
                      value={contact.role ?? ""}
                      onChange={(e) => updateContact(idx, "role", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Email Address</label>
                    <input
                      type="email"
                      className={inputCls}
                      placeholder="e.g. jane@organisation.com"
                      value={contact.email ?? ""}
                      onChange={(e) => updateContact(idx, "email", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Phone Number</label>
                    <input
                      type="tel"
                      className={inputCls}
                      placeholder="e.g. +1 (555) 123-4567"
                      value={contact.phone ?? ""}
                      onChange={(e) => updateContact(idx, "phone", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addContact}
            className="flex items-center gap-2 rounded-lg border-2 border-dashed border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-500 hover:border-brand-400 hover:text-brand-600 w-full justify-center transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Contact Person
          </button>

          <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
            <p className="text-xs text-amber-700">
              <strong>Mailing address</strong> — add this in the{" "}
              <button onClick={() => document.getElementById('extra-docs-section')?.scrollIntoView({ behavior: 'smooth' })} className="underline font-semibold">Extra Info &amp; Documents</button>{" "}
              section as a document titled &quot;Mailing Address&quot; if needed.
            </p>
          </div>
        </Section>

        {/* Organisation Identity */}
        <Section icon={Building2} title="Organisation Identity">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Primary Organisation Type</label>
              <select className={selectCls} value={profile.orgType ?? ""} onChange={(e) => set("orgType", e.target.value)}>
                <option value="">Select…</option>
                {ORG_TYPES.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Secondary Organisation Type <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
              <select className={selectCls} value={profile.orgType2 ?? ""} onChange={(e) => set("orgType2", e.target.value)}>
                <option value="">None</option>
                {ORG_TYPES.filter(o => o !== profile.orgType).map((o) => <option key={o}>{o}</option>)}
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
              <input className={inputCls} placeholder="e.g. California, New York, Texas" value={profile.location ?? ""} onChange={(e) => set("location", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Country</label>
              <input className={inputCls} placeholder="United States" value={profile.country ?? ""} onChange={(e) => set("country", e.target.value)} />
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
            <Toggle label="Registered 501(c)(3) Non-profit" checked={!!profile.isRegisteredCharity} onChange={() => set("isRegisteredCharity", !profile.isRegisteredCharity)} />
            <Toggle label="Has EIN (Employer Identification Number)" checked={!!profile.hasEIN} onChange={() => set("hasEIN", !profile.hasEIN)} />
          </div>
        </Section>

        {/* Funding Preferences */}
        <Section icon={DollarSign} title="Funding Preferences">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Min Grant Amount (USD)</label>
              <input type="number" className={inputCls} placeholder="e.g. 10000" value={profile.targetFundingMin ?? ""} onChange={(e) => set("targetFundingMin", e.target.value ? parseInt(e.target.value) : null)} />
            </div>
            <div>
              <label className={labelCls}>Max Grant Amount (USD)</label>
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

        {/* Extra Info / Documents */}
        <Section icon={FileText} title="Extra Info &amp; Documents">
          <p className="text-sm text-gray-500">
            Paste supporting documents here (e.g. Capability Statement, Global Health Initiatives page).
            These are stored in Supabase and fed into the AI when writing grants.
          </p>

          {/* Existing docs */}
          {(profile.extraDocs ?? []).map((doc, idx) => (
            <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between mb-2">
                {editingDocIdx === idx ? (
                  <input
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm font-semibold mr-2 focus:border-brand-500 focus:outline-none"
                    value={doc.title}
                    onChange={(e) => updateExtraDoc(idx, "title", e.target.value)}
                  />
                ) : (
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-brand-500" /> {doc.title}
                  </h3>
                )}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingDocIdx(editingDocIdx === idx ? null : idx)}
                    className="rounded p-1 text-gray-400 hover:text-brand-600 hover:bg-white"
                    title={editingDocIdx === idx ? "Done editing" : "Edit"}
                  >
                    {editingDocIdx === idx ? <X className="h-3.5 w-3.5" /> : <PenLine className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => removeExtraDoc(idx)} className="rounded p-1 text-gray-400 hover:text-red-500 hover:bg-white" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {editingDocIdx === idx ? (
                <textarea
                  rows={10}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  value={doc.content}
                  onChange={(e) => updateExtraDoc(idx, "content", e.target.value)}
                />
              ) : (
                <p className="text-xs text-gray-500 line-clamp-3 whitespace-pre-wrap">{doc.content.slice(0, 300)}{doc.content.length > 300 ? "…" : ""}</p>
              )}
              <p className="mt-1 text-[10px] text-gray-400">{doc.content.length.toLocaleString()} characters</p>
            </div>
          ))}

          {/* Add new doc */}
          <div className="rounded-lg border-2 border-dashed border-gray-200 p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add Document
            </h4>
            <input
              className={inputCls}
              placeholder="Document title — e.g. GUSI Capability Statement"
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
            />
            <textarea
              rows={6}
              className={inputCls}
              placeholder="Paste your document content here…"
              value={newDocContent}
              onChange={(e) => setNewDocContent(e.target.value)}
            />
            <button
              onClick={addExtraDoc}
              disabled={!newDocTitle.trim() || !newDocContent.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Add Document
            </button>
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
