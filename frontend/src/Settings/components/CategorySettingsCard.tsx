// File: src/Settings/components/CategorySettingsCard.tsx

import React from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import type { Category } from '../../types';
import { getCategoryIcon } from '../../utils/iconHelper';

interface CategorySettingsCardProps {
  categories: Category[];
  onAdd: () => void; // Function to open the "Add New" modal
  onEdit: (category: Category) => void;
  onDelete: (categoryId: number) => void;
}

const CategorySettingsCard: React.FC<CategorySettingsCardProps> = ({ categories = [], onAdd, onEdit, onDelete }) => {
  return (
    <div className="bg-card border-2 border-line rounded-cardLg p-5 flex flex-col h-80">
      <div className="flex justify-between items-center border-b-2 border-line pb-3">
        <h2 className="font-heading font-extrabold text-base text-ink">Categories</h2>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 bg-candy-mint border-1.5 border-candyLine rounded-full px-3.5 py-1.5 font-heading font-bold text-[11.5px] text-[#1E1B16] shadow-chip hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press"
        >
          <Plus size={13} strokeWidth={3} /> Add
        </button>
      </div>
      <div className="flex-1 overflow-y-auto pr-1">
        {categories.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3.5">
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center gap-2.5 border-1.5 border-line rounded-chip px-3 py-2.5"
              >
                {getCategoryIcon(category.name, category.icon_name, 38)}
                <span className="flex-1 font-heading font-bold text-[13px] text-ink truncate">{category.name}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onEdit(category)} className="p-1 text-muted hover:text-link">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => onDelete(category.id)} className="p-1 text-muted hover:text-semantic-red">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center font-body text-sm text-muted mt-8">No categories found.</p>
        )}
      </div>
    </div>
  );
};

export default CategorySettingsCard;
