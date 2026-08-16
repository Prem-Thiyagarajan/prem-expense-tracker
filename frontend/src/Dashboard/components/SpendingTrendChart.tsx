// File: src/Dashboard/components/SpendingTrendChart.tsx
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { SpendingTrendPoint } from '../../types';

interface Props {
  data: SpendingTrendPoint[];
}

const SpendingTrendChart: React.FC<Props> = ({ data }) => (
  <div className="w-full h-full p-5 bg-card border-2 border-line rounded-cardLg flex flex-col">
    <h3 className="font-heading font-bold text-base mb-2">Spending Trend (Cumulative)</h3>
    <ResponsiveContainer width="100%" height="85%">
      <AreaChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="8 6" stroke="var(--color-hair)" strokeWidth={1.5} vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--color-faint)' }} axisLine={{ stroke: 'var(--color-ink)', strokeWidth: 2 }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: 'var(--color-faint)' }} tickFormatter={(val) => `₹${val / 1000}k`} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: 'var(--color-card)', border: '2px solid var(--color-line)', borderRadius: 12, fontFamily: 'Archivo, sans-serif' }}
          formatter={(value: number) => [
            new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value),
            "Cumulative Spend"
          ]}
        />
        <Area type="monotone" dataKey="cumulative_spend" stroke="#5C7CFA" fill="#DCE8FF" strokeWidth={2.5} />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

export default SpendingTrendChart;
