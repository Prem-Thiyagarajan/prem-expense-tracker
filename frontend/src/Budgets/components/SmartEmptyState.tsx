// File: src/Budgets/components/SmartEmptyState.tsx

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { BudgetEmptyStateData } from '../../types';
import { formatCurrency } from '../../utils/formatter';
import { getCategoryIcon } from '../../utils/iconHelper';

interface Props {
  data: BudgetEmptyStateData;
  onCreate: () => void;
  isPastMonth: boolean;
}

const SmartEmptyState: React.FC<Props> = ({ data, onCreate, isPastMonth }) => {
    return (
        <div className="space-y-6">
            {/* Dashed = empty/actionable: no plan exists for this month yet. */}
            <div className="text-center bg-card border-2 border-dashed border-line rounded-cardLg p-6">
                <h2 className="font-heading font-extrabold text-2xl text-ink">Ready to Take Control of Your Spending?</h2>
                <p className="font-body text-sm text-muted mt-1.5">Let's build a smart budget for this month based on your recent habits.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
                <div className="bg-card border-2 border-line rounded-cardLg p-5">
                    <h3 className="font-heading font-bold text-base flex items-center gap-2 text-ink"><TrendingUp size={18} /> Insights From Your History</h3>
                    <p className="font-body text-xs text-muted mb-4 mt-1">Based on your spending in the last 3 months.</p>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.historicalSpend} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <XAxis dataKey="month" tickFormatter={(m) => new Date(m + '-02').toLocaleString('default', { month: 'short' })} tick={{ fontSize: 12, fill: 'var(--color-faint)' }} axisLine={{ stroke: 'var(--color-ink)', strokeWidth: 2 }} tickLine={false} />
                                <YAxis tickFormatter={(val) => `₹${val/1000}k`} tick={{ fontSize: 12, fill: 'var(--color-faint)' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--color-card)', border: '2px solid var(--color-line)', borderRadius: 12, fontFamily: 'Archivo, sans-serif' }}
                                    formatter={(value: number) => [formatCurrency(value), "Total Spend"]}
                                />
                                <Bar dataKey="totalSpend" fill="#5C7CFA" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-center font-body text-sm mt-2 text-ink">Your average monthly spend was: <span className="font-money text-sm">{formatCurrency(data.averageTotalSpend)}</span></p>
                </div>
                <div className="bg-card border-2 border-line rounded-cardLg p-5">
                    <h3 className="font-heading font-bold text-base text-ink">Your Suggested Starting Plan</h3>
                    <p className="font-body text-xs text-muted mb-4 mt-1">Use these as a starting point to build your budget.</p>
                    <div className="space-y-2 overflow-y-auto max-h-56 pr-2">
                        {data.suggestedBudgets.map(s => (
                            <div key={s.categoryId} className="flex justify-between items-center bg-hair rounded-chip px-3 py-2">
                                <div className="flex items-center gap-3 font-body font-medium text-sm text-ink">{getCategoryIcon(s.categoryName, s.icon_name)} <span>{s.categoryName}</span></div>
                                <span className="font-money text-sm">{formatCurrency(s.suggestedAmount)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="text-center">
                <button
                    onClick={onCreate}
                    disabled={isPastMonth}
                    className="font-heading font-bold text-sm px-8 py-3.5 rounded-chip border-2 border-candyLine bg-candy-blue text-[#1E1B16] shadow-card hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-card"
                >
                    {isPastMonth ? 'Cannot Budget for Past Months' : 'Create Monthly Budget'}
                </button>
            </div>
        </div>
    );
};

export default SmartEmptyState;
