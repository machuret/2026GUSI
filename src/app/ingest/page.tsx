"use client";

import { useState, useCallback, useEffect } from "react";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { Upload, AlignLeft, Link2, FileText, Send } from "lucide-react";
import { TrainingDashboard, type TrainingStats } from "./components/TrainingDashboard";
import { ManualPanel, type PostEntry } from "./components/ManualPanel";
import { BulkPanel } from "./components/BulkPanel";
import { UrlPanel } from "./components/UrlPanel";
import { FilePanel } from "./components/FilePanel";

const CID = DEMO_COMPANY_ID;
const emptyPost = (): PostEntry => ({ title: "", body: "", contentType: "blog", platform: "website", tags: "" });

type Mode = "manual" | "bulk" | "url" | "file";

const MODES: { id: Mode; label: string; icon: React.ElementType }[] = [
  { id: "manual", label: "Manual",     icon: AlignLeft },
  { id: "bulk",   label: "Bulk Paste", icon: FileText  },
  { id: "url",    label: "From URL",   icon: Link2     },
  { id: "file",   label: "Upload File",icon: Upload    },
];

export default function IngestPage() {
  const [mode, setMode] = useState<Mode>("manual");

  // Manual
  const [posts, setPosts] = useState<PostEntry[]>([emptyPost()]);

  // Bulk
  const [bulkText, setBulkText] = useState("");
  const [bulkType, setBulkType] = useState("blog");
  const [bulkPlatform, setBulkPlatform] = useState("website");
  const [bulkParsed, setBulkParsed] = useState<PostEntry[]>([]);

  // URL
  const [urlPosts, setUrlPosts] = useState<PostEntry[]>([]);

  // File
  const [filePosts, setFilePosts] = useState<PostEntry[]>([]);

  // Submit
  const [loading, setLoading] = useState(false);
  const [ingestedCount, setIngestedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [analysing, setAnalysing] = useState(false);
  const [showStyle, setShowStyle] = useState(false);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const r = await fetch(`/api/content/training-stats?companyId=${CID}`);
      if (!r.ok) throw new Error(`Failed to load stats (${r.status})`);
      const d = await r.json();
      if (d.success) setStats(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load training stats");
    } finally { setStatsLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const getActive = (): PostEntry[] => {
    if (mode === "manual") return posts.filter((p) => p.body.trim());
    if (mode === "bulk")   return bulkParsed.filter((p) => p.body.trim());
    if (mode === "url")    return urlPosts.filter((p) => p.body.trim());
    if (mode === "file")   return filePosts.filter((p) => p.body.trim());
    return [];
  };

  const handleSubmit = async () => {
    const active = getActive();
    if (!active.length) return;
    setLoading(true); setError(null); setIngestedCount(null);
    try {
      const r = await fetch("/api/content/ingest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: CID,
          posts: active.map((p) => ({ ...p, tags: p.tags.split(",").map((t) => t.trim()).filter(Boolean) })),
        }),
      });
      const d = await r.json();
      if (d.success) {
        setIngestedCount(d.postsCreated);
        if (mode === "manual") setPosts([emptyPost()]);
        if (mode === "bulk")   { setBulkText(""); setBulkParsed([]); }
        if (mode === "url")    setUrlPosts([]);
        if (mode === "file")   setFilePosts([]);
        fetchStats();
      } else setError(d.error || "Ingest failed");
    } catch { setError("Failed to submit."); }
    finally { setLoading(false); }
  };

  const handleAnalyse = async () => {
    setAnalysing(true); setError(null);
    try {
      const r = await fetch("/api/style/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: CID }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || `Style analysis failed (${r.status})`);
      }
      fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Style analysis failed");
    } finally { setAnalysing(false); }
  };

  const parseBulk = useCallback(() => {
    const chunks = bulkText.split(/\n---+\n|\n\n\n+/).map((s) => s.trim()).filter(Boolean);
    setBulkParsed(chunks.map((body) => ({ title: "", body, contentType: bulkType, platform: bulkPlatform, tags: "" })));
  }, [bulkText, bulkType, bulkPlatform]);

  const active = getActive();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Train the AI</h1>
        <p className="mt-1 text-gray-500">Feed the AI your existing content. More examples = better output.</p>
      </div>

      <TrainingDashboard
        stats={stats}
        statsLoading={statsLoading}
        analysing={analysing}
        showStyle={showStyle}
        onToggleStyle={() => setShowStyle((v) => !v)}
        onRefresh={fetchStats}
        onAnalyse={handleAnalyse}
        ingestedCount={ingestedCount}
      />

      {/* Mode tabs */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {MODES.map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              mode === m.id
                ? "border-brand-500 bg-brand-600 text-white"
                : "border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-700"
            }`}>
            <m.icon className="h-4 w-4" /> {m.label}
          </button>
        ))}
      </div>

      {mode === "manual" && (
        <ManualPanel
          posts={posts}
          onAdd={() => setPosts((p) => [...p, emptyPost()])}
          onRemove={(i) => setPosts((p) => p.filter((_, idx) => idx !== i))}
          onUpdate={(i, f, v) => setPosts((p) => { const u = [...p]; u[i] = { ...u[i], [f]: v }; return u; })}
        />
      )}
      {mode === "bulk" && (
        <BulkPanel
          bulkText={bulkText} bulkType={bulkType} bulkPlatform={bulkPlatform} bulkParsed={bulkParsed}
          onBulkTextChange={setBulkText} onBulkTypeChange={setBulkType}
          onBulkPlatformChange={setBulkPlatform} onParse={parseBulk}
        />
      )}
      {mode === "url" && (
        <UrlPanel
          urlPosts={urlPosts}
          onRemove={(i) => setUrlPosts((p) => p.filter((_, idx) => idx !== i))}
          onAdded={(post) => setUrlPosts((p) => [...p, post])}
        />
      )}
      {mode === "file" && (
        <FilePanel
          filePosts={filePosts}
          onRemove={(i) => setFilePosts((p) => p.filter((_, idx) => idx !== i))}
          onAdded={(post) => setFilePosts((p) => [...p, post])}
        />
      )}

      {/* Submit bar */}
      <div className="mt-5 flex items-center gap-3">
        <button onClick={handleSubmit} disabled={loading || active.length === 0}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          <Send className="h-4 w-4" />
          {loading ? "Submitting..." : `Submit ${active.length > 0 ? active.length : ""} Post${active.length !== 1 ? "s" : ""}`}
        </button>
        {active.length > 0 && (
          <span className="text-sm text-gray-500">
            {active.reduce((s, p) => s + p.body.trim().split(/\s+/).length, 0).toLocaleString()} words total
          </span>
        )}
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    </div>
  );
}
