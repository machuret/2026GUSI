"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield, UserPlus, ToggleLeft, ToggleRight } from "lucide-react";

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
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", role: "EDITOR", password: "" });
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error(`Failed to load users (${res.status})`);
      const data = await res.json();
      setUsers(data.users || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = useCallback(async () => {
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setShowForm(false);
        setForm({ email: "", name: "", role: "EDITOR", password: "" });
        fetchUsers();
      } else {
        setActionError(data.error || `Failed to create user (${res.status})`);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }, [form, fetchUsers]);

  const toggleActive = useCallback((user: AppUser) => {
    setUsers((prev) =>
      prev.map((u) => u.id === user.id ? { ...u, active: !u.active } : u)
    );
    fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    }).catch(() => {
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
    fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    }).catch(() => {
      setUsers((prev) =>
        prev.map((u) => u.id === user.id ? { ...u, role: user.role } : u)
      );
    });
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {actionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="mt-1 text-gray-500">Manage editors and administrators</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          <UserPlus className="h-4 w-4" /> Add User
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="mb-4 font-semibold text-gray-800">New User</h3>
          <div className="grid grid-cols-2 gap-4">
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <input
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <input
              placeholder="Password (min 6 chars)"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="EDITOR">Editor</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>
          <button
            onClick={handleCreate}
            disabled={saving || !form.email || !form.name}
            className="mt-4 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create User"}
          </button>
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
