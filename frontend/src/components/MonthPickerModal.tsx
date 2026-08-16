// File: src/components/MonthPickerModal.tsx
// Year stepper (next-year arrow disabled at the current year) over a 3x4
// month grid; future months are dashed/inert; the selected month gets the
// blue candy fill. handoff/README.md §Navigation + §Overlays (radius 24,
// 6x6 shadow, 45% ink scrim).
import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useMonth } from "./MonthContext";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const MonthPickerModal: React.FC = () => {
  const { month, setMonth, isPickerOpen, closePicker } = useMonth();
  const [selectedYear, selectedMonthIndex] = month.split("-").map(Number).map((n, i) => (i === 1 ? n - 1 : n));
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthIndex = today.getMonth();

  const [viewYear, setViewYear] = useState(selectedYear);

  // Re-sync the browsed year to the selection every time the modal opens.
  useEffect(() => {
    if (isPickerOpen) setViewYear(selectedYear);
  }, [isPickerOpen, selectedYear]);

  if (!isPickerOpen) return null;

  const isFuture = (monthIndex: number) =>
    viewYear > currentYear || (viewYear === currentYear && monthIndex > currentMonthIndex);

  const pick = (monthIndex: number) => {
    if (isFuture(monthIndex)) return;
    setMonth(`${viewYear}-${String(monthIndex + 1).padStart(2, "0")}`);
    closePicker();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--scrim)" }}
      onClick={closePicker}
    >
      <div
        className="w-full max-w-sm rounded-pickerSheet border-2 border-line bg-card shadow-sheet p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <span className="font-body font-semibold text-[9.5px] uppercase tracking-[0.14em] text-muted">
            Pick a month
          </span>
          <button
            onClick={closePicker}
            aria-label="Close"
            className="w-8 h-8 rounded-full border-2 border-line flex items-center justify-center hover:bg-hair transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => setViewYear((y) => y - 1)}
            aria-label="Previous year"
            className="w-9 h-9 rounded-chip border-2 border-line flex items-center justify-center hover:bg-hair transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-heading font-extrabold text-lg">{viewYear}</span>
          <button
            onClick={() => setViewYear((y) => Math.min(y + 1, currentYear))}
            disabled={viewYear >= currentYear}
            aria-label="Next year"
            className="w-9 h-9 rounded-chip border-2 border-line flex items-center justify-center hover:bg-hair transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {MONTH_LABELS.map((label, monthIndex) => {
            const future = isFuture(monthIndex);
            const selected = viewYear === selectedYear && monthIndex === selectedMonthIndex;
            return (
              <button
                key={label}
                onClick={() => pick(monthIndex)}
                disabled={future}
                className={[
                  "h-12 rounded-chip font-body font-semibold text-sm transition-all duration-chip",
                  selected
                    ? "bg-candy-blue border-2 border-candyLine text-[#1E1B16] shadow-card"
                    : future
                    ? "border border-dashed border-faint text-faint opacity-50 pointer-events-none"
                    : "border-1.5 border-line hover:bg-hair",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MonthPickerModal;
