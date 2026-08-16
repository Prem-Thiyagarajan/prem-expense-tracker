// File: src/Analytics/components/HabitIdentifierChart.tsx

import React, { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea
} from "recharts";
import type { HabitIdentifierPoint } from '../../types';
import { formatCurrency } from '../../utils/formatter';

// Category colours per handoff/README.md §Category colours + icons -- shared
// vocabulary with Dashboard/components/TopSpendCategoriesChart.tsx's CATEGORY_COLORS.
const CATEGORY_COLORS: { [key: string]: string } = {
  'Food': '#FF8787', 'Bills': '#5C7CFA', 'Travel': '#FFD43B', 'Shopping': '#C7F0DB',
  'Transfers': '#C7F0DB', 'Health & Wellness': '#C7F0DB', 'Healthcare': '#C7F0DB',
  'Personal Care': '#FFD6E8', 'Education': '#D0BFFF', 'Entertainment': '#D0BFFF',
  'House Work': '#E8E2D4', 'Miscellaneous': '#E8E2D4', 'Rent': '#5C7CFA',
  'Transportation': '#FFD43B', 'Services': '#D0BFFF', 'default': '#E8E2D4',
};

// Pastel quadrant zones (handoff/README.md §Candy accents / tailwind chart.*).
const QUADRANTS = {
  lowLow: '#DFF3E6',   // sage  -- low cost, low freq
  highLow: '#FFE9C7',  // peach -- high cost, low freq
  lowHigh: '#DCE8FF',  // sky   -- low cost, high freq (habits)
  highHigh: '#FFDCDC', // blush -- high cost, high freq (problem zone)
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card border-2 border-line rounded-card shadow-overlay p-3 font-body text-xs">
        <p className="font-heading font-bold text-sm mb-1.5">{data.category}</p>
        <p>Frequency: <span className="font-semibold">{data.transaction_count} transactions</span></p>
        <p>Avg. Cost: <span className="font-semibold">{formatCurrency(data.average_spend)}</span></p>
        <p>Total Spend: <span className="font-semibold">{formatCurrency(data.total_spend)}</span></p>
      </div>
    );
  }
  return null;
};

const CustomizedDot = (props: any) => {
  const { cx, cy, payload } = props;
  const color = CATEGORY_COLORS[payload.category] || CATEGORY_COLORS.default;
  return <circle cx={cx} cy={cy} r={8} stroke="var(--color-ink)" strokeWidth={2} fill={color} />;
};

const CategoryLegend = ({ data }: { data: HabitIdentifierPoint[] }) => {
  const uniqueCategories = Array.from(new Set(data.map(item => item.category)));
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs font-body font-semibold mt-3">
      {uniqueCategories.map((category) => (
        <div key={category} className="flex items-center gap-1.5">
          <span className="w-[13px] h-[13px] rounded-[4px] border border-candyLine shrink-0" style={{ background: CATEGORY_COLORS[category] || CATEGORY_COLORS.default }} />
          <span>{category}</span>
        </div>
      ))}
    </div>
  );
};

const QuadrantLegend = () => (
  <div className="w-full border-t-2 border-line mt-3 pt-3">
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 font-body font-semibold text-[10px] uppercase tracking-[0.08em] text-muted">
      <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-[4px] border border-candyLine shrink-0" style={{ background: QUADRANTS.lowLow }} />Low Cost / Low Freq</div>
      <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-[4px] border border-candyLine shrink-0" style={{ background: QUADRANTS.highLow }} />High Cost / Low Freq</div>
      <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-[4px] border border-candyLine shrink-0" style={{ background: QUADRANTS.lowHigh }} />Habits</div>
      <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-[4px] border border-candyLine shrink-0" style={{ background: QUADRANTS.highHigh }} />Problem Zone</div>
    </div>
  </div>
);

interface Props {
  data: HabitIdentifierPoint[];
}

const HabitIdentifierChart: React.FC<Props> = ({ data }) => {
  const zAxisDomain = data.length > 0 ? [0, Math.max(...data.map(p => p.total_spend))] : [0, 0];
  const avgX = data.length > 0 ? data.reduce((sum, p) => sum + p.transaction_count, 0) / data.length : 0;
  const avgY = data.length > 0 ? data.reduce((sum, p) => sum + p.average_spend, 0) / data.length : 0;

  const yAxisTicks = useMemo(() => {
    if (data.length === 0) return [0, 250, 500, 750, 1000];
    const maxY = Math.max(...data.map(d => d.average_spend));
    const step = 250;
    const ticks: number[] = [];
    for (let i = 0; i <= Math.ceil(maxY / step) * step; i += step) {
      ticks.push(i);
    }
    return ticks;
  }, [data]);

  return (
    <div className="bg-card border-2 border-line rounded-cardLg p-5 h-full flex flex-col">
      <div className="flex justify-between items-baseline border-b-2 border-line pb-3">
        <h3 className="font-heading font-bold text-base">Spending Habit Identifier</h3>
        <span className="font-body font-semibold text-[10px] uppercase tracking-[0.1em] text-muted">Cost × Frequency</span>
      </div>
      <div className="flex-grow mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <CartesianGrid stroke="var(--color-hair)" strokeWidth={1.5} strokeDasharray="8 6" />
            <XAxis
              type="number"
              dataKey="transaction_count"
              name="Frequency"
              unit=" txns"
              domain={[0, 'dataMax + 2']}
              tick={{ fontSize: 12, fill: 'var(--color-faint)' }}
              axisLine={{ stroke: 'var(--color-ink)', strokeWidth: 2 }}
              tickLine={false}
            />
            <YAxis
              type="number"
              dataKey="average_spend"
              name="Avg. Cost"
              width={80}
              ticks={yAxisTicks}
              domain={[0, yAxisTicks[yAxisTicks.length - 1]]}
              tickFormatter={(val) => `₹${(val / 1000).toFixed(1)}k`}
              tick={{ fontSize: 12, fill: 'var(--color-faint)' }}
              axisLine={false}
              tickLine={false}
            />
            <ZAxis type="number" dataKey="total_spend" domain={zAxisDomain} range={[100, 1000]} />
            <Tooltip cursor={{ strokeDasharray: '4 4', stroke: 'var(--color-ink)' }} content={<CustomTooltip />} />

            <ReferenceArea x1={0} x2={avgX} y1={0} y2={avgY} fill={QUADRANTS.lowLow} fillOpacity={1} ifOverflow="visible" />
            <ReferenceArea x1={0} x2={avgX} y1={avgY} fill={QUADRANTS.highLow} fillOpacity={1} ifOverflow="visible" />
            <ReferenceArea x1={avgX} y1={0} y2={avgY} fill={QUADRANTS.lowHigh} fillOpacity={1} ifOverflow="visible" />
            <ReferenceArea x1={avgX} y1={avgY} fill={QUADRANTS.highHigh} fillOpacity={1} ifOverflow="visible" />

            <ReferenceLine y={avgY} stroke="var(--color-ink)" strokeDasharray="4 4" strokeWidth={1.5} />
            <ReferenceLine x={avgX} stroke="var(--color-ink)" strokeDasharray="4 4" strokeWidth={1.5} />

            <Scatter name="Categories" data={data} shape={<CustomizedDot />} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <CategoryLegend data={data} />
      <QuadrantLegend />
    </div>
  );
};

export default HabitIdentifierChart;
