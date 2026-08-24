import { useState, useEffect, useMemo } from 'react';
import { Product, Transaction, Expense, StockAdjustment, ShopProfile, OpeningCashLog } from '../types';
import { formatCurrency, formatDateString, getLocalTodayDateString } from '../utils';
import ThermalSummaryModal, { SummaryReportPayload } from './ThermalSummaryModal';
import {
  TrendingUp,
  ShoppingCart,
  Banknote,
  ListCollapse,
  ReceiptText,
  Receipt,
  CreditCard,
  HandCoins,
  UserCheck,
  Users,
  ShoppingBag,
  Store,
  Building2,
  Calendar,
  RefreshCw,
  Clock,
  Sparkles,
  Printer,
  Moon,
  Calculator
} from 'lucide-react';

interface DashboardProps {
  products: Product[];
  transactions: Transaction[];
  onViewTransaction: (tx: Transaction) => void;
  openingCash?: number;
  currentDrawerBalance?: number;
  onManageDrawer?: () => void;
  expenses?: Expense[];
  currentUserUsername?: string;
  currentUserRole?: string;
  stockAdjustments?: StockAdjustment[];
  shopProfile?: ShopProfile;
  openingCashLogs?: OpeningCashLog[];
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function DashboardPage({
  products,
  transactions,
  onViewTransaction,
  openingCash = 0,
  currentDrawerBalance = 0,
  onManageDrawer,
  expenses = [],
  currentUserUsername = '',
  currentUserRole = '',
  stockAdjustments = [],
  shopProfile,
  openingCashLogs = [],
  onToast
}: DashboardProps) {
  const [thermalModalData, setThermalModalData] = useState<SummaryReportPayload | null>(null);

  // Check if current user is a superuser/admin
  const isSuperUser = useMemo(() => {
    const r = (currentUserRole || '').toLowerCase();
    const u = (currentUserUsername || '').toLowerCase();
    return r === 'superuser' || r === 'admin' || u === 'superuser' || u === 'admin';
  }, [currentUserRole, currentUserUsername]);

  // Determine default account view based on active login
  const [selectedAccount, setSelectedAccount] = useState<'lahiru' | 'jayantha' | 'all'>(() => {
    const u = currentUserUsername.toLowerCase();
    if (u === 'jayantha') return 'jayantha';
    if (u === 'lahiru') return 'lahiru';
    return isSuperUser ? 'all' : 'lahiru';
  });

  // Strict effect: non-superusers can NEVER view other accounts
  useEffect(() => {
    const u = currentUserUsername.toLowerCase();
    if (!isSuperUser) {
      if (u === 'jayantha') setSelectedAccount('jayantha');
      else setSelectedAccount('lahiru');
    }
  }, [currentUserUsername, isSuperUser]);

  // Real-time live date management
  const [liveTodayStr, setLiveTodayStr] = useState<string>(getLocalTodayDateString);
  const [selectedDate, setSelectedDate] = useState<string>(getLocalTodayDateString);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isLiveToday = selectedDate === liveTodayStr;

  // Auto-refresh timer to seamlessly tick past midnight
  useEffect(() => {
    const timer = setInterval(() => {
      const nowStr = getLocalTodayDateString();
      if (nowStr !== liveTodayStr) {
        setLiveTodayStr(nowStr);
        if (isLiveToday) {
          setSelectedDate(nowStr);
        }
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [liveTodayStr, isLiveToday]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    const nowStr = getLocalTodayDateString();
    setLiveTodayStr(nowStr);
    setSelectedDate(nowStr);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 450);
  };

  const setYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setSelectedDate(getLocalTodayDateString(d));
  };

  const setToday = () => {
    const nowStr = getLocalTodayDateString();
    setLiveTodayStr(nowStr);
    setSelectedDate(nowStr);
  };

  const isDateMatch = (dateStr: string) => {
    if (!dateStr) return false;
    return dateStr.split('T')[0] === selectedDate;
  };

  const isJayanthaTx = (tx: Transaction) => {
    return (
      tx.id.startsWith('J-') ||
      (tx.invoice_no && tx.invoice_no.startsWith('J-')) ||
      tx.createdBy?.toLowerCase() === 'jayantha'
    );
  };

  const todayExpensesTotal = useMemo(() => {
    return expenses
      .filter(exp => isDateMatch(exp.date))
      .reduce((sum, exp) => sum + exp.amount, 0);
  }, [expenses, selectedDate]);

  // Compute stats per account (Lahiru, Jayantha, All)
  const statsMap = useMemo(() => {
    let lahDirectCashSales = 0, lahCreditSales = 0, lahCustomerCreditRecovered = 0, lahCustomerCreditOutstanding = 0, lahCustomerCreditCount = 0;
    let lahDirectCashPurchases = 0, lahCreditPurchases = 0, lahSupplierCreditPaid = 0, lahSupplierCreditOutstanding = 0, lahSupplierCreditCount = 0;
    let lahProfit = 0;

    let jayDirectCashSales = 0, jayCreditSales = 0, jayCustomerCreditRecovered = 0, jayCustomerCreditOutstanding = 0, jayCustomerCreditCount = 0;
    let jayDirectCashPurchases = 0, jayCreditPurchases = 0, jaySupplierCreditPaid = 0, jaySupplierCreditOutstanding = 0, jaySupplierCreditCount = 0;
    let jayProfit = 0;

    const checkIsCreditTx = (tx: Transaction) => {
      if (!tx) return false;
      const pm = (tx.payment_method || '').toLowerCase();
      const cs = tx.credit_status;
      if (pm === 'credit' || cs === 'pending' || cs === 'partially_paid' || cs === 'paid') return true;
      const paid = tx.credit_paid_amount ?? tx.amount_paid;
      if (paid !== undefined && paid !== null && paid < tx.total) return true;
      if (tx.credit_payments && tx.credit_payments.length > 0) return true;
      return false;
    };

    transactions.forEach(tx => {
      const isTxOnDate = isDateMatch(tx.date);
      const isJayantha = isJayanthaTx(tx);
      const isCredit = checkIsCreditTx(tx);

      const totalBill = tx.total || 0;
      const totalPaid = tx.credit_paid_amount ?? tx.amount_paid ?? (tx.credit_payments ? tx.credit_payments.reduce((s, p) => s + p.amount, 0) : 0);
      const remaining = Math.max(0, totalBill - totalPaid);

      // Cumulative Outstanding Credit Balances
      if (isCredit && remaining > 0) {
        if (tx.type === 'sell') {
          if (isJayantha) {
            jayCustomerCreditOutstanding += remaining;
            jayCustomerCreditCount += 1;
          } else {
            lahCustomerCreditOutstanding += remaining;
            lahCustomerCreditCount += 1;
          }
        } else if (tx.type === 'buy') {
          if (isJayantha) {
            jaySupplierCreditOutstanding += remaining;
            jaySupplierCreditCount += 1;
          } else {
            lahSupplierCreditOutstanding += remaining;
            lahSupplierCreditCount += 1;
          }
        }
      }

      if (tx.type === 'sell') {
        if (isTxOnDate) {
          const pm = tx.payment_method || 'Cash';
          const isCreditToday = pm.toLowerCase() === 'credit';

          // Profit calculation for tx
          let txProfit = 0;
          if (typeof tx.total_profit === 'number' && tx.total_profit > 0) {
            txProfit = tx.total_profit;
          } else {
            let totalCost = 0;
            tx.items.forEach(item => {
              const prod = products.find(p => p.id === item.productId);
              const itemBuyPrice = prod ? (prod.buying_price ?? prod.buyPrice) : 0;
              let qtyInBase = item.qty;
              if (prod && prod.unit === 'kg' && item.unit === 'g') {
                qtyInBase = item.qty * 0.001;
              }
              totalCost += itemBuyPrice * qtyInBase;
            });
            const itemRevenue = tx.items.reduce((acc, item) => acc + item.total, 0);
            const itemProfit = itemRevenue - totalCost;
            const discountRatio = tx.subtotal > 0 ? (tx.subtotal - tx.discount) / tx.subtotal : 1;
            txProfit = itemProfit * discountRatio;
          }

          if (isJayantha) {
            if (isCreditToday) jayCreditSales += tx.total;
            else jayDirectCashSales += tx.total;
            jayProfit += txProfit;
          } else {
            if (isCreditToday) lahCreditSales += tx.total;
            else lahDirectCashSales += tx.total;
            lahProfit += txProfit;
          }
        }

        // Recoveries on selected date
        if (tx.credit_payments) {
          tx.credit_payments.forEach(pay => {
            if (isDateMatch(pay.date) && (pay.payment_method === 'Cash' || !pay.payment_method)) {
              if (isJayantha) jayCustomerCreditRecovered += pay.amount;
              else lahCustomerCreditRecovered += pay.amount;
            }
          });
        }
      } else if (tx.type === 'buy') {
        if (isTxOnDate) {
          const pm = tx.payment_method || 'Cash';
          const isCreditToday = pm.toLowerCase() === 'credit';
          if (isJayantha) {
            if (isCreditToday) jayCreditPurchases += tx.total;
            else jayDirectCashPurchases += tx.total;
          } else {
            if (isCreditToday) lahCreditPurchases += tx.total;
            else lahDirectCashPurchases += tx.total;
          }
        }

        if (tx.credit_payments) {
          tx.credit_payments.forEach(pay => {
            if (isDateMatch(pay.date) && (pay.payment_method === 'Cash' || !pay.payment_method)) {
              if (isJayantha) jaySupplierCreditPaid += pay.amount;
              else lahSupplierCreditPaid += pay.amount;
            }
          });
        }
      } else if (tx.type === 'return') {
        if (isTxOnDate) {
          if (isJayantha) jayDirectCashSales -= tx.total;
          else lahDirectCashSales -= tx.total;
        }
      }
    });

    const lahiruStats = {
      todayTotalSales: lahDirectCashSales + lahCreditSales,
      directCashSales: lahDirectCashSales,
      creditSales: lahCreditSales,
      customerCreditRecoveredToday: lahCustomerCreditRecovered,
      totalCashCollectedToday: lahDirectCashSales + lahCustomerCreditRecovered,

      todayTotalPurchases: lahDirectCashPurchases + lahCreditPurchases,
      directCashPurchases: lahDirectCashPurchases,
      creditPurchases: lahCreditPurchases,
      supplierCreditPaidToday: lahSupplierCreditPaid,
      totalCashSpentOnBuysToday: lahDirectCashPurchases + lahSupplierCreditPaid,

      totalCustomerCreditOutstanding: lahCustomerCreditOutstanding,
      customerCreditCount: lahCustomerCreditCount,
      totalSupplierCreditOutstanding: lahSupplierCreditOutstanding,
      supplierCreditCount: lahSupplierCreditCount,

      profit: Math.max(0, lahProfit)
    };

    const jayanthaStats = {
      todayTotalSales: jayDirectCashSales + jayCreditSales,
      directCashSales: jayDirectCashSales,
      creditSales: jayCreditSales,
      customerCreditRecoveredToday: jayCustomerCreditRecovered,
      totalCashCollectedToday: jayDirectCashSales + jayCustomerCreditRecovered,

      todayTotalPurchases: jayDirectCashPurchases + jayCreditPurchases,
      directCashPurchases: jayDirectCashPurchases,
      creditPurchases: jayCreditPurchases,
      supplierCreditPaidToday: jaySupplierCreditPaid,
      totalCashSpentOnBuysToday: jayDirectCashPurchases + jaySupplierCreditPaid,

      totalCustomerCreditOutstanding: jayCustomerCreditOutstanding,
      customerCreditCount: jayCustomerCreditCount,
      totalSupplierCreditOutstanding: jaySupplierCreditOutstanding,
      supplierCreditCount: jaySupplierCreditCount,

      profit: Math.max(0, jayProfit)
    };

    const allStats = {
      todayTotalSales: lahiruStats.todayTotalSales + jayanthaStats.todayTotalSales,
      directCashSales: lahiruStats.directCashSales + jayanthaStats.directCashSales,
      creditSales: lahiruStats.creditSales + jayanthaStats.creditSales,
      customerCreditRecoveredToday: lahiruStats.customerCreditRecoveredToday + jayanthaStats.customerCreditRecoveredToday,
      totalCashCollectedToday: lahiruStats.totalCashCollectedToday + jayanthaStats.totalCashCollectedToday,

      todayTotalPurchases: lahiruStats.todayTotalPurchases + jayanthaStats.todayTotalPurchases,
      directCashPurchases: lahiruStats.directCashPurchases + jayanthaStats.directCashPurchases,
      creditPurchases: lahiruStats.creditPurchases + jayanthaStats.creditPurchases,
      supplierCreditPaidToday: lahiruStats.supplierCreditPaidToday + jayanthaStats.supplierCreditPaidToday,
      totalCashSpentOnBuysToday: lahiruStats.totalCashSpentOnBuysToday + jayanthaStats.totalCashSpentOnBuysToday,

      totalCustomerCreditOutstanding: lahiruStats.totalCustomerCreditOutstanding + jayanthaStats.totalCustomerCreditOutstanding,
      customerCreditCount: lahiruStats.customerCreditCount + jayanthaStats.customerCreditCount,
      totalSupplierCreditOutstanding: lahiruStats.totalSupplierCreditOutstanding + jayanthaStats.totalSupplierCreditOutstanding,
      supplierCreditCount: lahiruStats.supplierCreditCount + jayanthaStats.supplierCreditCount,

      profit: lahiruStats.profit + jayanthaStats.profit
    };

    return {
      lahiru: lahiruStats,
      jayantha: jayanthaStats,
      all: allStats,
      todaySalesLahiru: lahiruStats.todayTotalSales,
      todaySalesJayantha: jayanthaStats.todayTotalSales,
      todayPurchasesLahiru: lahiruStats.todayTotalPurchases,
      todayPurchasesJayantha: jayanthaStats.todayTotalPurchases,
      totalProducts: products.length
    };
  }, [products, transactions, selectedDate]);

  // Ensure activeStats is strictly constrained to standard user's account if not superuser
  const effectiveAccount = isSuperUser ? selectedAccount : (((currentUserUsername || '').toLowerCase() === 'jayantha') ? 'jayantha' : 'lahiru');
  const activeStats = statsMap[effectiveAccount] || statsMap['lahiru'];

  const recentTransactions = useMemo(() => {
    return [...transactions]
      .filter(tx => {
        if (effectiveAccount === 'lahiru') return !isJayanthaTx(tx);
        if (effectiveAccount === 'jayantha') return isJayanthaTx(tx);
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [transactions, effectiveAccount]);

  // Open full Z-Report (End of Day Audit)
  const openZReport = (targetAccount: 'lahiru' | 'jayantha' | 'all' = effectiveAccount) => {
    try {
      const isJayantha = targetAccount === 'jayantha';
      const isLahiru = targetAccount === 'lahiru';

      let brandName = 'Lahiru Spices Center';
      if (isJayantha) brandName = 'Jayantha Spices Center';
      else if (targetAccount === 'all') brandName = 'Kulubadu Enterprise Consolidated';

      const entityType = targetAccount === 'all' ? 'combined' : targetAccount;
      const reportDate = selectedDate || getLocalTodayDateString();
      const timeFrameStr = reportDate;

      // Filter transactions for this entity and selected date
      const entityDateTransactions = (transactions || []).filter(tx => {
        if (!tx || !isDateMatch(tx.date)) return false;
        const isJ = isJayanthaTx(tx);
        if (isJayantha) return isJ;
        if (isLahiru) return !isJ;
        return true;
      });

      let grossSales = 0;
      let discountsGiven = 0;
      let netSales = 0;
      let cardSales = 0;
      let directCashSales = 0;
      let creditSales = 0;
      let customerCreditRecovered = 0;

      let directCashPurchases = 0;
      let creditPurchases = 0;
      let supplierCreditPaid = 0;

      let totalCostOfGoodsSold = 0;
      let totalCalculatedProfit = 0;

      const boughtProdBreakdownMap: Record<string, { id: string; name: string; unit: string; qty: number; value: number }> = {};
      const prodBreakdownMap: Record<string, { id: string; name: string; unit: string; qty: number; value: number; profit: number }> = {};

      entityDateTransactions.forEach(tx => {
        if (tx.type === 'sell') {
          grossSales += (tx.subtotal || tx.total || 0);
          discountsGiven += (tx.discount || 0);
          netSales += (tx.total || 0);

          const pm = (tx.payment_method || 'Cash').toLowerCase();
          if (pm === 'card' || pm === 'bank') {
            cardSales += (tx.total || 0);
          } else if (pm === 'credit') {
            creditSales += (tx.total || 0);
          } else {
            directCashSales += (tx.total || 0);
          }

          // Profit and COGS calculation
          let txCOGS = 0;
          (tx.items || []).forEach(item => {
            const prod = products.find(p => p.id === item.productId);
            const pName = prod ? prod.name : item.productId;
            const pUnit = prod ? prod.unit : 'kg';
            const bPrice = prod ? (prod.buying_price ?? prod.buyPrice) : 0;

            let qtyInBase = item.qty || 0;
            if (prod && prod.unit === 'kg' && item.unit === 'g') {
              qtyInBase = (item.qty || 0) * 0.001;
            }

            const itemCost = bPrice * qtyInBase;
            txCOGS += itemCost;

            if (!prodBreakdownMap[item.productId]) {
              prodBreakdownMap[item.productId] = {
                id: item.productId,
                name: pName,
                unit: pUnit,
                qty: 0,
                value: 0,
                profit: 0
              };
            }

            prodBreakdownMap[item.productId].qty += qtyInBase;
            prodBreakdownMap[item.productId].value += (item.total || 0);
            const itemProfit = Math.max(0, (item.total || 0) - itemCost);
            prodBreakdownMap[item.productId].profit += itemProfit;
          });

          totalCostOfGoodsSold += txCOGS;

          if (typeof tx.total_profit === 'number' && tx.total_profit > 0) {
            totalCalculatedProfit += tx.total_profit;
          } else {
            const ratio = tx.subtotal > 0 ? (tx.subtotal - (tx.discount || 0)) / tx.subtotal : 1;
            totalCalculatedProfit += ((tx.total || 0) - txCOGS) * ratio;
          }
        } else if (tx.type === 'buy') {
          const pm = (tx.payment_method || 'Cash').toLowerCase();
          if (pm === 'credit') {
            creditPurchases += (tx.total || 0);
          } else {
            directCashPurchases += (tx.total || 0);
          }

          (tx.items || []).forEach(item => {
            if (!item) return;
            const prod = products.find(p => p.id === item.productId);
            const pName = prod ? prod.name : item.productId;
            const pUnit = prod ? prod.unit : 'kg';

            let qtyInBase = item.qty || 0;
            if (prod && prod.unit === 'kg' && item.unit === 'g') {
              qtyInBase = (item.qty || 0) * 0.001;
            }

            if (!boughtProdBreakdownMap[item.productId]) {
              boughtProdBreakdownMap[item.productId] = {
                id: item.productId,
                name: pName,
                unit: pUnit,
                qty: 0,
                value: 0
              };
            }

            boughtProdBreakdownMap[item.productId].qty += qtyInBase;
            boughtProdBreakdownMap[item.productId].value += (item.total || 0);
          });
        } else if (tx.type === 'return') {
          netSales -= (tx.total || 0);
          directCashSales -= (tx.total || 0);
        }
      });

      // Credit payments recovered today (including past bills paid today)
      (transactions || []).forEach(tx => {
        if (!tx) return;
        const isJ = isJayanthaTx(tx);
        if (isJayantha && !isJ) return;
        if (isLahiru && isJ) return;

        if (tx.type === 'sell' && tx.credit_payments) {
          tx.credit_payments.forEach(pay => {
            if (pay && isDateMatch(pay.date) && (pay.payment_method === 'Cash' || !pay.payment_method)) {
              customerCreditRecovered += (pay.amount || 0);
            }
          });
        } else if (tx.type === 'buy' && tx.credit_payments) {
          tx.credit_payments.forEach(pay => {
            if (pay && isDateMatch(pay.date) && (pay.payment_method === 'Cash' || !pay.payment_method)) {
              supplierCreditPaid += (pay.amount || 0);
            }
          });
        }
      });

      // Daily Expenses filtered for target account
      const dayExpensesList = (expenses || []).filter(exp => {
        if (!exp || !isDateMatch(exp.date)) return false;
        if (isJayantha) return exp.addedBy === 'jayantha';
        if (isLahiru) return exp.addedBy !== 'jayantha';
        return true;
      });
      const dayExpensesTotal = dayExpensesList.reduce((sum, exp) => sum + (exp.amount || 0), 0);

      // Wastage / Stock Adjustments
      const dayAdjustments = (stockAdjustments || []).filter(a => {
        if (!a || !isDateMatch(a.date)) return false;
        if (isJayantha && a.desk !== 'jayantha') return false;
        if (isLahiru && a.desk === 'jayantha') return false;
        return true;
      });
      const wastageLoss = dayAdjustments.reduce((sum, a) => sum + (a.totalLoss || 0), 0);

      // Profit and Loss calculations
      const grossProfit = Math.max(0, netSales - totalCostOfGoodsSold);
      const netProfit = Math.max(0, grossProfit - wastageLoss - dayExpensesTotal);

      // Shared Cash Drawer overall totals for physical cash reconciliation
      const sharedCashSales = (transactions || [])
        .filter(tx => tx && isDateMatch(tx.date) && tx.type === 'sell' && (tx.payment_method === 'Cash' || !tx.payment_method))
        .reduce((sum, tx) => sum + (tx.total || 0), 0);
      let sharedCreditRecovered = 0;
      (transactions || []).forEach(tx => {
        if (tx && tx.type === 'sell' && tx.credit_payments) {
          tx.credit_payments.forEach(p => {
            if (p && isDateMatch(p.date) && (p.payment_method === 'Cash' || !p.payment_method)) {
              sharedCreditRecovered += (p.amount || 0);
            }
          });
        }
      });
      const sharedCashPurchases = (transactions || [])
        .filter(tx => tx && isDateMatch(tx.date) && tx.type === 'buy' && (tx.payment_method === 'Cash' || !tx.payment_method))
        .reduce((sum, tx) => sum + (tx.total || 0), 0);
      let sharedSupplierCreditPaid = 0;
      (transactions || []).forEach(tx => {
        if (tx && tx.type === 'buy' && tx.credit_payments) {
          tx.credit_payments.forEach(p => {
            if (p && isDateMatch(p.date) && (p.payment_method === 'Cash' || !p.payment_method)) {
              sharedSupplierCreditPaid += (p.amount || 0);
            }
          });
        }
      });
      const sharedDayExpensesTotal = (expenses || []).filter(exp => exp && isDateMatch(exp.date)).reduce((sum, exp) => sum + (exp.amount || 0), 0);

      // Expected Cash in Shared Drawer
      const expectedCashInDrawer = Math.max(
        0,
        openingCash + sharedCashSales + sharedCreditRecovered - sharedCashPurchases - sharedSupplierCreditPaid - sharedDayExpensesTotal
      );

      // Opening cash logs breakdown by user
      const dayOpeningCashLogs = (openingCashLogs || []).filter(l => l && isDateMatch(l.date));
      const openingCashUserSummaryMap: Record<string, number> = {};
      dayOpeningCashLogs.forEach(l => {
        const u = l.addedBy || 'user';
        openingCashUserSummaryMap[u] = (openingCashUserSummaryMap[u] || 0) + (l.amount || 0);
      });
      const openingCashUserSummary = Object.entries(openingCashUserSummaryMap).map(([addedBy, totalAmount]) => ({
        addedBy,
        totalAmount
      }));

      const productsBreakdown = Object.values(prodBreakdownMap).sort((a, b) => b.value - a.value);
      const purchasedProductsBreakdown = Object.values(boughtProdBreakdownMap).sort((a, b) => b.value - a.value);

      const payload: SummaryReportPayload = {
        entityType,
        reportType: 'daily',
        selectedDate: reportDate,
        selectedMonth: reportDate.substring(0, 7),
        brandName,
        timeFrameStr: `Date: ${reportDate}`,
        isZReport: true,
        zSequenceNo: `Z-${reportDate.replace(/-/g, '')}-${isJayantha ? 'J01' : isLahiru ? 'L01' : 'ALL01'}`,
        stats: {
          sales: netSales,
          salesCount: entityDateTransactions.filter(t => t.type === 'sell').length,
          buys: directCashPurchases + creditPurchases,
          buysCount: entityDateTransactions.filter(t => t.type === 'buy').length,
          wastageLoss,
          expenses: dayExpensesTotal,
          openingCash,
          profit: netProfit
        },
        wholesaleStats: {
          sales: 0,
          profit: 0,
          count: 0
        },
        salesAudit: {
          grossSales: grossSales > 0 ? grossSales : netSales,
          discountsGiven,
          netSales,
          cardSales,
          directCashSales,
          creditSales,
          customerCreditRecovered,
          totalCashInflow: directCashSales + customerCreditRecovered
        },
        purchasesAudit: {
          directCashPurchases,
          creditPurchases,
          supplierCreditPaid,
          totalCashOutflow: directCashPurchases + supplierCreditPaid
        },
        creditStats: {
          directCashSales,
          creditSales,
          customerCreditRecovered,
          directCashPurchases,
          creditPurchases,
          supplierCreditPaid
        },
        profitAndLoss: {
          grossRevenue: grossSales > 0 ? grossSales : netSales,
          discounts: discountsGiven,
          netRevenue: netSales,
          cogs: totalCostOfGoodsSold,
          grossProfit,
          wastageLoss,
          operatingExpenses: dayExpensesTotal,
          netProfit
        },
        expensesList: dayExpensesList.map(e => ({
          id: e.id,
          category: e.category,
          title: e.title,
          amount: e.amount || 0,
          addedBy: e.addedBy
        })),
        drawerReconciliation: {
          openingCash,
          cashSales: directCashSales,
          creditRecovered: customerCreditRecovered,
          cashPurchases: directCashPurchases,
          supplierCreditPaid,
          pettyCashExpenses: dayExpensesTotal,
          expectedCashInDrawer
        },
        openingCashLogs: dayOpeningCashLogs,
        openingCashUserSummary,
        productsBreakdown,
        purchasedProductsBreakdown,
        shopProfile,
        currentUserUsername
      };

      setThermalModalData(payload);
    } catch (err) {
      console.error('Failed to open Z-Report:', err);
      onToast?.('Z-Report සෑදීමේදී දෝෂයක් සිදු විය.', 'error');
    }
  };

  return (
    <div id="dashboardPage" className="space-y-5">
      {/* Real-time Live Date & Daily Refresh Toolbar */}
      <div className="bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/15 rounded-xl text-emerald-400 border border-emerald-500/20 shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">දෛනික සාරාංශය (Daily Stats Refresh)</span>
              {isLiveToday ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  සජීවී (Live Today)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <Calendar size={10} />
                  තෝරාගත් දිනය ({selectedDate})
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 font-medium mt-0.5 flex items-center gap-1.5">
              <span>දිනය:</span>
              <strong className="text-white font-mono text-sm">{selectedDate}</strong>
              {isLiveToday && <span className="text-emerald-400 text-[11px] font-semibold">(අද දින ස්වයංක්‍රීයව අලුත් වේ)</span>}
            </p>
          </div>
        </div>

        {/* Date Filter Quick Pills & Date Picker */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
          <button
            onClick={setToday}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${isLiveToday
                ? 'bg-emerald-600 text-white shadow-md border border-emerald-500/40'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
          >
            <Sparkles size={13} className={isLiveToday ? 'text-emerald-200' : 'text-slate-400'} />
            <span>අද (Today)</span>
          </button>

          <button
            onClick={setYesterday}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${!isLiveToday && selectedDate === getLocalTodayDateString(new Date(Date.now() - 86400000))
                ? 'bg-indigo-600 text-white shadow-md border border-indigo-500/40'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
          >
            <span>ඊයේ (Yesterday)</span>
          </button>

          {/* Custom Date Input */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 text-slate-300 text-xs">
            <Calendar size={13} className="text-slate-400 mr-1.5 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-slate-200 text-xs font-mono font-bold focus:outline-none cursor-pointer"
              title="Select custom date to view past daily stats"
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            title="Refresh Live Daily Stats"
            className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <RefreshCw size={15} className={`${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          {/* Dedicated End-of-Day Z-Report / Close Register Button */}
          <button
            onClick={() => openZReport(effectiveAccount)}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-700/20 border border-amber-500/40 transition-all cursor-pointer"
            title="Generate & Print End of Day Z-Report on 80mm Thermal Printer"
          >
            <Moon size={14} className="text-amber-200" />
            <span>Close Register (Z-Report)</span>
          </button>
        </div>
      </div>

      {/* Superuser / Admin Only View Account Control Banner */}
      {isSuperUser && (
        <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-violet-500/15 rounded-xl text-violet-400 border border-violet-500/20">
              <UserCheck size={18} />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">Superuser View Account (ගිණුම් දර්ශනය)</span>
              <span className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <span>ලොග් වී ඇත්තේ:</span>
                <strong className="text-violet-400 capitalize">@{currentUserUsername || 'Superuser'}</strong>
              </span>
            </div>
          </div>

          {/* Account Selector Tabs for Superuser */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1 w-full sm:w-auto justify-between sm:justify-start">
            <button
              onClick={() => setSelectedAccount('lahiru')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${selectedAccount === 'lahiru'
                  ? 'bg-emerald-600 text-white shadow-lg border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
            >
              <Store size={14} />
              <span>ළහිරු (Lahiru)</span>
            </button>

            <button
              onClick={() => setSelectedAccount('jayantha')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${selectedAccount === 'jayantha'
                  ? 'bg-teal-600 text-white shadow-lg border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
            >
              <Store size={14} />
              <span>ජයන්තා (Jayantha)</span>
            </button>

            <button
              onClick={() => setSelectedAccount('all')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${selectedAccount === 'all'
                  ? 'bg-indigo-600 text-white shadow-lg border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
            >
              <Users size={14} />
              <span>දෙදෙනාම (Both)</span>
            </button>
          </div>
        </div>
      )}

      {/* Primary Row 1: Main Sales & Purchases Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Today Sale Card */}
        <div className="bg-gradient-to-br from-emerald-950/40 via-emerald-900/20 to-slate-900 border border-emerald-500/40 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10 text-emerald-400 pointer-events-none">
            <TrendingUp size={120} />
          </div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400 border border-emerald-500/30">
                <ShoppingBag size={26} />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-400 tracking-wider uppercase flex items-center gap-1.5">
                  <span>{isLiveToday ? 'Today Sale' : `Sale (${selectedDate})`}</span>
                  <span className="text-[10px] bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full capitalize">
                    {effectiveAccount === 'lahiru' && 'ළහිරු (Lahiru)'}
                    {effectiveAccount === 'jayantha' && 'ජයන්තා (Jayantha)'}
                    {effectiveAccount === 'all' && 'දෙදෙනාම එකතුව (Total)'}
                  </span>
                </span>
                <h2 className="text-2xl md:text-3xl font-black text-white mt-0.5">
                  {formatCurrency(activeStats.todayTotalSales)}
                </h2>
              </div>
            </div>
            <span className="text-[11px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold px-2.5 py-1 rounded-full shrink-0">
              {selectedDate}
            </span>
          </div>

          {/* Account Breakdown Chips ONLY when superuser selects 'all' */}
          {isSuperUser && effectiveAccount === 'all' && (
            <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-emerald-500/20">
              <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="font-semibold text-emerald-300 flex items-center gap-1">
                    <UserCheck size={13} /> ළහිරු (Lahiru)
                  </span>
                </div>
                <p className="text-base font-bold text-slate-100">{formatCurrency(statsMap.todaySalesLahiru)}</p>
              </div>
              <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="font-semibold text-teal-300 flex items-center gap-1">
                    <UserCheck size={13} /> ජයන්තා (Jayantha)
                  </span>
                </div>
                <p className="text-base font-bold text-slate-100">{formatCurrency(statsMap.todaySalesJayantha)}</p>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-800/60">
            <span>අතින් ලැබුණු (Cash): <strong className="text-emerald-400">{formatCurrency(activeStats.directCashSales)}</strong></span>
            <span>ණයට දුන් (Credit): <strong className="text-amber-400">{formatCurrency(activeStats.creditSales)}</strong></span>
          </div>
        </div>

        {/* Today Purchases (Buy) Card */}
        <div className="bg-gradient-to-br from-amber-950/40 via-amber-900/20 to-slate-900 border border-amber-500/40 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10 text-amber-400 pointer-events-none">
            <ShoppingCart size={120} />
          </div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 rounded-xl text-amber-400 border border-amber-500/30">
                <ShoppingCart size={26} />
              </div>
              <div>
                <span className="text-xs font-bold text-amber-400 tracking-wider uppercase flex items-center gap-1.5">
                  <span>{isLiveToday ? 'Purchases (Buy)' : `Purchases (${selectedDate})`}</span>
                  <span className="text-[10px] bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full capitalize">
                    {effectiveAccount === 'lahiru' && 'ළහිරු (Lahiru)'}
                    {effectiveAccount === 'jayantha' && 'ජයන්තා (Jayantha)'}
                    {effectiveAccount === 'all' && 'දෙදෙනාම එකතුව (Total)'}
                  </span>
                </span>
                <h2 className="text-2xl md:text-3xl font-black text-white mt-0.5">
                  {formatCurrency(activeStats.todayTotalPurchases)}
                </h2>
              </div>
            </div>
            <span className="text-[11px] bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold px-2.5 py-1 rounded-full shrink-0">
              {selectedDate}
            </span>
          </div>

          {/* Account Breakdown Chips ONLY when superuser selects 'all' */}
          {isSuperUser && effectiveAccount === 'all' && (
            <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-amber-500/20">
              <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="font-semibold text-amber-300 flex items-center gap-1">
                    <UserCheck size={13} /> ළහිරු (Lahiru)
                  </span>
                </div>
                <p className="text-base font-bold text-slate-100">{formatCurrency(statsMap.todayPurchasesLahiru)}</p>
              </div>
              <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="font-semibold text-orange-300 flex items-center gap-1">
                    <UserCheck size={13} /> ජයන්තා (Jayantha)
                  </span>
                </div>
                <p className="text-base font-bold text-slate-100">{formatCurrency(statsMap.todayPurchasesJayantha)}</p>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-800/60">
            <span>අතින් ගෙවූ (Cash): <strong className="text-amber-400">{formatCurrency(activeStats.directCashPurchases)}</strong></span>
            <span>ණයට ගත් (Credit): <strong className="text-red-400">{formatCurrency(activeStats.creditPurchases)}</strong></span>
          </div>
        </div>
      </div>

      {/* TOTAL OUTSTANDING CREDIT SECTION (මුළු හිඟ ණය වාර්තාව) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/80 pb-2.5 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-500/15 rounded-xl text-red-400 border border-red-500/30 shrink-0">
              <CreditCard size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>මුළු හිඟ ණය වාර්තාව (Total Outstanding Credit)</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                පාරිභෝගිකයින්ගෙන් ලැබීමට ඇති මුළු ණය සහ සැපයුම්කරුවන්ට ගෙවීමට ඇති මුළු ණය
              </p>
            </div>
          </div>
          <span className="text-[10px] bg-slate-950 border border-slate-800 text-slate-400 px-2.5 py-1 rounded-lg font-mono font-semibold self-start sm:self-auto">
            Active Unpaid Balances
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Customer Credit Outstanding Card (Sales Credit / ලැබීමට ඇති මුළු ණය) */}
          <div className="bg-gradient-to-br from-red-950/30 via-red-900/15 to-slate-950 border border-red-500/35 rounded-xl p-4 flex items-center justify-between gap-4 shadow-lg hover:border-red-500/50 transition-all">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="p-3 bg-red-500/20 rounded-xl text-red-400 border border-red-500/30 shrink-0">
                <HandCoins size={26} />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-extrabold text-red-400 tracking-wide uppercase flex items-center gap-1.5 flex-wrap">
                  <span>ලැබීමට ඇති මුළු ණය (Customer Credit)</span>
                  <span className="text-[9px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded border border-red-500/30 font-mono font-bold">
                    SALES CREDIT
                  </span>
                </span>
                <h3 className="text-2xl font-black text-white mt-1 truncate">
                  {formatCurrency(activeStats.totalCustomerCreditOutstanding)}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  නොගෙවූ බිල්පත් ගණන: <strong className="text-red-300 font-bold">{activeStats.customerCreditCount}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Supplier Credit Outstanding Card (Buy Credit / ගෙවීමට ඇති මුළු ණය) */}
          <div className="bg-gradient-to-br from-amber-950/30 via-amber-900/15 to-slate-950 border border-amber-500/35 rounded-xl p-4 flex items-center justify-between gap-4 shadow-lg hover:border-amber-500/50 transition-all">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="p-3 bg-amber-500/20 rounded-xl text-amber-400 border border-amber-500/30 shrink-0">
                <Building2 size={26} />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-extrabold text-amber-400 tracking-wide uppercase flex items-center gap-1.5 flex-wrap">
                  <span>ගෙවීමට ඇති මුළු ණය (Supplier Credit)</span>
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 font-mono font-bold">
                    BUY CREDIT
                  </span>
                </span>
                <h3 className="text-2xl font-black text-white mt-1 truncate">
                  {formatCurrency(activeStats.totalSupplierCreditOutstanding)}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  නොගෙවූ බිල්පත් ගණන: <strong className="text-amber-300 font-bold">{activeStats.supplierCreditCount}</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Shared Cash Drawer Balance */}
        <div
          onClick={onManageDrawer}
          className="bg-emerald-950/20 border border-emerald-500/30 hover:border-emerald-500/50 rounded-2xl p-4 flex items-center gap-4 shadow-lg cursor-pointer transition-all hover:bg-emerald-950/25"
          title="Click to manage shared cash drawer"
        >
          <div className="p-3 bg-emerald-500/15 rounded-xl text-emerald-400">
            <Banknote size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-400 font-medium tracking-wide flex justify-between items-center">
              <span>අතින් ඇති මුදල (Cash Drawer)</span>
              <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-1 py-0.5 rounded uppercase font-bold animate-pulse shrink-0">Live</span>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-emerald-400 mt-1 truncate">
              {formatCurrency(currentDrawerBalance)}
            </h3>
            <div className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between">
              <span>ආරම්භක මුදල: {formatCurrency(openingCash)}</span>
              {openingCash === 0 && (
                <span className="text-[9px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  + දමන්න
                </span>
              )}
            </div>
            {/* Quick 80mm Z-Report Button on Drawer Card */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                openZReport(effectiveAccount);
              }}
              className="mt-2 w-full py-1 px-2 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-500/30 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer"
            >
              <Printer size={11} />
              <span>Day-End Z-Report (80mm)</span>
            </button>
          </div>
        </div>

        {/* Today Cash Collected */}
        <div className="bg-teal-950/20 border border-teal-900/40 rounded-2xl p-4 flex items-center gap-4 shadow-lg">
          <div className="p-3 bg-teal-500/15 rounded-xl text-teal-400">
            <TrendingUp size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-400 font-medium tracking-wide">අද ලැබුණු අතින් මුදල් (Cash Received)</div>
            <h3 className="text-xl md:text-2xl font-bold text-teal-400 mt-1">{formatCurrency(activeStats.totalCashCollectedToday)}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              විකුණුම්: {formatCurrency(activeStats.directCashSales)} | එකතු කිරීම්: {formatCurrency(activeStats.customerCreditRecoveredToday)}
            </p>
          </div>
        </div>

        {/* Today Customer Credit Recovered */}
        <div className="bg-sky-950/20 border border-sky-900/40 rounded-2xl p-4 flex items-center gap-4 shadow-lg">
          <div className="p-3 bg-sky-500/15 rounded-xl text-sky-400">
            <HandCoins size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-400 font-medium tracking-wide">අද ණය එකතු කිරීම් (Credit Recovery)</div>
            <h3 className="text-xl md:text-2xl font-bold text-sky-400 mt-1">{formatCurrency(activeStats.customerCreditRecoveredToday)}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">පාරිභෝගිකයින්ගෙන් අද ලැබුණු මුදල්</p>
          </div>
        </div>

        {/* Today Credit Sales Issued */}
        <div className="bg-amber-950/20 border border-amber-900/40 rounded-2xl p-4 flex items-center gap-4 shadow-lg">
          <div className="p-3 bg-amber-500/15 rounded-xl text-amber-400">
            <CreditCard size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-400 font-medium tracking-wide">අද ණය විකුණුම් (Credit Sales)</div>
            <h3 className="text-xl md:text-2xl font-bold text-amber-400 mt-1">{formatCurrency(activeStats.creditSales)}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">අද ණයට දුන් බිල්පත් එකතුව</p>
          </div>
        </div>
      </div>

      {/* Tertiary Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today Credit Purchases (Supplier Debt) */}
        <div className="bg-red-950/20 border border-red-900/40 rounded-2xl p-4 flex items-center gap-4 shadow-lg">
          <div className="p-3 bg-red-500/15 rounded-xl text-red-400">
            <ShoppingCart size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-400 font-medium tracking-wide">අද ණය මිලදී ගැනීම් (Credit Purchases)</div>
            <h3 className="text-lg md:text-xl font-bold text-red-400 mt-1">{formatCurrency(activeStats.creditPurchases)}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">සැපයුම්කරුවන්ගෙන් ණයට ගත් තොග</p>
          </div>
        </div>

        {/* Today Shop Expenses */}
        <div className="bg-rose-950/20 border border-rose-900/40 rounded-2xl p-4 flex items-center gap-4 shadow-lg">
          <div className="p-3 bg-rose-500/15 rounded-xl text-rose-400">
            <Receipt size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-400 font-medium tracking-wide">අමතර කඩේ වියදම් (Expenses)</div>
            <h3 className="text-lg md:text-xl font-bold text-rose-400 mt-1">{formatCurrency(todayExpensesTotal)}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">කුලී, ලයිට්, කෑම හා අනෙකුත් වියදම්</p>
          </div>
        </div>

        {/* Today Estimated Profit */}
        <div className="bg-violet-950/20 border border-violet-900/40 rounded-2xl p-4 flex items-center gap-4 shadow-lg">
          <div className="p-3 bg-violet-500/15 rounded-xl text-violet-400">
            <Banknote size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-400 font-medium tracking-wide">ඇස්තමේන්තුගත ලාභය ({selectedDate})</div>
            <h3 className="text-lg md:text-xl font-bold text-violet-400 mt-1">{formatCurrency(activeStats.profit)}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">අද විකුණුම්වලින් ලැබෙන ශුද්ධ ලාභය</p>
          </div>
        </div>

        {/* Total Products */}
        <div className="bg-indigo-950/20 border border-indigo-900/40 rounded-2xl p-4 flex items-center gap-4 shadow-lg">
          <div className="p-3 bg-indigo-500/15 rounded-xl text-indigo-400">
            <ListCollapse size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-400 font-medium tracking-wide">ලියාපදිංචි භාණ්ඩ (Products)</div>
            <h3 className="text-lg md:text-xl font-bold text-indigo-400 mt-1">{statsMap.totalProducts} items</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">පද්ධතියේ ඇති මුළු කුළුබඩු වර්ග</p>
          </div>
        </div>
      </div>

      {/* Superuser Only Account Comparison Summary Block */}
      {isSuperUser && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Users className="text-sky-400" size={20} />
              <h3 className="text-base font-bold text-slate-100">ළහිරු සහ ජයන්තා වෙන් වෙන් වශයෙන් සාරාංශය (Account Breakdown)</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {selectedDate}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lahiru Card */}
            <div
              onClick={() => setSelectedAccount('lahiru')}
              className={`bg-slate-950/70 border rounded-xl p-4 transition-all cursor-pointer ${effectiveAccount === 'lahiru' ? 'border-emerald-500 shadow-lg ring-1 ring-emerald-500/30' : 'border-emerald-500/20 hover:border-emerald-500/40'
                }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                  <Store size={18} /> ළහිරු කුළුබඩු (Lahiru Account)
                </span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold">L- Series</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <span className="text-xs text-slate-400 font-medium">අද විකුණුම් (Sales)</span>
                  <p className="text-lg font-black text-emerald-400 mt-0.5">{formatCurrency(statsMap.todaySalesLahiru)}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium">අද මිලදී ගැනීම් (Buy)</span>
                  <p className="text-lg font-black text-amber-400 mt-0.5">{formatCurrency(statsMap.todayPurchasesLahiru)}</p>
                </div>
              </div>
            </div>

            {/* Jayantha Card */}
            <div
              onClick={() => setSelectedAccount('jayantha')}
              className={`bg-slate-950/70 border rounded-xl p-4 transition-all cursor-pointer ${effectiveAccount === 'jayantha' ? 'border-teal-500 shadow-lg ring-1 ring-teal-500/30' : 'border-teal-500/20 hover:border-teal-500/40'
                }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="font-bold text-teal-400 text-sm flex items-center gap-2">
                  <Store size={18} /> ජයන්තා කුළුබඩු (Jayantha Account)
                </span>
                <span className="text-[10px] bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded font-mono font-bold">J- Series</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <span className="text-xs text-slate-400 font-medium">අද විකුණුම් (Sales)</span>
                  <p className="text-lg font-black text-teal-400 mt-0.5">{formatCurrency(statsMap.todaySalesJayantha)}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium">අද මිලදී ගැනීම් (Buy)</span>
                  <p className="text-lg font-black text-orange-400 mt-0.5">{formatCurrency(statsMap.todayPurchasesJayantha)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Transactions Card */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <ReceiptText className="text-violet-400" size={20} />
            <h3 className="text-base font-bold text-slate-100">
              Recent Transactions {isSuperUser ? `(${effectiveAccount === 'lahiru' ? 'Lahiru' : effectiveAccount === 'jayantha' ? 'Jayantha' : 'All'})` : ''}
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Showing last {recentTransactions.length} entries
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-800/80">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="p-3.5">Invoice No</th>
                <th className="p-3.5">Date & Time</th>
                <th className="p-3.5">Type</th>
                <th className="p-3.5">Customer / Supplier</th>
                <th className="p-3.5">Payment</th>
                <th className="p-3.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs">
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                    ගනුදෙනු කිසිවක් සටහන් වී නොමැත. (No recent transactions)
                  </td>
                </tr>
              ) : (
                recentTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    onClick={() => onViewTransaction(tx)}
                    className="hover:bg-slate-800/30 transition-all cursor-pointer group"
                  >
                    <td className="p-3.5 font-mono font-bold text-slate-200 group-hover:text-violet-400 flex items-center gap-1.5">
                      <span>{tx.invoice_no || tx.id}</span>
                      {isJayanthaTx(tx) && (
                        <span className="text-[9px] bg-teal-500/10 text-teal-400 border border-teal-500/20 px-1 rounded font-sans">ජයන්තා</span>
                      )}
                    </td>
                    <td className="p-3.5 text-slate-400">{formatDateString(tx.date)}</td>
                    <td className="p-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${tx.type === 'sell' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          tx.type === 'buy' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-300 font-medium">{tx.customer_name || 'Walk-in Customer'}</td>
                    <td className="p-3.5">
                      <span className="text-slate-400 font-medium">
                        {tx.payment_method}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-bold text-slate-100 font-mono">
                      {formatCurrency(tx.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 80mm Bluetooth Thermal Summary / Z-Report Modal */}
      {thermalModalData && (
        <ThermalSummaryModal
          data={thermalModalData}
          onClose={() => setThermalModalData(null)}
          onToast={onToast}
        />
      )}
    </div>
  );
}
