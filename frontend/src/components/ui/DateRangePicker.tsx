// File: src/components/ui/DateRangePicker.tsx
//
// Replaces the two native <input type="date"> fields in Expenses filters --
// the browser's own calendar popup (plain white, OS-drawn) looked out of
// place against the rest of the cream/candy chrome. Click-to-open header
// toggles between a day grid (pick a range) and a month/year grid (jump
// years fast), same interaction MonthPickerModal already uses elsewhere for
// the shared month control, plus a row of common-range presets.
import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import dayjs, { Dayjs } from 'dayjs';

interface DateRangePickerProps {
  /** YYYY-MM-DD, or '' for no bound. */
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const PRESETS: { label: string; range: () => [string, string] }[] = [
  { label: "This month", range: () => [dayjs().startOf("month").format("YYYY-MM-DD"), dayjs().format("YYYY-MM-DD")] },
  { label: "Last month", range: () => {
      const m = dayjs().subtract(1, "month");
      return [m.startOf("month").format("YYYY-MM-DD"), m.endOf("month").format("YYYY-MM-DD")];
  }},
  { label: "Last 30 days", range: () => [dayjs().subtract(29, "day").format("YYYY-MM-DD"), dayjs().format("YYYY-MM-DD")] },
  { label: "Last 90 days", range: () => [dayjs().subtract(89, "day").format("YYYY-MM-DD"), dayjs().format("YYYY-MM-DD")] },
];

const DateRangePicker: React.FC<DateRangePickerProps> = ({ startDate, endDate, onChange }) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"days" | "months">("days");
  const today = dayjs();
  const initial = startDate ? dayjs(startDate) : today;

  const [viewMonth, setViewMonth] = useState<Dayjs>(initial.startOf("month"));
  const [viewYear, setViewYear] = useState<number>(initial.year());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setMode("days");
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const start = startDate ? dayjs(startDate) : null;
  const end = endDate ? dayjs(endDate) : null;

  const pick = (day: Dayjs) => {
    const iso = day.format("YYYY-MM-DD");
    if (!start || end) {
      // Nothing selected yet, or a complete range already exists -- start fresh.
      onChange(iso, iso);
    } else if (day.isBefore(start, "day")) {
      onChange(iso, start.format("YYYY-MM-DD"));
    } else {
      onChange(start.format("YYYY-MM-DD"), iso);
    }
  };

  const applyPreset = (range: () => [string, string]) => {
    const [s, e] = range();
    onChange(s, e);
    setViewMonth(dayjs(e).startOf("month"));
    setOpen(false);
  };

  const clear = () => {
    onChange("", "");
    setOpen(false);
  };

  const gridStart = viewMonth.startOf("month").startOf("week");
  const days: Dayjs[] = Array.from({ length: 42 }, (_, i) => gridStart.add(i, "day"));

  const inRange = (d: Dayjs) => start && end && !d.isBefore(start, "day") && !d.isAfter(end, "day");
  const isRangeEdge = (d: Dayjs) => (start && d.isSame(start, "day")) || (end && d.isSame(end, "day"));
  const isFuture = (d: Dayjs) => d.isAfter(today, "day");

  const label = start
    ? (end && !end.isSame(start, "day") ? `${start.format("DD MMM")} – ${end.format("DD MMM YYYY")}` : start.format("DD MMM YYYY"))
    : "All dates";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-bg border border-line rounded-chip px-3 py-2.5 font-body font-semibold text-xs text-ink outline-none cursor-pointer hover:bg-hair transition-colors"
      >
        <CalendarIcon size={14} className="text-muted shrink-0" />
        <span className="whitespace-nowrap">{label}</span>
      </button>

      {open && (
        <div className="absolute left-0 mt-1.5 z-30 w-[320px] bg-card border-2 border-line rounded-cardLg shadow-overlay p-4">
          <div className="flex flex-wrap gap-1.5 mb-3.5 pb-3.5 border-b border-line">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.range)}
                className="px-2.5 py-1 rounded-full border border-line bg-hair font-body font-semibold text-[11px] text-ink hover:bg-candy-yellow hover:border-candyLine transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {mode === "days" ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={() => setViewMonth((m) => m.subtract(1, "month"))} aria-label="Previous month" className="w-7 h-7 rounded-chip border border-line flex items-center justify-center hover:bg-hair transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => { setViewYear(viewMonth.year()); setMode("months"); }}
                  className="font-heading font-bold text-sm hover:text-link transition-colors"
                >
                  {viewMonth.format("MMMM YYYY")}
                </button>
                <button type="button" onClick={() => setViewMonth((m) => m.add(1, "month"))} aria-label="Next month" className="w-7 h-7 rounded-chip border border-line flex items-center justify-center hover:bg-hair transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAY_LABELS.map((w) => (
                  <div key={w} className="text-center font-body font-semibold text-[9.5px] uppercase text-faint py-1">{w}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {days.map((d) => {
                  const outsideMonth = !d.isSame(viewMonth, "month");
                  const future = isFuture(d);
                  const edge = isRangeEdge(d);
                  const within = inRange(d) && !edge;
                  return (
                    <button
                      key={d.format("YYYY-MM-DD")}
                      type="button"
                      disabled={future}
                      onClick={() => pick(d)}
                      className={[
                        "h-8 rounded-chip font-body text-xs transition-all duration-chip",
                        edge ? "bg-candy-blue border border-candyLine font-bold text-[#1E1B16]" :
                          within ? "bg-candy-blue/25 text-ink" :
                          future ? "text-faint opacity-40 pointer-events-none" :
                          outsideMonth ? "text-faint hover:bg-hair" : "text-ink hover:bg-hair",
                      ].join(" ")}
                    >
                      {d.date()}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <button type="button" onClick={() => setViewYear((y) => y - 1)} aria-label="Previous year" className="w-7 h-7 rounded-chip border border-line flex items-center justify-center hover:bg-hair transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <span className="font-heading font-bold text-sm">{viewYear}</span>
                <button
                  type="button"
                  onClick={() => setViewYear((y) => Math.min(y + 1, today.year()))}
                  disabled={viewYear >= today.year()}
                  aria-label="Next year"
                  className="w-7 h-7 rounded-chip border border-line flex items-center justify-center hover:bg-hair transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MONTH_LABELS.map((m, i) => {
                  const future = viewYear > today.year() || (viewYear === today.year() && i > today.month());
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={future}
                      onClick={() => { setViewMonth(dayjs(`${viewYear}-${String(i + 1).padStart(2, "0")}-01`)); setMode("days"); }}
                      className={[
                        "h-10 rounded-chip font-body font-semibold text-xs transition-all duration-chip",
                        future ? "border border-dashed border-faint text-faint opacity-50 pointer-events-none" : "border border-line hover:bg-hair text-ink",
                      ].join(" ")}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="flex justify-between items-center mt-3.5 pt-3.5 border-t border-line">
            <button type="button" onClick={clear} className="font-body font-semibold text-xs text-muted hover:text-semantic-red transition-colors">
              Clear
            </button>
            <button type="button" onClick={() => setOpen(false)} className="px-3.5 py-1.5 rounded-full border-2 border-candyLine bg-candy-mint font-body font-bold text-xs text-[#1E1B16] shadow-chip hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
