"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Users, BarChart2, PenLine, Link2 } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import type { MCConnection, MCAudience, MCCampaign } from "./types";
import ConnectTab from "./ConnectTab";
import AudiencesTab from "./AudiencesTab";
import CampaignsTab from "./CampaignsTab";
import ComposeTab from "./ComposeTab";

type Tab = "connect" | "audiences" | "campaigns" | "compose";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "connect",   label: "Connect",   icon: Link2    },
  { id: "audiences", label: "Audiences", icon: Users    },
  { id: "campaigns", label: "Campaigns", icon: BarChart2 },
  { id: "compose",   label: "Compose",   icon: PenLine  },
];

export default function MailchimpPage() {
  const [activeTab,   setActiveTab]   = useState<Tab>("connect");
  const [connection,  setConnection]  = useState<MCConnection | null>(null);
  const [audiences,   setAudiences]   = useState<MCAudience[]>([]);
  const [campaigns,   setCampaigns]   = useState<MCCampaign[]>([]);
  const [syncing,     setSyncing]     = useState(false);
  const [syncError,   setSyncError]   = useState<string | null>(null);
  const [syncResult,  setSyncResult]  = useState<{ audiences: number; campaigns: number } | null>(null);
  const [lastSync,    setLastSync]    = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);

  // ── Load connection + cached data ─────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      authFetch("/api/mailchimp/connect").then((r) => r.json()),
      authFetch("/api/mailchimp/audiences").then((r) => r.json()),
      authFetch("/api/mailchimp/campaigns").then((r) => r.json()),
    ])
      .then(([connData, audData, campData]) => {
        setConnection(connData.connection ?? null);
        setAudiences(audData.audiences ?? []);
        setCampaigns(campData.campaigns ?? []);
        if (audData.audiences?.length > 0) {
          setLastSync(audData.audiences[0]?.syncedAt ?? null);
        }
        if (connData.connection) setActiveTab("audiences");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Sync ──────────────────────────────────────────────────────────────────
  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const res  = await authFetch("/api/mailchimp/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");

      const [audRes, campRes] = await Promise.all([
        authFetch("/api/mailchimp/audiences").then((r) => r.json()),
        authFetch("/api/mailchimp/campaigns").then((r) => r.json()),
      ]);
      setAudiences(audRes.audiences ?? []);
      setCampaigns(campRes.campaigns ?? []);
      setLastSync(new Date().toISOString());
      setSyncResult({ audiences: data.audiences ?? 0, campaigns: data.campaigns ?? 0 });
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }, []);

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="h-7 w-7 text-yellow-500" /> Mailchimp
          </h1>
          <p className="mt-1 text-gray-500">
            Sync audiences, view campaign analytics, and send AI-written email campaigns
          </p>
        </div>
        {connection && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Connected — {connection.accountName ?? connection.accountEmail}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          const disabled = !connection && t.id !== "connect";
          return (
            <button
              key={t.id}
              onClick={() => !disabled && setActiveTab(t.id)}
              disabled={disabled}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                isActive
                  ? "border-brand-600 text-brand-600"
                  : disabled
                  ? "border-transparent text-gray-300 cursor-not-allowed"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              {t.id === "audiences" && audiences.length > 0 && (
                <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                  {audiences.length}
                </span>
              )}
              {t.id === "campaigns" && campaigns.length > 0 && (
                <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                  {campaigns.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sync feedback */}
      {syncError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="font-semibold">Sync failed:</span> {syncError}
        </div>
      )}
      {syncResult && !syncError && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Synced <span className="font-semibold">{syncResult.audiences} audience{syncResult.audiences !== 1 ? "s" : ""}</span> and <span className="font-semibold">{syncResult.campaigns} campaign{syncResult.campaigns !== 1 ? "s" : ""}</span> from Mailchimp.
        </div>
      )}

      {/* Tab content */}
      {loading ? (
        <div className="py-24 text-center text-sm text-gray-400">Loading…</div>
      ) : (
        <>
          {activeTab === "connect" && (
            <ConnectTab
              connection={connection}
              onConnected={(conn) => { setConnection(conn); setActiveTab("audiences"); }}
              onDisconnected={() => { setConnection(null); setAudiences([]); setCampaigns([]); }}
              onSync={handleSync}
              syncing={syncing}
              lastSync={lastSync}
            />
          )}
          {activeTab === "audiences" && (
            <AudiencesTab
              audiences={audiences}
              onSync={handleSync}
              syncing={syncing}
            />
          )}
          {activeTab === "campaigns" && (
            <CampaignsTab
              campaigns={campaigns}
              audiences={audiences}
              onSync={handleSync}
              syncing={syncing}
            />
          )}
          {activeTab === "compose" && (
            <ComposeTab
              audiences={audiences}
              connected={!!connection}
            />
          )}
        </>
      )}
    </div>
  );
}
