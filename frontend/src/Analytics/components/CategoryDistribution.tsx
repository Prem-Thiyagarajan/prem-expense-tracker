// File: src/Analytics/components/CategoryDistribution.tsx

import React from 'react';
import type { CategoryDistributionPoint } from '../../types';
import { formatCurrency } from '../../utils/formatter';

interface Props {
  data: CategoryDistributionPoint[];
}

// Category colours per handoff/README.md §Category colours + icons -- shared
// vocabulary with Dashboard/components/TopSpendCategoriesChart.tsx's CATEGORY_COLORS.
const CATEGORY_COLORS: { [key: string]: string } = {
  'Food': '#FF8787', 'Bills': '#5C7CFA', 'Travel': '#FFD43B', 'Shopping': '#C7F0DB',
  'Transfers': '#C7F0DB', 'Health & Wellness': '#C7F0DB', 'Healthcare': '#C7F0DB',
  'Personal Care': '#FFD6E8', 'Education': '#D0BFFF', 'Entertainment': '#D0BFFF',
  'House Work': '#E8E2D4', 'Miscellaneous': '#E8E2D4', 'Rent': '#5C7CFA',
  'Transportation': '#FFD43B', 'Services': '#D0BFFF', 'default': '#E8E2D4',
};

const formatWhole = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const CategoryDistribution: React.FC<Props> = ({ data = [] }) => {
  const totalSpend = data.reduce((sum, cat) => sum + cat.total, 0);
  const sorted = [...data].sort((a, b) => b.percentage - a.percentage);

  return (
    <div className="bg-card border-2 border-line rounded-cardLg p-5 h-full flex flex-col">
      <div className="flex justify-between items-baseline border-b-2 border-line pb-3">
        <h3 className="font-heading font-bold text-base">Category Distribution</h3>
        <span className="font-money text-sm tracking-[-0.02em]">{formatWhole(totalSpend)}</span>
      </div>
      <div className="flex flex-col gap-3.5 overflow-y-auto pr-1 flex-1 mt-3.5">
        {sorted.length > 0 ? sorted.map((cat) => (
          <div key={cat.category}>
            <div className="flex justify-between items-baseline gap-3">
              <span className="font-heading font-bold text-[13px]">
                {cat.category}
                <span className="font-body font-medium text-[11px] text-muted ml-1.5">({formatCurrency(cat.total)})</span>
              </span>
              <span className="font-money text-[13px] tracking-[-0.02em] whitespace-nowrap">{cat.percentage.toFixed(1)}%</span>
            </div>
            <div className="h-3.5 rounded-full bg-hair border border-line mt-1.5 overflow-hidden">
              <div
                className="h-full border-r border-line"
                style={{ width: `${Math.min(100, cat.percentage)}%`, background: CATEGORY_COLORS[cat.category] || CATEGORY_COLORS.default }}
              />
            </div>
          </div>
        )) : (
          <p className="text-center font-body text-muted py-6">No category data for this period.</p>
        )}
      </div>
    </div>
  );
};
export default CategoryDistribution;
