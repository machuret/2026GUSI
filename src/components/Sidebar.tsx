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
  BotMessageSquare,
  Lightbulb,
  PenLine,
  Mail,
  KanbanSquare,
  GalleryHorizontal,
  Library,
  Key,
  Send,
  ShieldCheck,
  Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { hasRole } from "@/lib/auth";

const mainNav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ingest", label: "Train AI", icon: Brain },
];

const contentNav = [
  { href: "/ideas",      label: "Ideas",            icon: Lightbulb },
  { href: "/generate",  label: "Generate",         icon: Sparkles },
  { href: "/bulk",      label: "Bulk Generate",    icon: Layers },
  { href: "/carousel",  label: "Carousel Creator", icon: GalleryHorizontal },
  { href: "/voices",    label: "Voices",           icon: Mic2 },
  { href: "/translations", label: "Translations",  icon: Languages },
  { href: "/history",   label: "History",          icon: History },
  { href: "/library",   label: "Content Library",  icon: Library },
  { href: "/calendar",  label: "Calendar",         icon: CalendarDays },
];

const newsletterNav = [
  { href: "/mailchimp", label: "Mailchimp",  icon: Mail },
];

const grantsNav = [
  { href: "/grants",         label: "Grants",        icon: Trophy },
  { href: "/grants/crm",     label: "Grants CRM",    icon: KanbanSquare },
  { href: "/grants/builder", label: "Grant Builder", icon: PenLine },
  { href: "/grants/profile", label: "Grant Profile", icon: UserCheck },
  { href: "/grants/crawler", label: "Grant Crawler", icon: Rss },
];

const leadsNav = [
  { href: "/leads",     label: "Scrape Leads", icon: Users },
  { href: "/qualified", label: "Qualified",     icon: Star },
];

const settingsNav = [
  { href: "/company",          label: "Company Info",    icon: Building2 },
  { href: "/vault",            label: "Content Vault",   icon: Vault },
  { href: "/templates",        label: "Templates",       icon: LayoutTemplate },
  { href: "/prompts",          label: "Prompt Management", icon: FileText },
  { href: "/lessons",          label: "Lessons",         icon: BookOpen },
  { href: "/chatbots",         label: "Chatbots",        icon: BotMessageSquare },
  { href: "/activity",         label: "Activity Log",    icon: Activity },
  { href: "/settings/api-keys",label: "API Keys",        icon: Key },
  { href: "/safety-audit",    label: "Safety Audit",    icon: ShieldCheck },
  { href: "/admin",            label: "User Management", icon: Shield },
];

// Default section permissions per role (mirrors admin page)
const ROLE_DEFAULT_SECTIONS: Record<string, string[]> = {
  USER:        ["content", "grants", "leads", "train_ai", "ideas", "mailchimp"],
  EDITOR:      ["content", "grants", "leads", "train_ai", "ideas", "mailchimp"],
  ADMIN:       ["content", "grants", "leads", "train_ai", "ideas", "mailchimp", "settings"],
  SUPER_ADMIN: ["content", "grants", "leads", "train_ai", "ideas", "mailchimp", "settings"],
};

export function Sidebar() {
  const pathname = usePathname();
  const supabase = createClient();
  const [userRole, setUserRole]         = useState<string | null>(null);
  const [userEmail, setUserEmail]       = useState<string | null>(null);
  const [userPerms, setUserPerms]       = useState<string[] | null>(null);
  const [roleLoaded, setRoleLoaded]     = useState(false);

  useEffect(() => {
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.role)        setUserRole(d.user.role);
        if (d.user?.email)       setUserEmail(d.user.email);
        if (d.user?.permissions) setUserPerms(d.user.permissions);
        setRoleLoaded(true);
      })
      .catch(() => { setRoleLoaded(true); });
  }, []);

  // Effective section permissions: custom overrides take priority, else role defaults
  const effectivePerms: string[] = userPerms && userPerms.length > 0
    ? userPerms
    : ROLE_DEFAULT_SECTIONS[userRole ?? ""] ?? ROLE_DEFAULT_SECTIONS.USER;

  const canSection = (key: string) => !roleLoaded || effectivePerms.includes(key);

  // Show settings for ADMIN+ or if permissions include "settings"
  const canAccessSettings = !roleLoaded || canSection("settings") || (userRole ? hasRole(userRole, "ADMIN") : false);
  const canAccessAdmin    = !roleLoaded || (userRole ? hasRole(userRole, "ADMIN") : false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const navLink = (item: { href: string; label: string; icon: any }) => {
    const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
          isActive
            ? "bg-brand-600 text-white shadow-md shadow-brand-900/30"
            : "text-gray-400 hover:bg-gray-800 hover:text-white"
        }`}
      >
        <item.icon className={`h-4 w-4 shrink-0 transition-colors ${
          isActive ? "text-white" : "text-gray-500 group-hover:text-gray-300"
        }`} />
        <span className="truncate">{item.label}</span>
        {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/60" />}
      </Link>
    );
  };

  const sectionLabel = (label: string) => (
    <p className="mb-1 mt-1 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">
      {label}
    </p>
  );

  return (
    <aside className="flex w-64 flex-col bg-gray-950 px-3 py-5">
      {/* Logo */}
      <div className="mb-5 flex items-center gap-3 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 shadow-lg shadow-brand-900/40">
          <span className="text-sm font-black text-white">G</span>
        </div>
        <div>
          <h1 className="text-base font-bold leading-none text-white">GUSI</h1>
          <p className="text-[10px] text-gray-500 leading-tight">AI Content Platform</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto pb-4">
        {mainNav.map(navLink)}

        {canSection("content") && (
          <>
            <div className="my-3 border-t border-gray-800" />
            {sectionLabel("Content")}
            {contentNav.map(navLink)}
          </>
        )}

        {canSection("mailchimp") && (
          <>
            <div className="my-3 border-t border-gray-800" />
            {sectionLabel("Newsletter")}
            {newsletterNav.map(navLink)}
          </>
        )}

        {canSection("grants") && (
          <>
            <div className="my-3 border-t border-gray-800" />
            {sectionLabel("Grants")}
            {grantsNav.map(navLink)}
          </>
        )}

        {canSection("leads") && (
          <>
            <div className="my-3 border-t border-gray-800" />
            {sectionLabel("Leads & Pipeline")}
            {leadsNav.map(navLink)}
          </>
        )}

        {canAccessSettings && (
          <>
            <div className="my-3 border-t border-gray-800" />
            {sectionLabel("Settings")}
            {settingsNav.filter((item) =>
              item.href === "/admin" ? canAccessAdmin : true
            ).map(navLink)}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="mt-auto border-t border-gray-800 pt-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">
            {userEmail ? userEmail[0].toUpperCase() : "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-gray-300">{userEmail ?? "..."}</p>
            <p className="text-[10px] capitalize text-gray-600">{userRole ?? ""}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="shrink-0 rounded p-1 text-gray-600 hover:bg-gray-800 hover:text-red-400 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
