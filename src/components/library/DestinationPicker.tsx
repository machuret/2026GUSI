"use client";

import { useState } from "react";
import { Globe, Check, Loader2, ChevronDown } from "lucide-react";

export const DESTINATIONS = [
  { key: "facebook",   label: "Facebook",   color: "bg-blue-100 text-blue-700" },
  { key: "instagram",  label: "Instagram",  color: "bg-pink-100 text-pink-700" },
  { key: "linkedin",   label: "LinkedIn",   color: "bg-sky-100 text-sky-700" },
  { key: "twitter",    label: "X / Twitter",color: "bg-gray-100 text-gray-700" },
  { key: "tiktok",     label: "TikTok",     color: "bg-purple-100 text-purple-700" },
  { key: "youtube",    label: "YouTube",    color: "bg-red-100 text-red-700" },
  { key: "email",      label: "Email",      color: "bg-amber-100 text-amber-700" },
  { key: "website",    label: "Website",    color: "bg-green-100 text-green-700" },
  { key: "blog",       label: "Blog",       color: "bg-orange-100 text-orange-700" },
  { key: "newsletter", label: "Newsletter", color: "bg-indigo-100 text-indigo-700" },
  { key: "webinar",    label: "Webinar",    color: "bg-teal-100 text-teal-700" },
  { key: "course",     label: "Course",     color: "bg-violet-100 text-violet-700" },
] as const;

export type DestinationKey = (typeof DESTINATIONS)[number]["key"];

interface Props {
  contentId: string;
  category:  string;
  selected:  string[];
  onSaved:   (destinations: string[]) => void;
}

export function DestinationPicker({ contentId, category, selected, onSaved }: Props) {
  const [open, setOpen]       = useState(false);
  const [draft, setDraft]     = useState<string[]>(selected);
  const [saving, setSaving]   = useState(false);

  const toggle = (key: string) => {
    setDraft((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/content/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, category, destinations: draft }),
      });
      if (res.ok) {
        onSaved(draft);
        setOpen(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const selectedDests = DESTINATIONS.filter((d) => selected.includes(d.key));

  return (
    <div className="relative">
      <button
        onClick={() => { setDraft(selected); setOpen((v) => !v); }}
        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
          selected.length > 0
            ? "border-green-300 bg-green-50 text-green-700"
            : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
        }`}
      >
        <Globe className="h-3.5 w-3.5" />
        {selected.length > 0 ? `${selected.length} destination${selected.length > 1 ? "s" : ""}` : "Set destination"}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {/* Inline badges when closed */}
      {!open && selectedDests.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {selectedDests.map((d) => (
            <span key={d.key} className={`rounded-full px-2 py-0.5 text-xs font-medium ${d.color}`}>
              {d.label}
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold text-gray-700">Select destinations</p>
          <div className="grid grid-cols-2 gap-1">
            {DESTINATIONS.map((d) => {
              const active = draft.includes(d.key);
              return (
                <button
                  key={d.key}
                  onClick={() => toggle(d.key)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left ${
                    active ? d.color + " ring-1 ring-inset ring-current/30" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {active && <Check className="h-3 w-3 shrink-0" />}
                  {!active && <span className="h-3 w-3 shrink-0" />}
                  {d.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand-600 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Save
            </button>
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
