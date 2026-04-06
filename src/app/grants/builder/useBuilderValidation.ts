"use client";

import { useMemo } from "react";
import type { Grant } from "./types";

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  category: "deadline" | "status" | "contact" | "data" | "verification";
  message: string;
  field?: string;
}

export interface ValidationResult {
  canGenerate: boolean;
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
}

interface UseBuilderValidationOptions {
  grant: Grant | null;
}

export function useBuilderValidation({ grant }: UseBuilderValidationOptions): ValidationResult {
  return useMemo(() => {
    const issues: ValidationIssue[] = [];

    if (!grant) {
      return {
        canGenerate: false,
        issues: [],
        errors: [],
        warnings: [],
        infos: [],
      };
    }

    // ── CRITICAL ERRORS (block generation) ────────────────────────────────

    // 1. Deadline expired
    if (grant.deadlineDate) {
      const deadline = new Date(grant.deadlineDate);
      const now = new Date();
      const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / 86400000);
      
      if (daysUntil < 0) {
        issues.push({
          severity: "error",
          category: "deadline",
          message: `Deadline expired ${Math.abs(daysUntil)} days ago (${deadline.toLocaleDateString("en-AU")})`,
          field: "deadlineDate",
        });
      } else if (daysUntil === 0) {
        issues.push({
          severity: "error",
          category: "deadline",
          message: "Deadline is TODAY - insufficient time to complete application",
          field: "deadlineDate",
        });
      } else if (daysUntil <= 2) {
        issues.push({
          severity: "warning",
          category: "deadline",
          message: `Only ${daysUntil} day${daysUntil === 1 ? "" : "s"} until deadline - very tight timeline`,
          field: "deadlineDate",
        });
      }
    }

    // 2. Grant validation failed
    if (grant.validationStatus === "FAILED") {
      issues.push({
        severity: "error",
        category: "verification",
        message: "Grant failed validation - may not be a real grant opportunity",
        field: "validationStatus",
      });
    }

    // 3. Missing critical data
    if (!grant.founder || grant.founder.trim() === "") {
      issues.push({
        severity: "error",
        category: "data",
        message: "Funder/organization name is missing - cannot address application correctly",
        field: "founder",
      });
    }

    if (!grant.url || grant.url.trim() === "") {
      issues.push({
        severity: "warning",
        category: "data",
        message: "Grant URL is missing - cannot crawl current requirements or funder language",
        field: "url",
      });
    }

    if (!grant.amount || grant.amount.trim() === "") {
      issues.push({
        severity: "warning",
        category: "data",
        message: "Funding amount is missing - budget section will lack specific target",
        field: "amount",
      });
    }

    // ── WARNINGS (allow generation with confirmation) ─────────────────────

    // 4. No AI analysis
    if (!grant.aiScore && !grant.aiVerdict) {
      issues.push({
        severity: "warning",
        category: "data",
        message: "No AI fit analysis - generate brief may lack strategic insights",
      });
    }

    // 5. Decision is "No" or "Rejected"
    if (grant.decision === "No" || grant.decision === "Rejected") {
      issues.push({
        severity: "warning",
        category: "status",
        message: `Decision is "${grant.decision}" - are you sure you want to build this application?`,
        field: "decision",
      });
    }

    // 6. Not in CRM
    if (!grant.crmStatus) {
      issues.push({
        severity: "info",
        category: "status",
        message: "Grant not in CRM - consider adding to CRM pipeline first",
        field: "crmStatus",
      });
    }

    // 7. CRM status is "Lost"
    if (grant.crmStatus === "Lost") {
      issues.push({
        severity: "warning",
        category: "status",
        message: 'CRM status is "Lost" - this opportunity may no longer be viable',
        field: "crmStatus",
      });
    }

    // 8. Missing eligibility info
    if (!grant.eligibility || grant.eligibility.trim() === "") {
      issues.push({
        severity: "info",
        category: "data",
        message: "Eligibility criteria not documented - may miss key requirements",
        field: "eligibility",
      });
    }

    // 9. Missing geographic scope
    if (!grant.geographicScope || grant.geographicScope.trim() === "") {
      issues.push({
        severity: "info",
        category: "data",
        message: "Geographic scope not specified - application may not address location requirements",
        field: "geographicScope",
      });
    }

    // 10. Deadline very soon
    if (grant.deadlineDate) {
      const deadline = new Date(grant.deadlineDate);
      const now = new Date();
      const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / 86400000);
      
      if (daysUntil > 0 && daysUntil <= 7) {
        issues.push({
          severity: "warning",
          category: "deadline",
          message: `Only ${daysUntil} days until deadline - limited time for review and refinement`,
          field: "deadlineDate",
        });
      }
    }

    // ── CATEGORIZE ISSUES ─────────────────────────────────────────────────
    const errors = issues.filter((i) => i.severity === "error");
    const warnings = issues.filter((i) => i.severity === "warning");
    const infos = issues.filter((i) => i.severity === "info");

    // Block generation if there are critical errors
    const canGenerate = errors.length === 0;

    return {
      canGenerate,
      issues,
      errors,
      warnings,
      infos,
    };
  }, [grant]);
}
