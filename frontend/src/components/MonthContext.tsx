// File: src/components/MonthContext.tsx
// Shared {year, month} selection for every month-scoped screen (Dashboard,
// Analytics "month" mode, Budgets) plus the picker-modal open state, per
// handoff/README.md §Navigation ("one month control ... shared by Dashboard /
// Analytics / Budgets"). Value is kept as a "YYYY-MM" string -- the format
// every existing page/API call already uses -- so pages can adopt this
// context with a find/replace of their local useState, nothing more.
import React, { createContext, useContext, useMemo, useState } from "react";

function currentMonthString(): string {
  return new Date().toISOString().slice(0, 7);
}

interface MonthContextValue {
  /** "YYYY-MM" */
  month: string;
  setMonth: (month: string) => void;
  /** Step by whole months; clamps at the current month (can't page into the future). */
  stepMonth: (delta: -1 | 1) => void;
  isPickerOpen: boolean;
  openPicker: () => void;
  closePicker: () => void;
}

const MonthContext = createContext<MonthContextValue | undefined>(undefined);

export const MonthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [month, setMonth] = useState(currentMonthString);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const stepMonth = (delta: -1 | 1) => {
    const [y, m] = month.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1 + delta, 1));
    const next = date.toISOString().slice(0, 7);
    // Never page past the current real month.
    if (next > currentMonthString()) return;
    setMonth(next);
  };

  const value = useMemo(
    () => ({
      month,
      setMonth,
      stepMonth,
      isPickerOpen,
      openPicker: () => setIsPickerOpen(true),
      closePicker: () => setIsPickerOpen(false),
    }),
    [month, isPickerOpen]
  );

  return <MonthContext.Provider value={value}>{children}</MonthContext.Provider>;
};

export function useMonth(): MonthContextValue {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error("useMonth must be used within a MonthProvider");
  return ctx;
}
