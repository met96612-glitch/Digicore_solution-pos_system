import React, { useMemo, useState } from 'react';
import { Product, StockAdjustment, StockAdjustmentReason } from '../types';
import { STOCK_ADJUSTMENT_REASONS, formatCurrency, formatDateString } from '../utils';
import {
  AlertTriangle,
  ShieldCheck,
  Search,
  Filter,
  Trash2,
  Scale,
  PlusCircle,
  X,
  Calendar,
  Sparkles,
  TrendingDown,
  Layers,
  History,
  Tag,
  AlertCircle,
  Store,
  Clock,
  User,
  ArrowDownRight,
  DollarSign
} from 'lucide-react';

interface StockPageProps {
  products: Product[];
  currentUserUsername?: string;
  currentUserRole?: string;
  stockAdjustments?: StockAdjustment[];
  onAddStockAdjustment?: (adjustment: Omit<StockAdjustment, 'id' | 'date'>) => void;
  onDeleteStockAdjustment?: (adjustmentId: string) => void;
}

type StockFilter = 'all' | 'low' | 'out' | 'ok';

export default function StockPage({
  products,
  currentUserUsername,
  currentUserRole = 'cashier',
  stockAdjustments = [],
  onAddStockAdjustment,
  onDeleteStockAdjustment
}: StockPageProps) {
  const [activeTab, setActiveTab] = useState<'levels' | 'adjustments'>('levels');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StockFilter>('all');
  const [adjFilterReason, setAdjFilterReason] = useState<string>('all');
  const [adjFilterDesk, setAdjFilterDesk] = useState<'all' | 'lahiru' | 'jayantha'>('all');

  // Modal State for New Stock Adjustment
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedDesk, setSelectedDesk] = useState<'lahiru' | 'jayantha'>(() => {
    if (currentUserUsername === 'jayantha') return 'jayantha';
    return 'lahiru';
  });
  const [selectedReason, setSelectedReason] = useState<StockAdjustmentReason>('wastage');
  const [adjustmentQty, setAdjustmentQty] = useState<string>('');
  const [adjustmentUnit, setAdjustmentUnit] = useState<'kg' | 'g' | 'pcs'>('kg');
  const [reasonNote, setReasonNote] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId);
  }, [products, selectedProductId]);

  // Available stock for currently selected desk in modal
  const availableDeskStock = useMemo(() => {
    if (!selectedProduct) return 0;
    return selectedProduct.stock ?? 0;
  }, [selectedProduct]);

  // Current buying price per base unit
  const currentCostPerUnit = useMemo(() => {
    if (!selectedProduct) return 0;
    return selectedProduct.buying_price ?? selectedProduct.buyPrice ?? 0;
  }, [selectedProduct]);

  // Calculated Loss in LKR for current input
  const calculatedLoss = useMemo(() => {
    const numQty = parseFloat(adjustmentQty) || 0;
    if (numQty <= 0 || !selectedProduct) return 0;

    let qtyInBaseUnit = numQty;
    if (selectedProduct.unit === 'kg' && adjustmentUnit === 'g') {
      qtyInBaseUnit = numQty * 0.001;
    }
    return Number((qtyInBaseUnit * currentCostPerUnit).toFixed(2));
  }, [adjustmentQty, adjustmentUnit, selectedProduct, currentCostPerUnit]);

  // Stock rows for the live level view
  const stockRows = useMemo(() => {
    return products.map(p => {
      const stock = p.stock ?? 0;
      const minLevel = p.min_stock_level ?? 5.0;

      let status: 'ok' | 'low' | 'out' = 'ok';
      if (stock === 0) status = 'out';
      else if (stock <= minLevel) status = 'low';

      return {
        id: p.id,
        name: p.name,
        unit: p.unit,
        lahiruStock: stock,
        lahiruStatus: status,
        jayanthaStock: stock,
        jayanthaStatus: status,
        totalStock: stock,
        minLevel,
        status,
        buyPrice: p.buying_price ?? p.buyPrice ?? 0,
        wholesalePrice: p.wholesale_price ?? 0,
        retailPrice: p.retail_price ?? p.sellPrice ?? 0
      };
    });
  }, [products]);

  const filteredRows = useMemo(() => {
    return stockRows.filter(row => {
      const matchesSearch = row.name.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        filter === 'all' ||
        (filter === 'low' && row.status === 'low') ||
        (filter === 'out' && row.status === 'out') ||
        (filter === 'ok' && row.status === 'ok');

      return matchesSearch && matchesFilter;
    });
  }, [stockRows, search, filter]);

  const stats = useMemo(() => {
    let outCount = 0;
    let lowCount = 0;
    let okCount = 0;

    stockRows.forEach(row => {
      if (row.status === 'out') outCount++;
      else if (row.status === 'low') lowCount++;
      else okCount++;
    });

    return { outCount, lowCount, okCount };
  }, [stockRows]);

  // Filtered adjustments
  const filteredAdjustments = useMemo(() => {
    return stockAdjustments.filter(adj => {
      const matchesSearch =
        adj.productName.toLowerCase().includes(search.toLowerCase()) ||
        (adj.reasonNote && adj.reasonNote.toLowerCase().includes(search.toLowerCase())) ||
        adj.adjustedBy.toLowerCase().includes(search.toLowerCase());

      const matchesReason = adjFilterReason === 'all' || adj.reason === adjFilterReason;
      const matchesDesk = adjFilterDesk === 'all' || adj.desk === adjFilterDesk;

      return matchesSearch && matchesReason && matchesDesk;
    });
  }, [stockAdjustments, search, adjFilterReason, adjFilterDesk]);

  // Adjustment stats
  const adjustmentStats = useMemo(() => {
    const totalLoss = stockAdjustments.reduce((sum, a) => sum + a.totalLoss, 0);
    const totalKg = stockAdjustments.reduce((sum, a) => {
      const qtyInKg = a.unit === 'g' ? a.qty * 0.001 : a.qty;
      return sum + qtyInKg;
    }, 0);
    const totalCount = stockAdjustments.length;

    // Reason breakdown
    const wastageLoss = stockAdjustments.filter(a => a.reason === 'wastage').reduce((s, a) => s + a.totalLoss, 0);
    const dryingLoss = stockAdjustments.filter(a => a.reason === 'drying_loss').reduce((s, a) => s + a.totalLoss, 0);
    const damageLoss = stockAdjustments.filter(a => a.reason === 'damage').reduce((s, a) => s + a.totalLoss, 0);
    const auditLoss = stockAdjustments.filter(a => a.reason === 'audit_loss').reduce((s, a) => s + a.totalLoss, 0);

    return { totalLoss, totalKg, totalCount, wastageLoss, dryingLoss, damageLoss, auditLoss };
  }, [stockAdjustments]);

  // Open modal with preselected desk
  const handleOpenModal = () => {
    if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
      setAdjustmentUnit(products[0].unit);
    }
    if (currentUserUsername === 'jayantha') {
      setSelectedDesk('jayantha');
    } else {
      setSelectedDesk('lahiru');
    }
    setAdjustmentQty('');
    setReasonNote('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleProductSelect = (pId: string) => {
    setSelectedProductId(pId);
    const prod = products.find(p => p.id === pId);
    if (prod) {
      setAdjustmentUnit(prod.unit);
    }
  };

  const handleSubmitAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedProduct) {
      setFormError('කරුණාකර කුළුබඩු වර්ගය තෝරන්න (Please select a product).');
      return;
    }

    const numQty = parseFloat(adjustmentQty);
    if (isNaN(numQty) || numQty <= 0) {
      setFormError('කරුණාකර නිවැරදි ප්‍රමාණය ඇතුළත් කරන්න (Please enter a valid positive quantity).');
      return;
    }

    let qtyInBaseUnit = numQty;
    if (selectedProduct.unit === 'kg' && adjustmentUnit === 'g') {
      qtyInBaseUnit = numQty * 0.001;
    }

    if (qtyInBaseUnit > availableDeskStock) {
      setFormError(`තෝරාගත් තොගයේ ඇත්තේ ${availableDeskStock} ${selectedProduct.unit} පමණි. ඊට වඩා අඩු කළ නොහැක.`);
      return;
    }

    if (onAddStockAdjustment) {
      onAddStockAdjustment({
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        qty: numQty,
        unit: adjustmentUnit,
        reason: selectedReason,
        reasonNote: reasonNote.trim() || undefined,
        costPerUnit: currentCostPerUnit,
        totalLoss: calculatedLoss,
        adjustedBy: currentUserUsername || 'admin',
        desk: selectedDesk
      });
    }

    setIsModalOpen(false);
  };

  return (
    <div id="stockPage" className="space-y-4 sm:space-y-6">
      {/* Top Header & Tab Navigation - 100% Mobile Responsive */}
      <div className="flex flex-col gap-3 bg-slate-900/70 border border-slate-800 p-3 sm:p-4 rounded-2xl shadow-xl">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Tabs switch */}
          <div className="grid grid-cols-2 sm:flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('levels')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${activeTab === 'levels'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <Layers size={14} className="shrink-0" />
              <span className="truncate">තොග ශේෂය</span>
            </button>

            <button
              onClick={() => setActiveTab('adjustments')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${activeTab === 'adjustments'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <TrendingDown size={14} className="shrink-0" />
              <span className="truncate">කුණු / අඩුවීම්</span>
              {stockAdjustments.length > 0 && (
                <span className="bg-amber-950 text-amber-300 text-[10px] px-1.5 py-0.2 rounded-full font-mono shrink-0">
                  {stockAdjustments.length}
                </span>
              )}
            </button>
          </div>

          {/* Record New Adjustment Trigger Button */}
          <button
            onClick={handleOpenModal}
            className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-900/30 cursor-pointer active:scale-95 shrink-0"
          >
            <PlusCircle size={16} />
            <span>+ තොග අඩුවීමක් ලොග් කරන්න</span>
          </button>
        </div>
      </div>

      {activeTab === 'levels' ? (
        <>
          {/* Alert Summary Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
            <div className="bg-red-950/20 border border-red-900/35 rounded-2xl p-3.5 sm:p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center text-red-400 font-bold shrink-0 text-xs">
                {stats.outCount}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-medium block truncate">Out of Stock (අවසන් වූ)</span>
                <span className="text-xs font-bold text-red-400 block truncate">Restock required</span>
              </div>
            </div>

            <div className="bg-amber-950/20 border border-amber-900/35 rounded-2xl p-3.5 sm:p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-500 font-bold shrink-0 text-xs">
                {stats.lowCount}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-medium block truncate">Low Stock Warning (අඩු තොග)</span>
                <span className="text-xs font-bold text-amber-500 block truncate">Below minimum buffer</span>
              </div>
            </div>

            <div className="bg-emerald-950/20 border border-emerald-900/35 rounded-2xl p-3.5 sm:p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 font-bold shrink-0 text-xs">
                {stats.okCount}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-medium block truncate">Healthy Reserves (ප්‍රමාණවත්)</span>
                <span className="text-xs font-bold text-emerald-400 block truncate">Sufficient reserves</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
            {/* Filtering inputs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 flex items-center gap-2 focus-within:border-violet-600 transition-all w-full sm:max-w-xs">
                <Search size={16} className="text-slate-500 shrink-0" />
                <input
                  type="text"
                  placeholder="කුළුබඩු නම සොයන්න (Search)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent text-slate-200 py-2.5 text-xs font-medium outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <Filter size={14} className="text-slate-400 shrink-0 hidden sm:block" />
                <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1 w-full sm:w-auto">
                  {(['all', 'ok', 'low', 'out'] as StockFilter[]).map(btn => (
                    <button
                      key={btn}
                      onClick={() => setFilter(btn)}
                      className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all uppercase select-none cursor-pointer ${filter === btn
                        ? 'bg-violet-600/20 text-violet-400 border border-violet-800/40'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                    >
                      {btn}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile Cards List (Visible on Phone Screens < md) */}
            <div className="block md:hidden space-y-3">
              {filteredRows.length === 0 ? (
                <div className="text-center p-8 bg-slate-950/40 border border-slate-800/60 rounded-xl text-slate-500 text-xs">
                  කිසිදු තොග අයිතමයක් හමු නොවීය.
                </div>
              ) : (
                filteredRows.map(row => (
                  <div
                    key={row.id}
                    className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5 shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-100 text-sm">{row.name}</h4>
                        <span className="text-[10px] text-slate-400 uppercase font-mono">ඒකකය: {row.unit}</span>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase select-none shrink-0 ${row.status === 'ok'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                        : row.status === 'low'
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/15'
                          : 'bg-red-500/10 text-red-500 border border-red-500/15'
                        }`}>
                        {row.status === 'ok' && <ShieldCheck size={10} />}
                        {row.status !== 'ok' && <AlertTriangle size={10} />}
                        {row.status === 'ok' ? 'In Supply' : row.status === 'low' ? 'Restock Warn' : 'Crit Out'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 pt-1 border-t border-slate-800/80">
                      {((currentUserRole === 'superuser' || currentUserUsername === 'superuser') || currentUserUsername === 'lahiru') && (
                        <div className="bg-violet-950/20 border border-violet-900/30 rounded-lg p-2">
                          <span className="text-[10px] text-violet-300 block font-medium">ළහිරු තොගය (Lahiru):</span>
                          <span className={`font-mono font-bold text-xs ${row.lahiruStatus === 'out' ? 'text-red-400' : row.lahiruStatus === 'low' ? 'text-amber-400' : 'text-slate-200'
                            }`}>
                            {row.lahiruStock} {row.unit}
                          </span>
                        </div>
                      )}

                      {((currentUserRole === 'superuser' || currentUserUsername === 'superuser') || currentUserUsername === 'jayantha') && (
                        <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-2">
                          <span className="text-[10px] text-emerald-300 block font-medium">ජයන්තා තොගය (Jayantha):</span>
                          <span className={`font-mono font-bold text-xs ${row.jayanthaStatus === 'out' ? 'text-red-400' : row.jayanthaStatus === 'low' ? 'text-amber-400' : 'text-slate-200'
                            }`}>
                            {row.jayanthaStock} {row.unit}
                          </span>
                        </div>
                      )}

                      {currentUserUsername !== 'lahiru' && currentUserUsername !== 'jayantha' && (
                        <div className="flex justify-between items-center bg-slate-900/60 px-2.5 py-1.5 rounded-lg text-xs">
                          <span className="text-slate-400 font-medium">
                            {(currentUserRole === 'superuser' || currentUserUsername === 'superuser') ? 'මුළු ඒකාබද්ධ තොගය:' : 'පවතින තොගය (Current Stock):'}
                          </span>
                          <span className="font-mono font-extrabold text-slate-100">
                            {row.totalStock} {row.unit}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Stock Table (Visible on md+) */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full border-collapse text-left text-xs text-slate-300">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-[10px] text-slate-400 font-bold uppercase tracking-wider select-none">
                    <th className="p-4">Spice Product Label</th>
                    <th className="p-4 text-center">Unit</th>
                    {((currentUserRole === 'superuser' || currentUserUsername === 'superuser') || currentUserUsername === 'lahiru') && (
                      <th className="p-4 text-center bg-violet-950/15 border-x border-slate-800">Lahiru's Stock</th>
                    )}
                    {((currentUserRole === 'superuser' || currentUserUsername === 'superuser') || currentUserUsername === 'jayantha') && (
                      <th className="p-4 text-center bg-emerald-950/15 border-r border-slate-800">Jayantha's Stock</th>
                    )}
                    {currentUserUsername !== 'lahiru' && currentUserUsername !== 'jayantha' && (
                      <th className="p-4 text-right">
                        {(currentUserRole === 'superuser' || currentUserUsername === 'superuser') ? 'Combined Stock' : 'Available Stock'}
                      </th>
                    )}
                    <th className="p-4 text-center">Overall Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/10 font-mono text-xs">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={currentUserUsername === 'lahiru' || currentUserUsername === 'jayantha' ? 4 : 5} className="text-center p-8 text-slate-500 font-sans">
                        No items found matching the current stock filter settings.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map(row => (
                      <tr key={row.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="p-4 font-semibold text-slate-200 font-sans">{row.name}</td>
                        <td className="p-4 text-center font-bold text-slate-400 uppercase select-none">{row.unit}</td>

                        {/* Lahiru stock */}
                        {((currentUserRole === 'superuser' || currentUserUsername === 'superuser') || currentUserUsername === 'lahiru') && (
                          <td className={`p-4 text-center border-x border-slate-800 bg-violet-950/5 ${row.lahiruStatus === 'out' ? 'text-red-400 font-extrabold' : row.lahiruStatus === 'low' ? 'text-amber-500 font-bold' : 'text-slate-200'
                            }`}>
                            {row.lahiruStock} {row.unit}
                            {row.lahiruStatus === 'low' && <span className="text-[9px] block text-amber-500/80 font-sans font-medium">(Low &lt; {row.minLevel})</span>}
                            {row.lahiruStatus === 'out' && <span className="text-[9px] block text-red-500/80 font-sans font-medium">(Out of stock)</span>}
                          </td>
                        )}

                        {/* Jayantha stock */}
                        {((currentUserRole === 'superuser' || currentUserUsername === 'superuser') || currentUserUsername === 'jayantha') && (
                          <td className={`p-4 text-center border-r border-slate-800 bg-emerald-950/5 ${row.jayanthaStatus === 'out' ? 'text-red-400 font-extrabold' : row.jayanthaStatus === 'low' ? 'text-amber-500 font-bold' : 'text-slate-200'
                            }`}>
                            {row.jayanthaStock} {row.unit}
                            {row.jayanthaStatus === 'low' && <span className="text-[9px] block text-amber-500/80 font-sans font-medium">(Low &lt; {row.minLevel})</span>}
                            {row.jayanthaStatus === 'out' && <span className="text-[9px] block text-red-500/80 font-sans font-medium">(Out of stock)</span>}
                          </td>
                        )}

                        {/* Combined stock */}
                        {currentUserUsername !== 'lahiru' && currentUserUsername !== 'jayantha' && (
                          <td className="p-4 text-right font-extrabold text-slate-200">
                            {row.totalStock} {row.unit}
                          </td>
                        )}

                        {/* Overall Health */}
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase select-none ${row.status === 'ok'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                            : row.status === 'low'
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/15'
                              : 'bg-red-500/10 text-red-500 border border-red-500/15'
                            }`}>
                            {row.status === 'ok' && <ShieldCheck size={11} />}
                            {row.status !== 'ok' && <AlertTriangle size={11} />}
                            {row.status === 'ok' ? 'In Supply' : row.status === 'low' ? 'Restock Warn' : 'Crit Out'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Adjustments & Wastage History View */
        <div className="space-y-4 sm:space-y-6">
          {/* Summary Cards - Mobile Responsive Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="bg-amber-950/20 border border-amber-900/40 rounded-2xl p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shrink-0">
                <TrendingDown size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate">Total Loss (මුළු පාඩුව)</span>
                <span className="text-xs sm:text-base font-mono font-black text-amber-400 block truncate">
                  {formatCurrency(adjustmentStats.totalLoss)}
                </span>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 font-bold shrink-0">
                <Scale size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate">Total Deducted (අපතේ ගිය බර)</span>
                <span className="text-xs sm:text-base font-mono font-black text-violet-300 block truncate">
                  {adjustmentStats.totalKg.toFixed(3)} kg
                </span>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                <History size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate">Entries (සටහන්)</span>
                <span className="text-xs sm:text-base font-mono font-black text-emerald-400 block truncate">
                  {adjustmentStats.totalCount}
                </span>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold shrink-0">
                <AlertCircle size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate">Top Cause</span>
                <span className="text-[11px] sm:text-xs font-bold text-slate-200 block truncate">
                  {formatCurrency(adjustmentStats.wastageLoss)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
            {/* Filter and Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 flex items-center gap-2 focus-within:border-violet-600 transition-all w-full sm:max-w-xs">
                <Search size={16} className="text-slate-500 shrink-0" />
                <input
                  type="text"
                  placeholder="නම හෝ සටහන් සොයන්න..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent text-slate-200 py-2.5 text-xs font-medium outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Desk filter */}
                <select
                  value={adjFilterDesk}
                  onChange={(e) => setAdjFilterDesk(e.target.value as any)}
                  className="flex-1 sm:flex-none bg-slate-950 border border-slate-800 text-slate-200 text-xs px-2.5 py-2 rounded-xl outline-none cursor-pointer"
                >
                  <option value="all">සියලුම Desks (All)</option>
                  <option value="lahiru">ළහිරු තොගය (Lahiru)</option>
                  <option value="jayantha">ජයන්තා තොගය (Jayantha)</option>
                </select>

                {/* Reason filter */}
                <select
                  value={adjFilterReason}
                  onChange={(e) => setAdjFilterReason(e.target.value)}
                  className="flex-1 sm:flex-none bg-slate-950 border border-slate-800 text-slate-200 text-xs px-2.5 py-2 rounded-xl outline-none cursor-pointer"
                >
                  <option value="all">සියලුම හේතු (All)</option>
                  <option value="wastage">කුණු / අපද්‍රව්‍ය (Wastage)</option>
                  <option value="drying_loss">වියළීම / බර අඩුවීම (Drying)</option>
                  <option value="damage">නරක්වීම් / හානි (Damage)</option>
                  <option value="audit_loss">ගණන් බැලීමේ අඩුවීම් (Audit)</option>
                  <option value="other">වෙනත් (Other)</option>
                </select>
              </div>
            </div>

            {/* Mobile Adjustments Cards (Visible on Phone Screens < md) */}
            <div className="block md:hidden space-y-3">
              {filteredAdjustments.length === 0 ? (
                <div className="text-center p-8 bg-slate-950/40 border border-slate-800/60 rounded-xl text-slate-500 text-xs">
                  තොග අඩුවීම් හෝ අපද්‍රව්‍ය ලොග් කිසිවක් හමු නොවුණි.
                </div>
              ) : (
                filteredAdjustments.map(adj => {
                  const reasonMeta = STOCK_ADJUSTMENT_REASONS.find(r => r.value === adj.reason) || {
                    value: 'other' as StockAdjustmentReason,
                    label: 'Other',
                    sinhala: 'වෙනත්',
                    icon: '📝',
                    badgeClass: 'bg-slate-500/10 text-slate-300 border border-slate-500/20'
                  };

                  return (
                    <div
                      key={adj.id}
                      className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5 shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${adj.desk === 'jayantha'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                              : 'bg-violet-950 text-violet-400 border border-violet-800/40'
                              }`}>
                              {adj.desk === 'jayantha' ? 'ජයන්තා' : 'ළහිරු'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${reasonMeta.badgeClass}`}>
                              {reasonMeta.label}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-100 text-sm mt-1">{adj.productName}</h4>
                          {adj.reasonNote && (
                            <p className="text-[11px] text-slate-400 italic mt-0.5">
                              Note: {adj.reasonNote}
                            </p>
                          )}
                        </div>

                        {onDeleteStockAdjustment && (
                          <button
                            onClick={() => {
                              if (window.confirm(`මෙම තොග අඩුවීම (${adj.productName} - ${adj.qty} ${adj.unit}) ඉවත් කර Stock එක යථා තත්ත්වයට පත් කිරීමට අවශ්‍යද?`)) {
                                onDeleteStockAdjustment(adj.id);
                              }
                            }}
                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Rollback adjustment"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80 text-xs">
                        <div className="bg-slate-900/60 p-2 rounded-lg">
                          <span className="text-[10px] text-slate-400 block">අඩු වූ ප්‍රමාණය:</span>
                          <span className="font-mono font-extrabold text-amber-400 text-sm">
                            -{adj.qty} {adj.unit}
                          </span>
                        </div>
                        <div className="bg-slate-900/60 p-2 rounded-lg">
                          <span className="text-[10px] text-slate-400 block">සිදුවූ පාඩුව:</span>
                          <span className="font-mono font-black text-rose-400 text-sm">
                            Rs. {adj.totalLoss.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          <span>{new Date(adj.date).toLocaleDateString()} {new Date(adj.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                        <span className="text-slate-400 font-mono">@{adj.adjustedBy}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Adjustments Table (Visible on md+) */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full border-collapse text-left text-xs text-slate-300">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-[10px] text-slate-400 font-bold uppercase tracking-wider select-none">
                    <th className="p-3.5">Date & Time</th>
                    <th className="p-3.5">Spice Product</th>
                    <th className="p-3.5 text-center">Desk</th>
                    <th className="p-3.5">Reason (හේතුව)</th>
                    <th className="p-3.5 text-right">Deducted Qty</th>
                    <th className="p-3.5 text-right">Unit Buy Price</th>
                    <th className="p-3.5 text-right">Total Loss (රු. පාඩුව)</th>
                    <th className="p-3.5 text-center">By User</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/10 font-mono text-xs">
                  {filteredAdjustments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center p-8 text-slate-500 font-sans">
                        තොග අඩුවීම් හෝ අපද්‍රව්‍ය ලොග් කිසිවක් හමු නොවුණි (No adjustments found).
                      </td>
                    </tr>
                  ) : (
                    filteredAdjustments.map(adj => {
                      const reasonMeta = STOCK_ADJUSTMENT_REASONS.find(r => r.value === adj.reason) || {
                        value: 'other' as StockAdjustmentReason,
                        label: 'Other',
                        sinhala: 'වෙනත්',
                        icon: '📝',
                        badgeClass: 'bg-slate-500/10 text-slate-300 border border-slate-500/20'
                      };

                      return (
                        <tr key={adj.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="p-3.5 text-slate-400 whitespace-nowrap">
                            <span className="font-semibold text-slate-200 block">
                              {new Date(adj.date).toLocaleDateString()}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {new Date(adj.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </td>
                          <td className="p-3.5 font-semibold text-slate-200 font-sans">
                            {adj.productName}
                            {adj.reasonNote && (
                              <span className="text-[10px] block text-slate-400 font-normal italic">
                                Note: {adj.reasonNote}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${adj.desk === 'jayantha'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                              : 'bg-violet-950 text-violet-400 border border-violet-800/40'
                              }`}>
                              {adj.desk === 'jayantha' ? 'ජයන්තා' : 'ළහිරු'}
                            </span>
                          </td>
                          <td className="p-3.5 font-sans whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${reasonMeta.badgeClass}`}>
                              {reasonMeta.label}
                            </span>
                          </td>
                          <td className="p-3.5 text-right font-extrabold text-amber-400 whitespace-nowrap">
                            -{adj.qty} {adj.unit}
                          </td>
                          <td className="p-3.5 text-right text-slate-400 whitespace-nowrap">
                            Rs. {adj.costPerUnit.toFixed(2)}
                          </td>
                          <td className="p-3.5 text-right font-black text-rose-400 whitespace-nowrap">
                            Rs. {adj.totalLoss.toFixed(2)}
                          </td>
                          <td className="p-3.5 text-center text-slate-400 font-sans text-[11px] whitespace-nowrap">
                            @{adj.adjustedBy}
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            {onDeleteStockAdjustment && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`මෙම තොග අඩුවීම (${adj.productName} - ${adj.qty} ${adj.unit}) ඉවත් කර Stock එක යථා තත්ත්වයට පත් කිරීමට අවශ්‍යද?`)) {
                                    onDeleteStockAdjustment(adj.id);
                                  }
                                }}
                                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                                title="Rollback and Delete this adjustment"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Stock Adjustment Dialog - 100% Mobile Phone Optimized */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <TrendingDown size={18} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-100 leading-tight">
                    තොග අඩුවීමක් / කුණු ඉවත් වීමක් ලොග් කරන්න
                  </h3>
                  <span className="text-[10px] text-slate-400 block">
                    Record Spoilage, Wastage or Weight Loss
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all cursor-pointer shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-red-300 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-red-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitAdjustment} className="space-y-4">
              {/* Product Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  කුළුබඩු වර්ගය (Select Spice / Product) *
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 text-xs outline-none focus:border-amber-500 font-medium cursor-pointer"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (දැනට: {p.lahiru_stock ?? p.stock} kg L / {p.jayantha_stock ?? p.stock} kg J)
                    </option>
                  ))}
                </select>
              </div>

              {/* Desk Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  අඩු වන තොගය (Inventory Desk) *
                </label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedDesk('lahiru')}
                    className={`p-2.5 sm:p-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${selectedDesk === 'lahiru'
                      ? 'bg-violet-950/40 border-violet-500 text-violet-300 ring-1 ring-violet-500'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    <span>ළහිරු තොගය (Lahiru)</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {selectedProduct ? (selectedProduct.lahiru_stock ?? selectedProduct.stock) : 0} {selectedProduct?.unit || 'kg'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedDesk('jayantha')}
                    className={`p-2.5 sm:p-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${selectedDesk === 'jayantha'
                      ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    <span>ජයන්තා තොගය (Jayantha)</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {selectedProduct ? (selectedProduct.jayantha_stock ?? selectedProduct.stock) : 0} {selectedProduct?.unit || 'kg'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Reason Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  අඩුවීමට හේතුව (Reason for Reduction) *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {STOCK_ADJUSTMENT_REASONS.map(meta => (
                    <button
                      key={meta.value}
                      type="button"
                      onClick={() => setSelectedReason(meta.value)}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${selectedReason === meta.value
                        ? 'bg-amber-950/40 border-amber-500 text-amber-300 font-bold ring-1 ring-amber-500'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base shrink-0">{meta.icon}</span>
                        <div className="min-w-0">
                          <span className="block truncate">{meta.sinhala}</span>
                          <span className="text-[9px] text-slate-500 block truncate">{meta.label}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity Input & Unit */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  අඩු කළ යුතු ප්‍රමාණය (Deduction Quantity) *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    placeholder="උදා: 1.500"
                    value={adjustmentQty}
                    onChange={(e) => setAdjustmentQty(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 text-sm font-mono font-bold outline-none focus:border-amber-500"
                    required
                  />

                  {selectedProduct?.unit === 'kg' ? (
                    <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setAdjustmentUnit('kg')}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${adjustmentUnit === 'kg'
                          ? 'bg-amber-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                          }`}
                      >
                        kg
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjustmentUnit('g')}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${adjustmentUnit === 'g'
                          ? 'bg-amber-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                          }`}
                      >
                        g
                      </button>
                    </div>
                  ) : (
                    <span className="px-4 py-3 bg-slate-950 border border-slate-800 text-slate-300 font-bold rounded-xl text-xs uppercase select-none shrink-0">
                      {selectedProduct?.unit || 'pcs'}
                    </span>
                  )}
                </div>
              </div>

              {/* Financial Calculation Live Preview */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 sm:p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>ගැනුම් මිල (Buy Cost):</span>
                  <span className="font-mono font-semibold text-slate-300">
                    Rs. {currentCostPerUnit.toFixed(2)} / {selectedProduct?.unit}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>තිබෙන තොගය ({selectedDesk === 'jayantha' ? 'ජයන්තා' : 'ළහිරු'}):</span>
                  <span className="font-mono font-semibold text-emerald-400">
                    {availableDeskStock} {selectedProduct?.unit}
                  </span>
                </div>
                <div className="pt-1.5 border-t border-slate-800/80 flex justify-between items-center">
                  <span className="font-bold text-rose-300">
                    සිදුවන පාඩුව (Estimated Loss):
                  </span>
                  <span className="text-sm font-black text-rose-400 font-mono">
                    Rs. {calculatedLoss.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Optional Reason Note */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  විස්තරය / සටහන (Optional Note)
                </label>
                <input
                  type="text"
                  placeholder="උදා: කුණු හා දූවිලි ඉවත් කර බර කිරා බැලුවා"
                  value={reasonNote}
                  onChange={(e) => setReasonNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 text-xs outline-none focus:border-amber-500 font-medium"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all cursor-pointer text-center"
                >
                  අවලංගු කරන්න (Cancel)
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-amber-900/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <TrendingDown size={14} />
                  <span>තොගය අඩු කර සටහන් කරන්න</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
