// File: src/Budgets/components/CategoryBudgetCard.tsx

import React from 'react';
import type { BudgetPlanItem } from '../../types';
import { getCategoryIcon } from '../../utils/iconHelper';
import { formatCurrency } from '../../utils/formatter';

interface CategoryBudgetCardProps {
  item: BudgetPlanItem;
  onBudgetChange: (categoryId: number, newBudget: number) => void;
}

const CategoryBudgetCard: React.FC<CategoryBudgetCardProps> = ({ item, onBudgetChange }) => {
  const remaining = item.budget - item.spent;
  const isOverspent = remaining < 0;

  return (
    <div className="w-full bg-card rounded-chip border-1.5 border-line p-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 w-1/4 min-w-0">
        {getCategoryIcon(item.categoryName, item.icon_name)}
        <span className="font-heading font-semibold text-sm text-ink truncate">{item.categoryName}</span>
      </div>
      <div className="flex-1 grid grid-cols-3 items-center gap-4 text-center">
        <div>
          <label className="font-body text-[10px] uppercase tracking-[0.1em] text-muted">Budget</label>
          <input
            type="number"
            value={item.budget === 0 ? '' : item.budget}
            onChange={(e) => onBudgetChange(item.categoryId, Number(e.target.value) || 0)}
            className="w-full text-center border-1.5 border-line rounded-chip p-1.5 mt-1 font-money text-sm text-ink bg-card focus:outline-none focus:border-candy-blue placeholder:text-xs placeholder:font-body placeholder:font-normal placeholder:text-faint"
            placeholder={item.suggestedBudget ? `e.g., ${item.suggestedBudget}` : 'Set Budget'}
            onWheel={(e) => (e.target as HTMLElement).blur()}
          />
        </div>
        <div>
          <p className="font-body text-[10px] uppercase tracking-[0.1em] text-muted">Spent</p>
          <p className="mt-1.5 font-money text-sm text-ink">{formatCurrency(item.spent)}</p>
        </div>
        <div>
          <p className={`font-body font-semibold text-[10px] uppercase tracking-[0.1em] ${isOverspent ? 'text-semantic-red' : 'text-semantic-green'}`}>
            {isOverspent ? 'Overspent' : 'Remaining'}
          </p>
          <p className={`mt-1.5 font-money text-sm ${isOverspent ? 'text-semantic-red' : 'text-semantic-green'}`}>
            {formatCurrency(remaining)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CategoryBudgetCard;
