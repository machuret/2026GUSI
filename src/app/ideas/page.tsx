"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lightbulb, Sparkles, Loader2, Check,
  RefreshCw, ChevronDown, ChevronUp, ThumbsDown,
} from "lucide-react";
import { useIdeas, type ContentType, type IdeaStyle, type Idea } from "@/hooks/useIdeas";
import { IdeaRow, ContentTypeBadge, CategoryBadge, StyleBadge } from "./components/IdeaRow";
import { CONTENT_TYPES, IDEA_CATEGORIES, IDEA_STYLES, CONTENT_TYPE_TO_CATEGORY } from "./constants";

export default function IdeasPage() {
  const router = useRouter();
  const h = useIdeas();

  // Feedback modal state (local UI)
  const [feedbackModal, setFeedbackModal] = useState<{ id: string; title: string } | null>(null);
  const [feedbackText, setFeedbackText]   = useState("");
  const [showLibrary, setShowLibrary]     = useState(true);

  // ── Approve & navigate ─────────────────────────────────────────────────────
  const handleApprove = async (idea: Idea) => {
    const result = await h.approve(idea);
    if (!result) return;
    if (idea.contentType === "carousel" || idea.category === "Carousel Topic") {
      router.push(`/carousel?topic=${encodeURIComponent(idea.title)}`);
    } else {
      const category = CONTENT_TYPE_TO_CATEGORY[idea.contentType as ContentType] ?? "blog_post";
      router.push(`/generate?category=${category}&ideaId=${result.contentId}&ideaTitle=${encodeURIComponent(idea.title)}`);
    }
  };

  // ── Rate with feedback modal ───────────────────────────────────────────────
  const handleRate = (idea: Idea, rating: "up" | "down") => {
    if (rating === "down") {
      setFeedbackModal({ id: idea.id, title: idea.title });
      setFeedbackText("");
      return;
    }
    h.rate(idea.id, "up");
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackModal) return;
    await h.rate(feedbackModal.id, "down", feedbackText);
    setFeedbackModal(null);
    setFeedbackText("");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">

      {/* Feedback modal */}
      {feedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-base font-semibold text-gray-900">Why did you reject this idea?</h3>
            <p className="mb-3 text-xs text-gray-500 line-clamp-2">&ldquo;{feedbackModal.title}&rdquo;</p>
            <textarea autoFocus rows={3} value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="e.g. Too generic, not relevant to our audience, wrong tone..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            <p className="mt-1.5 text-xs text-gray-400">This feedback will be saved as a lesson to improve future idea generation.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={handleFeedbackSubmit} disabled={!feedbackText.trim() || h.actionId === feedbackModal.id}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {h.actionId === feedbackModal.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsDown className="h-3.5 w-3.5" />}
                Submit Feedback
              </button>
              <button onClick={() => { setFeedbackModal(null); setFeedbackText(""); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Lightbulb className="h-8 w-8 text-brand-500" /> Ideas
        </h1>
        <p className="mt-1 text-gray-500">Generate content ideas, save the ones you like, then approve to open them in the Content Generator.</p>
      </div>

      {/* Generator panel */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gray-800">Generate Ideas</h2>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-600">Content Types</p>
          <div className="flex flex-wrap gap-2">
            {CONTENT_TYPES.map(({ key, label, icon: Icon, color }) => {
              const active = h.selectedTypes.includes(key);
              return (
                <button key={key} onClick={() => h.toggleType(key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${active ? color : "border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300 hover:text-gray-600"}`}>
                  <Icon className="h-4 w-4" />{label}{active && <Check className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-600">Categories</p>
          <div className="flex flex-wrap gap-2">
            {IDEA_CATEGORIES.map(({ key, label, icon: Icon, color }) => {
              const active = h.selectedCategories.includes(key);
              return (
                <button key={key} onClick={() => h.toggleCategory(key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${active ? color : "border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300 hover:text-gray-600"}`}>
                  <Icon className="h-4 w-4" />{label}{active && <Check className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-600">Style / Tone</p>
          <div className="flex flex-wrap gap-2">
            {IDEA_STYLES.map(({ key, label, icon: Icon, color }) => {
              const active = h.selectedStyles.includes(key);
              return (
                <button key={key} onClick={() => h.toggleStyle(key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${active ? color : "border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300 hover:text-gray-600"}`}>
                  <Icon className="h-4 w-4" />{label}{active && <Check className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-600">Ideas to generate:</label>
            <div className="flex items-center gap-1">
              {[3, 6, 9, 12].map((n) => (
                <button key={n} onClick={() => h.setCount(n)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${h.count === n ? "border-brand-500 bg-brand-600 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-brand-300"}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button onClick={h.handleGenerate} disabled={h.generating}
            className="ml-auto flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {h.generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {h.generating ? "Generating ideas…" : "Generate Ideas"}
          </button>
        </div>

        {h.genError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{h.genError}</div>
        )}
      </div>

      {/* Fresh ideas */}
      {h.freshIdeas.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              Fresh Ideas <span className="text-sm font-normal text-gray-400">({h.freshIdeas.length})</span>
            </h2>
            <button onClick={h.handleGenerate} disabled={h.generating}
              className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-800 disabled:opacity-50">
              <RefreshCw className="h-3.5 w-3.5" /> Regenerate
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {h.freshIdeas.map((idea, idx) => {
              const isSaved  = h.savedFreshIdx.has(idx);
              const isSaving = h.actionId === `fresh-${idx}`;
              return (
                <div key={idx} className={`flex flex-col rounded-2xl border bg-white p-4 transition-all ${isSaved ? "border-green-200 bg-green-50" : "border-gray-200 hover:border-brand-200 hover:shadow-sm"}`}>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <ContentTypeBadge type={idea.contentType as ContentType} />
                    <CategoryBadge cat={idea.category as any} />
                    {idea.style && <StyleBadge style={idea.style as IdeaStyle} />}
                  </div>
                  <p className="mb-1 text-sm font-semibold text-gray-900 leading-snug">{idea.title}</p>
                  <p className="flex-1 text-xs text-gray-500 leading-relaxed">{idea.summary}</p>
                  <button onClick={() => h.saveFresh(idx)} disabled={isSaved || isSaving}
                    className={`mt-3 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${isSaved ? "border-green-300 bg-green-100 text-green-700" : "border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100"}`}>
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isSaved ? <><Check className="h-3.5 w-3.5" /> Saved</> : "Save Idea"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Saved library */}
      <div>
        <button onClick={() => setShowLibrary((v) => !v)}
          className="mb-3 flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-3 text-left hover:bg-gray-50">
          <span className="text-base font-semibold text-gray-800">
            Saved Ideas
            {!h.loadingLibrary && <span className="ml-2 text-sm font-normal text-gray-400">({h.activeIdeas.length})</span>}
          </span>
          {showLibrary ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </button>

        {showLibrary && (
          <>
            {h.loadingLibrary ? (
              <div className="py-12 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-gray-300" /></div>
            ) : h.libError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{h.libError}</div>
            ) : h.activeIdeas.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
                <Lightbulb className="mx-auto h-10 w-10 text-gray-200 mb-3" />
                <p className="font-semibold text-gray-400">No saved ideas yet</p>
                <p className="mt-1 text-sm text-gray-400">Generate ideas above and click Save to keep them here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {h.activeIdeas.map((idea) => (
                  <IdeaRow key={idea.id} idea={idea} busy={h.actionId === idea.id}
                    onApprove={() => handleApprove(idea)} onArchive={() => h.archive(idea.id)}
                    onDelete={() => h.deleteIdea(idea.id)} onRate={(r) => handleRate(idea, r)} />
                ))}
              </div>
            )}

            {h.archivedIdeas.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-600 select-none">
                  {h.archivedIdeas.length} archived idea{h.archivedIdeas.length !== 1 ? "s" : ""}
                </summary>
                <div className="mt-2 space-y-2 opacity-60">
                  {h.archivedIdeas.map((idea) => (
                    <IdeaRow key={idea.id} idea={idea} busy={h.actionId === idea.id}
                      onApprove={() => handleApprove(idea)} onArchive={() => h.archive(idea.id)}
                      onDelete={() => h.deleteIdea(idea.id)} onRate={(r) => handleRate(idea, r)} />
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
