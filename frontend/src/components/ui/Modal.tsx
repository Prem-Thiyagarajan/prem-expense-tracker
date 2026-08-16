// File: src/components/ui/Modal.tsx

import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  // If the modal is not open, render nothing.
  if (!isOpen) {
    return null;
  }

  return (
    // Backdrop: 45% ink scrim (handoff/README.md §Overlays). Clicking it closes the modal.
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: "var(--scrim)" }}
      onClick={onClose}
    >
      {/* e.stopPropagation() prevents a click inside the modal from bubbling up to the backdrop and closing it. */}
      <div
        className="bg-card border-2 border-line rounded-sheet shadow-sheet w-full max-w-md"
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

export default Modal;