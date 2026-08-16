// File: src/Budgets/components/CategoryLimitsSection.tsx
// "Category limits" -- handoff/README.md §Screens item 5: per-category monthly
// goals, below a ruled divider. Sourced from GET /goals (Goal[]), which is a
// distinct CRUD surface over the same underlying table budget_plan_service
// reads (see WEB_REDESIGN_BRIEF.md) -- spend-per-category is looked up from
// the page's already-fetched BudgetPlanItem[] rather than a second fetch.
// Status pill / bar thresholds: <75% mint "on track", 75-99% yellow with the
// percentage, >=100% coral "over" (handoff/APP_DOCUMENTATION.md §5). No
// `recurring` field -- the backend Goal model doesn't have one.
import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Goal, BudgetPlanItem, Category } from '../../types';
import { createGoal, updateGoal, deleteGoal } from '../../api/apiClient';
import { formatCurrency } from '../../utils/formatter';
import { getCategoryIcon } from '../../utils/iconHelper';
import ConfirmModal from '../../components/ui/ConfirmModal';

interface Props {
  goals: Goal[];
  planItems: BudgetPlanItem[];
  categories: Category[];
  month: string;
  isPastMonth: boolean;
  onChanged: () => void;
}

const monthLabel = (month: string) =>
  new Date(month + '-02').toLocaleString('default', { month: 'long', year: 'numeric' });

interface Status { pillLabel: string; pillBg: string; barColor: string; noteColor: string; note: string; }

function getStatus(spent: number, limit: number): Status {
  const pct = limit > 0 ? (spent / limit) * 100 : 0;
  const remaining = limit - spent;
  if (pct >= 100) {
    return {
      pillLabel: 'Over', pillBg: 'bg-candy-coral', barColor: 'bg-candy-coral',
      noteColor: 'text-semantic-red', note: `${formatCurrency(Math.abs(remaining))} over`,
    };
  }
  if (pct >= 75) {
    return {
      pillLabel: `${Math.round(pct)}%`, pillBg: 'bg-candy-yellow', barColor: 'bg-candy-yellow',
      noteColor: 'text-ink', note: `${formatCurrency(remaining)} remaining`,
    };
  }
  return {
    pillLabel: 'On track', pillBg: 'bg-candy-mint', barColor: 'bg-candy-mint',
    noteColor: 'text-semantic-green', note: `${formatCurrency(remaining)} remaining`,
  };
}

