"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
      <div className="mb-8 px-2">
        <h1 className="text-2xl font-bold text-white">GUSI</h1>
        <p className="text-xs text-gray-400">AI Content Generator</p>
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

        <div className="my-3 border-t border-gray-700" />
        <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Settings
        </p>
        {settingsNav.map(navLink)}
      </nav>

      <button
        onClick={handleLogout}
        className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 transition-colors hover:bg-red-900/40 hover:text-red-400"
      >
        <LogOut className="h-5 w-5" />
        Sign Out
      </button>
    </aside>
  );
}
