"use client";

import { useCallback, useEffect, useState } from "react";
import { DEMO_COMPANY_ID } from "@/lib/constants";

export interface Grant {
  id: string;
  companyId: string;
  name: string;
  founder?: string | null;
  url?: string | null;
  deadlineDate?: string | null;
  howToApply?: string | null;
  geographicScope?: string | null;
  eligibility?: string | null;
  amount?: string | null;
  projectDuration?: string | null;
  fitScore?: number | null;
  submissionEffort?: "Low" | "Medium" | "High" | null;
  decision?: "Apply" | "Maybe" | "No" | null;
  notes?: string | null;
  aiScore?: number | null;
  aiVerdict?: string | null;
  matchScore?: number | null;
  complexityScore?: number | null;
  complexityLabel?: "Low" | "Medium" | "High" | "Very High" | null;
  complexityNotes?: string | null;
  crmStatus?: "Researching" | "Pipeline" | "Active" | "Submitted" | "Won" | "Lost" | null;
  crmNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useGrants() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyDNA, setCompanyDNA] = useState("");

  const fetchGrants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // TODO: replace DEMO_COMPANY_ID with session companyId when multi-tenancy lands
      const [grantsRes, companyRes] = await Promise.all([
        fetch(`/api/grants?companyId=${DEMO_COMPANY_ID}`),
        fetch(`/api/company?companyId=${DEMO_COMPANY_ID}`),
      ]);
      if (!grantsRes.ok) throw new Error(`Failed to load grants (${grantsRes.status})`);
      if (!companyRes.ok && companyRes.status !== 404) throw new Error(`Failed to load company (${companyRes.status})`);
      const grantsData = await grantsRes.json();
      const companyData = companyRes.ok ? await companyRes.json() : {};

      setGrants(grantsData.grants ?? []);

      // /api/company returns { company, info } — not companyInfo
      const info = companyData.info;
      const company = companyData.company;
      const parts = [
        company?.name        ? `Company: ${company.name}`           : null,
        company?.industry    ? `Industry: ${company.industry}`      : null,
        info?.bulkContent    ? info.bulkContent                     : null,
        info?.values         ? `Values: ${info.values}`             : null,
        info?.corePhilosophy ? `Philosophy: ${info.corePhilosophy}` : null,
        info?.founders       ? `Founders: ${info.founders}`         : null,
        info?.achievements   ? `Achievements: ${info.achievements}` : null,
        info?.products       ? `Products: ${info.products}`         : null,
      ].filter(Boolean);
      if (parts.length > 0) setCompanyDNA(parts.join("\n").slice(0, 2500));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load grants");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGrants(); }, [fetchGrants]);

  const updateGrant = useCallback(async (id: string, data: Partial<Grant>) => {
    const res = await fetch(`/api/grants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (result.success) {
      setGrants((prev) => prev.map((g) => g.id === id ? { ...g, ...result.grant } : g));
    }
    return result;
  }, []);

  const deleteGrant = useCallback(async (id: string) => {
    const res = await fetch(`/api/grants/${id}`, { method: "DELETE" });
    const result = await res.json();
    if (result.success) {
      setGrants((prev) => prev.filter((g) => g.id !== id));
    }
    return result;
  }, []);

  const addGrant = useCallback((grant: Grant) => {
    setGrants((prev) => [grant, ...prev]);
  }, []);

  return { grants, loading, error, companyDNA, fetchGrants, updateGrant, deleteGrant, addGrant };
}
