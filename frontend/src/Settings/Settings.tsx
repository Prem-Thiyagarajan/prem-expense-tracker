// File: src/Settings/Settings.tsx

import React, { useState, useEffect } from 'react';
import { getCategories, deleteCategory, getTags, getAccounts, deleteTag, deleteAccount, deleteMyAccount } from '../api/apiClient';
import type { Category, Tag, Account } from '../types';
import { availableIcons } from '../utils/iconHelper';
import toast from 'react-hot-toast';
// ✅ NEW: Import useLocation
import { useNavigate, useLocation } from 'react-router-dom';

import SettingsHeader from './components/SettingsHeader';
import CategorySettingsCard from './components/CategorySettingsCard';
import TagsCard from './components/TagsCard';
import AccountsCard from './components/AccountsCard';
import DataSyncCard from './components/DataSyncCard';
import CategoryModal from './components/CategoryModal';
import TagModal from './components/TagModal';
import AccountModal from './components/AccountModal';
import ConfirmModal from '../components/ui/ConfirmModal';
import ConfirmDeleteAccountModal from './components/ConfirmDeleteAccountModal';

const Settings: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  // ✅ NEW: Get the location object to read navigation state
  const location = useLocation();

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagToEdit, setTagToEdit] = useState<Tag | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: number; type: 'category' | 'tag' | 'account' } | null>(null);
  const [isConfirmDeleteAccountModalOpen, setIsConfirmDeleteAccountModalOpen] = useState(false);
  // ✅ NEW: State to hold the pre-filled name from an alert click
  const [prefilledCategoryName, setPrefilledCategoryName] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      if (isLoading) setIsLoading(true);
      const [categoriesData, tagsData, accountsData] = await Promise.all([
        getCategories(), getTags(), getAccounts()
      ]);
      setCategories(categoriesData);
      setTags(tagsData);
      setAccounts(accountsData);
    } catch (err) {
      setError("Failed to load settings data. Please ensure the backend is running.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ✅ NEW: useEffect to check for and handle the navigation state
  useEffect(() => {
    if (location.state?.newCategoryName) {
      // Set the name to be passed to the modal
      setPrefilledCategoryName(location.state.newCategoryName);
      // Open the 'add new' category modal
      handleAddNewCategory();
      // Clear the state to prevent re-triggering on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);


  const handleAddNewCategory = () => { setCategoryToEdit(null); setIsCategoryModalOpen(true); };
  const handleEditCategory = (category: Category) => { setCategoryToEdit(category); setPrefilledCategoryName(null); setIsCategoryModalOpen(true); };
  const handleDeleteCategory = (id: number) => { setItemToDelete({ id, type: 'category' }); setIsConfirmModalOpen(true); };
  // ✅ NEW: Clear the prefilled name on save
  const handleSaveCategory = () => { setPrefilledCategoryName(null); fetchData(); };

  const handleAddNewTag = () => { setTagToEdit(null); setIsTagModalOpen(true); };
  const handleEditTag = (tag: Tag) => { setTagToEdit(tag); setIsTagModalOpen(true); };
  const handleDeleteTag = (id: number) => { setItemToDelete({ id, type: 'tag' }); setIsConfirmModalOpen(true); };
  const handleSaveTag = () => { fetchData(); };
  
  const handleAddNewAccount = () => { setAccountToEdit(null); setIsAccountModalOpen(true); };
  const handleEditAccount = (account: Account) => { setAccountToEdit(account); setIsAccountModalOpen(true); };
  const handleDeleteAccount = (id: number) => { setItemToDelete({ id, type: 'account' }); setIsConfirmModalOpen(true); };
  const handleSaveAccount = () => { fetchData(); };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    const toastId = toast.loading(`Deleting ${itemToDelete.type}...`);
    try {
      if (itemToDelete.type === 'category') await deleteCategory(itemToDelete.id);
      else if (itemToDelete.type === 'tag') await deleteTag(itemToDelete.id);
      else if (itemToDelete.type === 'account') await deleteAccount(itemToDelete.id);
      toast.success(`${itemToDelete.type.charAt(0).toUpperCase() + itemToDelete.type.slice(1)} deleted!`, { id: toastId });
      fetchData();
    } catch (err) {
      toast.error(`Failed to delete ${itemToDelete.type}.`, { id: toastId });
    } finally {
      setIsConfirmModalOpen(false);
      setItemToDelete(null);
    }
  };

  const handleAccountDeletion = async (password: string) => {
    const toastId = toast.loading("Deleting your account...");
    try {
      await deleteMyAccount({ password });
      toast.success("Account deleted successfully. Logging you out.", { id: toastId, duration: 4000 });
      sessionStorage.removeItem('accessToken');
      setTimeout(() => navigate('/login', { replace: true }), 1000);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to delete account. Incorrect password?", { id: toastId });
    } finally {
      setIsConfirmDeleteAccountModalOpen(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center font-body font-semibold text-ink">Loading...</div>;
  if (error) return <div className="m-6 p-4 text-center font-body text-semantic-red bg-candy-coral/20 border-2 border-candyLine rounded-card">{error}</div>;

  const usedIcons = new Set(categories.map(c => c.icon_name).filter((icon): icon is string => !!icon));
  if (categoryToEdit && categoryToEdit.icon_name) {
    usedIcons.delete(categoryToEdit.icon_name);
  }
  
  const iconsForPicker = availableIcons.filter((icon: string) => 
    !usedIcons.has(icon) || 
    (categoryToEdit && icon === categoryToEdit.icon_name)
  );

  return (
    <>
      <div className="max-w-content mx-auto space-y-[18px] p-4 md:p-6 lg:p-8">
        <SettingsHeader />

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-[18px] items-start">
          <CategorySettingsCard categories={categories} onAdd={handleAddNewCategory} onEdit={handleEditCategory} onDelete={handleDeleteCategory} />
          <div className="flex flex-col gap-[18px]">
            <TagsCard tags={tags} onAdd={handleAddNewTag} onEdit={handleEditTag} onDelete={handleDeleteTag} />
            <AccountsCard accounts={accounts} onAdd={handleAddNewAccount} onEdit={handleEditAccount} onDelete={handleDeleteAccount} />
          </div>
        </div>

        {/* NOTE(Part 2): a Subscriptions card (recurrence, next due date, mark
            paid, edit/delete) slots in here as its own bg-card border-2
            rounded-cardLg card — out of scope for this visual pass. */}

        <DataSyncCard />

        <div className="p-5 border-2 border-dashed border-semantic-red rounded-cardLg flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="flex-1">
            <h3 className="font-heading font-extrabold text-base text-semantic-red">Danger zone</h3>
            <p className="font-body text-[12.5px] text-muted mt-1">Permanently delete your account and all associated data. This cannot be undone.</p>
          </div>
          <button
              onClick={() => setIsConfirmDeleteAccountModalOpen(true)}
              className="bg-candy-coral border-2 border-candyLine rounded-chip shadow-overlay px-5 py-3 font-heading font-extrabold text-[13px] text-[#1E1B16] shrink-0 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press"
          >
              Delete My Account
          </button>
        </div>
      </div>

      {/* ✅ NEW: Pass the initialName prop and clear the prefilled name on close */}
      <CategoryModal 
        isOpen={isCategoryModalOpen} 
        onClose={() => { setIsCategoryModalOpen(false); setPrefilledCategoryName(null); }} 
        onSave={handleSaveCategory} 
        categoryToEdit={categoryToEdit} 
        availableIcons={iconsForPicker}
        initialName={prefilledCategoryName} 
      />

      <TagModal isOpen={isTagModalOpen} onClose={() => setIsTagModalOpen(false)} onSave={handleSaveTag} tagToEdit={tagToEdit} />
      <AccountModal isOpen={isAccountModalOpen} onClose={() => setIsAccountModalOpen(false)} onSave={handleSaveAccount} accountToEdit={accountToEdit} />
      <ConfirmModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={handleConfirmDelete} title={`Delete ${itemToDelete?.type}`} message={`Are you sure? This cannot be undone.`} />
      
      <ConfirmDeleteAccountModal 
        isOpen={isConfirmDeleteAccountModalOpen}
        onClose={() => setIsConfirmDeleteAccountModalOpen(false)}
        onConfirm={handleAccountDeletion}
      />
    </>
  );
};

export default Settings;