const GoalCard: React.FC<{ goal: Goal; spent: number; isPastMonth: boolean; onChanged: () => void }> = ({
  goal, spent, isPastMonth, onChanged,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [limitInput, setLimitInput] = useState(String(goal.limit_amount));
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const status = getStatus(spent, goal.limit_amount);
  const progress = goal.limit_amount > 0 ? Math.min((spent / goal.limit_amount) * 100, 100) : 0;

  const startEdit = () => { setLimitInput(String(goal.limit_amount)); setIsEditing(true); };

  const saveEdit = async () => {
    const value = Number(limitInput);
    if (!value || value <= 0) { toast.error('Enter a limit greater than zero.'); return; }
    setIsSaving(true);
    try {
      await updateGoal(goal.id, { limit_amount: value });
      toast.success('Category limit updated.');
      setIsEditing(false);
      onChanged();
    } catch {
      toast.error('Could not update this limit.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsConfirmOpen(false);
    try {
      await deleteGoal(goal.id);
      toast.success('Category limit deleted.');
      onChanged();
    } catch {
      toast.error('Could not delete this limit.');
    }
  };

  return (
    <div className="bg-card border-2 border-line rounded-cardLg p-5">
      <div className="flex items-center gap-2.5">
        {getCategoryIcon(goal.category.name, goal.category.icon_name)}
        <span className="flex-1 font-heading font-extrabold text-[14.5px] truncate">{goal.category.name}</span>
        <span className={`${status.pillBg} border-1.5 border-candyLine rounded-full px-2.5 py-1 font-heading font-bold text-[10px] text-[#1E1B16] whitespace-nowrap`}>
          {status.pillLabel}
        </span>
      </div>

      {isEditing ? (
        <div className="flex items-center gap-2 mt-3.5">
          <input
            type="number"
            min={1}
            value={limitInput}
            onChange={(e) => setLimitInput(e.target.value)}
            autoFocus
            className="w-full bg-bg border-1.5 border-line rounded-[12px] px-3.5 py-2.5 font-money text-lg text-ink outline-none focus:ring-2 focus:ring-link/40"
          />
          <button onClick={saveEdit} disabled={isSaving} aria-label="Save limit" className="w-9 h-9 shrink-0 rounded-chip bg-candy-mint border-1.5 border-candyLine flex items-center justify-center disabled:opacity-50">
            <Check size={16} />
          </button>
          <button onClick={() => setIsEditing(false)} aria-label="Cancel edit" className="w-9 h-9 shrink-0 rounded-chip bg-hair border-1.5 border-line flex items-center justify-center">
            <X size={16} />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-1.5 mt-3.5 flex-wrap">
            <span className="font-money text-[28px] leading-none tracking-[-0.02em]">{formatCurrency(spent)}</span>
            <span className="font-body text-xs text-muted">of {formatCurrency(goal.limit_amount)}</span>
          </div>
          <div className="w-full bg-hair border-1.5 border-line rounded-full h-3.5 overflow-hidden mt-3">
            <div className={`h-full rounded-full transition-all duration-bar ${status.barColor}`} style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between items-center mt-3 gap-2">
            <span className={`font-body font-semibold text-[11px] ${status.noteColor}`}>{status.note}</span>
            <span className="flex gap-1.5 shrink-0">
              <button onClick={startEdit} disabled={isPastMonth} aria-label="Edit limit" className="w-8 h-8 rounded-chip bg-hair border-1.5 border-line flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-candy-blue/20 transition-colors">
                <Pencil size={13} />
              </button>
              <button onClick={() => setIsConfirmOpen(true)} disabled={isPastMonth} aria-label="Delete limit" className="w-8 h-8 rounded-chip bg-candy-pink border-1.5 border-candyLine flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed">
                <Trash2 size={13} />
              </button>
            </span>
          </div>
        </>
      )}

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Category Limit"
        message={`Remove the ${formatCurrency(goal.limit_amount)} monthly limit on ${goal.category.name}?`}
      />
    </div>
  );
};

const CategoryLimitsSection: React.FC<Props> = ({ goals, planItems, categories, month, isPastMonth, onChanged }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [limitInput, setLimitInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const spentByCategory = new Map(planItems.map(p => [p.categoryId, p.spent]));
  const expenseCategories = categories.filter(c => !c.is_income);
  const availableCategories = expenseCategories.filter(c => !goals.some(g => g.category_id === c.id));

  const openForm = () => {
    setCategoryId(availableCategories[0]?.id ?? '');
    setLimitInput('');
    setIsFormOpen(true);
  };

  const handleCreate = async () => {
    const limit = Number(limitInput);
    if (!categoryId) { toast.error('Choose a category first.'); return; }
    if (!limit || limit <= 0) { toast.error('Enter a limit greater than zero.'); return; }
    setIsSaving(true);
    try {
      await createGoal({ category_id: categoryId, month, limit_amount: limit });
      toast.success('Category limit created.');
      setIsFormOpen(false);
      onChanged();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Could not create this limit.');
    } finally {
      setIsSaving(false);
    }
  };

  const canAddMore = !isPastMonth && availableCategories.length > 0;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-heading font-extrabold text-xl text-ink">Category limits</h2>
          <p className="font-body text-sm text-muted mt-1">Per-category monthly goals for {monthLabel(month)}.</p>
        </div>
        {canAddMore && (
          <button
            onClick={openForm}
            className="flex items-center gap-1.5 bg-candy-yellow border-2 border-candyLine rounded-chip px-4 py-2.5 font-heading font-bold text-[13px] text-[#1E1B16] shadow-chip hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press"
          >
            <Plus size={15} strokeWidth={3} /> New goal
          </button>
        )}
      </div>

      {isFormOpen && (
        <div className="mt-5 bg-card border-2 border-dashed border-line rounded-cardLg p-5">
          <h3 className="font-heading font-extrabold text-[15px]">New monthly limit</h3>
          <div className="flex flex-wrap items-end gap-3.5 mt-3.5">
            <div>
              <label className="block font-body font-semibold text-[9.5px] uppercase tracking-[0.14em] text-muted mb-1.5">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
                className="select-arrow bg-bg border-1.5 border-line rounded-[12px] px-3.5 py-2.5 font-body font-semibold text-sm text-ink outline-none"
              >
                {availableCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-body font-semibold text-[9.5px] uppercase tracking-[0.14em] text-muted mb-1.5">Monthly limit</label>
              <input
                type="number"
                min={1}
                value={limitInput}
                onChange={(e) => setLimitInput(e.target.value)}
                placeholder="3000"
                className="w-[150px] bg-bg border-1.5 border-line rounded-[12px] px-3.5 py-2.5 font-money text-base text-ink outline-none"
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-chip border-2 border-candyLine bg-candy-blue text-[#1E1B16] font-heading font-extrabold text-[13px] shadow-chip hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save goal'}
            </button>
            <button onClick={() => setIsFormOpen(false)} className="px-3 py-2.5 font-heading font-bold text-[12.5px] text-muted hover:text-ink">
              Cancel
            </button>
          </div>
        </div>
      )}

      {(goals.length > 0 || canAddMore) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[18px] mt-5">
          {goals.map(goal => (
            <GoalCard key={goal.id} goal={goal} spent={spentByCategory.get(goal.category_id) ?? 0} isPastMonth={isPastMonth} onChanged={onChanged} />
          ))}
          {canAddMore && (
            <button
              onClick={openForm}
              className="border-2 border-dashed border-line rounded-cardLg p-5 flex flex-col items-center justify-center gap-2 min-h-[170px] text-muted hover:text-ink hover:border-candyLine transition-colors"
            >
              <span className="w-10 h-10 rounded-chip bg-candy-yellow border-2 border-candyLine shadow-chip flex items-center justify-center font-heading font-extrabold text-lg text-[#1E1B16]">+</span>
              <span className="font-heading font-bold text-[13px] text-ink">Add a category limit</span>
              <span className="font-body text-[11px]">{availableCategories.length} of {expenseCategories.length} categories have no limit yet</span>
            </button>
          )}
        </div>
      )}

      {goals.length === 0 && !canAddMore && (
        <p className="text-center font-body text-sm text-muted mt-8">
          {isPastMonth ? 'No category limits were set for this month.' : 'No categories available to set a limit on.'}
        </p>
      )}
    </div>
  );
};

export default CategoryLimitsSection;
