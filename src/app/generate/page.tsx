"use client";

import { useState, useEffect } from "react";
import { Shuffle, Lightbulb, Loader2, CheckCircle2 } from "lucide-react";
import { CategoryPicker } from "@/components/generate/CategoryPicker";
import { ContentBrief, type BriefFields } from "@/components/generate/ContentBrief";
import { OutputReview } from "@/components/generate/OutputReview";
import { ABVariants } from "@/components/generate/ABVariants";
import { useContentGeneration } from "@/hooks/useContentGeneration";
import { authFetch } from "@/lib/authFetch";

type SavedIdea = {
  id: string;
  title: string;
  summary: string;
  contentType: string;
  category: string;
  status: string;
};

const CONTENT_TYPE_TO_CATEGORY: Record<string, string> = {
  newsletter:   "newsletter",
  social_media: "social_media",
  blog_post:    "blog_post",
};

export default function GeneratePage() {
  const [category, setCategory] = useState("newsletter");
  const [lastBrief, setLastBrief] = useState<BriefFields | null>(null);
  const [abMode, setAbMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"brief" | "ideas">("brief");
  const [ideas, setIdeas] = useState<SavedIdea[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);

  const {
    loading, regenerating, result, reviewStatus, error,
    abVariants,
    generate, generateAB, handleABPick,
    handleApprove, handleReject, handleRevise, handleRegenerate, reset,
  } = useContentGeneration();

  useEffect(() => {
    if (activeTab !== "ideas") return;
    setIdeasLoading(true);
    authFetch("/api/ideas?status=saved")
      .then((r) => r.json())
      .then((d) => setIdeas(d.ideas ?? []))
      .catch(() => {})
      .finally(() => setIdeasLoading(false));
  }, [activeTab]);

  const handleUseIdea = (idea: SavedIdea) => {
    setSelectedIdeaId(idea.id);
    const cat = CONTENT_TYPE_TO_CATEGORY[idea.contentType] ?? "blog_post";
    setCategory(cat);
    setActiveTab("brief");
    reset();
    // Pre-fill brief topic with idea title after tab switch
    setTimeout(() => {
      const topicInput = document.querySelector<HTMLInputElement>('input[name="topic"], textarea[name="topic"]');
      if (topicInput) { topicInput.value = idea.title; topicInput.dispatchEvent(new Event("input", { bubbles: true })); }
    }, 100);
  };

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

      {/* Tab bar */}
      <div className="mb-4 flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
        {([["brief", "Write Brief"], ["ideas", "Saved Ideas"]] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "ideas" && <Lightbulb className="h-4 w-4" />}
            {label}
          </button>
        ))}
      </div>

      {activeTab === "brief" && (
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
      )}

      {activeTab === "ideas" && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="mb-4 text-sm text-gray-500">Click an idea to use it as your content brief.</p>
          {ideasLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
          ) : ideas.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Lightbulb className="mx-auto mb-2 h-8 w-8 text-gray-200" />
              <p>No saved ideas yet — go to the Ideas page to generate some.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ideas.map((idea) => {
                const isDone = idea.status === "done";
                return (
                  <div
                    key={idea.id}
                    className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-all ${
                      isDone
                        ? "border-purple-200 bg-purple-50 opacity-60"
                        : selectedIdeaId === idea.id
                        ? "border-brand-400 bg-brand-50"
                        : "cursor-pointer border-gray-200 hover:border-brand-300 hover:bg-brand-50/40"
                    }`}
                    onClick={() => !isDone && handleUseIdea(idea)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{idea.title}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{idea.summary}</p>
                    </div>
                    {isDone ? (
                      <span className="flex shrink-0 items-center gap-1 rounded-full border border-purple-300 bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                        <CheckCircle2 className="h-3 w-3" /> Done
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                        Use →
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
