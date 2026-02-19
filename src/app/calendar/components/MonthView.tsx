"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarCard, type CalendarItem } from "./CalendarCard";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

interface Props {
  year: number;
  month: number;
  scheduledByDay: Record<string, CalendarItem[]>;
  onPrev: () => void;
  onNext: () => void;
}

export function MonthView({ year, month, scheduledByDay, onPrev, onNext }: Props) {
  const today = new Date();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <button onClick={onPrev} className="rounded-lg p-1.5 hover:bg-gray-100">
          <ChevronLeft className="h-4 w-4 text-gray-500" />
        </button>
        <h2 className="text-base font-semibold text-gray-900">{MONTHS[month]} {year}</h2>
        <button onClick={onNext} className="rounded-lg p-1.5 hover:bg-gray-100">
          <ChevronRight className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-gray-100">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-gray-100 bg-gray-50" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
          const dayItems = scheduledByDay[day.toString()] ?? [];
          return (
            <div key={day} className={`min-h-[100px] border-b border-r border-gray-100 p-1.5 ${isToday ? "bg-brand-50" : ""}`}>
              <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? "bg-brand-600 text-white" : "text-gray-500"}`}>
                {day}
              </div>
              <div className="space-y-1">
                {dayItems.map((item) => <CalendarCard key={item.id} item={item} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
