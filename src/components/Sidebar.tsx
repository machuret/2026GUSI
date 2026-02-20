"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Brain,
  Sparkles,
  History,
  Building2,
  FileText,
  Shield,
  LogOut,
  Activity,
  BookOpen,
  Layers,
  CalendarDays,
  Trophy,
  Users,
  Rss,
  Vault,
  LayoutTemplate,
  Languages,
  Mic2,
  UserCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { hasRole } from "@/lib/auth";

const mainNav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ingest", label: "Train AI", icon: Brain },
];

const contentNav = [
  { href: "/generate", label: "Generate", icon: Sparkles },
  { href: "/bulk", label: "Bulk Generate", icon: Layers },
  { href: "/voices", label: "Voices", icon: Mic2 },
  { href: "/translations", label: "Translations", icon: Languages },
  { href: "/history", label: "History", icon: History },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
];

const grantsNav = [
  { href: "/grants", label: "Grants", icon: Trophy },
  { href: "/grants/profile", label: "Grant Profile", icon: UserCheck },
  { href: "/grants/crawler", label: "Grant Crawler", icon: Rss },
  { href: "/leads", label: "Leads", icon: Users },
];

const settingsNav = [
  { href: "/company", label: "Company Info", icon: Building2 },
  { href: "/vault", label: "Content Vault", icon: Vault },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/prompts", label: "Prompt Management", icon: FileText },
  { href: "/lessons", label: "Lessons", icon: BookOpen },
  { href: "/activity", label: "Activity Log", icon: Activity },
  { href: "/admin", label: "User Management", icon: Shield },
];

export function Sidebar() {
  const pathname = usePathname();
  const supabase = createClient();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.role)  setUserRole(d.user.role);
        if (d.user?.email) setUserEmail(d.user.email);
        setRoleLoaded(true);
      })
      .catch(() => { setRoleLoaded(true); });
  }, []);

  // Show settings while loading (optimistic) — hide only once loaded and confirmed non-admin
  const canAccessSettings = !roleLoaded || (userRole ? hasRole(userRole, "ADMIN") : false);
  const canAccessAdmin    = userRole ? hasRole(userRole, "SUPER_ADMIN") : false;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const navLink = (item: { href: string; label: string; icon: any }) => {
    const isActive = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? "bg-brand-600 text-white shadow-sm"
            : "text-gray-300 hover:bg-gray-800 hover:text-white"
        }`}
      >
        <item.icon className="h-5 w-5" />
        {item.label}
      </Link>
    );
  };

  return (
    <aside className="flex w-64 flex-col border-r border-gray-300 bg-gray-900 px-4 py-6">
      <div className="mb-6 px-2">
        <h1 className="text-2xl font-bold text-white">GUSI</h1>
        <p className="text-xs text-gray-400">AI Content Generator</p>
      </div>

      {/* User badge + sign out */}
      <div className="mb-4 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5">
        <p className="truncate text-xs text-gray-300">{userEmail ?? "..."}</p>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500">{userRole ?? ""}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-red-400 hover:bg-red-900/40 hover:text-red-300"
          >
            <LogOut className="h-3 w-3" />
            Sign out
          </button>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto">
        {mainNav.map(navLink)}

        <div className="my-3 border-t border-gray-700" />
        <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Content
        </p>
        {contentNav.map(navLink)}

        <div className="my-3 border-t border-gray-700" />
        <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Growth
        </p>
        {grantsNav.map(navLink)}

        {(canAccessSettings || userRole === null) && (
          <>
            <div className="my-3 border-t border-gray-700" />
            <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Settings
            </p>
            {settingsNav.filter((item) =>
              item.href === "/admin" ? canAccessAdmin : true
            ).map(navLink)}
          </>
        )}
      </nav>

    </aside>
  );
}
