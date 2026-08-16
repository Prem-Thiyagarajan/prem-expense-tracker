// File: src/components/ui/LargeModal.tsx

import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const LargeModal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: "var(--scrim)" }}
      onClick={onClose}
    >
      <div
        className="bg-card border-2 border-line rounded-sheet shadow-sheet w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b-2 border-line p-4">
          <h3 className="font-heading font-bold text-lg text-ink">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={22} />
          </button>
        </div>
        <div className="p-6 text-ink">
          {children}
        </div>
      </div>
    </div>
  );
};

export default LargeModal;