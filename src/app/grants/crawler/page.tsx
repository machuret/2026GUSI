"use client";

import { useState } from "react";
import {
  Globe, Link, Loader2, Plus, ExternalLink, CheckCircle2,
  AlertCircle, RefreshCw, ChevronDown, ChevronUp, BadgeCheck,
  Rss, Search,
} from "lucide-react";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { useGrants } from "@/hooks/useGrants";
import { KNOWN_GRANT_SITES, type GrantSite } from "@/lib/grantSites";

interface CrawledGrant {
  name: string;
  founder: string;
  url: string;
  deadlineDate?: string | null;
  geographicScope?: string;
  amount?: string;
  eligibility?: string;
  howToApply?: string;
  projectDuration?: string;
  submissionEffort?: "Low" | "Medium" | "High";
  confidence?: "High" | "Medium" | "Low";
}


const CONFIDENCE_STYLES: Record<string, string> = {
  High:   "bg-green-100 text-green-700 border-green-300",
  Medium: "bg-yellow-100 text-yellow-700 border-yellow-300",
  Low:    "bg-gray-100 text-gray-500 border-gray-300",
};

const EFFORT_STYLES: Record<string, string> = {
  Low:    "bg-blue-50 text-blue-700",
  Medium: "bg-orange-50 text-orange-700",
  High:   "bg-red-50 text-red-700",
};

