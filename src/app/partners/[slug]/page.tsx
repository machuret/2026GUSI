"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ExternalLink, Loader2, Handshake } from "lucide-react";
import { authFetch } from "@/lib/authFetch";

interface Partner {
  id: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  url?: string | null;
  slug: string;
}

export default function PartnerProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    authFetch(`/api/partners/${slug}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then((d) => { if (d) setPartner(d.partner); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="py-20 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-300" />
      </div>
    );
  }

  if (notFound || !partner) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <Handshake className="mx-auto h-12 w-12 text-gray-300 mb-3" />
        <h1 className="text-2xl font-bold text-gray-900">Partner not found</h1>
        <p className="mt-2 text-gray-500">This profile may have been removed or the link is incorrect.</p>
        <Link href="/partners" className="mt-4 inline-flex items-center gap-2 text-brand-600 hover:underline font-medium">
          <ArrowLeft className="h-4 w-4" /> Back to all partners
        </Link>
      </div>
    );
  }

  const p = partner;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/partners" className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-brand-600 transition-colors">
        <ArrowLeft className="h-4 w-4" /> All Partners
      </Link>

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        {/* Hero */}
        <div className="bg-gradient-to-br from-brand-50 to-brand-100 px-8 py-10 flex flex-col items-center text-center">
          <div className="h-32 w-32 flex items-center justify-center rounded-2xl bg-white border border-gray-200 shadow-sm p-4 mb-5">
            {p.logoUrl ? (
              <Image src={p.logoUrl} alt={p.name} width={112} height={112} className="max-h-full max-w-full object-contain" unoptimized />
            ) : (
              <span className="text-4xl font-bold text-brand-300">
                {p.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </span>
            )}
          </div>

          <h1 className="text-3xl font-bold text-gray-900">{p.name}</h1>

          {p.url && (
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:text-brand-600 hover:border-brand-300 transition-colors shadow-sm"
            >
              <ExternalLink className="h-4 w-4" /> Visit Website
            </a>
          )}
        </div>

        {/* Description */}
        {p.description && (
          <div className="px-8 py-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">About</h2>
            <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
              {p.description}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
