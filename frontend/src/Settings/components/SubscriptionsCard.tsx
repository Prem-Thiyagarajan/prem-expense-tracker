// File: src/Settings/components/SubscriptionsCard.tsx
// Settings "Subscriptions" card -- handoff/README.md §Screens item 7: list
// (recurrence interval, next due date, mark paid, edit/delete) feeding the
// Budgets page's Bill radar card. Also carries the "unpay" bonus affordance
// (PUT /subscriptions/{id}/unpay) not in the original design -- shown as a
// small icon button on any row that has a last_paid_date, i.e. anything there
// IS a most-recent mark-paid to undo.
import React, { useState } from 'react';
import { Pencil, Trash2, Plus, CheckCircle2, Undo2, Repeat } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Subscription } from '../../types';
import { paySubscription, unpaySubscription } from '../../api/apiClient';
import { formatCurrency } from '../../utils/formatter';

interface SubscriptionsCardProps {
  subscriptions: Subscription[];
  onAdd: () => void;
  onEdit: (subscription: Subscription) => void;
  onDelete: (subscriptionId: number) => void;
  onChanged: () => void;
}

const INTERVAL_LABEL: Record<Subscription['interval'], string> = {
  weekly: 'Weekly', biweekly: 'Biweekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly',
};

const formatDue = (iso: string): string =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const SubscriptionRow: React.FC<{
  subscription: Subscription;
  onEdit: (subscription: Subscription) => void;
  onDelete: (subscriptionId: number) => void;
  onChanged: () => void;
}> = ({ subscription, onEdit, onDelete, onChanged }) => {
  const [isPaying, setIsPaying] = useState(false);
  const [isUnpaying, setIsUnpaying] = useState(false);
  const overdue = !!subscription.overdue_due_date;
  const dueDate = subscription.overdue_due_date || subscription.upcoming_due_date;

  const handlePay = async () => {
    setIsPaying(true);
    try {
      await paySubscription(subscription.id);
      toast.success(`Marked "${subscription.name}" as paid.`);
      onChanged();
    } catch {
      toast.error('Could not mark this as paid.');
    } finally {
      setIsPaying(false);
    }
  };

  const handleUnpay = async () => {
    setIsUnpaying(true);
    try {
      await unpaySubscription(subscription.id);
      toast.success(`Undid the last payment for "${subscription.name}".`);
      onChanged();
    } catch {
      toast.error('Could not undo that payment.');
    } finally {
      setIsUnpaying(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5 border-1.5 border-line rounded-chip px-3 py-2.5">
      <div className="w-8 h-8 rounded-full border-1.5 border-line flex items-center justify-center shrink-0">
        <Repeat size={14} className="text-ink" />
      </div>
      <div className="flex-1 min-w-[130px]">
        <p className="font-heading font-bold text-[13px] text-ink truncate">{subscription.name}</p>
        <p className={`font-body font-semibold text-[10.5px] mt-0.5 ${overdue ? 'text-semantic-red' : 'text-muted'}`}>
          {INTERVAL_LABEL[subscription.interval]} · {overdue ? 'Overdue since ' : 'Due '}{formatDue(dueDate)}
        </p>
      </div>
      <span className="font-money text-sm whitespace-nowrap">{formatCurrency(subscription.amount)}</span>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={handlePay}
          disabled={isPaying}
          aria-label="Mark as paid"
          title="Mark as paid"
          className="w-8 h-8 rounded-chip bg-candy-mint border-1.5 border-candyLine flex items-center justify-center disabled:opacity-50 hover:translate-x-[1px] hover:translate-y-[1px] transition-all duration-press"
        >
          <CheckCircle2 size={14} />
        </button>
        {subscription.last_paid_date && (
          <button
            onClick={handleUnpay}
            disabled={isUnpaying}
            aria-label="Undo last payment"
            title="Undo last payment"
            className="w-8 h-8 rounded-chip bg-hair border-1.5 border-line flex items-center justify-center disabled:opacity-50 hover:bg-candy-yellow/40 transition-colors"
          >
            <Undo2 size={14} />
          </button>
        )}
        <button onClick={() => onEdit(subscription)} className="p-1 text-muted hover:text-link">
          <Pencil size={14} />
        </button>
        <button onClick={() => onDelete(subscription.id)} className="p-1 text-muted hover:text-semantic-red">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

const SubscriptionsCard: React.FC<SubscriptionsCardProps> = ({ subscriptions = [], onAdd, onEdit, onDelete, onChanged }) => {
  return (
    <div className="bg-card border-2 border-line rounded-cardLg p-5">
      <div className="flex justify-between items-center border-b-2 border-line pb-3">
        <h2 className="font-heading font-extrabold text-base text-ink">Subscriptions</h2>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 bg-candy-mint border-1.5 border-candyLine rounded-full px-3.5 py-1.5 font-heading font-bold text-[11.5px] text-[#1E1B16] shadow-chip hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press"
        >
          <Plus size={13} strokeWidth={3} /> Add
        </button>
      </div>
      {subscriptions.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3.5">
          {subscriptions.map((s) => (
            <SubscriptionRow key={s.id} subscription={s} onEdit={onEdit} onDelete={onDelete} onChanged={onChanged} />
          ))}
        </div>
      ) : (
        <p className="text-center font-body text-sm text-muted mt-8 mb-2">
          No subscriptions yet — add rent, streaming, EMIs, or anything else that bills you on a schedule, and Bill Radar on the Budgets page will start tracking it.
        </p>
      )}
    </div>
  );
};

export default SubscriptionsCard;
