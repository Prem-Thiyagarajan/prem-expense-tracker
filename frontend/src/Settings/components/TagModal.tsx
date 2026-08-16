// File: src/Settings/components/TagModal.tsx
import React, { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { createTag, updateTag } from '../../api/apiClient';
import type { Tag } from '../../types';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  tagToEdit?: Tag | null;
}

const TagModal: React.FC<Props> = ({ isOpen, onClose, onSave, tagToEdit }) => {
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(tagToEdit ? tagToEdit.name : '');
      setError(null);
    }
  }, [tagToEdit, isOpen]);

  const handleSave = async () => {
    if (!name.trim()) return setError('Tag name cannot be empty.');
    try {
      setIsSaving(true);
      setError(null);
      const payload = { name };
      if (tagToEdit) {
        await updateTag(tagToEdit.id, payload);
        toast.success("Tag updated successfully!");
      } else {
        await createTag(payload);
        toast.success("Tag created successfully!");
      }
      onSave();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || "An error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={tagToEdit ? "Edit Tag" : "Add New Tag"}>
      <div className="space-y-4">
        <div>
          <label htmlFor="tagName" className="block font-body font-semibold text-[10px] uppercase tracking-[0.14em] text-muted mb-1.5">Tag Name</label>
          <input type="text" id="tagName" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-bg border-1.5 border-line rounded-[12px] px-3.5 py-2.5 font-body text-sm text-ink outline-none focus:ring-2 focus:ring-link/40" />
        </div>
        {error && <p className="font-body text-sm text-semantic-red mt-2">{error}</p>}
        <div className="flex justify-end gap-2.5 pt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-full border-1.5 border-line font-body font-semibold text-sm hover:bg-hair transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 rounded-full border-2 border-line bg-candy-lilac text-[#1E1B16] font-body font-semibold text-sm shadow-chip hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press disabled:opacity-50 disabled:pointer-events-none">
            {isSaving ? 'Saving...' : 'Save Tag'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
export default TagModal;