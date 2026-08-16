// File: src/Analytics/components/CategorySpending.tsx

import React from 'react';
import { useNavigate } from 'react-router-dom'; // ✅ 1. Import useNavigate
import type { TransactionHeatmapPoint } from '../../types';
import { formatCurrency } from '../../utils/formatter';

interface Props {
  data: TransactionHeatmapPoint[];
  timePeriod: string;
}

const TransactionHeatmap: React.FC<Props> = ({ data = [], timePeriod }) => {
    const navigate = useNavigate(); // ✅ 2. Initialize navigate function

    // ✅ 3. Handler to navigate to the expenses page with the date
    const handleDayClick = (dateStr: string) => {
        if (!dateStr) return;
        navigate('/expenses', { state: { filterDate: dateStr } });
    };

    const year = parseInt(timePeriod.substring(0, 4));
    const month = parseInt(timePeriod.substring(5, 7)) - 1;

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    const numDays = endDate.getDate();
    const startDayOfWeek = startDate.getDay();

    const todayStr = new Date().toISOString().slice(0, 10);

    const calendarDays = [];
    for (let i = 0; i < startDayOfWeek; i++) {
        calendarDays.push({ key: `empty-${i}`, isEmpty: true });
    }
    for (let day = 1; day <= numDays; day++) {
        const dateStr = `${timePeriod}-${String(day).padStart(2, '0')}`;
        const dayData = data.find(d => d.date === dateStr);
        calendarDays.push({
            key: `day-${day}`,
            day,
            date: dateStr,
            spend: dayData ? dayData.spend : 0,
            isEmpty: false,
        });
    }

    const maxSpend = data.length > 0 ? Math.max(...data.map(d => d.spend)) : 0;

    // Ramp chart.heat1 -> heat2 -> heat3, today = coral, future = transparent
    // + dashed border -- handoff/README.md §Candy accents / §Chart rules.
    const getCellStyle = (dateStr: string, spend: number) => {
        const isFuture = dateStr > todayStr;
        const isToday = dateStr === todayStr;

        if (isFuture) {
            return { bg: 'bg-transparent', border: 'border-[1.5px] border-dashed border-line', text: 'text-faint' };
        }
        if (isToday) {
            return { bg: 'bg-candy-coral', border: 'border border-line', text: 'text-[#1E1B16]' };
        }
        if (spend <= 0) {
            return { bg: 'bg-hair', border: 'border border-line', text: 'text-muted' };
        }
        const intensity = maxSpend > 0 ? spend / maxSpend : 0;
        if (intensity < 0.34) return { bg: 'bg-chart-heat1', border: 'border border-line', text: 'text-[#1E1B16]' };
        if (intensity < 0.67) return { bg: 'bg-chart-heat2', border: 'border border-line', text: 'text-[#1E1B16]' };
        return { bg: 'bg-chart-heat3', border: 'border border-line', text: 'text-[#1E1B16]' };
    };

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="bg-card border-2 border-line rounded-cardLg p-5 h-full flex flex-col">
            <div className="flex justify-between items-baseline border-b-2 border-line pb-3">
                <h3 className="font-heading font-bold text-base">Spending Calendar</h3>
                <div className="flex items-center gap-1.5 font-body font-semibold text-[10px] uppercase tracking-[0.1em] text-muted">
                    Low
                    <span className="flex gap-1">
                        <span className="w-[13px] h-[13px] rounded-[4px] bg-chart-heat1 border border-line" />
                        <span className="w-[13px] h-[13px] rounded-[4px] bg-chart-heat2 border border-line" />
                        <span className="w-[13px] h-[13px] rounded-[4px] bg-chart-heat3 border border-line" />
                    </span>
                    High
                </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5 text-center font-body font-semibold text-[9.5px] uppercase tracking-[0.12em] text-muted mt-3">
                {weekDays.map(day => <div key={day}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1.5 flex-grow mt-2">
                {calendarDays.map(dayInfo => {
                    if (dayInfo.isEmpty) {
                        return <div key={dayInfo.key} />;
                    }
                    const spendAmount = dayInfo.spend || 0;
                    const style = getCellStyle(dayInfo.date as string, spendAmount);

                    return (
                        // ✅ 4. Use a <button> and attach the onClick handler
                        <button
                            key={dayInfo.key}
                            className={`rounded-[11px] flex items-center justify-center transition-colors duration-row w-full h-full focus:outline-none focus:ring-2 focus:ring-candy-blue ${style.bg} ${style.border}`}
                            title={`Spent: ${formatCurrency(spendAmount)}`}
                            onClick={() => handleDayClick(dayInfo.date as string)}
                        >
                            <span className={`font-body font-semibold text-sm ${style.text}`}>{dayInfo.day}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default TransactionHeatmap;
