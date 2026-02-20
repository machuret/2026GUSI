"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lightbulb, Sparkles, Loader2, BookOpen, Mail, Share2,
  Check, Archive, Trash2, RefreshCw, ChevronDown, ChevronUp,
  GraduationCap, Bell, Trophy, FileText,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";

// ── Types ────────────────────────────────────────────────────────────────────

type ContentType = "newsletter" | "social_media" | "blog_post";
type IdeaCategory = "Education" | "Touching Base" | "Company Win" | "Company Blog Post";
type IdeaStatus = "saved" | "approved" | "archived";

interface Idea {
  id: string;
  title: string;
  summary: string;
  contentType: ContentType;
  category: IdeaCategory;
  status: IdeaStatus;
  contentId?: string | null;
  contentTable?: string | null;
  createdAt: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const CONTENT_TYPES: { key: ContentType; label: string; icon: React.ElementType; color: string }[] = [
  { key: "newsletter",   label: "Newsletter",        icon: Mail,    color: "bg-blue-100 text-blue-700 border-blue-200" },
  { key: "social_media", label: "Social Media",      icon: Share2,  color: "bg-pink-100 text-pink-700 border-pink-200" },
  { key: "blog_post",    label: "Blog Post",         icon: BookOpen, color: "bg-green-100 text-green-700 border-green-200" },
];

const IDEA_CATEGORIES: { key: IdeaCategory; label: string; icon: React.ElementType; color: string }[] = [
  { key: "Education",           label: "Education",           icon: GraduationCap, color: "bg-violet-100 text-violet-700 border-violet-200" },
  { key: "Touching Base",       label: "Touching Base",       icon: Bell,          color: "bg-amber-100 text-amber-700 border-amber-200" },
  { key: "Company Win",         label: "Company Win",         icon: Trophy,        color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { key: "Company Blog Post",   label: "Company Blog Post",   icon: FileText,      color: "bg-sky-100 text-sky-700 border-sky-200" },
];

const CONTENT_TYPE_TO_CATEGORY: Record<ContentType, string> = {
  newsletter:   "newsletter",
  social_media: "social_media",
  blog_post:    "blog_post",
};

// ── Small helpers ────────────────────────────────────────────────────────────

function ContentTypeBadge({ type }: { type: ContentType }) {
  const ct = CONTENT_TYPES.find((c) => c.key === type);
  if (!ct) return null;
  const Icon = ct.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${ct.color}`}>
      <Icon className="h-3 w-3" />{ct.label}
    </span>
  );
}

function CategoryBadge({ cat }: { cat: IdeaCategory }) {
  const c = IDEA_CATEGORIES.find((x) => x.key === cat);
  if (!c) return null;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${c.color}`}>
      <Icon className="h-3 w-3" />{c.label}
    </span>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function IdeasPage() {
  const router = useRouter();

  // Generator state
  const [selectedTypes, setSelectedTypes]       = useState<ContentType[]>(["newsletter", "social_media", "blog_post"]);
  const [selectedCategories, setSelectedCategories] = useState<IdeaCategory[]>(["Education", "Touching Base", "Company Win", "Company Blog Post"]);
  const [count, setCount]                       = useState(6);
  const [generating, setGenerating]             = useState(false);
  const [genError, setGenError]                 = useState<string | null>(null);
  const [freshIdeas, setFreshIdeas]             = useState<Omit<Idea, "id" | "status" | "createdAt">[]>([]);

  // Library state
  const [savedIdeas, setSavedIdeas]             = useState<Idea[]>([]);
  const [loadingLibrary, setLoadingLibrary]     = useState(true);
  const [libError, setLibError]                 = useState<string | null>(null);
  const [showLibrary, setShowLibrary]           = useState(true);

  // Per-idea action state
  const [savingId, setSavingId]                 = useState<string | null>(null); // index for fresh, id for saved
  const [approvingId, setApprovingId]           = useState<string | null>(null);
  const [archivingId, setArchivingId]           = useState<string | null>(null);
  const [deletingId, setDeletingId]             = useState<string | null>(null);
  const [savedFreshIdx, setSavedFreshIdx]       = useState<Set<number>>(new Set());

  // ── Fetch saved ideas ──────────────────────────────────────────────────────
  const fetchLibrary = useCallback(async () => {
    try {
      const res = await authFetch("/api/ideas");
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = await res.json();
      setSavedIdeas(data.ideas ?? []);
      setLibError(null);
    } catch (err) {
      setLibError(err instanceof Error ? err.message : "Failed to load ideas");
    } finally {
      setLoadingLibrary(false);
    }
  }, []);

  useEffect(() => { fetchLibrary(); }, [fetchLibrary]);

  // ── Toggle helpers ─────────────────────────────────────────────────────────
  const toggleType = (key: ContentType) =>
    setSelectedTypes((prev) =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter((k) => k !== key) : prev) : [...prev, key]
    );

  const toggleCategory = (key: IdeaCategory) =>
    setSelectedCategories((prev) =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter((k) => k !== key) : prev) : [...prev, key]
    );

