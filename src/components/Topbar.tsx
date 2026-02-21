"use client";

import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";

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

  const matched = Object.entries(ROUTE_LABELS)
    .filter(([route]) => pathname === route || pathname.startsWith(route + "/"))
    .sort((a, b) => b[0].length - a[0].length)[0];

  const info = matched?.[1] ?? { title: "GUSI" };

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
          <Search className="h-4 w-4" />
        </button>
        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
          <Bell className="h-4 w-4" />
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
          G
        </div>
      </div>
    </header>
  );
}
