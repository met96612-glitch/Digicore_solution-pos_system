import React, { useState, useMemo, useEffect } from 'react';
import { Product, Transaction, User, ShopProfile } from '../types';
import { formatCurrency, exportToCSV, INITIAL_PRODUCTS, INITIAL_USERS, DEFAULT_SHOP_PROFILE } from '../utils';
import { Shield, Users, Database, FileDigit, Plus, Download, RefreshCw, BarChart2, Cloud, CheckCircle2, XCircle, Copy, Store, Save, RotateCcw, MapPin, Phone, MessageSquare, Receipt, Sparkles, Building2, Check, Lock } from 'lucide-react';
import { getSupabaseKeys, createSupabaseClient, testSupabaseConnection, syncDataToSupabase, clearAllTransactionsInSupabase, resetProductsInSupabase, resetUsersInSupabase } from '../lib/supabase';

interface AdminPageProps {
  users: User[];
  products: Product[];
  transactions: Transaction[];
  shopProfile: ShopProfile;
  onUpdateShopProfile: (newProfile: ShopProfile) => void;
  onAddUser: (username: string, name: string, role: 'superuser' | 'admin' | 'cashier') => void;
  onRemoveUser: (id: string) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
  currentUserRole: 'superuser' | 'admin' | 'cashier';
  hasRlsError?: boolean;
  checkSupabaseStatus?: () => void;
}

