"use client";

import { Users, Zap } from "lucide-react";

export default function LeadsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
        <p className="mt-1 text-gray-500">Lead scraping and management — powered by Apify</p>
      </div>

      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 py-24 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50">
          <Users className="h-8 w-8 text-brand-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800">Coming Soon</h2>
        <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
          Lead scraping via Apify API will be built here — search, filter, and manage prospective leads.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
          <Zap className="h-3.5 w-3.5" />
          Powered by Apify
        </div>
      </div>
    </div>
  );
}
