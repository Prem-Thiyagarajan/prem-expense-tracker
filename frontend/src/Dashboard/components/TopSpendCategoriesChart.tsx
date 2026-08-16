// File: src/Dashboard/components/TopSpendCategoriesChart.tsx

import React, { useRef } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import type { TopCategory } from '../../types';
import html2canvas from 'html2canvas';

interface TopSpendCategoriesChartProps {
  data: TopCategory[];
  currentMonth: string;
}

// Category colours per handoff/README.md §Category colours + icons.
const CATEGORY_COLORS: { [key: string]: string } = {
  'Food': '#FF8787', 'Bills': '#5C7CFA', 'Travel': '#FFD43B', 'Shopping': '#C7F0DB',
  'Transfers': '#C7F0DB', 'Health & Wellness': '#C7F0DB', 'Healthcare': '#C7F0DB',
  'Personal Care': '#FFD6E8', 'Education': '#D0BFFF', 'Entertainment': '#D0BFFF',
  'House Work': '#E8E2D4', 'Miscellaneous': '#E8E2D4', 'Rent': '#5C7CFA',
  'Transportation': '#FFD43B', 'Services': '#D0BFFF', 'default': '#E8E2D4',
};

const generateHslColorForId = (id: number): string => {
  const hue = (id * 37) % 360;
  return `hsl(${hue}, 70%, 82%)`;
};

const getCategoryColor = (category: TopCategory): string => {
  if (CATEGORY_COLORS[category.category]) {
    return CATEGORY_COLORS[category.category];
  }
  return generateHslColorForId(category.id);
};

const CustomLegend = (props: any) => {
  const { payload } = props;
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs font-body font-medium mt-2">
      {payload.map((entry: any, index: number) => (
        <li key={`item-${index}`} className="flex items-center gap-1.5">
          <span className="w-[13px] h-[13px] rounded-[4px] border-1.5 border-line shrink-0" style={{ backgroundColor: entry.color }} />
          <span>{entry.value}</span>
        </li>
      ))}
    </ul>
  );
};

const TopSpendCategoriesChart: React.FC<TopSpendCategoriesChartProps> = ({ data, currentMonth }) => {
  const navigate = useNavigate();
  const chartRef = useRef<HTMLDivElement>(null);

  const handlePieClick = (data: any) => {
    const { id: categoryId } = data.payload;
    if (categoryId) {
        navigate('/expenses', {
            state: {
                filterCategoryId: categoryId,
                filterMonth: currentMonth
            }
        });
    }
  };

  const handleDownload = () => {
    if (chartRef.current) {
      html2canvas(chartRef.current, {
        scale: 2,
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-card').trim() || '#ffffff',
      }).then(canvas => {
        const link = document.createElement('a');
        link.download = `top-spending-categories-${currentMonth}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      });
    }
  };

  return (
    <div ref={chartRef} className="w-full h-full p-5 bg-card border-2 border-line rounded-cardLg flex flex-col">
      <div className="flex justify-between items-center">
        <h3 className="font-heading font-bold text-base">Top Spending Categories</h3>
        <button
          onClick={handleDownload}
          className="text-muted hover:text-ink p-1"
          aria-label="Download Chart"
        >
          <Download size={18} />
        </button>
      </div>

      <div className="flex-grow w-full h-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="85%"
              paddingAngle={3}
              dataKey="amount"
              nameKey="category"
              onClick={handlePieClick}
              className="cursor-pointer"
              stroke="var(--color-ink)"
              strokeWidth={2}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getCategoryColor(entry)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: 'var(--color-card)', border: '2px solid var(--color-line)', borderRadius: 12, fontFamily: 'Archivo, sans-serif' }}
              formatter={(value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value)}
            />
            <Legend content={<CustomLegend />} verticalAlign="bottom" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TopSpendCategoriesChart;
