"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { type Translation, type TranslationStatus } from "../types";

export function useTranslations() {
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchTranslations = useCallback(async () => {
    try {
      // Fetch first page with a high limit — covers virtually all real-world libraries
      const res = await authFetch("/api/translations?limit=1000&page=1");
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = await res.json();
      const first: Translation[] = data.translations ?? [];
      const total: number = data.total ?? first.length;

      if (total <= first.length) {
        // All records came back in one shot — common case
        setTranslations(first);
      } else {
        // More than 1000 records: fetch remaining pages in parallel
        const pageCount = Math.ceil(total / 1000);
        const pageNums = Array.from({ length: pageCount - 1 }, (_, i) => i + 2);
        const rest = await Promise.all(
          pageNums.map((pg) =>
            authFetch(`/api/translations?limit=1000&page=${pg}`)
              .then((r) => r.json())
              .then((d) => (d.translations ?? []) as Translation[])
              .catch(() => [] as Translation[])
          )
        );
        setTranslations([...first, ...rest.flat()]);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load translations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTranslations(); }, [fetchTranslations]);

  const saveTranslation = async (payload: {
    title: string;
    originalText: string;
    translatedText: string;
    language: string;
    category: string;
    publishedAt: string;
  }): Promise<Translation | null> => {
    setActionError(null);
    try {
      const res = await authFetch("/api/translations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error || "Save failed"); return null; }
      setTranslations((p) => [data.translation, ...p]);
      return data.translation;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
      return null;
    }
  };

  const handleStatusChange = async (id: string, status: TranslationStatus) => {
    setActionError(null);
    try {
      const res = await authFetch(`/api/translations?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error || "Update failed"); return; }
      setTranslations((p) => p.map((t) => t.id === id ? { ...t, status } : t));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
    }
  };

  const handleSaveEdit = async (id: string, title: string, translatedText: string) => {
    setActionError(null);
    try {
      const res = await authFetch(`/api/translations?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, translatedText }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error || "Update failed"); return; }
      setTranslations((p) => p.map((t) => t.id === id ? data.translation : t));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
    }
  };

  const handleSaveRecheck = async (id: string, feedback: string) => {
    setActionError(null);
    try {
      const res = await authFetch(`/api/translations?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error || "Update failed"); return; }
      setTranslations((p) => p.map((t) => t.id === id ? data.translation : t));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this translation permanently?")) return;
    setTranslations((p) => p.filter((t) => t.id !== id)); // optimistic
    try {
      const res = await authFetch(`/api/translations?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error || "Delete failed");
        fetchTranslations(); // revert optimistic update
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Delete failed");
      fetchTranslations(); // revert optimistic update
    }
  };

  const addTranslation = (t: Translation) => setTranslations((p) => [t, ...p]);

  return {
    translations, loading, error, actionError,
    setError, setActionError,
    fetchTranslations, saveTranslation, addTranslation,
    handleStatusChange, handleSaveEdit, handleSaveRecheck, handleDelete,
  };
}
