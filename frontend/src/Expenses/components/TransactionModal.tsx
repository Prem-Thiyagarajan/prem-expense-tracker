// File: src/Expenses/components/TransactionModal.tsx

import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { createTransaction, updateTransaction } from '../../api/apiClient';
import type { Transaction, Category, Account, Tag, Merchant } from '../../types';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  transactionToEdit: Transaction | null;
  categories: Category[];
  accounts: Account[];
  allTags: Tag[];
  merchants: Merchant[];
}

// Category colours per handoff/README.md §Category colours + icons — mirrors
// Dashboard/components/TopSpendCategoriesChart.tsx's CATEGORY_COLORS map.
const CATEGORY_COLORS: { [key: string]: string } = {
  'Food': '#FF8787', 'Bills': '#5C7CFA', 'Travel': '#FFD43B', 'Shopping': '#C7F0DB',
  'Transfers': '#C7F0DB', 'Health & Wellness': '#C7F0DB', 'Healthcare': '#C7F0DB',
  'Personal Care': '#FFD6E8', 'Education': '#D0BFFF', 'Entertainment': '#D0BFFF',
  'House Work': '#E8E2D4', 'Miscellaneous': '#E8E2D4', 'Rent': '#5C7CFA',
  'Transportation': '#FFD43B', 'Services': '#D0BFFF', 'default': '#E8E2D4',
};
const getCategoryColor = (name?: string | null): string => (name && CATEGORY_COLORS[name]) || CATEGORY_COLORS.default;

const toDateInputValue = (d: Date): string => {
  const copy = new Date(d);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().split('T')[0];
};

const chipBtn = "px-3 py-1.5 rounded-full border border-line font-heading font-bold text-[11px] whitespace-nowrap transition-all duration-chip";
const fieldLabel = "block font-body font-semibold text-[9.5px] uppercase tracking-[0.14em] text-muted mt-3.5 mb-1.5";

