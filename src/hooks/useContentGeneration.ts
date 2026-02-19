"use client";

import { useCallback, useState } from "react";
import { postJSON } from "@/lib/api";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import type { GeneratedResult, ReviewStatus } from "@/components/generate/OutputReview";

interface GenerateResponse {
  success: boolean;
  generated: { id: string; output: string };
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

  const generate = useCallback(async (cat: string, prompt: string, platform?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await postJSON<GenerateResponse>("/api/content/generate", {
        companyId: DEMO_COMPANY_ID,
        prompt,
        category: cat,
        ...(platform && platform !== "all" ? { extraFields: { platform } } : {}),
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
    await postJSON("/api/content/review", {
      contentId: result.id,
      category: result.category,
      action: "approve",
    });
    setReviewStatus("approved");
  }, [result]);

  const handleReject = useCallback(async (feedback: string) => {
    if (!result) return;
    await postJSON("/api/content/review", {
      contentId: result.id,
      category: result.category,
      action: "reject",
      feedback,
    });
    setReviewStatus("rejected");
  }, [result]);

  const handleRevise = useCallback(async () => {
    if (!result) return;
    const data = await postJSON<ReviseResponse>("/api/content/revise", {
      contentId: result.id,
    });
    if (data.success) {
      setResult({ id: data.revised.id, output: data.revised.output, category: result.category });
      setReviewStatus("idle");
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

  const reset = useCallback(() => {
    setResult(null);
    setReviewStatus("idle");
    setError(null);
  }, []);

  return {
    loading,
    regenerating,
    result,
    reviewStatus,
    error,
    generate,
    handleApprove,
    handleReject,
    handleRevise,
    handleRegenerate,
    reset,
  };
}
