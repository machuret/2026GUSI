"use client";

import { useState } from "react";
import {
  Search, Loader2, X, Plus, ExternalLink, Globe, Calendar, AlertTriangle,
  ChevronDown, ChevronUp, CheckCircle2, ShieldAlert, BadgeCheck, PlusCircle,
  RefreshCw, EyeOff, Eye,
} from "lucide-react";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { authFetch } from "@/lib/authFetch";
import type { Grant } from "@/hooks/useGrants";
import {
  type SearchResult,
  GEO_SCOPES, ORG_TYPES, FUNDING_SIZES, DEADLINE_URGENCIES,
  ELIGIBILITY_TYPES, GRANT_TYPES, APPLICANT_COUNTRIES,
  CONFIDENCE_STYLES, inputCls, labelCls,
} from "./grantTypes";
import { EffortBadge } from "./GrantBadges";
import { fuzzyMatchesExisting } from "@/lib/fuzzyMatch";

interface Props {
  onClose: () => void;
  onAdded: (g: Grant) => void;
  companyDNA: string;
  existingNames: Set<string>;
}

export function GrantSearchModal({ onClose, onAdded, companyDNA, existingNames }: Props) {
  const [query, setQuery] = useState("");
  const [geographicScope, setGeographicScope] = useState("");
  const [applicantCountry, setApplicantCountry] = useState("");
  const [orgType, setOrgType] = useState("");
  const [fundingSize, setFundingSize] = useState("");
  const [deadlineUrgency, setDeadlineUrgency] = useState("");
  const [eligibilityType, setEligibilityType] = useState("");
  const [grantType, setGrantType] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searching, setSearching] = useState(false);
  const [extending, setExtending] = useState(false);
  const [searchPhase, setSearchPhase] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<Record<number, boolean>>({});
  const [added, setAdded] = useState<Record<number, boolean>>({});
  const [addingAll, setAddingAll] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);

  const activeFilterCount = [geographicScope, applicantCountry, orgType, fundingSize, deadlineUrgency, eligibilityType, grantType].filter(Boolean).length;

  const runSearch = async (isExtend = false) => {
    if (!query.trim() && !grantType && !orgType && !geographicScope) {
      setError("Enter a keyword, grant type, org type, or region to search");
      return;
    }
    if (isExtend) setExtending(true);
    else { setSearching(true); setResults([]); setAdded({}); setAdding({}); }
    setError(null);
    setSearchPhase(isExtend ? "Searching for additional grants…" : "Asking AI to find matching grants…");
    try {
      const excludeNames = isExtend
        ? [...Array.from(existingNames), ...results.map((r) => r.name)]
        : Array.from(existingNames);
      const res = await authFetch("/api/grants/search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: isExtend ? `${query} find less common programs not already listed` : (query || undefined),
          geographicScope: geographicScope || undefined,
          applicantCountry: applicantCountry || undefined,
          orgType: orgType || undefined,
          fundingSize: fundingSize || undefined,
          deadlineUrgency: deadlineUrgency || undefined,
          eligibilityType: eligibilityType || undefined,
          grantType: grantType || undefined,
          companyDNA,
          existingNames: excludeNames.slice(0, 300),
        }),
      });
      setSearchPhase("Filtering results…");
      let data: Record<string, unknown>;
      try {
        data = await res.json();
      } catch {
        setError("The search took too long or returned an unexpected response — please try again with fewer filters.");
        return;
      }
      if (data.success) {
        const fresh = (data.results ?? []) as SearchResult[];
        if (isExtend) {
          const existingResultNames = new Set(results.map((r) => r.name.toLowerCase()));
          const brandNew = fresh.filter((r) => !existingResultNames.has(r.name.toLowerCase()));
          if (brandNew.length === 0) { setError("No additional grants found — try adjusting your filters or keywords."); }
          else {
            const merged = [...results, ...brandNew];
            setResults(merged);
            setNewCount(merged.filter((r) => !fuzzyMatchesExisting(r.name, existingNames)).length);
          }
        } else {
          setResults(fresh);
          setNewCount(fresh.filter((r) => !fuzzyMatchesExisting(r.name, existingNames)).length);
        }
      } else setError(data.error || "Search failed");
    } catch (err) { setError(err instanceof Error ? err.message : "Network error"); }
    finally { setSearching(false); setExtending(false); setSearchPhase(""); }
  };

  const handleSearch = () => runSearch(false);
  const handleExtend = () => runSearch(true);

  const doAdd = async (result: SearchResult, idx: number): Promise<boolean> => {
    setAdding((p) => ({ ...p, [idx]: true }));
    try {
      const res = await authFetch("/api/grants", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: DEMO_COMPANY_ID,
          name: result.name, founder: result.founder, url: result.url,
          deadlineDate: result.deadlineDate || null,
          geographicScope: result.geographicScope || null,
          amount: result.amount || null,
          eligibility: result.eligibility || null,
          howToApply: result.howToApply || null,
          projectDuration: result.projectDuration || null,
          submissionEffort: result.submissionEffort || null,
          decision: "Maybe",
          notes: result.fitReason ? `AI search note: ${result.fitReason}` : null,
        }),
      });
      const data = await res.json();
      if (data.success) { onAdded(data.grant); setAdded((p) => ({ ...p, [idx]: true })); return true; }
      else { setError(data.error || "Failed to add"); return false; }
    } catch { setError("Network error"); return false; }
    finally { setAdding((p) => ({ ...p, [idx]: false })); }
  };

  const handleAdd = (result: SearchResult, idx: number) => doAdd(result, idx);

  const handleAddAll = async () => {
    const toAdd = results
      .map((r, idx) => ({ r, idx }))
      .filter(({ r, idx }) => !added[idx] && !fuzzyMatchesExisting(r.name, existingNames));
    if (toAdd.length === 0) return;
    setAddingAll(true); setError(null);
    for (const { r, idx } of toAdd) { await doAdd(r, idx); }
    setAddingAll(false);
  };

  const sel = (value: string, onChange: (v: string) => void, placeholder: string, options: string[]) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Grant Search</h2>
            <p className="text-xs text-gray-400 mt-0.5">AI-powered discovery — the more filters you set, the better the results</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>

        <div className="border-b border-gray-100 px-6 py-4 space-y-3 overflow-y-auto">
          <div>
            <label className={labelCls}>Keywords / Topic</label>
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className={inputCls} placeholder="e.g. women founders, climate tech, digital health…" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className={labelCls}>Grant Type</label>{sel(grantType, setGrantType, "Any grant type", GRANT_TYPES)}</div>
            <div><label className={labelCls}>Our Organisation Type</label>{sel(orgType, setOrgType, "Any org type", ORG_TYPES)}</div>
          </div>

          <button onClick={() => setShowAdvanced(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-800">
            {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Advanced filters
            {activeFilterCount > 0 && (
              <span className="ml-1 rounded-full bg-brand-100 px-1.5 py-0.5 text-xs font-semibold text-brand-700">{activeFilterCount}</span>
            )}
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div><label className={labelCls}>Where the grant funds (scope)</label>{sel(geographicScope, setGeographicScope, "Any region", GEO_SCOPES)}</div>
              <div><label className={labelCls}>Our country (where we are based)</label>{sel(applicantCountry, setApplicantCountry, "Any country", APPLICANT_COUNTRIES)}</div>
              <div><label className={labelCls}>Funding Size</label>{sel(fundingSize, setFundingSize, "Any amount", FUNDING_SIZES)}</div>
              <div><label className={labelCls}>Deadline</label>{sel(deadlineUrgency, setDeadlineUrgency, "Any deadline", DEADLINE_URGENCIES)}</div>
              <div className="sm:col-span-2"><label className={labelCls}>Eligibility</label>{sel(eligibilityType, setEligibilityType, "Any eligibility", ELIGIBILITY_TYPES)}</div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button onClick={handleSearch} disabled={searching}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {searching ? (searchPhase || "Searching…") : "Search Grants"}
            </button>
            {!companyDNA && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5" /> Fill in Company Info for personalised ranking
              </p>
            )}
            {companyDNA && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Company DNA active — results ranked by fit
              </p>
            )}
          </div>
          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {(searching || extending) && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin mb-3 text-brand-400" />
              <p className="text-sm font-medium text-brand-600">{searchPhase || "Searching…"}</p>
              <p className="text-xs text-gray-400 mt-1">This can take 10–20 seconds</p>
            </div>
          )}
          {!searching && !extending && results.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-300">
              <Globe className="h-10 w-10 mb-3" />
              <p className="text-sm text-gray-400">Enter a topic and click Search to discover grants</p>
            </div>
          )}
          {!searching && !extending && results.length > 0 && (() => {
            const resultRows = results.map((r, idx) => ({
              r, idx,
              isDup: !!fuzzyMatchesExisting(r.name, existingNames),
              fuzzyMatch: fuzzyMatchesExisting(r.name, existingNames),
            }));
            const newRows = resultRows.filter((x) => !x.isDup);
            const dupRows = resultRows.filter((x) => x.isDup);
            const pendingAdd = newRows.filter(({ idx }) => !added[idx]).length;
            const visible = showDuplicates ? resultRows : newRows;
            return (
              <div className="space-y-3">
                {/* Summary bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-xs text-gray-600">
                    <span className="font-semibold text-gray-900">{results.length}</span> found
                    {newRows.length > 0 && <span className="ml-1.5 font-semibold text-green-700">{newRows.length} new</span>}
                    {dupRows.length > 0 && <span className="ml-1.5 text-amber-600">{dupRows.length} already in list</span>}
                  </p>
                  <div className="flex items-center gap-2">
                    {dupRows.length > 0 && (
                      <button onClick={() => setShowDuplicates(v => !v)}
                        className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-white">
                        {showDuplicates ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        {showDuplicates ? "Hide duplicates" : "Show duplicates"}
                      </button>
                    )}
                    <button
                      onClick={handleExtend}
                      disabled={extending || searching}
                      className="flex items-center gap-1 rounded-lg border border-brand-200 bg-white px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50">
                      <RefreshCw className="h-3.5 w-3.5" /> Find more
                    </button>
                    {pendingAdd > 0 && (
                      <button
                        onClick={handleAddAll}
                        disabled={addingAll}
                        className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                        {addingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlusCircle className="h-3.5 w-3.5" />}
                        Add all {pendingAdd} new
                      </button>
                    )}
                  </div>
                </div>

                {visible.map(({ r, idx, isDup, fuzzyMatch }) => {
                  const isAdded = added[idx] || isDup;
                  const confidenceCls = CONFIDENCE_STYLES[r.confidence ?? "Low"] ?? CONFIDENCE_STYLES.Low;
                  return (
                    <div key={idx} className={`rounded-xl border p-4 transition-colors ${
                      isDup ? "border-amber-100 bg-amber-50/40 opacity-70" :
                      added[idx] ? "border-green-200 bg-green-50" :
                      "border-gray-200 bg-white hover:border-brand-200"
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <p className="font-semibold text-gray-900 text-sm">{r.name}</p>
                            {isDup && (
                              <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Already in list</span>
                            )}
                            {r.confidence && !isDup && (
                              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${confidenceCls}`}>{r.confidence} confidence</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mb-2">{r.founder}</p>
                          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                            {r.geographicScope && <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{r.geographicScope}</span>}
                            {r.amount && <span className="font-medium text-gray-700">{r.amount}</span>}
                            {r.deadlineDate && (() => {
                              const dl = new Date(r.deadlineDate);
                              const diff = dl.getTime() - Date.now();
                              const days = Math.ceil(diff / 86400000);
                              const fmtd = dl.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
                              if (days < 0) return (
                                <span className="flex items-center gap-1 rounded-full bg-red-100 border border-red-300 px-2 py-0.5 text-red-700 font-semibold">
                                  <AlertTriangle className="h-3 w-3" /> Expired {fmtd}
                                </span>
                              );
                              if (days <= 14) return (
                                <span className="flex items-center gap-1 rounded-full bg-orange-100 border border-orange-300 px-2 py-0.5 text-orange-700 font-semibold">
                                  <Calendar className="h-3 w-3" /> {fmtd} ({days}d left)
                                </span>
                              );
                              return (
                                <span className="flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-green-700 font-medium">
                                  <Calendar className="h-3 w-3" /> {fmtd}
                                </span>
                              );
                            })()}
                            {!r.deadlineDate && (
                              <span className="flex items-center gap-1 text-gray-400 italic">
                                <Calendar className="h-3 w-3" /> No deadline listed
                              </span>
                            )}
                            {r.submissionEffort && <EffortBadge value={r.submissionEffort} />}
                          </div>
                          {r.fitReason && <p className="mt-2 text-xs text-brand-700 bg-brand-50 rounded-lg px-2.5 py-1.5 border border-brand-100">❖ {r.fitReason}</p>}
                          {r.eligibility && <p className="mt-1.5 text-xs text-gray-500 line-clamp-2">{r.eligibility}</p>}
                          {isDup && fuzzyMatch && fuzzyMatch.toLowerCase() !== r.name.toLowerCase() && (
                            <p className="mt-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-2 py-1 border border-amber-200">
                              Similar to: <span className="font-medium">{fuzzyMatch}</span>
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:text-brand-700"><ExternalLink className="h-4 w-4" /></a>}
                          {!isDup && (
                            <button onClick={() => !added[idx] && handleAdd(r, idx)} disabled={!!added[idx] || !!adding[idx]}
                              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${added[idx] ? "bg-green-100 text-green-700 cursor-default" : "bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"}`}>
                              {adding[idx] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : added[idx] ? <BadgeCheck className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                              {added[idx] ? "Added" : "Add to List"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
