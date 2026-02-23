"use client";

import { useEffect, useState } from "react";
import { Mic2, Plus, Loader2, ChevronRight, Trash2, AlertCircle } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { AuthorCard } from "./components/AuthorCard";
import { AuthorDetail } from "./components/AuthorDetail";

export interface Author {
  id: string;
  name: string;
  bio?: string | null;
  postCount: number;
  wordCount: number;
  analysedAt?: string | null;
  createdAt: string;
  AuthorStyleProfile?: { tone?: string; summary?: string; updatedAt?: string; tokenCount?: number }[] | null;
}

export default function VoicesPage() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Author | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBio, setNewBio] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchAuthors = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/voices");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setAuthors(data.authors ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load authors");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAuthors(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), bio: newBio.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");
      setAuthors((prev) => [data.author, ...prev]);
      setSelected(data.author);
      setCreating(false);
      setNewName(""); setNewBio("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create author");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this author and all their content?")) return;
    try {
      await authFetch(`/api/voices/${id}`, { method: "DELETE" });
      setAuthors((prev) => prev.filter((a) => a.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch { setError("Failed to delete author"); }
  };

  const handleAuthorUpdated = (updated: Author) => {
    setAuthors((prev) => prev.map((a) => a.id === updated.id ? updated : a));
    setSelected(updated);
  };

  if (selected) {
    return (
      <AuthorDetail
        author={selected}
        onBack={() => { setSelected(null); fetchAuthors(); }}
        onUpdated={handleAuthorUpdated}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Mic2 className="h-8 w-8 text-brand-500" /> Voices
          </h1>
          <p className="mt-1 text-gray-500">
            Upload content from any author, analyse their style, then generate new content that sounds exactly like them.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Add Author
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-bold text-gray-900">New Author Voice</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Author Name *</label>
                <input
                  value={newName} onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="e.g. Malcolm Gladwell, Seth Godin…"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Bio / Notes (optional)</label>
                <textarea
                  value={newBio} onChange={(e) => setNewBio(e.target.value)}
                  rows={3}
                  placeholder="Who is this author? What do they write about? Any context helps the AI."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={handleCreate} disabled={saving || !newName.trim()}
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Author
              </button>
              <button onClick={() => { setCreating(false); setNewName(""); setNewBio(""); }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-300" /></div>
      ) : authors.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
          <Mic2 className="mx-auto h-12 w-12 text-gray-200 mb-3" />
          <p className="font-semibold text-gray-400">No author voices yet</p>
          <p className="mt-1 text-sm text-gray-400">Click "Add Author" to create your first voice clone</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {authors.map((author) => (
            <AuthorCard
              key={author.id}
              author={author}
              onSelect={() => setSelected(author)}
              onDelete={() => handleDelete(author.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
