// File: src/Analytics/components/SpendingVelocityChart.tsx

import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import type { SpendingVelocityPoint, SpendingCompositionPoint } from '../../types';

interface Props {
  viewMode: 'month' | 'trend';
  velocityData?: SpendingVelocityPoint[];
  compositionData?: SpendingCompositionPoint[];
  timePeriod?: string; // ✅ 1. Add timePeriod to the props
}

const tooltipStyle = {
  background: 'var(--color-card)',
  border: '2px solid var(--color-line)',
  borderRadius: 12,
  fontFamily: 'Archivo, sans-serif',
  fontSize: 12,
};

const currencyFormatter = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

// Legends are square swatches (13px, radius 4, 1.5px ink border), never
// dots-with-lines -- handoff/README.md §Chart rules.
const SwatchLegend = (props: any) => {
  const { payload } = props;
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs font-body font-semibold mt-2">
      {payload.map((entry: any, index: number) => (
        <li key={`item-${index}`} className="flex items-center gap-1.5">
          <span
            className="w-[13px] h-[13px] rounded-[4px] border border-candyLine shrink-0"
            style={{ background: entry.color }}
          />
          <span>{entry.value}</span>
        </li>
      ))}
    </ul>
  );
};

const SpendingVelocityChart: React.FC<Props> = ({ viewMode, velocityData, compositionData, timePeriod }) => {

  // ✅ --- 2. DYNAMIC LEGEND LABEL LOGIC ---
  const getAverageLabel = () => {
    switch(timePeriod) {
        case '3m': return "3-Month Average";
        case '1y': return "This Year's Average";
        case 'all': return "All-Time Average";
        default: return "6-Month Average";
    }
  };

  if (viewMode === 'trend') {
    return (
      <div className="bg-card border-2 border-line rounded-cardLg p-5 h-full flex flex-col">
        <div className="flex justify-between items-baseline border-b-2 border-line pb-3">
          <h3 className="font-heading font-bold text-base">Spending Velocity</h3>
          <span className="font-body font-semibold text-[10px] uppercase tracking-[0.1em] text-muted">Trend</span>
        </div>
        <div className="flex-grow mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={velocityData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid stroke="var(--color-hair)" strokeWidth={1.5} strokeDasharray="8 6" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--color-faint)' }} axisLine={{ stroke: 'var(--color-ink)', strokeWidth: 2 }} tickLine={false} />
              <YAxis tickFormatter={(val) => `₹${Number(val/1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: 'var(--color-faint)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => currencyFormatter(value)} />
              <Legend content={<SwatchLegend />} />
              <Line type="monotone" dataKey="current" name="This Month" stroke="#5C7CFA" strokeWidth={3} dot={false} connectNulls={true} />
              <Line type="monotone" dataKey="previous" name="Last Month" stroke="var(--color-faint)" strokeWidth={2} strokeDasharray="8 6" dot={false} />
              {/* ✅ 3. Use the dynamic label for the 'average' line's name */}
              <Line type="monotone" dataKey="average" name={getAverageLabel()} stroke="#FF8787" strokeWidth={2} strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // --- RENDERER FOR "MONTH" VIEW ---
  return (
    <div className="bg-card border-2 border-line rounded-cardLg p-5 h-full flex flex-col">
      <div className="flex justify-between items-baseline border-b-2 border-line pb-3">
        <h3 className="font-heading font-bold text-base">Spending Composition</h3>
        <span className="font-body font-semibold text-[10px] uppercase tracking-[0.1em] text-muted">Cumulative</span>
      </div>
      <div className="flex-grow mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={compositionData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid stroke="var(--color-hair)" strokeWidth={1.5} strokeDasharray="8 6" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--color-faint)' }} axisLine={{ stroke: 'var(--color-ink)', strokeWidth: 2 }} tickLine={false} />
            <YAxis tickFormatter={(val) => `₹${Number(val/1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: 'var(--color-faint)' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => currencyFormatter(value)} />
            <Legend content={<SwatchLegend />} />
            <Line type="monotone" dataKey="cumulative_small" name="Small Transactions (< ₹1,000)" stroke="#5C7CFA" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="cumulative_large" name="Large Transactions (≥ ₹1,000)" stroke="#FF8787" strokeWidth={3} strokeDasharray="8 6" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SpendingVelocityChart;
