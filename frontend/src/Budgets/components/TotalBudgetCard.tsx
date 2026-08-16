// File: src/Budgets/components/TotalBudgetCard.tsx

import React from 'react';
import { Lock, Unlock } from 'lucide-react';

interface TotalBudgetCardProps {
  totalBudget: number; // This will now be the user's target when unlocked
  onTotalBudgetChange: (newTotal: number | null) => void;
  isLocked: boolean;
  onToggleLock: () => void;
}

const TotalBudgetCard: React.FC<TotalBudgetCardProps> = ({
  totalBudget, onTotalBudgetChange, isLocked, onToggleLock
}) => {

  // This handler correctly handles empty inputs and prevents leading zeros.
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      onTotalBudgetChange(null); // Set state to null for empty input
    } else {
      onTotalBudgetChange(Number(value));
    }
  };

  return (
    <div className={`bg-card rounded-cardLg p-5 flex flex-col gap-2 border-2 transition-colors ${!isLocked ? 'border-candy-blue' : 'border-line'}`}>
      <div className="flex justify-between items-center">
        <h3 className="font-body font-semibold text-[10px] uppercase tracking-[0.14em] text-muted">Total Budget</h3>
        <button onClick={onToggleLock} className="text-muted hover:text-ink transition-colors" aria-label={isLocked ? 'Unlock total budget' : 'Lock total budget'}>
          {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
        </button>
      </div>
      <input
        type="number"
        className="w-full border-none bg-transparent font-money text-[28px] leading-none tracking-[-0.02em] text-ink p-0 focus:outline-none focus:ring-0 disabled:bg-transparent placeholder:font-body placeholder:font-normal placeholder:text-base placeholder:text-faint"
        // If the value is 0, display an empty string to allow typing.
        value={totalBudget === 0 ? '' : totalBudget}
        onChange={handleChange}
        disabled={isLocked}
        placeholder="Set a Target"
        onWheel={(e) => (e.target as HTMLElement).blur()}
      />
    </div>
  );
};

export default TotalBudgetCard;