  // ── Generate ───────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    setFreshIdeas([]);
    setSavedFreshIdx(new Set());
    try {
      const res = await authFetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentTypes: selectedTypes, categories: selectedCategories, count }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setFreshIdeas(data.ideas ?? []);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  // ── Save a fresh idea ──────────────────────────────────────────────────────
  const handleSaveFresh = async (idx: number) => {
    const idea = freshIdeas[idx];
    setSavingId(`fresh-${idx}`);
    try {
      const res = await authFetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSavedFreshIdx((prev) => new Set(Array.from(prev).concat(idx)));
      setSavedIdeas((prev) => [data.idea, ...prev]);
    } catch {
      // silently ignore — user can retry
    } finally {
      setSavingId(null);
    }
  };

  // ── Approve a saved idea ───────────────────────────────────────────────────
  const handleApprove = async (idea: Idea) => {
    setApprovingId(idea.id);
    try {
      const res = await authFetch(`/api/ideas/${idea.id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approve failed");
      setSavedIdeas((prev) => prev.map((i) => (i.id === idea.id ? data.idea : i)));
      // Navigate to generate page with the category pre-selected
      const category = CONTENT_TYPE_TO_CATEGORY[idea.contentType as ContentType] ?? "blog_post";
      router.push(`/generate?category=${category}&ideaId=${data.contentId}&ideaTitle=${encodeURIComponent(idea.title)}`);
    } catch {
      // silently ignore
    } finally {
      setApprovingId(null);
    }
  };

  // ── Archive a saved idea ───────────────────────────────────────────────────
  const handleArchive = async (id: string) => {
    setArchivingId(id);
    try {
      const res = await authFetch(`/api/ideas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSavedIdeas((prev) => prev.map((i) => (i.id === id ? data.idea : i)));
    } catch {
      // silently ignore
    } finally {
      setArchivingId(null);
    }
  };

  // ── Delete a saved idea ────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this idea permanently?")) return;
    setSavedIdeas((prev) => prev.filter((i) => i.id !== id)); // optimistic
    setDeletingId(id);
    try {
      await authFetch(`/api/ideas/${id}`, { method: "DELETE" });
    } catch {
      fetchLibrary(); // revert on failure
    } finally {
      setDeletingId(null);
    }
  };

  const activeIdeas   = savedIdeas.filter((i) => i.status !== "archived");
  const archivedIdeas = savedIdeas.filter((i) => i.status === "archived");

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl space-y-8">

