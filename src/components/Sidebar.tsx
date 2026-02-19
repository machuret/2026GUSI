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
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const mainNav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ingest", label: "Train AI", icon: Brain },
];

const contentNav = [
  { href: "/generate", label: "Generate", icon: Sparkles },
  { href: "/bulk", label: "Bulk Generate", icon: Layers },
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
            ? "bg-brand-50 text-brand-700"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`}
      >
        <item.icon className="h-5 w-5" />
        {item.label}
      </Link>
    );
  };

  return (
    <aside className="flex w-64 flex-col border-r border-gray-200 bg-white px-4 py-6">
      <div className="mb-8 px-2">
        <h1 className="text-2xl font-bold text-brand-700">GUSI</h1>
        <p className="text-xs text-gray-500">AI Content Generator</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto">
        {mainNav.map(navLink)}

        <div className="my-3 border-t border-gray-100" />
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Content
        </p>
        {contentNav.map(navLink)}

        <div className="my-3 border-t border-gray-100" />
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Growth
        </p>
        {grantsNav.map(navLink)}

        <div className="my-3 border-t border-gray-100" />
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Settings
        </p>
        {settingsNav.map(navLink)}
      </nav>

      <button
        onClick={handleLogout}
        className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
      >
        <LogOut className="h-5 w-5" />
        Sign Out
      </button>
    </aside>
  );
}
