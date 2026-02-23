"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, Scale, Stethoscope, Heart, ScanLine, History, Loader2 } from "lucide-react";
import { RulesTab, type ComplianceRule } from "./components/RulesTab";
import { AuditTab } from "./components/AuditTab";
import { ResultsTab } from "./components/ResultsTab";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { authFetch } from "@/lib/authFetch";

type Tab = "legal" | "medical" | "ethical" | "scanner" | "history";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "legal",   label: "Legal Rules",   icon: Scale },
  { id: "medical", label: "Medical Rules", icon: Stethoscope },
  { id: "ethical", label: "Ethical Rules", icon: Heart },
  { id: "scanner", label: "Run Audit",     icon: ScanLine },
  { id: "history", label: "Audit History", icon: History },
];

export default function SafetyAuditPage() {
  const [tab, setTab] = useState<Tab>("legal");
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if current user is admin
  useEffect(() => {
    authFetch("/api/users/me")
      .then((r) => r.json())
      .then((d) => {
        const role = d.user?.role ?? "";
        setIsAdmin(role === "ADMIN" || role === "SUPER_ADMIN");
      })
      .catch(() => {});
  }, []);

  const fetchRules = useCallback(async () => {
    setLoadingRules(true);
    try {
      const res = await authFetch(`/api/compliance/rules?companyId=${DEMO_COMPANY_ID}`);
      const data = await res.json();
      setRules(data.rules ?? []);
    } finally {
      setLoadingRules(false);
    }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleRuleCreated = useCallback((rule: ComplianceRule) => {
    setRules((prev) => [...prev, rule]);
  }, []);

  const handleRuleUpdated = useCallback((id: string, patch: Partial<ComplianceRule>) => {
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
  }, []);

  const handleRuleDeleted = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const legalCount   = rules.filter((r) => r.ruleType === "legal"   && r.active).length;
  const medicalCount = rules.filter((r) => r.ruleType === "medical" && r.active).length;
  const ethicalCount = rules.filter((r) => r.ruleType === "ethical" && r.active).length;
  const totalActive  = legalCount + medicalCount + ethicalCount;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
            <ShieldCheck className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Safety Audit</h1>
            <p className="text-gray-500 text-sm">
              Compliance scanning for legal, medical, and ethical requirements
            </p>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      {!loadingRules && (
        <div className="mb-6 grid grid-cols-4 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center">
            <p className="text-2xl font-bold text-gray-800">{totalActive}</p>
            <p className="text-xs text-gray-500 mt-0.5">Active Rules</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{legalCount}</p>
            <p className="text-xs text-blue-600 mt-0.5">Legal</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-red-700">{medicalCount}</p>
            <p className="text-xs text-red-600 mt-0.5">Medical</p>
          </div>
          <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-purple-700">{ethicalCount}</p>
            <p className="text-xs text-purple-600 mt-0.5">Ethical</p>
          </div>
        </div>
      )}

      {/* Compliance notice */}
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
        <ShieldCheck className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
        <p className="text-sm text-red-800">
          <strong>Medical Innovation Compliance.</strong> All content is scanned against your regulatory rules before publication. Content that fails a Critical or High severity rule should not be published without review.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1.5 flex-wrap border-b border-gray-200 pb-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? "border-brand-600 text-brand-700 bg-brand-50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {loadingRules && (tab === "legal" || tab === "medical" || tab === "ethical") ? (
        <div className="py-16 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-500" />
          <p className="mt-3 text-sm text-gray-400">Loading rules…</p>
        </div>
      ) : (
        <>
          {tab === "legal" && (
            <RulesTab
              ruleType="legal"
              rules={rules}
              isAdmin={isAdmin}
              onRuleCreated={handleRuleCreated}
              onRuleUpdated={handleRuleUpdated}
              onRuleDeleted={handleRuleDeleted}
            />
          )}
          {tab === "medical" && (
            <RulesTab
              ruleType="medical"
              rules={rules}
              isAdmin={isAdmin}
              onRuleCreated={handleRuleCreated}
              onRuleUpdated={handleRuleUpdated}
              onRuleDeleted={handleRuleDeleted}
            />
          )}
          {tab === "ethical" && (
            <RulesTab
              ruleType="ethical"
              rules={rules}
              isAdmin={isAdmin}
              onRuleCreated={handleRuleCreated}
              onRuleUpdated={handleRuleUpdated}
              onRuleDeleted={handleRuleDeleted}
            />
          )}
          {tab === "scanner" && <AuditTab />}
          {tab === "history" && <ResultsTab />}
        </>
      )}
    </div>
  );
}