      {/* ── Header ── */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Lightbulb className="h-8 w-8 text-brand-500" /> Ideas
        </h1>
        <p className="mt-1 text-gray-500">
          Generate content ideas, save the ones you like, then approve to open them in the Content Generator.
        </p>
      </div>

      {/* ── Generator panel ── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gray-800">Generate Ideas</h2>

        {/* Content type toggles */}
        <div>
          <p className="mb-2 text-sm font-medium text-gray-600">Content Types</p>
          <div className="flex flex-wrap gap-2">
            {CONTENT_TYPES.map(({ key, label, icon: Icon, color }) => {
              const active = selectedTypes.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleType(key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                    active ? color : "border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300 hover:text-gray-600"
                  }`}
                >
                  <Icon className="h-4 w-4" />{label}
                  {active && <Check className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category toggles */}
        <div>
          <p className="mb-2 text-sm font-medium text-gray-600">Categories</p>
          <div className="flex flex-wrap gap-2">
            {IDEA_CATEGORIES.map(({ key, label, icon: Icon, color }) => {
              const active = selectedCategories.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleCategory(key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                    active ? color : "border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300 hover:text-gray-600"
                  }`}
                >
                  <Icon className="h-4 w-4" />{label}
                  {active && <Check className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Count + generate */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-600">Ideas to generate:</label>
            <div className="flex items-center gap-1">
              {[3, 6, 9, 12].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    count === n
                      ? "border-brand-500 bg-brand-600 text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:border-brand-300"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="ml-auto flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Generating ideas…" : "Generate Ideas"}
          </button>
        </div>

        {genError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{genError}</div>
        )}
      </div>

      {/* ── Fresh ideas ── */}
      {freshIdeas.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              Fresh Ideas <span className="text-sm font-normal text-gray-400">({freshIdeas.length})</span>
            </h2>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-800 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Regenerate
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {freshIdeas.map((idea, idx) => {
              const isSaved  = savedFreshIdx.has(idx);
              const isSaving = savingId === `fresh-${idx}`;
              return (
                <div
                  key={idx}
                  className={`flex flex-col rounded-2xl border bg-white p-4 transition-all ${
                    isSaved ? "border-green-200 bg-green-50" : "border-gray-200 hover:border-brand-200 hover:shadow-sm"
                  }`}
                >
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <ContentTypeBadge type={idea.contentType as ContentType} />
                    <CategoryBadge cat={idea.category as IdeaCategory} />
                  </div>
                  <p className="mb-1 text-sm font-semibold text-gray-900 leading-snug">{idea.title}</p>
                  <p className="flex-1 text-xs text-gray-500 leading-relaxed">{idea.summary}</p>

                  <button
                    onClick={() => handleSaveFresh(idx)}
                    disabled={isSaved || isSaving}
                    className={`mt-3 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      isSaved
                        ? "border-green-300 bg-green-100 text-green-700"
                        : "border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100"
                    }`}
                  >
                    {isSaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isSaved ? (
                      <><Check className="h-3.5 w-3.5" /> Saved</>
                    ) : (
                      "Save Idea"
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Saved library ── */}
      <div>
        <button
          onClick={() => setShowLibrary((v) => !v)}
          className="mb-3 flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-3 text-left hover:bg-gray-50"
        >
          <span className="text-base font-semibold text-gray-800">
            Saved Ideas
            {!loadingLibrary && (
              <span className="ml-2 text-sm font-normal text-gray-400">({activeIdeas.length})</span>
            )}
          </span>
          {showLibrary ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </button>

        {showLibrary && (
          <>
            {loadingLibrary ? (
              <div className="py-12 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-gray-300" /></div>
            ) : libError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{libError}</div>
            ) : activeIdeas.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
                <Lightbulb className="mx-auto h-10 w-10 text-gray-200 mb-3" />
                <p className="font-semibold text-gray-400">No saved ideas yet</p>
                <p className="mt-1 text-sm text-gray-400">Generate ideas above and click Save to keep them here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeIdeas.map((idea) => (
                  <IdeaRow
                    key={idea.id}
                    idea={idea}
                    approving={approvingId === idea.id}
                    archiving={archivingId === idea.id}
                    deleting={deletingId === idea.id}
                    onApprove={() => handleApprove(idea)}
                    onArchive={() => handleArchive(idea.id)}
                    onDelete={() => handleDelete(idea.id)}
                  />
                ))}
              </div>
            )}

            {/* Archived section */}
            {archivedIdeas.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-600 select-none">
                  {archivedIdeas.length} archived idea{archivedIdeas.length !== 1 ? "s" : ""}
                </summary>
                <div className="mt-2 space-y-2 opacity-60">
                  {archivedIdeas.map((idea) => (
                    <IdeaRow
                      key={idea.id}
                      idea={idea}
                      approving={false}
                      archiving={false}
                      deleting={deletingId === idea.id}
                      onApprove={() => handleApprove(idea)}
                      onArchive={() => handleArchive(idea.id)}
                      onDelete={() => handleDelete(idea.id)}
                    />
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

// ── IdeaRow component ────────────────────────────────────────────────────────

interface IdeaRowProps {
  idea: Idea;
  approving: boolean;
  archiving: boolean;
  deleting: boolean;
  onApprove: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

function IdeaRow({ idea, approving, archiving, deleting, onApprove, onArchive, onDelete }: IdeaRowProps) {
  const isApproved = idea.status === "approved";

  return (
    <div className={`flex items-start gap-4 rounded-xl border bg-white px-4 py-3.5 transition-all ${
      isApproved ? "border-green-200 bg-green-50" : "border-gray-200 hover:border-brand-200"
    }`}>
      {/* Status dot */}
      <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
        isApproved ? "bg-green-400" : idea.status === "archived" ? "bg-gray-300" : "bg-brand-400"
      }`} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="mb-1 flex flex-wrap gap-1.5">
          <ContentTypeBadge type={idea.contentType as ContentType} />
          <CategoryBadge cat={idea.category as IdeaCategory} />
          {isApproved && (
            <span className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              <Check className="h-3 w-3" /> Approved
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-gray-900 leading-snug">{idea.title}</p>
        <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">{idea.summary}</p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1.5">
        {!isApproved && (
          <button
            onClick={onApprove}
            disabled={approving}
            title="Approve — creates a content draft and opens the generator"
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Approve
          </button>
        )}

        {isApproved && idea.contentId && (
          <button
            onClick={onApprove}
            disabled={approving}
            title="Open in generator"
            className="flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-200 disabled:opacity-50"
          >
            {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Open Draft
          </button>
        )}

        {idea.status !== "archived" && (
          <button
            onClick={onArchive}
            disabled={archiving}
            title="Archive"
            className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:border-gray-300 hover:text-gray-600 disabled:opacity-50"
          >
            {archiving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
          </button>
        )}

        <button
          onClick={onDelete}
          disabled={deleting}
          title="Delete permanently"
          className="rounded-lg border border-gray-200 p-1.5 text-gray-300 hover:border-red-200 hover:text-red-500 disabled:opacity-50"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
