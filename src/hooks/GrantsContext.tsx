"use client";

import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { authFetch, edgeFn } from "@/lib/authFetch";

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
  decisionReason?: string | null;
  decisionAt?: string | null;
  notes?: string | null;
  aiScore?: number | null;
  aiVerdict?: string | null;
  aiRecommendation?: "Apply" | "Maybe" | "No" | null;
  aiAnalysis?: Record<string, unknown> | null;
  aiBrief?: Record<string, unknown> | null;
  aiResearched?: boolean | null;
  matchScore?: number | null;
  complexityScore?: number | null;
  complexityLabel?: "Low" | "Medium" | "High" | "Very High" | null;
  complexityNotes?: string | null;
  crmStatus?: "Researching" | "Pipeline" | "Active" | "Built" | "Improved" | "Submitted" | "Won" | "Lost" | null;
  crmNotes?: string | null;
  validationStatus?: "VALIDATED" | "FAILED" | null;
  validatedAt?: string | null;
  validationResult?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface GrantsContextValue {
  grants: Grant[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  companyDNA: string;
  fetchGrants: () => Promise<void>;
  updateGrant: (id: string, data: Partial<Grant>) => Promise<{ success: boolean; grant?: Grant; error?: string }>;
  deleteGrant: (id: string) => Promise<{ success: boolean; error?: string }>;
  addGrant: (grant: Grant) => void;
  patchGrantsLocal: (ids: string[], data: Partial<Grant>) => void;
  removeGrantsLocal: (ids: string[]) => void;
  /** Optimistic update: applies change immediately, rolls back on API failure */
  optimisticUpdate: (id: string, data: Partial<Grant>) => Promise<{ success: boolean; error?: string }>;
}

const GrantsContext = createContext<GrantsContextValue | null>(null);

export function GrantsProvider({ children }: { children: ReactNode }) {
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
      const res = await authFetch(edgeFn("grant-bootstrap"));
      if (!res.ok) throw new Error(`Failed to load grants (${res.status})`);
      const data = await res.json();

      setGrants(data.grants ?? []);

      const company = data.company;
      const info = data.info;
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

      const gp = data.profile;
      if (gp) {
        const gpParts = [
          gp.orgType         ? `Organisation Type: ${gp.orgType}${gp.orgType2 ? ` / ${gp.orgType2}` : ""}` : null,
          gp.sector          ? `Sector: ${gp.sector}${gp.subSector ? ` / ${gp.subSector}` : ""}` : null,
          gp.location        ? `Location: ${gp.location}, ${gp.country ?? "Australia"}` : null,
          gp.stage           ? `Stage: ${gp.stage}` : null,
          gp.teamSize        ? `Team Size: ${gp.teamSize}` : null,
          gp.annualRevenue   ? `Annual Revenue: ${gp.annualRevenue}` : null,
          gp.missionStatement ? `Mission: ${gp.missionStatement}` : null,
          gp.keyActivities   ? `Key Activities: ${gp.keyActivities}` : null,
          gp.uniqueStrengths ? `Unique Strengths: ${gp.uniqueStrengths}` : null,
          gp.pastGrantsWon   ? `Past Grants Won: ${gp.pastGrantsWon}` : null,
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

  const updateGrant = useCallback(async (id: string, data: Partial<Grant>): Promise<{ success: boolean; grant?: Grant; error?: string }> => {
    try {
      const res = await authFetch(`${edgeFn("grant-crud")}?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        setGrants((prev) => prev.map((g) => g.id === id ? { ...g, ...result.grant } : g));
      } else {
        console.error(`[GrantsContext] updateGrant failed for ${id}:`, result.error ?? res.status);
      }
      return result;
    } catch (err) {
      console.error(`[GrantsContext] updateGrant network error for ${id}:`, err);
      return { success: false, error: "Network error" };
    }
  }, []);

  const optimisticUpdate = useCallback(async (id: string, data: Partial<Grant>): Promise<{ success: boolean; error?: string }> => {
    // Capture snapshot for rollback using functional update to avoid stale closure
    let snapshot: Grant | undefined;
    setGrants((prev) => {
      snapshot = prev.find((g) => g.id === id);
      return prev.map((g) => g.id === id ? { ...g, ...data } : g);
    });
    try {
      const res = await authFetch(`${edgeFn("grant-crud")}?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        setGrants((prev) => prev.map((g) => g.id === id ? { ...g, ...result.grant } : g));
        return { success: true };
      } else {
        if (snapshot) setGrants((prev) => prev.map((g) => g.id === id ? snapshot! : g));
        console.error(`[optimisticUpdate] FAILED for ${id.slice(0,8)}:`, result.error ?? res.status);
        return { success: false, error: result.error ?? "Update failed" };
      }
    } catch (err) {
      if (snapshot) setGrants((prev) => prev.map((g) => g.id === id ? snapshot! : g));
      console.error(`[optimisticUpdate] NETWORK ERROR for ${id.slice(0,8)}:`, err);
      return { success: false, error: "Network error" };
    }
  }, []);

  const deleteGrant = useCallback(async (id: string) => {
    try {
      const res = await authFetch(`${edgeFn("grant-crud")}?id=${id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        setGrants((prev) => prev.filter((g) => g.id !== id));
      }
      return result;
    } catch {
      return { success: false, error: "Network error" };
    }
  }, []);

  const addGrant = useCallback((grant: Grant) => {
    setGrants((prev) => [grant, ...prev]);
  }, []);

  const patchGrantsLocal = useCallback((ids: string[], data: Partial<Grant>) => {
    setGrants((prev) => prev.map((g) => ids.includes(g.id) ? { ...g, ...data } : g));
  }, []);

  const removeGrantsLocal = useCallback((ids: string[]) => {
    setGrants((prev) => prev.filter((g) => !ids.includes(g.id)));
  }, []);

  return (
    <GrantsContext.Provider value={{
      grants, loading, refreshing, error, companyDNA,
      fetchGrants, updateGrant, deleteGrant, addGrant,
      patchGrantsLocal, removeGrantsLocal, optimisticUpdate,
    }}>
      {children}
    </GrantsContext.Provider>
  );
}

/**
 * Consume grants context. Must be used within <GrantsProvider>.
 * Drop-in replacement for the old useGrants() hook.
 */
export function useGrantsContext(): GrantsContextValue {
  const ctx = useContext(GrantsContext);
  if (!ctx) throw new Error("useGrantsContext must be used within <GrantsProvider>");
  return ctx;
}
