// File: src/Dashboard/components/RecentTransactionsTable.tsx

import React from 'react';
import { Link } from 'react-router-dom';
import type { RecentTransaction, Category } from '../../types';
import { getCategoryIcon } from '../../utils/iconHelper';

interface RecentTransactionsTableProps {
  transactions: RecentTransaction[];
  categories: Category[];
}

const RecentTransactionsTable: React.FC<RecentTransactionsTableProps> = ({ transactions, categories }) => {

  const getCategoryById = (id: number | null): Category | null => {
    if (id === null) return null;
    const category = categories.find(cat => cat.id === id);
    return category || null;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="w-full p-5 bg-card border-2 border-line rounded-cardLg">
      <div className="flex justify-between items-center mb-3 pb-3 border-b-2 border-line">
        <h3 className="font-heading font-bold text-base">Recent Transactions</h3>
        <Link to="/expenses" className="text-link hover:underline text-sm font-body font-semibold">
          View all
        </Link>
      </div>

      <ul className="divide-y divide-hair">
        {transactions.length > 0 ? (
          transactions.map((tx, index) => {
            const category = getCategoryById(tx.category_id);
            const categoryName = category ? category.name : 'Uncategorized';

            return (
              <li key={index} className="flex justify-between items-center py-3">
                <div className="flex items-center space-x-3">
                  {getCategoryIcon(category?.name, category?.icon_name, 38)}

                  <div>
                    <p className="font-heading font-semibold text-sm">{tx.description}</p>
                    <p className="text-xs font-body text-muted">{formatDate(tx.txn_date)}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-money text-[17px] tracking-[-0.02em]">{formatCurrency(tx.amount)}</p>
                  <p className="text-xs font-body text-muted">{categoryName}</p>
                </div>
              </li>
            );
          })
        ) : (
          <li className="text-center py-4 font-body text-muted">No recent transactions found.</li>
        )}
      </ul>
    </div>
  );
};

export default RecentTransactionsTable;
