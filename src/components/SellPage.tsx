import { useState, useMemo, useEffect, useRef } from 'react';
import { Product, TransactionItem, Transaction } from '../types';
import { generateNextInvoiceNumber, formatCurrency } from '../utils';
import { Search, Scale, BadgePercent, Trash2, Save, ShoppingBag, Plus, Sparkles, Landmark, Wallet, RotateCcw, Coins } from 'lucide-react';

interface SellPageProps {
  products: Product[];
  currentUserUsername: string;
  currentUserRole?: string;
  transactions: Transaction[];
  onSaveBill: (transaction: Transaction) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export default function SellPage({
  products,
  currentUserUsername,
  currentUserRole = 'cashier',
  transactions,
  onSaveBill,
  onToast
}: SellPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [qty, setQty] = useState<number | ''>('');
  const [deductionQty, setDeductionQty] = useState<number | ''>('');
  const [unit, setUnit] = useState<'kg' | 'g' | 'pcs'>('kg');
  const [price, setPrice] = useState<number | ''>('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Active Desk Prefix: Defaults to J for Jayantha, L for everyone else
  const defaultPrefix = currentUserUsername === 'jayantha' ? 'J' : 'L';
  const [activePrefix, setActivePrefix] = useState<'L' | 'J'>(defaultPrefix);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Credit'>('Cash');
  const [initialPaidAmount, setInitialPaidAmount] = useState<number | ''>('');
  const [priceMode, setPriceMode] = useState<'retail' | 'wholesale'>('retail');

  // Transaction Type: 'sell' or 'return'
  const [transactionType, setTransactionType] = useState<'sell' | 'return'>('sell');
  const [refInvoiceNo, setRefInvoiceNo] = useState('');
  const [returnReason, setReturnReason] = useState('');

  const [currentBillId, setCurrentBillId] = useState('');
  const [billItems, setBillItems] = useState<TransactionItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [customerName, setCustomerName] = useState('');

  const qtyInputRef = useRef<HTMLInputElement>(null);
  const lastProductIdRef = useRef<string>('');
  const lastPriceModeRef = useRef<'retail' | 'wholesale'>(priceMode);

  // Auto-generate invoice ID when active desk, transactions or component boots up
  useEffect(() => {
    const nextId = generateNextInvoiceNumber(activePrefix, transactions);
    setCurrentBillId(nextId);
  }, [activePrefix, transactions]);

  // Handle selected product detail syncing
  const matchedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId || p.name.toLowerCase() === searchQuery.toLowerCase());
  }, [selectedProductId, searchQuery, products]);

  // Adjust defaults when matchedProduct or priceMode is updated
  useEffect(() => {
    if (matchedProduct) {
      const isProductChanged = lastProductIdRef.current !== matchedProduct.id;
      const isModeChanged = lastPriceModeRef.current !== priceMode;

      if (isProductChanged || isModeChanged) {
        const defaultPrice = priceMode === 'wholesale'
          ? (matchedProduct.wholesale_price ?? (matchedProduct.sellPrice * 0.9))
          : (matchedProduct.retail_price ?? matchedProduct.sellPrice);
        setPrice(defaultPrice);
        setUnit(matchedProduct.unit);
        setSelectedProductId(matchedProduct.id);
        lastProductIdRef.current = matchedProduct.id;
        lastPriceModeRef.current = priceMode;
      }
    } else {
      if (lastProductIdRef.current !== '') {
        setSelectedProductId('');
        lastProductIdRef.current = '';
      }
    }
  }, [matchedProduct, priceMode]);

  // List of filtered products for search suggestion dropdown
  const filteredSearchList = useMemo(() => {
    if (!searchQuery || !showSuggestions) return [];
    return products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery, products, showSuggestions]);

  // Calculations
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
      multiplier = 0.001; // gram ratio helper
    }
    return Number((netQty * price * multiplier).toFixed(2));
  }, [qty, price, unit, matchedProduct, netQty]);

  const subtotal = useMemo(() => {
    return billItems.reduce((acc, item) => acc + item.total, 0);
  }, [billItems]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - discount);
  }, [subtotal, discount]);

  const handleAddLineItem = () => {
    if (!selectedProductId || !matchedProduct) {
      onToast('Please select a valid spice/product from the search list.', 'error');
      return;
    }
    if (!qty || Number(qty) <= 0) {
      onToast('Please enter a valid amount or quantity.', 'error');
      return;
    }
    if (!price || Number(price) <= 0) {
      onToast('Please enter a valid price.', 'error');
      return;
    }

    const grossVal = Number(qty);
    const deductVal = deductionQty !== '' && !isNaN(Number(deductionQty)) ? Math.max(0, Number(deductionQty)) : 0;
    const netVal = Math.max(0, grossVal - deductVal);

    // Active stock of selected shop entity
    const activeStock = matchedProduct.stock;

    // Live stock warning check
    let quantityInBaseUnit = netVal;
    if (matchedProduct.unit === 'kg' && unit === 'g') {
      quantityInBaseUnit = netVal * 0.001;
    }

    if (quantityInBaseUnit > activeStock) {
      onToast(`Warning: Requested quantity exceeds warehouse stock (${activeStock} ${matchedProduct.unit} available).`, 'error');
    }

    // Add or append item
    const newItem: TransactionItem = {
      productId: matchedProduct.id,
      productName: matchedProduct.name,
      qty: netVal,
      grossQty: deductVal > 0 ? grossVal : undefined,
      deductionQty: deductVal > 0 ? deductVal : undefined,
      unit: unit,
      price: Number(price),
      total: calculatedLineTotal
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
        return updated;
      }
      return [...prev, newItem];
    });

    // Reset inputs
    setSearchQuery('');
    setSelectedProductId('');
    setQty('');
    setDeductionQty('');
    setPrice('');
    lastProductIdRef.current = '';
    onToast('Item added to current bill.', 'success');
  };

  const handleRemoveLineItem = (index: number) => {
    setBillItems(prev => prev.filter((_, idx) => idx !== index));
    onToast('Item removed from bill.', 'success');
  };

  const cleanCurrentBill = () => {
    setBillItems([]);
    setDiscount(0);
    setCustomerName('');
    setRefInvoiceNo('');
    setReturnReason('');
    setPaymentMethod('Cash');
    setInitialPaidAmount('');
    setCurrentBillId(generateNextInvoiceNumber(activePrefix, transactions));
  };

  const handleCheckout = () => {
    if (billItems.length === 0) {
      onToast('No billing items added to checkout.', 'error');
      return;
    }

    if (transactionType === 'return') {
      const transaction: Transaction = {
        id: currentBillId,
        date: new Date().toISOString(),
        type: 'return',
        items: billItems,
        subtotal: subtotal,
        discount: discount,
        total: grandTotal,
        contactName: customerName.trim() || 'Walk-in Customer',
        createdBy: currentUserUsername,
        invoice_no: currentBillId,
        user_id: activePrefix === 'L' ? 'u3' : 'u4',
        payment_method: paymentMethod,
        amount_paid: grandTotal,
        total_profit: 0,
        is_wholesale: false,
        ref_invoice_no: refInvoiceNo.trim() || undefined,
        return_reason: returnReason.trim() || undefined
      };

      onSaveBill(transaction);
      onToast(`Return Bill ${currentBillId} recorded successfully. Items returned to inventory stock.`, 'success');
      cleanCurrentBill();
      return;
    }

    // Calculate cost and profit for sales
    let totalCost = 0;
    billItems.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      const itemBuyPrice = prod ? (prod.buying_price ?? prod.buyPrice) : 0;
      let qtyInBase = item.qty;
      if (prod && prod.unit === 'kg' && item.unit === 'g') {
        qtyInBase = item.qty * 0.001;
      }
      totalCost += itemBuyPrice * qtyInBase;
    });

    const itemRevenue = billItems.reduce((acc, item) => acc + item.total, 0);
    const itemProfit = itemRevenue - totalCost;
    const discountRatio = subtotal > 0 ? (subtotal - discount) / subtotal : 1;
    const finalProfit = Number((itemProfit * discountRatio).toFixed(2));

    const downPayment = paymentMethod === 'Credit'
      ? (initialPaidAmount !== '' && !isNaN(Number(initialPaidAmount)) ? Math.max(0, Number(initialPaidAmount)) : 0)
      : grandTotal;

    const creditStatus = paymentMethod === 'Credit'
      ? (downPayment >= grandTotal ? 'paid' : (downPayment > 0 ? 'partially_paid' : 'pending'))
      : 'paid';

    const initialPaymentLogs = (paymentMethod === 'Credit' && downPayment > 0)
      ? [{
        id: `PAY-${Date.now()}`,
        date: new Date().toISOString(),
        amount: downPayment,
        payment_method: 'Cash' as const,
        note: 'Down Payment (ආරම්භක ගෙවීම)',
        addedBy: currentUserUsername
      }]
      : [];

    const transaction: Transaction = {
      id: currentBillId,
      date: new Date().toISOString(),
      type: 'sell',
      items: billItems,
      subtotal: subtotal,
      discount: discount,
      total: grandTotal,
      contactName: customerName.trim() || 'Walk-in Customer',
      createdBy: currentUserUsername,
      // Blueprint fields
      invoice_no: currentBillId,
      user_id: activePrefix === 'J' ? 'u4' : 'u3',
      payment_method: paymentMethod,
      amount_paid: downPayment,
      credit_status: creditStatus,
      credit_paid_amount: downPayment,
      credit_payments: initialPaymentLogs,
      total_profit: finalProfit,
      is_wholesale: priceMode === 'wholesale'
    };

    onSaveBill(transaction);
    if (paymentMethod === 'Credit') {
      onToast(`Credit Bill ${currentBillId} (ණය බිල) recorded successfully.`, 'success');
    } else {
      onToast(`Bill ${currentBillId} checked out successfully.`, 'success');
    }
    cleanCurrentBill();
  };

  return (
    <div id="sellPage" className="flex flex-col gap-6">
      {/* Transaction Type Mode Switcher */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 pl-1">
          <RotateCcw className={transactionType === 'return' ? "text-rose-400" : "text-emerald-400"} size={20} />
          <div>
            <h4 className="text-sm font-bold text-slate-100">
              {transactionType === 'sell' ? 'Sale Billing Mode (විකුණුම් පීඨය)' : 'Return Bill Mode (ආපසු බාරගැනීමේ පීඨය)'}
            </h4>
            <p className="text-[10px] text-slate-400">
              {transactionType === 'sell' ? 'Normal customer sales transaction' : 'Process returned items to refund customer & update inventory'}
            </p>
          </div>
        </div>

        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setTransactionType('sell')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${transactionType === 'sell'
              ? 'bg-emerald-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            <Coins size={14} />
            <span>විකුණුම් බිල (Sale)</span>
          </button>
          <button
            type="button"
            onClick={() => setTransactionType('return')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${transactionType === 'return'
              ? 'bg-rose-600 text-white shadow-lg font-bold'
              : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            <RotateCcw size={14} />
            <span>ආපසු බාරගැනීම් (Return)</span>
          </button>
        </div>
      </div>

      {/* POS Billing Desk Switcher */}
      {(currentUserRole === 'superuser' || currentUserRole === 'admin') ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Landmark className="text-violet-400" size={18} />
            <div>
              <h4 className="text-sm font-bold text-slate-100">POS Billing Desk</h4>
              <p className="text-[10px] text-slate-500">As supervisor, select active store entity to bill for</p>
            </div>
          </div>
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80 w-full sm:w-auto">
            <button
              onClick={() => setActivePrefix('L')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activePrefix === 'L'
                ? 'bg-violet-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <span>Lahiru Spices Desk (L)</span>
            </button>
            <button
              onClick={() => setActivePrefix('J')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activePrefix === 'J'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <span>Jayantha Spices Desk (J)</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Landmark className="text-violet-400" size={18} />
            <div>
              <h4 className="text-sm font-bold text-slate-100">
                POS Desk: {activePrefix === 'J' ? 'Jayantha Spices' : 'Lahiru Spices'}
              </h4>
              <p className="text-[10px] text-slate-500">Cashier session locked to your assigned series</p>
            </div>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${activePrefix === 'J'
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
            }`}>
            Series {activePrefix}-xxxx
          </span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Product Selection Inputs */}
        <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-5 h-fit">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <ShoppingBag className="text-violet-400" size={20} />
            <h3 className="text-base font-bold text-slate-100">Sell Spice Basket</h3>
          </div>

          <div className="space-y-4">
            {/* Wholesale / Retail Premium Segment Slider */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Pricing Mode (මිලකරණ ක්‍රමය)</label>
              <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex relative overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPriceMode('retail')}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 z-10 cursor-pointer ${priceMode === 'retail'
                    ? 'bg-violet-600 text-white shadow-lg font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                    }`}
                >
                  <span>Sillara / Retail (සිල්ලර)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPriceMode('wholesale')}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 z-10 cursor-pointer ${priceMode === 'wholesale'
                    ? 'bg-amber-500 text-slate-950 shadow-lg font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                    }`}
                >
                  <Sparkles size={13} className="text-amber-950 animate-pulse" />
                  <span>Thoga / Wholesale (තොග)</span>
                </button>
              </div>
            </div>

            {/* Autocomplete Search input */}
            <div className="space-y-1.5 relative">
              <label className="text-xs text-slate-400 font-medium">Search Product/Spice (කුරුඳු / ගම්මිරිස්)</label>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 flex items-center gap-2 focus-within:border-violet-600 transition-all">
                <Search size={18} className="text-slate-500 shrink-0" />
                <input
                  type="text"
                  placeholder="Type Ceylon Cinnamon, Black Pepper or select..."
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
                    key={`chip-${p.id}`}
                    type="button"
                    onClick={() => {
                      setSearchQuery(p.name);
                      setSelectedProductId(p.id);
                      setShowSuggestions(false);
                      setTimeout(() => qtyInputRef.current?.focus(), 100);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 transition-all cursor-pointer border ${selectedProductId === p.id
                      ? 'bg-violet-600/30 text-violet-300 border-violet-500/50'
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
                    const availableStock = p.stock;
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
                        <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-violet-400 font-semibold font-mono">
                          Stock: {availableStock} {p.unit}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quantity, Deduction and Unit layout */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">Quantity (මුළු බර)</label>
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 flex items-center gap-2 focus-within:border-violet-600 transition-all">
                  <Scale size={18} className="text-slate-500 shrink-0" />
                  <input
                    ref={qtyInputRef}
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    min="0.01"
                    value={qty === '' ? '' : qty}
                    onChange={(e) => setQty(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-transparent text-slate-200 py-3 text-base sm:text-sm font-medium outline-none"
                  />
                </div>
              </div>

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
                    className="w-full bg-transparent text-slate-200 py-3 text-base sm:text-sm font-medium outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">Measuring Unit</label>
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 flex items-center gap-2 focus-within:border-violet-600 transition-all">
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as any)}
                    className="w-full bg-transparent text-slate-300 py-3 text-base sm:text-sm font-medium outline-none cursor-pointer"
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
              <div className="p-2.5 rounded-xl bg-violet-950/40 border border-violet-800/60 flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">
                  Net Weight Calculation (ශුද්ධ බර):
                </span>
                <span className="font-mono font-bold text-violet-300">
                  {qty} {unit} - <span className="text-rose-400">{deductionQty} {unit}</span> = <span className="text-emerald-400 underline">{netQty} {unit}</span>
                </span>
              </div>
            )}

            {/* Sell Unit Price field */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Sell unit price (Rs.)</label>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 flex items-center gap-2 focus-within:border-violet-600 transition-all">
                <span className="text-xs font-bold text-slate-500">Rs.</span>
                <input
                  type="number"
                  placeholder="UnitPrice"
                  step="0.01"
                  min="0"
                  value={price === '' ? '' : price}
                  onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-transparent text-slate-200 py-3 text-base sm:text-sm font-medium outline-none"
                />
              </div>

              {/* Cost and Profit Margin indicator for optimal business decisions */}
              {matchedProduct && price !== '' && (() => {
                const bPrice = matchedProduct.buying_price ?? matchedProduct.buyPrice;
                const sPrice = Number(price);
                const profitVal = sPrice - bPrice;
                const profitPct = bPrice > 0 ? (profitVal / bPrice) * 100 : 0;
                const isLoss = profitVal < 0;
                return (
                  <div className={`mt-2.5 p-3 rounded-xl border flex flex-col gap-1.5 transition-all ${isLoss
                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    }`}>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-semibold text-slate-400">Buying Cost (ගැනුම් මිල):</span>
                      <span className="font-mono font-bold text-slate-300">{formatCurrency(bPrice)} per {matchedProduct.unit}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-semibold text-slate-400">Profit Margin (ලාභය):</span>
                      <span className="font-mono font-extrabold flex items-center gap-1">
                        {isLoss ? '⚠️ ' : '+'}
                        {profitPct.toFixed(1)}% ({formatCurrency(profitVal)})
                      </span>
                    </div>
                    {isLoss && (
                      <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest text-center mt-1 animate-pulse">
                        ⚠️ LOSS WARNING: SELLING BELOW COST! (පාඩු ලබන විකුණුමකි!)
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Live physical stock indicators */}
            {matchedProduct && (
              <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Sparkles size={14} className="text-violet-400" />
                  <span>Available reserve ({activePrefix === 'J' ? 'Jayantha' : 'Lahiru'}):</span>
                </div>
                {(() => {
                  const activeStock = matchedProduct.stock;
                  return (
                    <span className={`text-xs font-bold ${activeStock <= (matchedProduct.min_stock_level || 5) ? 'text-red-400' : 'text-emerald-400'}`}>
                      {activeStock} {matchedProduct.unit}
                    </span>
                  );
                })()}
              </div>
            )}

            {/* Dynamic line total displays */}
            <div className="flex justify-between items-center py-2 px-3 bg-violet-950/10 border border-violet-900/40 rounded-xl">
              <span className="text-xs text-slate-400">Calculated Line Total:</span>
              <strong className="text-sm font-bold text-violet-400">{formatCurrency(calculatedLineTotal)}</strong>
            </div>

            <button
              onClick={handleAddLineItem}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 font-bold text-sm tracking-wide text-white transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus size={18} />
              <span>Add to Current Bill</span>
            </button>
          </div>
        </div>

        {/* Bill Cart Details */}
        <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col justify-between h-fit min-h-[450px]">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 flex-wrap gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-emerald-500 rounded-full inline-block"></span>
                  <span>Active Receipt Basket</span>
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Bill ID: {currentBillId}</p>
              </div>
              <span className="text-xs font-semibold bg-emerald-500/15 text-emerald-400 px-3 py-1 rounded-full shrink-0">
                {billItems.length} items
              </span>
            </div>

            {/* Bill Items scroll pane */}
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/40 pr-1">
              {billItems.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                  <ShoppingBag size={24} className="opacity-10" />
                  <span>The bill basket is empty. Select spices to sell.</span>
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
                            Net: {item.qty} {item.unit} ({item.grossQty} - {item.deductionQty}) @ {formatCurrency(item.price)}
                          </span>
                        ) : (
                          <span>{item.qty} {item.unit} x {formatCurrency(item.price)}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-emerald-400 font-mono">
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
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Subtotal Amount:</span>
                <span className="text-slate-300 font-bold">{formatCurrency(subtotal)}</span>
              </div>

              {/* Discount Form field */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                  <BadgePercent size={14} className="text-violet-400" />
                  <span>Bill Discount deduction (Rs.):</span>
                </span>
                <div className="w-full sm:w-28 bg-slate-950/60 border border-slate-800 rounded-lg px-2 flex items-center focus-within:border-violet-600 transition-all">
                  <input
                    type="number"
                    min="0"
                    max={subtotal}
                    value={discount === 0 ? '' : discount}
                    placeholder="0.00"
                    onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-transparent text-slate-200 py-1.5 text-xs text-left sm:text-right font-bold outline-none font-mono"
                  />
                </div>
              </div>

              {/* Customer name Field */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
                <span className="text-xs text-slate-400 font-medium">Customer reference / name:</span>
                <input
                  type="text"
                  value={customerName}
                  placeholder="E.g., Kamal (Walk-in)"
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full sm:w-48 bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-medium outline-none text-left focus:border-violet-600 transition-all text-left sm:text-right"
                />
              </div>

              {/* Return Bill specific fields */}
              {transactionType === 'return' && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
                    <span className="text-xs text-rose-400 font-medium">Ref Sales Bill No (මුල් බිල් අංකය):</span>
                    <input
                      type="text"
                      value={refInvoiceNo}
                      placeholder="E.g., L-1002"
                      onChange={(e) => setRefInvoiceNo(e.target.value)}
                      className="w-full sm:w-48 bg-slate-950/60 border border-rose-900/40 focus:border-rose-500 rounded-lg px-3 py-1.5 text-xs text-rose-200 font-medium outline-none text-left sm:text-right font-mono"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
                    <span className="text-xs text-rose-400 font-medium">Return Reason (හේතුව):</span>
                    <input
                      type="text"
                      value={returnReason}
                      placeholder="E.g., Customer Exchange / Quality issue"
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="w-full sm:w-48 bg-slate-950/60 border border-rose-900/40 focus:border-rose-500 rounded-lg px-3 py-1.5 text-xs text-rose-200 font-medium outline-none text-left sm:text-right"
                    />
                  </div>
                </>
              )}

              {/* Payment Method Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2">
                <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                  <Wallet size={14} className="text-violet-400" />
                  <span>Payment Method:</span>
                </span>
                <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800/80 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Cash')}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${paymentMethod === 'Cash'
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Card')}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${paymentMethod === 'Card'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Credit')}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${paymentMethod === 'Credit'
                      ? 'bg-red-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    Credit (ණය බිල්)
                  </button>
                </div>
              </div>

              {/* Credit Specific Down Payment Field */}
              {paymentMethod === 'Credit' && (
                <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-3 space-y-2 mt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <span className="text-xs text-red-300 font-bold block">Down Payment / මුලින් ගෙවූ මුදල (Rs.):</span>
                      <span className="text-[10px] text-red-400/80">ණය වෙනුවෙන් දැන් ගෙවූ මුදල (නැතහොත් 0.00 තබන්න)</span>
                    </div>
                    <div className="w-full sm:w-36 bg-slate-950/80 border border-red-800/60 rounded-lg px-2 flex items-center focus-within:border-red-500 transition-all">
                      <span className="text-xs font-bold text-slate-500 pr-1">Rs.</span>
                      <input
                        type="number"
                        min="0"
                        max={grandTotal}
                        value={initialPaidAmount === '' ? '' : initialPaidAmount}
                        placeholder="0.00"
                        onChange={(e) => setInitialPaidAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-transparent text-red-200 py-1.5 text-xs text-left sm:text-right font-bold outline-none font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[11px] pt-1 border-t border-red-900/30">
                    <span className="text-slate-400">Remaining Customer Credit (තවම ලැබීමට ඇති ණය):</span>
                    <span className="font-mono font-extrabold text-red-400">
                      Rs. {Math.max(0, grandTotal - (initialPaidAmount === '' ? 0 : Number(initialPaidAmount))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-800/80">
              <span className="text-sm font-bold text-slate-300">
                {transactionType === 'return' ? 'TOTAL REFUND (ආපසු ගෙවන මුදල):' : 'Net grand overall total:'}
              </span>
              <strong className={`text-lg font-extrabold font-mono ${transactionType === 'return' ? 'text-rose-400' : 'text-emerald-400'}`}>
                {formatCurrency(grandTotal)}
              </strong>
            </div>

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
                className={`w-full sm:w-2/3 py-3 rounded-xl text-white font-bold text-xs tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${transactionType === 'return'
                  ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/50'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50'
                  }`}
              >
                <Save size={16} />
                <span>
                  {transactionType === 'return'
                    ? 'Save & Print Return Bill (ආපසු බාරගැනීම)'
                    : 'Save & Print Checkout'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
