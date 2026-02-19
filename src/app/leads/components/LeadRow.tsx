"use client";

import { useState } from "react";
import {
  ChevronDown, ChevronUp, Linkedin, Globe, Save, Trash2, Loader2,
  Mail, Phone, Building2, MapPin, Tag, Code2,
} from "lucide-react";
import { type Lead, LEAD_STATUSES, STATUS_STYLES, SOURCE_STYLES } from "@/hooks/useLeads";

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelCls = "mb-1 block text-xs font-medium text-gray-600";

interface Props {
  lead: Lead;
  onUpdate: (id: string, d: Partial<Lead>) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}

export function LeadRow({ lead, onUpdate, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [form, setForm] = useState<Partial<Lead>>({ ...lead });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = (k: keyof Lead, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try { await onUpdate(lead.id, form); setEditing(false); }
    finally { setSaving(false); }
  };

  const del = async () => {
    if (!confirm(`Delete "${lead.fullName || "this lead"}"?`)) return;
    setDeleting(true);
    try { await onDelete(lead.id); }
    finally { setDeleting(false); }
  };

  const statusCls = STATUS_STYLES[lead.status] ?? STATUS_STYLES.new;
  const sourceCls = SOURCE_STYLES[lead.source] ?? SOURCE_STYLES.manual;

  return (
    <>
      <tr className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${expanded ? "bg-gray-50" : ""}`}>
        <td className="px-4 py-3">
          <div className="flex items-start gap-2">
            <button onClick={() => setExpanded(v => !v)} className="mt-0.5 shrink-0 text-gray-400 hover:text-brand-600">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 text-sm">{lead.fullName || "—"}</p>
              <p className="text-xs text-gray-400 mt-0.5">{lead.jobTitle || ""}</p>
            </div>
          </div>
        </td>
        <td className="px-3 py-3 text-sm text-gray-600">{lead.company || <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-3 text-xs text-gray-500">
          {lead.email
            ? <a href={`mailto:${lead.email}`} className="text-brand-600 hover:underline">{lead.email}</a>
            : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-3 py-3 text-xs text-gray-500">{lead.location || <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-3">
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${sourceCls}`}>{lead.source}</span>
        </td>
        <td className="px-3 py-3">
          <select
            value={lead.status}
            onChange={(e) => onUpdate(lead.id, { status: e.target.value })}
            className={`rounded-full border px-2 py-0.5 text-xs font-medium cursor-pointer focus:outline-none ${statusCls}`}
          >
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-1.5">
            {lead.linkedinUrl && <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" title="LinkedIn" className="text-blue-400 hover:text-blue-600"><Linkedin className="h-4 w-4" /></a>}
            {lead.profileUrl && !lead.linkedinUrl && <a href={lead.profileUrl} target="_blank" rel="noopener noreferrer" title="Profile" className="text-brand-400 hover:text-brand-600"><Globe className="h-4 w-4" /></a>}
            <button onClick={() => { setEditing(true); setExpanded(true); }} title="Edit" className="text-gray-400 hover:text-brand-600"><Save className="h-4 w-4" /></button>
            <button onClick={del} disabled={deleting} title="Delete" className="text-gray-300 hover:text-red-500 disabled:opacity-40">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-gray-100 bg-gray-50">
          <td colSpan={7} className="px-6 py-5">
            {editing ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {([
                  { k: "fullName", label: "Full Name" }, { k: "email", label: "Email" },
                  { k: "phone", label: "Phone" }, { k: "jobTitle", label: "Job Title" },
                  { k: "company", label: "Company" }, { k: "location", label: "Location" },
                  { k: "linkedinUrl", label: "LinkedIn URL" }, { k: "profileUrl", label: "Profile URL" },
                ] as { k: keyof Lead; label: string }[]).map(({ k, label }) => (
                  <div key={k}>
                    <label className={labelCls}>{label}</label>
                    <input value={(form[k] as string) ?? ""} onChange={(e) => set(k, e.target.value)} className={inputCls} />
                  </div>
                ))}
                <div className="sm:col-span-3">
                  <label className={labelCls}>Notes</label>
                  <textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={2} className={inputCls} />
                </div>
                <div className="sm:col-span-3 flex gap-2 mt-1">
                  <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                  </button>
                  <button onClick={() => { setEditing(false); setForm({ ...lead }); }} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-white">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                {lead.email && <div className="flex items-center gap-2 text-gray-700"><Mail className="h-4 w-4 text-gray-400 shrink-0" /><a href={`mailto:${lead.email}`} className="text-brand-600 hover:underline truncate">{lead.email}</a></div>}
                {lead.phone && <div className="flex items-center gap-2 text-gray-700"><Phone className="h-4 w-4 text-gray-400 shrink-0" />{lead.phone}</div>}
                {lead.company && <div className="flex items-center gap-2 text-gray-700"><Building2 className="h-4 w-4 text-gray-400 shrink-0" />{lead.company}</div>}
                {lead.location && <div className="flex items-center gap-2 text-gray-700"><MapPin className="h-4 w-4 text-gray-400 shrink-0" />{lead.location}</div>}
                {lead.specialties?.length ? <div className="flex items-start gap-2 text-gray-700 sm:col-span-2"><Tag className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" /><span>{lead.specialties.join(", ")}</span></div> : null}
                {lead.notes && <div className="sm:col-span-3 text-gray-600 text-xs whitespace-pre-wrap bg-white rounded-lg border border-gray-100 px-3 py-2">{lead.notes}</div>}
                <div className="sm:col-span-3 flex items-center gap-4">
                  <button onClick={() => setEditing(true)} className="text-xs text-brand-600 hover:underline">Edit all fields →</button>
                  {lead.rawData && (
                    <button onClick={() => setShowRaw(v => !v)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                      <Code2 className="h-3.5 w-3.5" />{showRaw ? "Hide raw data" : "View raw data"}
                    </button>
                  )}
                </div>
                {showRaw && lead.rawData && (
                  <div className="sm:col-span-3">
                    <pre className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-900 p-3 text-xs text-green-400 max-h-64">{JSON.stringify(lead.rawData, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
