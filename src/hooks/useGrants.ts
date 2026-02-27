"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { authFetch } from "@/lib/authFetch";

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
  decision?: "Apply" | "Maybe" | "No" | "Rejected" | null;
  notes?: string | null;
  aiScore?: number | null;
  aiVerdict?: string | null;
  aiAnalysis?: Record<string, unknown> | null;
  aiResearched?: boolean | null;
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyDNA, setCompanyDNA] = useState("");
  const initialLoadDone = useRef(false);

  const fetchGrants = useCallback(async () => {
    if (initialLoadDone.current) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      // TODO: replace DEMO_COMPANY_ID with session companyId when multi-tenancy lands
      const [grantsRes, companyRes, profileRes] = await Promise.all([
        authFetch(`/api/grants?companyId=${DEMO_COMPANY_ID}`),
        authFetch(`/api/company?companyId=${DEMO_COMPANY_ID}`),
        authFetch("/api/grant-profile"),
      ]);
      if (!grantsRes.ok) throw new Error(`Failed to load grants (${grantsRes.status})`);
      if (!companyRes.ok && companyRes.status !== 404) throw new Error(`Failed to load company (${companyRes.status})`);
      const grantsData = await grantsRes.json();
      const companyData = companyRes.ok ? await companyRes.json() : {};
      const profileData = profileRes.ok ? await profileRes.json() : {};

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

      // Fallback: also build DNA from Grant Profile if company info is sparse
      const gp = profileData.profile;
      if (gp) {
        const gpParts = [
          gp.orgType          ? `Organisation Type: ${gp.orgType}` : null,
          gp.sector            ? `Sector: ${gp.sector}${gp.subSector ? ` / ${gp.subSector}` : ""}` : null,
          gp.location          ? `Location: ${gp.location}, ${gp.country ?? "Australia"}` : null,
          gp.stage             ? `Stage: ${gp.stage}` : null,
          gp.teamSize          ? `Team Size: ${gp.teamSize}` : null,
          gp.annualRevenue     ? `Annual Revenue: ${gp.annualRevenue}` : null,
          gp.missionStatement  ? `Mission: ${gp.missionStatement}` : null,
          gp.keyActivities     ? `Key Activities: ${gp.keyActivities}` : null,
          gp.uniqueStrengths   ? `Unique Strengths: ${gp.uniqueStrengths}` : null,
          gp.pastGrantsWon     ? `Past Grants Won: ${gp.pastGrantsWon}` : null,
          Array.isArray(gp.focusAreas) && gp.focusAreas.length > 0 ? `Focus Areas: ${gp.focusAreas.join(", ")}` : null,
        ].filter(Boolean);
        parts.push(...gpParts);
      }

      setCompanyDNA(parts.length > 0 ? parts.join("\n").slice(0, 4000) : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load grants");
    } finally {
      setLoading(false);
      setRefreshing(false);
      initialLoadDone.current = true;
    }
  }, []);

  useEffect(() => { fetchGrants(); }, [fetchGrants]);

  const updateGrant = useCallback(async (id: string, data: Partial<Grant>): Promise<{ success: boolean; grant?: Grant }> => {
    const res = await authFetch(`/api/grants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    console.log("[updateGrant] status:", res.status, "result:", result);
    if (result.success) {
      setGrants((prev) => prev.map((g) => g.id === id ? { ...g, ...result.grant } : g));
    }
    return result;
  }, []);

  const deleteGrant = useCallback(async (id: string) => {
    const res = await authFetch(`/api/grants/${id}`, { method: "DELETE" });
    const result = await res.json();
    if (result.success) {
      setGrants((prev) => prev.filter((g) => g.id !== id));
    }
    return result;
  }, []);

  const addGrant = useCallback((grant: Grant) => {
    setGrants((prev) => [grant, ...prev]);
  }, []);

  return { grants, loading, refreshing, error, companyDNA, fetchGrants, updateGrant, deleteGrant, addGrant };
}
