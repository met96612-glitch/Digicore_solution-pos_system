import React, { useState, useMemo } from 'react';
import { Expense } from '../types';
import { formatCurrency, formatDateString, getLocalTodayDateString } from '../utils';
import { Receipt, Plus, Trash2, Calendar, User, Search, Filter, AlertCircle, Banknote, BookOpen, Utensils, Coffee, Bus, Zap, Wrench, MoreHorizontal } from 'lucide-react';

interface ExpensesPageProps {
  expenses: Expense[];
  currentUserUsername: string;
  currentUserRole?: string;
  onAddExpense: (expense: Omit<Expense, 'id' | 'date' | 'addedBy'>) => void;
  onDeleteExpense: (id: string) => void;
  onToast?: (msg: string, type: 'success' | 'error') => void;
  currentDrawerBalance?: number;
}

const CATEGORIES = [
  { id: 'Stationery/Books', label: '📖 පොත් / ලිපිද්‍රව්‍ය (Notebook/Pen)', icon: BookOpen, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { id: 'Food/Meals', label: '🍲 කෑම / බීම (Meals/Food)', icon: Utensils, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  { id: 'Tea/Drinks', label: '☕ තේ / බීම (Tea/Refreshments)', icon: Coffee, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  { id: 'Transport', label: '🚌 ගමන් වියදම් (Transport/Petrol)', icon: Bus, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  { id: 'Utilities', label: '💡 විදුලි / දුරකථන බිල් (Bills/Utilities)', icon: Zap, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  { id: 'Maintenance', label: '🛠️ නඩත්තු / අලුත්වැඩියා (Maintenance)', icon: Wrench, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { id: 'Other', label: '📦 වෙනත් අමතර වියදම් (Other)', icon: MoreHorizontal, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
];

export default function ExpensesPage({
  expenses,
  currentUserUsername,
  currentUserRole,
  onAddExpense,
  onDeleteExpense,
  onToast,
  currentDrawerBalance = 0
}: ExpensesPageProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  const todayStr = useMemo(() => {
    return getLocalTodayDateString();
  }, []);

  const [filterDate, setFilterDate] = useState<string>(todayStr);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!title.trim()) {
      onToast?.('කරුණාකර වියදමේ විස්තරයක් ඇතුළත් කරන්න (Please enter title)', 'error');
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      onToast?.('කරුණාකර නිවැරදි මුදලක් ඇතුළත් කරන්න (Please enter valid amount)', 'error');
      return;
    }

    onAddExpense({
      category,
      title: title.trim(),
      amount: numAmount,
      note: note.trim() || undefined
    });

    onToast?.(`වියදම (Rs. ${numAmount.toFixed(2)}) ලච්චුවේ සල්ලියෙන් අඩුවෙන සේ සාර්ථකව සටහන් විය!`, 'success');

    // Reset form
    setTitle('');
    setAmount('');
    setNote('');
    setShowAddModal(false);
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const expDate = exp.date.split('T')[0];
      const matchesDate = !filterDate || expDate === filterDate;
      const matchesCategory = selectedCategoryFilter === 'ALL' || exp.category === selectedCategoryFilter;
      const matchesSearch = !searchQuery.trim() ||
        exp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.addedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.amount.toString().includes(searchQuery);

      return matchesDate && matchesCategory && matchesSearch;
    });
  }, [expenses, filterDate, selectedCategoryFilter, searchQuery]);

  const todayExpensesTotal = useMemo(() => {
    return expenses
      .filter(exp => exp.date.split('T')[0] === todayStr)
      .reduce((sum, exp) => sum + exp.amount, 0);
  }, [expenses, todayStr]);

  const filteredExpensesTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  }, [filteredExpenses]);

  const getCategoryInfo = (catId: string) => {
    return CATEGORIES.find(c => c.id === catId) || CATEGORIES[CATEGORIES.length - 1];
  };

  return (
    <div id="expensesPage" className="space-y-4 sm:space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-rose-500/15 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 shadow-inner">
            <Receipt size={22} className="sm:w-6 sm:h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-xl font-black text-slate-100 flex items-center gap-2">
              <span>අමතර කඩේ වියදම් (Shop Expenses)</span>
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
              පොත්, කෑම, පෑන්, බිල්පත් සහ අනෙකුත් වියදම් ලච්චුවේ සල්ලියෙන් අඩුවන සේ සටහන් කරන්න.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full sm:w-auto py-2.5 px-4 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer border border-rose-400/30 active:scale-95"
          >
            <Plus size={16} />
            <span>අලුත් වියදමක් එක් කරන්න</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
        {/* Today's Total Expenses */}
        <div className="bg-rose-950/20 border border-rose-900/35 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">අද දින මුළු වියදම (Today's Expenses)</span>
            <h3 className="text-lg sm:text-2xl font-black text-rose-400 mt-1 font-mono">
              {formatCurrency(todayExpensesTotal)}
            </h3>
            <span className="text-[9px] sm:text-[10px] text-rose-300/80 mt-0.5 block font-bold">
              ලච්චුවෙන් අඩුවී ඇත (- LKR)
            </span>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-500/15 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
            <Receipt size={20} />
          </div>
        </div>

        {/* Selected Filter Total */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">තෝරාගත් පෙරහනට අදාළ මුදල</span>
            <h3 className="text-lg sm:text-2xl font-black text-slate-200 mt-1 font-mono">
              {formatCurrency(filteredExpensesTotal)}
            </h3>
            <span className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 block">
              සටහන් {filteredExpenses.length} ක්
            </span>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center shrink-0">
            <Filter size={20} />
          </div>
        </div>

        {/* Drawer Balance Info */}
        <div className="bg-emerald-950/20 border border-emerald-900/35 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">දැනට ලාච්චුවේ ඉතිරි මුදල</span>
            <h3 className="text-lg sm:text-2xl font-black text-emerald-400 mt-1 font-mono">
              {formatCurrency(currentDrawerBalance)}
            </h3>
            <span className="text-[9px] sm:text-[10px] text-emerald-300/80 mt-0.5 block font-bold">
              (වියදම් අඩු වූ පසු සජීවීව)
            </span>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Banknote size={20} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center flex-1">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
            <input
              type="text"
              placeholder="විස්තරය, නම හෝ මුදල සොයන්න..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-rose-500/50"
            />
          </div>

          {/* Date Picker */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 gap-2">
            <Calendar size={14} className="text-slate-400 shrink-0" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-transparent text-slate-200 text-xs font-mono font-bold focus:outline-none cursor-pointer"
            />
            {filterDate && (
              <button
                onClick={() => setFilterDate('')}
                className="text-[10px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
              >
                සියල්ල
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedCategoryFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${selectedCategoryFilter === 'ALL'
              ? 'bg-rose-600 text-white shadow-md'
              : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
          >
            සියලු වර්ග
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${selectedCategoryFilter === cat.id
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
            >
              {cat.label.split('(')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Expense History - Mobile Cards on Phone, Table on Desktop */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <Receipt className="text-rose-400" size={18} />
            <h3 className="text-xs sm:text-sm font-bold text-slate-200">
              වියදම් සටහන් ලැයිස්තුව (Expenses Log)
            </h3>
          </div>
          <span className="text-[11px] sm:text-xs text-slate-400">
            ලොග් සටහන් {filteredExpenses.length} ක්
          </span>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="text-center py-10 text-slate-500 space-y-2">
            <AlertCircle size={28} className="mx-auto text-slate-600 mb-1" />
            <p className="text-xs sm:text-sm font-medium">කිසිදු වියදම් සටහනක් හමු නොවීය.</p>
            <p className="text-[10px] sm:text-xs text-slate-600">No expenses recorded for the selected filter.</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards View (< md) */}
            <div className="block md:hidden space-y-2.5">
              {filteredExpenses.map(exp => {
                const catInfo = getCategoryInfo(exp.category);
                const Icon = catInfo.icon;
                return (
                  <div
                    key={exp.id}
                    className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2 shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${catInfo.color}`}>
                          <Icon size={11} />
                          <span>{catInfo.label.split('(')[0]}</span>
                        </span>
                        <h4 className="font-bold text-slate-100 text-sm mt-1">{exp.title}</h4>
                        {exp.note && (
                          <p className="text-[10px] text-slate-400 italic mt-0.5">
                            සටහන: {exp.note}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-black text-rose-400 font-mono text-sm block">
                          - {formatCurrency(exp.amount)}
                        </span>
                        <button
                          onClick={() => {
                            if (window.confirm(`"${exp.title}" වියදම් සටහන ඉවත් කිරීමට ඔබට විශ්වාසද? (Delete Expense)`)) {
                              onDeleteExpense(exp.id);
                              onToast?.('වියදම් සටහන ඉවත් කරන ලදී!', 'success');
                            }
                          }}
                          className="p-1 text-slate-500 hover:text-red-400 mt-1 cursor-pointer inline-block"
                          title="Delete Expense"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-slate-800/60 font-mono">
                      <span>{formatDateString(exp.date)}</span>
                      <span className="text-slate-400 font-sans">@{exp.addedBy}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-3">දිනය සහ වේලාව</th>
                    <th className="py-3 px-3">වර්ගය (Category)</th>
                    <th className="py-3 px-3">වියදම් විස්තරය (Title / Details)</th>
                    <th className="py-3 px-3">එක් කළේ (Operator)</th>
                    <th className="py-3 px-3 text-right">මුදල (Amount)</th>
                    <th className="py-3 px-3 text-center">ක්‍රියාමාර්ග</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {filteredExpenses.map(exp => {
                    const catInfo = getCategoryInfo(exp.category);
                    const Icon = catInfo.icon;
                    return (
                      <tr key={exp.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-3 font-mono text-slate-300 whitespace-nowrap">
                          {formatDateString(exp.date)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${catInfo.color}`}>
                            <Icon size={12} />
                            <span>{catInfo.label.split('(')[0]}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-100">
                          <div>{exp.title}</div>
                          {exp.note && (
                            <div className="text-[10px] font-normal text-slate-400 mt-0.5">
                              සටහන: {exp.note}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-slate-300 font-mono text-[11px]">
                            <User size={12} className="text-slate-400" />
                            <span>@{exp.addedBy}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-black text-rose-400 font-mono text-sm whitespace-nowrap">
                          - {formatCurrency(exp.amount)}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <button
                            onClick={() => {
                              if (window.confirm(`"${exp.title}" වියදම් සටහන ඉවත් කිරීමට ඔබට විශ්වාසද? (Delete Expense)`)) {
                                onDeleteExpense(exp.id);
                                onToast?.('වියදම් සටහන ඉවත් කරන ලදී!', 'success');
                              }
                            }}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                            title="Delete Expense"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Add Expense Modal - 100% Mobile Phone Optimized */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl flex flex-col my-auto max-h-[92dvh] overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-500/15 border border-rose-500/20 rounded-xl text-rose-400">
                  <Receipt size={20} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-base font-bold text-slate-100">අලුත් කඩේ වියදමක් එක් කරන්න</h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-400">Add New Shop Expense</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold p-1.5 bg-slate-800/60 rounded-xl cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Body Form */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-y-auto pr-1 space-y-3.5">
              {/* Category selector */}
              <div className="shrink-0">
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  වියදම් වර්ගය (Category):
                </label>
                <div className="grid grid-cols-1 gap-1.5 max-h-36 sm:max-h-44 overflow-y-auto pr-1">
                  {CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    const isSelected = category === cat.id;
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => setCategory(cat.id)}
                        className={`flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-left transition-all border cursor-pointer ${isSelected
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-md'
                          : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                      >
                        <Icon size={15} className={isSelected ? 'text-rose-400' : 'text-slate-500'} />
                        <span className="truncate">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title / Description */}
              <div className="shrink-0">
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  වියදමේ විස්තරය (Title e.g., පොතක් ගත්තා / කෑම / පෑන්):
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="උදා: පොතක් ගත්තා, කෑම එකක් ගෙනාවා, පෑන්..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-rose-500/50"
                />
              </div>

              {/* Amount */}
              <div className="shrink-0">
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  වියදම් වූ මුදල (Amount in LKR):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-rose-400">Rs.</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-sm font-bold text-rose-400 font-mono placeholder:text-slate-600 focus:outline-none focus:border-rose-500/50"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  * මෙම මුදල සජීවීව අද දින ලච්චුවේ සල්ලියෙන් අඩුවෙනු ඇත.
                </p>
              </div>

              {/* Optional Note */}
              <div className="shrink-0">
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  අමතර සටහන (Optional Note):
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="වෙනත් සටහනක් තිබේ නම්..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-rose-500/50"
                />
              </div>

              {/* Sticky bottom submit bar */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2 shrink-0 sticky bottom-0 bg-slate-900 py-1">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-all"
                >
                  අවලංගු කරන්න
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-lg shadow-rose-900/30 flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>වියදම සටහන් කරන්න</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
