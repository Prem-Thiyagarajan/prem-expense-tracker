// File: src/Analytics/Analytics.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { getAnalyticsData, getDashboardData } from '../api/apiClient';
import type { AnalyticsData, DashboardData } from '../types';
import { useMonth } from '../components/MonthContext';

import AnalyticsHeader from "./components/AnalyticsHeader";
import SpendingVelocityChart from "./components/SpendingVelocityChart";
import HabitIdentifierChart from "./components/HabitIdentifierChart";
import TransactionHeatmap from "./components/CategorySpending";
import CategoryDistribution from "./components/CategoryDistribution";
import MonthlyBreakdownChart from './components/MonthlyBreakdownChart';
import WrappedOverlay from '../Wrapped/WrappedOverlay';
import { buildWrappedStories } from '../Wrapped/wrappedStories';

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
  // Wrapped sourcing -- see Wrapped/wrappedStories.ts. Dashboard's totalSpent +
  // percentChangeFromLastMonth aren't on AnalyticsOverview (which only carries
  // all-time figures), so Wrapped needs its own getDashboardData(month) call.
  // It's still zero *new* network surface: Dashboard already fetches this
  // exact endpoint for the same month, this is just a second reader of it.
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [wrappedOpen, setWrappedOpen] = useState(false);

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

  // Wrapped is a month-only feature -- a multi-month trend range has no
  // single "story" to tell -- so only fetch/hold it in month mode.
  useEffect(() => {
    if (viewMode !== 'month') {
      setDashboardData(null);
      return;
    }
    let cancelled = false;
    getDashboardData(month)
      .then((d) => { if (!cancelled) setDashboardData(d); })
      .catch(() => { if (!cancelled) setDashboardData(null); });
    return () => { cancelled = true; };
  }, [viewMode, month]);

  const monthLabel = formatMonthLabel(month);
  const wrappedStories = useMemo(
    () =>
      viewMode === 'month' && data
        ? buildWrappedStories(dashboardData, data.categoryDistribution || [], data.habitIdentifier || [], monthLabel)
        : [],
    [viewMode, data, dashboardData, monthLabel]
  );

  if (isLoading) return <div className="p-8 text-center font-body font-semibold text-ink">Loading Analytics...</div>;
  if (error) return <div className="m-6 p-4 text-center font-body text-semantic-red bg-candy-coral/20 border-2 border-candyLine rounded-card">{error}</div>;
  // Use a default object for overview to prevent crashes before data loads
  if (!data) return <div className="p-8 text-center font-body text-muted">No data available for the selected period.</div>;

  // Derived client-side from the already-fetched categoryDistribution total --
  // powers the third ("Total Spend") overview card; there's no dedicated
  // field for it on AnalyticsOverview.
  const periodTotal = (data.categoryDistribution || []).reduce((sum, cat) => sum + (cat.total || 0), 0);
  const showWrapped = viewMode === 'month' && wrappedStories.length > 0;

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

      {/* Wrapped teaser -- month-only (a trend range has no single "story" to
          tell), and only once there's at least one story to show. */}
      {showWrapped && (
        <button
          type="button"
          onClick={() => setWrappedOpen(true)}
          className="w-full max-w-[460px] bg-[#1E1B16] border-2 border-line rounded-cardLg shadow-card p-5 flex items-center gap-5 text-left appearance-none cursor-pointer hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press"
        >
          <div className="flex-1 min-w-0">
            <p className="font-heading font-extrabold text-base text-candy-yellow">{monthLabel} Wrapped is ready 🎁</p>
            <p className="font-body text-xs text-[#B9B2A6] mt-1">Your month in {wrappedStories.length} shareable cards</p>
          </div>
          <span className="bg-candy-yellow border border-candyLine rounded-full px-4 py-2 font-heading font-extrabold text-xs text-[#1E1B16] whitespace-nowrap">
            Open
          </span>
        </button>
      )}

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

      <WrappedOverlay
        open={wrappedOpen}
        onClose={() => setWrappedOpen(false)}
        monthLabel={monthLabel}
        stories={wrappedStories}
      />
    </div>
  );
};
export default Analytics;