const TransactionModal: React.FC<Props> = ({ isOpen, onClose, onSave, transactionToEdit, categories, accounts, allTags, merchants }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [txnDate, setTxnDate] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [accountId, setAccountId] = useState<number | ''>('');
  const [type, setType] = useState<'debit' | 'credit'>('debit');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  // Merchant is a lightweight name-autocomplete (native <datalist>, no new
  // dependency): merchantName is what's displayed/typed, merchantId only
  // gets set when it resolves to an exact existing merchant name -- typing
  // something that doesn't match just leaves the transaction unlinked.
  const [merchantName, setMerchantName] = useState('');
  const [merchantId, setMerchantId] = useState<number | ''>('');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditMode = !!transactionToEdit;
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && transactionToEdit) {
        setDescription(transactionToEdit.description);
        setAmount(transactionToEdit.amount);
        setTxnDate(transactionToEdit.txn_date.substring(0, 10));
        setCategoryId(transactionToEdit.category_id ?? '');
        setAccountId(transactionToEdit.account_id);
        setType(transactionToEdit.type);
        setSelectedTagIds(transactionToEdit.tags ? transactionToEdit.tags.map(t => t.id) : []);
        const linkedMerchant = merchants.find(m => m.id === transactionToEdit.merchant_id);
        setMerchantId(transactionToEdit.merchant_id ?? '');
        setMerchantName(linkedMerchant?.name ?? '');
      } else {
        setDescription('');
        setAmount('');
        setTxnDate(toDateInputValue(new Date()));
        setCategoryId('');
        setAccountId(accounts[0]?.id || '');
        setType('debit');
        setSelectedTagIds([]);
        setMerchantId('');
        setMerchantName('');
      }
      setError(null);
    }
  }, [transactionToEdit, isOpen, isEditMode, accounts, merchants]);

  if (!isOpen) {
    return null;
  }

  const toggleTag = (id: number) => {
    setSelectedTagIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const handleMerchantNameChange = (value: string) => {
    setMerchantName(value);
    const exact = merchants.find(m => m.name.toLowerCase() === value.trim().toLowerCase());
    setMerchantId(exact ? exact.id : '');
  };

  const todayValue = toDateInputValue(new Date());
  const yesterdayValue = toDateInputValue(new Date(Date.now() - 86400000));
  const isToday = txnDate === todayValue;
  const isYesterday = txnDate === yesterdayValue;
  const isCredit = type === 'credit';

  const handleSave = async () => {
    if (!description || amount === '' || !txnDate || !accountId) { setError('Please fill out all required fields.'); return; }
    const toastId = toast.loading(isEditMode ? "Updating..." : "Creating...");
    try {
      setIsSaving(true);
      setError(null);

      const payload = {
        description,
        amount: Number(amount),
        txn_date: new Date(txnDate).toISOString(),
        category_id: categoryId === '' ? null : Number(categoryId),
        account_id: Number(accountId),
        merchant_id: merchantId === '' ? null : Number(merchantId),
        type,
        source: 'Manual',
        tag_ids: selectedTagIds,
      };

      if (isEditMode && transactionToEdit) {
        await updateTransaction(transactionToEdit.id, payload);
        toast.success("Transaction updated!", { id: toastId });
      } else {
        await createTransaction(payload as any);
        toast.success("Transaction created!", { id: toastId });
      }
      onSave();
      onClose();
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || "An error occurred.";
      toast.error(errorMessage, { id: toastId });
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    // Backdrop: 45% ink scrim, matches Modal.tsx's convention.
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: "var(--scrim)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[700px] bg-bg border-2 border-line rounded-sheet shadow-sheet p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center flex-wrap gap-3">
          <span className="font-heading font-extrabold text-xl">{isEditMode ? "Edit transaction" : "Add transaction"}</span>
          <div className="flex items-center gap-2.5">
            <div className="flex border border-line rounded-full overflow-hidden">
              {(['debit', 'credit'] as const).map(t => {
                const active = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className="px-4 py-1.5 font-heading font-bold text-xs text-ink transition-colors"
                    style={{ background: active ? (t === 'debit' ? '#FF8787' : '#C7F0DB') : 'transparent' }}
                  >
                    {t === 'debit' ? 'Spend' : 'Income'}
                  </button>
                );
              })}
            </div>
            <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-chip border border-line bg-hair flex items-center justify-center hover:bg-candy-pink hover:border-candyLine transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.35fr] gap-6 mt-4 items-start">
          {/* Left column */}
          <div>
            <p className="font-money text-[40px] leading-none tracking-[-0.03em]">
              ₹{amount === '' ? 0 : amount}
            </p>

            <label className={fieldLabel}>Amount</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
              placeholder="0"
              className="w-full bg-card border border-line rounded-chip px-3.5 py-2.5 font-money text-[17px] tracking-[-0.02em] text-ink outline-none"
            />

            <label className={fieldLabel}>Account</label>
            <div className="flex flex-wrap gap-1.5">
              {accounts.map(acc => {
                const active = accountId === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setAccountId(acc.id)}
                    className={[chipBtn, active ? "bg-candy-blue text-[#1E1B16] shadow-chip" : "bg-card text-ink"].join(" ")}
                  >
                    {acc.name}
                  </button>
                );
              })}
            </div>

            <label className={fieldLabel}>Date</label>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setTxnDate(todayValue)} className={[chipBtn, isToday ? "bg-candy-yellow text-[#1E1B16] shadow-chip" : "bg-card text-ink"].join(" ")}>Today</button>
              <button type="button" onClick={() => setTxnDate(yesterdayValue)} className={[chipBtn, isYesterday ? "bg-candy-yellow text-[#1E1B16] shadow-chip" : "bg-card text-ink"].join(" ")}>Yesterday</button>
              <button
                type="button"
                onClick={() => {
                  try { dateInputRef.current?.showPicker(); } catch { dateInputRef.current?.focus(); }
                }}
                className={[chipBtn, (!isToday && !isYesterday) ? "bg-candy-yellow text-[#1E1B16] shadow-chip" : "bg-card text-ink"].join(" ")}
              >
                📅 Pick a date
              </button>
            </div>
            <input
              ref={dateInputRef}
              type="date"
              value={txnDate}
              onChange={e => setTxnDate(e.target.value)}
              className="w-full mt-2 bg-card border border-line rounded-chip px-3.5 py-2 font-body font-semibold text-xs text-ink outline-none"
            />
          </div>

          {/* Right column */}
          <div>
            <label className="block font-body font-semibold text-[9.5px] uppercase tracking-[0.14em] text-muted mb-1.5">Merchant</label>
            <input
              list="merchant-options"
              value={merchantName}
              onChange={e => handleMerchantNameChange(e.target.value)}
              placeholder="Start typing a merchant…"
              className="w-full bg-card border border-line rounded-chip px-3.5 py-2.5 font-body font-medium text-xs text-ink outline-none mb-1"
            />
            <datalist id="merchant-options">
              {merchants.map(m => <option key={m.id} value={m.name} />)}
            </datalist>

            <label className="block font-body font-semibold text-[9.5px] uppercase tracking-[0.14em] text-muted mb-1.5 mt-3">Category</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCategoryId('')}
                className={[chipBtn, categoryId === '' ? "bg-candy-yellow text-[#1E1B16] shadow-chip" : "bg-card text-ink"].join(" ")}
              >
                Uncategorized
              </button>
              {categories.map(cat => {
                const active = categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={[chipBtn, active ? "text-[#1E1B16] shadow-chip" : "bg-card text-ink"].join(" ")}
                    style={active ? { background: getCategoryColor(cat.name) } : undefined}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>

            <label className={fieldLabel}>Note</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What was it for?"
              className="w-full bg-card border border-line rounded-chip px-3.5 py-2.5 font-body font-medium text-xs text-ink outline-none"
            />

            <label className={fieldLabel}>Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map(tag => {
                const active = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={[chipBtn, active ? "bg-candy-lilac text-[#1E1B16] shadow-chip" : "bg-card text-ink"].join(" ")}
                  >
                    {active ? '✓ ' : ''}#{tag.name}
                  </button>
                );
              })}
              {allTags.length === 0 && (
                <span className="font-body text-xs text-faint">No tags yet — add some from Settings.</span>
              )}
            </div>
          </div>
        </div>

        {error && <p className="font-body text-sm text-semantic-red mt-4">{error}</p>}

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full mt-5 border-2 border-candyLine rounded-card shadow-card py-3.5 font-heading font-extrabold text-sm disabled:opacity-60 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press"
          style={{ background: isCredit ? '#C7F0DB' : '#5C7CFA', color: '#1E1B16' }}
        >
          {isSaving ? 'Saving…' : isCredit ? 'Save income' : 'Save transaction'}
        </button>
      </div>
    </div>
  );
};

export default TransactionModal;
