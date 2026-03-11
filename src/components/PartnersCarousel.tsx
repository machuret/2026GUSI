"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { authFetch } from "@/lib/authFetch";

interface Partner {
  id: string;
  name: string;
  logoUrl?: string | null;
  url?: string | null;
  slug: string;
}

export function PartnersCarousel() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    authFetch("/api/partners")
      .then((r) => r.json())
      .then((d) => setPartners((d.partners ?? []).filter((p: Partner) => p.logoUrl)))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || partners.length === 0) return null;

  // Double the list for seamless infinite scroll
  const items = [...partners, ...partners];

  return (
    <section className="mt-10 mb-2">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Our Partners</h2>
        <Link href="/partners" className="text-xs font-medium text-brand-600 hover:underline">
          View All &rarr;
        </Link>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white py-6">
        <div className="flex animate-scroll gap-12 px-6">
          {items.map((p, i) => (
            <Link
              key={`${p.id}-${i}`}
              href={`/partners/${p.slug}`}
              className="flex h-12 w-28 shrink-0 items-center justify-center opacity-60 grayscale transition-all duration-200 hover:opacity-100 hover:grayscale-0"
              title={p.name}
            >
              <Image
                src={p.logoUrl!}
                alt={p.name}
                width={112}
                height={48}
                className="max-h-full max-w-full object-contain"
                unoptimized
              />
            </Link>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes partner-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll {
          animation: partner-scroll ${partners.length * 3}s linear infinite;
        }
        .animate-scroll:hover {
          animation-play-state: paused;
        }
      ` }} />
    </section>
  );
}
