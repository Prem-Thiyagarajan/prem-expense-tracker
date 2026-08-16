// File: src/Merchants/Merchants.tsx
// Per handoff/ExpenseTracker Web Prototype.dc.html's Merchants screen: yellow
// bulk-suggestion banner (clusters of unmapped transactions sharing a UPI
// handle), raw-string -> editable clean-name row, category pill, "Apply to N"
// / "unmapped rows tinted yellow. Wired to the real Part 2 endpoints, not the
// handoff doc's invented raw_pattern/txn_count/mapped/suggestions/apply shape
// -- see WEB_REDESIGN_BRIEF.md's "Known handoff-doc corrections".
import React, { useEffect, useState } from 'react';
import { RefreshCw, Search, Trash2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getMerchants, getMerchantClusters, getUnmappedMerchantCount, rescanMerchants,
  createMerchant, updateMerchant, deleteMerchant, updateTransaction, getCategories,
} from '../api/apiClient';
import type { Merchant, MerchantCluster, Category } from '../types';

// Category colours per handoff/README.md, mirrored from Dashboard/Expenses.
const CATEGORY_COLORS: { [key: string]: string } = {
  'Food': '#FF8787', 'Bills': '#5C7CFA', 'Travel': '#FFD43B', 'Shopping': '#C7F0DB',
  'Transfers': '#C7F0DB', 'Health & Wellness': '#C7F0DB', 'Healthcare': '#C7F0DB',
  'Personal Care': '#FFD6E8', 'Education': '#D0BFFF', 'Entertainment': '#D0BFFF',
  'House Work': '#E8E2D4', 'Miscellaneous': '#E8E2D4', 'Rent': '#5C7CFA',
  'Transportation': '#FFD43B', 'Services': '#D0BFFF', 'default': '#E8E2D4',
};
const colorFor = (categories: Category[], id: number | null) =>
  (id && CATEGORY_COLORS[categories.find(c => c.id === id)?.name ?? '']) || CATEGORY_COLORS.default;

// Guess a starting clean name from the raw handle's local part, e.g.
// "payzomato@hdfcb" -> "Payzomato". Just a starting point -- always editable.
function guessNameFromHandle(handle: string | null, fallback: string): string {
  if (!handle) return '';
  const local = handle.split('@')[0].replace(/[0-9._-]+/g, ' ').trim();
  if (!local) return fallback;
  return local.split(' ').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

const ClusterCard: React.FC<{
  cluster: MerchantCluster;
  categories: Category[];
  onApplied: () => void;
}> = ({ cluster, categories, onApplied }) => {
  const [name, setName] = useState(() => guessNameFromHandle(cluster.handle, ''));
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const handleApply = async () => {
    if (!name.trim()) {
      toast.error('Give this merchant a name first.');
      return;
    }
    setApplying(true);
    try {
      const merchant = await createMerchant({ name: name.trim(), category_id: categoryId || null });
      await Promise.all(
        cluster.transaction_ids.map(id =>
          updateTransaction(id, { merchant_id: merchant.id, category_id: categoryId || null })
        )
      );
      toast.success(`Applied "${merchant.name}" to ${cluster.count} transactions.`);
      setApplied(true);
      onApplied();
    } catch (err) {
      toast.error('Could not apply this merchant.');
    } finally {
      setApplying(false);
    }
  };

  if (applied) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-chip border border-line bg-candy-mint/40">
        <span className="font-body font-semibold text-sm text-semantic-green">✓ Mapped</span>
        <span className="font-mono text-xs text-muted truncate">{cluster.sample_description}</span>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-cardLg border-2 border-candyLine bg-candy-yellow/20 space-y-3">
      <div className="flex items-start gap-2">
        <AlertCircle size={16} className="mt-0.5 shrink-0 text-[#1E1B16]" />
        <div className="min-w-0">
          <p className="font-body font-semibold text-sm">
            {cluster.count} strings look like the same merchant
          </p>
          <p className="font-mono text-xs text-muted mt-1 p-2 rounded-chip border border-dashed border-faint bg-bg break-all">
            {cluster.sample_description}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Clean merchant name…"
          className="flex-1 min-w-[160px] px-3 py-2 rounded-chip border border-line bg-card font-body text-sm outline-none focus:border-candyLine"
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(Number(e.target.value) || '')}
          className="px-3 py-2 rounded-full border border-line font-body font-semibold text-xs outline-none cursor-pointer"
          style={{ background: colorFor(categories, categoryId || null) }}
        >
          <option value="">Uncategorized</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button
          onClick={handleApply}
          disabled={applying}
          className="px-4 py-2 rounded-full border-2 border-candyLine bg-candy-yellow font-body font-bold text-sm shadow-chip hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press disabled:opacity-50"
        >
          {applying ? 'Applying…' : `Apply to ${cluster.count}`}
        </button>
      </div>
    </div>
  );
};

