"use client";

import { useState, useCallback } from "react";
import { Plus, Trash2, ToggleLeft, ToggleRight, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";

export interface ComplianceRule {
  id: string;
  ruleType: "legal" | "medical" | "ethical";
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  active: boolean;
  createdAt: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high:     "bg-orange-100 text-orange-700 border-orange-200",
  medium:   "bg-amber-100 text-amber-700 border-amber-200",
  low:      "bg-blue-100 text-blue-700 border-blue-200",
};

interface Props {
  ruleType: "legal" | "medical" | "ethical";
  rules: ComplianceRule[];
  isAdmin: boolean;
  onRuleCreated: (rule: ComplianceRule) => void;
  onRuleUpdated: (id: string, patch: Partial<ComplianceRule>) => void;
  onRuleDeleted: (id: string) => void;
}

const TYPE_META = {
  legal:    { label: "Legal Rules",    color: "text-blue-700",  bg: "bg-blue-50",  border: "border-blue-200",  icon: "⚖️" },
  medical:  { label: "Medical Rules",  color: "text-red-700",   bg: "bg-red-50",   border: "border-red-200",   icon: "🏥" },
  ethical:  { label: "Ethical Rules",  color: "text-purple-700",bg: "bg-purple-50",border: "border-purple-200",icon: "🤝" },
};

export function RulesTab({ ruleType, rules, isAdmin, onRuleCreated, onRuleUpdated, onRuleDeleted }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", severity: "high" as const });
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const meta = TYPE_META[ruleType];
  const filtered = rules.filter((r) => r.ruleType === ruleType);

  const handleCreate = useCallback(async () => {
    if (!form.title.trim() || !form.description.trim()) return;
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch("/api/compliance/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleType, title: form.title, description: form.description, severity: form.severity }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save rule");
      onRuleCreated(data.rule);
      setForm({ title: "", description: "", severity: "high" });
      setShowForm(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save rule");
    } finally {
      setSaving(false);
    }
  }, [form, ruleType, onRuleCreated]);

  const handleToggle = useCallback(async (rule: ComplianceRule) => {
    onRuleUpdated(rule.id, { active: !rule.active });
    try {
      await fetch(`/api/compliance/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !rule.active }),
      });
    } catch {
      onRuleUpdated(rule.id, { active: rule.active });
    }
  }, [onRuleUpdated]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this rule?")) return;
    onRuleDeleted(id);
    try {
      await fetch(`/api/compliance/rules/${id}`, { method: "DELETE" });
    } catch {
      setActionError("Failed to delete rule");
    }
  }, [onRuleDeleted]);

  return (
    <div>
      {/* Header */}
      <div className={`mb-5 flex items-center justify-between rounded-xl ${meta.bg} ${meta.border} border px-5 py-4`}>
        <div>
          <h2 className={`text-lg font-bold ${meta.color}`}>{meta.icon} {meta.label}</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {filtered.length} rule{filtered.length !== 1 ? "s" : ""} — {filtered.filter((r) => r.active).length} active
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Add Rule
          </button>
        )}
      </div>

      {actionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      {/* Add form */}
      {showForm && isAdmin && (
        <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-gray-800">New {meta.label.replace(" Rules", "")} Rule</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Rule Title <span className="text-red-500">*</span></label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. No unverified medical claims"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Rule Description <span className="text-red-500">*</span></label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe exactly what is prohibited or required..."
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Severity</label>
              <select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value as any })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none bg-white"
              >
                <option value="critical">Critical — immediate violation, must block</option>
                <option value="high">High — serious issue, flag prominently</option>
                <option value="medium">Medium — review recommended</option>
                <option value="low">Low — minor concern</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !form.title.trim() || !form.description.trim()}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              {saving ? "Saving..." : "Save Rule"}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm({ title: "", description: "", severity: "high" }); }}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rules list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-14 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 font-medium text-gray-500">No {meta.label.toLowerCase()} yet</p>
          <p className="mt-1 text-sm text-gray-400">
            {isAdmin ? "Click \"Add Rule\" to define your first compliance rule." : "No rules have been added yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((rule) => (
            <div
              key={rule.id}
              className={`rounded-xl border bg-white px-5 py-4 transition-opacity ${rule.active ? "border-gray-200" : "border-gray-100 opacity-50"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${SEVERITY_COLORS[rule.severity] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                      {rule.severity.toUpperCase()}
                    </span>
                    {!rule.active && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">disabled</span>
                    )}
                  </div>
                  <p className="font-medium text-gray-800">{rule.title}</p>
                  <p className="mt-1 text-sm text-gray-500 leading-relaxed">{rule.description}</p>
                  <p className="mt-1.5 text-xs text-gray-400">{new Date(rule.createdAt).toLocaleDateString()}</p>
                </div>
                {isAdmin && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => handleToggle(rule)}
                      title={rule.active ? "Disable rule" : "Enable rule"}
                      className="rounded-md border border-gray-200 p-1.5 hover:bg-gray-50"
                    >
                      {rule.active
                        ? <ToggleRight className="h-4 w-4 text-green-600" />
                        : <ToggleLeft className="h-4 w-4 text-gray-400" />}
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="rounded-md border border-red-100 p-1.5 text-red-400 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
