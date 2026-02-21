"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Key, CheckCircle2, XCircle, Loader2, RefreshCw,
  ExternalLink, AlertTriangle, Zap,
} from "lucide-react";

type ServiceStatus = "idle" | "testing" | "ok" | "error";

interface ServiceResult {
  ok: boolean;
  latencyMs?: number;
  detail?: string;
  error?: string;
}

interface Service {
  id: string;
  label: string;
  description: string;
  envVar: string;
  docsUrl: string;
  where: string;
}

const SERVICES: Service[] = [
  {
    id: "openai",
    label: "OpenAI",
    description: "Powers all AI content generation, translations, voice analysis, and grant writing.",
    envVar: "OPENAI_API_KEY",
    docsUrl: "https://platform.openai.com/api-keys",
    where: "Vercel → Project → Settings → Environment Variables",
  },
  {
    id: "apify",
    label: "Apify",
    description: "Powers lead scraping and enrichment from LinkedIn, Google Maps, and other sources.",
    envVar: "APIFY_API_TOKEN",
    docsUrl: "https://console.apify.com/account/integrations",
    where: "Vercel → Project → Settings → Environment Variables",
  },
  {
    id: "mailchimp",
    label: "Mailchimp",
    description: "Syncs approved content and newsletters to your Mailchimp audience.",
    envVar: "Stored in database",
    docsUrl: "https://mailchimp.com/help/about-api-keys/",
    where: "Settings → Mailchimp (connect from the Mailchimp page)",
  },
  {
    id: "supabase",
    label: "Supabase",
    description: "The primary database and authentication provider for the entire platform.",
    envVar: "SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL",
    docsUrl: "https://supabase.com/dashboard/project/_/settings/api",
    where: "Vercel → Project → Settings → Environment Variables",
  },
];

export default function ApiKeysPage() {
  const [statuses, setStatuses]   = useState<Record<string, ServiceStatus>>({});
  const [results, setResults]     = useState<Record<string, ServiceResult>>({});
  const [testingAll, setTestingAll] = useState(false);

  const testService = useCallback(async (id: string) => {
    setStatuses((prev) => ({ ...prev, [id]: "testing" }));
    try {
      const res = await fetch(`/api/settings/api-test?service=${id}`);
      const data = await res.json();
      const result: ServiceResult = data.results?.[id] ?? { ok: false, error: "No response" };
      setResults((prev) => ({ ...prev, [id]: result }));
      setStatuses((prev) => ({ ...prev, [id]: result.ok ? "ok" : "error" }));
    } catch {
      setResults((prev) => ({ ...prev, [id]: { ok: false, error: "Request failed" } }));
      setStatuses((prev) => ({ ...prev, [id]: "error" }));
    }
  }, []);

  const testAll = useCallback(async () => {
    setTestingAll(true);
    const all: Record<string, ServiceStatus> = {};
    SERVICES.forEach((s) => { all[s.id] = "testing"; });
    setStatuses(all);
    try {
      const res = await fetch("/api/settings/api-test?service=all");
      const data = await res.json();
      const newStatuses: Record<string, ServiceStatus> = {};
      const newResults: Record<string, ServiceResult> = {};
      SERVICES.forEach((s) => {
        const r: ServiceResult = data.results?.[s.id] ?? { ok: false, error: "No response" };
        newResults[s.id] = r;
        newStatuses[s.id] = r.ok ? "ok" : "error";
      });
      setResults(newResults);
      setStatuses(newStatuses);
    } catch {
      const errStatuses: Record<string, ServiceStatus> = {};
      SERVICES.forEach((s) => { errStatuses[s.id] = "error"; });
      setStatuses(errStatuses);
    } finally {
      setTestingAll(false);
    }
  }, []);

  // Auto-test on load
  useEffect(() => { testAll(); }, [testAll]);

  const okCount = SERVICES.filter((s) => statuses[s.id] === "ok").length;
  const errCount = SERVICES.filter((s) => statuses[s.id] === "error").length;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Key className="h-6 w-6 text-brand-600" />
            <h1 className="text-3xl font-bold text-gray-900">API Keys</h1>
          </div>
          <p className="text-gray-500">Monitor and test all external service connections</p>
        </div>
        <button
          onClick={testAll}
          disabled={testingAll}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {testingAll
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Testing all…</>
            : <><RefreshCw className="h-4 w-4" /> Test all</>}
        </button>
      </div>

      {/* Summary bar */}
      {!testingAll && errCount === 0 && okCount === SERVICES.length && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <strong>All systems operational</strong> — {okCount}/{SERVICES.length} services connected
        </div>
      )}
      {!testingAll && errCount > 0 && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <strong>{errCount} service{errCount > 1 ? "s" : ""} need attention</strong> — {okCount}/{SERVICES.length} connected
        </div>
      )}

      {/* Service cards */}
      <div className="space-y-4">
        {SERVICES.map((svc) => {
          const status = statuses[svc.id] ?? "idle";
          const result = results[svc.id];

          return (
            <div key={svc.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              {/* Top bar */}
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-5 py-3">
                <div className="flex items-center gap-3">
                  <StatusIcon status={status} />
                  <div>
                    <p className="font-semibold text-gray-900">{svc.label}</p>
                    {result && (
                      <p className={`text-xs ${result.ok ? "text-green-600" : "text-red-500"}`}>
                        {result.ok
                          ? `${result.detail ?? "Connected"}${result.latencyMs ? ` · ${result.latencyMs}ms` : ""}`
                          : result.error}
                      </p>
                    )}
                    {status === "idle" && <p className="text-xs text-gray-400">Not tested yet</p>}
                    {status === "testing" && <p className="text-xs text-gray-400">Testing…</p>}
                  </div>
                </div>
                <button
                  onClick={() => testService(svc.id)}
                  disabled={status === "testing"}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                >
                  {status === "testing"
                    ? <><Loader2 className="h-3 w-3 animate-spin" /> Testing</>
                    : <><Zap className="h-3 w-3" /> Test</>}
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm text-gray-600">{svc.description}</p>

                <div className="rounded-lg bg-gray-50 px-4 py-3 space-y-1.5">
                  <div className="flex items-start gap-2 text-xs">
                    <span className="font-semibold text-gray-500 w-20 shrink-0">Env var</span>
                    <code className="text-gray-700 font-mono">{svc.envVar}</code>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <span className="font-semibold text-gray-500 w-20 shrink-0">Where</span>
                    <span className="text-gray-600">{svc.where}</span>
                  </div>
                </div>

                <a
                  href={svc.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Get API key / docs
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Vercel note */}
      <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
        <p className="text-sm font-semibold text-blue-900 mb-1">How to update API keys</p>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
          <li>Go to <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline">Vercel Dashboard <ExternalLink className="inline h-3 w-3" /></a></li>
          <li>Select your project → <strong>Settings → Environment Variables</strong></li>
          <li>Update the value and save</li>
          <li>Redeploy the project for changes to take effect</li>
        </ol>
        <p className="mt-2 text-xs text-blue-600">Mailchimp is the exception — it's stored in the database and can be updated from the <strong>Mailchimp</strong> page in the sidebar.</p>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: ServiceStatus }) {
  if (status === "ok")      return <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />;
  if (status === "error")   return <XCircle className="h-5 w-5 text-red-500 shrink-0" />;
  if (status === "testing") return <Loader2 className="h-5 w-5 text-brand-500 animate-spin shrink-0" />;
  return <div className="h-5 w-5 rounded-full border-2 border-gray-300 shrink-0" />;
}
