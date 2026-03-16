"use client";

import Link from "next/link";
import { FileText, ArrowLeft } from "lucide-react";
import { TranscriptBrowser } from "../components/TranscriptBrowser";

export default function TranscriptionsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/videos" className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="h-8 w-8 text-indigo-600" /> Transcriptions
            </h1>
          </div>
          <p className="mt-1 text-gray-500 ml-10">
            Browse, search, and edit all video transcripts in one place.
          </p>
        </div>
      </div>

      <TranscriptBrowser />
    </div>
  );
}
