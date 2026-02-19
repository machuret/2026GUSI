"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield, ToggleLeft, ToggleRight, ExternalLink } from "lucide-react";
import { fetchJSON } from "@/lib/fetchJSON";
import { ErrorBanner } from "@/components/ErrorBanner";

interface AppUser {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
}

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

  const toggleRole = useCallback((user: AppUser) => {
    const newRole = user.role === "SUPER_ADMIN" ? "EDITOR" : "SUPER_ADMIN";
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

      {loading ? (
        <div className="py-12 text-center text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">{u.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.role === "SUPER_ADMIN" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                    {u.role === "SUPER_ADMIN" ? "Super Admin" : "Editor"}
                  </span>
                  {!u.active && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Disabled</span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleRole(u)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  title="Toggle role"
                >
                  <Shield className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => toggleActive(u)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  title="Toggle active"
                >
                  {u.active ? <ToggleRight className="h-3.5 w-3.5 text-green-600" /> : <ToggleLeft className="h-3.5 w-3.5 text-red-400" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
