"use client";

import { Loader2, Sparkles, UserSearch, UserPlus, Pencil, Trash2, ExternalLink, Phone, Mail } from "lucide-react";
import Link from "next/link";
import { type HospitalLead, STATUS_STYLES } from "@/hooks/useHospitals";

interface Props {
  hospital: HospitalLead;
  selected: boolean;
  onSelect: (id: string) => void;
  onEdit: (h: HospitalLead) => void;
  onDelete: (id: string) => void;
  onEnrich: (id: string) => void;
  enrichingId: string | null;
  onFindDirector: (id: string, category?: string) => void;
  residencyCategory?: string;
  findingDirectorId: string | null;
  onConvertToLead: (h: HospitalLead) => void;
  convertingId: string | null;
}

export function HospitalRow({
  hospital: h, selected, onSelect, onEdit, onDelete,
  onEnrich, enrichingId, onFindDirector, findingDirectorId,
  onConvertToLead, convertingId, residencyCategory,
}: Props) {
  return (
    <tr className={`hover:bg-gray-50 transition-colors ${selected ? "bg-purple-50/40" : ""}`}>
      <td className="pl-4 py-3">
        <input type="checkbox" checked={selected} onChange={() => onSelect(h.id)} className="rounded border-gray-300" />
      </td>
      <td className="px-3 py-3">
        <p className="font-medium text-gray-900">{h.name}</p>
        {h.address && <p className="text-xs text-gray-500 mt-0.5">{h.address}</p>}
        {h.phone && <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{h.phone}</p>}
        {h.url && (
          <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline text-xs flex items-center gap-1 mt-0.5">
            <ExternalLink className="h-3 w-3" /> {(() => { try { return new URL(h.url!).hostname.replace("www.", ""); } catch { return "Visit"; } })()}
          </a>
        )}
      </td>
      <td className="px-3 py-3 text-gray-600">{h.city ?? "—"}</td>
      <td className="px-3 py-3 text-xs text-gray-500">{h.state}</td>
      <td className="px-3 py-3">
        {h.type && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{h.type}</span>}
      </td>
      <td className="px-3 py-3">
        {h.directorName ? (
          <div>
            <p className="text-xs font-medium text-gray-900">{h.directorName}</p>
            {h.directorTitle && <p className="text-[10px] text-gray-500 leading-snug">{h.directorTitle}</p>}
            {h.directorEmail && (
              <a href={`mailto:${h.directorEmail}`} className="text-xs text-brand-600 hover:underline flex items-center gap-1 mt-0.5">
                <Mail className="h-3 w-3" />{h.directorEmail}
              </a>
            )}
            {h.directorPhone && <p className="text-[10px] text-gray-400 mt-0.5"><Phone className="h-2.5 w-2.5 inline mr-0.5" />{h.directorPhone}</p>}
            <Link href={`/directors?search=${encodeURIComponent(h.name)}`} className="text-[10px] text-purple-600 hover:underline mt-1 inline-block">
              View all directors →
            </Link>
          </div>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="px-3 py-3">
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[h.status] ?? STATUS_STYLES.new}`}>
          {h.status}
        </span>
        {h.enriched && <span className="ml-1 text-[10px] text-green-600">enriched</span>}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => onFindDirector(h.id, residencyCategory)} disabled={findingDirectorId === h.id}
            className="rounded p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors" title="Find Residency Program Director">
            {findingDirectorId === h.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserSearch className="h-4 w-4" />}
          </button>
          <button onClick={() => onEnrich(h.id)} disabled={enrichingId === h.id}
            className="rounded p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Enrich with AI">
            {enrichingId === h.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          </button>
          {h.directorName && (
            <button onClick={() => onConvertToLead(h)} disabled={convertingId === h.id}
              className="rounded p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors" title="Convert director to Lead">
              {convertingId === h.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            </button>
          )}
          <button onClick={() => onEdit(h)}
            className="rounded p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => onDelete(h.id)}
            className="rounded p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
