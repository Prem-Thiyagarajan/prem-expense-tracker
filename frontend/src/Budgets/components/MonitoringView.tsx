// File: src/Budgets/components/MonitoringView.tsx

import React from 'react';
import type { BudgetPlanItem, BudgetPacingPoint } from '../../types';
import { formatCurrency } from '../../utils/formatter';
import { getCategoryIcon } from '../../utils/iconHelper';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, BarChart, Bar, ReferenceLine } from "recharts";
import { Trash2, Edit } from 'lucide-react'; // Using Edit icon for clarity

interface Props {
  data: BudgetPlanItem[];
  pacingData: BudgetPacingPoint[];
  onEdit: () => void;
  onDelete: () => void;
  isPastMonth: boolean;
}

// Donut slices: candy palette in priority order, per handoff/README.md §Candy accents.
const DONUT_COLORS = ['#5C7CFA', '#C7F0DB', '#FFD43B', '#FF8787', '#D0BFFF', '#E8E2D4', '#A1A1AA'];

// Large-negative pattern (handoff/README.md §5 Budgets): compacted Archivo Black
// figure + exact JetBrains Mono value beside it. Applied to every KPI here so
// "Total Budget" / "Total Spent" read the same way when they cross ₹1L.
const formatCompact = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  return `${sign}₹${abs.toLocaleString('en-IN')}`;
};

