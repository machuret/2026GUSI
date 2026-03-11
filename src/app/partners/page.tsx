"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Handshake, Loader2 } from "lucide-react";
import { authFetch } from "@/lib/authFetch";

interface Partner {
  id: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  url?: string | null;
  slug: string;
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch("/api/partners")
      .then((r) => r.json())
      .then((d) => setPartners(d.partners ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-4 py-1.5 text-sm font-semibold text-brand-700 mb-4">
          <Handshake className="h-4 w-4" /> Our Network
        </div>
        <h1 className="text-4xl font-bold text-gray-900">Partners</h1>
        <p className="mt-2 text-lg text-gray-500 max-w-2xl mx-auto">
          Organizations and companies we proudly work with
        </p>
      </div>

      {loading && (
        <div className="py-20 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-300" />
        </div>
      )}

      {!loading && partners.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 py-20 text-center">
          <Handshake className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No partners yet</p>
          <p className="text-sm text-gray-400 mt-1">Partners will appear here once added.</p>
        </div>
      )}

      {!loading && partners.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {partners.map((p) => (
            <Link
              key={p.id}
              href={`/partners/${p.slug}`}
              className="group flex flex-col items-center rounded-2xl border border-gray-200 bg-white p-6 hover:shadow-lg hover:border-brand-300 transition-all duration-200"
            >
              {/* Logo */}
              <div className="mb-4 flex h-28 w-28 items-center justify-center rounded-2xl bg-gray-50 border border-gray-100 p-3 group-hover:border-brand-200 transition-colors">
                {p.logoUrl ? (
                  <Image
                    src={p.logoUrl}
                    alt={p.name}
                    width={96}
                    height={96}
                    className="max-h-full max-w-full object-contain"
                    unoptimized
                  />
                ) : (
                  <span className="text-2xl font-bold text-gray-300">
                    {p.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </span>
                )}
              </div>

              {/* Name */}
              <h2 className="text-lg font-bold text-gray-900 group-hover:text-brand-600 transition-colors text-center">
                {p.name}
              </h2>

              {/* Description snippet */}
              {p.description && (
                <p className="mt-2 text-sm text-gray-500 line-clamp-3 leading-relaxed text-center">
                  {p.description}
                </p>
              )}

              <span className="mt-4 text-sm font-semibold text-brand-600 group-hover:underline">
                Learn More &raquo;
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
