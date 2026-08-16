// File: src/Settings/components/CategoryModal.tsx

import React, { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import IconPicker from './IconPicker';
import { createCategory, updateCategory } from '../../api/apiClient';
import type { Category } from '../../types';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  categoryToEdit?: Category | null;
  availableIcons: string[];
  // ✅ NEW: Add the initialName prop to the interface
  initialName?: string | null;
}

const CategoryModal: React.FC<CategoryModalProps> = ({ 
  isOpen, onClose, onSave, categoryToEdit, availableIcons, initialName 
}) => {
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (categoryToEdit) {
        setName(categoryToEdit.name);
        setSelectedIcon(categoryToEdit.icon_name || null);
      } else {
        // ✅ NEW: In 'add' mode, use the initialName if it exists
        setName(initialName || '');
        setSelectedIcon(null);
      }
      setError(null);
    }
  }, [categoryToEdit, isOpen, initialName]); // ✅ NEW: Add initialName to dependency array

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Category name cannot be empty.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      
      const payload = {
        name: name,
        icon_name: selectedIcon,
        is_income: false,
      };

      if (categoryToEdit) {
        await updateCategory(categoryToEdit.id, payload);
      } else {
        await createCategory(payload);
      }

      onSave();
      onClose();
    } catch (err: any) {
      console.error("Failed to save category:", err);
      setError(err.response?.data?.detail || "An error occurred while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={categoryToEdit ? "Edit Category" : "Add New Category"}>
      <div className="space-y-4">
        <div>
          <label htmlFor="categoryName" className="block font-body font-semibold text-[10px] uppercase tracking-[0.14em] text-muted mb-1.5">Category Name</label>
          <input
            type="text"
            id="categoryName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-bg border-1.5 border-line rounded-[12px] px-3.5 py-2.5 font-body text-sm text-ink outline-none focus:ring-2 focus:ring-link/40"
          />
        </div>

        <IconPicker
          selectedValue={selectedIcon}
          onIconSelect={setSelectedIcon}
          availableIcons={availableIcons}
        />

        {error && <p className="font-body text-sm text-semantic-red mt-2">{error}</p>}

        <div className="flex justify-end gap-2.5 pt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-full border-1.5 border-line font-body font-semibold text-sm hover:bg-hair transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-full border-2 border-line bg-candy-mint text-[#1E1B16] font-body font-semibold text-sm shadow-chip hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSaving ? 'Saving...' : (categoryToEdit ? 'Update Category' : 'Create Category')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default CategoryModal;