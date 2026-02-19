"use client";

import { useCallback, useEffect, useState } from "react";
import { DEMO_COMPANY_ID } from "@/lib/constants";

export interface Lead {
  id: string;
  companyId: string;
  source: string;
  sourceActorId?: string | null;
  status: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  industry?: string | null;
  location?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  linkedinUrl?: string | null;
  profileUrl?: string | null;
  website?: string | null;
  specialties?: string[] | null;
  notes?: string | null;
  tags?: string[] | null;
  rating?: number | null;
  rawData?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export const LEAD_STATUSES = ["new", "contacted", "qualified", "proposal", "won", "lost", "archived"] as const;
export type LeadStatus = typeof LEAD_STATUSES[number];

export const STATUS_STYLES: Record<string, string> = {
  new:        "bg-blue-100 text-blue-700 border-blue-200",
  contacted:  "bg-purple-100 text-purple-700 border-purple-200",
  qualified:  "bg-amber-100 text-amber-700 border-amber-200",
  proposal:   "bg-orange-100 text-orange-700 border-orange-200",
  won:        "bg-green-100 text-green-700 border-green-200",
  lost:       "bg-red-100 text-red-600 border-red-200",
  archived:   "bg-gray-100 text-gray-500 border-gray-200",
};

export const SOURCE_STYLES: Record<string, string> = {
  linkedin:  "bg-blue-50 text-blue-700",
  webmd:     "bg-teal-50 text-teal-700",
  doctolib:  "bg-indigo-50 text-indigo-700",
  manual:    "bg-gray-50 text-gray-600",
};

export function useLeads(initialFilters?: { status?: string; source?: string }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialFilters?.status ?? "");
  const [sourceFilter, setSourceFilter] = useState(initialFilters?.source ?? "");

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: DEMO_COMPANY_ID, page: String(page), limit: "50" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (sourceFilter) params.set("source", sourceFilter);

      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setLeads(data.leads ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, sourceFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const updateLead = useCallback(async (id: string, data: Partial<Lead>) => {
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (result.success) {
      setLeads((prev) => prev.map((l) => l.id === id ? { ...l, ...result.lead } : l));
    }
    return result;
  }, []);

  const deleteLead = useCallback(async (id: string) => {
    const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
    const result = await res.json();
    if (result.success) setLeads((prev) => prev.filter((l) => l.id !== id));
    return result;
  }, []);

  const addLeads = useCallback((newLeads: Lead[]) => {
    setLeads((prev) => [...newLeads, ...prev]);
    setTotal((t) => t + newLeads.length);
  }, []);

  return {
    leads, loading, total, page, setPage,
    search, setSearch,
    statusFilter, setStatusFilter,
    sourceFilter, setSourceFilter,
    fetchLeads, updateLead, deleteLead, addLeads,
  };
}
