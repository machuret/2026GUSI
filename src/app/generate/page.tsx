"use client";

import { useState } from "react";
import { Shuffle } from "lucide-react";
import { CategoryPicker } from "@/components/generate/CategoryPicker";
import { ContentBrief, type BriefFields } from "@/components/generate/ContentBrief";
import { OutputReview } from "@/components/generate/OutputReview";
import { ABVariants } from "@/components/generate/ABVariants";
import { useContentGeneration } from "@/hooks/useContentGeneration";

export default function GeneratePage() {
  const [category, setCategory] = useState("newsletter");
  const [lastBrief, setLastBrief] = useState<BriefFields | null>(null);
  const [abMode, setAbMode] = useState(false);

  const {
    loading, regenerating, result, reviewStatus, error,
    abVariants,
    generate, generateAB, handleABPick,
    handleApprove, handleReject, handleRevise, handleRegenerate, reset,
  } = useContentGeneration();

  const handleGenerate = (brief: BriefFields) => {
    setLastBrief(brief);
    if (abMode) {
      generateAB(category, brief);
    } else {
      generate(category, brief.topic, brief);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create Content</h1>
          <p className="mt-1 text-gray-500">
            Fill in the brief, review and approve — all in one place
          </p>
        </div>
        <button
          onClick={() => { setAbMode((v) => !v); reset(); }}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            abMode
              ? "border-brand-500 bg-brand-600 text-white"
              : "border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-700"
          }`}
          title="Generate 2 versions and pick the best one"
        >
          <Shuffle className="h-4 w-4" />
          A/B Test
        </button>
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

      {abMode && !abVariants && !loading && (
        <p className="mt-3 text-xs text-brand-600 font-medium">
          A/B mode on — will generate 2 different versions for you to compare
        </p>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {abVariants && (
        <ABVariants
          variantA={abVariants.a}
          variantB={abVariants.b}
          onPick={handleABPick}
          onCreateAnother={reset}
        />
      )}

      {result && !abVariants && (
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
