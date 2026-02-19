"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield, ToggleLeft, ToggleRight, ExternalLink, ChevronDown } from "lucide-react";
import { fetchJSON } from "@/lib/fetchJSON";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ROLES } from "@/lib/auth";

interface AppUser {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
}

const ROLE_STYLES: Record<string, string> = {
  USER:        "bg-blue-100 text-blue-700 border-blue-200",
  EDITOR:      "bg-blue-100 text-blue-700 border-blue-200",
  ADMIN:       "bg-purple-100 text-purple-700 border-purple-200",
  SUPER_ADMIN: "bg-red-100 text-red-700 border-red-200",
};

const ROLE_LABELS: Record<string, string> = {
  USER:        "User",
  EDITOR:      "User",
  ADMIN:       "Admin",
  SUPER_ADMIN: "Super Admin",
};

export default function AdminPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await fetchJSON<{ users: AppUser[] }>("/api/users");
      setUsers(data.users || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);


  const toggleActive = useCallback((user: AppUser) => {
    setUsers((prev) =>
      prev.map((u) => u.id === user.id ? { ...u, active: !u.active } : u)
    );
    fetchJSON(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    }).catch((err: unknown) => {
      setActionError(err instanceof Error ? err.message : "Failed to update user");
      setUsers((prev) =>
        prev.map((u) => u.id === user.id ? { ...u, active: user.active } : u)
      );
    });
  }, []);

  const changeRole = useCallback((user: AppUser, newRole: string) => {
    setUsers((prev) =>
      prev.map((u) => u.id === user.id ? { ...u, role: newRole } : u)
    );
    fetchJSON(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    }).catch((err: unknown) => {
      setActionError(err instanceof Error ? err.message : "Failed to update role");
      setUsers((prev) =>
        prev.map((u) => u.id === user.id ? { ...u, role: user.role } : u)
      );
    });
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      {error && <ErrorBanner message={error} onRetry={fetchUsers} onDismiss={() => setError(null)} className="mb-4" />}
      {actionError && <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} className="mb-4" />}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="mt-1 text-gray-500">Manage editors and administrators</p>
        </div>
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          <ExternalLink className="h-4 w-4" /> Add User
        </button>
      </div>

      {showInstructions && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h3 className="mb-2 font-semibold text-blue-900">How to add a new user</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li>Go to your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">Supabase dashboard <ExternalLink className="inline h-3 w-3" /></a></li>
            <li>Navigate to <strong>Authentication → Users</strong></li>
            <li>Click <strong>Invite user</strong> and enter their email</li>
            <li>They will receive a magic link to set their password</li>
            <li>Their account will appear here automatically on first login</li>
          </ol>
          <p className="mt-3 text-xs text-blue-600">Role and active status can be managed from this page once they have logged in.</p>
        </div>
      )}

      {/* Role legend */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r.value} className={`rounded-xl border p-4 ${r.color.replace("text-", "border-").replace("bg-", "border-").split(" ")[0]} bg-white`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ROLE_STYLES[r.value]}`}>{r.label}</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{r.description}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-400">Loading...</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Joined</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-gray-900">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="relative inline-block">
                      <select
                        value={u.role === "EDITOR" ? "USER" : u.role}
                        onChange={(e) => changeRole(u, e.target.value)}
                        className={`appearance-none rounded-full border pl-3 pr-7 py-1 text-xs font-semibold cursor-pointer focus:outline-none ${ROLE_STYLES[u.role] ?? ROLE_STYLES.USER}`}
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 opacity-60" />
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => toggleActive(u)}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                        u.active
                          ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                          : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                      }`}
                    >
                      {u.active
                        ? <><ToggleRight className="h-3.5 w-3.5" /> Active</>
                        : <><ToggleLeft className="h-3.5 w-3.5" /> Disabled</>}
                    </button>
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-400">
                    {new Date(u.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${ROLE_STYLES[u.role] ?? ROLE_STYLES.USER}`}>
                      <Shield className="h-3 w-3" />{ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400">No users found</div>
          )}
        </div>
      )}
    </div>
  );
}