const formatExact = (value: number): string => {
  const sign = value < 0 ? '−' : '';
  return `${sign}₹${Math.abs(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const MonitoringView: React.FC<Props> = ({ data, pacingData, onEdit, onDelete, isPastMonth }) => {
    const totalBudget = data.reduce((sum, item) => sum + item.budget, 0);
    const totalSpent = data.reduce((sum, item) => sum + item.spent, 0);
    const moneyRemaining = totalBudget - totalSpent;
    const isOverBudget = moneyRemaining < 0;
    const percentOver = isOverBudget && totalBudget > 0
        ? Math.round((Math.abs(moneyRemaining) / totalBudget) * 100)
        : null;

    const daysInMonth = pacingData.length > 0 ? pacingData.length : 30;
    const idealDailySpend = totalBudget > 0 ? totalBudget / daysInMonth : 0;
    const chartPacingData = pacingData.map(p => ({
        ...p,
        budgetPace: p.day * idealDailySpend
    }));

    const sortedByBudget = [...data].sort((a,b) => b.budget - a.budget);
    const topCategoriesForDonut = sortedByBudget.slice(0, 5);
    const otherBudget = sortedByBudget.slice(5).reduce((sum, item) => sum + item.budget, 0);
    const donutChartData = [...topCategoriesForDonut.map(c => ({ name: c.categoryName, value: c.budget }))];
    if (otherBudget > 0) {
        donutChartData.push({ name: 'Other', value: otherBudget });
    }

    // Filter out items that will last indefinitely or have no budget, sort by
    // which budget will deplete fastest, and take only the top 6-7 categories.
    const depletionData = [...data]
        .filter(item => item.daysLeft !== null && item.daysLeft !== undefined && item.daysLeft >= 0 && item.daysLeft < 999)
        .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999))
        .slice(0, 7); // Show the 7 most at-risk categories

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-3 border-b-2 border-line pb-4">
                <h2 className="font-heading font-extrabold text-xl text-ink">Budget Overview</h2>
                <div className="flex items-center gap-2.5">
                    <button
                        onClick={onDelete}
                        disabled={isPastMonth}
                        className="flex items-center gap-1.5 font-body font-semibold text-xs px-4 py-2.5 rounded-full border-1.5 border-semantic-red text-semantic-red hover:bg-candy-coral/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                        <Trash2 size={15} /> Delete plan
                    </button>
                    <button
                        onClick={onEdit}
                        disabled={isPastMonth}
                        className="flex items-center gap-2 font-heading font-bold text-sm px-4 py-2.5 rounded-chip border-2 border-line bg-ink text-bg shadow-chip hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-chip"
                    >
                        <Edit size={15}/> {isPastMonth ? 'Archived' : 'Edit budget'}
                    </button>
                </div>
            </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px]">
                <div className="bg-card border-2 border-line rounded-cardLg p-5">
                    <h3 className="font-body font-semibold text-[10px] uppercase tracking-[0.14em] text-muted">Total Budget</h3>
                    <p className="font-money text-[28px] leading-none tracking-[-0.02em] mt-3">{formatCompact(totalBudget)}</p>
                    <p className="font-mono text-[11px] text-faint mt-2">{formatExact(totalBudget)}</p>
                </div>
                <div className="bg-card border-2 border-line rounded-cardLg p-5">
                    <h3 className="font-body font-semibold text-[10px] uppercase tracking-[0.14em] text-muted">Total Spent</h3>
                    <p className="font-money text-[28px] leading-none tracking-[-0.02em] mt-3">{formatCompact(totalSpent)}</p>
                    <p className="font-mono text-[11px] text-faint mt-2">{formatExact(totalSpent)}</p>
                </div>

                {isOverBudget ? (
                    <div className="bg-candy-coral border-2 border-candyLine rounded-cardLg shadow-card p-5 text-[#1E1B16]">
                        <div className="flex justify-between items-center gap-2">
                            <h3 className="font-body font-semibold text-[10px] uppercase tracking-[0.14em]">Money Remaining</h3>
                            {percentOver !== null && (
                                <span className="font-heading font-bold text-[10px] bg-card border-1.5 border-line rounded-full px-2.5 py-1 whitespace-nowrap">
                                    {percentOver.toLocaleString('en-IN')}% over
                                </span>
                            )}
                        </div>
                        <div className="flex items-baseline gap-2.5 mt-3 flex-wrap">
                            <span className="font-money text-[28px] leading-none tracking-[-0.02em]">{formatCompact(moneyRemaining)}</span>
                            <span className="font-mono text-[11px] text-[#5B2020]">{formatExact(moneyRemaining)}</span>
                        </div>
                    </div>
                ) : (
                    <div className="bg-card border-2 border-line rounded-cardLg p-5">
                        <h3 className="font-body font-semibold text-[10px] uppercase tracking-[0.14em] text-muted">Money Remaining</h3>
                        <div className="flex items-baseline gap-2.5 mt-3 flex-wrap">
                            <span className="font-money text-[28px] leading-none tracking-[-0.02em] text-semantic-green">{formatCompact(moneyRemaining)}</span>
                            <span className="font-mono text-[11px] text-faint">{formatExact(moneyRemaining)}</span>
                        </div>
                    </div>
                )}
            </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
                <div className="bg-card border-2 border-line rounded-cardLg p-5 h-80 flex flex-col">
                    <h2 className="font-heading font-extrabold text-base border-b-2 border-line pb-3">Budget vs. Actual Spend</h2>
                    <div className="flex-1 mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartPacingData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="8 6" stroke="var(--color-hair)" strokeWidth={1.5} vertical={false} />
                                <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--color-faint)' }} axisLine={{ stroke: 'var(--color-ink)', strokeWidth: 2 }} tickLine={false} />
                                <YAxis tickFormatter={(val) => `₹${val/1000}k`} tick={{ fontSize: 12, fill: 'var(--color-faint)' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--color-card)', border: '2px solid var(--color-line)', borderRadius: 12, fontFamily: 'Archivo, sans-serif' }}
                                    formatter={(value: number) => formatCurrency(value)}
                                />
                                <Legend wrapperStyle={{ fontFamily: 'Archivo, sans-serif', fontSize: 11, fontWeight: 600 }} iconType="plainline" />
                                <Line type="monotone" dataKey="actualSpend" name="Actual Spend" stroke="#FF8787" strokeWidth={2.5} dot={false} />
                                <Line type="monotone" dataKey="budgetPace" name="Ideal Pace" stroke="#5C7CFA" strokeWidth={2.5} strokeDasharray="8 6" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                 <div className="bg-card border-2 border-line rounded-cardLg p-5 h-80 flex flex-col">
                    <h2 className="font-heading font-extrabold text-base border-b-2 border-line pb-3">Budget Composition</h2>
                    <div className="flex-1 relative mt-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={donutChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={3} stroke="var(--color-ink)" strokeWidth={2}>
                                    {donutChartData.map((_, index) => <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />)}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ background: 'var(--color-card)', border: '2px solid var(--color-line)', borderRadius: 12, fontFamily: 'Archivo, sans-serif' }}
                                    formatter={(value: number) => formatCurrency(value)}
                                />
                                <Legend wrapperStyle={{ fontFamily: 'Archivo, sans-serif', fontSize: 11, fontWeight: 600 }} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-9">
                            <span className="font-body font-semibold text-[8.5px] uppercase tracking-[0.12em] text-muted">Planned</span>
                            <span className="font-money text-base tracking-[-0.02em] mt-0.5">{formatCompact(totalBudget)}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-card border-2 border-line rounded-cardLg p-5 h-80 flex flex-col">
                    <h2 className="font-heading font-extrabold text-base border-b-2 border-line pb-3">Projected Budget Depletion</h2>
                    <div className="flex-1 mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={depletionData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="8 6" stroke="var(--color-hair)" strokeWidth={1.5} horizontal={false} />
                                <XAxis type="number" domain={[0, 'dataMax + 10']} unit=" days" tick={{ fontSize: 11, fill: 'var(--color-faint)' }} axisLine={{ stroke: 'var(--color-ink)', strokeWidth: 2 }} tickLine={false} />
                                <YAxis type="category" dataKey="categoryName" width={100} tick={{ fontSize: 12, fill: 'var(--color-ink)' }} axisLine={false} tickLine={false} interval={0} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--color-card)', border: '2px solid var(--color-line)', borderRadius: 12, fontFamily: 'Archivo, sans-serif' }}
                                    formatter={(value: number) => [`${value} days`, 'Projected to last']}
                                />
                                <ReferenceLine x={daysInMonth} stroke="var(--color-red)" strokeWidth={2} label={{ value: "End of month", position: "insideTopRight", fill: 'var(--color-red)', fontSize: 11, fontFamily: 'Archivo, sans-serif', fontWeight: 700 }} />
                                <Bar dataKey="daysLeft" name="Days Left" radius={[0, 6, 6, 0]}>
                                    {depletionData.map((entry) => (
                                        <Cell key={entry.categoryId} fill={entry.daysLeft && entry.daysLeft < daysInMonth ? "var(--color-red)" : "var(--color-green)"} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                 <div className="bg-card border-2 border-line rounded-cardLg p-5 h-80 flex flex-col">
                    <div className="flex justify-between items-baseline border-b-2 border-line pb-3 gap-2">
                        <h2 className="font-heading font-extrabold text-base">Full Budget Breakdown</h2>
                        <span className="font-body font-semibold text-[10px] uppercase tracking-[0.12em] text-muted whitespace-nowrap">Spent / Budget</span>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-1 mt-2">
                         {data.map(item => {
                            const isOver = item.budget > 0 && item.spent > item.budget;
                            return (
                                <div key={item.categoryId} className={`rounded-chip px-2.5 py-2.5 mb-1.5 last:mb-0 ${isOver ? 'bg-candy-coral/15' : ''}`}>
                                    <div className="flex justify-between items-center text-sm mb-1.5 gap-2">
                                        <span className="font-heading font-semibold flex items-center gap-2 truncate">{getCategoryIcon(item.categoryName, item.icon_name)} {item.categoryName}</span>
                                        <span className="font-body text-xs text-muted whitespace-nowrap">{formatCurrency(item.spent)} / {formatCurrency(item.budget)}</span>
                                    </div>
                                    <div className="w-full bg-hair border-1.5 border-line rounded-full h-2.5 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-bar ${isOver ? 'bg-candy-coral' : 'bg-candy-blue'}`}
                                            style={{ width: `${Math.min(item.progress, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            );
                         })}
                    </div>
                </div>
             </div>
        </div>
    );
};

export default MonitoringView;
