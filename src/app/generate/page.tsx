"use client";

import { useState } from "react";
import { CategoryPicker } from "@/components/generate/CategoryPicker";
import { PromptInput } from "@/components/generate/PromptInput";
import { OutputReview } from "@/components/generate/OutputReview";
import { useContentGeneration } from "@/hooks/useContentGeneration";

export default function GeneratePage() {
  const [category, setCategory] = useState("newsletter");
  const [prompt, setPrompt] = useState("");

  const {
    loading, regenerating, result, reviewStatus, error,
    generate, handleApprove, handleReject, handleRevise, handleRegenerate, reset,
  } = useContentGeneration();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create Content</h1>
        <p className="mt-1 text-gray-500">
          Pick a category, describe what you need, review and approve — all in one place
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <CategoryPicker
          selected={category}
          onChange={(key) => { setCategory(key); reset(); }}
        />
        <PromptInput
          category={category}
          prompt={prompt}
          loading={loading}
          onChange={setPrompt}
          onGenerate={(platform) => generate(category, prompt, platform)}
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
          onRegenerate={(feedback, tags) => handleRegenerate(prompt, feedback, tags)}
          onCreateAnother={() => { reset(); setPrompt(""); }}
        />
      )}
    </div>
  );
}
