import React, { useState, useMemo } from 'react';
import { Transaction, CreditPaymentLog } from '../types';
import { getLocalTodayDateString } from '../utils';
import {
  CreditCard,
  Search,
  Filter,
  User,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  History,
  Wallet,
  Receipt,
  Plus
} from 'lucide-react';

interface CreditPageProps {
  transactions: Transaction[];
  onUpdateTransaction: (updatedTx: Transaction) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
  currentUserUsername: string;
}

export default function CreditPage({
  transactions,
  onUpdateTransaction,
  onToast,
  currentUserUsername
}: CreditPageProps) {
  const [activeTab, setActiveTab] = useState<'sell' | 'buy'>('sell');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'partially_paid' | 'paid' | 'active'>('active');

  // Recovery modal state
  const [selectedTxForRecovery, setSelectedTxForRecovery] = useState<Transaction | null>(null);
  const [recoveryAmount, setRecoveryAmount] = useState<number | ''>('');
  const [recoveryMethod, setRecoveryMethod] = useState<'Cash' | 'Bank Transfer' | 'Cheque' | 'Card' | 'Other'>('Cash');
  const [recoveryNote, setRecoveryNote] = useState('');

  // Extract credit transactions
  const isCreditTx = (tx: Transaction) => {
    if (!tx) return false;
    const pm = (tx.payment_method || '').toLowerCase();
    const cs = tx.credit_status;
    if (pm === 'credit' || cs === 'pending' || cs === 'partially_paid' || cs === 'paid') return true;
    const paid = tx.credit_paid_amount ?? tx.amount_paid;
    if (paid !== undefined && paid !== null && paid < tx.total) return true;
    if (tx.credit_payments && tx.credit_payments.length > 0) return true;
    return false;
  };

  const creditTransactions = useMemo(() => {
    return transactions.filter(isCreditTx);
  }, [transactions]);

  // Overall credit stats
  const stats = useMemo(() => {
    let totalCustomerCreditOutstanding = 0;
    let totalCustomerCreditCount = 0;
    let customerRecoveredToday = 0;

    let totalSupplierCreditOutstanding = 0;
    let totalSupplierCreditCount = 0;
    let supplierPaidToday = 0;

    const todayStr = getLocalTodayDateString();

    creditTransactions.forEach(tx => {
      const total = tx.total || 0;
      const paid = tx.credit_paid_amount ?? tx.amount_paid ?? 0;
      const remaining = Math.max(0, total - paid);

      if (tx.type === 'sell') {
        if (remaining > 0) {
          totalCustomerCreditOutstanding += remaining;
          totalCustomerCreditCount++;
        }
        if (tx.credit_payments) {
          tx.credit_payments.forEach(p => {
            const pDateStr = p.date ? getLocalTodayDateString(new Date(p.date)) : '';
            if (pDateStr === todayStr && p.payment_method === 'Cash') {
              customerRecoveredToday += p.amount;
            }
          });
        }
      } else if (tx.type === 'buy') {
        if (remaining > 0) {
          totalSupplierCreditOutstanding += remaining;
          totalSupplierCreditCount++;
        }
        if (tx.credit_payments) {
          tx.credit_payments.forEach(p => {
            const pDateStr = p.date ? getLocalTodayDateString(new Date(p.date)) : '';
            if (pDateStr === todayStr && p.payment_method === 'Cash') {
              supplierPaidToday += p.amount;
            }
          });
        }
      }
    });

    return {
      totalCustomerCreditOutstanding,
      totalCustomerCreditCount,
      customerRecoveredToday,
      totalSupplierCreditOutstanding,
      totalSupplierCreditCount,
      supplierPaidToday
    };
  }, [creditTransactions]);

  // Filter list
  const filteredList = useMemo(() => {
    return creditTransactions.filter(tx => {
      // Must match tab
      if (tx.type !== activeTab) return false;

      // Status check
      const total = tx.total || 0;
      const paid = tx.credit_paid_amount ?? tx.amount_paid ?? 0;
      const remaining = Math.max(0, total - paid);

      let effectiveStatus: 'pending' | 'partially_paid' | 'paid' = tx.credit_status || 'pending';
      if (remaining <= 0) effectiveStatus = 'paid';
      else if (paid > 0) effectiveStatus = 'partially_paid';

      if (statusFilter === 'active' && remaining <= 0) return false;
      if (statusFilter !== 'all' && statusFilter !== 'active' && effectiveStatus !== statusFilter) return false;

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const invoiceMatch = (tx.invoice_no || tx.id).toLowerCase().includes(q);
        const contactMatch = (tx.contactName || '').toLowerCase().includes(q);
        return invoiceMatch || contactMatch;
      }

      return true;
    });
  }, [creditTransactions, activeTab, statusFilter, searchQuery]);

  const handleOpenRecoveryModal = (tx: Transaction) => {
    setSelectedTxForRecovery(tx);
    const totalBill = tx.total || 0;
    const paid = tx.credit_paid_amount ?? tx.amount_paid ?? 0;
    const remaining = Math.max(0, totalBill - paid);
    setRecoveryAmount(remaining > 0 ? remaining : '');
    setRecoveryMethod('Cash');
    setRecoveryNote('');
  };

  const handleSaveRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxForRecovery) return;

    const payAmt = Number(recoveryAmount);
    if (isNaN(payAmt) || payAmt <= 0) {
      onToast('කරුණාකර නිවැරදි මුදලක් ඇතුළත් කරන්න.', 'error');
      return;
    }

    const currentPaid = selectedTxForRecovery.credit_paid_amount ?? selectedTxForRecovery.amount_paid ?? 0;
    const newPaidTotal = Number((currentPaid + payAmt).toFixed(2));
    const grandTotal = selectedTxForRecovery.total;
    const newRemaining = Math.max(0, grandTotal - newPaidTotal);

    let newStatus: 'pending' | 'partially_paid' | 'paid' = 'partially_paid';
    if (newRemaining <= 0) {
      newStatus = 'paid';
    } else if (newPaidTotal === 0) {
      newStatus = 'pending';
    }

    const newPaymentLog: CreditPaymentLog = {
      id: `PAY-${Date.now()}`,
      date: new Date().toISOString(),
      amount: payAmt,
      payment_method: recoveryMethod,
      note: recoveryNote.trim() || undefined,
      addedBy: currentUserUsername
    };

    const existingLogs = selectedTxForRecovery.credit_payments || [];

    const updatedTx: Transaction = {
      ...selectedTxForRecovery,
      credit_paid_amount: newPaidTotal,
      amount_paid: newPaidTotal,
      credit_status: newStatus,
      credit_payments: [newPaymentLog, ...existingLogs]
    };

    onUpdateTransaction(updatedTx);
    onToast(`Rs. ${payAmt.toLocaleString()} ණය ගෙවීම සාර්ථකව සටහන් කර ගන්නා ලදී.`, 'success');
    setSelectedTxForRecovery(null);
  };

  return (
    <div id="creditPage" className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 shadow-xl">
        <div>
          <h1 className="text-base sm:text-xl font-bold text-white flex items-center gap-2.5">
            <CreditCard className="text-violet-400 shrink-0" size={22} />
            <span>ණය බිල්පත් පාලනය (Credit Ledger)</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-1">
            පාරිභෝගිකයින්ගේ සහ සැපයුම්කරුවන්ගේ ණය බිල්පත් නැරඹීම සහ ණය මුදල් පියවීම
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('sell')}
            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'sell'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User size={14} />
            <span className="truncate">පාරිභෝගික ණය (Sell)</span>
          </button>
          <button
            onClick={() => setActiveTab('buy')}
            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'buy'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 size={14} />
            <span className="truncate">සැපයුම්කාර ණය (Buy)</span>
          </button>
        </div>
      </div>

      {/* Overview Metrics Grid - Mobile Friendly */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-slate-900/60 border border-red-900/30 rounded-2xl p-3 sm:p-4 space-y-1 sm:space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-[10px] sm:text-xs">
            <span className="truncate">ලැබීමට ඇති පාරිභෝගික ණය</span>
            <ArrowDownLeft className="text-red-400 shrink-0" size={14} />
          </div>
          <p className="text-sm sm:text-xl font-extrabold font-mono text-red-400 truncate">
            Rs. {stats.totalCustomerCreditOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[9px] sm:text-[10px] text-slate-500 truncate hidden sm:block">විකුණුම් බිල්පත් වලින් තවම ලැබීමට ඇති මුදල</p>
        </div>

        <div className="bg-slate-900/60 border border-emerald-900/30 rounded-2xl p-3 sm:p-4 space-y-1 sm:space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-[10px] sm:text-xs">
            <span className="truncate">අද ලැබුණු පාරිභෝගික ණය</span>
            <Wallet className="text-emerald-400 shrink-0" size={14} />
          </div>
          <p className="text-sm sm:text-xl font-extrabold font-mono text-emerald-400 truncate">
            Rs. {stats.customerRecoveredToday.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[9px] sm:text-[10px] text-slate-500 truncate hidden sm:block">අද දිනයේ ලාච්චුවට එකතු වූ මුදල</p>
        </div>

        <div className="bg-slate-900/60 border border-amber-900/30 rounded-2xl p-3 sm:p-4 space-y-1 sm:space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-[10px] sm:text-xs">
            <span className="truncate">සැපයුම්කරුවන්ට ගෙවීමට ඇති ණය</span>
            <ArrowUpRight className="text-amber-400 shrink-0" size={14} />
          </div>
          <p className="text-sm sm:text-xl font-extrabold font-mono text-amber-400 truncate">
            Rs. {stats.totalSupplierCreditOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[9px] sm:text-[10px] text-slate-500 truncate hidden sm:block">මිලදී ගැනීම් වලින් ගෙවීමට ඇති මුදල</p>
        </div>

        <div className="bg-slate-900/60 border border-violet-900/30 rounded-2xl p-3 sm:p-4 space-y-1 sm:space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-[10px] sm:text-xs">
            <span className="truncate">අද සැපයුම්කරුවන්ට ගෙවූ ණය</span>
            <History className="text-violet-400 shrink-0" size={14} />
          </div>
          <p className="text-sm sm:text-xl font-extrabold font-mono text-violet-400 truncate">
            Rs. {stats.supplierPaidToday.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[9px] sm:text-[10px] text-slate-500 truncate hidden sm:block">අද සැපයුම්කරුවන්ට ලාච්චුවෙන් ගෙවූ මුදල</p>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xl">
        {/* Search Bar */}
        <div className="w-full md:w-80 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 flex items-center gap-2 focus-within:border-violet-600 transition-all">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'sell' ? 'බිල් අංකය, පාරිභෝගික නම...' : 'බිල් අංකය, සැපයුම්කරු...'}
            className="w-full bg-transparent text-slate-200 text-xs font-medium outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-slate-300">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 bg-slate-950/50'
            }`}
          >
            අගෙවූ / සක්‍රීය ණය
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 bg-slate-950/50'
            }`}
          >
            සියල්ල
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              statusFilter === 'pending'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'text-slate-400 hover:text-slate-200 bg-slate-950/50'
            }`}
          >
            නොගෙවූ
          </button>
          <button
            onClick={() => setStatusFilter('partially_paid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              statusFilter === 'partially_paid'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 bg-slate-950/50'
            }`}
          >
            කොටසක් ගෙවූ
          </button>
          <button
            onClick={() => setStatusFilter('paid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              statusFilter === 'paid'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 bg-slate-950/50'
            }`}
          >
            පියවූ
          </button>
        </div>
      </div>

      {/* Credit Transactions List - Mobile Cards on Phone, Table on Desktop */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Mobile Cards View (< md) */}
        <div className="block md:hidden p-3 space-y-3">
          {filteredList.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Receipt className="mx-auto mb-2 opacity-30" size={32} />
              <p className="font-semibold text-xs">කිසිදු ණය බිල්පතක් හමු නොවුණි.</p>
            </div>
          ) : (
            filteredList.map(tx => {
              const total = tx.total || 0;
              const paid = tx.credit_paid_amount ?? tx.amount_paid ?? 0;
              const remaining = Math.max(0, total - paid);

              let status: 'pending' | 'partially_paid' | 'paid' = tx.credit_status || 'pending';
              if (remaining <= 0) status = 'paid';
              else if (paid > 0) status = 'partially_paid';

              return (
                <div
                  key={tx.id}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5 shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-violet-400 text-xs">{tx.invoice_no || tx.id}</span>
                      <h4 className="font-bold text-slate-100 text-sm mt-0.5">
                        {tx.contactName || (activeTab === 'sell' ? 'Walk-in Customer' : 'Local Supplier')}
                      </h4>
                      <span className="text-[10px] text-slate-500 block">
                        {new Date(tx.date).toLocaleDateString('en-GB')} {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <span className="shrink-0">
                      {status === 'paid' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                          <CheckCircle2 size={11} />
                          <span>පියවා ඇත</span>
                        </span>
                      )}
                      {status === 'partially_paid' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                          <Clock size={11} />
                          <span>කොටසක් ගෙවා ඇත</span>
                        </span>
                      )}
                      {status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold">
                          <AlertCircle size={11} />
                          <span>නොගෙවූ ණය</span>
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 bg-slate-900/60 p-2 rounded-lg text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">මුළු බිල:</span>
                      <span className="font-mono font-bold text-slate-200">
                        Rs. {total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">ගෙවූ:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        Rs. {paid.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">ඉතිරි ණය:</span>
                      <span className="font-mono font-black text-red-400">
                        Rs. {remaining.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenRecoveryModal(tx)}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-98 ${
                      remaining > 0
                        ? activeTab === 'sell'
                          ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-950/50'
                          : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/50'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    <Wallet size={14} />
                    <span>{remaining > 0 ? 'ණය පියවීම (Recover)' : 'විස්තර (Details)'}</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">බිල් අංකය (Invoice)</th>
                <th className="p-3.5">දිනය සහ වේලාව</th>
                <th className="p-3.5">{activeTab === 'sell' ? 'පාරිභෝගිකයා (Customer)' : 'සැපයුම්කරු (Supplier)'}</th>
                <th className="p-3.5 text-right">මුළු වටිනාකම</th>
                <th className="p-3.5 text-right">ගෙවූ මුදල</th>
                <th className="p-3.5 text-right">ඉතිරි ණය මුදල</th>
                <th className="p-3.5 text-center">තත්ත්වය</th>
                <th className="p-3.5 text-center">ක්‍රියාමාර්ග</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    <Receipt className="mx-auto mb-2 opacity-30" size={32} />
                    <p className="font-semibold">කිසිදු ණය බිල්පතක් හමු නොවුණි.</p>
                  </td>
                </tr>
              ) : (
                filteredList.map(tx => {
                  const total = tx.total || 0;
                  const paid = tx.credit_paid_amount ?? tx.amount_paid ?? 0;
                  const remaining = Math.max(0, total - paid);

                  let status: 'pending' | 'partially_paid' | 'paid' = tx.credit_status || 'pending';
                  if (remaining <= 0) status = 'paid';
                  else if (paid > 0) status = 'partially_paid';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/30 transition-all">
                      <td className="p-3.5 font-mono font-bold text-violet-400">{tx.invoice_no || tx.id}</td>
                      <td className="p-3.5 text-slate-400">
                        {new Date(tx.date).toLocaleDateString('en-GB')} {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3.5 font-semibold text-white">
                        {tx.contactName || (activeTab === 'sell' ? 'Walk-in Customer' : 'Local Supplier')}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-slate-200">
                        Rs. {total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-emerald-400">
                        Rs. {paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3.5 text-right font-mono font-extrabold text-red-400">
                        Rs. {remaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3.5 text-center">
                        {status === 'paid' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                            <CheckCircle2 size={12} />
                            <span>පියවා ඇත</span>
                          </span>
                        )}
                        {status === 'partially_paid' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                            <Clock size={12} />
                            <span>කොටසක් ගෙවා ඇත</span>
                          </span>
                        )}
                        {status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold">
                            <AlertCircle size={12} />
                            <span>නොගෙවූ ණය</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleOpenRecoveryModal(tx)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm ${
                            remaining > 0
                              ? activeTab === 'sell'
                                ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-950/50'
                                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/50'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          {remaining > 0 ? 'ණය පියවීම (Recover)' : 'විස්තර (Details)'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Credit Recovery Modal - 100% Mobile Responsive */}
      {selectedTxForRecovery && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 space-y-4 shadow-2xl relative max-h-[92dvh] overflow-y-auto my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Wallet size={18} className={activeTab === 'sell' ? "text-violet-400" : "text-amber-400"} />
                  <span>
                    {activeTab === 'sell' ? 'පාරිභෝගික ණය පියවීම' : 'සැපයුම්කාර ණය ගෙවීම'}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  බිල් අංකය: <span className="font-mono text-violet-300 font-bold">{selectedTxForRecovery.invoice_no || selectedTxForRecovery.id}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedTxForRecovery(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl bg-slate-800/50 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Bill Info Summary Card */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 sm:p-3.5 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">නම:</span>
                <span className="font-bold text-slate-200">{selectedTxForRecovery.contactName || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">මුළු බිල් වටිනාකම:</span>
                <span className="font-mono font-bold text-slate-200">Rs. {(selectedTxForRecovery.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">මේ දක්වා ගෙවා ඇති මුදල:</span>
                <span className="font-mono font-bold text-emerald-400">Rs. {(selectedTxForRecovery.credit_paid_amount ?? selectedTxForRecovery.amount_paid ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800/80 pt-2 font-bold text-xs sm:text-sm">
                <span className="text-slate-300">තවම ගෙවීමට ඇති ඉතිරිය:</span>
                <span className="font-mono font-extrabold text-red-400">
                  Rs. {Math.max(0, (selectedTxForRecovery.total || 0) - (selectedTxForRecovery.credit_paid_amount ?? selectedTxForRecovery.amount_paid ?? 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Payment Recovery Form */}
            <form onSubmit={handleSaveRecovery} className="space-y-3.5">
              {/* Payment Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  දැන් ගෙවන මුදල (Rs.) *
                </label>
                <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 flex items-center gap-2 focus-within:border-violet-500 transition-all">
                  <span className="text-xs font-bold text-slate-500">Rs.</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={Math.max(0, (selectedTxForRecovery.total || 0) - (selectedTxForRecovery.credit_paid_amount ?? selectedTxForRecovery.amount_paid ?? 0))}
                    value={recoveryAmount === '' ? '' : recoveryAmount}
                    onChange={(e) => setRecoveryAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0.00"
                    className="w-full bg-transparent text-slate-100 font-mono font-bold text-sm outline-none"
                    required
                  />
                </div>

                {/* Quick chip buttons */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const rem = Math.max(0, (selectedTxForRecovery.total || 0) - (selectedTxForRecovery.credit_paid_amount ?? selectedTxForRecovery.amount_paid ?? 0));
                      setRecoveryAmount(rem);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-violet-600/20 text-violet-300 border border-violet-500/30 text-[10px] font-bold cursor-pointer hover:bg-violet-600/30"
                  >
                    සම්පූර්ණ ඉතිරියම (Full)
                  </button>
                  {[500, 1000, 2000, 5000, 10000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setRecoveryAmount(amt)}
                      className="px-2 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-mono cursor-pointer hover:bg-slate-700"
                    >
                      +Rs. {amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  ගෙවීම් ක්‍රමය (Payment Method)
                </label>
                <select
                  value={recoveryMethod}
                  onChange={(e) => setRecoveryMethod(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-200 outline-none cursor-pointer focus:border-violet-500"
                >
                  <option value="Cash">Cash (මුදලින් - Cash Drawer එකට)</option>
                  <option value="Bank Transfer">Bank Transfer (බැංකු තැන්පතු)</option>
                  <option value="Cheque">Cheque (චෙක්පත්)</option>
                  <option value="Card">Card Payment</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Note / Remarks */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  සටහන (Optional Note)
                </label>
                <input
                  type="text"
                  value={recoveryNote}
                  onChange={(e) => setRecoveryNote(e.target.value)}
                  placeholder="E.g., Partial cash collection by cashier"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-200 outline-none focus:border-violet-500"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className={`w-full py-3 rounded-xl font-bold text-xs tracking-wider transition-all text-white shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-98 ${
                  activeTab === 'sell'
                    ? 'bg-violet-600 hover:bg-violet-500 shadow-violet-950/50'
                    : 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/50'
                }`}
              >
                <Plus size={16} />
                <span>ගෙවීම සටහන් කර සුරකින්න (Record Recovery)</span>
              </button>
            </form>

            {/* Previous Payment History Logs */}
            {selectedTxForRecovery.credit_payments && selectedTxForRecovery.credit_payments.length > 0 && (
              <div className="border-t border-slate-800 pt-3 space-y-2">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <History size={14} className="text-violet-400" />
                  <span>පෙර ගෙවීම් වාර්තා (Payment Logs History)</span>
                </h4>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {selectedTxForRecovery.credit_payments.map(log => (
                    <div key={log.id} className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-2 text-[11px] flex justify-between items-center">
                      <div>
                        <span className="font-mono font-bold text-emerald-400">Rs. {log.amount.toLocaleString()}</span>
                        <span className="text-slate-400 ml-2">({log.payment_method})</span>
                        {log.note && <span className="text-slate-500 block text-[10px]">{log.note}</span>}
                      </div>
                      <div className="text-right text-[10px] text-slate-500">
                        <span>{new Date(log.date).toLocaleDateString()}</span>
                        <span className="block text-slate-400 font-medium">{log.addedBy}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { CreditPage };
