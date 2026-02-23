"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Upload, Brain, Sparkles, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import type { Author } from "../page";
import { UploadPanel } from "./UploadPanel";
import { StylePanel } from "./StylePanel";
import { GeneratePanel } from "./GeneratePanel";

type Tab = "upload" | "style" | "generate";

interface Props {
  author: Author;
  onBack: () => void;
  onUpdated: (a: Author) => void;
}

export interface StyleProfile {
  id: string;
  tone?: string;
  avgWordCount?: number;
  vocabulary?: string[];
  commonPhrases?: string[];
  sentencePatterns?: string[];
  rhetoricalDevices?: string[];
  openingHooks?: string[];
  closingPatterns?: string[];
  preferredFormats?: string[];
  emotionalRange?: string;
  uniqueQuirks?: string;
  summary?: string;
  systemPrompt?: string;
  tokenCount?: number;
  updatedAt?: string;
}

export interface AuthorPost {
  id: string;
  title?: string | null;
  contentType: string;
  platform: string;
  wordCount: number;
  createdAt: string;
}

export function AuthorDetail({ author, onBack, onUpdated }: Props) {
  const [tab, setTab] = useState<Tab>("upload");
  const [posts, setPosts] = useState<AuthorPost[]>([]);
  const [style, setStyle] = useState<StyleProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysing, setAnalysing] = useState(false);
  const [analyseError, setAnalyseError] = useState<string | null>(null);
  const [analyseOk, setAnalyseOk] = useState(false);
  const [currentAuthor, setCurrentAuthor] = useState<Author>(author);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/voices/${author.id}`);
      const data = await res.json();
      if (res.ok) {
        setPosts(data.posts ?? []);
        setStyle(data.style ?? null);
        setCurrentAuthor(data.author ?? author);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchDetail(); }, [author.id]);

  const handleAnalyse = async () => {
    setAnalysing(true); setAnalyseError(null); setAnalyseOk(false);
    try {
      const res = await authFetch(`/api/voices/${author.id}/analyse`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setAnalyseError(data.error || "Analysis failed"); return; }
      setStyle(data.style);
      setAnalyseOk(true);
      setTab("style");
      await fetchDetail();
    } catch (err) {
      setAnalyseError(err instanceof Error ? err.message : "Analysis failed");
    } finally { setAnalysing(false); }
  };

  const totalWords = posts.reduce((s, p) => s + (p.wordCount ?? 0), 0);
  const isAnalysed = !!currentAuthor.analysedAt;

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "upload",   label: "Upload Content", icon: Upload },
    { id: "style",    label: "Style Profile",  icon: Brain },
    { id: "generate", label: "Generate",       icon: Sparkles },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <button onClick={onBack} className="mb-3 flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600">
          <ArrowLeft className="h-4 w-4" /> All Voices
        </button>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-bold text-2xl shrink-0">
              {currentAuthor.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{currentAuthor.name}</h1>
              {currentAuthor.bio && <p className="text-sm text-gray-500 mt-0.5">{currentAuthor.bio}</p>}
              <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                <span>{posts.length} samples</span>
                <span>·</span>
                <span>{totalWords.toLocaleString()} words</span>
                {style?.tokenCount && <><span>·</span><span>{style.tokenCount.toLocaleString()} tokens used in analysis</span></>}
              </div>
            </div>
          </div>

          {/* Analyse button */}
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={handleAnalyse}
              disabled={analysing || posts.length === 0}
              className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                isAnalysed
                  ? "border border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100"
                  : "bg-brand-600 text-white hover:bg-brand-700"
              }`}
            >
              {analysing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              {analysing ? "Analysing…" : isAnalysed ? "Re-analyse Style" : "Analyse Style"}
            </button>
            {posts.length === 0 && <p className="text-xs text-gray-400">Upload content first</p>}
          </div>
        </div>

        {analyseError && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{analyseError}
          </div>
        )}
        {analyseOk && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Style analysis complete — voice profile updated!
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-2 border-b border-gray-200">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px ${
              tab === t.id
                ? "border-brand-500 text-brand-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            <t.icon className="h-4 w-4" />{t.label}
            {t.id === "upload" && posts.length > 0 && (
              <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-xs text-brand-700">{posts.length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-300" /></div>
      ) : (
        <>
          {tab === "upload" && (
            <UploadPanel authorId={author.id} posts={posts} onUploaded={fetchDetail} onDeleted={fetchDetail} />
          )}
          {tab === "style" && (
            <StylePanel style={style} authorName={currentAuthor.name} onAnalyse={handleAnalyse} analysing={analysing} postCount={posts.length} />
          )}
          {tab === "generate" && (
            <GeneratePanel authorId={author.id} authorName={currentAuthor.name} style={style} />
          )}
        </>
      )}
    </div>
  );
}
