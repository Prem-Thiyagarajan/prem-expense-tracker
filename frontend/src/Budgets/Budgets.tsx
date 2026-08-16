// File: src/Budgets/Budgets.tsx

import React, { useState, useEffect } from 'react';
import { getBudgetPlan, saveBudgetPlan, deleteBudgetPlan } from '../api/apiClient';
import type { BudgetPageData, BudgetPlanItem } from '../types';
import toast from 'react-hot-toast';
import { useMonth } from '../components/MonthContext';
import MonthControl from '../components/MonthControl';

import SmartEmptyState from './components/SmartEmptyState';
import MonitoringView from './components/MonitoringView';
import SetupModal from './components/SetupModal';
import ConfirmModal from '../components/ui/ConfirmModal';

const Budgets: React.FC = () => {
    const { month: currentMonth } = useMonth();
    const [data, setData] = useState<BudgetPageData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

    const isPastMonth = (): boolean => {
        const today = new Date();
        const firstDayOfSelectedMonth = new Date(parseInt(currentMonth.substring(0, 4)), parseInt(currentMonth.substring(5, 7)) - 1, 1);
        const firstDayOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        return firstDayOfSelectedMonth < firstDayOfCurrentMonth;
    };

    const fetchBudgetPlan = async (month: string) => {
        try {
            setIsLoading(true);
            setError(null);
            const result = await getBudgetPlan(month);
            setData(result);
        } catch (err) {
            setError("Could not load budget plan.");
            setData(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBudgetPlan(currentMonth);
    }, [currentMonth]);

    const handleSaveChanges = async (planToSave: BudgetPlanItem[]) => {
        setIsSetupModalOpen(false);
        const toastId = toast.loading("Saving budget plan...");
        try {
            const payload = {
                month: currentMonth,
                budgets: planToSave.map(item => ({
                    category_id: item.categoryId,
                    limit_amount: item.budget,
                })),
            };
            await saveBudgetPlan(payload);
            toast.success("Budget saved successfully!", { id: toastId });
            fetchBudgetPlan(currentMonth);
        } catch (err) {
            toast.error("Could not save the budget plan.", { id: toastId });
        }
    };

    const handleDeletePlan = async () => {
        setIsConfirmDeleteOpen(false);
        const toastId = toast.loading("Deleting budget plan...");
        try {
            await deleteBudgetPlan(currentMonth);
            toast.success("Plan deleted successfully!", { id: toastId });
            fetchBudgetPlan(currentMonth);
        } catch (err) {
            toast.error("Failed to delete plan.", { id: toastId });
        }
    };

    const getInitialModalData = (): BudgetPlanItem[] => {
        if (data?.plan) {
            return data.plan;
        }
        if (data?.historicalData) {
            return data.historicalData.suggestedBudgets.map(s => ({
                categoryId: s.categoryId, categoryName: s.categoryName, icon_name: s.icon_name,
                budget: 0, spent: s.currentSpend, suggestedBudget: s.suggestedAmount,
                remaining: 0, progress: 0,
            }));
        }
        return [];
    };

    const renderContent = () => {
        if (isLoading) return <div className="p-8 text-center font-body font-semibold text-ink">Loading Budgets...</div>;
        if (error) return <div className="p-4 text-center font-body text-semantic-red bg-candy-coral/20 border-2 border-candyLine rounded-card">{error}</div>;
        if (!data) return null;

        if (data.plan) {
            return <MonitoringView data={data.plan} pacingData={data.pacingData || []} onEdit={() => setIsSetupModalOpen(true)} onDelete={() => setIsConfirmDeleteOpen(true)} isPastMonth={isPastMonth()} />;
        }
        if (data.historicalData) {
            return <SmartEmptyState data={data.historicalData} onCreate={() => setIsSetupModalOpen(true)} isPastMonth={isPastMonth()} />;
        }
        return <div className="p-8 text-center font-body text-muted">No budget data available.</div>;
    };

    return (
        <>
            <div className="max-w-content mx-auto p-4 md:p-6 lg:p-8 space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="font-heading font-extrabold text-[32px] leading-none tracking-[-0.02em] text-ink">Budgets</h1>
                        <p className="font-body text-sm text-muted mt-2">Plan your spend and track it against your categories.</p>
                    </div>
                    <MonthControl />
                </div>
                {renderContent()}
            </div>
            {data && (
                <SetupModal
                    isOpen={isSetupModalOpen}
                    onClose={() => setIsSetupModalOpen(false)}
                    onSave={handleSaveChanges}
                    initialData={getInitialModalData()}
                    month={currentMonth}
                />
            )}
            <ConfirmModal
                isOpen={isConfirmDeleteOpen}
                onClose={() => setIsConfirmDeleteOpen(false)}
                onConfirm={handleDeletePlan}
                title="Delete Budget Plan"
                message={`Are you sure you want to permanently delete your budget for ${new Date(currentMonth + '-02').toLocaleString('default', { month: 'long', year: 'numeric' })}? This action cannot be undone.`}
            />
        </>
    );
};

export default Budgets;
