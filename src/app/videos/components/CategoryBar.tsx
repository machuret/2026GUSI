"use client";

import { Loader2, Palette, Save, Trash2, X } from "lucide-react";
import { VideoCategory } from "../types";
import { CATEGORY_COLORS, inputCls, labelCls } from "../helpers";

interface Props {
  categories: VideoCategory[];
  filterCat: string;
  setFilterCat: (cat: string) => void;
  totalCount: number | null;
  // Edit state
  editCatId: string | null;
  setEditCatId: (id: string | null) => void;
  editCatForm: { name: string; description: string; color: string };
  setEditCatForm: React.Dispatch<React.SetStateAction<{ name: string; description: string; color: string }>>;
  catSaving: boolean;
  onUpdate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function CategoryBar({
  categories, filterCat, setFilterCat, totalCount,
  editCatId, setEditCatId, editCatForm, setEditCatForm,
  catSaving, onUpdate, onDelete,
}: Props) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button onClick={() => setFilterCat("all")}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${filterCat === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
          All {totalCount !== null ? `(${totalCount})` : ""}
        </button>
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center gap-0 shrink-0">
            <button onClick={() => setFilterCat(cat.id)}
              className={`rounded-l-full px-3.5 py-1.5 text-xs font-semibold transition-all ${filterCat === cat.id ? "text-white" : "text-gray-600 hover:opacity-80"}`}
              style={{ backgroundColor: filterCat === cat.id ? cat.color : `${cat.color}20`, color: filterCat === cat.id ? "white" : cat.color }}>
              {cat.name}
            </button>
            {editCatId !== cat.id && (
              <button onClick={() => { setEditCatId(cat.id); setEditCatForm({ name: cat.name, description: cat.description, color: cat.color }); }}
                className="rounded-r-full px-2 py-1.5 text-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-100" title="Edit category">
                <Palette className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
        <button onClick={() => setFilterCat("uncategorized")}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${filterCat === "uncategorized" ? "bg-gray-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
          Uncategorized
        </button>
      </div>

      {/* Edit category inline */}
      {editCatId && (() => {
        const cat = categories.find((c) => c.id === editCatId);
        if (!cat) return null;
        return (
          <div className="mt-3 rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Edit: {cat.name}</h3>
              <div className="flex gap-2">
                <button onClick={() => onDelete(cat.id)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
                <button onClick={() => setEditCatId(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Name</label>
                <input value={editCatForm.name} onChange={(e) => setEditCatForm((p) => ({ ...p, name: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <input value={editCatForm.description} onChange={(e) => setEditCatForm((p) => ({ ...p, description: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Color</label>
                <div className="flex gap-1.5 flex-wrap">
                  {CATEGORY_COLORS.map((c) => (
                    <button key={c} onClick={() => setEditCatForm((p) => ({ ...p, color: c }))}
                      className={`h-6 w-6 rounded-full border-2 transition-all ${editCatForm.color === c ? "border-gray-900 scale-110" : "border-transparent hover:border-gray-300"}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => onUpdate(cat.id)} disabled={catSaving}
                className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                {catSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
              </button>
              <button onClick={() => setEditCatId(null)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
