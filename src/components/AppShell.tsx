"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin   = pathname === "/login";
  const isPreview = pathname.endsWith("/preview");

  if (isLogin || isPreview) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-[#f1f3f8]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-screen-xl px-8 py-7">{children}</div>
        </main>
      </div>
    </div>
  );
}
