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
      const res = await authFetch("/api/translations");
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = await res.json();
      setTranslations(data.translations ?? []);
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
    setTranslations((p) => p.filter((t) => t.id !== id));
    try { await authFetch(`/api/translations?id=${id}`, { method: "DELETE" }); }
    catch { fetchTranslations(); }
  };

  const addTranslation = (t: Translation) => setTranslations((p) => [t, ...p]);

  return {
    translations, loading, error, actionError,
    setError, setActionError,
    fetchTranslations, saveTranslation, addTranslation,
    handleStatusChange, handleSaveEdit, handleSaveRecheck, handleDelete,
  };
}
