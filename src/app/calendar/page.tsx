"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, Clock, Copy, Check } from "lucide-react";
import { DEMO_COMPANY_ID } from "@/lib/constants";

const PLATFORM_COLORS: Record<string, string> = {
  linkedin:  "bg-blue-100 text-blue-800 border-blue-200",
  instagram: "bg-pink-100 text-pink-800 border-pink-200",
  facebook:  "bg-indigo-100 text-indigo-800 border-indigo-200",
  twitter:   "bg-sky-100 text-sky-800 border-sky-200",
  newsletter:"bg-amber-100 text-amber-800 border-amber-200",
  blog_post: "bg-emerald-100 text-emerald-800 border-emerald-200",
  default:   "bg-gray-100 text-gray-700 border-gray-200",
};

const CATEGORY_COLORS: Record<string, string> = {
  social_media:   "bg-pink-50 border-l-4 border-l-pink-400",
  newsletter:     "bg-amber-50 border-l-4 border-l-amber-400",
  blog_post:      "bg-emerald-50 border-l-4 border-l-emerald-400",
  offer:          "bg-orange-50 border-l-4 border-l-orange-400",
  webinar:        "bg-violet-50 border-l-4 border-l-violet-400",
  announcement:   "bg-red-50 border-l-4 border-l-red-400",
  course_content: "bg-teal-50 border-l-4 border-l-teal-400",
  sales_page:     "bg-yellow-50 border-l-4 border-l-yellow-400",
  cold_email:     "bg-blue-50 border-l-4 border-l-blue-400",
};

interface CalendarItem {
  id: string;
  prompt: string;
  output: string;
  status: string;
  category: string;
  categoryLabel: string;
  scheduledAt?: string | null;
  createdAt: string;
  platform?: string;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function CalendarCard({ item }: { item: CalendarItem }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(item.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const colorCls = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.cold_email;
  const platformColor = item.platform
    ? PLATFORM_COLORS[item.platform] ?? PLATFORM_COLORS.default
    : PLATFORM_COLORS.default;

  const time = item.scheduledAt
    ? new Date(item.scheduledAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className={`rounded-lg border p-2 text-xs cursor-pointer ${colorCls}`} onClick={() => setExpanded(v => !v)}>
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          {time && (
            <div className="flex items-center gap-0.5 text-gray-500 mb-0.5">
              <Clock className="h-2.5 w-2.5" /> {time}
            </div>
          )}
          <p className="font-medium text-gray-800 truncate">{item.categoryLabel}</p>
          <p className="text-gray-500 truncate">{item.prompt.slice(0, 50)}</p>
        </div>
        {item.platform && (
          <span className={`shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium ${platformColor}`}>
            {item.platform}
          </span>
        )}
      </div>

      {expanded && (
        <div className="mt-2 border-t border-gray-200 pt-2" onClick={e => e.stopPropagation()}>
          <p className="whitespace-pre-wrap text-gray-700 leading-relaxed max-h-40 overflow-y-auto">
            {item.output}
          </p>
          <button
            onClick={copy}
            className="mt-1.5 flex items-center gap-1 text-gray-400 hover:text-brand-600"
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}

function UnscheduledList({ items }: { items: CalendarItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-600 flex items-center gap-2">
        <Clock className="h-4 w-4" /> Approved — not yet scheduled ({items.length})
      </h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(item => (
          <CalendarCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"month" | "week">("month");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/content/calendar?companyId=${DEMO_COMPANY_ID}`);
      const data = await res.json();
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // Group scheduled items by date string "YYYY-MM-DD"
  const scheduledByDay = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};
    items.forEach(item => {
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

  const unscheduled = useMemo(
    () => items.filter(i => !i.scheduledAt),
    [items]
  );

  const totalScheduled = items.filter(i => i.scheduledAt).length;

  // Week view: current week
  const startOfWeek = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [startOfWeek]);

  const weekItems = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};
    weekDays.forEach(d => { map[d.toDateString()] = []; });
    items.forEach(item => {
      if (!item.scheduledAt) return;
      const d = new Date(item.scheduledAt);
      const key = d.toDateString();
      if (map[key]) map[key].push(item);
    });
    return map;
  }, [items, weekDays]);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Content Calendar</h1>
          <p className="mt-1 text-gray-500">
            {totalScheduled} scheduled · {unscheduled.length} awaiting schedule
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setView("month")}
              className={`px-3 py-1.5 text-xs font-medium ${view === "month" ? "bg-brand-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              Month
            </button>
            <button
              onClick={() => setView("week")}
              className={`px-3 py-1.5 text-xs font-medium border-l border-gray-200 ${view === "week" ? "bg-brand-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              Week
            </button>
          </div>
          <a
            href="/history"
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Schedule from History →
          </a>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">Loading calendar…</div>
      ) : (
        <>
          {/* Month view */}
          {view === "month" && (
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              {/* Month nav */}
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <button onClick={prevMonth} className="rounded-lg p-1.5 hover:bg-gray-100">
                  <ChevronLeft className="h-4 w-4 text-gray-500" />
                </button>
                <h2 className="text-base font-semibold text-gray-900">
                  {MONTHS[month]} {year}
                </h2>
                <button onClick={nextMonth} className="rounded-lg p-1.5 hover:bg-gray-100">
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                </button>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 border-b border-gray-100">
                {WEEKDAYS.map(d => (
                  <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400">
                    {d}
                  </div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7">
                {/* Empty cells before first day */}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-gray-100 bg-gray-50" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
                  const dayItems = scheduledByDay[day.toString()] ?? [];

                  return (
                    <div
                      key={day}
                      className={`min-h-[100px] border-b border-r border-gray-100 p-1.5 ${isToday ? "bg-brand-50" : ""}`}
                    >
                      <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                        isToday ? "bg-brand-600 text-white" : "text-gray-500"
                      }`}>
                        {day}
                      </div>
                      <div className="space-y-1">
                        {dayItems.map(item => (
                          <CalendarCard key={item.id} item={item} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Week view */}
          {view === "week" && (
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="grid grid-cols-7 border-b border-gray-100">
                {weekDays.map(d => {
                  const isToday = d.toDateString() === today.toDateString();
                  return (
                    <div key={d.toDateString()} className={`p-3 text-center border-r border-gray-100 last:border-r-0 ${isToday ? "bg-brand-50" : ""}`}>
                      <p className="text-xs font-semibold text-gray-400">{WEEKDAYS[d.getDay()]}</p>
                      <p className={`text-lg font-bold ${isToday ? "text-brand-600" : "text-gray-700"}`}>
                        {d.getDate()}
                      </p>
                      <p className="text-xs text-gray-400">{MONTHS[d.getMonth()].slice(0, 3)}</p>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-7 divide-x divide-gray-100">
                {weekDays.map(d => {
                  const dayItems = weekItems[d.toDateString()] ?? [];
                  const isToday = d.toDateString() === today.toDateString();
                  return (
                    <div key={d.toDateString()} className={`min-h-[300px] p-2 space-y-2 ${isToday ? "bg-brand-50/30" : ""}`}>
                      {dayItems.length === 0 ? (
                        <p className="text-xs text-gray-300 text-center mt-8">—</p>
                      ) : (
                        dayItems.map(item => (
                          <CalendarCard key={item.id} item={item} />
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unscheduled queue */}
          <UnscheduledList items={unscheduled} />
        </>
      )}
    </div>
  );
}
