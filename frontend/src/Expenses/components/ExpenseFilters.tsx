// File: src/Expenses/components/ExpenseFilters.tsx

import React from 'react';
import type { Category, Account } from '../../types';

interface ExpenseFiltersProps {
  onApplyFilters: () => void;
  onResetFilters: () => void; // Add the new reset prop
  allCategories: Category[];
  allAccounts: Account[];
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  accountId: string;
  setAccountId: (value: string) => void;
  categoryId: string;
  setCategoryId: (value: string) => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  type: string;
  setType: (value: string) => void;
}

// Matches the prototype's typeChips: All / Spend / Income, uniform blue when active.
const TYPE_CHIPS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'debit', label: 'Spend' },
  { value: 'credit', label: 'Income' },
];

const fieldLabel = "font-body font-semibold text-[9.5px] uppercase tracking-[0.14em] text-muted mb-1.5 block";
const fieldInput = "bg-bg border border-line rounded-chip px-3 py-2.5 font-body font-semibold text-xs text-ink outline-none";
const chipBtn = "px-3.5 py-1.5 rounded-full border border-line font-heading font-bold text-[11.5px] whitespace-nowrap transition-all duration-chip";

const ExpenseFilters: React.FC<ExpenseFiltersProps> = ({
    onApplyFilters, onResetFilters, // Use the new reset prop
    allCategories, allAccounts,
    startDate, setStartDate, endDate, setEndDate,
    accountId, setAccountId, categoryId, setCategoryId,
    searchTerm, setSearchTerm, type, setType
}) => {
  // The component is still fully controlled by the parent.
  // The handlers just call the functions passed in as props.

  return (
    <div className="bg-card border-2 border-line rounded-cardLg p-5">
      <div className="flex flex-wrap items-end gap-3.5">
        <div>
          <label className={fieldLabel}>From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={fieldInput} />
        </div>
        <div>
          <label className={fieldLabel}>To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={fieldInput} />
        </div>
        <div>
          <label className={fieldLabel}>Account</label>
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className={`${fieldInput} cursor-pointer`}>
            <option value="">All accounts</option>
            {allAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
          </select>
        </div>
        <div>
          <label className={fieldLabel}>Type</label>
          <div className="flex gap-1.5">
            {TYPE_CHIPS.map(chip => {
              const active = type === chip.value;
              return (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => setType(chip.value)}
                  className={[chipBtn, active ? "bg-candy-blue text-white shadow-chip" : "bg-hair text-ink"].join(" ")}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className={fieldLabel}>Search</label>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Merchant, UPI ref, note…"
            className="w-full bg-bg border border-line rounded-full px-4 py-2.5 font-body font-medium text-xs text-ink outline-none"
          />
        </div>
        <button
          type="button"
          onClick={onResetFilters}
          className="px-4 py-2.5 rounded-full border border-line bg-hair font-heading font-bold text-xs text-ink hover:opacity-75 transition-opacity"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onApplyFilters}
          className="px-5 py-2.5 rounded-full border border-line bg-candy-yellow font-heading font-bold text-xs text-[#1E1B16] shadow-chip hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press"
        >
          Apply
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mt-4 pt-3.5 border-t border-line">
        <button
          type="button"
          onClick={() => setCategoryId('')}
          className={[chipBtn, categoryId === '' ? "bg-candy-yellow text-[#1E1B16] shadow-chip" : "bg-hair text-ink"].join(" ")}
        >
          ⊞ All categories
        </button>
        {allCategories.map(cat => {
          const active = categoryId === String(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryId(String(cat.id))}
              className={[chipBtn, active ? "bg-candy-yellow text-[#1E1B16] shadow-chip" : "bg-hair text-ink"].join(" ")}
            >
              {cat.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
export default ExpenseFilters;
