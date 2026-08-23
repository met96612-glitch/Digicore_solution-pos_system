import { useMemo, useState, useEffect } from 'react';
import { Product, Transaction, OpeningCashLog, Expense, StockAdjustment, ShopProfile } from '../types';
import { formatCurrency, formatDateString, getLocalTodayDateString, exportToCSV, exportToExcel, printReportDocument, STOCK_ADJUSTMENT_REASONS } from '../utils';
import ThermalSummaryModal, { SummaryReportPayload } from './ThermalSummaryModal';
import {
  BarChart3,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  User,
  Sparkles,
  Download,
  FileSpreadsheet,
  Printer,
  FileText,
  Banknote,
  Receipt,
  TrendingDown,
  Scale,
  AlertOctagon,
  Bluetooth
} from 'lucide-react';

interface ReportsPageProps {
  transactions: Transaction[];
  products: Product[];
  currentUserUsername?: string;
  currentUserRole?: string;
  openingCashLogs?: OpeningCashLog[];
  currentOpeningCash?: number;
  expenses?: Expense[];
  stockAdjustments?: StockAdjustment[];
  shopProfile?: ShopProfile;
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function ReportsPage({
  transactions,
  products,
  currentUserUsername,
  currentUserRole = 'cashier',
  openingCashLogs = [],
  currentOpeningCash = 1000,
  expenses = [],
  stockAdjustments = [],
  shopProfile,
  onToast
}: ReportsPageProps) {
  const [reportType, setReportType] = useState<'daily' | 'monthly'>('daily');
  const [thermalModalData, setThermalModalData] = useState<SummaryReportPayload | null>(null);

  // Safe helper to extract YYYY-MM-DD
  const safeGetDateStr = (dateVal?: any): string => {
    if (!dateVal) return '';
    if (typeof dateVal === 'string') {
      return dateVal.split('T')[0] || '';
    }
    return '';
  };

  // Find the most recent transaction date to show live financial data by default
  const defaultDate = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return getLocalTodayDateString();
    }
    const sorted = [...transactions]
      .filter(tx => tx && tx.date)
      .map(tx => safeGetDateStr(tx.date))
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a));
    return sorted[0] || getLocalTodayDateString();
  }, [transactions]);

  const [selectedDate, setSelectedDate] = useState(() => defaultDate || getLocalTodayDateString());
  const [selectedMonth, setSelectedMonth] = useState(() => (defaultDate || getLocalTodayDateString()).substring(0, 7));
  const [hasManuallySelected, setHasManuallySelected] = useState(false);

  // Sync state with the latest transaction date if the user has not manually overridden it
  useEffect(() => {
    if (!hasManuallySelected) {
      const d = defaultDate || getLocalTodayDateString();
      setSelectedDate(d);
      setSelectedMonth(d.substring(0, 7));
    }
  }, [defaultDate, hasManuallySelected]);

  // Filter transactions by date/month
  const filteredTransactions = useMemo(() => {
    return (transactions || []).filter(tx => {
      if (!tx || !tx.date) return false;
      const txDateStr = safeGetDateStr(tx.date);
      if (!txDateStr) return false;
      if (reportType === 'daily') {
        return txDateStr === selectedDate;
      } else {
        return selectedMonth ? txDateStr.startsWith(selectedMonth) : true;
      }
    });
  }, [transactions, reportType, selectedDate, selectedMonth]);

  // Selected date/period opening cash records list
  const selectedOpeningCashLogs = useMemo(() => {
    if (!openingCashLogs || openingCashLogs.length === 0) return [];
    return openingCashLogs.filter(l => {
      if (!l || !l.date) return false;
      if (reportType === 'daily') {
        return l.date === selectedDate;
      } else {
        return selectedMonth ? l.date.startsWith(selectedMonth) : true;
      }
    });
  }, [openingCashLogs, reportType, selectedDate, selectedMonth]);

  const selectedOpeningCashTotal = useMemo(() => {
    if (selectedOpeningCashLogs.length === 0) {
      return currentOpeningCash || 1000;
    }
    return selectedOpeningCashLogs.reduce((sum, l) => sum + (l ? l.amount || 0 : 0), 0);
  }, [selectedOpeningCashLogs, currentOpeningCash]);

  // Period Shop Expenses calculation
  const periodExpensesTotal = useMemo(() => {
    return (expenses || [])
      .filter(exp => {
        if (!exp || !exp.date) return false;
        const expDateStr = safeGetDateStr(exp.date);
        if (!expDateStr) return false;
        if (reportType === 'daily') {
          return expDateStr === selectedDate;
        } else {
          return selectedMonth ? expDateStr.startsWith(selectedMonth) : true;
        }
      })
      .reduce((sum, exp) => sum + (exp ? exp.amount || 0 : 0), 0);
  }, [expenses, reportType, selectedDate, selectedMonth]);

  // Period Stock Adjustments & Wastage calculation
  const selectedStockAdjustments = useMemo(() => {
    if (!stockAdjustments || stockAdjustments.length === 0) return [];
    return stockAdjustments.filter(adj => {
      if (!adj || !adj.date) return false;
      const adjDateStr = safeGetDateStr(adj.date);
      if (!adjDateStr) return false;
      if (reportType === 'daily') {
        return adjDateStr === selectedDate;
      } else {
        return selectedMonth ? adjDateStr.startsWith(selectedMonth) : true;
      }
    });
  }, [stockAdjustments, reportType, selectedDate, selectedMonth]);

  const computeAdjustmentStats = (entityType: 'lahiru' | 'jayantha' | 'combined') => {
    const filtered = selectedStockAdjustments.filter(adj => {
      return (
        entityType === 'combined' ||
        (entityType === 'jayantha' && adj.desk === 'jayantha') ||
        (entityType === 'lahiru' && adj.desk === 'lahiru')
      );
    });

    const totalLoss = filtered.reduce((sum, a) => sum + a.totalLoss, 0);
    const totalQtyKg = filtered.reduce((sum, a) => sum + (a.unit === 'g' ? a.qty * 0.001 : a.qty), 0);
    const count = filtered.length;

    return { totalLoss, totalQtyKg, count, items: filtered };
  };

  const lahiruAdjStats = useMemo(() => computeAdjustmentStats('lahiru'), [selectedStockAdjustments]);
  const jayanthaAdjStats = useMemo(() => computeAdjustmentStats('jayantha'), [selectedStockAdjustments]);
  const combinedAdjStats = useMemo(() => computeAdjustmentStats('combined'), [selectedStockAdjustments]);

  // Helper to compute financial metrics for a specific prefix/user list
  const computeEntityStats = (entityType: 'lahiru' | 'jayantha' | 'combined') => {
    let sales = 0;
    let buys = 0;
    let profit = 0;

    (filteredTransactions || []).forEach(tx => {
      if (!tx) return;
      const isJayantha = (tx.id && tx.id.startsWith('J-')) || (tx.invoice_no && tx.invoice_no.startsWith('J-')) || (tx.createdBy && tx.createdBy.toLowerCase() === 'jayantha');
      const matches = 
        entityType === 'combined' ||
        (entityType === 'jayantha' && isJayantha) ||
        (entityType === 'lahiru' && !isJayantha);

      if (!matches) return;

      if (tx.type === 'sell') {
        sales += (tx.total || 0);

        if (typeof tx.total_profit === 'number' && tx.total_profit > 0) {
          profit += tx.total_profit;
        } else {
          let txCost = 0;
          (tx.items || []).forEach(item => {
            if (!item) return;
            const prod = (products || []).find(p => p && p.id === item.productId);
            const bPrice = prod ? (prod.buying_price ?? prod.buyPrice ?? 0) : 0;
            let qtyInBase = item.qty || 0;
            if (prod && prod.unit === 'kg' && item.unit === 'g') {
              qtyInBase = (item.qty || 0) * 0.001;
            }
            txCost += bPrice * qtyInBase;
          });
          const itemRevenue = (tx.items || []).reduce((acc, item) => acc + (item ? item.total || 0 : 0), 0);
          const itemProfit = itemRevenue - txCost;
          const sub = tx.subtotal || tx.total || 0;
          const disc = tx.discount || 0;
          const ratio = sub > 0 ? (sub - disc) / sub : 1;
          profit += itemProfit * ratio;
        }
      } else if (tx.type === 'buy') {
        buys += (tx.total || 0);
      } else if (tx.type === 'return') {
        sales -= (tx.total || 0);
      }
    });

    const adjLoss = computeAdjustmentStats(entityType).totalLoss;
    const netProfitAfterWastage = Math.max(0, profit - adjLoss);

    return {
      sales,
      buys,
      grossProfit: Math.max(0, profit),
      wastageLoss: adjLoss,
      profit: netProfitAfterWastage
    };
  };

  const lahiruStats = useMemo(() => computeEntityStats('lahiru'), [filteredTransactions, products, selectedStockAdjustments]);
  const jayanthaStats = useMemo(() => computeEntityStats('jayantha'), [filteredTransactions, products, selectedStockAdjustments]);
  const combinedStats = useMemo(() => computeEntityStats('combined'), [filteredTransactions, products, selectedStockAdjustments]);

  // Compute credit statistics
  const computeCreditBreakdown = (entityType: 'lahiru' | 'jayantha' | 'combined') => {
    let directCashSales = 0;
    let creditSales = 0;
    let customerCreditRecovered = 0;

    let directCashPurchases = 0;
    let creditPurchases = 0;
    let supplierCreditPaid = 0;

    filteredTransactions.forEach(tx => {
      if (!tx) return;
      const isTxJayantha = (tx.id && tx.id.startsWith('J-')) || (tx.invoice_no && tx.invoice_no.startsWith('J-')) || (tx.createdBy && tx.createdBy.toLowerCase() === 'jayantha');
      const matches =
        entityType === 'combined' ||
        (entityType === 'jayantha' && isTxJayantha) ||
        (entityType === 'lahiru' && !isTxJayantha);

      if (!matches) return;

      if (tx.type === 'sell') {
        if (tx.payment_method === 'Credit') {
          creditSales += (tx.total || 0);
        } else {
          directCashSales += (tx.total || 0);
        }

        if (tx.credit_payments) {
          tx.credit_payments.forEach(pay => {
            if (!pay || !pay.date) return;
            const payDateStr = safeGetDateStr(pay.date);
            const isMatch = reportType === 'daily' ? payDateStr === selectedDate : (selectedMonth ? payDateStr.startsWith(selectedMonth) : true);
            if (isMatch) {
              customerCreditRecovered += (pay.amount || 0);
            }
          });
        }
      } else if (tx.type === 'buy') {
        if (tx.payment_method === 'Credit') {
          creditPurchases += (tx.total || 0);
        } else {
          directCashPurchases += (tx.total || 0);
        }

        if (tx.credit_payments) {
          tx.credit_payments.forEach(pay => {
            if (!pay || !pay.date) return;
            const payDateStr = safeGetDateStr(pay.date);
            const isMatch = reportType === 'daily' ? payDateStr === selectedDate : (selectedMonth ? payDateStr.startsWith(selectedMonth) : true);
            if (isMatch) {
              supplierCreditPaid += (pay.amount || 0);
            }
          });
        }
      }
    });

    return {
      directCashSales,
      creditSales,
      customerCreditRecovered,
      directCashPurchases,
      creditPurchases,
      supplierCreditPaid
    };
  };

  // Wholesale metrics
  const computeWholesaleStats = (entityType: 'lahiru' | 'jayantha' | 'combined') => {
    let sales = 0;
    let profit = 0;
    let count = 0;

    (filteredTransactions || []).forEach(tx => {
      if (!tx) return;
      const isJayantha = (tx.id && tx.id.startsWith('J-')) || (tx.invoice_no && tx.invoice_no.startsWith('J-')) || (tx.createdBy && tx.createdBy.toLowerCase() === 'jayantha');
      const matches =
        entityType === 'combined' ||
        (entityType === 'jayantha' && isJayantha) ||
        (entityType === 'lahiru' && !isJayantha);

      if (!matches) return;

      if (tx.type === 'sell' && tx.is_wholesale) {
        sales += (tx.total || 0);
        count += 1;

        if (typeof tx.total_profit === 'number' && tx.total_profit > 0) {
          profit += tx.total_profit;
        } else {
          let txCost = 0;
          (tx.items || []).forEach(item => {
            if (!item) return;
            const prod = (products || []).find(p => p && p.id === item.productId);
            const bPrice = prod ? (prod.buying_price ?? prod.buyPrice ?? 0) : 0;
            let qtyInBase = item.qty || 0;
            if (prod && prod.unit === 'kg' && item.unit === 'g') {
              qtyInBase = (item.qty || 0) * 0.001;
            }
            txCost += bPrice * qtyInBase;
          });
          const itemRevenue = (tx.items || []).reduce((acc, item) => acc + (item ? item.total || 0 : 0), 0);
          const itemProfit = itemRevenue - txCost;
          const sub = tx.subtotal || tx.total || 0;
          const disc = tx.discount || 0;
          const ratio = sub > 0 ? (sub - disc) / sub : 1;
          profit += itemProfit * ratio;
        }
      }
    });

    return {
      sales,
      profit: Math.max(0, profit),
      count
    };
  };

  const lahiruWholesale = useMemo(() => computeWholesaleStats('lahiru'), [filteredTransactions, products]);
  const jayanthaWholesale = useMemo(() => computeWholesaleStats('jayantha'), [filteredTransactions, products]);

  const computeWholesaleProductBreakdown = (entityType: 'lahiru' | 'jayantha') => {
    const breakdown: Record<string, { name: string; qty: number; sales: number; profit: number; unit: string }> = {};

    (filteredTransactions || []).forEach(tx => {
      if (!tx) return;
      const isJayantha = (tx.id && tx.id.startsWith('J-')) || (tx.invoice_no && tx.invoice_no.startsWith('J-')) || (tx.createdBy && tx.createdBy.toLowerCase() === 'jayantha');
      const matches = (entityType === 'jayantha' && isJayantha) || (entityType === 'lahiru' && !isJayantha);

      if (!matches || tx.type !== 'sell' || !tx.is_wholesale) return;

      (tx.items || []).forEach(item => {
        if (!item) return;
        const prod = (products || []).find(p => p && p.id === item.productId);
        const prodName = prod ? prod.name : item.productId;
        const prodUnit = prod ? prod.unit : 'kg';
        const bPrice = prod ? (prod.buying_price ?? prod.buyPrice ?? 0) : 0;

        let qtyInBase = item.qty || 0;
        if (prod && prod.unit === 'kg' && item.unit === 'g') {
          qtyInBase = (item.qty || 0) * 0.001;
        }

        const itemCost = bPrice * qtyInBase;
        const itemRevenue = item.total || 0;
        const itemProfit = Math.max(0, itemRevenue - itemCost);

        if (!breakdown[item.productId]) {
          breakdown[item.productId] = {
            name: prodName,
            qty: 0,
            sales: 0,
            profit: 0,
            unit: prodUnit
          };
        }

        breakdown[item.productId].qty += qtyInBase;
        breakdown[item.productId].sales += itemRevenue;
        breakdown[item.productId].profit += itemProfit;
      });
    });

    return Object.values(breakdown);
  };

  const lahiruWholesaleProducts = useMemo(() => computeWholesaleProductBreakdown('lahiru'), [filteredTransactions, products]);
  const jayanthaWholesaleProducts = useMemo(() => computeWholesaleProductBreakdown('jayantha'), [filteredTransactions, products]);

  const salesTransactions = useMemo(() => filteredTransactions.filter(t => t.type === 'sell'), [filteredTransactions]);
  const purchaseTransactions = useMemo(() => filteredTransactions.filter(t => t.type === 'buy'), [filteredTransactions]);

  const exportDetailedReport = (
    entity: 'lahiru' | 'jayantha' | 'combined',
    format: 'csv' | 'excel' | 'pdf' = 'pdf'
  ) => {
    const isJayantha = entity === 'jayantha';
    const isLahiru = entity === 'lahiru';
    const brandName = isJayantha 
      ? 'Jayantha Spices (ජයන්ත කුළුබඩු)' 
      : isLahiru 
        ? 'Lahiya Spices (ලහියා කුළුබඩු)' 
        : 'Enterprise Consolidated (සමස්ත ව්‍යාපාරය)';
    
    const reportTitle = `${brandName} - ${reportType.toUpperCase()} FINANCIAL REPORT`;
    const timeFrameStr = reportType === 'daily' 
      ? `Date: ${selectedDate}` 
      : `Month: ${selectedMonth}`;
      
    const filename = `${entity}_spices_${reportType}_report_${reportType === 'daily' ? selectedDate : selectedMonth}`;

    const entityTransactions = filteredTransactions.filter(tx => {
      const isTxJayantha = tx.id.startsWith('J-') || tx.invoice_no?.startsWith('J-');
      return (
        entity === 'combined' ||
        (entity === 'jayantha' && isTxJayantha) ||
        (entity === 'lahiru' && !isTxJayantha)
      );
    });

    const stats = computeEntityStats(entity);
    const wsStats = computeWholesaleStats(entity);
    const creditBreakdown = computeCreditBreakdown(entity);
    const adjStats = computeAdjustmentStats(entity);

    const kpiList = [
      ...(reportType === 'daily' ? [
        { label: 'Total Morning Opening Cash Deposits (උදෑසන ආරම්භක මුදල් එකතුව)', value: `Rs. ${selectedOpeningCashTotal.toFixed(2)}` },
        { label: 'Deposit Log Entries Count (තැන්පතු වාර ගණන)', value: `${selectedOpeningCashLogs.length} Entries` }
      ] : []),
      { label: 'Total Sales Revenue (මුළු විකුණුම් එකතුව)', value: `Rs. ${stats.sales.toFixed(2)}` },
      { label: '  └─ Direct Cash Sales (අතින් ලැබුණු විකුණුම්)', value: `Rs. ${creditBreakdown.directCashSales.toFixed(2)}` },
      { label: '  └─ Credit Sales Issued (අලුතින් දුන් ණය විකුණුම්)', value: `Rs. ${creditBreakdown.creditSales.toFixed(2)}` },
      { label: '  └─ Customer Credit Recovered (එකතු කරගත් ණය)', value: `Rs. ${creditBreakdown.customerCreditRecovered.toFixed(2)}` },
      { label: 'Total Stock Buying Expenses (මිලදී ගැනීම් එකතුව)', value: `Rs. ${stats.buys.toFixed(2)}` },
      { label: '  └─ Direct Cash Purchases (අතින් ගෙවූ තොග)', value: `Rs. ${creditBreakdown.directCashPurchases.toFixed(2)}` },
      { label: '  └─ Credit Purchases (ණයට ගත් තොග)', value: `Rs. ${creditBreakdown.creditPurchases.toFixed(2)}` },
      { label: '  └─ Supplier Credit Paid (ගෙවූ සැපයුම්කාර ණය)', value: `Rs. ${creditBreakdown.supplierCreditPaid.toFixed(2)}` },
      { label: 'Stock Wastage & Damage Loss (තොග අඩුවීම් හා කුණු ඉවත් වීම් පාඩුව)', value: `-Rs. ${adjStats.totalLoss.toFixed(2)}` },
      { label: 'Shop Extra Expenses (අමතර කඩේ වියදම්)', value: `Rs. ${periodExpensesTotal.toFixed(2)}` },
      { label: 'Calculated Net Profit after Wastage (ශුද්ධ ලාභය)', value: `Rs. ${stats.profit.toFixed(2)}` },
      { label: 'Wholesale Revenue (තොග විකුණුම් ආදායම)', value: `Rs. ${wsStats.sales.toFixed(2)}` },
      { label: 'Wholesale Profit Margin (තොග විකුණුම් ලාභය)', value: `Rs. ${wsStats.profit.toFixed(2)}` },
      { label: 'Wholesale Bill Count (තොග බිල්පත් ගණන)', value: wsStats.count.toString() }
    ];

    const prodBreakdownMap: Record<string, { name: string; unit: string; qty: number; value: number; profit: number }> = {};
    
    entityTransactions.forEach(tx => {
      tx.items.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        const pName = prod ? prod.name : item.productId;
        const pUnit = prod ? prod.unit : 'kg';
        const bPrice = prod ? (prod.buying_price ?? prod.buyPrice) : 0;
        
        let qtyInBase = item.qty;
        if (prod && prod.unit === 'kg' && item.unit === 'g') {
          qtyInBase = item.qty * 0.001;
        }

        if (!prodBreakdownMap[item.productId]) {
          prodBreakdownMap[item.productId] = {
            name: pName,
            unit: pUnit,
            qty: 0,
            value: 0,
            profit: 0
          };
        }

        prodBreakdownMap[item.productId].qty += qtyInBase;
        prodBreakdownMap[item.productId].value += item.total;
        
        if (tx.type === 'sell') {
          const cost = bPrice * qtyInBase;
          prodBreakdownMap[item.productId].profit += Math.max(0, item.total - cost);
        }
      });
    });

    const formattedTxList = entityTransactions.map(tx => ({
      id: tx.id,
      date: tx.date,
      type: tx.type,
      party: tx.contactName || 'Walking Customer/Supplier',
      subtotal: tx.subtotal,
      discount: tx.discount || 0,
      total: tx.total,
      user: tx.createdBy
    }));

    const formattedProdList = Object.entries(prodBreakdownMap).map(([pid, data]) => ({
      id: pid,
      name: data.name,
      unit: data.unit,
      qty: data.qty,
      value: data.value,
      profit: data.profit
    }));

    const periodExpenses = (expenses || []).filter(exp => {
      if (!exp || !exp.date) return false;
      const expDateStr = safeGetDateStr(exp.date);
      if (!expDateStr) return false;
      if (reportType === 'daily') {
        return expDateStr === selectedDate;
      } else {
        return selectedMonth ? expDateStr.startsWith(selectedMonth) : true;
      }
    });

    const formattedAdjList = adjStats.items.map(a => {
      const reasonMeta = STOCK_ADJUSTMENT_REASONS.find(r => r.value === a.reason);
      return {
        id: a.id,
        date: a.date,
        productName: a.productName,
        qty: a.qty,
        unit: a.unit,
        reason: reasonMeta ? reasonMeta.label : a.reason,
        totalLoss: a.totalLoss,
        adjustedBy: a.adjustedBy,
        desk: a.desk === 'jayantha' ? 'ජයන්තා (Jayantha)' : 'ළහිරු (Lahiru)',
        note: a.reasonNote
      };
    });

    if (format === 'pdf') {
      printReportDocument(
        reportTitle,
        timeFrameStr,
        brandName,
        kpiList,
        formattedTxList,
        formattedProdList,
        periodExpenses,
        selectedOpeningCashLogs,
        formattedAdjList
      );
    } else if (format === 'excel') {
      exportToExcel(
        `${filename}.xls`,
        reportTitle,
        timeFrameStr,
        kpiList,
        formattedTxList,
        formattedProdList,
        periodExpenses,
        selectedOpeningCashLogs,
        formattedAdjList
      );
    } else {
      // CSV
      const headers = [`${brandName.toUpperCase()} - ${reportType.toUpperCase()} FINANCIAL SUMMARY REPORT`];
      const rows: string[][] = [
        ['Report Property', 'Details'],
        ['Report Name', `${reportType.toUpperCase()} FINANCIAL SUMMARY`],
        ['Brand Entity Name', brandName],
        ['Reporting Time Frame', timeFrameStr],
        ['Generated On Timestamp', new Date().toLocaleString()],
        ['', ''],
        ['--- FINANCIAL KEY PERFORMANCE INDICATORS (KPIs) ---', ''],
        ['KPI Metric Name', 'Financial Value (LKR)'],
        ...kpiList.map(k => [k.label, k.value]),
        ['', ''],
        ['--- OPENING CASH DEPOSITS LOG ---', ''],
        ['Log ID', 'Date & Time', 'Added By User', 'Deposited Amount (Rs.)'],
        ...selectedOpeningCashLogs.map(oc => [
          oc.id,
          new Date(oc.timestamp).toLocaleString(),
          `@${oc.addedBy}`,
          `+${oc.amount.toFixed(2)}`
        ]),
        ['', ''],
        ['--- STOCK ADJUSTMENTS & WASTAGE LOSS LOG ---', ''],
        ['Adj ID', 'Date & Time', 'Desk', 'Spice Product', 'Reason', 'Deducted Qty', 'Total Loss (Rs.)', 'Logged By', 'Note'],
        ...formattedAdjList.map(a => [
          a.id,
          new Date(a.date).toLocaleString(),
          a.desk,
          a.productName,
          a.reason,
          `${a.qty} ${a.unit}`,
          `-${a.totalLoss.toFixed(2)}`,
          `@${a.adjustedBy}`,
          a.note || ''
        ]),
        ['', ''],
        ['--- SHOP EXTRA EXPENSES LOG ---', ''],
        ['Expense ID', 'Date & Time', 'Category', 'Title / Note', 'Amount (Rs.)', 'Added By'],
        ...periodExpenses.map(e => [
          e.id,
          e.date,
          e.category,
          `${e.title}${e.note ? ` (${e.note})` : ''}`,
          `-${e.amount.toFixed(2)}`,
          e.addedBy
        ]),
        ['', ''],
        ['--- DETAILED TRANSACTION LOGS ---', ''],
        ['Transaction ID', 'Date & Time', 'Type', 'Party/Client Name', 'Subtotal (Rs.)', 'Discount (Rs.)', 'Grand Total Paid', 'Host Cashier / Desk'],
        ...formattedTxList.map(tx => [
          tx.id,
          tx.date,
          tx.type.toUpperCase(),
          tx.party,
          tx.subtotal.toFixed(2),
          tx.discount.toFixed(2),
          tx.total.toFixed(2),
          tx.user
        ]),
        ['', ''],
        ['--- PRODUCT PERFORMANCE BREAKDOWN ---', ''],
        ['Product ID', 'Product Name', 'Unit', 'Total Quantity Sold/Bought', 'Calculated Total Value (Rs.)', 'Estimated Net Profit Contribution (Rs.)'],
        ...formattedProdList.map(p => [
          p.id,
          p.name,
          p.unit,
          p.qty.toFixed(2),
          p.value.toFixed(2),
          p.profit.toFixed(2)
        ])
      ];
      exportToCSV(`${filename}.csv`, headers, rows);
    }
  };

  // Open 80mm Bluetooth Thermal Summary Modal
  const openThermalSummaryModal = (entityType: 'lahiru' | 'jayantha' | 'combined') => {
    const brandName = entityType === 'lahiru'
      ? 'Lahiru Spices'
      : (entityType === 'jayantha' ? 'Jayantha Spices' : 'Kulubadu Enterprise');

    const timeFrameStr = reportType === 'daily'
      ? formatDateString(selectedDate)
      : `මාසික වාර්තාව (${selectedMonth})`;

    const stats = entityType === 'lahiru'
      ? lahiruStats
      : (entityType === 'jayantha' ? jayanthaStats : combinedStats);

    const wholesaleStats = entityType === 'lahiru'
      ? lahiruWholesale
      : (entityType === 'jayantha' ? jayanthaWholesale : {
          sales: lahiruWholesale.sales + jayanthaWholesale.sales,
          profit: lahiruWholesale.profit + jayanthaWholesale.profit,
          count: lahiruWholesale.count + jayanthaWholesale.count
        });

    const creditStats = computeCreditBreakdown(entityType);

    const entityTransactions = filteredTransactions.filter(tx => {
      const isTxJayantha = tx.id.startsWith('J-') || tx.invoice_no?.startsWith('J-');
      if (entityType === 'jayantha') return isTxJayantha;
      if (entityType === 'lahiru') return !isTxJayantha;
      return true;
    });

    const prodBreakdownMap: Record<string, { id: string; name: string; unit: string; qty: number; value: number; profit: number }> = {};
    entityTransactions.forEach(tx => {
      tx.items.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        const pName = prod ? prod.name : item.productId;
        const pUnit = prod ? prod.unit : 'kg';
        const bPrice = prod ? (prod.buying_price ?? prod.buyPrice) : 0;

        let qtyInBase = item.qty;
        if (prod && prod.unit === 'kg' && item.unit === 'g') {
          qtyInBase = item.qty * 0.001;
        }

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
        prodBreakdownMap[item.productId].value += item.total;

        if (tx.type === 'sell') {
          const cost = bPrice * qtyInBase;
          prodBreakdownMap[item.productId].profit += Math.max(0, item.total - cost);
        }
      });
    });

    const productsBreakdown = Object.values(prodBreakdownMap).sort((a, b) => b.value - a.value);

    // Compute detailed sales audit
    let grossSales = 0;
    let discountsGiven = 0;
    let cardSales = 0;
    let totalCOGS = 0;

    entityTransactions.forEach(tx => {
      if (tx.type === 'sell') {
        grossSales += (tx.subtotal || tx.total);
        discountsGiven += (tx.discount || 0);
        const pm = (tx.payment_method || 'Cash').toLowerCase();
        if (pm === 'card' || pm === 'bank') {
          cardSales += tx.total;
        }
        tx.items.forEach(item => {
          const prod = products.find(p => p.id === item.productId);
          const bPrice = prod ? (prod.buying_price ?? prod.buyPrice) : 0;
          let qtyInBase = item.qty;
          if (prod && prod.unit === 'kg' && item.unit === 'g') {
            qtyInBase = item.qty * 0.001;
          }
          totalCOGS += bPrice * qtyInBase;
        });
      }
    });

    const periodExpenses = (expenses || []).filter(exp => {
      if (!exp || !exp.date) return false;
      const expDateStr = safeGetDateStr(exp.date);
      if (!expDateStr) return false;
      if (reportType === 'daily') {
        return expDateStr === selectedDate;
      } else {
        return selectedMonth ? expDateStr.startsWith(selectedMonth) : true;
      }
    });

    const expectedCashInDrawer = Math.max(
      0,
      selectedOpeningCashTotal +
      creditStats.directCashSales +
      creditStats.customerCreditRecovered -
      creditStats.directCashPurchases -
      creditStats.supplierCreditPaid -
      periodExpensesTotal
    );

    const dayOpeningCashLogs = selectedOpeningCashLogs;
    const openingCashUserSummaryMap: Record<string, number> = {};
    dayOpeningCashLogs.forEach(l => {
      const u = l.addedBy || 'admin';
      openingCashUserSummaryMap[u] = (openingCashUserSummaryMap[u] || 0) + l.amount;
    });
    const openingCashUserSummary = Object.entries(openingCashUserSummaryMap).map(([addedBy, totalAmount]) => ({
      addedBy,
      totalAmount
    }));

    setThermalModalData({
      entityType,
      reportType,
      selectedDate,
      selectedMonth,
      brandName,
      timeFrameStr,
      isZReport: reportType === 'daily',
      zSequenceNo: reportType === 'daily' ? `Z-${selectedDate.replace(/-/g, '')}-${entityType.toUpperCase().slice(0, 3)}01` : undefined,
      stats: {
        sales: stats.sales,
        salesCount: entityTransactions.filter(t => t.type === 'sell').length,
        buys: stats.buys,
        buysCount: entityTransactions.filter(t => t.type === 'buy').length,
        wastageLoss: stats.wastageLoss,
        expenses: periodExpensesTotal,
        openingCash: selectedOpeningCashTotal,
        profit: stats.profit
      },
      wholesaleStats,
      salesAudit: {
        grossSales: grossSales > 0 ? grossSales : stats.sales,
        discountsGiven,
        netSales: stats.sales,
        cardSales,
        directCashSales: creditStats.directCashSales,
        creditSales: creditStats.creditSales,
        customerCreditRecovered: creditStats.customerCreditRecovered,
        totalCashInflow: creditStats.directCashSales + creditStats.customerCreditRecovered
      },
      purchasesAudit: {
        directCashPurchases: creditStats.directCashPurchases,
        creditPurchases: creditStats.creditPurchases,
        supplierCreditPaid: creditStats.supplierCreditPaid,
        totalCashOutflow: creditStats.directCashPurchases + creditStats.supplierCreditPaid
      },
      creditStats,
      profitAndLoss: {
        grossRevenue: grossSales > 0 ? grossSales : stats.sales,
        discounts: discountsGiven,
        netRevenue: stats.sales,
        cogs: totalCOGS,
        grossProfit: stats.grossProfit,
        wastageLoss: stats.wastageLoss,
        operatingExpenses: periodExpensesTotal,
        netProfit: stats.profit
      },
      expensesList: periodExpenses.map(e => ({
        id: e.id,
        category: e.category,
        title: e.title,
        amount: e.amount,
        addedBy: e.addedBy
      })),
      drawerReconciliation: {
        openingCash: selectedOpeningCashTotal,
        cashSales: creditStats.directCashSales,
        creditRecovered: creditStats.customerCreditRecovered,
        cashPurchases: creditStats.directCashPurchases,
        supplierCreditPaid: creditStats.supplierCreditPaid,
        pettyCashExpenses: periodExpensesTotal,
        expectedCashInDrawer
      },
      openingCashLogs: dayOpeningCashLogs,
      openingCashUserSummary,
      productsBreakdown,
      shopProfile,
      currentUserUsername
    });
  };

  return (
    <div id="reportsPage" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/60 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
              <BarChart3 size={20} className="text-violet-400" />
              <span>Audit Reports & Ledger Summaries (මුදල් සහ තොග වාර්තා)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              ළහිරු Spices, ජයන්තා Spices සහ මුළු ආයතනයේම (Consolidated) මූල්‍ය සහ තොග වාර්තා.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex bg-slate-950/80 border border-slate-800 rounded-xl p-1 gap-1">
            <button
              onClick={() => setReportType('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase select-none cursor-pointer ${
                reportType === 'daily'
                  ? 'bg-violet-600/25 text-violet-400 border border-violet-800/40'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setReportType('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase select-none cursor-pointer ${
                reportType === 'monthly'
                  ? 'bg-violet-600/25 text-violet-400 border border-violet-800/40'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              Monthly
            </button>
          </div>

          {reportType === 'daily' ? (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setHasManuallySelected(true);
                setSelectedDate(e.target.value);
              }}
              className="bg-slate-950/60 border border-slate-800 text-slate-200 text-xs py-2.5 px-3 rounded-xl outline-none focus:border-violet-600 font-sans"
            />
          ) : (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setHasManuallySelected(true);
                setSelectedMonth(e.target.value);
              }}
              className="bg-slate-950/60 border border-slate-800 text-slate-200 text-xs py-2.5 px-3 rounded-xl outline-none focus:border-violet-600 font-sans"
            />
          )}
        </div>

        {/* Morning Opening Cash Deposit Banner */}
        {reportType === 'daily' && (
          <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-4 shadow-inner space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Banknote size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Total Morning Opening Cash (උදෑසන ආරම්භක මුදල් එකතුව):
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                      {formatCurrency(selectedOpeningCashTotal)}
                    </span>
                    <span className="text-xs text-slate-400">
                      ({selectedDate})
                    </span>
                  </div>
                </div>
              </div>

              {/* Per-User Summary Pill Badges */}
              {selectedOpeningCashLogs.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {Object.entries(
                    selectedOpeningCashLogs.reduce((acc, log) => {
                      const u = log.addedBy || 'admin';
                      acc[u] = (acc[u] || 0) + (log.amount || 0);
                      return acc;
                    }, {} as Record<string, number>)
                  ).map(([username, userTotal]) => (
                    <div key={username} className="px-3 py-1.5 bg-violet-600/20 border border-violet-500/30 rounded-xl flex items-center gap-1.5 text-xs font-mono">
                      <span className="text-violet-300 font-bold">@{username}:</span>
                      <span className="text-emerald-400 font-extrabold">+ Rs. {userTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedOpeningCashLogs.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2 border-t border-slate-900">
                {selectedOpeningCashLogs.map(log => {
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
                    <div key={log.id || Math.random().toString()} className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-violet-300 font-mono">
                          <User size={13} className="text-violet-400" />
                          <span>@{log.addedBy || 'user'}</span>
                        </div>
                        {timeStr && (
                          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
                            {timeStr}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-extrabold text-emerald-400 font-mono">
                        + Rs. {(log.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Entity Split Dashboard */}
      <div className={`grid grid-cols-1 ${(currentUserUsername === 'lahiru' || currentUserUsername === 'jayantha') ? '' : 'lg:grid-cols-3'} gap-6`}>
        {/* Lahiru Spices */}
        {currentUserUsername !== 'jayantha' && (
          <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden space-y-4">
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/5 rounded-full blur-2xl"></div>
            <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-violet-500 rounded-full inline-block"></span>
                <h4 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Lahiru Spices</h4>
              </div>
              <span className="text-[10px] bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded font-mono font-bold">L Series</span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/30">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-emerald-400" />
                  <span className="text-xs text-slate-400">Total Sales:</span>
                </div>
                <strong className="text-sm font-mono text-emerald-400">{formatCurrency(lahiruStats.sales)}</strong>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/30">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={14} className="text-amber-500" />
                  <span className="text-xs text-slate-400">Restocking:</span>
                </div>
                <strong className="text-sm font-mono text-amber-500">{formatCurrency(lahiruStats.buys)}</strong>
              </div>

              {lahiruAdjStats.totalLoss > 0 && (
                <div className="flex justify-between items-center py-1.5 border-b border-slate-800/30">
                  <div className="flex items-center gap-2">
                    <TrendingDown size={14} className="text-rose-400" />
                    <span className="text-xs text-rose-400 font-semibold">Wastage Loss (තොග අඩුවීම්):</span>
                  </div>
                  <strong className="text-sm font-mono text-rose-400 font-bold">-{formatCurrency(lahiruAdjStats.totalLoss)}</strong>
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <div className="flex items-center gap-2">
                  <DollarSign size={14} className="text-violet-400" />
                  <span className="text-xs text-slate-200 font-bold">Net Profit (ශුද්ධ ලාභය):</span>
                </div>
                <strong className="text-base font-mono text-violet-400 font-bold">{formatCurrency(lahiruStats.profit)}</strong>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/60 space-y-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Export / Print Summary (වාර්තා ලබාගන්න):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => openThermalSummaryModal('lahiru')}
                  className="py-2 px-2 bg-gradient-to-r from-violet-600/30 to-indigo-600/30 hover:from-violet-600/40 hover:to-indigo-600/40 text-violet-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-violet-500/40 shadow-sm"
                  title="80mm Bluetooth Thermal Printer එකෙන් සාරාංශ බිල ලබාගන්න"
                >
                  <Bluetooth size={13} className="text-violet-400" />
                  <span>80mm Thermal</span>
                </button>
                <button
                  onClick={() => exportDetailedReport('lahiru', 'pdf')}
                  className="py-2 px-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-violet-500/30 shadow-sm"
                  title="Print or Save as PDF Report"
                >
                  <Printer size={13} />
                  <span>PDF / Print</span>
                </button>
                <button
                  onClick={() => exportDetailedReport('lahiru', 'excel')}
                  className="py-2 px-2 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-500/20"
                  title="Export Excel Report (.xls)"
                >
                  <FileSpreadsheet size={13} />
                  <span>Excel</span>
                </button>
                <button
                  onClick={() => exportDetailedReport('lahiru', 'csv')}
                  className="py-2 px-2 bg-slate-800/60 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700/50"
                  title="Export raw CSV"
                >
                  <FileText size={13} />
                  <span>CSV</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Jayantha Spices */}
        {currentUserUsername !== 'lahiru' && (
          <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden space-y-4">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-600/5 rounded-full blur-2xl"></div>
            <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block"></span>
                <h4 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Jayantha Spices</h4>
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold">J Series</span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/30">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-emerald-400" />
                  <span className="text-xs text-slate-400">Total Sales:</span>
                </div>
                <strong className="text-sm font-mono text-emerald-400">{formatCurrency(jayanthaStats.sales)}</strong>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/30">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={14} className="text-amber-500" />
                  <span className="text-xs text-slate-400">Restocking:</span>
                </div>
                <strong className="text-sm font-mono text-amber-500">{formatCurrency(jayanthaStats.buys)}</strong>
              </div>

              {jayanthaAdjStats.totalLoss > 0 && (
                <div className="flex justify-between items-center py-1.5 border-b border-slate-800/30">
                  <div className="flex items-center gap-2">
                    <TrendingDown size={14} className="text-rose-400" />
                    <span className="text-xs text-rose-400 font-semibold">Wastage Loss (තොග අඩුවීම්):</span>
                  </div>
                  <strong className="text-sm font-mono text-rose-400 font-bold">-{formatCurrency(jayanthaAdjStats.totalLoss)}</strong>
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <div className="flex items-center gap-2">
                  <DollarSign size={14} className="text-emerald-400" />
                  <span className="text-xs text-slate-200 font-bold">Net Profit (ශුද්ධ ලාභය):</span>
                </div>
                <strong className="text-base font-mono text-emerald-400 font-bold">{formatCurrency(jayanthaStats.profit)}</strong>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/60 space-y-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Export / Print Summary (වාර්තා ලබාගන්න):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => openThermalSummaryModal('jayantha')}
                  className="py-2 px-2 bg-gradient-to-r from-emerald-600/30 to-teal-600/30 hover:from-emerald-600/40 hover:to-teal-600/40 text-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-500/40 shadow-sm"
                  title="80mm Bluetooth Thermal Printer එකෙන් සාරාංශ බිල ලබාගන්න"
                >
                  <Bluetooth size={13} className="text-emerald-400" />
                  <span>80mm Thermal</span>
                </button>
                <button
                  onClick={() => exportDetailedReport('jayantha', 'pdf')}
                  className="py-2 px-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-500/30 shadow-sm"
                  title="Print or Save as PDF Report"
                >
                  <Printer size={13} />
                  <span>PDF / Print</span>
                </button>
                <button
                  onClick={() => exportDetailedReport('jayantha', 'excel')}
                  className="py-2 px-2 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-500/20"
                  title="Export Excel Report (.xls)"
                >
                  <FileSpreadsheet size={13} />
                  <span>Excel</span>
                </button>
                <button
                  onClick={() => exportDetailedReport('jayantha', 'csv')}
                  className="py-2 px-2 bg-slate-800/60 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700/50"
                  title="Export raw CSV"
                >
                  <FileText size={13} />
                  <span>CSV</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Consolidated Enterprise */}
        {currentUserUsername !== 'lahiru' && currentUserUsername !== 'jayantha' && (
          <div className="bg-gradient-to-br from-indigo-950/15 to-slate-900/60 border border-slate-800/90 rounded-2xl p-5 shadow-lg relative overflow-hidden space-y-4">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl"></div>
            <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full inline-block"></span>
                <h4 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Enterprise Consolidated</h4>
              </div>
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-mono font-bold">All Series</span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/30">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-emerald-400 font-extrabold" />
                  <span className="text-xs text-slate-400">Enterprise Revenue:</span>
                </div>
                <strong className="text-sm font-mono text-emerald-400 font-extrabold">{formatCurrency(combinedStats.sales)}</strong>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/30">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={14} className="text-amber-500 font-extrabold" />
                  <span className="text-xs text-slate-400">Enterprise Stock:</span>
                </div>
                <strong className="text-sm font-mono text-amber-500 font-extrabold">{formatCurrency(combinedStats.buys)}</strong>
              </div>

              {combinedAdjStats.totalLoss > 0 && (
                <div className="flex justify-between items-center py-1.5 border-b border-slate-800/30">
                  <div className="flex items-center gap-2">
                    <TrendingDown size={14} className="text-rose-400 font-semibold" />
                    <span className="text-xs text-rose-400 font-bold">Wastage Loss (තොග අඩුවීම්):</span>
                  </div>
                  <strong className="text-sm font-mono text-rose-400 font-extrabold">-{formatCurrency(combinedAdjStats.totalLoss)}</strong>
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <div className="flex items-center gap-2">
                  <DollarSign size={14} className="text-indigo-400 font-extrabold" />
                  <span className="text-xs text-slate-200 font-bold">Consolidated Net Profit:</span>
                </div>
                <strong className="text-base font-mono text-indigo-400 font-extrabold">{formatCurrency(combinedStats.profit)}</strong>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/60 space-y-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Export / Print Summary (වාර්තා ලබාගන්න):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => openThermalSummaryModal('combined')}
                  className="py-2 px-2 bg-gradient-to-r from-indigo-600/30 to-violet-600/30 hover:from-indigo-600/40 hover:to-violet-600/40 text-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-indigo-500/40 shadow-sm"
                  title="80mm Bluetooth Thermal Printer එකෙන් සාරාංශ බිල ලබාගන්න"
                >
                  <Bluetooth size={13} className="text-indigo-400" />
                  <span>80mm Thermal</span>
                </button>
                <button
                  onClick={() => exportDetailedReport('combined', 'pdf')}
                  className="py-2 px-2 bg-indigo-600/25 hover:bg-indigo-600/35 text-indigo-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-indigo-500/30 shadow-sm"
                  title="Print or Save as PDF Report"
                >
                  <Printer size={13} />
                  <span>PDF / Print</span>
                </button>
                <button
                  onClick={() => exportDetailedReport('combined', 'excel')}
                  className="py-2 px-2 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-500/20"
                  title="Export Excel Report (.xls)"
                >
                  <FileSpreadsheet size={13} />
                  <span>Excel</span>
                </button>
                <button
                  onClick={() => exportDetailedReport('combined', 'csv')}
                  className="py-2 px-2 bg-slate-800/60 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700/50"
                  title="Export raw CSV"
                >
                  <FileText size={13} />
                  <span>CSV</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* STOCK ADJUSTMENT & WASTAGE LOSS SUMMARY SECTION */}
      {selectedStockAdjustments.length > 0 && (
        <div className="bg-slate-900/40 border border-amber-900/30 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                <TrendingDown size={18} />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span>Stock Adjustments & Wastage Loss</span>
                  <span className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold font-sans">
                    තොග අඩුවීම් හා කුණු ඉවත් වීම් පාඩු සාරාංශය
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400">
                  Total loss incurred from dust removal, drying weight loss, and product damage during this period.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-black text-rose-400 bg-rose-950/40 border border-rose-800/40 px-3 py-1 rounded-xl">
              Total Loss: {formatCurrency(combinedAdjStats.totalLoss)}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs border-collapse font-sans text-slate-300">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <th className="p-3">Date & Time</th>
                  <th className="p-3">Desk</th>
                  <th className="p-3">Spice Product</th>
                  <th className="p-3">Reason (හේතුව)</th>
                  <th className="p-3 text-right">Deducted Qty</th>
                  <th className="p-3 text-right">Loss Amount (රු. පාඩුව)</th>
                  <th className="p-3 text-center">Operator</th>
                  <th className="p-3">Note / Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/10 font-mono text-xs">
                {selectedStockAdjustments.map(adj => {
                  const meta = STOCK_ADJUSTMENT_REASONS.find(r => r.value === adj.reason) || {
                    label: 'වෙනත්',
                    badgeClass: 'bg-slate-800 text-slate-300'
                  };
                  return (
                    <tr key={adj.id} className="hover:bg-slate-800/20">
                      <td className="p-3 text-slate-400 whitespace-nowrap">
                        {new Date(adj.date).toLocaleDateString()} {new Date(adj.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          adj.desk === 'jayantha' ? 'bg-emerald-950 text-emerald-400' : 'bg-violet-950 text-violet-400'
                        }`}>
                          {adj.desk === 'jayantha' ? 'ජයන්තා' : 'ළහිරු'}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-200 font-sans">{adj.productName}</td>
                      <td className="p-3 font-sans">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.badgeClass}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="p-3 text-right font-extrabold text-amber-400">
                        -{adj.qty} {adj.unit}
                      </td>
                      <td className="p-3 text-right font-black text-rose-400">
                        Rs. {adj.totalLoss.toFixed(2)}
                      </td>
                      <td className="p-3 text-center font-sans text-[11px] text-slate-400">
                        @{adj.adjustedBy}
                      </td>
                      <td className="p-3 font-sans text-slate-400 text-[11px]">
                        {adj.reasonNote || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WHOLESALE SUMMARY SECTION */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Sparkles size={18} className="animate-pulse" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Daily Wholesale Summary</span>
                <span className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold font-sans">තොග විකුණුම් දෛනික සාරාංශය</span>
              </h3>
              <p className="text-[10px] text-slate-400">
                Track high-volume spice distributions, revenues, and profit margins separately.
              </p>
            </div>
          </div>
          <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2.5 py-0.5 rounded font-mono font-bold uppercase border border-amber-500/20">
            {reportType === 'daily' ? 'DAILY WHOLESALE' : 'MONTHLY WHOLESALE'}
          </span>
        </div>

        {/* Side-by-side or Single View depending on logged in user */}
        <div className={`grid grid-cols-1 ${currentUserUsername === 'lahiru' || currentUserUsername === 'jayantha' ? '' : 'lg:grid-cols-2'} gap-6`}>
          {/* Lahiru Wholesale block */}
          {currentUserUsername !== 'jayantha' && (
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
                <span className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                  Lahiru Wholesale (ළහිරු තොග විකුණුම්)
                </span>
                <span className="text-[10px] bg-violet-500/10 text-violet-400 px-2.5 py-0.5 rounded-full font-mono font-bold">
                  {lahiruWholesale.count} Bills
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Wholesale Revenue</span>
                  <strong className="text-sm font-mono text-emerald-400 mt-0.5 block">
                    {formatCurrency(lahiruWholesale.sales)}
                  </strong>
                </div>
                <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Wholesale Profit</span>
                  <strong className="text-sm font-mono text-violet-400 mt-0.5 block">
                    {formatCurrency(lahiruWholesale.profit)}
                  </strong>
                </div>
              </div>

              {/* Product breakdown table */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Spice Breakdown (කුළුබඩු විස්තරය)
                </span>
                <div className="bg-slate-950/80 border border-slate-800/60 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-900/50 text-slate-400 border-b border-slate-800 font-bold">
                        <th className="p-2.5">Spice</th>
                        <th className="p-2.5 text-center">Qty</th>
                        <th className="p-2.5 text-right">Revenue</th>
                        <th className="p-2.5 text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {lahiruWholesaleProducts.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-slate-500 font-sans text-xs">
                            No wholesale transactions found.
                          </td>
                        </tr>
                      ) : (
                        lahiruWholesaleProducts.map(p => (
                          <tr key={p.name} className="hover:bg-slate-900/20">
                            <td className="p-2.5 font-medium text-slate-300">{p.name}</td>
                            <td className="p-2.5 text-center font-mono font-bold text-slate-200">
                              {p.qty} {p.unit}
                            </td>
                            <td className="p-2.5 text-right font-mono text-emerald-400 font-semibold">
                              {formatCurrency(p.sales)}
                            </td>
                            <td className="p-2.5 text-right font-mono text-violet-400">
                              {formatCurrency(p.profit)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Jayantha Wholesale block */}
          {currentUserUsername !== 'lahiru' && (
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Jayantha Wholesale (ජයන්ත තොග විකුණුම්)
                </span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full font-mono font-bold">
                  {jayanthaWholesale.count} Bills
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Wholesale Revenue</span>
                  <strong className="text-sm font-mono text-emerald-400 mt-0.5 block">
                    {formatCurrency(jayanthaWholesale.sales)}
                  </strong>
                </div>
                <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Wholesale Profit</span>
                  <strong className="text-sm font-mono text-emerald-400 mt-0.5 block">
                    {formatCurrency(jayanthaWholesale.profit)}
                  </strong>
                </div>
              </div>

              {/* Product breakdown table */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Spice Breakdown (කුළුබඩු විස්තරය)
                </span>
                <div className="bg-slate-950/80 border border-slate-800/60 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-900/50 text-slate-400 border-b border-slate-800 font-bold">
                        <th className="p-2.5">Spice</th>
                        <th className="p-2.5 text-center">Qty</th>
                        <th className="p-2.5 text-right">Revenue</th>
                        <th className="p-2.5 text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {jayanthaWholesaleProducts.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-slate-500 font-sans text-xs">
                            No wholesale transactions found.
                          </td>
                        </tr>
                      ) : (
                        jayanthaWholesaleProducts.map(p => (
                          <tr key={p.name} className="hover:bg-slate-900/20">
                            <td className="p-2.5 font-medium text-slate-300">{p.name}</td>
                            <td className="p-2.5 text-center font-mono font-bold text-slate-200">
                              {p.qty} {p.unit}
                            </td>
                            <td className="p-2.5 text-right font-mono text-emerald-400 font-semibold">
                              {formatCurrency(p.sales)}
                            </td>
                            <td className="p-2.5 text-right font-mono text-emerald-400">
                              {formatCurrency(p.profit)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Details Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales List */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h4 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Sales History ({salesTransactions.length} bills)</span>
          </h4>
          <div className="divide-y divide-slate-800/80 max-h-80 overflow-y-auto pr-1">
            {salesTransactions.length === 0 ? (
              <p className="text-center py-12 text-slate-500 text-xs">No sales reported for this window.</p>
            ) : (
              salesTransactions.map(t => {
                if (!t) return null;
                const isJ = (t.id && t.id.startsWith('J-')) || (t.invoice_no && t.invoice_no.startsWith('J-')) || (t.createdBy && t.createdBy.toLowerCase() === 'jayantha');
                return (
                  <div key={t.id || Math.random().toString()} className="py-3 flex justify-between items-center text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">{t.id || 'N/A'}</span>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                          isJ ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                        }`}>
                          {isJ ? 'Jayantha' : 'Lahiru'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-1">{t.contactName || 'Walking Customer'} • {formatDateString(t.date)}</span>
                    </div>
                    <strong className="text-emerald-400 font-mono text-sm">{formatCurrency(t.total || 0)}</strong>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Purchase List */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>Purchased Supplies ({purchaseTransactions.length} orders)</span>
          </h3>
          <div className="divide-y divide-slate-800/80 max-h-80 overflow-y-auto pr-1">
            {purchaseTransactions.length === 0 ? (
              <p className="text-center py-12 text-slate-500 text-xs">No purchases reported for this window.</p>
            ) : (
              purchaseTransactions.map(t => {
                if (!t) return null;
                const isJ = (t.id && t.id.startsWith('J-')) || (t.invoice_no && t.invoice_no.startsWith('J-')) || (t.createdBy && t.createdBy.toLowerCase() === 'jayantha');
                return (
                  <div key={t.id || Math.random().toString()} className="py-3 flex justify-between items-center text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">{t.id || 'N/A'}</span>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                          isJ ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                        }`}>
                          {isJ ? 'Jayantha Stock' : 'Lahiru Stock'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-1">{t.contactName || 'Supplier'} • {formatDateString(t.date)}</span>
                    </div>
                    <strong className="text-amber-500 font-mono text-sm">{formatCurrency(t.total || 0)}</strong>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 80mm Bluetooth Thermal Summary Print Modal */}
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
