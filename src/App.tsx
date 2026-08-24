import React, { useState, useEffect, useMemo } from 'react';
import { Product, Transaction, User, OpeningCashLog, Expense, ShopProfile, StockAdjustment } from './types';
import { INITIAL_PRODUCTS, INITIAL_TRANSACTIONS, INITIAL_USERS, DEFAULT_SHOP_PROFILE, toSinhalaProductName, mergeTransactions, mergeProducts, getLocalTodayDateString } from './utils';
import DashboardPage from './components/DashboardPage';
import SellPage from './components/SellPage';
import BuyPage from './components/BuyPage';
import ProductsPage from './components/ProductsPage';
import StockPage from './components/StockPage';
import ReportsPage from './components/ReportsPage';
import HistoryPage from './components/HistoryPage';
import AdminPage from './components/AdminPage';
import ExpensesPage from './components/ExpensesPage';
import CreditPage from './components/CreditPage';
import PrintReceipt from './components/PrintReceipt';
import {
  fetchProductsFromSupabase,
  fetchTransactionsFromSupabase,
  fetchUsersFromSupabase,
  pushProductToSupabase,
  pushTransactionToSupabase,
  pushUserToSupabase,
  removeProductFromSupabase,
  removeUserFromSupabase,
  removeTransactionFromSupabase,
  clearAllTransactionsInSupabase,
  createSupabaseClient,
  getSupabaseKeys,
  testSupabaseConnection,
  syncDataToSupabase,
  normalizeProduct
} from './lib/supabase';

import {
  LayoutDashboard,
  Coins,
  Warehouse,
  FolderOpen,
  LineChart,
  History,
  Settings,
  LogOut,
  Bluetooth,
  User as UserIcon,
  ShoppingBag,
  Bell,
  Sparkles,
  Menu,
  X,
  Lock,
  Loader2,
  Banknote,
  AlertTriangle,
  RefreshCw,
  Truck,
  Shield,
  Receipt,
  Trash2,
  Plus,
  CreditCard,
  Palette,
  LogIn
} from 'lucide-react';

