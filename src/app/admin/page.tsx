"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Shield, ToggleLeft, ToggleRight,
  ChevronDown, ChevronUp, Users, Check,
  Plus, Trash2, Loader2, X, Eye, EyeOff,
} from "lucide-react";
import { fetchJSON } from "@/lib/fetchJSON";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ROLES } from "@/lib/auth";

// ── Section permissions ──────────────────────────────────────────────────────
const SECTIONS = [
  { key: "content",   label: "Content",        description: "Generate, Bulk, Carousel, Voices, Translations, History, Library, Calendar" },
  { key: "grants",    label: "Grants",         description: "Grants, CRM, Builder, Profile, Crawler" },
  { key: "leads",     label: "Leads",          description: "Leads management and enrichment" },
  { key: "train_ai",  label: "Train AI",       description: "Ingest content and train the AI" },
  { key: "ideas",     label: "Ideas",          description: "Content idea generation" },
  { key: "mailchimp", label: "Mailchimp",      description: "Mailchimp integration" },
  { key: "settings",  label: "Settings",       description: "Company info, Vault, Templates, Prompts, Lessons, Chatbots" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

// Default permissions per role
const ROLE_DEFAULT_PERMISSIONS: Record<string, SectionKey[]> = {
  USER:        ["content", "grants", "leads", "train_ai", "ideas", "mailchimp"],
  ADMIN:       ["content", "grants", "leads", "train_ai", "ideas", "mailchimp", "settings"],
  SUPER_ADMIN: ["content", "grants", "leads", "train_ai", "ideas", "mailchimp", "settings"],
  EDITOR:      ["content", "grants", "leads", "train_ai", "ideas", "mailchimp"],
};

interface AppUser {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
  permissions?: string[] | null;
}

const ROLE_STYLES: Record<string, string> = {
  USER:        "bg-blue-100 text-blue-700 border-blue-200",
  EDITOR:      "bg-blue-100 text-blue-700 border-blue-200",
  ADMIN:       "bg-purple-100 text-purple-700 border-purple-200",
  SUPER_ADMIN: "bg-red-100 text-red-700 border-red-200",
};

function getEffectivePermissions(user: AppUser): SectionKey[] {
  if (user.permissions && user.permissions.length > 0) {
    return user.permissions as SectionKey[];
  }
  return ROLE_DEFAULT_PERMISSIONS[user.role] ?? ROLE_DEFAULT_PERMISSIONS.USER;
}

function UserRow({ user, onUpdate, onDelete }: { user: AppUser; onUpdate: (updated: AppUser) => void; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const perms = getEffectivePermissions(user);

  const patch = useCallback(async (patch: Partial<AppUser>) => {
    setSaving(true);
    setError(null);
    const optimistic = { ...user, ...patch };
    onUpdate(optimistic);
    try {
      await fetchJSON(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      onUpdate(user); // revert
    } finally {
      setSaving(false);
    }
  }, [user, onUpdate]);

  const toggleSection = (key: SectionKey) => {
    const current = getEffectivePermissions(user);
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    patch({ permissions: next });
  };

  const resetToRole = () => {
    patch({ permissions: ROLE_DEFAULT_PERMISSIONS[user.role] ?? [] });
  };

  const handleDelete = async () => {
    if (!confirm(`Permanently delete "${user.name}" (${user.email})? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await fetchJSON(`/api/users/${user.id}`, { method: "DELETE" });
      onDelete(user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-5 py-4">
          <p className="font-medium text-gray-900">{user.name}</p>
          <p className="text-xs text-gray-400">{user.email}</p>
        </td>
        <td className="px-4 py-4">
          <div className="relative inline-block">
            <select
              value={user.role === "EDITOR" ? "USER" : user.role}
              onChange={(e) => patch({ role: e.target.value })}
              disabled={saving}
              className={`appearance-none rounded-full border pl-3 pr-7 py-1 text-xs font-semibold cursor-pointer focus:outline-none disabled:opacity-60 ${ROLE_STYLES[user.role] ?? ROLE_STYLES.USER}`}
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
            onClick={() => patch({ active: !user.active })}
            disabled={saving}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-60 ${
              user.active
                ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
            }`}
          >
            {user.active
              ? <><ToggleRight className="h-3.5 w-3.5" /> Active</>
              : <><ToggleLeft className="h-3.5 w-3.5" /> Disabled</>}
          </button>
        </td>
        <td className="px-4 py-4 text-xs text-gray-400">
          {new Date(user.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
        </td>
        <td className="px-4 py-4 text-right">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              <Shield className="h-3 w-3" /> Permissions
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              title="Delete user"
              className="flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-500 hover:bg-red-100 disabled:opacity-40"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </td>
      </tr>

      {/* Permissions panel */}
      {expanded && (
        <tr>
          <td colSpan={5} className="px-5 pb-4 pt-0 bg-gray-50">
            {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-700">Section Access</p>
                <button
                  onClick={resetToRole}
                  className="text-xs text-brand-600 hover:underline"
                >
                  Reset to role defaults
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SECTIONS.map((sec) => {
                  const enabled = perms.includes(sec.key);
                  return (
                    <button
                      key={sec.key}
                      onClick={() => toggleSection(sec.key)}
                      disabled={saving}
                      className={`flex items-start gap-2 rounded-lg border p-2.5 text-left text-xs transition-colors disabled:opacity-60 ${
                        enabled
                          ? "border-brand-300 bg-brand-50 text-brand-800"
                          : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        enabled ? "border-brand-500 bg-brand-500" : "border-gray-300"
                      }`}>
                        {enabled && <Check className="h-2.5 w-2.5 text-white" />}
                      </span>
                      <span>
                        <span className="font-semibold block">{sec.label}</span>
                        <span className="text-gray-400 leading-tight">{sec.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Create User Modal ────────────────────────────────────────────────────────
function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (user: AppUser) => void }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "USER" });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) { setError("All fields are required"); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setSaving(true); setError(null);
    try {
      const data = await fetchJSON<{ success: boolean; user: AppUser; error?: string }>("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      onCreated(data.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
  const labelCls = "mb-1 block text-xs font-medium text-gray-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Create New User</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        {error && <p className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="space-y-3">
          <div>
            <label className={labelCls}>Full Name</label>
            <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Jane Smith" />
          </div>
          <div>
            <label className={labelCls}>Email Address</label>
            <input type="email" className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="jane@example.com" />
          </div>
          <div>
            <label className={labelCls}>Password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                className={inputCls}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="Min. 8 characters"
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className={labelCls}>Role</label>
            <select className={inputCls} value={form.role} onChange={(e) => set("role", e.target.value)}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={handleCreate}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? "Creating…" : "Create User"}
          </button>
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [users, setUsers]         = useState<AppUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

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

  const updateUser = useCallback((updated: AppUser) => {
    setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u));
  }, []);

  const deleteUser = useCallback((id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      {error && <ErrorBanner message={error} onRetry={fetchUsers} onDismiss={() => setError(null)} className="mb-4" />}

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={(user) => setUsers((prev) => [user, ...prev])}
        />
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-6 w-6 text-brand-600" />
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          </div>
          <p className="text-gray-500">Create, edit, and manage user accounts and permissions</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Create User
        </button>
      </div>

      {/* Role legend */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r.value} className="rounded-xl border border-gray-200 bg-white p-4">
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ROLE_STYLES[r.value]}`}>{r.label}</span>
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">{r.description}</p>
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
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <UserRow key={u.id} user={u} onUpdate={updateUser} onDelete={deleteUser} />
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
