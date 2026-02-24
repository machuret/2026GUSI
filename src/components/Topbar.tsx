"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Settings, User, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const ROUTE_LABELS: Record<string, { title: string; section?: string }> = {
  "/":                    { title: "Dashboard" },
  "/ingest":              { title: "Train AI",          section: "AI" },
  "/ideas":               { title: "Ideas",             section: "Content" },
  "/generate":            { title: "Create Content",    section: "Content" },
  "/bulk":                { title: "Bulk Generate",     section: "Content" },
  "/carousel":            { title: "Carousel Creator",  section: "Content" },
  "/voices":              { title: "Voices",            section: "Content" },
  "/translations":        { title: "Translations",      section: "Content" },
  "/history":             { title: "History",           section: "Content" },
  "/calendar":            { title: "Calendar",          section: "Content" },
  "/mailchimp":           { title: "Mailchimp",         section: "Content" },
  "/grants":              { title: "Grants",            section: "Grants" },
  "/grants/crm":          { title: "Grants CRM",        section: "Grants" },
  "/grants/builder":      { title: "Grant Builder",     section: "Grants" },
  "/grants/profile":      { title: "Grant Profile",     section: "Grants" },
  "/grants/crawler":      { title: "Grant Crawler",     section: "Grants" },
  "/leads":               { title: "Leads",             section: "Leads" },
  "/company":             { title: "Company Info",      section: "Settings" },
  "/vault":               { title: "Content Vault",     section: "Settings" },
  "/templates":           { title: "Templates",         section: "Settings" },
  "/prompts":             { title: "Prompt Management", section: "Settings" },
  "/lessons":             { title: "Lessons",           section: "Settings" },
  "/chatbots":            { title: "Chatbots",          section: "Settings" },
  "/activity":            { title: "Activity Log",      section: "Settings" },
  "/admin":               { title: "User Management",   section: "Settings" },
};

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const matched = Object.entries(ROUTE_LABELS)
    .filter(([route]) => pathname === route || pathname.startsWith(route + "/"))
    .sort((a, b) => b[0].length - a[0].length)[0];

  const info = matched?.[1] ?? { title: "GUSI" };

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      setUserEmail(u.email ?? null);
      const meta = u.user_metadata as Record<string, string> | undefined;
      const fullName = meta?.full_name || meta?.name || u.email?.split("@")[0] || "User";
      setUserName(fullName);
    });
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initial = (userName || userEmail || "U").charAt(0).toUpperCase();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-8 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      {/* Left: breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        {info.section && (
          <>
            <span className="font-medium text-gray-400">{info.section}</span>
            <span className="text-gray-300">/</span>
          </>
        )}
        <span className="font-semibold text-gray-800">{info.title}</span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-3">
        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
          <Bell className="h-4 w-4" />
        </button>
        <div className="h-5 w-px bg-gray-200" />

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-gray-100 transition-colors"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
              {initial}
            </div>
            {userName && (
              <span className="hidden sm:block text-xs font-medium text-gray-700 max-w-[120px] truncate">
                {userName}
              </span>
            )}
            <ChevronDown className="h-3 w-3 text-gray-400" />
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-gray-200 bg-white shadow-lg z-50">
              {/* User info */}
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-xs font-semibold text-gray-900 truncate">{userName}</p>
                <p className="text-[10px] text-gray-400 truncate">{userEmail}</p>
              </div>
              {/* Menu items */}
              <div className="py-1">
                <button
                  onClick={() => { setOpen(false); router.push("/company"); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <User className="h-4 w-4 text-gray-400" /> Company Info
                </button>
                <button
                  onClick={() => { setOpen(false); router.push("/settings"); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Settings className="h-4 w-4 text-gray-400" /> Settings
                </button>
              </div>
              <div className="border-t border-gray-100 py-1">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
