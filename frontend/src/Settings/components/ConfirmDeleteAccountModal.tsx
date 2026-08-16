// File: src/Settings/components/ConfirmDeleteAccountModal.tsx

import React, { useState } from 'react';
import Modal from '../../components/ui/Modal';
import { ShieldAlert } from 'lucide-react';

interface ConfirmDeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  // This function will now pass the password back to the parent
  onConfirm: (password: string) => void; 
}

const ConfirmDeleteAccountModal: React.FC<ConfirmDeleteAccountModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    // We do a basic check here, but the real validation is on the backend
    if (!password) {
      setError("Password is required to confirm deletion.");
      return;
    }
    onConfirm(password);
  };

  // Reset password field and error when modal is closed
  const handleClose = () => {
    setPassword('');
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Delete Your Account">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 border-2 border-dashed border-semantic-red rounded-card">
          <ShieldAlert className="w-9 h-9 text-semantic-red shrink-0" />
          <div>
            <h3 className="font-heading font-bold text-sm text-semantic-red">This action is permanent and cannot be undone.</h3>
            <p className="font-body text-xs text-muted mt-1">All of your data, including transactions, budgets, and categories, will be permanently erased.</p>
          </div>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block font-body font-semibold text-[10px] uppercase tracking-[0.14em] text-muted mb-1.5">
            Please enter your password to confirm.
          </label>
          <input
            type="password"
            id="confirmPassword"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-bg border-1.5 border-line rounded-[12px] px-3.5 py-2.5 font-body text-sm text-ink outline-none focus:ring-2 focus:ring-link/40"
          />
          {error && <p className="font-body text-xs text-semantic-red mt-1">{error}</p>}
        </div>

        <div className="flex justify-end gap-2.5 pt-4">
          <button onClick={handleClose} className="px-4 py-2 rounded-full border-1.5 border-line font-body font-semibold text-sm hover:bg-hair transition-colors">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded-full border-2 border-line bg-candy-coral text-[#1E1B16] font-body font-semibold text-sm shadow-chip hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press"
          >
            Confirm &amp; Delete Account
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDeleteAccountModal;