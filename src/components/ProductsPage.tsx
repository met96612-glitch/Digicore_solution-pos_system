import React, { useState, useMemo } from 'react';
import { Product, ProductUnit } from '../types';
import { formatCurrency } from '../utils';
import { Plus, Edit2, Trash2, Search, X, Layers, AlertTriangle, Database, Lock, RefreshCw, Copy } from 'lucide-react';

interface ProductsPageProps {
  products: Product[];
  currentUserRole: 'superuser' | 'admin' | 'cashier';
  currentUserUsername?: string;
  onAddProduct: (prod: Product) => void;
  onUpdateProduct: (prod: Product) => void;
  onDeleteProduct: (id: string) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
  supabaseStatus?: 'checking' | 'connected' | 'disconnected' | 'not_configured';
  hasRlsError?: boolean;
}

export default function ProductsPage({
  products,
  currentUserRole,
  currentUserUsername,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onToast,
  supabaseStatus = 'not_configured',
  hasRlsError = false
}: ProductsPageProps) {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const canAddProduct = true;
  const canEditDeleteProduct = currentUserRole === 'superuser' || currentUserRole === 'admin';

  // Form states
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<ProductUnit>('kg');
  const [buyingPrice, setBuyingPrice] = useState<number | ''>('');
  const [wholesalePrice, setWholesalePrice] = useState<number | ''>('');
  const [retailPrice, setRetailPrice] = useState<number | ''>('');
  const [minStockLevel, setMinStockLevel] = useState<number | ''>(5);
  const [lahiruStock, setLahiruStock] = useState<number | ''>('');
  const [jayanthaStock, setJayanthaStock] = useState<number | ''>('');

  const filteredProducts = useMemo(() => {
    return products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [products, search]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setName('');
    setUnit('kg');
    setBuyingPrice('');
    setWholesalePrice('');
    setRetailPrice('');
    setMinStockLevel(5);
    setLahiruStock('');
    setJayanthaStock('');
    setModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setUnit(p.unit);
    setBuyingPrice(p.buying_price ?? p.buyPrice);
    setWholesalePrice(p.wholesale_price ?? p.sellPrice * 0.9);
    setRetailPrice(p.retail_price ?? p.sellPrice);
    setMinStockLevel(p.min_stock_level ?? 5.0);
    setLahiruStock(p.lahiru_stock ?? p.stock);
    setJayanthaStock(p.jayantha_stock ?? p.stock);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onToast('Product name cannot be blank.', 'error');
      return;
    }
    if (buyingPrice === '' || Number(buyingPrice) < 0) {
      onToast('Enter a valid buying cost.', 'error');
      return;
    }
    if (retailPrice === '' || Number(retailPrice) < 0) {
      onToast('Enter a valid retail selling price.', 'error');
      return;
    }

    const priceBuy = Number(buyingPrice);
    const priceRetail = Number(retailPrice);
    const priceWholesale = wholesalePrice === '' ? priceRetail * 0.9 : Number(wholesalePrice);
    const minBuffer = minStockLevel === '' ? 5.0 : Number(minStockLevel);
    const lStock = lahiruStock === '' ? 0 : Number(lahiruStock);
    const jStock = jayanthaStock === '' ? 0 : Number(jayanthaStock);

    if (priceRetail < priceBuy) {
      onToast('Warning: Retail price is less than buying cost.', 'success');
    }

    const commonStock = lStock + jStock; // Overall stock pool helper

    if (editingProduct) {
      onUpdateProduct({
        ...editingProduct,
        name: name.trim(),
        unit,
        buyPrice: priceBuy,
        sellPrice: priceRetail,
        stock: commonStock,
        buying_price: priceBuy,
        wholesale_price: priceWholesale,
        retail_price: priceRetail,
        min_stock_level: minBuffer,
        lahiru_stock: lStock,
        jayantha_stock: jStock
      });
      onToast('Product updated successfully.', 'success');
    } else {
      const newProduct: Product = {
        id: Math.random().toString(36).substring(2, 9),
        name: name.trim(),
        unit: unit as any,
        buyPrice: priceBuy,
        sellPrice: priceRetail,
        stock: commonStock,
        buying_price: priceBuy,
        wholesale_price: priceWholesale,
        retail_price: priceRetail,
        min_stock_level: minBuffer,
        lahiru_stock: lStock,
        jayantha_stock: jStock
      };
      onAddProduct(newProduct);
      onToast('New spice product registered successfully.', 'success');
    }
    setModalOpen(false);
  };

  return (
    <div id="productsPage" className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-2">
          <Layers className="text-violet-400" size={24} />
          <div>
            <h3 className="text-base font-bold text-slate-100">Warehouse Spices & Products</h3>
            <p className="text-xs text-slate-400 mt-0.5">Manage stock details, buying constraints, and separated pricing.</p>
          </div>
        </div>

        {canAddProduct && (
          <button
            onClick={handleOpenAdd}
            className="py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs tracking-wider transition-all shadow-lg flex items-center gap-2 cursor-pointer w-full md:w-auto justify-center"
          >
            <Plus size={16} />
            <span>Register New Spice</span>
          </button>
        )}
      </div>

      {/* Search Filter */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 flex items-center gap-2 focus-within:border-violet-600 transition-all max-w-md">
        <Search size={18} className="text-slate-500" />
        <input
          type="text"
          placeholder="Search spices catalog..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-transparent text-slate-200 py-3 text-sm font-medium outline-none"
        />
      </div>

      {/* Spice Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.length === 0 ? (
          <div className="col-span-full bg-[#0d1324] border border-slate-800 rounded-2xl p-8 max-w-2xl mx-auto text-center space-y-6 shadow-xl my-6">
            <div className="w-16 h-16 bg-violet-600/10 border border-violet-800/30 text-violet-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner animate-pulse">
              <Database size={32} />
            </div>
            
            <div className="space-y-2">
              <h4 className="text-base font-extrabold text-slate-100 font-sans">පද්ධතියේ කිසිදු කුළුබඩු වර්ගයක් නොමැත</h4>
              <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
                මෙම ගැටළුව මඟහරවා ගැනීමට සහ Supabase හි ඔබ ඇතුලත් කල භාණ්ඩ ලබාගැනීමට පහත උපදෙස් අනුගමනය කරන්න.
              </p>
            </div>

            {supabaseStatus === 'connected' ? (
              <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-5 text-left space-y-3">
                <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                  <Lock size={12} />
                  <span>Row-Level Security (RLS) සක්‍රීය වී තිබිය හැක 🔒</span>
                </span>
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  Supabase හි <strong>Row-Level Security (RLS)</strong> සක්‍රිය වී තිබීම නිසා SELECT විමසුම් මඟින් හිස් දත්ත ලැයිස්තුවක් (empty array) පමණක් ලැබිය හැක. මෙය විසඳීමට සහ පූර්ණ දත්ත සමමුහුර්තකරණය (Sync) සක්‍රිය කිරීමට පහත පියවර කරන්න:
                </p>
                <div className="space-y-2 pt-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">How to resolve (විසඳුම):</span>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    ඔබගේ <b>Supabase Dashboard SQL Editor</b> වෙත ගොස් පහත SQL විමසුම් run කර RLS අක්‍රීය කරන්න:
                  </p>
                  <div className="relative">
                    <pre className="font-mono text-[9px] bg-slate-950/90 border border-slate-800 p-2.5 pr-16 rounded-lg text-slate-300 select-all leading-normal overflow-x-auto">
{`ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;`}
                    </pre>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`ALTER TABLE products DISABLE ROW LEVEL SECURITY;\nALTER TABLE transactions DISABLE ROW LEVEL SECURITY;\nALTER TABLE users DISABLE ROW LEVEL SECURITY;`);
                        onToast('SQL Copied! Execute this in Supabase SQL Editor.', 'success');
                      }}
                      className="absolute top-1.5 right-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[9px] font-bold px-2 py-1 rounded-md transition-all cursor-pointer"
                    >
                      Copy SQL
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 text-left space-y-3">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-amber-400" />
                  <span>උපකරණය පද්ධතිය සමඟ සම්බන්ධ වී නැත (Local Mode)</span>
                </span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  මෙම උපකරණය තවමත් ඔබගේ Supabase database එක සමඟ සම්බන්ධ කර නැත. 
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  මෙය සම්බන්ධ කිරීම සඳහා, පද්ධතියේ ඉහළ දකුණු කෙළවරෙහි ඇති <strong>"Database Status"</strong> badge එක හෝ gear icon එක ක්ලික් කර ඔබගේ Supabase URL එක සහ Secret Key එක ඇතුලත් කරන්න.
                </p>
              </div>
            )}
            
            <div className="pt-2 text-[10px] text-slate-500 font-medium">
              Note: Database එකට සාර්ථකව සම්බන්ධ වූ පසු පද්ධතිය ස්වයංක්‍රීයව දත්ත සමමුහුර්තකරණය සිදු කරයි.
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="col-span-full text-center py-16 text-slate-500 text-sm">
            No products match your search.
          </div>
        ) : (
          filteredProducts.map(p => {
            const lStock = p.lahiru_stock ?? p.stock;
            const jStock = p.jayantha_stock ?? p.stock;
            const buyCost = p.buying_price ?? p.buyPrice;
            const whPrice = p.wholesale_price ?? p.sellPrice * 0.9;
            const retPrice = p.retail_price ?? p.sellPrice;
            const minAlert = p.min_stock_level ?? 5.0;

            return (
              <div key={p.id} className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 hover:border-violet-900/50 transition-all flex flex-col justify-between shadow-md group">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="text-sm font-bold text-slate-200 line-clamp-2">{p.name}</h4>
                    <span className="text-[10px] bg-slate-800 border border-slate-700 font-semibold px-2 py-0.5 rounded text-slate-400 select-none">
                      Per {p.unit.toUpperCase()}
                    </span>
                  </div>
                  
                  {/* Prices block */}
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-b border-slate-800/40 py-3 my-3">
                    <div>
                      <span className="text-[9px] text-slate-500 block font-medium uppercase tracking-wider">Buying Cost</span>
                      <span className="text-xs font-bold font-mono text-slate-300">{formatCurrency(buyCost)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block font-medium uppercase tracking-wider font-sans">Wholesale</span>
                      <span className="text-xs font-bold font-mono text-indigo-400">{formatCurrency(whPrice)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block font-medium uppercase tracking-wider font-sans">Retail Sell</span>
                      <span className="text-xs font-bold font-mono text-emerald-400">{formatCurrency(retPrice)}</span>
                    </div>
                  </div>

                  {/* Markup stats / margin insights */}
                  {buyCost > 0 && (
                    <div className="flex justify-between items-center bg-slate-950/20 px-2.5 py-1.5 rounded-lg border border-slate-800/50 mb-3 text-[10px]">
                      <span className="text-slate-500 font-bold uppercase tracking-wider">Markup (ලාභය)</span>
                      <div className="flex gap-2">
                        <span className="text-indigo-400 font-bold font-mono">
                          Thoga: +{(((whPrice - buyCost) / buyCost) * 100).toFixed(0)}%
                        </span>
                        <span className="text-slate-700 font-bold font-mono">|</span>
                        <span className="text-emerald-400 font-bold font-mono">
                          Sillara: +{(((retPrice - buyCost) / buyCost) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Stock levels block */}
                  <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800 space-y-1.5 text-[11px] font-medium text-slate-400">
                    {currentUserUsername !== 'jayantha' && (
                      <div className="flex justify-between">
                        <span>Lahiru Warehouse:</span>
                        <strong className={`font-mono ${lStock <= minAlert ? 'text-red-400 font-extrabold' : 'text-slate-300'}`}>
                          {lStock} {p.unit}
                        </strong>
                      </div>
                    )}
                    {currentUserUsername !== 'lahiru' && (
                      <div className="flex justify-between">
                        <span>Jayantha Warehouse:</span>
                        <strong className={`font-mono ${jStock <= minAlert ? 'text-red-400 font-extrabold' : 'text-slate-300'}`}>
                          {jStock} {p.unit}
                        </strong>
                      </div>
                    )}
                    {currentUserUsername !== 'lahiru' && currentUserUsername !== 'jayantha' && (
                      <div className="flex justify-between border-t border-slate-800/60 pt-1.5 mt-1">
                        <span className="font-semibold text-slate-400">Combined Pool:</span>
                        <strong className="font-mono text-slate-200">
                          {lStock + jStock} {p.unit}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <div className="text-[10px] text-slate-500">
                    <span>Min alert level: <strong>{minAlert} {p.unit}</strong></span>
                  </div>

                  {canEditDeleteProduct && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="p-2 border border-slate-800 bg-slate-950/40 text-slate-300 hover:text-violet-400 hover:border-violet-900/60 rounded-xl transition-all cursor-pointer"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete ${p.name}?`)) {
                            onDeleteProduct(p.id);
                            onToast('Product removed from databases.', 'success');
                          }
                        }}
                        className="p-2 border border-slate-800 bg-slate-950/40 text-red-500/80 hover:text-red-400 hover:border-red-900/60 rounded-xl transition-all cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Trigger Modal Overlay */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[9999] animate-fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto my-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100">
                {editingProduct ? 'Update Product Details' : 'Register New Warehouse Spice'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-200 cursor-pointer p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-medium font-sans">Product Name / Label</label>
                <input
                  type="text"
                  required
                  placeholder="E.g., Ceylon Cardamon (එනසාල්)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-200 outline-none focus:border-violet-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">Measuring Unit</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as any)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 font-medium outline-none cursor-pointer"
                  >
                    <option value="kg">KG (Weight)</option>
                    <option value="g">Grams</option>
                    <option value="pcs">Pieces (Items)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium font-sans">Min alert level threshold</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="5.0"
                    value={minStockLevel === '' ? '' : minStockLevel}
                    onChange={(e) => setMinStockLevel(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-300 outline-none focus:border-violet-600 font-mono"
                  />
                </div>
              </div>

              {/* Dual Stocks Initial pools */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                <div className="space-y-1">
                  <label className="text-[11px] text-violet-400 font-semibold font-sans">Lahiru Stock Pool</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0"
                    value={lahiruStock === '' ? '' : lahiruStock}
                    onChange={(e) => setLahiruStock(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-300 outline-none focus:border-violet-600 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-emerald-400 font-semibold font-sans">Jayantha Stock Pool</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0"
                    value={jayanthaStock === '' ? '' : jayanthaStock}
                    onChange={(e) => setJayanthaStock(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-300 outline-none focus:border-violet-600 font-mono"
                  />
                </div>
              </div>

              {/* Three Tier Pricing inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold font-sans">Buying Cost (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="Buying Price"
                    value={buyingPrice === '' ? '' : buyingPrice}
                    onChange={(e) => setBuyingPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-300 outline-none focus:border-violet-600 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold font-sans">Wholesale (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Wholesale Price"
                    value={wholesalePrice === '' ? '' : wholesalePrice}
                    onChange={(e) => setWholesalePrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-semibold text-indigo-400 outline-none focus:border-violet-600 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold font-sans">Retail Sell (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="Retail Price"
                    value={retailPrice === '' ? '' : retailPrice}
                    onChange={(e) => setRetailPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-semibold text-emerald-400 outline-none focus:border-violet-600 font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold text-xs tracking-wider transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs tracking-wider transition-all shadow-lg cursor-pointer text-center"
                >
                  {editingProduct ? 'Save Updates' : 'Add Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
