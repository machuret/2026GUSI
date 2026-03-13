"use client";

import { useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { VideoCategory } from "../types";

export function useCategories(
  categories: VideoCategory[],
  setCategories: React.Dispatch<React.SetStateAction<VideoCategory[]>>,
  setError: (msg: string) => void,
) {
  const [showAddCat, setShowAddCat] = useState(false);
  const [catForm, setCatForm] = useState({ name: "", description: "", color: "#6366f1" });
  const [catSaving, setCatSaving] = useState(false);
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editCatForm, setEditCatForm] = useState({ name: "", description: "", color: "" });

  const handleAddCategory = async () => {
    if (!catForm.name.trim()) return;
    setCatSaving(true);
    try {
      const res = await authFetch("/api/videos/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(catForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setCategories((prev) => [...prev, data.category]);
      setCatForm({ name: "", description: "", color: "#6366f1" });
      setShowAddCat(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setCatSaving(false); }
  };

  const handleUpdateCategory = async (id: string) => {
    setCatSaving(true);
    try {
      const res = await authFetch(`/api/videos/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editCatForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setCategories((prev) => prev.map((c) => (c.id === id ? data.category : c)));
      setEditCatId(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setCatSaving(false); }
  };

  const handleDeleteCategory = async (id: string, onFilterReset?: () => void, onRefetch?: () => Promise<void>) => {
    if (!confirm("Delete this category? Videos will become uncategorized.")) return;
    try {
      await authFetch(`/api/videos/categories/${id}`, { method: "DELETE" });
      setCategories((prev) => prev.filter((c) => c.id !== id));
      if (onFilterReset) onFilterReset();
      else if (onRefetch) await onRefetch();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  };

  return {
    showAddCat, setShowAddCat,
    catForm, setCatForm,
    catSaving,
    editCatId, setEditCatId,
    editCatForm, setEditCatForm,
    handleAddCategory, handleUpdateCategory, handleDeleteCategory,
  };
}
