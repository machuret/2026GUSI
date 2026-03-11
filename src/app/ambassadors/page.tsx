"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Users, Loader2 } from "lucide-react";
import { authFetch } from "@/lib/authFetch";

interface Ambassador {
  id: string;
  name: string;
  title?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  slug: string;
  linkedinUrl?: string | null;
  websiteUrl?: string | null;
}

export default function AmbassadorsPage() {
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch("/api/ambassadors")
      .then((r) => r.json())
      .then((d) => setAmbassadors(d.ambassadors ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-4 py-1.5 text-sm font-semibold text-brand-700 mb-4">
          <Users className="h-4 w-4" /> Our Team
        </div>
        <h1 className="text-4xl font-bold text-gray-900">Ambassadors</h1>
        <p className="mt-2 text-lg text-gray-500 max-w-2xl mx-auto">
          Meet the incredible people who represent and champion our mission
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="py-20 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-300" />
        </div>
      )}

      {/* Empty */}
      {!loading && ambassadors.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 py-20 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No ambassadors yet</p>
          <p className="text-sm text-gray-400 mt-1">Ambassadors will appear here once added.</p>
        </div>
      )}

      {/* Grid */}
      {!loading && ambassadors.length > 0 && (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {ambassadors.map((a) => (
            <Link
              key={a.id}
              href={`/ambassadors/${a.slug}`}
              className="group flex flex-col items-center text-center rounded-2xl border border-gray-200 bg-white p-6 hover:shadow-lg hover:border-brand-300 transition-all duration-200"
            >
              {/* Circular photo */}
              <div className="relative mb-4">
                <div className="h-36 w-36 rounded-full border-4 border-brand-400 overflow-hidden bg-gray-100 group-hover:border-brand-500 transition-colors">
                  {a.photoUrl ? (
                    <Image
                      src={a.photoUrl}
                      alt={a.name}
                      width={144}
                      height={144}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-brand-50">
                      <span className="text-4xl font-bold text-brand-300">
                        {a.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Name */}
              <h2 className="text-lg font-bold text-gray-900 group-hover:text-brand-600 transition-colors">
                {a.name}
              </h2>

              {/* Title */}
              {a.title && (
                <p className="mt-1 text-sm font-medium text-brand-600">{a.title}</p>
              )}

              {/* Bio snippet */}
              {a.bio && (
                <p className="mt-2 text-sm text-gray-500 line-clamp-3 leading-relaxed">
                  {a.bio}
                </p>
              )}

              {/* Read more */}
              <span className="mt-4 text-sm font-semibold text-brand-600 group-hover:underline">
                Read More &raquo;
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
