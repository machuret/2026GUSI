"use client";

import { useEffect, useState } from "react";
import { HelpCircle, ChevronDown, Loader2 } from "lucide-react";
import { authFetch } from "@/lib/authFetch";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category?: string | null;
}

function FaqAccordion({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-base font-semibold text-gray-900">{item.question}</span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-6 pb-5 pt-0">
          <div className="prose prose-gray prose-sm max-w-none text-gray-600 leading-relaxed whitespace-pre-wrap">
            {item.answer}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FaqPage() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch("/api/faq")
      .then((r) => r.json())
      .then((d) => setFaqs(d.faqs ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Group by category
  const categories = Array.from(new Set(faqs.map((f) => f.category || "General")));
  const grouped = categories.map((cat) => ({
    category: cat,
    items: faqs.filter((f) => (f.category || "General") === cat),
  }));

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-4 py-1.5 text-sm font-semibold text-brand-700 mb-4">
          <HelpCircle className="h-4 w-4" /> Help Center
        </div>
        <h1 className="text-4xl font-bold text-gray-900">Frequently Asked Questions</h1>
        <p className="mt-2 text-lg text-gray-500">
          Find answers to common questions below
        </p>
      </div>

      {loading && (
        <div className="py-20 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-300" />
        </div>
      )}

      {!loading && faqs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 py-20 text-center">
          <HelpCircle className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No FAQs yet</p>
          <p className="text-sm text-gray-400 mt-1">Questions and answers will appear here once added.</p>
        </div>
      )}

      {!loading && faqs.length > 0 && (
        <div className="space-y-8">
          {grouped.map((group) => (
            <div key={group.category}>
              {categories.length > 1 && (
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-brand-600">{group.category}</h2>
              )}
              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                {group.items.map((item) => (
                  <FaqAccordion key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
