// File: src/Settings/components/SubscriptionModal.tsx
// Add/edit form for a Subscription -- mirrors CategoryModal.tsx/AccountModal.tsx's
// structure. first_due_date is framed to the user as "this month's payment
// date", last_paid_date (optional) as "already paid this cycle" so Bill Radar
// on the Budgets page tracks the *next* one -- per the real /subscriptions
// contract, not the handoff doc's invented `recurring`/`next_due` shape.
import React, { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { createSubscription, updateSubscription } from '../../api/apiClient';
import type { Subscription, SubscriptionInterval } from '../../types';
import toast from 'react-hot-toast';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  subscriptionToEdit: Subscription | null;
}

const INTERVALS: SubscriptionInterval[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];
const INTERVAL_LABEL: Record<SubscriptionInterval, string> = {
  weekly: 'Weekly', biweekly: 'Biweekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly',
};

const inputClass = "w-full bg-bg border-1.5 border-line rounded-[12px] px-3.5 py-2.5 font-body text-sm text-ink outline-none focus:ring-2 focus:ring-link/40";
const labelClass = "block font-body font-semibold text-[10px] uppercase tracking-[0.14em] text-muted mb-1.5";

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose, onSave, subscriptionToEdit }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [interval, setInterval] = useState<SubscriptionInterval>('monthly');
  const [firstDueDate, setFirstDueDate] = useState('');
  const [lastPaidDate, setLastPaidDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!subscriptionToEdit;

  useEffect(() => {
    if (isOpen) {
      if (subscriptionToEdit) {
        setName(subscriptionToEdit.name);
        setDescription(subscriptionToEdit.description || '');
        setAmount(String(subscriptionToEdit.amount));
        setInterval(subscriptionToEdit.interval);
        setFirstDueDate(subscriptionToEdit.first_due_date);
        setLastPaidDate(subscriptionToEdit.last_paid_date || '');
      } else {
        setName('');
        setDescription('');
        setAmount('');
        setInterval('monthly');
        setFirstDueDate(new Date().toISOString().slice(0, 10));
        setLastPaidDate('');
      }
      setError(null);
    }
  }, [subscriptionToEdit, isOpen]);

  const handleSave = async () => {
    if (!name.trim()) { setError('Give this bill a name.'); return; }
    const amountValue = Number(amount);
    if (!amountValue || amountValue <= 0) { setError('Enter an amount greater than zero.'); return; }
    if (!firstDueDate) { setError("Pick this month's payment date."); return; }

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      amount: amountValue,
      interval,
      first_due_date: firstDueDate,
      last_paid_date: lastPaidDate || null,
    };

    try {
      setIsSaving(true);
      setError(null);
      if (subscriptionToEdit) {
        await updateSubscription(subscriptionToEdit.id, payload);
        toast.success('Subscription updated.');
      } else {
        await createSubscription(payload);
        toast.success('Subscription added — Bill Radar will pick it up.');
      }
      onSave();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? 'Edit Subscription' : 'Add New Subscription'}>
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Netflix, Rent, Gym"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Notes (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Family plan"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Amount</label>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="499"
              className={`${inputClass} font-money`}
            />
          </div>
          <div>
            <label className={labelClass}>Repeats</label>
            <select value={interval} onChange={(e) => setInterval(e.target.value as SubscriptionInterval)} className={`${inputClass} select-arrow font-semibold cursor-pointer`}>
              {INTERVALS.map(i => <option key={i} value={i}>{INTERVAL_LABEL[i]}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>This month's payment date</label>
          <input
            type="date"
            value={firstDueDate}
            onChange={(e) => setFirstDueDate(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Already paid this cycle? (optional)</label>
          <input
            type="date"
            value={lastPaidDate}
            onChange={(e) => setLastPaidDate(e.target.value)}
            className={inputClass}
          />
          <p className="font-body text-[11px] text-muted mt-1.5">
            If you've already paid for this cycle, set the date you paid — Bill Radar will then track the next one instead.
          </p>
        </div>

        {error && <p className="font-body text-sm text-semantic-red mt-2">{error}</p>}

        <div className="flex justify-end gap-2.5 pt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-full border-1.5 border-line font-body font-semibold text-sm hover:bg-hair transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-full border-2 border-candyLine bg-candy-mint text-[#1E1B16] font-body font-semibold text-sm shadow-chip hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSaving ? 'Saving...' : (isEditMode ? 'Update Subscription' : 'Create Subscription')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default SubscriptionModal;
