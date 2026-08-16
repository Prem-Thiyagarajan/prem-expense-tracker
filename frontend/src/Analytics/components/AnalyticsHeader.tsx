// File: src/Analytics/components/AnalyticsHeader.tsx
import React from 'react';
import type { AnalyticsOverview } from '../../types';
import { BarChart3, TrendingUp, Wallet } from 'lucide-react';
import { formatCurrency } from '../../utils/formatter';
import { useMonth } from '../../components/MonthContext';
import MonthControl from '../../components/MonthControl';

interface AnalyticsHeaderProps {
  overview: AnalyticsOverview;
  viewMode: 'trend' | 'month';
  setViewMode: (mode: 'trend' | 'month') => void;
  // Trend-mode range only ('3m' | '6m' | '1y' | 'all') -- month mode reads/
  // writes the shared useMonth() context instead (see MonthControl below).
  timePeriod: string;
  setTimePeriod: (period: string) => void;
  includeCapitalTransfers: boolean;
  setIncludeCapitalTransfers: (value: boolean) => void;
  // Derived client-side from the already-fetched categoryDistribution total --
  // there's no dedicated "current period total" field on AnalyticsOverview.
  periodTotal: number;
}

const TREND_LABELS: Record<string, string> = {
  '3m': 'Last 3 Months',
  '6m': 'Last 6 Months',
  '1y': 'This Year',
  'all': 'All Time',
};

const formatWhole = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatMonth = (monthStr: string) => {
  const date = new Date(`${monthStr}-01T12:00:00Z`);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

const formatMonthShort = (monthStr: string) => {
  const date = new Date(`${monthStr}-01T12:00:00Z`);
  return date.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
};

const AnalyticsHeader: React.FC<AnalyticsHeaderProps> = ({
  overview, viewMode, setViewMode, timePeriod, setTimePeriod,
  includeCapitalTransfers, setIncludeCapitalTransfers, periodTotal,
}) => {
  const { month } = useMonth();

  const avg = overview.averageSpendPerMonth;
  const deltaPct = avg > 0 ? ((periodTotal - avg) / avg) * 100 : 0;
  const periodIsBelowAvg = deltaPct < 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-heading font-extrabold text-[32px] leading-none tracking-[-0.02em]">Analytics</h1>
          <p className="font-body text-sm text-muted mt-1.5">How the money actually behaves.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            role="switch"
            aria-checked={includeCapitalTransfers}
            onClick={() => setIncludeCapitalTransfers(!includeCapitalTransfers)}
            className={[
              "border border-line rounded-full shadow-chip px-3.5 py-2 font-heading font-bold text-xs whitespace-nowrap transition-colors duration-chip",
              includeCapitalTransfers ? "bg-candy-mint text-[#1E1B16]" : "bg-card text-ink",
            ].join(" ")}
          >
            Capital transfers: {includeCapitalTransfers ? "On" : "Off"}
          </button>

          <div className="flex bg-card border border-line rounded-full shadow-chip overflow-hidden font-heading font-bold text-xs">
            <button
              type="button"
              onClick={() => setViewMode('trend')}
              className={`px-4 py-2 transition-colors duration-chip ${viewMode === 'trend' ? 'bg-candy-yellow text-[#1E1B16]' : 'text-ink opacity-55 hover:opacity-100'}`}
            >
              Trend
            </button>
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 border-l border-line transition-colors duration-chip ${viewMode === 'month' ? 'bg-candy-yellow text-[#1E1B16]' : 'text-ink opacity-55 hover:opacity-100'}`}
            >
              Month
            </button>
          </div>

          {viewMode === 'trend' ? (
            <select
              value={timePeriod}
              onChange={e => setTimePeriod(e.target.value)}
              className="bg-card border border-line rounded-full shadow-chip px-4 py-2 font-heading font-bold text-xs text-ink outline-none cursor-pointer"
            >
              <option value="3m">Last 3 Months</option>
              <option value="6m">Last 6 Months</option>
              <option value="1y">This Year</option>
              <option value="all">All Time</option>
            </select>
          ) : (
            <MonthControl />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px]">
        <div className="bg-candy-yellow border-2 border-line rounded-cardLg shadow-card p-5 text-[#1E1B16]">
          <p className="font-body font-semibold text-[10px] uppercase tracking-[0.14em] flex items-center gap-1.5">
            <BarChart3 size={14} /> Highest Spend Month
          </p>
          <p className="font-money text-[32px] leading-none tracking-[-0.02em] mt-2.5">
            {overview.highestSpendMonth ? formatWhole(overview.highestSpendMonth.actual) : '—'}
          </p>
          <p className="font-body font-semibold text-[11px] mt-2">
            {overview.highestSpendMonth
              ? `${formatMonthShort(overview.highestSpendMonth.month)} · ${formatCurrency(overview.highestSpendMonth.actual)}`
              : 'No data yet'}
          </p>
        </div>

        <div className="bg-card border-2 border-line rounded-cardLg p-5">
          <p className="font-body font-semibold text-[10px] uppercase tracking-[0.14em] text-muted flex items-center gap-1.5">
            <TrendingUp size={14} /> Average Spend / Month
          </p>
          <p className="font-money text-[32px] leading-none tracking-[-0.02em] mt-2.5">{formatWhole(avg)}</p>
          <p className="font-body font-semibold text-[11px] text-muted mt-2">Based on your spending history</p>
        </div>

        <div className="bg-card border-2 border-line rounded-cardLg p-5">
          <p className="font-body font-semibold text-[10px] uppercase tracking-[0.14em] text-muted flex items-center gap-1.5">
            <Wallet size={14} /> {viewMode === 'month' ? `Total Spend · ${formatMonth(month)}` : `Total Spend · ${TREND_LABELS[timePeriod] || 'Selected Range'}`}
          </p>
          <p className="font-money text-[32px] leading-none tracking-[-0.02em] mt-2.5">{formatWhole(periodTotal)}</p>
          {viewMode === 'month' && avg > 0 ? (
            <p className={`font-body font-semibold text-[11px] mt-2 ${periodIsBelowAvg ? 'text-semantic-green' : 'text-semantic-red'}`}>
              {Math.abs(deltaPct).toFixed(0)}% {periodIsBelowAvg ? 'below' : 'above'} your average
            </p>
          ) : (
            <p className="font-body font-semibold text-[11px] text-muted mt-2">Across the selected period</p>
          )}
        </div>
      </div>
    </div>
  );
};
export default AnalyticsHeader;