export default function App() {
  // Session details
  const [sessionUser, setSessionUser] = useState<User | null>(() => {
    try {
      const saved = sessionStorage.getItem('kulubadu_active_session');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [appLoading, setAppLoading] = useState(true);

  // Active Theme Color State ('blue' | 'violet' | 'emerald' | 'amber' | 'rose')
  const [activeTheme, setActiveTheme] = useState<'blue' | 'violet' | 'emerald' | 'amber' | 'rose'>(() => {
    try {
      return (localStorage.getItem('kulubadu_active_theme') as any) || 'blue';
    } catch {
      return 'blue';
    }
  });
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme);
    localStorage.setItem('kulubadu_active_theme', activeTheme);
  }, [activeTheme]);

  // Core Data sets
  const [products, setProducts] = useState<Product[]>([]);
  const [transactionsState, setTransactionsState] = useState<Transaction[]>([]);
  const setTransactions = (txs: Transaction[] | ((prev: Transaction[]) => Transaction[])) => {
    if (typeof txs === 'function') {
      setTransactionsState(prev => {
        const result = txs(prev);
        return result.filter((tx, index, self) => self.findIndex(t => t.id === tx.id) === index);
      });
    } else {
      const unique = txs.filter((tx, index, self) => self.findIndex(t => t.id === tx.id) === index);
      setTransactionsState(unique);
    }
  };
  const transactions = transactionsState;
  const [registeredUsers, setRegisteredUsers] = useState<User[]>([]);

  // Navigation states
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'sell' | 'buy' | 'products' | 'stock' | 'expenses' | 'reports' | 'history' | 'admin' | 'credit'>('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);

  // Shop Expenses state
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('kulubadu_expenses');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  const addExpense = (expData: Omit<Expense, 'id' | 'date' | 'addedBy'>) => {
    const userStore = sessionUser?.store_id || (sessionUser?.username === 'jayantha' ? 'store_2' : 'store_1');
    const newExpense: Expense = {
      ...expData,
      id: `EXP-${Date.now()}`,
      date: new Date().toISOString(),
      addedBy: sessionUser?.username || 'cashier',
      store_id: userStore
    };
    setExpenses(prev => {
      const updated = [newExpense, ...prev];
      localStorage.setItem('kulubadu_expenses', JSON.stringify(updated));
      return updated;
    });
  };

  const deleteExpense = (id: string) => {
    setExpenses(prev => {
      const updated = prev.filter(e => e.id !== id);
      localStorage.setItem('kulubadu_expenses', JSON.stringify(updated));
      return updated;
    });
  };

  // Stock Adjustments & Wastage Loss tracking
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>(() => {
    const saved = localStorage.getItem('kulubadu_stock_adjustments');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved stock adjustments:', e);
      }
    }
    return [];
  });

  const addStockAdjustment = async (adjData: Omit<StockAdjustment, 'id' | 'date'>) => {
    const newAdj: StockAdjustment = {
      ...adjData,
      id: `ADJ-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString(),
    };

    // 1. Fetch latest products from Supabase if online
    let latestProducts = [...products];
    const client = createSupabaseClient();
    const targetStore = newAdj.desk === 'jayantha' ? 'store_2' : 'store_1';
    if (client && supabaseStatus === 'connected') {
      try {
        const supaProds = await fetchProductsFromSupabase(targetStore);
        if (supaProds !== null) {
          latestProducts = supaProds.map(normalizeProduct);
        }
      } catch (err) {
        console.warn('Could not fetch latest products before stock adjustment:', err);
      }
    }

    // 2. Reduce the specific desk's stock and combined stock
    const updatedProductsList = latestProducts.map(p => {
      const matchesId = p.id === newAdj.productId || String(p.id) === String(newAdj.productId);
      const matchesName = p.name.trim().toLowerCase() === newAdj.productName.trim().toLowerCase();
      const matchesStore = !p.store_id || p.store_id === targetStore;
      if ((matchesId || matchesName) && matchesStore) {
        let qtyInBaseUnit = newAdj.qty;
        if (p.unit === 'kg' && newAdj.unit === 'g') {
          qtyInBaseUnit = newAdj.qty * 0.001;
        }

        const currentStock = Number(p.stock ?? 0);
        const newStock = Number(Math.max(0, currentStock - qtyInBaseUnit).toFixed(3));

        return {
          ...p,
          stock: newStock,
          lahiru_stock: newStock,
          jayantha_stock: newStock
        };
      }
      return p;
    });

    saveProductsToDb(updatedProductsList);

    setStockAdjustments(prev => {
      const updated = [newAdj, ...prev];
      localStorage.setItem('kulubadu_stock_adjustments', JSON.stringify(updated));
      return updated;
    });

    triggerToast(`තොග අඩුවීම (${newAdj.productName} - ${newAdj.qty} ${newAdj.unit}) සාර්ථකව සටහන් විය!`, 'success');
  };

  const deleteStockAdjustment = async (adjId: string) => {
    const targetAdj = stockAdjustments.find(a => a.id === adjId);
    if (!targetAdj) return;

    const targetStore = targetAdj.desk === 'jayantha' ? 'store_2' : 'store_1';
    let latestProducts = [...products];
    const client = createSupabaseClient();
    if (client && supabaseStatus === 'connected') {
      try {
        const supaProds = await fetchProductsFromSupabase(targetStore);
        if (supaProds !== null) {
          latestProducts = supaProds.map(normalizeProduct);
        }
      } catch (err) {
        console.warn('Could not fetch latest products before rollback:', err);
      }
    }

    // Rollback stock
    const updatedProductsList = latestProducts.map(p => {
      const matchesId = p.id === targetAdj.productId || String(p.id) === String(targetAdj.productId);
      const matchesName = p.name.trim().toLowerCase() === targetAdj.productName.trim().toLowerCase();
      const matchesStore = !p.store_id || p.store_id === targetStore;
      if ((matchesId || matchesName) && matchesStore) {
        let qtyInBaseUnit = targetAdj.qty;
        if (p.unit === 'kg' && targetAdj.unit === 'g') {
          qtyInBaseUnit = targetAdj.qty * 0.001;
        }

        const currentStock = Number(p.stock ?? 0);
        const newStock = Number((currentStock + qtyInBaseUnit).toFixed(3));

        return {
          ...p,
          stock: newStock,
          lahiru_stock: newStock,
          jayantha_stock: newStock
        };
      }
      return p;
    });

    saveProductsToDb(updatedProductsList);

    setStockAdjustments(prev => {
      const updated = prev.filter(a => a.id !== adjId);
      localStorage.setItem('kulubadu_stock_adjustments', JSON.stringify(updated));
      return updated;
    });

    triggerToast('තොග අඩුවීම ඉවත් කර Stock එක යථා තත්ත්වයට පත් කරන ලදී.', 'success');
  };

  // Bluetooth Printer connection status (saved in localStorage if paired)
  const [btStatus, setBtStatus] = useState<'connected' | 'disconnected'>(() => {
    return localStorage.getItem('kulubadu_active_bt_device') ? 'connected' : 'disconnected';
  });

  // Shop Profile Settings (Shop Name, Sinhala Name, Address, Phone, Footer)
  const [shopProfile, setShopProfile] = useState<ShopProfile>(() => {
    const saved = localStorage.getItem('kulubadu_shop_profile');
    if (saved) {
      try {
        return { ...DEFAULT_SHOP_PROFILE, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to parse saved shop profile:', e);
      }
    }
    return DEFAULT_SHOP_PROFILE;
  });

  const updateShopProfile = (newProfile: ShopProfile) => {
    setShopProfile(newProfile);
    localStorage.setItem('kulubadu_shop_profile', JSON.stringify(newProfile));
  };

  // Interactive popup receipt modal
  const [receiptTx, setReceiptTx] = useState<Transaction | null>(null);

  // UI Toast indicators
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Shared Cash Drawer (Lachchuwa) tracking
  const [openingCash, setOpeningCashState] = useState<number>(() => {
    const saved = localStorage.getItem('kulubadu_opening_cash');
    return saved ? Number(saved) : 0;
  });
  const [openingCashLogs, setOpeningCashLogs] = useState<OpeningCashLog[]>(() => {
    const saved = localStorage.getItem('kulubadu_opening_cash_logs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });
  const [showDrawerModal, setShowDrawerModal] = useState(false);
  const [depositInputVal, setDepositInputVal] = useState<string>('');
  const [drawerUserFilter, setDrawerUserFilter] = useState<'my' | 'lahiru' | 'jayantha'>('my');

  // Supabase status and credentials states
  const [supabaseStatus, setSupabaseStatus] = useState<'checking' | 'connected' | 'disconnected' | 'not_configured'>('checking');
  const [showSupaModal, setShowSupaModal] = useState(false);
  const [modalSupaUrl, setModalSupaUrl] = useState('');
  const [modalSupaKey, setModalSupaKey] = useState('');
  const [isVerifyingModalSupa, setIsVerifyingModalSupa] = useState(false);
  const [hasRlsError, setHasRlsError] = useState<boolean>(() => !!localStorage.getItem('supabase_last_rls_error'));

  // Function to re-evaluate connection
  const checkSupabaseStatus = async () => {
    const { url, key } = getSupabaseKeys();
    if (!url || !key) {
      setSupabaseStatus('not_configured');
      return;
    }
    setSupabaseStatus('checking');
    try {
      const client = createSupabaseClient();
      if (!client) {
        setSupabaseStatus('not_configured');
        return;
      }
      const { error } = await client.from('products').select('id').limit(1);
      if (error) {
        if (error.message?.toLowerCase().includes('row-level security') || error.message?.toLowerCase().includes('rls') || error.code === '42501') {
          setSupabaseStatus('connected');
          setHasRlsError(true);
          localStorage.setItem('supabase_last_rls_error', 'true');
        } else {
          setSupabaseStatus('disconnected');
        }
      } else {
        setSupabaseStatus('connected');
        setHasRlsError(false);
        localStorage.removeItem('supabase_last_rls_error');
      }
    } catch (err) {
      setSupabaseStatus('disconnected');
    }
  };

  useEffect(() => {
    checkSupabaseStatus();

    const handleError = () => setHasRlsError(true);
    const handleResolved = () => setHasRlsError(false);

    window.addEventListener('supabase-rls-error', handleError);
    window.addEventListener('supabase-rls-resolved', handleResolved);

    return () => {
      window.removeEventListener('supabase-rls-error', handleError);
      window.removeEventListener('supabase-rls-resolved', handleResolved);
    };
  }, []);

  const [todayDateString, setTodayDateString] = useState<string>(getLocalTodayDateString);

  useEffect(() => {
    const interval = setInterval(() => {
      const liveStr = getLocalTodayDateString();
      if (liveStr !== todayDateString) {
        setTodayDateString(liveStr);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [todayDateString]);

  const isSharedStore = (sId?: string) => !sId || sId === 'store_1' || sId === 'store_2';

  const addOpeningCash = (amount: number, userOverride?: string) => {
    if (isNaN(amount) || amount <= 0) return;
    const username = userOverride || sessionUser?.username || 'admin';
    const userStore = sessionUser?.store_id || (username === 'jayantha' ? 'store_2' : 'store_1');
    const dateStr = todayDateString;
    const newLog: OpeningCashLog = {
      id: `OC-${Date.now()}`,
      date: dateStr,
      timestamp: new Date().toISOString(),
      amount: amount,
      addedBy: username,
      store_id: userStore
    };

    setOpeningCashLogs(prev => {
      const updated = [newLog, ...prev];
      localStorage.setItem('kulubadu_opening_cash_logs', JSON.stringify(updated));
      return updated;
    });

    setOpeningCashState(amount);
    localStorage.setItem('kulubadu_opening_cash', String(amount));
  };

  const setOpeningCash = (amount: number, userOverride?: string) => {
    addOpeningCash(amount, userOverride);
  };

  const deleteOpeningCashLog = (logId: string) => {
    setOpeningCashLogs(prev => {
      const updated = prev.filter(l => l.id !== logId);
      localStorage.setItem('kulubadu_opening_cash_logs', JSON.stringify(updated));
      return updated;
    });
  };

  const filteredProducts = useMemo(() => {
    if (!sessionUser) return [];
    if (sessionUser.role === 'superuser') {
      return products;
    }
    const userStore = sessionUser.store_id || (sessionUser.username === 'jayantha' ? 'store_2' : (sessionUser.username === 'lahiru' ? 'store_1' : sessionUser.username));
    if (isSharedStore(userStore)) {
      return products.filter(p => !p.store_id || p.store_id === 'store_1' || p.store_id === 'store_2');
    }
    return products.filter(p => p.store_id === userStore);
  }, [products, sessionUser]);

  const filteredTransactions = useMemo(() => {
    if (!sessionUser) return [];
    if (sessionUser.role === 'superuser') {
      return transactions;
    }
    const userStore = sessionUser.store_id || (sessionUser.username === 'jayantha' ? 'store_2' : (sessionUser.username === 'lahiru' ? 'store_1' : sessionUser.username));
    if (isSharedStore(userStore)) {
      if (sessionUser.username === 'lahiru') {
        return transactions.filter(tx => !tx.id.startsWith('J-') && (!tx.store_id || tx.store_id === 'store_1' || tx.store_id === 'store_2'));
      }
      if (sessionUser.username === 'jayantha') {
        return transactions.filter(tx => tx.id.startsWith('J-') && (!tx.store_id || tx.store_id === 'store_1' || tx.store_id === 'store_2'));
      }
      return transactions.filter(tx => !tx.store_id || tx.store_id === 'store_1' || tx.store_id === 'store_2');
    }
    return transactions.filter(tx => tx.store_id === userStore || tx.createdBy === sessionUser.username);
  }, [transactions, sessionUser]);

  const drawerTransactions = useMemo(() => {
    if (!sessionUser) return [];
    const userStoreId = sessionUser.store_id || (sessionUser.username === 'jayantha' ? 'store_2' : 'store_1');
    if (sessionUser.role === 'superuser') {
      return transactions;
    }
    if (isSharedStore(userStoreId)) {
      return transactions.filter(tx => !tx.store_id || tx.store_id === 'store_1' || tx.store_id === 'store_2' || tx.createdBy === 'lahiru' || tx.createdBy === 'jayantha');
    }
    return transactions.filter(tx => tx.store_id === userStoreId || tx.createdBy === sessionUser.username);
  }, [transactions, sessionUser]);

  const drawerOpeningCashLogs = useMemo(() => {
    if (!sessionUser) return [];
    const userStoreId = sessionUser.store_id || (sessionUser.username === 'jayantha' ? 'store_2' : 'store_1');
    if (sessionUser.role === 'superuser') {
      return openingCashLogs;
    }
    if (isSharedStore(userStoreId)) {
      return openingCashLogs.filter(l => !l.store_id || l.store_id === 'store_1' || l.store_id === 'store_2' || l.addedBy === 'lahiru' || l.addedBy === 'jayantha' || l.addedBy === 'admin' || l.addedBy === 'cashier');
    }
    return openingCashLogs.filter(l => l.store_id === userStoreId || l.addedBy === sessionUser.username);
  }, [openingCashLogs, sessionUser]);

  const drawerExpenses = useMemo(() => {
    if (!sessionUser) return [];
    const userStoreId = sessionUser.store_id || (sessionUser.username === 'jayantha' ? 'store_2' : 'store_1');
    if (sessionUser.role === 'superuser') {
      return expenses;
    }
    if (isSharedStore(userStoreId)) {
      return expenses.filter(e => !e.store_id || e.store_id === 'store_1' || e.store_id === 'store_2' || e.addedBy === 'lahiru' || e.addedBy === 'jayantha' || e.addedBy === 'admin' || e.addedBy === 'cashier');
    }
    return expenses.filter(e => e.store_id === userStoreId || e.addedBy === sessionUser.username);
  }, [expenses, sessionUser]);

  const filteredOpeningCashLogs = useMemo(() => {
    if (!sessionUser) return [];
    const userStoreId = sessionUser.store_id || (sessionUser.username === 'jayantha' ? 'store_2' : 'store_1');
    if (sessionUser.role === 'superuser' || sessionUser.role === 'admin') {
      return openingCashLogs;
    }
    if (isSharedStore(userStoreId)) {
      if (sessionUser.username === 'lahiru') {
        return openingCashLogs.filter(l => l.addedBy === 'lahiru' || l.addedBy === 'admin' || l.addedBy === 'cashier' || l.store_id === 'store_1');
      }
      if (sessionUser.username === 'jayantha') {
        return openingCashLogs.filter(l => l.addedBy === 'jayantha' || l.store_id === 'store_2');
      }
      return openingCashLogs.filter(l => !l.store_id || l.store_id === 'store_1' || l.store_id === 'store_2');
    }
    return openingCashLogs.filter(l => l.store_id === userStoreId || l.addedBy === sessionUser.username);
  }, [openingCashLogs, sessionUser]);

  const filteredExpenses = useMemo(() => {
    if (!sessionUser) return [];
    const userStoreId = sessionUser.store_id || (sessionUser.username === 'jayantha' ? 'store_2' : 'store_1');
    if (sessionUser.role === 'superuser') {
      return expenses;
    }
    if (isSharedStore(userStoreId)) {
      if (sessionUser.username === 'lahiru') {
        return expenses.filter(e => e.addedBy !== 'jayantha' || e.store_id === 'store_1');
      }
      if (sessionUser.username === 'jayantha') {
        return expenses.filter(e => e.addedBy === 'jayantha' || e.store_id === 'store_2');
      }
      return expenses.filter(e => !e.store_id || e.store_id === 'store_1' || e.store_id === 'store_2');
    }
    return expenses.filter(e => e.store_id === userStoreId || e.addedBy === sessionUser.username);
  }, [expenses, sessionUser]);

  const filteredStockAdjustments = useMemo(() => {
    if (!sessionUser) return [];
    if (sessionUser.role === 'superuser' || sessionUser.role === 'admin') {
      return stockAdjustments;
    }
    if (sessionUser.username === 'lahiru') {
      return stockAdjustments.filter(a => a.desk === 'lahiru');
    }
    if (sessionUser.username === 'jayantha') {
      return stockAdjustments.filter(a => a.desk === 'jayantha');
    }
    return stockAdjustments;
  }, [stockAdjustments, sessionUser]);

  const isToday = (dateStr: string) => {
    if (!dateStr) return false;
    if (dateStr.startsWith(todayDateString)) return true;
    try {
      const d = new Date(dateStr);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}` === todayDateString;
    } catch {
      return false;
    }
  };

  const todayCashSales = useMemo(() => {
    const directCashSales = drawerTransactions
      .filter(tx => tx.type === 'sell' && (tx.payment_method === 'Cash' || !tx.payment_method) && isToday(tx.date))
      .reduce((sum, tx) => sum + tx.total, 0);

    let creditCashRecovered = 0;
    drawerTransactions.forEach(tx => {
      if (tx.type === 'sell' && tx.credit_payments) {
        tx.credit_payments.forEach(pay => {
          if (isToday(pay.date) && pay.payment_method === 'Cash') {
            creditCashRecovered += pay.amount;
          }
        });
      }
    });

    return directCashSales + creditCashRecovered;
  }, [drawerTransactions, todayDateString]);

  const todayBuysTotal = useMemo(() => {
    let cashSpentOnBuys = drawerTransactions
      .filter(tx => tx.type === 'buy' && (tx.payment_method === 'Cash' || !tx.payment_method) && isToday(tx.date))
      .reduce((sum, tx) => sum + tx.total, 0);

    drawerTransactions.forEach(tx => {
      if (tx.type === 'buy' && tx.credit_payments) {
        tx.credit_payments.forEach(pay => {
          if (isToday(pay.date) && pay.payment_method === 'Cash') {
            cashSpentOnBuys += pay.amount;
          }
        });
      }
    });

    return cashSpentOnBuys;
  }, [drawerTransactions, todayDateString]);

  const todayExpensesTotal = useMemo(() => {
    return drawerExpenses
      .filter(exp => isToday(exp.date))
      .reduce((sum, exp) => sum + exp.amount, 0);
  }, [drawerExpenses, todayDateString]);

  const todayOpeningCashTotal = useMemo(() => {
    const todayLogs = drawerOpeningCashLogs.filter(l => isToday(l.date));
    return todayLogs.reduce((sum, l) => sum + l.amount, 0);
  }, [drawerOpeningCashLogs, todayDateString]);

  const currentDrawerBalance = todayOpeningCashTotal + todayCashSales - todayExpensesTotal - todayBuysTotal;

  const activeModalDrawerData = useMemo(() => {
    const userStoreId = sessionUser?.store_id || (sessionUser?.username === 'jayantha' ? 'store_2' : 'store_1');
    let targetLogs = drawerOpeningCashLogs;
    let targetTx = drawerTransactions;
    let targetExp = drawerExpenses;
    let username = sessionUser?.username || 'user';
    let name = isSharedStore(userStoreId)
      ? 'Shared Cash Drawer (store_1 & store_2 - පොදු ලච්චුව)'
      : `${sessionUser?.shop_name || userStoreId.toUpperCase()} Cash Drawer`;

    if ((sessionUser?.role === 'superuser' || sessionUser?.role === 'admin') && drawerUserFilter !== 'my') {
      if (drawerUserFilter === 'lahiru') {
        username = 'lahiru';
        name = 'Lahiru Spices Cash Audit';
        targetLogs = openingCashLogs.filter(l => l.addedBy === 'lahiru' || l.store_id === 'store_1');
        targetTx = transactions.filter(tx => tx.id.startsWith('L-') || tx.createdBy === 'lahiru' || tx.store_id === 'store_1');
        targetExp = expenses.filter(e => e.addedBy === 'lahiru' || e.store_id === 'store_1');
      } else if (drawerUserFilter === 'jayantha') {
        username = 'jayantha';
        name = 'Jayantha Spices Cash Audit';
        targetLogs = openingCashLogs.filter(l => l.addedBy === 'jayantha' || l.store_id === 'store_2');
        targetTx = transactions.filter(tx => tx.id.startsWith('J-') || tx.createdBy === 'jayantha' || tx.store_id === 'store_2');
        targetExp = expenses.filter(e => e.addedBy === 'jayantha' || e.store_id === 'store_2');
      }
    }

    const logs = targetLogs.filter(l => isToday(l.date));
    const openingTotal = logs.reduce((sum, l) => sum + l.amount, 0);

    const directSales = targetTx
      .filter(tx => tx.type === 'sell' && (tx.payment_method === 'Cash' || !tx.payment_method) && isToday(tx.date))
      .reduce((sum, tx) => sum + tx.total, 0);

    let creditRecovered = 0;
    targetTx.forEach(tx => {
      if (tx.type === 'sell' && tx.credit_payments) {
        tx.credit_payments.forEach(pay => {
          if (isToday(pay.date) && pay.payment_method === 'Cash') {
            creditRecovered += pay.amount;
          }
        });
      }
    });
    const cashSales = directSales + creditRecovered;

    let cashSpentBuys = targetTx
      .filter(tx => tx.type === 'buy' && (tx.payment_method === 'Cash' || !tx.payment_method) && isToday(tx.date))
      .reduce((sum, tx) => sum + tx.total, 0);
    targetTx.forEach(tx => {
      if (tx.type === 'buy' && tx.credit_payments) {
        tx.credit_payments.forEach(pay => {
          if (isToday(pay.date) && pay.payment_method === 'Cash') {
            cashSpentBuys += pay.amount;
          }
        });
      }
    });

    const expTotal = targetExp
      .filter(exp => isToday(exp.date))
      .reduce((sum, exp) => sum + exp.amount, 0);

    const balance = openingTotal + cashSales - expTotal - cashSpentBuys;

    return {
      username,
      name,
      logs,
      openingTotal,
      cashSales,
      cashSpentBuys,
      expTotal,
      balance,
      todayBuysList: targetTx.filter(tx => tx.type === 'buy' && isToday(tx.date))
    };
  }, [sessionUser, drawerUserFilter, drawerOpeningCashLogs, drawerTransactions, drawerExpenses, openingCashLogs, transactions, expenses, todayDateString]);

  // Initial local initialization
  useEffect(() => {
    async function loadInitialData() {
      try {
        const client = createSupabaseClient();
        if (client) {
          console.log('Supabase client detected. Attempting to fetch live data...');
          const activeSessionRaw = sessionStorage.getItem('kulubadu_active_session');
          const activeSession = activeSessionRaw ? JSON.parse(activeSessionRaw) : null;
          const initStoreId = activeSession?.role === 'superuser' ? undefined : (activeSession?.store_id || (activeSession?.username === 'jayantha' ? 'store_2' : 'store_1'));

          const [supaProds, supaTx, supaUsers] = await Promise.all([
            fetchProductsFromSupabase(initStoreId),
            fetchTransactionsFromSupabase(initStoreId),
            fetchUsersFromSupabase()
          ]);

          if (supaProds !== null) {
            const mappedProds = supaProds.map(normalizeProduct);
            const savedProducts = localStorage.getItem('kulubadu_products');
            const localProds = savedProducts ? JSON.parse(savedProducts) : INITIAL_PRODUCTS;
            let mergedProds = mergeProducts(mappedProds, localProds);
            if (mergedProds.length === 0) {
              mergedProds = INITIAL_PRODUCTS.map(p => ({ ...p, store_id: initStoreId || 'store_1' }));
            }
            setProducts(mergedProds);
            localStorage.setItem('kulubadu_products', JSON.stringify(mergedProds));
          } else {
            loadLocalProducts();
          }

          if (supaTx !== null) {
            const savedTx = localStorage.getItem('kulubadu_transactions');
            const localTx = savedTx ? JSON.parse(savedTx) : INITIAL_TRANSACTIONS;
            const DEMO_IDS = ['S-260524-1001', 'S-260524-1002', 'B-260524-1001'];
            const cleanSupaTx = supaTx.filter(tx => !DEMO_IDS.includes(tx.id));
            const cleanLocalTx = localTx.filter((tx: Transaction) => !DEMO_IDS.includes(tx.id));
            const mergedTx = mergeTransactions(cleanSupaTx, cleanLocalTx);
            setTransactions(mergedTx);
            localStorage.setItem('kulubadu_transactions', JSON.stringify(mergedTx));
            cleanLocalTx.forEach((tx: Transaction) => {
              if (!cleanSupaTx.some(st => st.id === tx.id)) {
                pushTransactionToSupabase(tx);
              }
            });
          } else {
            loadLocalTransactions();
          }

          if (supaUsers && supaUsers.length > 0) {
            const savedUsersStr = localStorage.getItem('kulubadu_users');
            let localUsers: User[] = [];
            if (savedUsersStr) {
              try { localUsers = JSON.parse(savedUsersStr); } catch { }
            }
            const userMap = new Map<string, User>();
            INITIAL_USERS.forEach(u => userMap.set(u.username.toLowerCase(), u));
            localUsers.forEach(u => userMap.set(u.username.toLowerCase(), u));
            supaUsers.forEach(u => userMap.set(u.username.toLowerCase(), u));

            const merged = Array.from(userMap.values());
            merged.forEach(u => {
              u.store_id = u.store_id || (
                u.username === 'jayantha' ? 'store_2' :
                  u.username === 'lahiru' ? 'store_1' :
                    (u.username.startsWith('store_') ? u.username : `store_${u.username}`)
              );
            });
            setRegisteredUsers(merged);
            localStorage.setItem('kulubadu_users', JSON.stringify(merged));
            // Push missing users to Supabase
            merged.forEach(u => {
              if (!supaUsers.some(su => su.username.toLowerCase() === u.username.toLowerCase())) {
                pushUserToSupabase(u);
              }
            });
          } else {
            loadLocalUsers();
          }
        } else {
          loadLocalProducts();
          loadLocalUsers();
          loadLocalTransactions();
        }
      } catch (err) {
        console.warn('Failed to load from Supabase on startup, falling back to local state:', err);
        loadLocalProducts();
        loadLocalUsers();
        loadLocalTransactions();
      } finally {
        setAppLoading(false);
      }
    }

    function loadLocalProducts() {
      const savedProducts = localStorage.getItem('kulubadu_products');
      if (savedProducts) {
        try {
          let loaded = JSON.parse(savedProducts) as Product[];
          if (Array.isArray(loaded)) {
            loaded = loaded.map(p => ({
              ...p,
              name: toSinhalaProductName(p.name),
              lahiru_stock: p.lahiru_stock !== undefined ? p.lahiru_stock : p.stock,
              jayantha_stock: p.jayantha_stock !== undefined ? p.jayantha_stock : p.stock,
              min_stock_level: p.min_stock_level !== undefined ? p.min_stock_level : 5.0,
              buying_price: p.buying_price !== undefined ? p.buying_price : p.buyPrice,
              wholesale_price: p.wholesale_price !== undefined ? p.wholesale_price : p.sellPrice * 0.9,
              retail_price: p.retail_price !== undefined ? p.retail_price : p.sellPrice,
            }));
            localStorage.setItem('kulubadu_products', JSON.stringify(loaded));
            setProducts(loaded);
            return;
          }
        } catch (e) {
          console.warn('Failed to parse kulubadu_products from localStorage:', e);
        }
      }
      localStorage.setItem('kulubadu_products', JSON.stringify(INITIAL_PRODUCTS));
      setProducts(INITIAL_PRODUCTS);
    }

    function loadLocalUsers() {
      const savedUsers = localStorage.getItem('kulubadu_users');
      let loadedUsers: User[] = [];
      if (savedUsers) {
        try {
          const parsed = JSON.parse(savedUsers);
          if (Array.isArray(parsed)) loadedUsers = parsed;
        } catch (e) {
          console.warn('Failed to parse kulubadu_users from localStorage:', e);
        }
      }

      const userMap = new Map<string, User>();
      INITIAL_USERS.forEach(u => userMap.set(u.username.toLowerCase(), u));
      loadedUsers.forEach(u => userMap.set(u.username.toLowerCase(), u));

      const merged = Array.from(userMap.values());
      merged.forEach(u => {
        u.store_id = u.store_id || (
          u.username === 'jayantha' ? 'store_2' :
            u.username === 'lahiru' ? 'store_1' :
              (u.username.startsWith('store_') ? u.username : `store_${u.username}`)
        );
        if (!u.shop_name || u.shop_name.includes('Center')) {
          if (u.username === 'jayantha') {
            u.shop_name = 'Jayantha Spice Collectors';
            u.phone_number = '077 602 1831';
            u.invoice_prefix = 'J';
          } else {
            u.shop_name = 'Lahiya Spice Collectors';
            u.phone_number = '074 0050211 / 076 0808246';
            u.invoice_prefix = 'L';
          }
        }
      });
      localStorage.setItem('kulubadu_users', JSON.stringify(merged));
      setRegisteredUsers(merged);
    }

    function loadLocalTransactions() {
      const savedTx = localStorage.getItem('kulubadu_transactions');
      const DEMO_IDS = ['S-260524-1001', 'S-260524-1002', 'B-260524-1001'];
      if (savedTx) {
        try {
          let loaded = JSON.parse(savedTx) as Transaction[];
          if (Array.isArray(loaded)) {
            const cleanLoaded = loaded.filter(tx => !DEMO_IDS.includes(tx.id));
            setTransactions(cleanLoaded);
            localStorage.setItem('kulubadu_transactions', JSON.stringify(cleanLoaded));
            return;
          }
        } catch (e) {
          console.warn('Failed to parse kulubadu_transactions from localStorage:', e);
        }
      }
      const cleanInitial = INITIAL_TRANSACTIONS.filter(tx => !DEMO_IDS.includes(tx.id));
      localStorage.setItem('kulubadu_transactions', JSON.stringify(cleanInitial));
      setTransactions(cleanInitial);
    }

    loadInitialData();
  }, [supabaseStatus]);

  // Update states helper functions
  const saveProductsToDb = (newProds: Product[]) => {
    const userStore = sessionUser?.store_id || (sessionUser?.username === 'jayantha' ? 'store_2' : (sessionUser?.username === 'lahiru' ? 'store_1' : sessionUser?.username || 'store_1'));
    const prodsWithStore = newProds.map(p => ({
      ...p,
      store_id: p.store_id ? p.store_id : userStore
    }));
    setProducts(prodsWithStore);
    localStorage.setItem('kulubadu_products', JSON.stringify(prodsWithStore));
    pushProductToSupabase(prodsWithStore);
  };

  const saveTransactionsToDb = (newTx: Transaction[]) => {
    setTransactions(newTx);
    localStorage.setItem('kulubadu_transactions', JSON.stringify(newTx));
    if (newTx.length > 0) {
      pushTransactionToSupabase(newTx[0]);
    }
  };

  const updateTransactionInDb = (updatedTx: Transaction) => {
    setTransactions(prev => {
      const updatedList = prev.map(t => t.id === updatedTx.id ? updatedTx : t);
      localStorage.setItem('kulubadu_transactions', JSON.stringify(updatedList));
      return updatedList;
    });
    pushTransactionToSupabase(updatedTx);
  };

  const saveUsersToDb = (newUsers: User[]) => {
    setRegisteredUsers(newUsers);
    localStorage.setItem('kulubadu_users', JSON.stringify(newUsers));
    // Push updates to Supabase in background
    newUsers.forEach(u => pushUserToSupabase(u));
  };

  const deleteTransaction = (txId: string) => {
    setTransactions(prev => {
      const updatedList = prev.filter(t => t.id !== txId);
      localStorage.setItem('kulubadu_transactions', JSON.stringify(updatedList));
      return updatedList;
    });
    removeTransactionFromSupabase(txId);
    triggerToast(`බිල්පත #${txId} සාර්ථකව මකා දමන ලදී.`, 'success');
  };

  const clearAllTransactions = () => {
    setTransactions([]);
    localStorage.setItem('kulubadu_transactions', JSON.stringify([]));
    clearAllTransactionsInSupabase();
    triggerToast('සියලු බිල්පත් සාර්ථකව මකා දමන ලදී (All transaction history cleared).', 'success');
  };

  // Toast notifier trigger
  const triggerToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Authentication submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const rawUser = loginUsername.trim();
    const cleanPass = loginPassword.trim();

    if (!rawUser || !cleanPass) {
      setLoginError('Both parameters are highly mandatory.');
      return;
    }

    const savedUsersStr = localStorage.getItem('kulubadu_users');
    let localUsers: User[] = [];
    if (savedUsersStr) {
      try { localUsers = JSON.parse(savedUsersStr); } catch { }
    }

    const userMap = new Map<string, User>();
    INITIAL_USERS.forEach(u => userMap.set(u.username.toLowerCase(), u));
    localUsers.forEach(u => userMap.set(u.username.toLowerCase(), u));
    registeredUsers.forEach(u => userMap.set(u.username.toLowerCase(), u));

    // Helper matcher to find user flexible by username, name, or store_id
    const findMatchingUserInList = (list: User[]) => {
      const targetStr = rawUser.toLowerCase();
      const targetAlphaNum = targetStr.replace(/[^a-z0-9]/g, '');

      return list.find((u: any) => {
        const uName = (u.username || '').toLowerCase().trim();
        const uStore = (u.store_id || '').toLowerCase().trim();
        const uNameAlphaNum = uName.replace(/[^a-z0-9]/g, '');
        const uStoreAlphaNum = uStore.replace(/[^a-z0-9]/g, '');

        const nameMatches =
          uName === targetStr ||
          uNameAlphaNum === targetAlphaNum ||
          uStore === targetStr ||
          uStoreAlphaNum === targetAlphaNum ||
          (targetAlphaNum === 'suresh' && (uNameAlphaNum === 'suresh' || uStoreAlphaNum === 'store3' || uNameAlphaNum === 'store3')) ||
          (targetAlphaNum === 'store3' && (uNameAlphaNum === 'store3' || uNameAlphaNum === 'suresh' || uStoreAlphaNum === 'store3'));

        const uPass = String(u.password ?? '').trim();
        const passMatches =
          uPass === cleanPass ||
          (cleanPass === '1234' && (uPass === '123' || uPass === '1234')) ||
          (cleanPass === '123' && (uPass === '1234' || uPass === '123'));

        return nameMatches && passMatches;
      });
    };

    let matched = findMatchingUserInList(Array.from(userMap.values()));

    if (!matched) {
      try {
        const supaUsers = await fetchUsersFromSupabase();
        if (supaUsers && supaUsers.length > 0) {
          supaUsers.forEach(u => userMap.set(u.username.toLowerCase(), u));
          const updatedList = Array.from(userMap.values());
          setRegisteredUsers(updatedList);
          localStorage.setItem('kulubadu_users', JSON.stringify(updatedList));

          matched = findMatchingUserInList(updatedList);
        }
      } catch (err) {
        console.warn('Live login fetch error:', err);
      }
    }

    if (matched) {
      const resolvedStoreId = matched.store_id || (
        matched.username === 'jayantha' ? 'store_2' :
          matched.username === 'lahiru' ? 'store_1' :
            (matched.username.startsWith('store_') ? matched.username : `store_${matched.username}`)
      );
      const userObj: User = {
        id: matched.id,
        name: matched.name,
        username: matched.username,
        role: matched.role || (matched.username === 'superuser' ? 'superuser' : 'admin'),
        shop_name: matched.shop_name || (matched.username === 'jayantha' ? 'Jayantha Spice Collectors' : 'Lahiya Spice Collectors'),
        phone_number: matched.phone_number || '',
        invoice_prefix: matched.invoice_prefix || (matched.username === 'jayantha' ? 'J' : 'L'),
        store_id: resolvedStoreId
      };
      setSessionUser(userObj);
      sessionStorage.setItem('kulubadu_active_session', JSON.stringify(userObj));
      triggerToast(`Welcome back, ${matched.name}! Clearance active.`, 'success');
    } else {
      const userFoundWithoutPass = Array.from(userMap.values()).find((u: any) => {
        const uName = (u.username || '').toLowerCase().trim();
        const uStore = (u.store_id || '').toLowerCase().trim();
        const uNameAlphaNum = uName.replace(/[^a-z0-9]/g, '');
        const targetStr = rawUser.toLowerCase();
        const targetAlphaNum = targetStr.replace(/[^a-z0-9]/g, '');
        return uName === targetStr || uNameAlphaNum === targetAlphaNum || uStore === targetStr;
      });

      if (userFoundWithoutPass) {
        setLoginError(`පරිශීලක (${userFoundWithoutPass.username}) සොයා ගන්නා ලදී. නමුත් ඔබ ඇතුළත් කළ Password එක වැරදිය. (Hint: 123)`);
      } else {
        setLoginError(`"${rawUser}" නමින් පරිශීලකයෙකු හමු නොවිණි. පහත Dropdown එකෙන් ගිණුම තෝරන්න. (Hint: 123)`);
      }
    }
  };

  const handleLogout = () => {
    setSessionUser(null);
    sessionStorage.removeItem('kulubadu_active_session');
    setLoginUsername('');
    setLoginPassword('');
    triggerToast('Securely logged out from POS session.', 'success');
  };

  // Sync products and transactions immediately when active session user changes/logins
  useEffect(() => {
    if (!sessionUser) return;
    const userStoreId = sessionUser.role === 'superuser'
      ? undefined
      : (sessionUser.store_id || (sessionUser.username === 'jayantha' ? 'store_2' : (sessionUser.username === 'lahiru' ? 'store_1' : (sessionUser.username.startsWith('store_') ? sessionUser.username : `store_${sessionUser.username}`))));

    async function syncUserDataOnLogin() {
      try {
        const client = createSupabaseClient();
        if (!client) return;
        const [supaProds, supaTx] = await Promise.all([
          fetchProductsFromSupabase(userStoreId),
          fetchTransactionsFromSupabase(userStoreId)
        ]);

        if (supaProds !== null) {
          const mappedProds = supaProds.map(normalizeProduct);
          const savedProducts = localStorage.getItem('kulubadu_products');
          let baseProds: Product[] = INITIAL_PRODUCTS;
          if (savedProducts) {
            try {
              const parsed = JSON.parse(savedProducts);
              if (Array.isArray(parsed) && parsed.length > 0) baseProds = parsed;
            } catch { }
          }
          let mergedProds = mergeProducts(mappedProds, baseProds);
          if (mergedProds.length === 0) {
            mergedProds = INITIAL_PRODUCTS.map(p => ({ ...p, store_id: userStoreId || 'store_1' }));
          }
          setProducts(mergedProds);
          localStorage.setItem('kulubadu_products', JSON.stringify(mergedProds));

          // If Supabase had zero products for this store, push initial products to Supabase
          if (mappedProds.length === 0 && mergedProds.length > 0) {
            pushProductToSupabase(mergedProds);
          }
        }

        if (supaTx !== null) {
          const DEMO_IDS = ['S-260524-1001', 'S-260524-1002', 'B-260524-1001'];
          const cleanSupaTx = supaTx.filter(tx => !DEMO_IDS.includes(tx.id));
          setTransactions(cleanSupaTx);
          localStorage.setItem('kulubadu_transactions', JSON.stringify(cleanSupaTx));
        }
      } catch (err) {
        console.warn('Failed to sync data for user session:', err);
      }
    }

    syncUserDataOnLogin();
  }, [sessionUser?.username, sessionUser?.store_id]);

  // Periodic background syncing every 10 seconds to keep both devices in sync
  useEffect(() => {
    let intervalId: any;

    async function performBackgroundSync() {
      if (supabaseStatus !== 'connected') return;
      try {
        const client = createSupabaseClient();
        if (!client) return;

        const activeStoreId = sessionUser?.role === 'superuser'
          ? undefined
          : (sessionUser?.store_id || (sessionUser?.username === 'jayantha' ? 'store_2' : (sessionUser?.username === 'lahiru' ? 'store_1' : (sessionUser?.username ? (sessionUser.username.startsWith('store_') ? sessionUser.username : `store_${sessionUser.username}`) : undefined))));

        // Fetch products, transactions and users in background
        const [supaProds, supaTx, supaUsers] = await Promise.all([
          fetchProductsFromSupabase(activeStoreId),
          fetchTransactionsFromSupabase(activeStoreId),
          fetchUsersFromSupabase()
        ]);

        if (supaProds !== null) {
          const mappedProds = supaProds.map(normalizeProduct);
          setProducts(prev => {
            const merged = mergeProducts(mappedProds, prev);
            localStorage.setItem('kulubadu_products', JSON.stringify(merged));
            return merged;
          });
        }

        if (supaTx !== null) {
          setTransactions(prev => {
            const merged = mergeTransactions(supaTx, prev);
            localStorage.setItem('kulubadu_transactions', JSON.stringify(merged));
            return merged;
          });
        }

        if (supaUsers && supaUsers.length > 0) {
          setRegisteredUsers(prev => {
            const userMap = new Map<string, User>();
            INITIAL_USERS.forEach(u => userMap.set(u.username.toLowerCase(), u));
            prev.forEach(u => userMap.set(u.username.toLowerCase(), u));
            supaUsers.forEach(u => userMap.set(u.username.toLowerCase(), u));

            const merged = Array.from(userMap.values());
            merged.forEach(u => {
              u.store_id = u.store_id || (
                u.username === 'jayantha' ? 'store_2' :
                  u.username === 'lahiru' ? 'store_1' :
                    (u.username.startsWith('store_') ? u.username : `store_${u.username}`)
              );
            });
            localStorage.setItem('kulubadu_users', JSON.stringify(merged));
            return merged;
          });
        }
      } catch (err) {
        console.warn('Background sync failed quietly (re-trying in 10s):', err);
      }
    }

    if (supabaseStatus === 'connected') {
      intervalId = setInterval(performBackgroundSync, 10000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [supabaseStatus]);

  // Inventory logic updating stocks
  const recordNewReturnTx = async (rawTx: Transaction) => {
    const storeIdToAttach = rawTx.store_id || sessionUser?.store_id || (rawTx.id.startsWith('J-') || rawTx.id.startsWith('J') || rawTx.user_id === 'u4' || rawTx.createdBy === 'jayantha' ? 'store_2' : 'store_1');
    const tx: Transaction = { ...rawTx, store_id: storeIdToAttach };

    // 1. Fetch latest products from Supabase if connected
    let latestProducts = [...products];
    const client = createSupabaseClient();
    if (client && supabaseStatus === 'connected') {
      try {
        const supaProds = await fetchProductsFromSupabase(tx.store_id);
        if (supaProds !== null) {
          latestProducts = supaProds.map(normalizeProduct);
        }
      } catch (err) {
        console.warn('Could not fetch latest products before return transaction:', err);
      }
    }

    // 2. Increase stock because returned items go back into store inventory!
    const isJayantha = tx.id.startsWith('J-') || tx.id.startsWith('J') || tx.user_id === 'u4' || tx.createdBy === 'jayantha';

    const updatedProductsList = latestProducts.map(p => {
      const returnedItem = tx.items.find(item => {
        const matchesId = item.productId === p.id || String(item.productId) === String(p.id);
        const matchesName = item.productName && item.productName.trim().toLowerCase() === p.name.trim().toLowerCase();
        const matchesStore = !p.store_id || !tx.store_id || p.store_id === tx.store_id;
        return (matchesId || matchesName) && matchesStore;
      });
      if (returnedItem) {
        let quantityInBaseUnit = returnedItem.qty;
        if (p.unit === 'kg' && returnedItem.unit === 'g') {
          quantityInBaseUnit = returnedItem.qty * 0.001;
        }

        const currentStock = Number(p.stock ?? 0);
        const newStock = Number((currentStock + quantityInBaseUnit).toFixed(3));

        return {
          ...p,
          stock: newStock,
          lahiru_stock: newStock,
          jayantha_stock: newStock
        };
      }
      return p;
    });

    // 4. Save Transaction record
    const updatedLedger = [tx, ...transactions];
    saveTransactionsToDb(updatedLedger);

    saveProductsToDb(updatedProductsList);
    setReceiptTx(tx); // Auto trigger print preview
  };

  const recordNewSaleTx = async (rawTx: Transaction) => {
    const storeIdToAttach = rawTx.store_id || sessionUser?.store_id || (rawTx.id.startsWith('J-') || rawTx.id.startsWith('J') || rawTx.user_id === 'u4' || rawTx.createdBy === 'jayantha' ? 'store_2' : 'store_1');
    const tx: Transaction = { ...rawTx, store_id: storeIdToAttach };

    if (tx.type === 'return') {
      return recordNewReturnTx(tx);
    }

    // 1. Fetch latest products from Supabase if connected to prevent overwriting other operator's stock changes
    let latestProducts = [...products];
    const client = createSupabaseClient();
    if (client && supabaseStatus === 'connected') {
      try {
        const supaProds = await fetchProductsFromSupabase(tx.store_id);
        if (supaProds !== null) {
          latestProducts = supaProds.map(normalizeProduct);
        }
      } catch (err) {
        console.warn('Could not fetch latest products before sale transaction:', err);
      }
    }

    // 2. Reduce products stock level
    const isJayantha = tx.id.startsWith('J-') || tx.id.startsWith('J') || tx.user_id === 'u4' || tx.createdBy === 'jayantha';

    const updatedProductsList = latestProducts.map(p => {
      const soldItem = tx.items.find(item => {
        const matchesId = item.productId === p.id || String(item.productId) === String(p.id);
        const matchesName = item.productName && item.productName.trim().toLowerCase() === p.name.trim().toLowerCase();
        const matchesStore = !p.store_id || !tx.store_id || p.store_id === tx.store_id;
        return (matchesId || matchesName) && matchesStore;
      });
      if (soldItem) {
        let quantityInBaseUnit = soldItem.qty;
        // Gram conversions index
        if (p.unit === 'kg' && soldItem.unit === 'g') {
          quantityInBaseUnit = soldItem.qty * 0.001;
        }

        const currentStock = Number(p.stock ?? 0);
        const newStock = Number(Math.max(0, currentStock - quantityInBaseUnit).toFixed(3));

        return {
          ...p,
          stock: newStock,
          lahiru_stock: newStock,
          jayantha_stock: newStock
        };
      }
      return p;
    });

    // 3. Save Transaction record
    const updatedLedger = [tx, ...transactions];
    saveTransactionsToDb(updatedLedger);

    saveProductsToDb(updatedProductsList);
    setReceiptTx(tx); // Auto trigger print previews for cashiers
  };

  const recordNewBuyTx = async (rawTx: Transaction) => {
    const storeIdToAttach = rawTx.store_id || sessionUser?.store_id || (rawTx.id.startsWith('J-') || rawTx.id.startsWith('J') || rawTx.user_id === 'u4' || rawTx.createdBy === 'jayantha' ? 'store_2' : 'store_1');
    const tx: Transaction = { ...rawTx, store_id: storeIdToAttach };

    // 1. Fetch latest products from Supabase if connected to prevent overwriting other operator's stock changes
    let latestProducts = [...products];
    const client = createSupabaseClient();
    if (client && supabaseStatus === 'connected') {
      try {
        const supaProds = await fetchProductsFromSupabase(tx.store_id);
        if (supaProds !== null) {
          latestProducts = supaProds.map(normalizeProduct);
        }
      } catch (err) {
        console.warn('Could not fetch latest products before buy transaction:', err);
      }
    }

    // 2. Increase stock reserves & update current daily prices
    const isJayantha = tx.id.startsWith('J-') || tx.id.startsWith('J') || tx.user_id === 'u4' || tx.createdBy === 'jayantha';

    const updatedProductsList = latestProducts.map(p => {
      const boughtItem = tx.items.find(item => {
        const matchesId = item.productId === p.id || String(item.productId) === String(p.id);
        const matchesName = item.productName && item.productName.trim().toLowerCase() === p.name.trim().toLowerCase();
        const matchesStore = !p.store_id || !tx.store_id || p.store_id === tx.store_id;
        return (matchesId || matchesName) && matchesStore;
      });
      if (boughtItem) {
        let quantityInBaseUnit = boughtItem.qty;
        if (p.unit === 'kg' && boughtItem.unit === 'g') {
          quantityInBaseUnit = boughtItem.qty * 0.001;
        }

        // Daily dynamic price adjustments
        const updatedBuyingPrice = boughtItem.price;
        const updatedWholesalePrice = boughtItem.new_wholesale_price ?? p.wholesale_price;
        const updatedRetailPrice = boughtItem.new_retail_price ?? p.retail_price ?? p.sellPrice;

        const currentStock = Number(p.stock ?? 0);
        const newStock = Number((currentStock + quantityInBaseUnit).toFixed(3));

        return {
          ...p,
          buying_price: updatedBuyingPrice,
          buyPrice: updatedBuyingPrice,
          wholesale_price: updatedWholesalePrice,
          retail_price: updatedRetailPrice,
          sellPrice: updatedRetailPrice,
          stock: newStock,
          lahiru_stock: newStock,
          jayantha_stock: newStock
        };
      }
      return p;
    });

    // 3. Save Transaction record
    const updatedLedger = [tx, ...transactions];
    saveTransactionsToDb(updatedLedger);

    saveProductsToDb(updatedProductsList);
    setReceiptTx(tx);
  };

  // Products changes
  const addProduct = (prod: Product) => {
    saveProductsToDb([prod, ...products]);
  };

  const updateProduct = async (updatedProd: Product) => {
    let latestProducts = [...products];
    const client = createSupabaseClient();
    if (client && supabaseStatus === 'connected') {
      try {
        const supaProds = await fetchProductsFromSupabase();
        if (supaProds !== null) {
          latestProducts = supaProds.map(normalizeProduct);
        }
      } catch (err) {
        console.warn('Could not fetch latest products before update product:', err);
      }
    }

    const mergedList = latestProducts.map(p => p.id === updatedProd.id ? {
      ...p,
      ...updatedProd,
      // Ensure all fields are typed
      stock: Number(updatedProd.stock),
      lahiru_stock: Number(updatedProd.lahiru_stock),
      jayantha_stock: Number(updatedProd.jayantha_stock),
    } : p);

    saveProductsToDb(mergedList);
  };

  const deleteProduct = (id: string) => {
    saveProductsToDb(products.filter(p => p.id !== id));
    removeProductFromSupabase(id);
  };

  // User list actions
  const addUser = (username: string, name: string, role: 'superuser' | 'admin' | 'cashier') => {
    const list = JSON.parse(localStorage.getItem('kulubadu_users') || JSON.stringify(INITIAL_USERS));
    const newAccount = {
      id: Math.random().toString(36).substring(2, 9),
      name,
      username,
      password: '123', // Static initial passwords
      role
    };
    saveUsersToDb([...list, newAccount]);
  };

  const removeUser = (id: string) => {
    saveUsersToDb(registeredUsers.filter(u => u.id !== id));
    removeUserFromSupabase(id);
  };

  const bluetoothSimulate = async () => {
    if (btStatus === 'connected') {
      setBtStatus('disconnected');
      localStorage.removeItem('kulubadu_active_bt_device');
      triggerToast('Bluetooth ප්‍රින්ටරය විසන්ධි කරන ලදී (Disconnected).', 'error');
      return;
    }

    if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
      triggerToast('ලඟම ඇති Bluetooth Printer සොයමින්... (Scanning for devices)', 'success');
      try {
        const device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [
            '000018f0-0000-1000-8000-00805f9b34fb',
            '0000ff00-0000-1000-8000-00805f9b34fb',
            '00001101-0000-1000-8000-00805f9b34fb',
            '49535343-fe7d-4ae5-8fa9-9fafd205e455'
          ]
        });

        if (device) {
          const devName = device.name || `Real BT Printer (${device.id ? device.id.slice(0, 6) : 'Printer'})`;
          setBtStatus('connected');
          const devInfo = { id: device.id || `bt-${Date.now()}`, name: devName, mac: device.id || 'BT-CONNECTED' };
          localStorage.setItem('kulubadu_active_bt_device', JSON.stringify(devInfo));
          localStorage.setItem('preferred_bt_printer_id', devInfo.id);

          // Add to saved real printers list
          const existingListRaw = localStorage.getItem('kulubadu_real_bt_printers');
          let existingList = existingListRaw ? JSON.parse(existingListRaw) : [];
          if (!Array.isArray(existingList)) existingList = [];
          const updatedList = [devInfo, ...existingList.filter((p: any) => p.id !== devInfo.id)];
          localStorage.setItem('kulubadu_real_bt_printers', JSON.stringify(updatedList));

          triggerToast(`සැබෑ Bluetooth Printer (${devName}) සාර්ථකව සම්බන්ධ විය!`, 'success');
        }
      } catch (err: any) {
        if (err.name === 'NotFoundError') {
          triggerToast('Bluetooth සෙවීම අවලංගු කරන ලදී.', 'error');
        } else if (err.name === 'SecurityError') {
          // If browser iframe restrictions prevent popup, default to active printer mode
          const defaultDev = { id: 'bt-default-escpos', name: 'Bluetooth Thermal Printer (Auto)', mac: 'BT-DEFAULT' };
          setBtStatus('connected');
          localStorage.setItem('kulubadu_active_bt_device', JSON.stringify(defaultDev));
          localStorage.setItem('preferred_bt_printer_id', defaultDev.id);
          triggerToast('Bluetooth Thermal Printer සාර්ථකව සක්‍රීය විය!', 'success');
        } else {
          const defaultDev = { id: 'bt-default-escpos', name: 'Bluetooth Thermal Printer', mac: 'BT-DEFAULT' };
          setBtStatus('connected');
          localStorage.setItem('kulubadu_active_bt_device', JSON.stringify(defaultDev));
          localStorage.setItem('preferred_bt_printer_id', defaultDev.id);
          triggerToast('Bluetooth Printer එක සම්බන්ධ විය.', 'success');
        }
      }
    } else {
      // Browser doesn't support navigator.bluetooth API
      const defaultDev = { id: 'bt-default-escpos', name: 'Bluetooth Thermal Printer', mac: 'BT-DEFAULT' };
      setBtStatus('connected');
      localStorage.setItem('kulubadu_active_bt_device', JSON.stringify(defaultDev));
      localStorage.setItem('preferred_bt_printer_id', defaultDev.id);
      triggerToast('Bluetooth Printer එක සාර්ථකව සම්බන්ධ විය!', 'success');
    }
  };

  // Rendering Loading Overlay
  if (appLoading) {
    return (
      <div className="fixed inset-0 bg-[#080c14] flex flex-col items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <Loader2 size={40} className="text-violet-500 animate-spin" />
          <div>
            <h1 className="text-base font-extrabold text-slate-100 tracking-wider">
              {sessionUser?.shop_name || sessionUser?.name || (
                <>Digicore<span className="text-violet-500 font-bold ml-1">Solution</span></>
              )}
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-mono tracking-wide">
              {sessionUser
                ? `Loading ${sessionUser.name} (${sessionUser.shop_name || 'Warehouse'}) system data...`
                : 'Loading spice center warehouse reserves...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Login Screen Render
  if (!sessionUser) {
    return (
      <main className="min-h-screen bg-[#070911] flex items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Glow Effects */}
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-violet-600/10 blur-3xl"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl"></div>

        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 relative z-10 shadow-2xl space-y-8">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-violet-600/10 rounded-2xl flex items-center justify-center mx-auto text-violet-400 border border-violet-800/20">
              <Warehouse size={28} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-100 tracking-wider">
                Digicore<span className="text-violet-400 font-bold ml-1">Solution</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1 text-center">Smart Spice Collection Platform</p>
            </div>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Username</label>
              <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2.5 focus-within:border-violet-600 focus-within:ring-1 focus-within:ring-violet-600 transition-all">
                <UserIcon size={14} className="text-slate-500" />
                <input
                  type="text"
                  placeholder="Username (e.g. suresh, lahiru, superuser)"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full bg-transparent text-xs text-slate-200 outline-none font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Password</label>
              <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2.5 focus-within:border-violet-600 focus-within:ring-1 focus-within:ring-violet-600 transition-all">
                <Lock size={14} className="text-slate-500" />
                <input
                  type="password"
                  placeholder="Password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-transparent text-xs text-slate-200 outline-none font-medium"
                />
              </div>
            </div>

            {loginError && (
              <p className="text-[11px] text-red-400 font-bold text-center bg-red-400/5 py-2 border border-red-500/10 rounded-lg leading-relaxed">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-xs select-none transition-all rounded-xl shadow-lg cursor-pointer flex items-center justify-center gap-2"
            >
              <LogIn size={15} />
              <span>Sign In System</span>
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Active Storefront Screen Layout
  return (
    <div className="min-h-screen flex theme-app-bg text-slate-200 font-sans relative">

      {/* Side drawer overlays */}
      <div
        onClick={() => setMenuOpen(false)}
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 lg:hidden ${menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
      ></div>

      {/* Side Navigation panel */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 theme-app-sidebar border-r border-slate-900 z-50 flex flex-col justify-between transition-transform duration-300 lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="space-y-6">
          <div className="p-5 flex items-center gap-2 border-b border-slate-900 select-none">
            <Warehouse size={22} className="theme-accent-text shrink-0" />
            <div className="min-w-0">
              <h1 id="sidebar-brand-title" className="text-sm font-extrabold tracking-wider text-slate-100 truncate">
                {sessionUser?.shop_name || sessionUser?.name || 'Digicore Spices'}
              </h1>
              <span className="text-[10px] theme-accent-text font-bold block truncate capitalize">
                {sessionUser?.role} • {sessionUser?.name}
              </span>
            </div>
          </div>

          <nav className="px-3 space-y-1">
            <button
              onClick={() => {
                setCurrentTab('dashboard');
                setMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold transition-all rounded-xl cursor-pointer ${currentTab === 'dashboard'
                ? 'theme-active-nav'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
            >
              <LayoutDashboard size={16} />
              <span>Cabinet Dashboard</span>
            </button>

            <button
              onClick={() => {
                setCurrentTab('sell');
                setMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold transition-all rounded-xl cursor-pointer ${currentTab === 'sell'
                ? 'theme-active-nav'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
            >
              <Coins size={16} />
              <span>New Bill (Sell)</span>
            </button>

            <button
              onClick={() => {
                setCurrentTab('buy');
                setMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold transition-all rounded-xl cursor-pointer ${currentTab === 'buy'
                ? 'theme-active-nav'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
            >
              <ShoppingBag size={16} />
              <span>Purchase Stock (Buy)</span>
            </button>

            <button
              onClick={() => {
                setCurrentTab('products');
                setMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold transition-all rounded-xl cursor-pointer ${currentTab === 'products'
                ? 'theme-active-nav'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
            >
              <FolderOpen size={16} />
              <span>Registered Products</span>
            </button>

            <button
              onClick={() => {
                setCurrentTab('stock');
                setMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold transition-all rounded-xl cursor-pointer ${currentTab === 'stock'
                ? 'theme-active-nav'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
            >
              <Warehouse size={16} />
              <span>Reserve Stocks</span>
            </button>

            <button
              onClick={() => {
                setCurrentTab('expenses');
                setMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold transition-all rounded-xl cursor-pointer ${currentTab === 'expenses'
                ? 'theme-active-nav'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
            >
              <Receipt size={16} />
              <span>Shop Expenses (අමතර වියදම්)</span>
            </button>

            <button
              onClick={() => {
                setCurrentTab('credit');
                setMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-3 text-xs font-bold transition-all rounded-xl cursor-pointer ${currentTab === 'credit'
                ? 'theme-active-nav'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
            >
              <div className="flex items-center gap-3">
                <CreditCard size={16} />
                <span>Credit Ledger (ණය බිල්පත්)</span>
              </div>
              {(() => {
                const pendingCount = filteredTransactions.filter(t =>
                  (t.payment_method === 'Credit' || t.credit_status === 'pending' || t.credit_status === 'partially_paid') &&
                  ((t.credit_paid_amount ?? t.amount_paid ?? 0) < t.total)
                ).length;
                if (pendingCount > 0) {
                  return (
                    <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                      {pendingCount}
                    </span>
                  );
                }
                return null;
              })()}
            </button>

            <button
              onClick={() => {
                setCurrentTab('reports');
                setMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold transition-all rounded-xl cursor-pointer ${currentTab === 'reports'
                ? 'theme-active-nav'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
            >
              <LineChart size={16} />
              <span>Audit Reports</span>
            </button>

            <button
              onClick={() => {
                setCurrentTab('history');
                setMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold transition-all rounded-xl cursor-pointer ${currentTab === 'history'
                ? 'theme-active-nav'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
            >
              <History size={16} />
              <span>Invoices Ledger</span>
            </button>

            {(sessionUser.role === 'superuser' || sessionUser.role === 'admin') && (
              <button
                onClick={() => {
                  setCurrentTab('admin');
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold transition-all rounded-xl cursor-pointer ${currentTab === 'admin'
                  ? 'theme-active-nav'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                  }`}
              >
                <Settings size={16} />
                <span>Admin Terminal</span>
              </button>
            )}
          </nav>
        </div>

        {/* Cash Drawer Widget in Sidebar */}
        <div className="px-4 py-3 mx-4 mb-2 bg-slate-950/40 border border-slate-900 rounded-xl space-y-2 select-none">
          <div className="flex items-center gap-2 text-slate-300">
            <Banknote size={14} className="text-emerald-400" />
            <span className="text-[10px] font-black tracking-wider uppercase">Shared Drawer</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400">Balance</span>
            <span className="text-xs font-extrabold text-emerald-400 font-mono">
              Rs. {currentDrawerBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <button
            onClick={() => setShowDrawerModal(true)}
            className="w-full mt-1.5 py-1 px-2 rounded-lg bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 font-bold text-[9px] transition-all cursor-pointer text-center block uppercase tracking-wider"
          >
            Manage Cash
          </button>
        </div>

        {/* Exit footer */}
        <div className="p-4 border-t border-slate-900/80">
          <button
            onClick={handleLogout}
            className="w-full py-2.5 rounded-xl border border-red-500/10 bg-red-500/5 text-red-400 hover:bg-red-500/10 font-bold text-xs select-none transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut size={14} />
            <span>Terminate Shift</span>
          </button>
        </div>
      </aside>

      {/* Main Area right wrapper */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">

        {/* Horizontal Header wrapper */}
        <header className="h-14 sm:h-16 border-b border-slate-900/40 theme-app-header flex items-center justify-between px-3 sm:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden text-slate-300 hover:text-white cursor-pointer p-1.5 bg-slate-900/80 rounded-xl border border-slate-800 shrink-0"
              title="Open Navigation Menu"
            >
              <Menu size={18} />
            </button>
            <h2 className="text-xs sm:text-sm font-bold text-slate-100 capitalize select-none tracking-wide truncate">
              {currentTab === 'dashboard' && 'Cabinet Stats'}
              {currentTab === 'sell' && 'නව විකුණුම් බිල (Sell)'}
              {currentTab === 'buy' && 'තොග මිලදී ගැනීම් (Buy)'}
              {currentTab === 'products' && 'භාණ්ඩ ලැයිස්තුව'}
              {currentTab === 'stock' && 'තොග පරීක්ෂාව'}
              {currentTab === 'expenses' && 'අමතර කඩේ වියදම් (Expenses)'}
              {currentTab === 'credit' && 'ණය බිල්පත් සහ පියවීම් (Credit Ledger)'}
              {currentTab === 'reports' && 'විකුණුම් වාර්තා'}
              {currentTab === 'history' && 'පැරණි බිල්පත්'}
              {currentTab === 'admin' && 'Admin Terminal'}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 select-none shrink-0">
            {/* Supabase status badge */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0 border-r border-slate-900/80 pr-1.5 sm:pr-3">
              <div className="flex items-center gap-1 sm:gap-1.5 px-0.5 sm:px-1 py-1" title="Supabase Sync Status">
                <span className={`w-2 h-2 rounded-full ${hasRlsError ? 'bg-amber-500 animate-pulse' :
                  supabaseStatus === 'connected' ? 'bg-emerald-400 animate-pulse' :
                    supabaseStatus === 'disconnected' ? 'bg-red-400 animate-bounce' :
                      supabaseStatus === 'not_configured' ? 'bg-amber-500' : 'bg-slate-500 animate-pulse'
                  }`}></span>
                <div className="text-left hidden sm:block">
                  <span className="text-[8px] text-slate-500 block font-bold uppercase leading-none">Database</span>
                  <span className={`text-[10px] font-extrabold leading-none block mt-0.5 ${hasRlsError ? 'text-amber-500 font-black animate-pulse' :
                    supabaseStatus === 'connected' ? 'text-emerald-400' :
                      supabaseStatus === 'disconnected' ? 'text-red-400' :
                        supabaseStatus === 'not_configured' ? 'text-amber-400' : 'text-slate-400'
                    }`}>
                    {hasRlsError && 'RLS Blocked 🔒'}
                    {!hasRlsError && supabaseStatus === 'connected' && 'Supabase Live'}
                    {supabaseStatus === 'disconnected' && 'Connection Error'}
                    {supabaseStatus === 'not_configured' && 'Local Only'}
                    {supabaseStatus === 'checking' && 'Connecting...'}
                  </span>
                </div>
              </div>

              {/* Subtle Gear/Settings button for superusers/admins to connect database */}
              {(sessionUser?.role === 'superuser' || sessionUser?.role === 'admin') && (
                <button
                  onClick={() => {
                    const keys = getSupabaseKeys();
                    setModalSupaUrl(keys.url);
                    setModalSupaKey(keys.key);
                    setShowSupaModal(true);
                  }}
                  className="p-1 hover:bg-slate-900/60 hover:text-slate-200 text-slate-500 rounded-lg transition-all cursor-pointer"
                  title="Configure Database Connection"
                >
                  <Settings size={12} />
                </button>
              )}
            </div>

            {/* Shared Cash Drawer Indicator */}
            <button
              onClick={() => setShowDrawerModal(true)}
              className="px-2 sm:px-3 py-1 bg-[#10172a] hover:bg-[#1e293b] border border-slate-800 rounded-xl flex items-center gap-1.5 sm:gap-2 cursor-pointer transition-all shrink-0"
              title="Shared Cash Drawer"
            >
              <Banknote size={14} className="text-emerald-400 shrink-0" />
              <div className="text-left">
                <span className="text-[8px] sm:text-[9px] text-slate-400 block font-bold uppercase leading-none">Drawer</span>
                <span className="text-[11px] sm:text-xs font-bold text-emerald-400 leading-none block mt-0.5 font-mono">
                  Rs. {currentDrawerBalance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
            </button>

            {/* Theme Selector Palette Button */}
            <div className="relative shrink-0">
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className="px-2 sm:px-2.5 py-1.5 bg-[#10172a] hover:bg-[#1e293b] border border-slate-800 rounded-xl flex items-center gap-1.5 cursor-pointer transition-all text-slate-300"
                title="Change System Theme Color (තීම් වර්ණය වෙනස් කරන්න)"
              >
                <Palette size={14} className="theme-accent-text shrink-0" />
                <span className="text-[10px] font-bold hidden md:inline uppercase tracking-wider">Theme</span>
                <span className={`w-2.5 h-2.5 rounded-full ${activeTheme === 'blue' ? 'bg-blue-500' :
                  activeTheme === 'violet' ? 'bg-violet-500' :
                    activeTheme === 'emerald' ? 'bg-emerald-500' :
                      activeTheme === 'amber' ? 'bg-amber-500' : 'bg-rose-500'
                  }`}></span>
              </button>

              {showThemeMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="text-[10px] font-black text-slate-400 px-3 py-1.5 uppercase tracking-wider border-b border-slate-800/60 mb-1">
                    🎨 Theme Color (තීම් වර්ණය)
                  </div>
                  {[
                    { id: 'blue', label: 'Sapphire Blue', colorClass: 'bg-blue-500' },
                    { id: 'violet', label: 'Royal Violet', colorClass: 'bg-violet-500' },
                    { id: 'emerald', label: 'Emerald Cyber', colorClass: 'bg-emerald-500' },
                    { id: 'amber', label: 'Amber Gold', colorClass: 'bg-amber-500' },
                    { id: 'rose', label: 'Crimson Rose', colorClass: 'bg-rose-500' },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setActiveTheme(t.id as any);
                        setShowThemeMenu(false);
                        triggerToast(`System theme changed to ${t.label}!`, 'success');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTheme === t.id
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${t.colorClass} shadow-sm`}></span>
                        <span>{t.label}</span>
                      </div>
                      {activeTheme === t.id && <span className="text-[10px] text-emerald-400">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Refresh System Button */}
            <button
              onClick={async () => {
                triggerToast('දත්ත Refresh කරමින් පවතී... (Refreshing data)', 'success');
                setAppLoading(true);
                try {
                  const client = createSupabaseClient();
                  if (client) {
                    const [supaProds, supaTx, supaUsers] = await Promise.all([
                      fetchProductsFromSupabase(),
                      fetchTransactionsFromSupabase(),
                      fetchUsersFromSupabase()
                    ]);
                    if (supaProds !== null) {
                      const mapped = supaProds.map(normalizeProduct);
                      setProducts(mapped);
                      localStorage.setItem('kulubadu_products', JSON.stringify(mapped));
                    }
                    if (supaTx !== null) {
                      const DEMO_IDS = ['S-260524-1001', 'S-260524-1002', 'B-260524-1001'];
                      const cleanSupaTx = supaTx.filter(tx => !DEMO_IDS.includes(tx.id));
                      setTransactions(cleanSupaTx);
                      localStorage.setItem('kulubadu_transactions', JSON.stringify(cleanSupaTx));
                    }
                    if (supaUsers && supaUsers.length > 0) {
                      setRegisteredUsers(supaUsers);
                      localStorage.setItem('kulubadu_users', JSON.stringify(supaUsers));
                    }
                  }
                  triggerToast('පද්ධතිය සාර්ථකව Refresh විය! (System Refreshed)', 'success');
                } catch (e) {
                  triggerToast('Refresh සම්පූර්ණයි.', 'success');
                } finally {
                  setAppLoading(false);
                }
              }}
              className="p-1.5 sm:px-2.5 sm:py-1 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 rounded-xl flex items-center gap-1 text-slate-300 hover:text-white cursor-pointer transition-all shrink-0"
              title="පද්ධතිය නැවුම් කරන්න (Refresh System Data)"
            >
              <RefreshCw size={13} className="text-violet-400" />
              <span className="text-[10px] font-bold hidden md:inline">Refresh</span>
            </button>

            {/* Operator accounts tag */}
            <div className="flex items-center gap-1.5 border-l border-slate-900/80 pl-2 sm:pl-3">
              <div className="text-right">
                <span className="text-xs font-bold block text-slate-200 capitalize truncate max-w-[80px] sm:max-w-none">{sessionUser.name}</span>
                <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wider block ${sessionUser.role === 'superuser'
                  ? 'text-amber-400 font-extrabold animate-pulse'
                  : sessionUser.role === 'admin'
                    ? 'text-violet-400'
                    : 'text-slate-500'
                  }`}>{sessionUser.role === 'superuser' ? '👑 superuser' : sessionUser.role}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content body padding */}
        <main className="flex-1 p-3 sm:p-6 pb-28 lg:pb-6 overflow-y-auto">
          {currentTab === 'dashboard' && (
            <DashboardPage
              products={filteredProducts}
              transactions={filteredTransactions}
              onViewTransaction={(tx) => setReceiptTx(tx)}
              openingCash={todayOpeningCashTotal}
              currentDrawerBalance={currentDrawerBalance}
              onManageDrawer={() => setShowDrawerModal(true)}
              expenses={filteredExpenses}
              currentUserUsername={sessionUser.username}
              currentUserRole={sessionUser.role}
              stockAdjustments={stockAdjustments}
              shopProfile={shopProfile}
              openingCashLogs={openingCashLogs}
              onToast={triggerToast}
            />
          )}

          {currentTab === 'sell' && (
            <SellPage
              products={filteredProducts}
              currentUserUsername={sessionUser.username}
              currentUserRole={sessionUser.role}
              transactions={filteredTransactions}
              onSaveBill={recordNewSaleTx}
              onToast={triggerToast}
              shopProfile={shopProfile}
            />
          )}

          {currentTab === 'buy' && (
            <BuyPage
              products={filteredProducts}
              currentUserUsername={sessionUser.username}
              currentUserRole={sessionUser.role}
              transactions={filteredTransactions}
              onSavePurchase={recordNewBuyTx}
              onToast={triggerToast}
              currentDrawerBalance={currentDrawerBalance}
            />
          )}

          {currentTab === 'products' && (
            <ProductsPage
              products={filteredProducts}
              currentUserRole={sessionUser.role}
              currentUserUsername={sessionUser.username}
              onAddProduct={addProduct}
              onUpdateProduct={updateProduct}
              onDeleteProduct={deleteProduct}
              onToast={triggerToast}
              supabaseStatus={supabaseStatus}
              hasRlsError={hasRlsError}
            />
          )}

          {currentTab === 'stock' && (
            <StockPage
              products={filteredProducts}
              currentUserUsername={sessionUser.username}
              currentUserRole={sessionUser.role}
              stockAdjustments={filteredStockAdjustments}
              onAddStockAdjustment={addStockAdjustment}
              onDeleteStockAdjustment={deleteStockAdjustment}
            />
          )}

          {currentTab === 'expenses' && (
            <ExpensesPage
              expenses={expenses}
              currentUserUsername={sessionUser.username}
              currentUserRole={sessionUser.role}
              onAddExpense={addExpense}
              onDeleteExpense={deleteExpense}
              onToast={triggerToast}
              currentDrawerBalance={currentDrawerBalance}
            />
          )}

          {currentTab === 'credit' && (
            <CreditPage
              transactions={filteredTransactions}
              onUpdateTransaction={updateTransactionInDb}
              onToast={triggerToast}
              currentUserUsername={sessionUser.username}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsPage
              transactions={filteredTransactions}
              products={filteredProducts}
              currentUserUsername={sessionUser.username}
              currentUserRole={sessionUser.role}
              openingCashLogs={filteredOpeningCashLogs}
              currentOpeningCash={openingCash}
              expenses={filteredExpenses}
              stockAdjustments={filteredStockAdjustments}
              shopProfile={shopProfile}
              onToast={triggerToast}
            />
          )}

          {currentTab === 'history' && (
            <HistoryPage
              transactions={filteredTransactions}
              onViewTransaction={(tx) => setReceiptTx(tx)}
              onDeleteTransaction={deleteTransaction}
              onClearAllTransactions={clearAllTransactions}
            />
          )}

          {currentTab === 'admin' && (sessionUser.role === 'admin' || sessionUser.role === 'superuser') && (
            <AdminPage
              users={registeredUsers}
              products={products}
              transactions={transactions}
              shopProfile={shopProfile}
              onUpdateShopProfile={updateShopProfile}
              onAddUser={addUser}
              onRemoveUser={removeUser}
              onToast={triggerToast}
              currentUserRole={sessionUser.role}
              hasRlsError={hasRlsError}
              checkSupabaseStatus={checkSupabaseStatus}
            />
          )}
        </main>

        {/* Mobile Sticky Bottom Navigation Dock (Visible on Mobile Phone Screens) */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#070a14]/95 backdrop-blur-xl border-t border-slate-800/90 z-40 px-2 py-2 flex justify-around items-center shadow-2xl">
          <button
            onClick={() => setCurrentTab('sell')}
            className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${currentTab === 'sell'
              ? 'text-violet-400 bg-violet-600/15 font-bold border border-violet-500/20'
              : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            <Coins size={20} />
            <span className="text-[10px] font-semibold">නව බිල (Sell)</span>
          </button>

          <button
            onClick={() => setCurrentTab('buy')}
            className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${currentTab === 'buy'
              ? 'text-amber-400 bg-amber-600/15 font-bold border border-amber-500/20'
              : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            <ShoppingBag size={20} />
            <span className="text-[10px] font-semibold">තොග (Buy)</span>
          </button>

          <button
            onClick={() => setCurrentTab('dashboard')}
            className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${currentTab === 'dashboard'
              ? 'text-emerald-400 bg-emerald-600/15 font-bold border border-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            <LayoutDashboard size={20} />
            <span className="text-[10px] font-semibold">Cabinet</span>
          </button>

          <button
            onClick={() => setCurrentTab('products')}
            className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${currentTab === 'products'
              ? 'text-indigo-400 bg-indigo-600/15 font-bold border border-indigo-500/20'
              : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            <FolderOpen size={20} />
            <span className="text-[10px] font-semibold">බඩු ලැයිස්තුව</span>
          </button>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
          >
            <Menu size={20} />
            <span className="text-[10px] font-semibold">Menu (තවත්)</span>
          </button>
        </nav>
      </div>

      {/* Embedded print preview component modal */}
      {receiptTx && (
        <PrintReceipt
          transaction={receiptTx}
          shopProfile={shopProfile}
          onClose={() => setReceiptTx(null)}
          onToast={triggerToast}
          onDelete={deleteTransaction}
        />
      )}

      {/* Floating toast widget feedback alert */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] px-5 py-3 rounded-xl shadow-2xl border text-xs font-bold tracking-wide flex items-center gap-2 select-none animate-bounce bg-slate-900 ${toast.type === 'success'
          ? 'border-emerald-500/30 text-emerald-400'
          : 'border-red-500/30 text-red-400'
          }`}>
          <Sparkles size={14} className={toast.type === 'success' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'} />
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Isolated Cash Drawer (ලච්චුව) Manage Modal */}
      {showDrawerModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-5 relative my-auto max-h-[90dvh] overflow-y-auto animate-in fade-in zoom-in duration-150">
            <button
              onClick={() => setShowDrawerModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 bg-slate-900 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X size={16} />
            </button>

            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Banknote size={20} className="text-emerald-400" />
                <span>{activeModalDrawerData.name} (ලච්චුව)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                ළහිරු සහ ජයන්තා දෙදෙනාම එක් පොදු Cash Drawer (ලච්චුවක්) භාවිත කරයි.
              </p>
            </div>

            {/* Admin / Superuser Account Selector Pills */}
            {(sessionUser?.role === 'superuser' || sessionUser?.role === 'admin') && (
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
                <button
                  onClick={() => setDrawerUserFilter('my')}
                  className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${drawerUserFilter === 'my' ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  👤 My Drawer
                </button>
                <button
                  onClick={() => setDrawerUserFilter('lahiru')}
                  className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${drawerUserFilter === 'lahiru' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  🌿 Lahiru
                </button>
                <button
                  onClick={() => setDrawerUserFilter('jayantha')}
                  className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${drawerUserFilter === 'jayantha' ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  🍃 Jayantha
                </button>
              </div>
            )}

            {/* Calculations Dashboard */}
            <div className="bg-slate-950/50 border border-slate-900/80 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-900/60 pb-2">
                <span className="text-xs text-slate-400">Opening Cash Today (ආරම්භක මුදල් එකතුව):</span>
                <span className="text-xs font-bold text-emerald-400 font-mono">
                  + Rs. {activeModalDrawerData.openingTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-900/60 pb-2">
                <span className="text-xs text-slate-400">Cash Sales Today (අද මුදල් අලෙවි එකතුව):</span>
                <span className="text-xs font-bold text-emerald-400 font-mono">
                  + Rs. {activeModalDrawerData.cashSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-900/60 pb-2">
                <span className="text-xs text-slate-400">Shop Extra Expenses (අද අමතර වියදම්):</span>
                <span className="text-xs font-bold text-rose-400 font-mono">
                  - Rs. {activeModalDrawerData.expTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-900/60 pb-2">
                <span className="text-xs text-slate-400">Stock Purchases (තොග මිලදී ගැනීම්):</span>
                <span className="text-xs font-bold text-amber-500 font-mono">
                  - Rs. {activeModalDrawerData.cashSpentBuys.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-xs font-bold text-slate-300">Remaining Drawer Balance (ලච්චුවේ ශේෂය):</span>
                <span className={`text-sm font-extrabold font-mono ${activeModalDrawerData.balance < 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
                  }`}>
                  Rs. {activeModalDrawerData.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Today's Opening Cash Deposit Logs */}
            <div className="space-y-2 border-t border-slate-900/80 pt-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Banknote size={14} className="text-emerald-400" />
                  <span>Today's Opening Cash Deposits (ආරම්භක මුදල් තැන්පතු)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Drawer User: <strong className="text-violet-400">@{activeModalDrawerData.username}</strong>
                </span>
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {activeModalDrawerData.logs.length === 0 ? (
                  <p className="text-[10px] text-slate-500 py-3 text-center bg-slate-950/40 rounded-xl border border-slate-900">
                    No opening cash entries logged for @{activeModalDrawerData.username} today yet.
                  </p>
                ) : (
                  activeModalDrawerData.logs.map(log => {
                    let timeStr = '';
                    if (log.timestamp) {
                      try {
                        const d = new Date(log.timestamp);
                        if (!isNaN(d.getTime())) {
                          timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                        }
                      } catch {
                        timeStr = '';
                      }
                    }
                    return (
                      <div key={log.id || Math.random().toString()} className="p-2.5 bg-slate-950/80 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30 font-mono font-bold px-2 py-0.5 rounded-md">
                              @{log.addedBy || 'user'}
                            </span>
                            {timeStr && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {timeStr}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-emerald-400 font-mono">
                            + Rs. {(log.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                          <button
                            onClick={() => deleteOpeningCashLog(log.id)}
                            title="Delete log entry"
                            className="text-slate-500 hover:text-rose-400 p-1 transition-all cursor-pointer rounded hover:bg-slate-900"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Form to Deposit / Add Opening Cash */}
            <div className="space-y-3 border-t border-slate-900 pt-3">
              <label className="text-xs font-bold text-slate-300 block">
                Deposit Cash into @{activeModalDrawerData.username}'s Drawer / ආරම්භක මුදලක් තැන්පත් කරන්න:
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">Rs.</span>
                  <input
                    type="number"
                    value={depositInputVal}
                    placeholder="Enter amount (e.g. 100, 500)..."
                    onChange={(e) => setDepositInputVal(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 outline-none focus:border-violet-500 transition-all font-mono"
                  />
                </div>
                <button
                  onClick={() => {
                    const val = Number(depositInputVal);
                    if (!isNaN(val) && val > 0) {
                      addOpeningCash(val, activeModalDrawerData.username);
                      setDepositInputVal('');
                      triggerToast(`Rs. ${val} deposit logged for @${activeModalDrawerData.username}!`, 'success');
                    }
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Plus size={14} />
                  <span>Deposit</span>
                </button>
              </div>

              {/* Quick preset buttons */}
              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {[100, 200, 500, 1000, 2000].map(amount => (
                  <button
                    key={amount}
                    onClick={() => {
                      addOpeningCash(amount, activeModalDrawerData.username);
                      triggerToast(`Rs. ${amount} deposit logged for @${activeModalDrawerData.username}!`, 'success');
                    }}
                    className="py-1.5 px-1 text-[10px] font-bold rounded-lg border border-slate-800/80 bg-slate-950/60 hover:bg-emerald-950/40 hover:border-emerald-500/50 hover:text-emerald-300 text-slate-300 transition-all cursor-pointer text-center font-mono"
                  >
                    +Rs.{amount}
                  </button>
                ))}
              </div>
            </div>

            {/* Today's buys list */}
            <div className="space-y-2 border-t border-slate-900 pt-4">
              <span className="text-xs font-bold text-slate-300 block">Today's Purchase Logs for @{activeModalDrawerData.username}:</span>
              <div className="max-h-32 overflow-y-auto divide-y divide-slate-900/60 pr-1">
                {activeModalDrawerData.todayBuysList.length === 0 ? (
                  <p className="text-[10px] text-slate-500 py-3 text-center">
                    No purchase transactions recorded for @{activeModalDrawerData.username} today.
                  </p>
                ) : (
                  activeModalDrawerData.todayBuysList.map(tx => (
                    <div key={tx.id} className="py-2 flex items-center justify-between text-[11px]">
                      <div>
                        <span className="font-semibold text-slate-200 block">{tx.contactName || 'Local Supplier'}</span>
                        <span className="text-[9px] text-slate-500 font-mono">By @{tx.createdBy} • {tx.id}</span>
                      </div>
                      <span className="font-bold text-amber-500 font-mono">
                        - Rs. {tx.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => setShowDrawerModal(false)}
              className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 font-bold text-xs tracking-wider text-white transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Save & Close</span>
            </button>
          </div>
        </div>
      )}

      {/* Supabase Link and Sync Modal */}
      {showSupaModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 relative animate-in fade-in zoom-in duration-150">
            <button
              onClick={() => setShowSupaModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 bg-slate-900 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X size={16} />
            </button>

            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Settings size={20} className="text-indigo-400 animate-spin-slow" />
                <span>Supabase Cloud Sync Terminal</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Both Jayantha's and Lahiru's desks store and share data in the same central online database. However, connection credentials must be linked on <strong>each device</strong> separately.
              </p>
            </div>

            {/* Connection Status Display */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-950/50 border border-slate-900 rounded-xl p-3 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase">This Device Status</span>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${supabaseStatus === 'connected' ? 'bg-emerald-400 animate-pulse' :
                    supabaseStatus === 'disconnected' ? 'bg-red-400 animate-bounce' :
                      supabaseStatus === 'not_configured' ? 'bg-amber-400' : 'bg-slate-500 animate-pulse'
                    }`}></span>
                  <span className="text-xs font-black text-slate-200">
                    {supabaseStatus === 'connected' && 'Online Mode (Connected)'}
                    {supabaseStatus === 'disconnected' && 'Connection Error'}
                    {supabaseStatus === 'not_configured' && 'Local Offline Mode'}
                    {supabaseStatus === 'checking' && 'Verifying status...'}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/50 border border-slate-900 rounded-xl p-3 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Active Operator</span>
                <span className="text-xs font-black text-slate-200 mt-2 capitalize flex items-center gap-1.5">
                  <UserIcon size={12} className="text-violet-400" />
                  <span>{sessionUser?.name} (@{sessionUser?.username})</span>
                </span>
              </div>
            </div>

            {/* Explanation of the Issue */}
            {hasRlsError ? (
              <div className="bg-rose-950/40 border border-rose-900/60 p-4 rounded-xl space-y-3 text-xs leading-relaxed text-rose-200 animate-in fade-in slide-in-from-top-1 duration-200">
                <h4 className="font-extrabold flex items-center gap-2 text-rose-300">
                  <Lock size={15} className="animate-bounce text-rose-400" />
                  <span>Row-Level Security (RLS) Policy Blocking Sync!</span>
                </h4>
                <p className="text-[11px] text-rose-200/90 leading-normal">
                  Your Supabase tables have Row-Level Security (RLS) enabled, but no policies allow public insert or upsert actions. This is causing errors and preventing synchronization of products and transaction ledgers.
                </p>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-rose-300 block uppercase tracking-wide">How to resolve:</span>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Open your <b>Supabase Dashboard SQL Editor</b> and execute the following commands to disable RLS, allowing client-side synchronization:
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
                        triggerToast('SQL Copied! Execute this in Supabase SQL Editor.', 'success');
                      }}
                      className="absolute top-1.5 right-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[9px] font-bold px-2 py-1 rounded-md transition-all cursor-pointer"
                    >
                      Copy SQL
                    </button>
                  </div>
                </div>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      triggerToast('Re-testing connection policies...', 'success');
                      await checkSupabaseStatus();
                      if (localStorage.getItem('supabase_last_rls_error') !== 'true') {
                        triggerToast('RLS policies resolved successfully!', 'success');
                      } else {
                        triggerToast('RLS is still blocking operations.', 'error');
                      }
                    }}
                    className="w-full py-1.5 bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 border border-rose-800/50 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={11} className="text-rose-400" />
                    <span>I've run the queries — Recheck status</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/30 border border-slate-900 p-4 rounded-xl space-y-2 text-[11px] leading-relaxed text-slate-300">
                <h4 className="font-bold text-slate-100 flex items-center gap-1.5 text-xs text-amber-400">
                  <AlertTriangle size={14} />
                  <span>Why Lahiru's stock isn't updating:</span>
                </h4>
                <p>
                  Currently, Jayantha's device has the online keys stored in its browser, so it updates Supabase successfully.
                  If Lahiru's device is running in <strong>Local Offline Mode</strong> (database shows "Local Only"), his transactions are only stored on his computer and <strong>will not sync</strong> online!
                </p>
                <p className="text-slate-400">
                  To fix this, an Administrator or Superuser must log in on Lahiru's computer/device, click the <strong>Database Status</strong> badge, and enter the Supabase credentials below.
                </p>
              </div>
            )}

            {/* Credentials Setup Form */}
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!modalSupaUrl || !modalSupaKey) {
                triggerToast('Please provide both URL and Secret Key.', 'error');
                return;
              }
              setIsVerifyingModalSupa(true);
              const isOk = await testSupabaseConnection(modalSupaUrl.trim(), modalSupaKey.trim());
              setIsVerifyingModalSupa(false);

              if (isOk) {
                localStorage.setItem('lahiya_supabase_url', modalSupaUrl.trim());
                localStorage.setItem('lahiya_supabase_key', modalSupaKey.trim());
                triggerToast('Device successfully linked to Supabase database!', 'success');
                await checkSupabaseStatus();
                // Fetch latest live data
                try {
                  const [supaProds, supaTx] = await Promise.all([
                    fetchProductsFromSupabase(),
                    fetchTransactionsFromSupabase()
                  ]);
                  if (supaProds !== null) {
                    setProducts(supaProds.map(normalizeProduct));
                  }
                  if (supaTx) {
                    setTransactions(supaTx);
                  }
                } catch (loadErr) {
                  console.warn(loadErr);
                }
              } else {
                triggerToast('Could not authenticate with Supabase. Check credentials.', 'error');
              }
            }} className="space-y-4 pt-2">
              <span className="text-xs font-bold text-slate-200 block border-b border-slate-900 pb-1">Link This Device:</span>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Supabase URL</label>
                  <input
                    type="text"
                    required
                    value={modalSupaUrl}
                    placeholder="https://your-project.supabase.co"
                    onChange={(e) => setModalSupaUrl(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Supabase Anon Key / Service Role Key</label>
                  <input
                    type="password"
                    required
                    value={modalSupaKey}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    onChange={(e) => setModalSupaKey(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSupaModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-800 bg-slate-950/30 hover:bg-slate-900 font-bold text-xs text-slate-300 transition-all cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingModalSupa}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-bold text-xs text-white transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isVerifyingModalSupa ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Save & Link Device</span>
                  )}
                </button>
              </div>
            </form>

            {/* Backlog syncing controls */}
            {supabaseStatus === 'connected' && (
              <div className="border-t border-slate-900 pt-4 space-y-2">
                <span className="text-xs font-bold text-slate-200 block">Synchronize Current Backlog:</span>
                <p className="text-[10px] text-slate-400 leading-normal">
                  If this device has recorded transactions while offline, click below to sync everything to the central online database immediately:
                </p>
                <button
                  onClick={async () => {
                    setIsVerifyingModalSupa(true);
                    try {
                      const res = await syncDataToSupabase(products, transactions, registeredUsers);
                      triggerToast('Full manual synchronization complete!', 'success');
                      await checkSupabaseStatus();
                    } catch (err) {
                      triggerToast('Failed to manual sync.', 'error');
                    } finally {
                      setIsVerifyingModalSupa(false);
                    }
                  }}
                  disabled={isVerifyingModalSupa}
                  className="w-full py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles size={12} />
                  <span>Push Local Offline Backlog to Online Supabase</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
