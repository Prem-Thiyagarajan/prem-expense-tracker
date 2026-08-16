// File: src/Budgets/components/BudgetsKPICards.tsx

import React from 'react';

// Define the shape of the props this component expects
interface BudgetsKPICardsProps {
  totalBudget: number;
  totalSpent: number;
  moneyRemaining: number;
}

const formatCurrency = (value: number) => (
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
);

const BudgetsKPICards: React.FC<BudgetsKPICardsProps> = ({
  totalBudget,
  totalSpent,
  moneyRemaining,
}) => {
  const isOverBudget = moneyRemaining < 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px]">
      {/* Total Budget Card */}
      <div className="bg-card border-2 border-line rounded-cardLg p-5">
        <h3 className="font-body font-semibold text-[10px] uppercase tracking-[0.14em] text-muted">Total Budget</h3>
        <p className="font-money text-[28px] leading-none tracking-[-0.02em] mt-3">{formatCurrency(totalBudget)}</p>
      </div>

      {/* Total Spent Card */}
      <div className="bg-card border-2 border-line rounded-cardLg p-5">
        <h3 className="font-body font-semibold text-[10px] uppercase tracking-[0.14em] text-muted">Total Spent</h3>
        <p className="font-money text-[28px] leading-none tracking-[-0.02em] mt-3">{formatCurrency(totalSpent)}</p>
      </div>

      {/* Money Remaining Card */}
      <div className={isOverBudget ? "bg-candy-coral border-2 border-candyLine rounded-cardLg shadow-card p-5 text-[#1E1B16]" : "bg-card border-2 border-line rounded-cardLg p-5"}>
        <h3 className={isOverBudget ? "font-body font-semibold text-[10px] uppercase tracking-[0.14em]" : "font-body font-semibold text-[10px] uppercase tracking-[0.14em] text-muted"}>Money Remaining</h3>
        <p className={`font-money text-[28px] leading-none tracking-[-0.02em] mt-3 ${isOverBudget ? '' : 'text-semantic-green'}`}>
          {formatCurrency(moneyRemaining)}
        </p>
      </div>
    </div>
  );
};

export default BudgetsKPICards;
