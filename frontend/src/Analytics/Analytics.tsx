// File: src/Analytics/Analytics.tsx

import React, { useState, useEffect } from 'react';
import { getAnalyticsData } from '../api/apiClient';
import type { AnalyticsData } from '../types';
import { useMonth } from '../components/MonthContext';

import AnalyticsHeader from "./components/AnalyticsHeader";
import SpendingVelocityChart from "./components/SpendingVelocityChart";
import HabitIdentifierChart from "./components/HabitIdentifierChart";
import TransactionHeatmap from "./components/CategorySpending";
import CategoryDistribution from "./components/CategoryDistribution";
import MonthlyBreakdownChart from './components/MonthlyBreakdownChart';

function formatMonthLabel(monthString: string): string {
  const date = new Date(`${monthString}-01T12:00:00Z`);
  return date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
}

const Analytics: React.FC = () => {
  const { month } = useMonth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'trend' | 'month'>('month');
  // Trend mode keeps its own range selector ('3m' | '6m' | '1y' | 'all'),
  // untouched functionally -- month mode reads/writes the shared
  // useMonth() context instead of a local "YYYY-MM" string.
  const [trendRange, setTrendRange] = useState('6m');
  const [includeCapitalTransfers, setIncludeCapitalTransfers] = useState(false);

  const timePeriod = viewMode === 'month' ? month : trendRange;

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const analyticsData = await getAnalyticsData(timePeriod, includeCapitalTransfers);
        setData(analyticsData);
      } catch (err) {
        setError("Failed to load analytics data.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [timePeriod, includeCapitalTransfers]);

  if (isLoading) return <div className="p-8 text-center font-body font-semibold text-ink">Loading Analytics...</div>;
  if (error) return <div className="m-6 p-4 text-center font-body text-semantic-red bg-candy-coral/20 border-2 border-line rounded-card">{error}</div>;
  // Use a default object for overview to prevent crashes before data loads
  if (!data) return <div className="p-8 text-center font-body text-muted">No data available for the selected period.</div>;

  // Derived client-side from the already-fetched categoryDistribution total --
  // powers the third ("Total Spend") overview card; there's no dedicated
  // field for it on AnalyticsOverview.
  const periodTotal = (data.categoryDistribution || []).reduce((sum, cat) => sum + (cat.total || 0), 0);

  return (
    <div className="max-w-content mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <AnalyticsHeader
        overview={data.overview}
        viewMode={viewMode}
        setViewMode={setViewMode}
        timePeriod={trendRange}
        setTimePeriod={setTrendRange}
        includeCapitalTransfers={includeCapitalTransfers}
        setIncludeCapitalTransfers={setIncludeCapitalTransfers}
        periodTotal={periodTotal}
      />

      {/* Wrapped teaser -- static visual shell only, wired to nothing.
          Part 1 is a purely visual pass; the Wrapped overlay + navigation
          are a later part of this project. */}
      <div className="w-full max-w-[460px] bg-[#1E1B16] border-2 border-line rounded-cardLg shadow-card p-5 flex items-center gap-5">
        <div className="flex-1 min-w-0">
          <p className="font-heading font-extrabold text-base text-candy-yellow">{formatMonthLabel(month)} Wrapped is ready 🎁</p>
          <p className="font-body text-xs text-[#B9B2A6] mt-1">Your month in shareable cards</p>
        </div>
        <span className="bg-candy-yellow border border-line rounded-full px-4 py-2 font-heading font-extrabold text-xs text-[#1E1B16] whitespace-nowrap">
          Open
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-[18px] h-96">
        {/* //! THIS IS THE FIX: Use `|| []` to prevent passing null/undefined */}
        <SpendingVelocityChart
            viewMode={viewMode}
            velocityData={data.spendingVelocity || []}
            compositionData={data.spendingComposition || []}
            timePeriod={timePeriod}
        />
        <HabitIdentifierChart data={data.habitIdentifier || []} />
      </div>
      <div className={`grid grid-cols-1 ${viewMode === 'month' ? 'xl:grid-cols-2' : 'lg:grid-cols-2'} gap-[18px] h-[420px]`}>
        {viewMode === 'month' ? (
          <TransactionHeatmap data={data.transactionHeatmap || []} timePeriod={timePeriod} />
        ) : (
          <MonthlyBreakdownChart data={data.monthlyBreakdown || []} />
        )}
        <CategoryDistribution data={data.categoryDistribution || []} />
      </div>
    </div>
  );
};
export default Analytics;