const MerchantRow: React.FC<{
  merchant: Merchant;
  categories: Category[];
  onChanged: () => void;
}> = ({ merchant, categories, onChanged }) => {
  const [name, setName] = useState(merchant.name);
  const [categoryId, setCategoryId] = useState<number | ''>(merchant.category_id ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (name === merchant.name && (categoryId || null) === merchant.category_id) return;
    setSaving(true);
    try {
      await updateMerchant(merchant.id, { name: name.trim(), category_id: categoryId || null });
      toast.success('Merchant updated.');
      onChanged();
    } catch {
      toast.error('Could not update this merchant.');
      setName(merchant.name);
      setCategoryId(merchant.category_id ?? '');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${merchant.name}"? Transactions already linked to it keep their category, but lose the merchant link.`)) return;
    try {
      await deleteMerchant(merchant.id);
      toast.success('Merchant deleted.');
      onChanged();
    } catch {
      toast.error('Could not delete this merchant.');
    }
  };

  return (
    <div className="flex items-center gap-2 py-2.5 border-b border-hair last:border-b-0">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={save}
        disabled={saving}
        className="flex-1 min-w-[120px] px-2 py-1.5 rounded-chip border border-transparent hover:border-line focus:border-candyLine bg-transparent font-heading font-semibold text-sm outline-none transition-colors"
      />
      <select
        value={categoryId}
        onChange={(e) => { setCategoryId(Number(e.target.value) || ''); }}
        onBlur={save}
        className="px-3 py-1.5 rounded-full border border-line font-body font-semibold text-xs outline-none cursor-pointer"
        style={{ background: colorFor(categories, categoryId || null) }}
      >
        <option value="">Uncategorized</option>
        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <button onClick={remove} aria-label="Delete merchant" className="w-8 h-8 rounded-chip border border-line flex items-center justify-center hover:bg-candy-pink hover:border-candyLine transition-colors shrink-0">
        <Trash2 size={14} />
      </button>
    </div>
  );
};

const Merchants: React.FC = () => {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [clusters, setClusters] = useState<MerchantCluster[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [unmappedCount, setUnmappedCount] = useState(0);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRescanning, setIsRescanning] = useState(false);

  const refresh = async (q?: string) => {
    const [merchantsData, clustersData, count, categoriesData] = await Promise.all([
      getMerchants(q), getMerchantClusters(), getUnmappedMerchantCount(), getCategories(),
    ]);
    setMerchants(merchantsData);
    setClusters(clustersData);
    setUnmappedCount(count);
    setCategories(categoriesData);
  };

  useEffect(() => {
    setIsLoading(true);
    refresh().finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const id = setTimeout(() => { refresh(search || undefined); }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleRescan = async () => {
    setIsRescanning(true);
    try {
      const result = await rescanMerchants();
      if (result.auto_applied === 0 && result.suggested === 0) {
        toast('Nothing new to match.', { icon: 'ℹ️' });
      } else {
        toast.success(`${result.auto_applied} auto-applied, ${result.suggested} suggested — check your notifications.`);
      }
      await refresh(search || undefined);
    } catch {
      toast.error('Rescan failed.');
    } finally {
      setIsRescanning(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center font-body font-semibold text-ink">Loading merchants...</div>;

  return (
    <div className="max-w-content mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading font-extrabold text-[32px] tracking-[-0.02em]">Merchants</h1>
          <p className="font-body text-sm text-muted mt-1">Clean up who your money actually goes to.</p>
        </div>
        <div className="flex items-center gap-3">
          {unmappedCount > 0 && (
            <span className="px-3 py-1.5 rounded-full border border-candyLine bg-candy-coral font-body font-semibold text-xs text-[#1E1B16]">
              {unmappedCount} unmapped
            </span>
          )}
          <button
            onClick={handleRescan}
            disabled={isRescanning}
            className="flex items-center gap-2 px-4 py-2 rounded-full border-2 border-line bg-card font-body font-semibold text-sm hover:bg-hair transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={isRescanning ? 'animate-spin' : ''} />
            {isRescanning ? 'Scanning…' : 'Rescan backlog'}
          </button>
        </div>
      </div>

      {clusters.length > 0 && (
        <div className="space-y-3">
          {clusters.map((cluster) => (
            <ClusterCard
              key={cluster.transaction_ids.join('-')}
              cluster={cluster}
              categories={categories}
              onApplied={() => { getUnmappedMerchantCount().then(setUnmappedCount); getMerchants(search || undefined).then(setMerchants); }}
            />
          ))}
        </div>
      )}

      <div className="bg-card border-2 border-line rounded-cardLg p-5">
        <div className="flex items-center justify-between mb-3 pb-3 border-b-2 border-line">
          <h3 className="font-heading font-bold text-base">Your merchants</h3>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-8 pr-3 py-1.5 rounded-full border border-line bg-bg font-body text-sm outline-none focus:border-candyLine w-40"
            />
          </div>
        </div>
        {merchants.length > 0 ? (
          <div>
            {merchants.map((m) => (
              <MerchantRow key={m.id} merchant={m} categories={categories} onChanged={() => refresh(search || undefined)} />
            ))}
          </div>
        ) : (
          <p className="text-center py-6 font-body text-muted">
            {search ? 'No merchants match your search.' : 'No merchants yet — they\'ll show up here as you categorise transactions, or get created above from a suggestion.'}
          </p>
        )}
      </div>
    </div>
  );
};

export default Merchants;