export default function AdminPage({
  users,
  products,
  transactions,
  shopProfile,
  onUpdateShopProfile,
  onAddUser,
  onRemoveUser,
  onToast,
  currentUserRole,
  hasRlsError = false,
  checkSupabaseStatus
}: AdminPageProps) {
  const [activeTab, setActiveTab] = useState<'shopProfile' | 'users' | 'dbOps' | 'masterRep' | 'supabase'>('shopProfile');

  // Shop Profile state
  const [profileForm, setProfileForm] = useState<ShopProfile>(shopProfile || DEFAULT_SHOP_PROFILE);
  const [previewPaper, setPreviewPaper] = useState<'80mm' | '58mm'>('80mm');

  useEffect(() => {
    if (shopProfile) {
      setProfileForm(shopProfile);
    }
  }, [shopProfile]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.shopName.trim()) {
      onToast('කඩේ ප්‍රධාන නම (Shop Name) ඇතුළත් කිරීම අනිවාර්යයි.', 'error');
      return;
    }
    onUpdateShopProfile(profileForm);
    onToast('කඩේ විස්තර සහ බිල්පත් සැකසුම් (Shop Profile) සාර්ථකව සුරකින ලදී!', 'success');
  };

  const handleApplyTemplate = (type: 'lahiru' | 'jayantha' | 'custom') => {
    if (type === 'lahiru') {
      const p: ShopProfile = {
        shopName: 'LAHIYA SPICE COLLECTORS',
        shopSinhalaName: 'ළහියා කුළුබඩු එකතු කිරීම්',
        address: 'Wewalwatta, Rathnapura',
        phone1: '074 0050211',
        phone2: '076 0808246',
        footerNote: '*** THANK YOU! COME AGAIN ***',
        footerSubNote: 'Software Powered by Digicore Solution'
      };
      setProfileForm(p);
      onUpdateShopProfile(p);
      onToast('ළහියා කුළුබඩු Default Template එක load කර සාර්ථකව සුරකින ලදී.', 'success');
    } else if (type === 'jayantha') {
      const p: ShopProfile = {
        shopName: 'JAYANTHA SPICE COLLECTORS',
        shopSinhalaName: 'ජයන්ත කුළුබඩු එකතු කිරීම්',
        address: 'Wewalwatta, Rathnapura',
        phone1: '077 602 1831',
        phone2: '',
        footerNote: '*** THANK YOU! COME AGAIN ***',
        footerSubNote: 'Software Powered by Digicore Solution'
      };
      setProfileForm(p);
      onUpdateShopProfile(p);
      onToast('ජයන්ත කුළුබඩු Default Template එක load කර සාර්ථකව සුරකින ලදී.', 'success');
    } else if (type === 'custom') {
      const p: ShopProfile = {
        shopName: '',
        shopSinhalaName: '',
        address: '',
        phone1: '',
        phone2: '',
        footerNote: '*** THANK YOU! COME AGAIN ***',
        footerSubNote: 'Software Powered by Digicore Solution'
      };
      setProfileForm(p);
      onToast('නව කඩයක් සඳහා හිස් පෝරමය සූදානම් කරන ලදී. විස්තර පුරවා සුරකින්න.', 'success');
    }
  };

  // Supabase integration states
  const [supaUrl, setSupaUrl] = useState('');
  const [supaKey, setSupaKey] = useState('');
  const [isCheckingSupa, setIsCheckingSupa] = useState(false);
  const [supaConnStatus, setSupaConnStatus] = useState<'unchecked' | 'connected' | 'failed'>('unchecked');
  const [syncStatusLog, setSyncStatusLog] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Load Supabase credentials initially
  useEffect(() => {
    const keys = getSupabaseKeys();
    setSupaUrl(keys.url);
    setSupaKey(keys.key);
    if (keys.url && keys.key) {
      // Auto test
      testSupabaseConnection(keys.url, keys.key).then(ok => {
        setSupaConnStatus(ok ? 'connected' : 'failed');
      });
    }
  }, []);

  const handleSaveSupaCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCheckingSupa(true);
    setSupaConnStatus('unchecked');
    
    // Save to local storage for persistence
    localStorage.setItem('lahiya_supabase_url', supaUrl.trim());
    localStorage.setItem('lahiya_supabase_key', supaKey.trim());
    
    const isOk = await testSupabaseConnection(supaUrl.trim(), supaKey.trim());
    setIsCheckingSupa(false);
    if (isOk) {
      setSupaConnStatus('connected');
      onToast('Supabase linked and verified successfully!', 'success');
    } else {
      setSupaConnStatus('failed');
      onToast('Failed to connect to Supabase. Check credentials.', 'error');
    }
    checkSupabaseStatus?.();
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncStatusLog('Executing synchronization payload structure...\n');
    try {
      const res = await syncDataToSupabase(products, transactions, users);
      setSyncStatusLog(res.log);
      if (res.success) {
        onToast('Supabase database synced successfully!', 'success');
      } else {
        if (res.log?.toLowerCase().includes('row-level security') || res.log?.toLowerCase().includes('rls')) {
          onToast('Sync blocked by Row-Level Security policy! Check SQL Schema tab.', 'error');
        } else {
          onToast('Supabase database sync failed.', 'error');
        }
      }
      checkSupabaseStatus?.();
    } catch (e: any) {
      setSyncStatusLog(prev => prev + `\n❌ Interrupted error: ${e?.message || e}`);
      onToast('Supabase database sync failed.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // New user form states
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'superuser' | 'admin' | 'cashier'>('cashier');

  const masterStats = useMemo(() => {
    let revenue = 0;
    let expenditures = 0;
    let profit = 0;

    transactions.forEach(tx => {
      if (tx.type === 'sell') {
        revenue += tx.total;
        
        if (typeof tx.total_profit === 'number' && tx.total_profit > 0) {
          profit += tx.total_profit;
        } else {
          let txCost = 0;
          tx.items.forEach(item => {
            const p = products.find(prod => prod.id === item.productId);
            const buyPrice = p ? (p.buying_price ?? p.buyPrice) : 0;
            let qtyInBase = item.qty;
            if (p && p.unit === 'kg' && item.unit === 'g') {
              qtyInBase = item.qty * 0.001;
            }
            txCost += buyPrice * qtyInBase;
          });

          const grossRevenue = tx.items.reduce((acc, item) => acc + item.total, 0);
          const netProfitLine = grossRevenue - txCost;
          const discountRatio = tx.subtotal > 0 ? (tx.subtotal - tx.discount) / tx.subtotal : 1;
          profit += netProfitLine * discountRatio;
        }
      } else if (tx.type === 'buy') {
        expenditures += tx.total;
      }
    });

    return {
      revenue,
      expenditures,
      profit: Math.max(0, profit),
      count: transactions.length
    };
  }, [transactions, products]);

  const handleRegisterUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newName.trim()) {
      onToast('Full Name and Username are mandatory.', 'error');
      return;
    }
    
    // Check if duplicate username
    const exists = users.some(u => u.username.toLowerCase() === newUsername.toLowerCase().trim());
    if (exists) {
      onToast('This login username already exists in the system.', 'error');
      return;
    }

    onAddUser(newUsername.trim().toLowerCase(), newName.trim(), newRole);
    setNewUsername('');
    setNewName('');
    onToast(`New account for ${newName} created successfully.`, 'success');
  };

  const downloadProductsBackup = () => {
    const headers = ['ID', 'Spice Name', 'Measuring Unit', 'Buy Unit Cost (Rs.)', 'Sell Retail Price (Rs.)', 'Current Warehouse Stock'];
    const rows = products.map(p => [
      p.id,
      p.name,
      p.unit,
      p.buyPrice.toString(),
      p.sellPrice.toString(),
      p.stock.toString()
    ]);
    exportToCSV(`Lahiya_Spices_Backup_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
    onToast('Products catalogue exported as CSV.', 'success');
  };

  const downloadTransactionsBackup = () => {
    const headers = ['Transaction ID', 'ISO Date String', 'Type (SELL/BUY)', 'Associate Party', 'Pre-discount Subtotal', 'Discount Deduction', 'Grand Total Paid', 'Host Cashier'];
    const rows = transactions.map(t => [
      t.id,
      t.date,
      t.type.toUpperCase(),
      t.contactName,
      t.subtotal.toString(),
      t.discount?.toString() || '0',
      t.total.toString(),
      t.createdBy
    ]);
    exportToCSV(`Lahiya_Transactions_Backup_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
    onToast('Transactions history ledger exported as CSV.', 'success');
  };

  return (
    <div id="adminPage" className="space-y-6">
      {/* Tab Selectors */}
      <div className="flex flex-wrap border-b border-slate-800 gap-1 select-none">
        <button
          onClick={() => setActiveTab('shopProfile')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold font-sans tracking-wide border-b-2 cursor-pointer transition-all ${
            activeTab === 'shopProfile'
              ? 'border-violet-600 text-violet-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Store size={14} />
          <span>Shop Profile & Receipts (කඩේ විස්තර)</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold font-sans tracking-wide border-b-2 cursor-pointer transition-all ${
            activeTab === 'users'
              ? 'border-violet-600 text-violet-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users size={14} />
          <span>User Accounts</span>
        </button>

        <button
          onClick={() => setActiveTab('dbOps')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold font-sans tracking-wide border-b-2 cursor-pointer transition-all ${
            activeTab === 'dbOps'
              ? 'border-violet-600 text-violet-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database size={14} />
          <span>Database Backups</span>
        </button>

        <button
          onClick={() => setActiveTab('masterRep')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold font-sans tracking-wide border-b-2 cursor-pointer transition-all ${
            activeTab === 'masterRep'
              ? 'border-violet-600 text-violet-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileDigit size={14} />
          <span>Master Audits</span>
        </button>

        <button
          onClick={() => setActiveTab('supabase')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold font-sans tracking-wide border-b-2 cursor-pointer transition-all ${
            activeTab === 'supabase'
              ? 'border-violet-600 text-amber-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-amber-500/80'
          }`}
        >
          <Cloud size={14} className="text-amber-500 animate-pulse" />
          <span>Supabase Sync</span>
        </button>
      </div>

      {/* Shop Profile Tab */}
      {activeTab === 'shopProfile' && (
        <div className="space-y-6 animate-fade-in">
          {/* Preset Quick Loader Buttons */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                <Sparkles size={15} className="text-violet-400" />
                <span>Quick Preset Templates (කඩේ විස්තර ආකෘති)</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-1">
                තෝරාගත් ආකෘතියක් ක්ෂණිකව Load කර අවශ්‍ය පරිදි වෙනස් කර සුරකින්න:
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleApplyTemplate('lahiru')}
                className="py-1.5 px-3 rounded-xl bg-violet-950/60 hover:bg-violet-900/70 border border-violet-700/40 text-violet-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <span>🌿 ළහිරු Spices (Default)</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyTemplate('jayantha')}
                className="py-1.5 px-3 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/70 border border-indigo-700/40 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <span>🍃 ජයන්ත Spices</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyTemplate('custom')}
                className="py-1.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span>✏️ Clean / New Shop</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Form Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
                <div className="border-b border-slate-800/80 pb-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                      <Building2 size={15} className="text-violet-400" />
                      <span>Shop Identity & Thermal Receipt Customizer</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      මෙම තොරතුරු සියලුම 80mm & 58mm POS මුද්‍රිත බිල්පත් සහ තිර පෙරදසුන් වල ස්වයංක්‍රීයව දිස්වේ.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  {/* Shop Name English */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-300 font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Store size={13} className="text-violet-400" />
                        <span>Shop Name (කඩේ ප්‍රධාන ඉංග්‍රීසි නම) *</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-normal">Header line 1 (Bold)</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="E.g., LAHIRU SPICES CENTER"
                      value={profileForm.shopName}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, shopName: e.target.value }))}
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-100 outline-none focus:border-violet-600 transition-colors uppercase tracking-wide"
                    />
                    <p className="text-[10px] text-slate-500">
                      බිල්පතේ ඉහළින්ම ලොකුවට මුද්‍රණය වන ප්‍රධාන වෙළඳ නාමය.
                    </p>
                  </div>

                  {/* Shop Name Sinhala */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-300 font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <MessageSquare size={13} className="text-violet-400" />
                        <span>Shop Sinhala Name (සිංහල නාමය)</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-normal">Header line 2</span>
                    </label>
                    <input
                      type="text"
                      placeholder="උදා: ළහිරු කුළුබඩු එකතු කිරීමේ මධ්‍යස්ථානය"
                      value={profileForm.shopSinhalaName}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, shopSinhalaName: e.target.value }))}
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-100 outline-none focus:border-violet-600 transition-colors"
                    />
                    <p className="text-[10px] text-slate-500">
                      බිල්පතේ ප්‍රධාන නමට යටින් පෙන්වන සිංහල පැහැදිලි නාමය.
                    </p>
                  </div>

                  {/* Address */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-300 font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <MapPin size={13} className="text-emerald-400" />
                        <span>Address / Location (ලිපිනය / නගරය)</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-normal">Header line 3</span>
                    </label>
                    <input
                      type="text"
                      placeholder="E.g., Wewalwatta, Rathnapura"
                      value={profileForm.address}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-100 outline-none focus:border-violet-600 transition-colors"
                    />
                    <p className="text-[10px] text-slate-500">
                      කඩය පිහිටි ස්ථානය (📍 සංකේතය සමඟ බිල්පතේ මුද්‍රණය වේ).
                    </p>
                  </div>

                  {/* Contact Numbers (Phone 1 & Phone 2) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-300 font-bold flex items-center gap-1.5">
                        <Phone size={13} className="text-indigo-400" />
                        <span>Phone 1 (ප්‍රධාන දුරකථනය)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="E.g., 074 0050211"
                        value={profileForm.phone1}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, phone1: e.target.value }))}
                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 outline-none focus:border-violet-600 transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-300 font-bold flex items-center gap-1.5">
                        <Phone size={13} className="text-indigo-400" />
                        <span>Phone 2 (අමතර අංකය - Optional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="E.g., 076 0808246"
                        value={profileForm.phone2}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, phone2: e.target.value }))}
                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 outline-none focus:border-violet-600 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-800/80 pt-4 space-y-4">
                    {/* Footer Note */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-300 font-bold flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Receipt size={13} className="text-amber-400" />
                          <span>Receipt Footer Note (ස්තූති පණිවිඩය)</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-normal">Footer Line 1</span>
                      </label>
                      <input
                        type="text"
                        placeholder="E.g., *** THANK YOU! COME AGAIN ***"
                        value={profileForm.footerNote}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, footerNote: e.target.value }))}
                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-100 outline-none focus:border-violet-600 transition-colors"
                      />
                    </div>

                    {/* Footer Sub Note / Branding */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-300 font-bold flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Shield size={13} className="text-slate-400" />
                          <span>Footer Sub-Note / Software Credits (පහළ සටහන)</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-normal">Footer Line 2</span>
                      </label>
                      <input
                        type="text"
                        placeholder="E.g., Software Powered by Digicore Solution"
                        value={profileForm.footerSubNote}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, footerSubNote: e.target.value }))}
                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-normal text-slate-300 outline-none focus:border-violet-600 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileForm(shopProfile || DEFAULT_SHOP_PROFILE);
                        onToast('වෙනස්කම් ප්‍රතික්ෂේප කර කලින් සැකසුම් වෙත ආපසු ගියේය.', 'success');
                      }}
                      className="w-full sm:w-auto py-2.5 px-4 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <RotateCcw size={14} />
                      <span>Reset Form</span>
                    </button>

                    <button
                      type="submit"
                      className="w-full sm:w-auto py-2.5 px-6 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-950/50 transition-all active:scale-[0.98]"
                    >
                      <Save size={14} />
                      <span>සුරකින්න (Save Shop Profile)</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Live Thermal Receipt Preview Column */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3 sticky top-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Receipt size={15} className="text-violet-400" />
                    <span className="text-xs font-bold text-slate-200">Live Thermal Bill Preview</span>
                  </div>
                  {/* Paper Switcher */}
                  <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setPreviewPaper('80mm')}
                      className={`px-2 py-1 rounded font-bold transition-all cursor-pointer ${
                        previewPaper === '80mm' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      80mm
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewPaper('58mm')}
                      className={`px-2 py-1 rounded font-bold transition-all cursor-pointer ${
                        previewPaper === '58mm' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      58mm
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400">
                  පෝරමයේ ඇතුළත් කරන විස්තර අනුව බිල්පත මුද්‍රණය වන ආකාරය මෙසේ වේ:
                </p>

                {/* Thermal Ticket Container */}
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 overflow-hidden flex justify-center">
                  <div
                    className={`bg-slate-50 text-slate-900 py-5 px-4 rounded-lg font-mono leading-normal shadow-md border border-slate-300 transition-all ${
                      previewPaper === '80mm' ? 'w-full max-w-[340px] text-[11px]' : 'w-full max-w-[260px] text-[9.5px]'
                    }`}
                  >
                    {/* Header */}
                    <div className="text-center space-y-0.5">
                      <h3 className="font-extrabold text-black uppercase tracking-tight text-xs sm:text-sm">
                        {profileForm.shopName.trim() || 'SHOP NAME HERE'}
                      </h3>
                      {profileForm.shopSinhalaName && (
                        <p className="text-[10px] sm:text-[11px] text-slate-700 font-sans font-medium">
                          {profileForm.shopSinhalaName}
                        </p>
                      )}
                      <div className="text-[9px] sm:text-[10px] text-slate-600 font-sans space-y-0.5 mt-1">
                        {profileForm.address && <p>📍 {profileForm.address}</p>}
                        {(profileForm.phone1 || profileForm.phone2) && (
                          <p>📞 {[profileForm.phone1, profileForm.phone2].filter(Boolean).join(' / ')}</p>
                        )}
                      </div>
                    </div>

                    {/* Dotted Divider */}
                    <div className="border-t border-dotted border-slate-400 my-2.5"></div>

                    {/* Dummy metadata */}
                    <div className="space-y-0.5 text-[9px] sm:text-[10px] text-slate-700 font-sans">
                      <div className="flex justify-between">
                        <span>INVOICE NO:</span>
                        <span className="font-mono font-bold text-slate-900">INV-84920</span>
                      </div>
                      <div className="flex justify-between">
                        <span>DATE & TIME:</span>
                        <span>{new Date().toLocaleDateString('en-GB')} 10:30 AM</span>
                      </div>
                      <div className="flex justify-between">
                        <span>CASHIER:</span>
                        <span className="capitalize">Admin</span>
                      </div>
                    </div>

                    {/* Dotted Divider */}
                    <div className="border-t border-dotted border-slate-400 my-2"></div>

                    {/* Sample Items Table */}
                    <div className="space-y-1 text-[9px] sm:text-[10px]">
                      <div className="flex justify-between font-bold border-b border-slate-300 pb-1">
                        <span>ITEM / විස්තරය</span>
                        <span>TOTAL</span>
                      </div>
                      <div className="flex justify-between text-slate-800">
                        <span>ගම්මිරිස් 1 (Pepper) - 2.500 kg</span>
                        <span className="font-bold">Rs. 5,500.00</span>
                      </div>
                      <div className="flex justify-between text-slate-800">
                        <span>කරාබුනැටි (Cloves) - 0.500 kg</span>
                        <span className="font-bold">Rs. 1,750.00</span>
                      </div>
                    </div>

                    {/* Dotted Divider */}
                    <div className="border-t border-dotted border-slate-400 my-2"></div>

                    {/* Totals */}
                    <div className="space-y-0.5 text-[9px] sm:text-[10px]">
                      <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-300 text-[11px] sm:text-xs">
                        <span>Net Total (මුළු එකතුව):</span>
                        <span className="font-extrabold underline decoration-double">Rs. 7,250.00</span>
                      </div>
                    </div>

                    {/* Dotted Divider */}
                    <div className="border-t border-dotted border-slate-400 my-2.5"></div>

                    {/* Footer */}
                    <div className="text-center font-sans space-y-0.5 text-slate-600 text-[9px] sm:text-[10px]">
                      <p className="font-bold text-slate-800 uppercase">
                        {profileForm.footerNote || '*** THANK YOU! COME AGAIN ***'}
                      </p>
                      {profileForm.footerSubNote && (
                        <p className="text-slate-500 text-[8px] sm:text-[9px]">
                          {profileForm.footerSubNote}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* New User account creator */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 shadow-xl h-fit">
            <h4 className="text-xs font-bold text-slate-200 mb-4 flex items-center gap-2 border-b border-slate-800/80 pb-2.5">
              <Plus size={14} className="text-violet-400" />
              <span>Provision User Workspace</span>
            </h4>
            <form onSubmit={handleRegisterUser} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="E.g., Saman J"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 outline-none focus:border-violet-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Login Username Name</label>
                <input
                  type="text"
                  required
                  placeholder="E.g., saman"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 outline-none focus:border-violet-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Workrole Authorization</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full bg-slate-950/65 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none cursor-pointer"
                >
                  <option value="cashier" className="bg-slate-950">Standard Cashier</option>
                  <option value="admin" className="bg-slate-950">Store Admin</option>
                  {currentUserRole === 'superuser' && (
                    <option value="superuser" className="bg-slate-950">Super User (Full Control)</option>
                  )}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-extrabold select-none transition-all rounded-xl shadow-lg cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Shield size={14} />
                <span>Grant User Clearance</span>
              </button>
            </form>
          </div>

          {/* Active clearings */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 shadow-xl lg:col-span-2">
            <h4 className="text-xs font-bold text-slate-200 mb-4 flex items-center gap-2 border-b border-slate-800/80 pb-2.5">
              <Users size={14} className="text-violet-400" />
              <span>Permitted Operators Workspace</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-[10px] text-slate-400 font-bold uppercase select-none">
                    <th className="p-3">Operator Name</th>
                    <th className="p-3">Login Handler</th>
                    <th className="p-3 text-center">Authorization Badge</th>
                    <th className="p-3 text-right">Clearance Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-800/10 transition-colors">
                      <td className="p-3 font-semibold text-slate-200">{u.name}</td>
                      <td className="p-3 font-mono text-[11px] text-violet-400">@{u.username}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          u.role === 'superuser'
                            ? 'bg-amber-400/10 text-amber-400 border border-amber-500/20'
                            : u.role === 'admin'
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                            : 'bg-slate-800 text-slate-400 border border-slate-700/60'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3 text-right font-semibold">
                        {u.username === 'superuser' ? (
                          <span className="text-amber-500 text-[10px] font-bold select-none italic">Owner / Founder (Locked)</span>
                        ) : u.username === 'admin' ? (
                          <span className="text-slate-500 text-[10px] select-none italic">Root administrator (Locked)</span>
                        ) : (currentUserRole === 'superuser' || u.role === 'cashier') ? (
                          <button
                            onClick={() => {
                              if (confirm(`Do you want to revoke operatorship for ${u.name}?`)) {
                                onRemoveUser(u.id);
                                onToast('Operator revoked successfully.', 'success');
                              }
                            }}
                            className="text-red-400 hover:text-red-500 font-semibold hover:underline bg-transparent border-none cursor-pointer text-xs"
                          >
                            Revoke operator
                          </button>
                        ) : (
                          <span className="text-slate-500 text-[10px] select-none italic">Insufficient clearance</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DB Ops Backup Tab */}
      {activeTab === 'dbOps' && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div>
            <h4 className="text-xs font-semibold text-slate-200">Local Database CSV Operations</h4>
            <p className="text-xs text-slate-400 mt-0.5">Maintain physical copies of ජයන්ත spices center master ledger data.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-950/40 hover:border-violet-800/30 transition-all flex flex-col justify-between items-start gap-4 space-y-1">
              <div>
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Database size={14} className="text-violet-400" />
                  <span>Products catalog dump</span>
                </span>
                <p className="text-[10px] text-slate-400 mt-2">Exports and downloads current spices dictionary, stock levels, buying cost structure, and active sell pricing lists.</p>
              </div>
              <button
                onClick={downloadProductsBackup}
                className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer mt-2"
              >
                <Download size={13} />
                <span>Export products lists</span>
              </button>
            </div>

            <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-950/40 hover:border-violet-800/30 transition-all flex flex-col justify-between items-start gap-4 space-y-1">
              <div>
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Database size={14} className="text-amber-500" />
                  <span>Transactions ledger dump</span>
                </span>
                <p className="text-[10px] text-slate-400 mt-2">Exports and downloads total history logs including invoice ID, associated client, host cashier accounts, and financial figures.</p>
              </div>
              <button
                onClick={downloadTransactionsBackup}
                className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer mt-2"
              >
                <Download size={13} />
                <span>Export ledger sheets</span>
              </button>
            </div>
          </div>

          {currentUserRole === 'superuser' && (
            <div className="p-6 rounded-xl border border-red-500/20 bg-red-500/5 mt-4 space-y-6">
               <div>
                 <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                   <RefreshCw size={14} className="animate-spin" style={{ animationDuration: '4s' }} />
                   <span>System Hard Reset & Clean Zone (දත්ත මකා පද්ධතිය අලුතින් ආරම්භ කිරීම)</span>
                 </span>
                 <p className="text-[11px] text-slate-300 mt-2 font-medium">
                   Wipe, clean, or reset the system datasets according to your business needs:
                 </p>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {/* Option 1: Template Demo Reset */}
                 <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col justify-between space-y-3">
                   <div>
                     <span className="text-[11px] font-bold text-slate-300 block">1. Demo Templates Reset</span>
                     <span className="text-[10px] font-bold text-amber-500 block mt-0.5">ආදර්ශ දත්ත පිහිටුවීම</span>
                     <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                       Resets the system back to the default development installation with demo spices products and pre-loaded test transaction ledgers.
                     </p>
                   </div>
                    <button
                      onClick={async (e) => {
                        const btn = e.currentTarget;
                        const originalText = btn.innerText;
                        if (confirm('ආදර්ශ දත්ත (Demo Data) සමඟින් පද්ධතිය මුල සිට පිහිටුවීමට ඔබට අවශ්‍යද? (මෙය ස්ථිරවම සිදුවේ!)')) {
                          try {
                            btn.disabled = true;
                            btn.innerText = 'Resetting system...';
                            const hasSupa = !!createSupabaseClient();
                            if (hasSupa) {
                              onToast('Clearing Supabase remote database...', 'success');
                              await clearAllTransactionsInSupabase();
                              await resetProductsInSupabase(INITIAL_PRODUCTS);
                              await resetUsersInSupabase(INITIAL_USERS);
                            }
                            localStorage.removeItem('kulubadu_products');
                            localStorage.removeItem('kulubadu_transactions');
                            localStorage.removeItem('kulubadu_opening_cash');
                            localStorage.removeItem('kulubadu_opening_cash_logs');
                            localStorage.removeItem('kulubadu_expenses');
                            localStorage.removeItem('kulubadu_stock_adjustments');
                            localStorage.removeItem('supabase_last_rls_error');
                            onToast('Demo installation template reset complete!', 'success');
                            setTimeout(() => window.location.reload(), 1200);
                          } catch (err: any) {
                            console.error('Template reset failed:', err);
                            onToast('Template reset failed: ' + err.message, 'error');
                            btn.disabled = false;
                            btn.innerText = originalText;
                          }
                        }
                      }}
                      className="w-full py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 text-amber-400 text-xs font-bold rounded-lg cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reset to Demo Templates
                    </button>
                 </div>

                  {/* Option 2: Clean Fresh System, Keep Stock Levels */}
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col justify-between space-y-3">
                    <div>
                      <span className="text-[11px] font-bold text-slate-300 block">2. Fresh Start (Keep Current Products & Stocks)</span>
                      <span className="text-[10px] font-bold text-emerald-400 block mt-0.5">තොග ප්‍රමාණ තබා ගනිමින් ගනුදෙනු පමණක් මැකීම</span>
                      <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                        Wipes all sales, purchases, and ledger logs entirely (fresh 0 Rs. start) but keeps all your current items and their existing stock levels.
                      </p>
                    </div>
                    <button
                      onClick={async (e) => {
                        const btn = e.currentTarget;
                        const originalText = btn.innerText;
                        if (confirm('සියලුම විකුණුම් හා මිලදීගැනීම් ගනුදෙනු ලොග් (Ledger) පමණක් මකා දමා, පවතින බඩු ලැයිස්තුව සහ තොග ප්‍රමාණ එලෙසම තබා ගැනීමට ඔබට අවශ්‍යද?')) {
                          try {
                            btn.disabled = true;
                            btn.innerText = 'Resetting system...';
                            const hasSupa = !!createSupabaseClient();
                            if (hasSupa) {
                              onToast('Clearing remote Supabase ledger...', 'success');
                              await clearAllTransactionsInSupabase();
                              await resetProductsInSupabase(products);
                            }
                            // Keep current products
                            localStorage.setItem('kulubadu_products', JSON.stringify(products));
                            localStorage.setItem('kulubadu_transactions', JSON.stringify([]));
                            localStorage.removeItem('kulubadu_opening_cash');
                            localStorage.removeItem('kulubadu_opening_cash_logs');
                            localStorage.removeItem('kulubadu_expenses');
                            localStorage.removeItem('kulubadu_stock_adjustments');
                            localStorage.removeItem('supabase_last_rls_error');
                            onToast('Ledger wiped! Fresh system created successfully.', 'success');
                            setTimeout(() => window.location.reload(), 1200);
                          } catch (err: any) {
                            console.error('Reset failed:', err);
                            onToast('Reset failed: ' + err.message, 'error');
                            btn.disabled = false;
                            btn.innerText = originalText;
                          }
                        }
                      }}
                      className="w-full py-2 px-3 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 text-xs font-bold rounded-lg cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Fresh Start (Keeps Current Stocks)
                    </button>
                  </div>

                  {/* Option 3: Clean Fresh System, Zero All Stocks */}
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col justify-between space-y-3">
                    <div>
                      <span className="text-[11px] font-bold text-slate-300 block">3. Fresh Start (Zero All Stocks)</span>
                      <span className="text-[10px] font-bold text-rose-400 block mt-0.5">සියලු තොග ප්‍රමාණ 0 කර ගනුදෙනු මැකීම</span>
                      <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                        Wipes all transactions and sets the stock quantity of all current products in your list to 0.0 kg/pcs so you can enter your exact current stock.
                      </p>
                    </div>
                    <button
                      onClick={async (e) => {
                        const btn = e.currentTarget;
                        const originalText = btn.innerText;
                        if (confirm('සියලුම විකුණුම් හා මිලදීගැනීම් ගනුදෙනු මකා දමා, පවතින සියලුම භාණ්ඩ වල තොග ප්‍රමාණයන් 0 kg ලෙස fresh system එකක් සාදා දීමට ඔබට අවශ්‍යද?')) {
                          try {
                            btn.disabled = true;
                            btn.innerText = 'Zeroing stocks...';
                            const zeroedProducts = products.map(p => ({
                              ...p,
                              stock: 0,
                              lahiru_stock: 0,
                              jayantha_stock: 0
                            }));
                            const hasSupa = !!createSupabaseClient();
                            if (hasSupa) {
                              onToast('Zeroing stocks on remote Supabase...', 'success');
                              await clearAllTransactionsInSupabase();
                              await resetProductsInSupabase(zeroedProducts);
                            }
                            localStorage.setItem('kulubadu_products', JSON.stringify(zeroedProducts));
                            localStorage.setItem('kulubadu_transactions', JSON.stringify([]));
                            localStorage.removeItem('kulubadu_opening_cash');
                            localStorage.removeItem('kulubadu_opening_cash_logs');
                            localStorage.removeItem('kulubadu_expenses');
                            localStorage.removeItem('kulubadu_stock_adjustments');
                            localStorage.removeItem('supabase_last_rls_error');
                            onToast('Stocks set to 0 and all transactions wiped successfully!', 'success');
                            setTimeout(() => window.location.reload(), 1200);
                          } catch (err: any) {
                            console.error('Reset with zero stocks failed:', err);
                            onToast('Reset failed: ' + err.message, 'error');
                            btn.disabled = false;
                            btn.innerText = originalText;
                          }
                        }
                      }}
                      className="w-full py-2 px-3 bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/20 hover:border-rose-500/40 text-rose-300 text-xs font-bold rounded-lg cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Fresh Start (Zero All Stocks)
                    </button>
                  </div>

                  {/* Option 4: Full System Clear (Delete All Products & Transactions) */}
                  <div className="p-4 rounded-xl border border-red-500/20 bg-red-950/20 flex flex-col justify-between space-y-3">
                    <div>
                      <span className="text-[11px] font-bold text-red-400 block">4. Full System Clear (Delete All Products & Transactions)</span>
                      <span className="text-[10px] font-bold text-red-400 block mt-0.5">සියලුම භාණ්ඩ සහ ගනුදෙනු සම්පූර්ණයෙන්ම මකා දැමීම</span>
                      <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                        Deletes every single product from the product list and clears all transactions completely. Use this if you want to define your own products from scratch.
                      </p>
                    </div>
                    <button
                      onClick={async (e) => {
                        const btn = e.currentTarget;
                        const originalText = btn.innerText;
                        if (confirm('සියලුම භාණ්ඩ සහ ගනුදෙනු ලොග් (Ledger) සදහටම මකා දමා, හිස් සිස්ටම් එකක් ලබා ගැනීමට ඔබට අවශ්‍යද? (මෙය නැවත ලබාගත නොහැක!)')) {
                          try {
                            btn.disabled = true;
                            btn.innerText = 'Wiping everything...';
                            const hasSupa = !!createSupabaseClient();
                            if (hasSupa) {
                              onToast('Wiping all remote data on Supabase...', 'success');
                              await clearAllTransactionsInSupabase();
                              await resetProductsInSupabase([]);
                            }
                            localStorage.setItem('kulubadu_products', JSON.stringify([]));
                            localStorage.setItem('kulubadu_transactions', JSON.stringify([]));
                            localStorage.removeItem('kulubadu_opening_cash');
                            localStorage.removeItem('kulubadu_opening_cash_logs');
                            localStorage.removeItem('kulubadu_expenses');
                            localStorage.removeItem('kulubadu_stock_adjustments');
                            localStorage.removeItem('supabase_last_rls_error');
                            onToast('Wiped completely! Ready for new products.', 'success');
                            setTimeout(() => window.location.reload(), 1200);
                          } catch (err: any) {
                            console.error('Wipe failed:', err);
                            onToast('Wipe failed: ' + err.message, 'error');
                            btn.disabled = false;
                            btn.innerText = originalText;
                          }
                        }
                      }}
                      className="w-full py-2 px-3 bg-red-600/15 hover:bg-red-600/25 border border-red-500/20 hover:border-red-500/40 text-red-300 text-xs font-bold rounded-lg cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Delete All Products & Transactions
                    </button>
                  </div>
               </div>
            </div>
          )}
        </div>
      )}

      {/* Master Report Tab */}
      {activeTab === 'masterRep' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-emerald-950/20 border border-emerald-900/35 rounded-2xl p-4">
              <span className="text-[10px] text-slate-400 uppercase font-bold select-none">Lifetime Inflow (Revenue)</span>
              <h3 className="text-base font-extrabold text-emerald-400 mt-1 font-mono">{formatCurrency(masterStats.revenue)}</h3>
            </div>

            <div className="bg-amber-950/20 border border-amber-900/35 rounded-2xl p-4">
              <span className="text-[10px] text-slate-400 uppercase font-bold select-none">Lifetime Outflow (Costs)</span>
              <h3 className="text-base font-extrabold text-amber-500 mt-1 font-mono">{formatCurrency(masterStats.expenditures)}</h3>
            </div>

            <div className="bg-violet-950/20 border border-violet-900/35 rounded-2xl p-4">
              <span className="text-[10px] text-slate-400 uppercase font-bold select-none">Gross Profit Margin Estimate</span>
              <h3 className="text-base font-extrabold text-violet-400 mt-1 font-mono">{formatCurrency(masterStats.profit)}</h3>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
              <span className="text-[10px] text-slate-400 uppercase font-bold select-none">Operational Tx Ledger logs</span>
              <h3 className="text-base font-extrabold text-slate-200 mt-1 font-mono">{masterStats.count} bills</h3>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
             <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
               <BarChart2 className="text-violet-400" size={18} />
               <span className="text-xs font-bold text-slate-200">Lifetime Gross Performance Stats</span>
             </div>
             <p className="text-xs text-slate-400 leading-relaxed font-sans">
               These values aggregate historical statistics logged since development deploy date initialized. Clear custom entries by using the Database Factory Reset button to zero out margins.
             </p>
          </div>
        </div>
      )}

      {/* Supabase Integration Tab */}
      {activeTab === 'supabase' && (
        <div className="space-y-6 animate-fade-in">
          {hasRlsError && (
            <div className="bg-rose-950/40 border border-rose-900/60 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-rose-200 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="space-y-1">
                <h4 className="font-extrabold flex items-center gap-2 text-rose-300 text-sm">
                  <Lock size={16} className="animate-bounce text-rose-400" />
                  <span>Row-Level Security (RLS) Policy Blocking Sync!</span>
                </h4>
                <p className="text-xs text-rose-200/80 leading-normal max-w-2xl">
                  Row-Level Security is currently enabled on your Supabase tables, blocking direct client-side synchronization. Please execute the SQL commands listed at the bottom of this page in your Supabase SQL Editor to disable RLS and enable active replication.
                </p>
              </div>
              <button
                onClick={async () => {
                  onToast('Re-checking database security status...', 'success');
                  checkSupabaseStatus?.();
                }}
                className="py-2 px-4 bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 self-end sm:self-center cursor-pointer"
              >
                <RefreshCw size={12} className="text-rose-400" />
                <span>Recheck Status</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Setup Form */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 shadow-xl h-fit">
              <h4 className="text-xs font-bold text-slate-100 mb-4 flex items-center gap-2 border-b border-slate-800 pb-2.5">
                <Cloud size={15} className="text-amber-400" />
                <span>Link Supabase Cloud API</span>
              </h4>

              <form onSubmit={handleSaveSupaCreds} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Supabase URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://your-project.supabase.co"
                    value={supaUrl}
                    onChange={(e) => setSupaUrl(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 outline-none focus:border-violet-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Supabase Anon Key</label>
                  <input
                    type="password"
                    required
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={supaKey}
                    onChange={(e) => setSupaKey(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 outline-none focus:border-violet-600"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 text-xs">
                  <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                    Status:
                    {supaConnStatus === 'connected' ? (
                      <span className="text-emerald-500 font-bold flex items-center gap-0.5">
                        <CheckCircle2 size={10} /> Connected
                      </span>
                    ) : supaConnStatus === 'failed' ? (
                      <span className="text-red-500 font-bold flex items-center gap-0.5">
                        <XCircle size={10} /> Sync/Conn Error
                      </span>
                    ) : (
                      <span className="text-slate-400">Not configured</span>
                    )}
                  </span>

                  <button
                    type="submit"
                    disabled={isCheckingSupa}
                    className="py-1.5 px-3 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isCheckingSupa ? 'Checking...' : 'Save & Link'}
                  </button>
                </div>
              </form>
            </div>

            {/* Synchronization Control */}
            <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-100 mb-2 flex items-center gap-2">
                  <RefreshCw size={14} className="text-violet-400" />
                  <span>Manual Ledger Replication (Sync)</span>
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Synchronize your list of active spices, invoice transacting log entries, and personnel logins safely into your cloud database instance. This will upsert existing IDs to the cloud database.
                </p>

                {syncStatusLog && (
                  <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 h-32 overflow-y-auto mb-4">
                    <pre className="font-mono text-[10px] text-slate-300 leading-normal whitespace-pre-wrap">
                      {syncStatusLog}
                    </pre>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-3 border-t border-slate-850">
                <button
                  onClick={handleSyncNow}
                  disabled={isSyncing || !supaUrl || !supaKey}
                  className="py-2.5 px-5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-450 hover:to-amber-550 text-slate-950 font-extrabold text-xs tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 w-full sm:w-auto font-sans"
                >
                  <Cloud size={14} />
                  {isSyncing ? 'Syncing Tables...' : 'Sync All Data with Supabase Now'}
                </button>
              </div>
            </div>
          </div>

          {/* Database Schema guidelines for setup */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-850 pb-3">
              <h4 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                <Database size={15} className="text-violet-400" />
                <span>Supabase Database Schema Setup Instructions</span>
              </h4>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(SQL_SCHEMA);
                  onToast('SQL schema copied to your clipboard!', 'success');
                }}
                className="py-1 px-2.5 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1 bg-slate-950/40 transition-all cursor-pointer"
              >
                <Copy size={11} /> Copy SQL Queries
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              To allow synchronization, open your <b className="text-violet-405 font-bold hover:underline cursor-pointer">Supabase SQL Editor</b> and execute the query below to construct compatible database tables. If these tables do not exist in your project, sync errors will occur.
            </p>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 overflow-x-auto">
              <pre className="font-mono text-[10px] text-slate-300 select-all leading-normal">
                {SQL_SCHEMA}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SQL_SCHEMA = `-- Execute this inside your Supabase SQL Editor:

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT,
  unit TEXT,
  "buyPrice" NUMERIC,
  "sellPrice" NUMERIC,
  stock NUMERIC,
  lahiru_stock NUMERIC,
  jayantha_stock NUMERIC,
  min_stock_level NUMERIC,
  buying_price NUMERIC,
  wholesale_price NUMERIC,
  retail_price NUMERIC,
  category TEXT,
  image TEXT
);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  date TEXT,
  type TEXT,
  total NUMERIC,
  subtotal NUMERIC,
  discount NUMERIC,
  "contactName" TEXT,
  "paymentMethod" TEXT,
  payment_method TEXT,
  "createdBy" TEXT,
  items TEXT,
  invoice_no TEXT,
  user_id TEXT,
  amount_paid NUMERIC,
  total_profit NUMERIC,
  is_wholesale BOOLEAN
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT,
  username TEXT UNIQUE,
  role TEXT,
  password TEXT,
  shop_name TEXT,
  phone_number TEXT,
  invoice_prefix TEXT
);

-- DISABLE ROW LEVEL SECURITY (RLS) TO ALLOW DIRECT CLIENT-SIDE SYNC:
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;`;
