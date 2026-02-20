"use client";

import { BookOpen, Trash2 } from "lucide-react";
import { SavedDraft, fmtDate } from "./types";

interface Props {
  drafts: SavedDraft[];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function DraftsTab({ drafts, onLoad, onDelete }: Props) {
  if (drafts.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white py-20 text-center">
        <BookOpen className="mx-auto h-10 w-10 text-gray-200 mb-3" />
        <p className="text-gray-400 text-sm font-medium">No saved drafts yet</p>
        <p className="text-gray-300 text-xs mt-1">
          Generate and save an application to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            {["Grant", "Tone", "Length", "Last Saved", "Actions"].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {drafts.map((d) => (
            <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50 last:border-0">
              <td className="px-4 py-3 font-medium text-sm text-gray-900">{d.grantName}</td>
              <td className="px-3 py-3 text-xs text-gray-500 capitalize">
                {d.tone.replace("_", " ")}
              </td>
              <td className="px-3 py-3 text-xs text-gray-500 capitalize">{d.length}</td>
              <td className="px-3 py-3 text-xs text-gray-400">{fmtDate(d.updatedAt)}</td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onLoad(d.id)}
                    className="text-xs text-brand-600 hover:underline font-medium"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => onDelete(d.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                    title="Delete draft"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
