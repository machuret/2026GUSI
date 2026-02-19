"use client";

import { useState } from "react";
import { X, Save, Loader2 } from "lucide-react";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { authFetch } from "@/lib/authFetch";
import type { Grant } from "@/hooks/useGrants";
import { EMPTY_FORM } from "./grantTypes";
import { GrantFormFields } from "./GrantFormFields";

interface Props {
  onClose: () => void;
  onSaved: (g: Grant) => void;
}

export function AddGrantModal({ onClose, onSaved }: Props) {
  const [form, setForm] = useState<Partial<Grant>>(EMPTY_FORM());
  const [saving, setSaving] = useState(false);
  const [researching, setResearching] = useState(false);
  const [researchMsg, setResearchMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Grant, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleResearch = async () => {
    if (!form.name?.trim() && !form.url?.trim()) { setError("Enter a grant name or URL first"); return; }
    setResearching(true); setResearchMsg(null); setError(null);
    try {
      const res = await authFetch("/api/grants/research", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, url: form.url, founder: form.founder, existingData: form }),
      });
      const data = await res.json();
      if (data.success && data.filled) {
        setForm((p) => ({ ...p, ...data.filled }));
        const count = Object.keys(data.filled).length;
        setResearchMsg(`✓ AI filled ${count} field${count !== 1 ? "s" : ""}`);
      } else setError(data.error || "Research failed");
    } catch { setError("Network error"); }
    finally { setResearching(false); }
  };

  const save = async () => {
    if (!form.name?.trim()) { setError("Grant name is required"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/grants", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, companyId: DEMO_COMPANY_ID }),
      });
      const data = await res.json();
      if (data.success) { onSaved(data.grant); onClose(); }
      else setError(data.error || "Failed to save");
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Add Grant</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>
        <div className="p-6">
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {researchMsg && <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{researchMsg}</p>}
          {researching && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
              <Loader2 className="h-4 w-4 animate-spin" /> AI is researching this grant…
            </div>
          )}
          <GrantFormFields form={form} set={set} onResearch={handleResearch} researching={researching} />
        </div>
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-100 bg-white px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Grant
          </button>
        </div>
      </div>
    </div>
  );
}
