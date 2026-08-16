// File: src/Analytics/components/MonthlyBreakdownChart.tsx

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatCurrency } from '../../utils/formatter';
import type { MonthlyBreakdownPoint } from '../../types';

interface Props {
  data: MonthlyBreakdownPoint[];
}

const MonthlyBreakdownChart: React.FC<Props> = ({ data }) => {
  return (
    <div className="bg-card border-2 border-line rounded-cardLg p-5 h-full flex flex-col">
      <div className="border-b-2 border-line pb-3">
        <h3 className="font-heading font-bold text-base">Monthly Spending Breakdown</h3>
      </div>
      <div className="flex-grow mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid stroke="var(--color-hair)" strokeWidth={1.5} strokeDasharray="8 6" vertical={false} />
            <XAxis dataKey="month" tickFormatter={(m) => new Date(m + '-02').toLocaleString('default', { month: 'short' })} tick={{ fontSize: 12, fill: 'var(--color-faint)' }} axisLine={{ stroke: 'var(--color-ink)', strokeWidth: 2 }} tickLine={false} />
            <YAxis tickFormatter={(val) => `₹${val/1000}k`} tick={{ fontSize: 12, fill: 'var(--color-faint)' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'var(--color-card)', border: '2px solid var(--color-line)', borderRadius: 12, fontFamily: 'Archivo, sans-serif', fontSize: 12 }}
              formatter={(value: number) => [formatCurrency(value), "Total Spend"]}
            />
            <Bar dataKey="spend" fill="#5C7CFA" stroke="var(--color-ink)" strokeWidth={2} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MonthlyBreakdownChart;
