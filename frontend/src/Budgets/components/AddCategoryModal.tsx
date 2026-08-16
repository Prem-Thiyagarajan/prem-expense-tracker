// File: src/Budgets/components/AddCategoryModal.tsx

import React, { useState } from 'react';
import { createCategory } from '../../api/apiClient'; // We'll use this API function
import Modal from '../../components/ui/Modal'; // Import our generic modal

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoryAdded: () => void; // A function to tell the parent page to refresh its data
}

const AddCategoryModal: React.FC<AddCategoryModalProps> = ({ isOpen, onClose, onCategoryAdded }) => {
  const [categoryName, setCategoryName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!categoryName.trim()) {
      setError('Category name cannot be empty.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      // The is_income flag is false by default for expense tracking
      await createCategory({ name: categoryName, is_income: false });

      onCategoryAdded(); // Tell the Budgets page to refresh
      onClose(); // Close the modal on success
      setCategoryName(''); // Reset the input field

    } catch (err: any) {
      console.error("Failed to create category:", err);
      setError(err.response?.data?.detail || "An error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Category">
      <div className="space-y-4">
        <div>
          <label htmlFor="categoryName" className="block font-body font-semibold text-xs uppercase tracking-[0.08em] text-muted mb-1.5">
            Category Name
          </label>
          <input
            type="text"
            id="categoryName"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            className="block w-full px-3 py-2.5 border-1.5 border-line rounded-chip font-body text-sm text-ink bg-card focus:outline-none focus:border-candy-blue"
            placeholder="e.g., Pet Expenses"
          />
        </div>

        {error && <p className="font-body text-xs text-semantic-red">{error}</p>}

        <div className="flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full border-1.5 border-line font-body font-semibold text-sm hover:bg-hair transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-chip border-2 border-line bg-ink text-bg font-heading font-bold text-sm shadow-chip hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-chip"
          >
            {isSaving ? 'Saving...' : 'Save Category'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default AddCategoryModal;
