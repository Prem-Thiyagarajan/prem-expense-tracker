// File: src/Dashboard/Dashboard.tsx

import React, { useState, useEffect } from 'react';
import { getDashboardData, getCategories } from '../api/apiClient';
import type { DashboardData, Category } from '../types';
import { useMonth } from '../components/MonthContext';
import MonthControl from '../components/MonthControl';

import KPICards from './components/KPICards';
import TopSpendCategoriesChart from './components/TopSpendCategoriesChart';
import RecentTransactionsTable from './components/RecentTransactionsTable';
import SpendingTrendChart from './components/SpendingTrendChart';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

function formatMonthLabel(monthString: string): string {
  const date = new Date(`${monthString}-01T12:00:00Z`);
  return date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }).toUpperCase();
}

const Dashboard: React.FC = () => {
  const { month: currentMonth } = useMonth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [dashboardData, categoriesData] = await Promise.all([
          getDashboardData(currentMonth),
          getCategories()
        ]);

        setData(dashboardData);
        setAllCategories(categoriesData);

      } catch (err) {
        console.error("❌ Failed to fetch data:", err);
        setError("Could not load dashboard data. Please ensure the backend is running and try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [currentMonth]);

  if (isLoading) return <div className="p-8 text-center font-body font-semibold text-ink">Loading Dashboard...</div>;
  if (error) return <div className="m-6 p-4 text-center font-body text-semantic-red bg-candy-coral/20 border-2 border-candyLine rounded-card">{error}</div>;
  if (!data) return <div className="p-8 text-center font-body text-muted">No data available for the selected month.</div>;

  const delta = data.percentChangeFromLastMonth;
  const hasDelta = Number.isFinite(delta) && delta !== 0;
  const deltaUp = delta > 0;

  return (
    <div className="max-w-content mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <MonthControl />
      </div>

      {/* Hero: mint card, month total */}
      <div className="bg-candy-mint border-2 border-candyLine rounded-cardLg shadow-card p-6 text-[#1E1B16]">
        <div className="flex items-center justify-between gap-4 mb-3">
          <span className="font-body font-semibold text-[9.5px] uppercase tracking-[0.14em]">
            Spent in {formatMonthLabel(currentMonth)}
          </span>
          {hasDelta ? (
            <span
              className={[
                "px-3 py-1 rounded-full border-1.5 border-line font-body font-semibold text-xs flex items-center gap-1",
                deltaUp ? "text-semantic-red" : "text-semantic-green",
              ].join(" ")}
            >
              {deltaUp ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}%
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full border-1.5 border-line font-body font-semibold text-xs opacity-60">
              No change
            </span>
          )}
        </div>
        <p className="font-money text-[46px] leading-none tracking-[-0.02em]">{formatCurrency(data.totalSpent)}</p>
      </div>

      <KPICards
        dailyAverage={data.dailyAverageSpend}
        projectedSpend={data.projectedMonthlySpend}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[18px] h-72">
        <SpendingTrendChart data={data.spendingTrend} />
        <TopSpendCategoriesChart data={data.topSpendingCategories} currentMonth={currentMonth} />
      </div>

      <RecentTransactionsTable
        transactions={data.recentTransactions}
        categories={allCategories}
      />
    </div>
  );
};

export default Dashboard;
