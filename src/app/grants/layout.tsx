"use client";

import { GrantsProvider } from "@/hooks/GrantsContext";
import { GrantsErrorBoundary } from "./components/GrantsErrorBoundary";
import { Toaster } from "sonner";

export default function GrantsLayout({ children }: { children: React.ReactNode }) {
  return (
    <GrantsProvider>
      <GrantsErrorBoundary>
        <Toaster position="top-right" richColors closeButton duration={8000} />
        {children}
      </GrantsErrorBoundary>
    </GrantsProvider>
  );
}
