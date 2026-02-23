"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/authFetch";

// ── Types ────────────────────────────────────────────────────────────────────

export type ContentType = "newsletter" | "social_media" | "blog_post" | "carousel";
export type IdeaCategory = "Education" | "Touching Base" | "Company Win" | "Company Blog Post" | "Carousel Topic";
export type IdeaStatus = "saved" | "approved" | "archived" | "done";
export type IdeaRating = "up" | "down" | null;

export interface Idea {
  id: string;
  title: string;
  summary: string;
  contentType: ContentType;
  category: IdeaCategory;
  status: IdeaStatus;
  contentId?: string | null;
  contentTable?: string | null;
  rating?: IdeaRating;
  ratingFeedback?: string | null;
  createdAt: string;
}

export type FreshIdea = Omit<Idea, "id" | "status" | "createdAt">;

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useIdeas() {
  // Generator state
  const [selectedTypes, setSelectedTypes]       = useState<ContentType[]>(["newsletter", "social_media", "blog_post", "carousel"]);
  const [selectedCategories, setSelectedCategories] = useState<IdeaCategory[]>(["Education", "Touching Base", "Company Win", "Company Blog Post", "Carousel Topic"]);
  const [count, setCount]                       = useState(6);
  const [generating, setGenerating]             = useState(false);
  const [genError, setGenError]                 = useState<string | null>(null);
  const [freshIdeas, setFreshIdeas]             = useState<FreshIdea[]>([]);

  // Library state
  const [savedIdeas, setSavedIdeas]             = useState<Idea[]>([]);
  const [loadingLibrary, setLoadingLibrary]     = useState(true);
  const [libError, setLibError]                 = useState<string | null>(null);

  // Per-idea action state (single ID tracking)
  const [actionId, setActionId]                 = useState<string | null>(null);
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

  const handleGenerate = useCallback(async () => {
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
  }, [selectedTypes, selectedCategories, count]);

  // ── Save a fresh idea ──────────────────────────────────────────────────────

  const saveFresh = useCallback(async (idx: number) => {
    const idea = freshIdeas[idx];
    setActionId(`fresh-${idx}`);
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
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setActionId(null);
    }
  }, [freshIdeas]);

  // ── Approve a saved idea ───────────────────────────────────────────────────

  const approve = useCallback(async (idea: Idea): Promise<{ contentId?: string } | null> => {
    setActionId(idea.id);
    try {
      const res = await authFetch(`/api/ideas/${idea.id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approve failed");
      setSavedIdeas((prev) => prev.map((i) => (i.id === idea.id ? data.idea : i)));
      return { contentId: data.contentId };
    } catch (err) {
      setLibError(err instanceof Error ? err.message : "Approve failed");
      return null;
    } finally {
      setActionId(null);
    }
  }, []);

  // ── Archive ────────────────────────────────────────────────────────────────

  const archive = useCallback(async (id: string) => {
    setActionId(id);
    try {
      const res = await authFetch(`/api/ideas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSavedIdeas((prev) => prev.map((i) => (i.id === id ? data.idea : i)));
    } catch (err) {
      setLibError(err instanceof Error ? err.message : "Archive failed");
    } finally {
      setActionId(null);
    }
  }, []);

  // ── Delete ─────────────────────────────────────────────────────────────────

  const deleteIdea = useCallback(async (id: string) => {
    if (!confirm("Delete this idea permanently?")) return;
    setSavedIdeas((prev) => prev.filter((i) => i.id !== id));
    setActionId(id);
    try {
      await authFetch(`/api/ideas/${id}`, { method: "DELETE" });
    } catch {
      fetchLibrary();
    } finally {
      setActionId(null);
    }
  }, [fetchLibrary]);

  // ── Rate ───────────────────────────────────────────────────────────────────

  const rate = useCallback(async (id: string, rating: "up" | "down", feedback?: string) => {
    setActionId(id);
    try {
      const body: Record<string, unknown> = { rating };
      if (feedback) body.ratingFeedback = feedback;
      const res = await authFetch(`/api/ideas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSavedIdeas((prev) => prev.map((i) => (i.id === id ? data.idea : i)));
    } catch (err) {
      setLibError(err instanceof Error ? err.message : "Rating failed");
    } finally {
      setActionId(null);
    }
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeIdeas   = savedIdeas.filter((i) => i.status !== "archived");
  const archivedIdeas = savedIdeas.filter((i) => i.status === "archived");

  return {
    // Generator
    selectedTypes, toggleType, selectedCategories, toggleCategory,
    count, setCount, generating, genError, freshIdeas,
    handleGenerate, saveFresh, savedFreshIdx, actionId,
    // Library
    savedIdeas, loadingLibrary, libError, activeIdeas, archivedIdeas,
    // Actions
    approve, archive, deleteIdea, rate,
  };
}
