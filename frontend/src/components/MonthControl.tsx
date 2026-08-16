// File: src/components/MonthControl.tsx
// Shared month-scoped nav control: `‹ ›` still pages one month at a time, the
// label itself (yellow underline) opens MonthPickerModal. Drop-in replacement
// for the old per-page MonthFilter / BudgetMonthFilter, backed by MonthContext
// (handoff/README.md §Navigation).
import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMonth } from "./MonthContext";

function formatDisplayDate(monthString: string): string {
  const date = new Date(`${monthString}-01T12:00:00Z`);
  return date.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

const MonthControl: React.FC = () => {
  const { month, stepMonth, openPicker } = useMonth();

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => stepMonth(-1)}
        aria-label="Previous month"
        className="w-9 h-9 rounded-full border-1.5 border-line flex items-center justify-center hover:bg-hair transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        onClick={openPicker}
        className="font-heading font-extrabold text-lg px-1 [text-decoration:underline] decoration-candy-yellow decoration-4 underline-offset-4"
      >
        {formatDisplayDate(month)}
      </button>
      <button
        onClick={() => stepMonth(1)}
        aria-label="Next month"
        className="w-9 h-9 rounded-full border-1.5 border-line flex items-center justify-center hover:bg-hair transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default MonthControl;
