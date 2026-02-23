"use client";

import { useEffect, useState } from "react";
import { Activity, User } from "lucide-react";
import { authFetch } from "@/lib/authFetch";

interface LogEntry {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  user: { name: string; email: string; role: string };
}

const actionLabels: Record<string, string> = {
  "content.generate": "Generated content",
  "content.ingest": "Ingested content",
  "style.analyze": "Ran style analysis",
  "company.update": "Updated company info",
  "prompt.create": "Created prompt template",
  "prompt.update": "Updated prompt template",
  "prompt.delete": "Deleted prompt template",
  "user.create": "Created a user",
  "user.update": "Updated a user",
};

const actionColors: Record<string, string> = {
  "content.generate": "bg-purple-100 text-purple-700",
  "content.ingest": "bg-blue-100 text-blue-700",
  "style.analyze": "bg-amber-100 text-amber-700",
  "company.update": "bg-green-100 text-green-700",
};

export default function ActivityPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await authFetch("/api/activity");
        if (!res.ok) throw new Error(`Failed to load activity (${res.status})`);
        const data = await res.json();
        setLogs(data.logs || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load activity");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Activity Log</h1>
        <p className="mt-1 text-gray-500">
          Track who used the system and what they did
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-400">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <Activity className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-gray-500">No activity recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-4 rounded-lg border border-gray-200 bg-white px-5 py-3"
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100">
                <User className="h-4 w-4 text-gray-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {log.user.name}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      actionColors[log.action] || "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {actionLabels[log.action] || log.action}
                  </span>
                </div>
                {log.details && (
                  <p className="mt-0.5 text-xs text-gray-500">{log.details}</p>
                )}
                <p className="mt-0.5 text-xs text-gray-400">
                  {new Date(log.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
