import { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { formatCurrency, formatDateString } from '../utils';
import { ReceiptText, Search, CreditCard, ChevronRight, CheckCircle2, Trash2, AlertTriangle, X } from 'lucide-react';

interface HistoryPageProps {
  transactions: Transaction[];
  onViewTransaction: (tx: Transaction) => void;
  onDeleteTransaction?: (txId: string) => void;
  onClearAllTransactions?: () => void;
}

export default function HistoryPage({
  transactions,
  onViewTransaction,
  onDeleteTransaction,
  onClearAllTransactions
}: HistoryPageProps) {
  const [filterType, setFilterType] = useState<'all' | 'sell' | 'buy' | 'return' | 'credit'>('all');
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);

  const getCreditInfo = (tx: Transaction) => {
    const pm = (tx.payment_method || '').toLowerCase();
    const cs = tx.credit_status;
    const isCredit = pm === 'credit' || cs === 'pending' || cs === 'partially_paid' || cs === 'paid';
    
    const totalPaid = tx.credit_paid_amount ?? tx.amount_paid ?? (tx.credit_payments ? tx.credit_payments.reduce((s, p) => s + p.amount, 0) : 0);
    const isFullyPaid = isCredit && (
      cs === 'paid' || 
      (tx.total > 0 && totalPaid >= tx.total)
    );
    return { isCredit, isFullyPaid, totalPaid };
  };

  const isCreditTx = (tx: Transaction) => {
    return getCreditInfo(tx).isCredit;
  };

  const isUnpaidCreditTx = (tx: Transaction) => {
    const { isCredit, isFullyPaid } = getCreditInfo(tx);
    return isCredit && !isFullyPaid;
  };

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return sortedTransactions.filter(tx => {
      let matchesType = true;
      if (filterType === 'credit') {
        matchesType = isUnpaidCreditTx(tx);
      } else if (filterType !== 'all') {
        matchesType = tx.type === filterType;
      }
      
      const textToSearch = `${tx.id} ${tx.contactName || ''} ${tx.createdBy || ''} ${tx.ref_invoice_no || ''} ${tx.payment_method || ''}`.toLowerCase();
      const matchesSearch = textToSearch.includes(search.toLowerCase());

      const txDateStr = tx.date.split('T')[0];
      const matchesDate = !selectedDate || txDateStr === selectedDate;

      return matchesType && matchesSearch && matchesDate;
    });
  }, [sortedTransactions, filterType, search, selectedDate]);

  return (
    <div id="historyPage" className="space-y-6">
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ReceiptText className="text-violet-400" size={20} />
            <h3 className="text-base font-bold text-slate-100">Chronological Bill History (බිල්පත් ඉතිහාසය)</h3>
            <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded-full">
              {filteredTransactions.length} {filteredTransactions.length === 1 ? 'Bill' : 'Bills'}
            </span>
          </div>

          {/* Clear All / Remove Dummy Data Action */}
          {onClearAllTransactions && transactions.length > 0 && (
            <button
              onClick={() => setConfirmClearAll(true)}
              className="py-1.5 px-3 rounded-xl border border-rose-800/40 bg-rose-950/20 hover:bg-rose-900/40 text-rose-400 hover:text-rose-300 font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-[0.98] self-start sm:self-auto"
              title="සියලුම Dummy / Test සහ පැරණි බිල්පත් මකා දමන්න"
            >
              <Trash2 size={13} className="text-rose-400" />
              <span>සියලු බිල්පත් මකන්න (Clear All Bills)</span>
            </button>
          )}
        </div>

        {/* Filter controls */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="flex flex-wrap gap-4 items-center flex-1 w-full">
            {/* Search Input */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 flex items-center gap-2 focus-within:border-violet-600 transition-all max-w-xs flex-1 min-w-[150px]">
              <Search size={16} className="text-slate-500" />
              <input
                type="text"
                placeholder="Search ID, customer, host..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-slate-200 py-2.5 text-xs font-medium outline-none"
              />
            </div>

            {/* Date Picker */}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-950/60 border border-slate-800 text-slate-300 text-xs py-2.5 px-3 rounded-xl outline-none focus:border-violet-600 font-sans cursor-pointer"
            />
          </div>

          {/* Type filters */}
          <div className="flex flex-wrap bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1 self-stretch md:self-auto justify-center">
            {(['all', 'sell', 'buy', 'return', 'credit'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase select-none cursor-pointer ${
                  filterType === type
                    ? type === 'credit'
                      ? 'bg-red-600/30 text-red-400 border border-red-500/50 shadow-md'
                      : 'bg-violet-600/25 text-violet-400 border border-violet-800/40'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {type === 'all' && 'All'}
                {type === 'sell' && 'Sales'}
                {type === 'buy' && 'Purchases'}
                {type === 'return' && 'Returns (ආපසු)'}
                {type === 'credit' && '🔴 නොගෙවූ ණය (Unpaid Credit)'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transaction List Cards */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="divide-y divide-slate-800/60">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-20 text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
              <CreditCard size={24} className="opacity-10" />
              <span>කිසිදු බිල්පතක් නොමැත (No transactions stored under chosen parameters).</span>
            </div>
          ) : (
            filteredTransactions.map(tx => {
              const { isCredit, isFullyPaid, totalPaid } = getCreditInfo(tx);
              
              // Determine card styling based on payment state
              let containerStyle = 'hover:bg-slate-800/25 border-l-2 border-l-amber-500/40';
              let badgeIconStyle = tx.type === 'return' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
              let amountStyle = tx.type === 'return' ? 'text-rose-400' : 'text-amber-400';

              if (isCredit) {
                if (isFullyPaid) {
                  // Fully Recovered Credit Bill -> GOLD/AMBER COLOR (රන් පැහැති)
                  containerStyle = 'bg-amber-950/20 border-l-4 border-l-amber-500 hover:bg-amber-950/30';
                  badgeIconStyle = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
                  amountStyle = 'text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30';
                } else {
                  // Unpaid / Partial Credit Bill -> RED COLOR
                  containerStyle = 'bg-red-950/20 border-l-4 border-l-red-500 hover:bg-red-950/30';
                  badgeIconStyle = 'bg-red-500/20 text-red-400 border border-red-500/30';
                  amountStyle = 'text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/30';
                }
              }

              return (
                <div
                  key={tx.id}
                  onClick={() => onViewTransaction(tx)}
                  className={`flex items-center justify-between p-4 cursor-pointer transition-colors group ${containerStyle}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${badgeIconStyle}`}>
                      {tx.type === 'sell' ? 'SELL' : (tx.type === 'return' ? 'RTRN' : 'BUY')}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 flex items-center flex-wrap gap-1.5">
                        <span>Invoice ID: {tx.id}</span>

                        {/* Credit Status Badges */}
                        {isCredit && isFullyPaid && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded font-sans bg-amber-500 text-slate-950 shadow-sm border border-amber-400 flex items-center gap-1">
                            <CheckCircle2 size={11} /> 🟡 ණය පියවා ඇත (CREDIT RECOVERED)
                          </span>
                        )}

                        {isCredit && !isFullyPaid && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded font-sans bg-red-600 text-white shadow-sm border border-red-500 animate-pulse">
                            🔴 ණය නොගෙවූ (CREDIT UNPAID)
                          </span>
                        )}

                        {tx.type === 'sell' && (
                          <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded font-mono ${
                            tx.is_wholesale 
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                              : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                          }`}>
                            {tx.is_wholesale ? 'WHOLESALE' : 'RETAIL'}
                          </span>
                        )}

                        {tx.type === 'return' && (
                          <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            RETURN BILL
                          </span>
                        )}
                      </h4>

                      <p className="text-[10px] text-slate-400 font-sans mt-1 flex items-center flex-wrap gap-2">
                        <span>Target: <span className="text-slate-300 font-semibold">{tx.contactName || 'Walk-in Customer'}</span></span>
                        <span>• {formatDateString(tx.date)}</span>
                        {isCredit && isFullyPaid && (
                          <span className="text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            ලැබුණු මුදල: {formatCurrency(totalPaid)} (සම්පූර්ණයි)
                          </span>
                        )}
                        {isCredit && !isFullyPaid && (
                          <span className="text-red-400 font-bold bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                            ගෙවීමට ඇති හිඟය: {formatCurrency(Math.max(0, tx.total - totalPaid))}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <span className={`text-xs font-extrabold font-mono ${amountStyle}`}>
                        {tx.type === 'sell' ? '+' : '-'}{formatCurrency(tx.total)}
                      </span>
                      <p className="text-[9px] text-slate-500 mt-0.5">Checked out by @{tx.createdBy}</p>
                    </div>

                    {/* Single Bill Delete Icon */}
                    {onDeleteTransaction && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingTxId(tx.id);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 border border-transparent hover:border-rose-900/40 transition-all cursor-pointer"
                        title="මෙම බිල්පත මකා දමන්න (Delete this bill)"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}

                    <ChevronRight size={14} className="text-slate-500 group-hover:text-slate-300 transition-all" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Delete Single Bill Confirmation Modal */}
      {deletingTxId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#0b0f19] border border-rose-900/50 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle size={20} />
              <h4 className="text-sm font-bold text-slate-100">බිල්පත මකා දැමීම (Delete Bill)</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              ඔබට <strong className="text-white font-mono">#{deletingTxId}</strong> දරණ බිල්පත පද්ධතියෙන් සහ දත්ත ගබඩාවෙන් සම්පූර්ණයෙන්ම ඉවත් කිරීමට අවශ්‍ය බව තහවුරු කරන්නද?
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTxId(null)}
                className="flex-1 py-2 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-slate-300 transition-all cursor-pointer"
              >
                අවලංගු කරන්න (Cancel)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteTransaction && deletingTxId) {
                    onDeleteTransaction(deletingTxId);
                  }
                  setDeletingTxId(null);
                }}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={13} />
                <span>ඔව්, මකන්න (Delete)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Bills Confirmation Modal */}
      {confirmClearAll && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#0b0f19] border border-rose-900/70 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-rose-400">
                <AlertTriangle size={22} className="animate-pulse" />
                <h4 className="text-base font-bold text-slate-100">සියලු බිල්පත් මකා දැමීම (Clear All Bills)</h4>
              </div>
              <button
                onClick={() => setConfirmClearAll(false)}
                className="text-slate-500 hover:text-slate-300 p-1"
              >
                <X size={16} />
              </button>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed">
              මෙමගින් මෙතෙක් සටහන් කර ඇති සියලුම <strong>Dummy / Test බිල්පත් සහ ගනුදෙනු ඉතිහාසය</strong> Local Storage සහ Supabase Cloud දත්ත ගබඩාවෙන් සම්පූර්ණයෙන්ම ඉවත් කෙරේ.
            </p>
            <p className="text-[11px] text-amber-400 bg-amber-950/30 border border-amber-900/40 p-2.5 rounded-xl font-medium">
              ⚠️ අවධානයට: මෙම ක්‍රියාව ආපසු හැරවිය නොහැක. සියලු පැරණි බිල්පත් {transactions.length} ක් මකා දැමෙනු ඇත.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearAll(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-slate-300 transition-all cursor-pointer"
              >
                අවලංගු කරන්න (Cancel)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onClearAllTransactions) {
                    onClearAllTransactions();
                  }
                  setConfirmClearAll(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={14} />
                <span>ඔව්, සියල්ල මකන්න (Clear All)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
