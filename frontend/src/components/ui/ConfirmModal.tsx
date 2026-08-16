// File: src/components/ui/ConfirmModal.tsx
import React from 'react';
import Modal from './Modal'; // Assuming your generic modal is here

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-5">
        <p className="font-body text-sm text-ink">{message}</p>
        <div className="flex justify-end gap-2.5">
          <button onClick={onClose} className="px-4 py-2 rounded-full border-1.5 border-line font-body font-semibold text-sm hover:bg-hair transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-full border-2 border-candyLine bg-candy-coral text-[#1E1B16] font-body font-semibold text-sm shadow-chip hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press">
            Confirm delete
          </button>
        </div>
      </div>
    </Modal>
  );
};
export default ConfirmModal;