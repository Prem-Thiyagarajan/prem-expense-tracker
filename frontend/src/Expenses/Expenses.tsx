// File: src/Expenses/Expenses.tsx

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import ExpenseFilters from "./components/ExpenseFilters";
import TransactionsTable from "./components/TransactionsTable";
import ConfirmModal from '../components/ui/ConfirmModal';
import TransactionModal from './components/TransactionModal';
import { getCategories, deleteTransaction, getTransactions, getAccounts, getTags, getMerchants } from '../api/apiClient';
import type { Category, Transaction, Account, Tag, Merchant } from '../types'; // Adjusted path if needed
import toast from 'react-hot-toast';

const Expenses: React.FC = () => {
  const location = useLocation();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [type, setType] = useState('');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [allMerchants, setAllMerchants] = useState<Merchant[]>([]);
  
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  
  const limit = 10;

  useEffect(() => {
    if (fetchTrigger > 0) {
      const fetchAllTransactions = async () => {
        setIsLoading(true);
        setError(null);
        const filters = {
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          account_id: accountId || undefined,
          category_id: categoryId || undefined,
          search_term: searchTerm || undefined,
          type: type || undefined,
        };
        try {
          const data = await getTransactions({ ...filters, page: currentPage, limit });
          setTransactions(data?.transactions || []);
          setTotalCount(data?.total_count || 0);
        } catch (err) {
          setError("Failed to load transactions.");
        } finally {
          setIsLoading(false);
        }
      };
      fetchAllTransactions();
    }
  }, [currentPage, fetchTrigger]);

  useEffect(() => {
    Promise.all([getCategories(), getAccounts(), getTags(), getMerchants()])
      .then(([cats, accs, tags, merchants]) => {
        setAllCategories(cats);
        setAllAccounts(accs);
        setAllTags(tags);
        setAllMerchants(merchants);
      })
      .catch(() => setError("Failed to load filter options."));

    const state = location.state;
    let needsFetch = false;
    
    if (state?.filterDate) {
      setStartDate(state.filterDate);
      setEndDate(state.filterDate);
      needsFetch = true;
    }
    
    if (state?.filterCategoryId && state?.filterMonth) {
      setCategoryId(String(state.filterCategoryId));
      const date = new Date(state.filterMonth + '-02T00:00:00');
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
      needsFetch = true;
    }

    // The Assistant's "add-transaction" navigate sheet -- see Assistant/AssistantPanel.tsx.
    if (state?.openAddTransaction) {
      setTransactionToEdit(null);
      setIsModalOpen(true);
    }

    if (needsFetch) {
      window.history.replaceState({}, document.title)
    }
    
    setFetchTrigger(prev => prev + 1); // Ensure it fetches on initial load
  }, [location.state]);

  const handleApplyFilters = () => { if (currentPage === 1) setFetchTrigger(prev => prev + 1); else setCurrentPage(1); };
  const handleResetFilters = () => { setStartDate(''); setEndDate(''); setAccountId(''); setCategoryId(''); setSearchTerm(''); setType(''); if (currentPage === 1) setFetchTrigger(prev => prev + 1); else setCurrentPage(1); };
  const onSaveOrUpdateTransaction = () => { setFetchTrigger(prev => prev + 1); };
  const handleDeleteRequest = (id: number) => { setTransactionToDelete(id); setIsConfirmOpen(true); };
  const handleAddTransaction = () => { setTransactionToEdit(null); setIsModalOpen(true); };
  const handleEditTransaction = (txn: Transaction) => { setTransactionToEdit(txn); setIsModalOpen(true); };
  
  const handleConfirmDelete = async () => {
    if (!transactionToDelete) return;
    const toastId = toast.loading("Deleting transaction...");
    try {
      await deleteTransaction(transactionToDelete);
      toast.success("Transaction deleted!", { id: toastId });
      onSaveOrUpdateTransaction();
    } catch (error) {
      toast.error("Failed to delete transaction.", { id: toastId });
    } finally {
      setIsConfirmOpen(false);
      setTransactionToDelete(null);
    }
  };

  return (
    <div className="max-w-content mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading font-extrabold text-[32px] leading-none tracking-[-0.02em]">Expenses</h1>
          <p className="font-body font-medium text-[13px] text-muted mt-2">
            {totalCount} {totalCount === 1 ? 'transaction' : 'transactions'} found
          </p>
        </div>
        <button
          onClick={handleAddTransaction}
          className="inline-flex items-center gap-1.5 bg-candy-blue text-[#1E1B16] border-2 border-candyLine rounded-chip shadow-card px-[18px] py-2.5 font-heading font-extrabold text-[13px] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press"
        >
          <Plus size={16} /> Add transaction
        </button>
      </div>

      <ExpenseFilters
        onApplyFilters={handleApplyFilters}
        onResetFilters={handleResetFilters}
        allCategories={allCategories} 
        allAccounts={allAccounts} 
        startDate={startDate} setStartDate={setStartDate}
        endDate={endDate} setEndDate={setEndDate}
        accountId={accountId} setAccountId={setAccountId}
        categoryId={categoryId} setCategoryId={setCategoryId}
        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        type={type} setType={setType}
      />
      <TransactionsTable 
        transactions={transactions}
        totalCount={totalCount}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        limit={limit}
        isLoading={isLoading}
        error={error}
        allCategories={allCategories} 
        allTags={allTags} // ✅ Pass the tags down
        onAdd={handleAddTransaction}
        onDelete={handleDeleteRequest}
        onEdit={handleEditTransaction}
        onUpdate={onSaveOrUpdateTransaction}
      />
      <TransactionModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={onSaveOrUpdateTransaction}
        transactionToEdit={transactionToEdit}
        categories={allCategories}
        accounts={allAccounts}
        allTags={allTags}
        merchants={allMerchants}
      />
      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction? This action cannot be undone."
      />
    </div>
  );
};
export default Expenses;