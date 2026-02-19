"use client";

import { useCallback, useState } from "react";
import { postJSON } from "@/lib/api";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import type { GeneratedResult, ReviewStatus } from "@/components/generate/OutputReview";
import type { BriefFields } from "@/components/generate/ContentBrief";
import type { ABVariant } from "@/components/generate/ABVariants";

interface GenerateResponse {
  success: boolean;
  generated: { id: string; output: string };
  error?: string;
}

interface ABResponse {
  success: boolean;
  variantA: { id: string; output: string };
  variantB: { id: string; output: string };
  category: string;
  error?: string;
}

interface ReviseResponse {
  success: boolean;
  revised: { id: string; output: string };
}

export function useContentGeneration() {
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [abVariants, setAbVariants] = useState<{ a: ABVariant; b: ABVariant } | null>(null);

  const generate = useCallback(async (cat: string, prompt: string, brief?: BriefFields) => {
    setLoading(true);
    setError(null);
    try {
      const data = await postJSON<GenerateResponse>("/api/content/generate", {
        companyId: DEMO_COMPANY_ID,
        prompt,
        category: cat,
        brief: brief ? {
          audience: brief.audience || undefined,
          goal: brief.goal || undefined,
          cta: brief.cta || undefined,
          keywords: brief.keywords || undefined,
          tone: brief.tone,
          length: brief.length,
          platform: brief.platform || undefined,
        } : undefined,
      });
      if (data.success) {
        setResult({ id: data.generated.id, output: data.generated.output, category: cat });
        setReviewStatus("idle");
      } else {
        setError(data.error ?? "Generation failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleApprove = useCallback(async () => {
    if (!result) return;
    try {
      await postJSON("/api/content/review", {
        contentId: result.id,
        category: result.category,
        action: "approve",
      });
      setReviewStatus("approved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    }
  }, [result]);

  const handleReject = useCallback(async (feedback: string) => {
    if (!result) return;
    try {
      await postJSON("/api/content/review", {
        contentId: result.id,
        category: result.category,
        action: "reject",
        feedback,
      });
      setReviewStatus("rejected");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    }
  }, [result]);

  const handleRevise = useCallback(async () => {
    if (!result) return;
    try {
      const data = await postJSON<ReviseResponse>("/api/content/revise", {
        contentId: result.id,
      });
      if (data.success) {
        setResult({ id: data.revised.id, output: data.revised.output, category: result.category });
        setReviewStatus("idle");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revise failed");
    }
  }, [result]);

  const handleRegenerate = useCallback(async (
    prompt: string,
    feedback: string,
    tags: string[]
  ) => {
    if (!result) return;
    setRegenerating(true);
    try {
      await postJSON("/api/content/review", {
        contentId: result.id,
        category: result.category,
        action: "reject",
        feedback,
      });

      const lessonPayloads = tags.length > 0
        ? tags.map((tag) => postJSON("/api/lessons", {
            feedback,
            contentType: result.category,
            severity: "high",
            source: `regenerate:${tag}`,
          }))
        : [postJSON("/api/lessons", {
            feedback,
            contentType: result.category,
            severity: "medium",
            source: "regenerate",
          })];

      await Promise.all(lessonPayloads);
      await generate(result.category, prompt, undefined);
    } finally {
      setRegenerating(false);
    }
  }, [result, generate]);

  const generateAB = useCallback(async (cat: string, brief: BriefFields) => {
    setLoading(true);
    setError(null);
    setAbVariants(null);
    try {
      const data = await postJSON<ABResponse>("/api/content/generate-ab", {
        companyId: DEMO_COMPANY_ID,
        prompt: brief.topic,
        category: cat,
        brief: {
          audience: brief.audience || undefined,
          goal: brief.goal || undefined,
          cta: brief.cta || undefined,
          keywords: brief.keywords || undefined,
          tone: brief.tone,
          length: brief.length,
          platform: brief.platform || undefined,
        },
      });
      if (data.success) {
        if (!data.variantA || !data.variantB) {
          setError("One A/B variant failed to generate — try again");
        } else {
          setAbVariants({
            a: { id: data.variantA.id, output: data.variantA.output, category: cat },
            b: { id: data.variantB.id, output: data.variantB.output, category: cat },
          });
        }
      } else {
        setError(data.error ?? "A/B generation failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate A/B");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleABPick = useCallback(async (chosen: ABVariant, rejected: ABVariant) => {
    await Promise.all([
      postJSON("/api/content/review", {
        contentId: chosen.id,
        category: chosen.category,
        action: "approve",
      }),
      postJSON("/api/content/review", {
        contentId: rejected.id,
        category: rejected.category,
        action: "reject",
        feedback: "A/B test — other version preferred",
      }),
    ]);
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setReviewStatus("idle");
    setError(null);
    setAbVariants(null);
  }, []);

  return {
    loading,
    regenerating,
    result,
    reviewStatus,
    error,
    abVariants,
    generate,
    generateAB,
    handleABPick,
    handleApprove,
    handleReject,
    handleRevise,
    handleRegenerate,
    reset,
  };
}
