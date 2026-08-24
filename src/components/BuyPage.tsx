import { useState, useMemo, useEffect, useRef } from 'react';
import { Product, TransactionItem, Transaction } from '../types';
import { generateNextInvoiceNumber, formatCurrency } from '../utils';
import { Search, Scale, Trash2, Import, Plus, Save, Sparkles, Landmark, Banknote, Wallet } from 'lucide-react';

interface BuyPageProps {
  products: Product[];
  currentUserUsername: string;
  currentUserRole?: string;
  transactions: Transaction[];
  onSavePurchase: (transaction: Transaction) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
  currentDrawerBalance?: number;
}

export default function BuyPage({
  products,
  currentUserUsername,
  currentUserRole = 'cashier',
  transactions,
  onSavePurchase,
  onToast,
  currentDrawerBalance
}: BuyPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [qty, setQty] = useState<number | ''>('');
  const [deductionQty, setDeductionQty] = useState<number | ''>('');
  const [unit, setUnit] = useState<'kg' | 'g' | 'pcs'>('kg');
  const [price, setPrice] = useState<number | ''>('');
  const [newWholesalePrice, setNewWholesalePrice] = useState<number | ''>('');
  const [newRetailPrice, setNewRetailPrice] = useState<number | ''>('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Active Desk Prefix: Defaults to J-BUY for Jayantha, L-BUY for everyone else
  const defaultPrefix = currentUserUsername === 'jayantha' ? 'J-BUY' : 'L-BUY';
  const [activePrefix, setActivePrefix] = useState<'L-BUY' | 'J-BUY'>(defaultPrefix);

  const [currentBillId, setCurrentBillId] = useState('');
  const [billItems, setBillItems] = useState<TransactionItem[]>([]);
  const [supplierName, setSupplierName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Credit'>('Cash');
  const [initialPaidAmount, setInitialPaidAmount] = useState<number | ''>('');

  const qtyInputRef = useRef<HTMLInputElement>(null);

  const lastProductIdRef = useRef<string>('');

  // Auto-generate invoice ID when active desk, transactions or component boots up
  useEffect(() => {
    const nextId = generateNextInvoiceNumber(activePrefix, transactions);
    setCurrentBillId(nextId);
  }, [activePrefix, transactions]);

  const matchedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId || p.name.toLowerCase() === searchQuery.toLowerCase());
  }, [selectedProductId, searchQuery, products]);

  useEffect(() => {
    if (matchedProduct) {
      if (lastProductIdRef.current !== matchedProduct.id) {
        setPrice(matchedProduct.buying_price ?? matchedProduct.buyPrice);
        setNewWholesalePrice(matchedProduct.wholesale_price);
        setNewRetailPrice(matchedProduct.retail_price ?? matchedProduct.sellPrice);
        setUnit(matchedProduct.unit);
        setSelectedProductId(matchedProduct.id);
        lastProductIdRef.current = matchedProduct.id;
      }
    } else {
      if (lastProductIdRef.current !== '') {
        setSelectedProductId('');
        setNewWholesalePrice('');
        setNewRetailPrice('');
        lastProductIdRef.current = '';
      }
    }
  }, [matchedProduct]);

  const filteredSearchList = useMemo(() => {
    if (!searchQuery || !showSuggestions) return [];
    return products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery, products, showSuggestions]);

  const netQty = useMemo(() => {
    if (qty === '') return 0;
    const gross = Number(qty);
    const deduct = deductionQty !== '' && !isNaN(Number(deductionQty)) ? Math.max(0, Number(deductionQty)) : 0;
    return Math.max(0, gross - deduct);
  }, [qty, deductionQty]);

  const calculatedLineTotal = useMemo(() => {
    if (!qty || !price) return 0;
    let multiplier = 1;
    if (matchedProduct && matchedProduct.unit === 'kg' && unit === 'g') {
      multiplier = 0.001;
    }
    return Number((netQty * price * multiplier).toFixed(2));
  }, [qty, price, unit, matchedProduct, netQty]);

  const subtotal = useMemo(() => {
    return billItems.reduce((acc, item) => acc + item.total, 0);
  }, [billItems]);

  const handleAddLineItem = () => {
    if (!selectedProductId || !matchedProduct) {
      onToast('Select a valid spice/product to restock.', 'error');
      return;
    }
    if (!qty || Number(qty) <= 0) {
      onToast('Enter a valid stock amount.', 'error');
      return;
    }
    if (!price || Number(price) <= 0) {
      onToast('Enter a valid custom purchase price.', 'error');
      return;
    }

    const grossVal = Number(qty);
    const deductVal = deductionQty !== '' && !isNaN(Number(deductionQty)) ? Math.max(0, Number(deductionQty)) : 0;
    const netVal = Math.max(0, grossVal - deductVal);

    const newItem: TransactionItem = {
      productId: matchedProduct.id,
      productName: matchedProduct.name,
      qty: netVal,
      grossQty: deductVal > 0 ? grossVal : undefined,
      deductionQty: deductVal > 0 ? deductVal : undefined,
      unit: unit,
      price: Number(price),
      total: calculatedLineTotal,
      new_wholesale_price: newWholesalePrice !== '' ? Number(newWholesalePrice) : undefined,
      new_retail_price: newRetailPrice !== '' ? Number(newRetailPrice) : undefined
    };

    setBillItems(prev => {
      const existingIdx = prev.findIndex(item => item.productId === newItem.productId && item.unit === newItem.unit);
      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx].qty = Number((updated[existingIdx].qty + newItem.qty).toFixed(3));
        if (newItem.grossQty) {
          updated[existingIdx].grossQty = Number(((updated[existingIdx].grossQty || updated[existingIdx].qty) + newItem.grossQty).toFixed(3));
        }
        if (newItem.deductionQty) {
          updated[existingIdx].deductionQty = Number(((updated[existingIdx].deductionQty || 0) + newItem.deductionQty).toFixed(3));
        }
        updated[existingIdx].total = Number((updated[existingIdx].total + newItem.total).toFixed(2));
        // Update price options on merge as well
        updated[existingIdx].price = newItem.price;
        updated[existingIdx].new_wholesale_price = newItem.new_wholesale_price;
        updated[existingIdx].new_retail_price = newItem.new_retail_price;
        return updated;
      }
      return [...prev, newItem];
    });

    setSearchQuery('');
    setSelectedProductId('');
    setQty('');
    setDeductionQty('');
    setPrice('');
    setNewWholesalePrice('');
    setNewRetailPrice('');
    lastProductIdRef.current = '';
    onToast('Item added to buy order.', 'success');
  };

  const handleRemoveLineItem = (index: number) => {
    setBillItems(prev => prev.filter((_, idx) => idx !== index));
    onToast('Item removed from buy order.', 'success');
  };

  const cleanCurrentBill = () => {
    setBillItems([]);
    setSupplierName('');
    setPaymentMethod('Cash');
    setInitialPaidAmount('');
    setCurrentBillId(generateNextInvoiceNumber(activePrefix, transactions));
  };

  const handleCheckout = () => {
    if (billItems.length === 0) {
      onToast('No purchase items added.', 'error');
      return;
    }

    const downPayment = paymentMethod === 'Credit'
      ? (initialPaidAmount !== '' && !isNaN(Number(initialPaidAmount)) ? Math.max(0, Number(initialPaidAmount)) : 0)
      : subtotal;

    const creditStatus = paymentMethod === 'Credit'
      ? (downPayment >= subtotal ? 'paid' : (downPayment > 0 ? 'partially_paid' : 'pending'))
      : 'paid';

    const initialPaymentLogs = (paymentMethod === 'Credit' && downPayment > 0)
      ? [{
        id: `PAY-${Date.now()}`,
        date: new Date().toISOString(),
        amount: downPayment,
        payment_method: 'Cash' as const,
        note: 'Supplier Down Payment',
        addedBy: currentUserUsername
      }]
      : [];

    const transaction: Transaction = {
      id: currentBillId,
      date: new Date().toISOString(),
      type: 'buy',
      items: billItems,
      subtotal: subtotal,
      discount: 0,
      total: subtotal,
      contactName: supplierName.trim() || 'Local Grower',
      createdBy: currentUserUsername,
      // Blueprint fields
      invoice_no: currentBillId,
      user_id: activePrefix === 'L-BUY' ? 'u3' : 'u4', // u3=lahiru, u4=jayantha
      payment_method: paymentMethod,
      amount_paid: downPayment,
      credit_status: creditStatus,
      credit_paid_amount: downPayment,
      credit_payments: initialPaymentLogs,
      total_profit: 0
    };

    onSavePurchase(transaction);
    if (paymentMethod === 'Credit') {
      onToast(`Supplier Credit Purchase ${currentBillId} (තොග ණය) recorded.`, 'success');
    } else {
      onToast(`Stock Restocked successfully with order ID ${currentBillId}.`, 'success');
    }
    cleanCurrentBill();
  };

  return (
    <div id="buyPage" className="flex flex-col gap-6">
      {/* Active Desk Selector */}
      {(currentUserRole === 'superuser' || currentUserRole === 'admin') ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Landmark className="text-amber-500" size={18} />
            <div>
              <h4 className="text-sm font-bold text-slate-100">Stock replenishment warehouse</h4>
              <p className="text-[10px] text-slate-500">As supervisor, select which warehouse stock to increment</p>
            </div>
          </div>
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80 w-full sm:w-auto">
            <button
              onClick={() => setActivePrefix('L-BUY')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${activePrefix === 'L-BUY'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <span>Lahiru Stock (L-BUY)</span>
            </button>
            <button
              onClick={() => setActivePrefix('J-BUY')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${activePrefix === 'J-BUY'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <span>Jayantha Stock (J-BUY)</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Landmark className="text-amber-500" size={18} />
            <div>
              <h4 className="text-sm font-bold text-slate-100">
                Warehouse Entity: {activePrefix === 'J-BUY' ? 'Jayantha Spices' : 'Lahiru Spices'}
              </h4>
              <p className="text-[10px] text-slate-500">Stock updates will increase your assigned warehouse columns</p>
            </div>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${activePrefix === 'J-BUY'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
            Series {activePrefix}-xxxx
          </span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Product Selection Inputs */}
        <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-5 h-fit">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Import className="text-amber-500" size={20} />
            <h3 className="text-base font-bold text-slate-100">Restock Purchases (Buy)</h3>
          </div>

          <div className="space-y-4">
            {/* Autocomplete Search input */}
            <div className="space-y-1.5 relative">
              <label className="text-xs text-slate-400 font-medium font-sans">Search Spice for Restocking</label>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 flex items-center gap-2 focus-within:border-amber-500 transition-all">
                <Search size={18} className="text-slate-500 shrink-0" />
                <input
                  type="text"
                  placeholder="Search database to buy existing spices..."
                  value={searchQuery}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  className="w-full bg-transparent text-slate-200 py-3 text-base sm:text-sm font-medium outline-none"
                />
              </div>

              {/* Quick Product Chips for Fast Mobile Tapping */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar text-xs">
                {products.slice(0, 6).map(p => (
                  <button
                    key={`buy-chip-${p.id}`}
                    type="button"
                    onClick={() => {
                      setSearchQuery(p.name);
                      setSelectedProductId(p.id);
                      setShowSuggestions(false);
                      setTimeout(() => qtyInputRef.current?.focus(), 100);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 transition-all cursor-pointer border ${selectedProductId === p.id
                        ? 'bg-amber-600/30 text-amber-300 border-amber-500/50'
                        : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                      }`}
                  >
                    + {p.name}
                  </button>
                ))}
              </div>
              {filteredSearchList.length > 0 && (
                <div className="absolute w-full mt-1.5 max-h-48 overflow-y-auto bg-slate-900 border border-slate-800 rounded-xl z-50 divide-y divide-slate-800/60 shadow-2xl">
                  {filteredSearchList.map(p => {
                    const currentStock = p.stock;
                    return (
                      <div
                        key={p.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                        }}
                        onClick={() => {
                          setSearchQuery(p.name);
                          setSelectedProductId(p.id);
                          setShowSuggestions(false);
                          setTimeout(() => {
                            qtyInputRef.current?.focus();
                          }, 100);
                        }}
                        className="p-3 text-xs bg-slate-900 text-slate-300 hover:bg-slate-800/80 cursor-pointer flex justify-between items-center"
                      >
                        <span className="font-semibold text-slate-200">{p.name}</span>
                        <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-amber-500 font-mono">
                          Current: {currentStock} {p.unit}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Qty field */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">Buying Quantity (මුළු බර)</label>
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 flex items-center gap-2 focus-within:border-amber-500 transition-all">
                  <Scale size={18} className="text-slate-500" />
                  <input
                    ref={qtyInputRef}
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    min="0.01"
                    value={qty === '' ? '' : qty}
                    onChange={(e) => setQty(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-transparent text-slate-200 py-3 text-sm font-medium outline-none"
                  />
                </div>
              </div>

              {/* Deduction field */}
              <div className="space-y-1.5">
                <label className="text-xs text-rose-400 font-medium flex items-center justify-between">
                  <span>Deduction (අඩු කිරීම)</span>
                  <span className="text-[9px] text-slate-500 font-sans">(-kg)</span>
                </label>
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 flex items-center gap-2 focus-within:border-rose-500 transition-all">
                  <span className="text-xs font-bold text-rose-500 font-mono">-</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    value={deductionQty === '' ? '' : deductionQty}
                    onChange={(e) => setDeductionQty(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-transparent text-slate-200 py-3 text-sm font-medium outline-none font-mono"
                  />
                </div>
              </div>

              {/* Qty Unit selector */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">Measuring Unit</label>
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 flex items-center gap-2 focus-within:border-amber-500 transition-all">
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as any)}
                    className="w-full bg-transparent text-slate-300 py-3 text-sm font-medium outline-none cursor-pointer"
                  >
                    <option value="kg" className="bg-slate-950 text-slate-300">KG</option>
                    <option value="g" className="bg-slate-950 text-slate-300">Grams</option>
                    <option value="pcs" className="bg-slate-950 text-slate-300">Pieces</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Net Weight Badge when deduction is active */}
            {qty !== '' && deductionQty !== '' && Number(deductionQty) > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">
                  Net Weight Calculation (ශුද්ධ බර):
                </span>
                <span className="font-mono font-bold text-amber-300">
                  {qty} {unit} - <span className="text-rose-400">{deductionQty} {unit}</span> = <span className="text-emerald-400 underline">{netQty} {unit}</span>
                </span>
              </div>
            )}

            {/* Buy Unit Cost field */}
            <div className="space-y-1.5">
              <label className="text-xs text-amber-400 font-semibold">තොග ගැනුම් මිල / Wholesale Cost (Rs.)</label>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 flex items-center gap-2 focus-within:border-amber-500 transition-all">
                <span className="text-xs font-bold text-slate-500 font-mono">Rs.</span>
                <input
                  type="number"
                  placeholder="Unit Cost Price"
                  step="0.01"
                  min="0"
                  value={price === '' ? '' : price}
                  onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-transparent text-slate-200 py-3 text-sm font-medium outline-none"
                />
              </div>

              {/* Dynamic Daily Selling Price Adjustments */}
              {matchedProduct && (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 mt-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      <span>Daily Thoga (Rs.)</span>
                    </label>
                    <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-2 flex items-center gap-1 focus-within:border-amber-500 transition-all">
                      <span className="text-[10px] font-bold text-slate-500 font-mono">Rs.</span>
                      <input
                        type="number"
                        placeholder="Thoga Price"
                        step="0.01"
                        value={newWholesalePrice === '' ? '' : newWholesalePrice}
                        onChange={(e) => setNewWholesalePrice(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-transparent text-slate-200 py-2 text-xs font-mono outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      <span>Daily Sillara (Rs.)</span>
                    </label>
                    <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-2 flex items-center gap-1 focus-within:border-amber-500 transition-all">
                      <span className="text-[10px] font-bold text-slate-500 font-mono">Rs.</span>
                      <input
                        type="number"
                        placeholder="Sillara Price"
                        step="0.01"
                        value={newRetailPrice === '' ? '' : newRetailPrice}
                        onChange={(e) => setNewRetailPrice(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-transparent text-slate-200 py-2 text-xs font-mono outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Reference sell prices and prospective markup card */}
              {matchedProduct && price !== '' && (() => {
                const rPrice = newRetailPrice !== '' ? Number(newRetailPrice) : (matchedProduct.retail_price ?? matchedProduct.sellPrice);
                const wPrice = newWholesalePrice !== '' ? Number(newWholesalePrice) : (matchedProduct.wholesale_price ?? (matchedProduct.sellPrice * 0.9));
                const cPrice = Number(price);
                const retailProfitVal = rPrice - cPrice;
                const retailProfitPct = cPrice > 0 ? (retailProfitVal / cPrice) * 100 : 0;
                const wholesaleProfitVal = wPrice - cPrice;
                const wholesaleProfitPct = cPrice > 0 ? (wholesaleProfitVal / cPrice) * 100 : 0;
                const isLoss = retailProfitVal < 0;

                return (
                  <div className="mt-2.5 p-3 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2">
                    <div className="flex justify-between items-center text-[11px] text-slate-400 border-b border-slate-900 pb-1.5">
                      <span>Wholesale Sell (තොග මිල):</span>
                      <span className="font-mono font-bold text-slate-200">{formatCurrency(wPrice)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-400 border-b border-slate-900 pb-1.5">
                      <span>Retail Sell (සිල්ලර මිල):</span>
                      <span className="font-mono font-bold text-slate-200">{formatCurrency(rPrice)}</span>
                    </div>
                    <div className={`p-2 rounded-lg text-xs flex flex-col gap-1 ${isLoss
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                      <div className="flex justify-between items-center text-[11px]">
                        <span>Thoga Markup (තොග ලාභය):</span>
                        <strong className="font-mono">{wholesaleProfitPct.toFixed(1)}% ({formatCurrency(wholesaleProfitVal)})</strong>
                      </div>
                      <div className="flex justify-between items-center text-[11px] mt-0.5 border-t border-amber-500/10 pt-1">
                        <span>Sillara Markup (සිල්ලර ලාභය):</span>
                        <strong className="font-mono">{retailProfitPct.toFixed(1)}% ({formatCurrency(retailProfitVal)})</strong>
                      </div>
                    </div>
                    {isLoss && (
                      <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest text-center block animate-pulse mt-1">
                        ⚠️ LOSS WARNING: BUYING PRICE EXCEEDS SELL PRICE! (අලාභදායක මිලදී ගැනීමකි!)
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Total display */}
            <div className="flex justify-between items-center py-2 px-3 bg-amber-950/10 border border-amber-900/40 rounded-xl">
              <span className="text-xs text-slate-400">Total Purchase Value:</span>
              <strong className="text-sm font-bold text-amber-500 font-mono">{formatCurrency(calculatedLineTotal)}</strong>
            </div>

            <button
              onClick={handleAddLineItem}
              className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold text-sm tracking-wide text-white transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus size={18} />
              <span>Add to Purchases</span>
            </button>
          </div>
        </div>

        {/* Buy Order Cart Details */}
        <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col justify-between h-fit min-h-[450px]">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 flex-wrap gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 flex-wrap">
                  <span className="w-1.5 h-4 bg-amber-500 rounded-full inline-block"></span>
                  <span>Active Stock Replenishment Basket</span>
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5 font-mono">Order ID: {currentBillId}</p>
              </div>
              <span className="text-xs font-semibold bg-amber-500/15 text-amber-500 px-3 py-1 rounded-full shrink-0">
                {billItems.length} items
              </span>
            </div>

            {/* Bill Items scroll pane */}
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/40 pr-1">
              {billItems.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                  <Import size={24} className="opacity-10 text-amber-500" />
                  <span>Supplier basket is empty. Select items to add.</span>
                </div>
              ) : (
                billItems.map((item, idx) => (
                  <div key={`${item.productId}-${item.unit}-${idx}`} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-200 truncate" title={item.productName}>
                        {item.productName}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 font-mono">
                        {item.deductionQty && item.deductionQty > 0 ? (
                          <span className="text-amber-400">
                            Net: +{item.qty} {item.unit} ({item.grossQty} - {item.deductionQty}) @ {formatCurrency(item.price)}
                          </span>
                        ) : (
                          <span>+ {item.qty} {item.unit} @ {formatCurrency(item.price)}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-amber-500 select-none font-mono">
                        {formatCurrency(item.total)}
                      </span>
                      <button
                        onClick={() => handleRemoveLineItem(idx)}
                        className="text-red-400 p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/10 hover:border-red-500/35 rounded-lg transition-all cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Totals panel */}
          <div className="mt-6 border-t border-slate-800/80 pt-4 space-y-4">
            <div className="space-y-2">
              {/* Supplier Name */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span className="text-xs text-slate-400 font-medium">Supplier Broker / grower:</span>
                <input
                  type="text"
                  value={supplierName}
                  placeholder="E.g., Mathugama Mills (Bulk)"
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full sm:w-52 bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-medium outline-none text-left focus:border-amber-500 transition-all text-left sm:text-right"
                />
              </div>

              {/* Payment Method Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-slate-800/60">
                <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                  <Wallet size={14} className="text-amber-400" />
                  <span>Payment Method:</span>
                </span>
                <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800/80 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Cash')}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${paymentMethod === 'Cash'
                        ? 'bg-amber-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    Cash (මුදලින්)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Credit')}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${paymentMethod === 'Credit'
                        ? 'bg-red-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    Credit (තොග ණය)
                  </button>
                </div>
              </div>

              {/* Credit Specific Down Payment Field */}
              {paymentMethod === 'Credit' && (
                <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-3 space-y-2 mt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <span className="text-xs text-red-300 font-bold block">Down Payment / මුලින් ගෙවූ මුදල (Rs.):</span>
                      <span className="text-[10px] text-red-400/80">සැපයුම්කරුට දැන් ගෙවූ මුදල (නැතහොත් 0.00 තබන්න)</span>
                    </div>
                    <div className="w-full sm:w-36 bg-slate-950/80 border border-red-800/60 rounded-lg px-2 flex items-center focus-within:border-red-500 transition-all">
                      <span className="text-xs font-bold text-slate-500 pr-1">Rs.</span>
                      <input
                        type="number"
                        min="0"
                        max={subtotal}
                        value={initialPaidAmount === '' ? '' : initialPaidAmount}
                        placeholder="0.00"
                        onChange={(e) => setInitialPaidAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-transparent text-red-200 py-1.5 text-xs text-left sm:text-right font-bold outline-none font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[11px] pt-1 border-t border-red-900/30">
                    <span className="text-slate-400">Remaining Supplier Debt (සැපයුම්කරුට ගෙවිය යුතු ණය):</span>
                    <span className="font-mono font-extrabold text-red-400">
                      Rs. {Math.max(0, subtotal - (initialPaidAmount === '' ? 0 : Number(initialPaidAmount))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-800/80">
              <span className="text-sm font-bold text-slate-300">Total Purchase Cost:</span>
              <strong className="text-lg font-extrabold text-amber-500 font-mono">{formatCurrency(subtotal)}</strong>
            </div>

            {currentDrawerBalance !== undefined && (
              <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl space-y-1.5 select-none">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium flex items-center gap-1.5">
                    <Banknote size={14} className="text-emerald-400" />
                    <span>Shared Drawer Cash:</span>
                  </span>
                  <strong className={`font-mono font-bold ${currentDrawerBalance < subtotal ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
                    }`}>
                    {formatCurrency(currentDrawerBalance)}
                  </strong>
                </div>
                {currentDrawerBalance < subtotal && (
                  <p className="text-[10px] text-rose-500 font-medium text-center bg-rose-500/5 py-1 rounded border border-rose-500/10 animate-pulse uppercase tracking-wider">
                    ⚠️ warning: purchase exceeds drawer cash! (මුදල් මදියි!)
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={cleanCurrentBill}
                className="w-full sm:w-1/3 py-3 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 font-bold text-xs tracking-wider transition-all cursor-pointer"
              >
                Clear Basket
              </button>
              <button
                onClick={handleCheckout}
                disabled={billItems.length === 0}
                className="w-full sm:w-2/3 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save size={16} />
                <span>Confirm Stock Reception</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
