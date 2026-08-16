// File: src/Expenses/components/TransactionItem.tsx

import React, { useState, useEffect, useMemo } from 'react';
import Select from 'react-select';
import { Pencil, Trash2 } from "lucide-react";
import type { Transaction, Category, Tag } from '../../types';
import { getCategoryIcon } from '../../utils/iconHelper';
import { updateTransaction } from '../../api/apiClient';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../utils/formatter';

interface TransactionItemProps {
  transaction: Transaction;
  categories: Category[];
  allTags: Tag[];
  onDelete: (id: number) => void;
  onEdit: (transaction: Transaction) => void;
  onUpdate: () => void;
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

// react-select v5 `unstyled` + `classNames` — themes the inline tag picker to
// the chip/pill vocabulary without pulling in a CSS override file.
const tagSelectClassNames = {
  control: () => 'min-h-[34px] !bg-bg border border-line rounded-full px-2 font-body cursor-pointer',
  valueContainer: () => 'gap-1 py-0.5 flex-wrap',
  placeholder: () => 'text-faint text-[10.5px] font-body',
  multiValue: () => '!bg-candy-lilac border border-candyLine rounded-full pl-2 pr-0.5 py-0 my-0.5 items-center gap-1',
  multiValueLabel: () => 'text-[10px] font-body font-bold text-[#1E1B16] py-0.5',
  multiValueRemove: () => 'text-[#1E1B16] hover:text-semantic-red rounded-full px-1',
  menu: () => 'bg-card border-2 border-line rounded-card shadow-overlay mt-1.5 overflow-hidden z-20',
  menuList: () => 'py-1',
  option: ({ isFocused, isSelected }: { isFocused: boolean; isSelected: boolean }) =>
    `px-3 py-2 text-xs font-body cursor-pointer ${isSelected ? 'bg-candy-lilac text-[#1E1B16] font-semibold' : isFocused ? 'bg-hair' : 'bg-card'}`,
  indicatorsContainer: () => 'gap-0.5 pr-1.5',
  dropdownIndicator: () => 'text-muted',
  clearIndicator: () => 'text-muted',
  indicatorSeparator: () => 'hidden',
  input: () => 'text-[11px] font-body',
};

const TransactionItem: React.FC<TransactionItemProps> = ({ transaction, categories, allTags, onDelete, onEdit, onUpdate }) => {
  const category = categories.find(c => c.id === transaction.category_id);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(transaction.category_id);

  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(
    transaction.tags ? transaction.tags.map(t => t.id) : []
  );

  const tagOptions = useMemo(() => allTags.map(tag => ({ value: tag.id, label: tag.name })), [allTags]);

  const originalTagIdsJSON = useMemo(() => JSON.stringify((transaction.tags ? transaction.tags.map(t => t.id) : []).sort()), [transaction.tags]);

  // ✅ --- THIS IS THE FIX ---
  // This effect synchronizes the internal state with the props.
  // When the parent component refetches data, the `transaction` prop changes.
  // This hook sees that `transaction.tags` has changed and updates the
  // `selectedTagIds` state to match, which makes the UI show the correct tags.
  useEffect(() => {
    setSelectedTagIds(transaction.tags ? transaction.tags.map(t => t.id) : []);
  }, [transaction.tags]);


  // This effect handles CATEGORY updates (no changes needed here).
  useEffect(() => {
    if (selectedCategoryId === transaction.category_id) return;
    const handleCategoryUpdate = async () => {
        if (selectedCategoryId === undefined) return;
        const toastId = toast.loading("Updating category...");
        try {
            await updateTransaction(transaction.id, { category_id: selectedCategoryId });
            toast.success("Category updated!", { id: toastId });
            onUpdate();
        } catch (error) {
            toast.error("Failed to update category.", { id: toastId });
            setSelectedCategoryId(transaction.category_id);
        }
    };
    handleCategoryUpdate();
  }, [selectedCategoryId]);

  // This effect handles sending TAG updates to the backend.
  useEffect(() => {
    const haveTagsChanged = JSON.stringify(selectedTagIds.sort()) !== originalTagIdsJSON;
    if (!haveTagsChanged) return;

    const handleTagUpdate = async () => {
        const toastId = toast.loading("Updating tags...");
        try {
            await updateTransaction(transaction.id, { tag_ids: selectedTagIds });
            toast.success("Tags updated!", { id: toastId });
            onUpdate();
        } catch (error) {
            toast.error("Failed to update tags.", { id: toastId });
            setSelectedTagIds(JSON.parse(originalTagIdsJSON));
        }
    };

    const timerId = setTimeout(handleTagUpdate, 500);
    return () => clearTimeout(timerId);

  }, [selectedTagIds, originalTagIdsJSON, transaction.id, onUpdate]);

  const catColor = getCategoryColor(category?.name);
  const isCredit = transaction.type === 'credit';

  return (
    <div className="border border-line rounded-chip px-3.5 py-3 bg-card hover:shadow-chip transition-shadow duration-row">
      <div className="flex items-center gap-3.5 flex-wrap xl:flex-nowrap">
        <div className="w-9 h-9 rounded-full border border-line flex items-center justify-center shrink-0 overflow-hidden">
          {getCategoryIcon(category?.name, category?.icon_name)}
        </div>

        <div className="min-w-0 flex-1 basis-40">
          <p className="font-heading font-bold text-sm truncate">{transaction.description}</p>
          <p className="font-body text-[11px] text-muted mt-0.5 truncate">{category?.name || 'Uncategorized'}</p>
        </div>

        <div className="w-full sm:w-44 shrink-0 order-last xl:order-none">
          <Select
              isMulti
              unstyled
              options={tagOptions}
              value={tagOptions.filter(option => selectedTagIds.includes(option.value))}
              onChange={(selectedOptions) => {
                  setSelectedTagIds(selectedOptions.map(option => option.value));
              }}
              classNamePrefix="txn-tag"
              classNames={tagSelectClassNames}
              placeholder="Add tag…"
          />
        </div>

        <select
            value={selectedCategoryId ?? ''}
            onChange={(e) => setSelectedCategoryId(Number(e.target.value) || null)}
            className="shrink-0 border border-line rounded-full px-3 py-1.5 font-heading font-bold text-[11.5px] text-[#1E1B16] outline-none cursor-pointer"
            style={{ background: catColor }}
        >
            <option value="">Uncategorized</option>
            {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
        </select>

        <div className="w-24 text-right shrink-0">
          <span className={`font-money text-[17px] tracking-[-0.02em] ${isCredit ? 'text-semantic-green' : 'text-ink'}`}>
            {isCredit ? '+' : ''}{formatCurrency(transaction.amount)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => onEdit(transaction)} aria-label="Edit transaction" className="w-8 h-8 rounded-chip border border-line bg-hair flex items-center justify-center hover:bg-candy-yellow hover:border-candyLine transition-colors">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete(transaction.id)} aria-label="Delete transaction" className="w-8 h-8 rounded-chip border border-candyLine bg-candy-pink text-[#1E1B16] flex items-center justify-center hover:opacity-75 transition-opacity">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
export default TransactionItem;
