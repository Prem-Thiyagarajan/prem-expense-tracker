// File: src/Settings/components/AccountsCard.tsx

import React from 'react';
import { Pencil, Trash2, Landmark, Wallet, Plus } from "lucide-react";
import type { Account } from '../../types';

// ✅ --- THIS IS THE FIX: Update the props interface ---
interface AccountsCardProps {
    accounts: Account[];
    onAdd: () => void;
    onEdit: (account: Account) => void;
    onDelete: (accountId: number) => void;
}

const getAccountIcon = (type: string) => {
    if (type.toLowerCase().includes('bank')) {
        return <Landmark size={16} className="text-ink" />;
    }
    return <Wallet size={16} className="text-ink" />;
};

const AccountsCard: React.FC<AccountsCardProps> = ({ accounts = [], onAdd, onEdit, onDelete }) => {
  return (
    <div className="bg-card border-2 border-line rounded-cardLg p-5 flex flex-col h-80">
      <div className="flex justify-between items-center border-b-2 border-line pb-3">
          <h2 className="font-heading font-extrabold text-base text-ink">Accounts</h2>
          {/* ✅ Connect the onAdd handler */}
          <button
            onClick={onAdd}
            className="flex items-center gap-1 bg-candy-yellow border-1.5 border-line rounded-full px-3.5 py-1.5 font-heading font-bold text-[11.5px] text-[#1E1B16] shadow-chip hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press"
          >
            <Plus size={13} strokeWidth={3} /> Add
          </button>
      </div>
      <div className="flex-1 overflow-y-auto pr-1">
        {accounts.length > 0 ? (
          <div className="flex flex-col gap-2 mt-3.5">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center gap-2.5 border-1.5 border-line rounded-chip px-3 py-2.5"
              >
                <div className="w-8 h-8 rounded-full border-1.5 border-line flex items-center justify-center shrink-0">
                  {getAccountIcon(account.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-bold text-[13px] text-ink truncate">{account.name}</p>
                  <p className="font-mono text-[10.5px] text-muted truncate">{account.provider}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onEdit(account)} className="p-1 text-muted hover:text-link">
                    <Pencil size={14} />
                  </button>
                  {/* ✅ Connect the onDelete handler */}
                  <button onClick={() => onDelete(account.id)} className="p-1 text-muted hover:text-semantic-red">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center font-body text-sm text-muted mt-8">No accounts found.</p>
        )}
      </div>
    </div>
  );
}

export default AccountsCard;
