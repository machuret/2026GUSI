"use client";

import { useState, useCallback } from "react";
import { authFetch, edgeFn } from "@/lib/authFetch";
import type { Grant, WritingBrief, FunderRequirements } from "./types";

interface Options {
  selectedGrantId: string;
  grants: Grant[];
}

export function useBuilderBrief({ selectedGrantId, grants }: Options) {
  const [brief,               setBrief]               = useState<WritingBrief | null>(null);
  const [briefLoading,        setBriefLoading]        = useState(false);
  const [briefError,          setBriefError]          = useState<string | null>(null);
  const [briefExpanded,       setBriefExpanded]       = useState(true);
  const [requirements,        setRequirements]        = useState<FunderRequirements | null>(null);
  const [requirementsLoading, setRequirementsLoading] = useState(false);
  const [checkedCriteria,     setCheckedCriteria]     = useState<Set<string>>(new Set());

  const fetchRequirements = useCallback(async (grantId: string) => {
    setRequirementsLoading(true);
    try {
      const grant = grants.find((g) => g.id === grantId);
      const stored = (grant as Record<string, unknown>)?.aiRequirements as FunderRequirements | null;
      if (stored && Array.isArray(stored.criteria) && stored.criteria.length > 0) {
        setRequirements(stored);
        setCheckedCriteria(new Set());
        return;
      }
      const res  = await authFetch(edgeFn("grant-write"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantId, mode: "requirements" }),
      });
      const data = await res.json();
      if (data.requirements) {
        setRequirements(data.requirements);
        setCheckedCriteria(new Set());
      }
    } catch { /* requirements are optional */ }
    finally { setRequirementsLoading(false); }
  }, [grants]);

  const runBrief = useCallback(async () => {
    if (!selectedGrantId) return;
    setBriefLoading(true);
    setBriefError(null);
    setBrief(null);
    try {
      const grant = grants.find((g) => g.id === selectedGrantId);
      if (grant?.aiBrief && typeof grant.aiBrief === "object") {
        setBrief(grant.aiBrief as unknown as WritingBrief);
        setBriefExpanded(true);
        setBriefLoading(false);
        fetchRequirements(selectedGrantId);
        return;
      }
      const res  = await authFetch(edgeFn("grant-write"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantId: selectedGrantId, mode: "brief" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Brief failed");
      setBrief(data.brief);
      setBriefExpanded(true);
      fetchRequirements(selectedGrantId);
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : "Brief failed");
    } finally {
      setBriefLoading(false);
    }
  }, [selectedGrantId, grants, fetchRequirements]);

  const clearBriefError = useCallback(() => setBriefError(null), []);

  return {
    brief, setBrief,
    briefLoading, briefError, clearBriefError,
    briefExpanded, setBriefExpanded,
    requirements,
    requirementsLoading,
    checkedCriteria, setCheckedCriteria,
    runBrief, fetchRequirements,
  };
}
