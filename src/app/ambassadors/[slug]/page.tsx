"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Linkedin, Globe, Loader2, Users } from "lucide-react";
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

export default function AmbassadorProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const [ambassador, setAmbassador] = useState<Ambassador | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    authFetch(`/api/ambassadors/${slug}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then((d) => { if (d) setAmbassador(d.ambassador); })
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

  if (notFound || !ambassador) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <Users className="mx-auto h-12 w-12 text-gray-300 mb-3" />
        <h1 className="text-2xl font-bold text-gray-900">Ambassador not found</h1>
        <p className="mt-2 text-gray-500">This profile may have been removed or the link is incorrect.</p>
        <Link href="/ambassadors" className="mt-4 inline-flex items-center gap-2 text-brand-600 hover:underline font-medium">
          <ArrowLeft className="h-4 w-4" /> Back to all ambassadors
        </Link>
      </div>
    );
  }

  const a = ambassador;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Back link */}
      <Link href="/ambassadors" className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-brand-600 transition-colors">
        <ArrowLeft className="h-4 w-4" /> All Ambassadors
      </Link>

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        {/* Hero section */}
        <div className="bg-gradient-to-br from-brand-50 to-brand-100 px-8 py-10 flex flex-col items-center text-center">
          {/* Photo */}
          <div className="h-44 w-44 rounded-full border-4 border-white shadow-lg overflow-hidden bg-white mb-5">
            {a.photoUrl ? (
              <Image
                src={a.photoUrl}
                alt={a.name}
                width={176}
                height={176}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-brand-50">
                <span className="text-5xl font-bold text-brand-300">
                  {a.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </span>
              </div>
            )}
          </div>

          <h1 className="text-3xl font-bold text-gray-900">{a.name}</h1>
          {a.title && (
            <p className="mt-1 text-lg font-medium text-brand-700">{a.title}</p>
          )}

          {/* Social links */}
          {(a.linkedinUrl || a.websiteUrl) && (
            <div className="mt-4 flex items-center gap-3">
              {a.linkedinUrl && (
                <a
                  href={a.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full bg-white border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-brand-600 hover:border-brand-300 transition-colors shadow-sm"
                >
                  <Linkedin className="h-4 w-4" /> LinkedIn
                </a>
              )}
              {a.websiteUrl && (
                <a
                  href={a.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full bg-white border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-brand-600 hover:border-brand-300 transition-colors shadow-sm"
                >
                  <Globe className="h-4 w-4" /> Website
                </a>
              )}
            </div>
          )}
        </div>

        {/* Bio */}
        {a.bio && (
          <div className="px-8 py-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">About</h2>
            <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
              {a.bio}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
