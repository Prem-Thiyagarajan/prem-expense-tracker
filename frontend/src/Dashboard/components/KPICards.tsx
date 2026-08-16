// File: src/Dashboard/components/KPICards.tsx

import React from 'react';
import { CalendarDays, TrendingUp } from 'lucide-react';

// The hero card (Dashboard.tsx) now owns total spend + delta; this row is
// just the two supporting KPIs per handoff/README.md §1 Dashboard.
interface KPICardsProps {
  dailyAverage: number;
  projectedSpend: number;
}

const formatCurrency = (value: number) => (
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
);

const KPICards: React.FC<KPICardsProps> = ({ dailyAverage, projectedSpend }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-[18px]">
      <div className="bg-card border-2 border-line rounded-cardLg p-5 flex justify-between items-center">
        <div>
          <p className="font-body font-semibold text-[9.5px] uppercase tracking-[0.14em] text-muted">Daily Average</p>
          <p className="font-money text-[28px] leading-none tracking-[-0.02em] mt-2">{formatCurrency(dailyAverage)}</p>
          <p className="text-xs font-body text-faint mt-1.5">Your current burn rate.</p>
        </div>
        <div className="w-10 h-10 rounded-chip border-1.5 border-line flex items-center justify-center shrink-0">
          <CalendarDays size={18} />
        </div>
      </div>

      <div className="bg-candy-pink border-2 border-line rounded-cardLg shadow-card p-5 flex justify-between items-center text-[#1E1B16]">
        <div>
          <p className="font-body font-semibold text-[9.5px] uppercase tracking-[0.14em]">Projected Spend</p>
          <p className="font-money text-[28px] leading-none tracking-[-0.02em] mt-2">{formatCurrency(projectedSpend)}</p>
          <p className="text-xs font-body opacity-70 mt-1.5">Forecast based on current pace.</p>
        </div>
        <div className="w-10 h-10 rounded-chip border-1.5 border-line bg-card flex items-center justify-center shrink-0">
          <TrendingUp size={18} />
        </div>
      </div>
    </div>
  );
};

export default KPICards;
