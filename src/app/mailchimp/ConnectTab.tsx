"use client";

import { useState } from "react";
import { Loader2, CheckCircle, Unlink, RefreshCw, Mail } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import type { MCConnection } from "./types";
import { fmtDate } from "./types";

interface Props {
  connection: MCConnection | null;
  onConnected: (conn: MCConnection) => void;
  onDisconnected: () => void;
  onSync: () => Promise<void>;
  syncing: boolean;
  lastSync: string | null;
}

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export default function ConnectTab({
  connection, onConnected, onDisconnected, onSync, syncing, lastSync,
}: Props) {
  const [apiKey,    setApiKey]    = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [success,   setSuccess]   = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnect = async () => {
    if (!apiKey.trim()) return;
    setLoading(true); setError(null); setSuccess(null);
    try {
      const res  = await authFetch("/api/mailchimp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection failed");
      setSuccess(`Connected to "${data.account.name}" (${data.account.email})`);
      setApiKey("");
      onConnected({
        id: "",
        accountName:  data.account.name,
        accountEmail: data.account.email,
        dataCenter:   data.account.dc,
        connectedAt:  new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Mailchimp? This will remove your API key and all synced data.")) return;
    setDisconnecting(true);
    try {
      await authFetch("/api/mailchimp/connect", { method: "DELETE" });
      onDisconnected();
    } finally {
      setDisconnecting(false);
    }
  };

  if (connection) {
    return (
      <div className="max-w-lg space-y-4">
        <div className="rounded-xl border border-green-200 bg-green-50 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-green-800">Mailchimp Connected</p>
              {connection.accountName && (
                <p className="text-sm text-green-700 mt-0.5">{connection.accountName}</p>
              )}
              {connection.accountEmail && (
                <p className="text-xs text-green-600 mt-0.5">{connection.accountEmail}</p>
              )}
              <p className="text-xs text-green-500 mt-1">
                Data centre: <span className="font-mono">{connection.dataCenter}</span>
                {" · "}Connected {fmtDate(connection.connectedAt)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Sync Data</h3>
          <p className="text-xs text-gray-500">
            Pull your latest audiences and campaigns from Mailchimp into the app.
            {lastSync && ` Last synced: ${fmtDate(lastSync)}`}
          </p>
          <button
            onClick={onSync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? "Syncing…" : "Sync Now"}
          </button>
        </div>

        <div className="rounded-xl border border-red-100 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Disconnect</h3>
          <p className="text-xs text-gray-500 mb-3">
            Removes your API key and all synced audience and campaign data from this app.
          </p>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
            Disconnect Mailchimp
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-5">
      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-yellow-50 p-2">
            <Mail className="h-5 w-5 text-yellow-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Connect Mailchimp</h3>
            <p className="text-xs text-gray-500">Sync audiences, view analytics, and send AI-written campaigns</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-700">Mailchimp API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us6"
            className={inputCls}
          />
          <p className="text-xs text-gray-400">
            Find your API key in Mailchimp → Account → Extras → API Keys.
            The key ends with your data centre (e.g. <span className="font-mono">-us6</span>).
          </p>
        </div>

        {error   && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}
        {success && <p className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">{success}</p>}

        <button
          onClick={handleConnect}
          disabled={loading || !apiKey.trim()}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
          {loading ? "Connecting…" : "Connect & Verify"}
        </button>
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs text-gray-500 space-y-1">
        <p className="font-medium text-gray-700">How to get your API key:</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>Log in to Mailchimp at mailchimp.com</li>
          <li>Click your profile icon → Account &amp; billing</li>
          <li>Go to Extras → API Keys</li>
          <li>Click &quot;Create A Key&quot; and copy the full key</li>
        </ol>
      </div>
    </div>
  );
}
