"use client";

import { CalendarCard, type CalendarItem } from "./CalendarCard";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

interface Props {
  weekDays: Date[];
  weekItems: Record<string, CalendarItem[]>;
}

export function WeekView({ weekDays, weekItems }: Props) {
  const today = new Date();

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-100">
        {weekDays.map((d) => {
          const isToday = d.toDateString() === today.toDateString();
          return (
            <div key={d.toDateString()} className={`p-3 text-center border-r border-gray-100 last:border-r-0 ${isToday ? "bg-brand-50" : ""}`}>
              <p className="text-xs font-semibold text-gray-400">{WEEKDAYS[d.getDay()]}</p>
              <p className={`text-lg font-bold ${isToday ? "text-brand-600" : "text-gray-700"}`}>{d.getDate()}</p>
              <p className="text-xs text-gray-400">{MONTHS[d.getMonth()].slice(0, 3)}</p>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-7 divide-x divide-gray-100">
        {weekDays.map((d) => {
          const dayItems = weekItems[d.toDateString()] ?? [];
          const isToday = d.toDateString() === today.toDateString();
          return (
            <div key={d.toDateString()} className={`min-h-[300px] p-2 space-y-2 ${isToday ? "bg-brand-50/30" : ""}`}>
              {dayItems.length === 0 ? (
                <p className="text-xs text-gray-300 text-center mt-8">—</p>
              ) : (
                dayItems.map((item) => <CalendarCard key={item.id} item={item} />)
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