function EffortBadge({ value }: { value?: string | null }) {
  if (!value) return null;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${EFFORT_STYLES[value] ?? ""}`}>{value}</span>;
}

export default function GrantCrawlerPage() {
  const { grants, addGrant } = useGrants();
  const existingNames = new Set(grants.map((g) => g.name.toLowerCase()));

  const [customUrl, setCustomUrl] = useState("");
  const [extractionHint, setExtractionHint] = useState("");
  const [crawling, setCrawling] = useState<string | null>(null);
  const [results, setResults] = useState<CrawledGrant[]>([]);
  const [pageTitle, setPageTitle] = useState("");
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [isPartial, setIsPartial] = useState(false);
  const [adding, setAdding] = useState<Record<number, boolean>>({});
  const [added, setAdded] = useState<Record<number, boolean>>({});
  const [addError, setAddError] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const crawl = async (url: string, siteName?: string) => {
    setCrawling(url);
    setCrawlError(null);
    setResults([]);
    setPageTitle("");
    setIsPartial(false);
    setAdded({});
    try {
      const res = await fetch("/api/grants/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, siteName, extractionHint: extractionHint || undefined }),
      });
      const data = await res.json();
      if (data.error) {
        setCrawlError(data.error);
        setIsPartial(data.partial ?? false);
      }
      if (data.grants?.length) {
        setResults(data.grants);
        setPageTitle(data.pageTitle ?? siteName ?? url);
      }
    } catch { setCrawlError("Network error — could not reach the page."); }
    finally { setCrawling(null); }
  };

  const handleAdd = async (grant: CrawledGrant, idx: number) => {
    setAdding((p) => ({ ...p, [idx]: true }));
    setAddError(null);
    try {
      const res = await fetch("/api/grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: DEMO_COMPANY_ID,
          name: grant.name,
          founder: grant.founder,
          url: grant.url,
          deadlineDate: grant.deadlineDate || null,
          geographicScope: grant.geographicScope || null,
          amount: grant.amount || null,
          eligibility: grant.eligibility || null,
          howToApply: grant.howToApply || null,
          projectDuration: grant.projectDuration || null,
          submissionEffort: grant.submissionEffort || null,
          decision: "Maybe",
        }),
      });
      const data = await res.json();
      if (data.success) {
        addGrant(data.grant);
        setAdded((p) => ({ ...p, [idx]: true }));
      } else setAddError(data.error || "Failed to add");
    } catch { setAddError("Network error"); }
    finally { setAdding((p) => ({ ...p, [idx]: false })); }
  };

  const handleAddAll = async () => {
    const toAdd = results
      .map((g, i) => ({ g, i }))
      .filter(({ g, i }) => !added[i] && !existingNames.has(g.name.toLowerCase()));
    for (const { g, i } of toAdd) {
      await handleAdd(g, i);
    }
  };

  const isCrawling = crawling !== null;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100">
            <Rss className="h-5 w-5 text-brand-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Grant Crawler</h1>
        </div>
        <p className="text-gray-500 ml-12">
          Scrape grant listing sites — AI extracts opportunities and adds them to your list
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Site selector + custom URL */}
        <div className="space-y-4">
          {/* Custom URL */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Link className="h-4 w-4 text-brand-500" /> Custom URL
            </h2>
            <input
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://example.com/grants"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <div className="mt-2">
              <label className="mb-1 block text-xs text-gray-500">Extraction hint (optional)</label>
              <input
                value={extractionHint}
                onChange={(e) => setExtractionHint(e.target.value)}
                placeholder="e.g. focus on health grants, ignore news"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <button
              onClick={() => customUrl.trim() && crawl(customUrl.trim())}
              disabled={!customUrl.trim() || isCrawling}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {isCrawling && crawling === customUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Crawl This URL
            </button>
          </div>

          {/* Known sites */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Globe className="h-4 w-4 text-brand-500" /> Known Grant Sites
            </h2>
            <div className="space-y-2">
              {KNOWN_GRANT_SITES.map((site: GrantSite) => (
                <div key={site.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 leading-tight">{site.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{site.description}</p>
                      <span className="mt-1 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-600">{site.region}</span>
                    </div>
                    <button
                      onClick={() => crawl(site.url, site.name)}
                      disabled={isCrawling}
                      title="Crawl this site"
                      className="shrink-0 flex items-center gap-1 rounded-lg border border-brand-200 bg-white px-2 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-40"
                    >
                      {isCrawling && crawling === site.url
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <RefreshCw className="h-3.5 w-3.5" />}
                      Crawl
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-2">
          {/* Status */}
          {isCrawling && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
              <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
              <div>
                <p className="text-sm font-medium text-brand-800">Crawling page…</p>
                <p className="text-xs text-brand-600 mt-0.5 truncate max-w-sm">{crawling}</p>
              </div>
            </div>
          )}

          {crawlError && (
            <div className={`mb-4 rounded-xl border px-4 py-3 ${isPartial ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`}>
              <div className="flex items-start gap-2">
                <AlertCircle className={`mt-0.5 h-4 w-4 shrink-0 ${isPartial ? "text-amber-500" : "text-red-500"}`} />
                <div>
                  <p className={`text-sm font-medium ${isPartial ? "text-amber-800" : "text-red-800"}`}>
                    {isPartial ? "Partial result" : "Crawl failed"}
                  </p>
                  <p className={`text-xs mt-0.5 ${isPartial ? "text-amber-700" : "text-red-700"}`}>{crawlError}</p>
                </div>
              </div>
            </div>
          )}

          {!isCrawling && results.length === 0 && !crawlError && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 py-24 text-center">
              <Rss className="h-10 w-10 text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-400">Select a site or enter a URL to start crawling</p>
              <p className="text-xs text-gray-300 mt-1">AI will extract grant listings from the page</p>
            </div>
          )}

          {results.length > 0 && (
            <div>
              {/* Results header */}
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{results.length} grant{results.length !== 1 ? "s" : ""} found</p>
                  {pageTitle && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{pageTitle}</p>}
                </div>
                <button
                  onClick={handleAddAll}
                  disabled={isCrawling}
                  className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Add All New
                </button>
              </div>

              {addError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{addError}</p>}

              <div className="space-y-2">
                {results.map((grant, idx) => {
                  const alreadyInList = existingNames.has(grant.name.toLowerCase());
                  const isAdded = added[idx] || alreadyInList;
                  const isExpanded = expandedIdx === idx;
                  const confidenceCls = CONFIDENCE_STYLES[grant.confidence ?? "Low"] ?? CONFIDENCE_STYLES.Low;

                  return (
                    <div key={idx} className={`rounded-xl border transition-colors ${isAdded ? "border-green-200 bg-green-50" : "border-gray-200 bg-white"}`}>
                      <div className="flex items-start gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-gray-900">{grant.name}</p>
                            {grant.confidence && (
                              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${confidenceCls}`}>
                                {grant.confidence}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{grant.founder}</p>
                          <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-gray-500">
                            {grant.geographicScope && (
                              <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{grant.geographicScope}</span>
                            )}
                            {grant.amount && <span className="font-medium text-gray-700">{grant.amount}</span>}
                            {grant.deadlineDate && (
                              <span>Deadline: {new Date(grant.deadlineDate).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</span>
                            )}
                            {grant.submissionEffort && <EffortBadge value={grant.submissionEffort} />}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {grant.url && (
                            <a href={grant.url} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:text-brand-700" title="Open URL">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          <button
                            onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                            className="text-gray-400 hover:text-gray-600"
                            title="Show details"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => !isAdded && handleAdd(grant, idx)}
                            disabled={isAdded || adding[idx]}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                              isAdded
                                ? "bg-green-100 text-green-700 cursor-default"
                                : "bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                            }`}
                          >
                            {adding[idx]
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : isAdded
                              ? <BadgeCheck className="h-3.5 w-3.5" />
                              : <Plus className="h-3.5 w-3.5" />}
                            {isAdded ? "Added" : "Add"}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-gray-100 px-4 pb-4 pt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs text-gray-600">
                          {grant.eligibility && (
                            <div>
                              <p className="font-semibold text-gray-400 uppercase tracking-wide mb-1">Eligibility</p>
                              <p className="whitespace-pre-wrap">{grant.eligibility}</p>
                            </div>
                          )}
                          {grant.howToApply && (
                            <div>
                              <p className="font-semibold text-gray-400 uppercase tracking-wide mb-1">How to Apply</p>
                              <p className="whitespace-pre-wrap">{grant.howToApply}</p>
                            </div>
                          )}
                          {grant.projectDuration && (
                            <div>
                              <p className="font-semibold text-gray-400 uppercase tracking-wide mb-1">Project Duration</p>
                              <p>{grant.projectDuration}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
