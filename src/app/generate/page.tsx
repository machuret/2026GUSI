"use client";

import { useState } from "react";
import { CategoryPicker } from "@/components/generate/CategoryPicker";
import { ContentBrief, type BriefFields } from "@/components/generate/ContentBrief";
import { OutputReview } from "@/components/generate/OutputReview";
import { useContentGeneration } from "@/hooks/useContentGeneration";

export default function GeneratePage() {
  const [category, setCategory] = useState("newsletter");
  const [lastBrief, setLastBrief] = useState<BriefFields | null>(null);

  const {
    loading, regenerating, result, reviewStatus, error,
    generate, handleApprove, handleReject, handleRevise, handleRegenerate, reset,
  } = useContentGeneration();

  const handleGenerate = (brief: BriefFields) => {
    setLastBrief(brief);
    generate(category, brief.topic, brief);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create Content</h1>
        <p className="mt-1 text-gray-500">
          Fill in the brief, review and approve — all in one place
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <CategoryPicker
          selected={category}
          onChange={(key) => { setCategory(key); reset(); }}
        />
        <ContentBrief
          category={category}
          loading={loading}
          onGenerate={handleGenerate}
        />
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {result && (
        <OutputReview
          result={result}
          reviewStatus={reviewStatus}
          regenerating={regenerating}
          onApprove={handleApprove}
          onReject={handleReject}
          onRevise={handleRevise}
          onRegenerate={(feedback, tags) => handleRegenerate(lastBrief?.topic ?? "", feedback, tags)}
          onCreateAnother={() => { reset(); }}
        />
      )}
    </div>
  );
}
