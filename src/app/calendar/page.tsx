"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { MonthView } from "./components/MonthView";
import { WeekView } from "./components/WeekView";
import { CalendarCard, type CalendarItem } from "./components/CalendarCard";

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"month" | "week">("month");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/content/calendar?companyId=${DEMO_COMPANY_ID}`);
      if (!res.ok) throw new Error(`Failed to load calendar (${res.status})`);
      const data = await res.json();
      setItems(data.items ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calendar");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };

  const scheduledByDay = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};
    items.forEach((item) => {
      if (!item.scheduledAt) return;
      const d = new Date(item.scheduledAt);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const key = d.getDate().toString();
        if (!map[key]) map[key] = [];
        map[key].push(item);
      }
    });
    return map;
  }, [items, year, month]);

  const unscheduled = useMemo(() => items.filter((i) => !i.scheduledAt), [items]);

  const startOfWeek = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    return d;
  }), [startOfWeek]);

  const weekItems = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};
    weekDays.forEach((d) => { map[d.toDateString()] = []; });
    items.forEach((item) => {
      if (!item.scheduledAt) return;
      const key = new Date(item.scheduledAt).toDateString();
      if (map[key]) map[key].push(item);
    });
    return map;
  }, [items, weekDays]);

  const totalScheduled = items.filter((i) => i.scheduledAt).length;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Content Calendar</h1>
          <p className="mt-1 text-gray-500">
            {totalScheduled} scheduled · {unscheduled.length} awaiting schedule
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={() => setView("month")}
              className={`px-3 py-1.5 text-xs font-medium ${view === "month" ? "bg-brand-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              Month
            </button>
            <button onClick={() => setView("week")}
              className={`px-3 py-1.5 text-xs font-medium border-l border-gray-200 ${view === "week" ? "bg-brand-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              Week
            </button>
          </div>
          <a href="/history" className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
            Schedule from History →
          </a>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="py-20 text-center text-gray-400">Loading calendar…</div>
      ) : (
        <>
          {view === "month" && (
            <MonthView
              year={year} month={month}
              scheduledByDay={scheduledByDay}
              onPrev={prevMonth} onNext={nextMonth}
            />
          )}
          {view === "week" && <WeekView weekDays={weekDays} weekItems={weekItems} />}

          {unscheduled.length > 0 && (
            <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-600 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Approved — not yet scheduled ({unscheduled.length})
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {unscheduled.map((item) => (
                  <CalendarCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
