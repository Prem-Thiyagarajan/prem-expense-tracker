// File: src/Budgets/components/BillRadarCard.tsx
// Mint "Bill radar" card -- handoff/README.md §Screens item 5: per-bill name +
// due date, overdue rows red, expected total in header, card omitted entirely
// when the (month-filtered, active) bill list is empty. Sourced from
// GET /subscriptions (Subscription[]), not the handoff doc's invented
// /bills/upcoming endpoint -- see WEB_REDESIGN_BRIEF.md's corrections.
import React from 'react';
import type { Subscription } from '../../types';
import { formatCurrency } from '../../utils/formatter';

interface Props {
  subscriptions: Subscription[];
  month: string; // "YYYY-MM" -- from the shared MonthContext
}

const formatDueDate = (iso: string): string =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

const BillRadarCard: React.FC<Props> = ({ subscriptions, month }) => {
  // "This month's bills": whichever cycle is currently tracked (overdue takes
  // priority over upcoming) falls inside the selected month. Inactive
  // subscriptions are already excluded by the getSubscriptions(false) fetch.
  const bills = subscriptions
    .map(s => {
      const overdue = !!s.overdue_due_date;
      const dueDate = s.overdue_due_date || s.upcoming_due_date;
      return { sub: s, overdue, dueDate };
    })
    .filter(b => b.dueDate && b.dueDate.slice(0, 7) === month)
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return a.dueDate.localeCompare(b.dueDate);
    });

  if (bills.length === 0) return null;

  const expectedTotal = bills.reduce((sum, b) => sum + b.sub.amount, 0);

  return (
    <div className="bg-candy-mint border-2 border-candyLine rounded-cardLg shadow-card p-5 text-[#1E1B16]">
      <div className="flex flex-wrap justify-between items-baseline gap-2 border-b-2 border-candyLine pb-3">
        <h2 className="font-heading font-extrabold text-base">📡 Bill radar — incoming</h2>
        <span className="font-body font-semibold text-[10px] uppercase tracking-[0.12em] text-[#3E5C4B]">
          {formatCurrency(expectedTotal)} expected
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 mt-1">
        {bills.map(({ sub, overdue, dueDate }) => (
          <div key={sub.id} className="flex items-center gap-3 border-b border-candyLine/20 py-2.5">
            <span className="flex-1 min-w-0">
              <span className="block font-heading font-bold text-[13.5px] truncate">{sub.name}</span>
              <span className={`block font-body font-semibold text-[10.5px] mt-0.5 ${overdue ? 'text-semantic-red' : 'text-[#3E5C4B]'}`}>
                {overdue ? `Overdue since ${formatDueDate(dueDate)}` : `Due ${formatDueDate(dueDate)}`}
              </span>
            </span>
            <span className={`font-money text-base whitespace-nowrap ${overdue ? 'text-semantic-red' : ''}`}>
              {formatCurrency(sub.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BillRadarCard;
