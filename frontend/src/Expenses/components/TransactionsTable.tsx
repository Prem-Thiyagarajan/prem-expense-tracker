// File: src/Expenses/components/TransactionsTable.tsx

import React from 'react';
import TransactionItem from "./TransactionItem";
import { Plus } from "lucide-react";
import type { Transaction, Category, Tag } from '../../types'; // Adjusted path if needed
import { formatCurrency } from '../../utils/formatter';

interface TransactionsTableProps {
  transactions: Transaction[];
  totalCount: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  limit: number;
  isLoading: boolean;
  error: string | null;
  allCategories: Category[];
  allTags: Tag[]; // ✅ Accept 'allTags' prop
  onAdd: () => void;
  onDelete: (id: number) => void;
  onEdit: (transaction: Transaction) => void;
  onUpdate: () => void;
}

interface DayGroup {
  dateKey: string;
  label: string;
  total: number;
  transactions: Transaction[];
}

// Groups the already-fetched page of transactions by calendar day for the
// ruled day headers + day totals in the design — purely a render-time
// regrouping of the existing `transactions` prop, no new data/sorting.
const groupByDay = (transactions: Transaction[]): DayGroup[] => {
  const groups: DayGroup[] = [];
  const index = new Map<string, DayGroup>();
  transactions.forEach(txn => {
    const dateKey = txn.txn_date.substring(0, 10);
    let group = index.get(dateKey);
    if (!group) {
      const label = new Date(txn.txn_date).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      }).toUpperCase();
      group = { dateKey, label, total: 0, transactions: [] };
      index.set(dateKey, group);
      groups.push(group);
    }
    group.transactions.push(txn);
    if (txn.type === 'debit') group.total += txn.amount;
  });
  return groups;
};

const pagePillBtn = "px-3.5 py-2 rounded-full border border-line font-heading font-bold text-[11.5px] transition-opacity";

const TransactionsTable: React.FC<TransactionsTableProps> = ({
  transactions, totalCount, currentPage, setCurrentPage, limit, isLoading,
  error, allCategories, allTags, onAdd, onDelete, onEdit, onUpdate
}) => {
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const startItem = totalCount > 0 ? (currentPage - 1) * limit + 1 : 0;
  const endItem = Math.min(currentPage * limit, totalCount);
  const days = groupByDay(transactions);
  const atStart = currentPage === 1;
  const atEnd = currentPage === totalPages;

  return (
    <div className="bg-card border-2 border-line rounded-cardLg p-5">
      {isLoading && <div className="text-center py-16 font-body font-semibold text-muted">Loading transactions…</div>}
      {error && <div className="text-center py-16 font-body text-semantic-red bg-candy-coral/15 border border-line rounded-card px-6">{error}</div>}

      {!isLoading && !error && (
        days.length > 0 ? (
          days.map(day => (
            <div key={day.dateKey} className="mb-[18px] last:mb-0">
              <div className="flex justify-between items-baseline border-b-2 border-line pb-2">
                <span className="font-body font-semibold text-[10px] uppercase tracking-[0.14em] text-muted">{day.label}</span>
                <span className="font-money text-xs tracking-[-0.02em]">{formatCurrency(day.total)}</span>
              </div>
              <div className="flex flex-col gap-2.5 mt-3">
                {day.transactions.map(txn => (
                  <TransactionItem
                    key={txn.id}
                    transaction={txn}
                    categories={allCategories}
                    allTags={allTags} // ✅ Pass 'allTags' down to each item
                    onDelete={onDelete}
                    onEdit={onEdit}
                    onUpdate={onUpdate}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-16">
            <p className="font-body text-muted mb-4">No transactions found for the selected filters.</p>
            <button
              onClick={onAdd}
              className="inline-flex items-center gap-1.5 bg-candy-blue text-white border-2 border-line rounded-chip shadow-card px-4 py-2.5 font-heading font-extrabold text-[13px] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press"
            >
              <Plus size={16} /> Add a transaction
            </button>
          </div>
        )
      )}

      {!isLoading && !error && totalCount > 0 && (
        <div className="flex flex-wrap justify-between items-center gap-3 border-t-2 border-line pt-4 mt-5">
          <span className="font-body text-xs text-muted">Showing {startItem}–{endItem} of {totalCount} transactions</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(1)} disabled={atStart} className={`${pagePillBtn} bg-hair text-ink ${atStart ? 'opacity-35 cursor-not-allowed' : 'hover:opacity-70'}`}>‹ First</button>
            <button onClick={() => setCurrentPage(currentPage - 1)} disabled={atStart} className={`${pagePillBtn} bg-hair text-ink ${atStart ? 'opacity-35 cursor-not-allowed' : 'hover:opacity-70'}`}>Previous</button>
            <span className="px-4 py-2 rounded-full border-2 border-line bg-candy-yellow shadow-chip font-heading font-bold text-[11.5px] text-[#1E1B16] whitespace-nowrap">
              Page {currentPage} of {totalPages}
            </span>
            <button onClick={() => setCurrentPage(currentPage + 1)} disabled={atEnd} className={`${pagePillBtn} bg-card text-ink ${atEnd ? 'opacity-35 cursor-not-allowed' : 'hover:opacity-70'}`}>Next</button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={atEnd} className={`${pagePillBtn} bg-card text-ink ${atEnd ? 'opacity-35 cursor-not-allowed' : 'hover:opacity-70'}`}>Last ›</button>
          </div>
        </div>
      )}
    </div>
  );
}
export default TransactionsTable;
