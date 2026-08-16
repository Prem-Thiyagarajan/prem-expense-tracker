// File: src/Budgets/components/SetupModal.tsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import LargeModal from '../../components/ui/LargeModal';
import TotalBudgetCard from './TotalBudgetCard';
import CategoryBudgetCard from './CategoryBudgetCard';
import type { BudgetPlanItem } from '../../types';
import { formatCurrency } from '../../utils/formatter';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (plan: BudgetPlanItem[]) => void;
  initialData: BudgetPlanItem[];
  month: string;
}

const SetupModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialData, month }) => {
    const [plan, setPlan] = useState<BudgetPlanItem[]>([]);
    const [totalTargetBudget, setTotalTargetBudget] = useState<number | null>(null);
    const [isLocked, setIsLocked] = useState(true);

    // This effect ONLY depends on `isOpen`. It runs ONLY when the modal opens,
    // avoiding a scrolling bug from re-running on every plan edit.
    useEffect(() => {
        if (isOpen) {
            setPlan(initialData);
            const initialTotal = initialData.reduce((sum, item) => sum + item.budget, 0);
            setTotalTargetBudget(initialTotal > 0 ? initialTotal : null);
            setIsLocked(initialTotal > 0);
        }
    }, [isOpen]);

    const handleBudgetChange = (categoryId: number, newBudget: number) => {
        setPlan(currentPlan => currentPlan.map(item => item.categoryId === categoryId ? { ...item, budget: newBudget } : item));
    };

    const handleSave = () => {
        onSave(plan);
    };

    const totalBudgetFromCategories = plan.reduce((sum, item) => sum + item.budget, 0);
    const difference = totalBudgetFromCategories - (totalTargetBudget ?? 0);

    return (
        <LargeModal isOpen={isOpen} onClose={onClose} title={`Budget for ${new Date(month + '-02').toLocaleString('default', { month: 'long', year: 'numeric' })}`}>
            <div className="space-y-5">
                <TotalBudgetCard
                    totalBudget={isLocked ? totalBudgetFromCategories : (totalTargetBudget ?? 0)}
                    onTotalBudgetChange={setTotalTargetBudget}
                    isLocked={isLocked}
                    onToggleLock={() => setIsLocked(!isLocked)}
                />
                {!isLocked && totalTargetBudget !== null && (
                    <div className="text-center font-body text-sm text-ink bg-hair border-1.5 border-line rounded-chip py-2.5 px-3">
                        Target: <span className="font-heading font-bold">{formatCurrency(totalTargetBudget)}</span>
                        {' '}&middot;{' '}
                        Allocated: <span className="font-heading font-bold">{formatCurrency(totalBudgetFromCategories)}</span>
                        <span className={difference !== 0 ? 'text-semantic-red' : 'text-semantic-green'}>
                            {' '}(Difference: {formatCurrency(difference)})
                        </span>
                    </div>
                )}
                <div className="flex justify-between items-center border-t-2 border-line pt-4">
                    <h3 className="font-heading font-bold text-lg text-ink">Category Budgets</h3>
                    <Link to="/settings" className="text-sm font-body font-semibold text-link hover:underline">
                        + Add New Category in Settings
                    </Link>
                </div>
                <div className="bg-hair rounded-card p-2 space-y-2 max-h-[45vh] overflow-y-auto pr-2">
                    {plan.map(item => <CategoryBudgetCard key={item.categoryId} item={item} onBudgetChange={handleBudgetChange} />)}
                </div>
                <div className="flex justify-end gap-2.5 pt-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-full border-1.5 border-line font-body font-semibold text-sm hover:bg-hair transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="px-4 py-2 rounded-chip border-2 border-line bg-ink text-bg font-heading font-bold text-sm shadow-chip hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press">
                        Save All Changes
                    </button>
                </div>
            </div>
        </LargeModal>
    );
};

export default SetupModal;
