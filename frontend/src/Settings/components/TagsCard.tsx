// File: src/Settings/components/TagsCard.tsx

import React from 'react';
import { Pencil, X, Plus, EyeOff } from "lucide-react";
import type { Tag } from '../../types';

interface TagsCardProps {
    tags: Tag[];
    onAdd: () => void;
    onEdit: (tag: Tag) => void;
    onDelete: (tagId: number) => void;
}

const PAGE_ABBR: Record<string, string> = { dashboard: 'Dashboard', analytics: 'Analytics', budgets: 'Budgets' };

const TagsCard: React.FC<TagsCardProps> = ({ tags = [], onAdd, onEdit, onDelete }) => {
  return (
    <div className="bg-card border-2 border-line rounded-cardLg p-5 flex flex-col h-80">
      <div className="flex justify-between items-center border-b-2 border-line pb-3">
          <h2 className="font-heading font-extrabold text-base text-ink">Tags</h2>
          <button
            onClick={onAdd}
            className="flex items-center gap-1 bg-candy-lilac border-1.5 border-candyLine rounded-full px-3.5 py-1.5 font-heading font-bold text-[11.5px] text-[#1E1B16] shadow-chip hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press"
          >
            <Plus size={13} strokeWidth={3} /> Add
          </button>
      </div>
      <div className="flex-1 overflow-y-auto pr-1">
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2 mt-3.5">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-2 bg-hair border-1.5 border-line rounded-chip pl-3.5 pr-2 py-2 font-heading font-bold text-xs text-ink"
              >
                <span className="flex flex-col">
                  <span>{tag.name}</span>
                  {tag.excluded_pages?.length > 0 && (
                    <span className="flex items-center gap-1 font-body font-medium text-[9.5px] text-muted normal-case mt-0.5" title={`Hidden from ${tag.excluded_pages.map(p => PAGE_ABBR[p]).join(', ')}`}>
                      <EyeOff size={9} /> {tag.excluded_pages.map(p => PAGE_ABBR[p]).join(', ')}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-0.5">
                  <button onClick={() => onEdit(tag)} className="p-0.5 text-muted hover:text-link">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => onDelete(tag.id)} className="p-0.5 text-muted hover:text-semantic-red">
                    <X size={13} />
                  </button>
                </span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-center font-body text-sm text-muted mt-8">No tags found. Add one to get started!</p>
        )}
      </div>
    </div>
  );
}

export default TagsCard;
