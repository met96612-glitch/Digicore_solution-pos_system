import React from 'react';
import { X, Printer, FileText, UserCheck, DollarSign, ShoppingBag, Receipt } from 'lucide-react';
import { formatCurrency } from '../utils';

export interface SummaryReportPayload {
  entityType: string;
  reportType: string;
  selectedDate: string;
  selectedMonth?: string;
  brandName: string;
  timeFrameStr: string;
  isZReport?: boolean;
  zSequenceNo?: string;
  stats: {
    sales: number;
    salesCount: number;
    buys: number;
    buysCount: number;
    wastageLoss: number;
    expenses: number;
    openingCash: number;
    profit: number;
  };
  wholesaleStats?: {
    sales: number;
    profit: number;
    count: number;
  };
  salesAudit: {
    grossSales: number;
    discountsGiven: number;
    netSales: number;
    cardSales: number;
    directCashSales: number;
    creditSales: number;
    customerCreditRecovered: number;
    totalCashInflow: number;
  };
  purchasesAudit: {
    directCashPurchases: number;
    creditPurchases: number;
    supplierCreditPaid: number;
    totalCashOutflow: number;
  };
  creditStats: {
    directCashSales: number;
    creditSales: number;
    customerCreditRecovered: number;
    directCashPurchases: number;
    creditPurchases: number;
    supplierCreditPaid: number;
  };
  profitAndLoss: {
    grossRevenue: number;
    discounts: number;
    netRevenue: number;
    cogs: number;
    grossProfit: number;
    wastageLoss: number;
    operatingExpenses: number;
    netProfit: number;
  };
  expensesList?: Array<{
    id: string;
    category: string;
    title: string;
    amount: number;
    addedBy?: string;
  }>;
  drawerReconciliation: {
    openingCash: number;
    cashSales: number;
    creditRecovered: number;
    cashPurchases: number;
    supplierCreditPaid: number;
    pettyCashExpenses: number;
    expectedCashInDrawer: number;
  };
  openingCashLogs?: Array<{
    id: string;
    date: string;
    amount: number;
    addedBy: string;
    timestamp: number;
    note?: string;
  }>;
  openingCashUserSummary?: Array<{
    addedBy: string;
    totalAmount: number;
  }>;
  productsBreakdown?: Array<{
    id: string;
    name: string;
    unit: string;
    qty: number;
    value: number;
    profit: number;
  }>;
  shopProfile?: any;
  currentUserUsername?: string;
}

interface Props {
  data: SummaryReportPayload;
  onClose: () => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export default function ThermalSummaryModal({ data, onClose, onToast }: Props) {
  const handlePrint = () => {
    window.print();
    onToast('Z-Report printing triggered successfully!', 'success');
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#0f172a] border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 relative my-auto max-h-[90vh] overflow-y-auto font-sans">
        
        {/* Header Controls */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <FileText size={22} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                {data.isZReport ? 'Z-Report Daily Close (දෛනික ගිණුම් වසා දැමීම)' : 'Thermal Financial Summary'}
              </h3>
              <p className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                <span>{data.zSequenceNo || data.timeFrameStr}</span>
                {data.currentUserUsername && (
                  <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    @{data.currentUserUsername}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* 80mm Receipt Thermal Simulation Preview Box */}
        <div className="bg-white text-black p-6 rounded-2xl shadow-inner font-mono text-xs space-y-4 max-w-sm mx-auto border border-slate-300 select-none">
          <div className="text-center space-y-1 border-b border-dashed border-black/40 pb-3">
            <h2 className="text-sm font-black uppercase tracking-wider">{data.brandName}</h2>
            <p className="text-[10px] font-bold">END-OF-DAY Z-REPORT AUDIT</p>
            <p className="text-[9px] text-gray-700">{data.timeFrameStr}</p>
            {data.currentUserUsername && (
              <p className="text-[9px] font-bold text-gray-800 uppercase">Operator: @{data.currentUserUsername}</p>
            )}
            {data.zSequenceNo && (
              <p className="text-[9px] font-bold text-gray-900 mt-1">{data.zSequenceNo}</p>
            )}
          </div>

          {/* Sales Audit */}
          <div className="space-y-1 border-b border-dashed border-black/40 pb-3">
            <p className="font-bold text-[10px] text-gray-900 uppercase">--- SALES SUMMARY (විකුණුම්) ---</p>
            <div className="flex justify-between font-bold text-gray-900">
              <span>Gross Sales:</span>
              <span>Rs. {data.salesAudit.grossSales.toFixed(2)}</span>
            </div>
            {data.salesAudit.discountsGiven > 0 && (
              <div className="flex justify-between text-gray-700">
                <span>Discounts Given:</span>
                <span>- Rs. {data.salesAudit.discountsGiven.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-black pt-1 border-t border-black/20">
              <span>NET REVENUE:</span>
              <span>Rs. {data.salesAudit.netSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-700 pt-1">
              <span>  ├─ Direct Cash Sales:</span>
              <span>Rs. {data.salesAudit.directCashSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-700">
              <span>  ├─ Credit Sales Issued:</span>
              <span>Rs. {data.salesAudit.creditSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-700">
              <span>  └─ Customer Credit Recovered:</span>
              <span>Rs. {data.salesAudit.customerCreditRecovered.toFixed(2)}</span>
            </div>
          </div>

          {/* Restocking Purchases Audit */}
          <div className="space-y-1 border-b border-dashed border-black/40 pb-3">
            <p className="font-bold text-[10px] text-gray-900 uppercase">--- PURCHASES / RESTOCKING (මිලදී ගැනීම්) ---</p>
            <div className="flex justify-between text-gray-800">
              <span>Direct Cash Buys:</span>
              <span>Rs. {data.purchasesAudit.directCashPurchases.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-800">
              <span>Credit Purchases:</span>
              <span>Rs. {data.purchasesAudit.creditPurchases.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-800">
              <span>Supplier Credit Paid:</span>
              <span>Rs. {data.purchasesAudit.supplierCreditPaid.toFixed(2)}</span>
            </div>
          </div>

          {/* Shop Expenses Audit */}
          {data.profitAndLoss.operatingExpenses > 0 && (
            <div className="space-y-1 border-b border-dashed border-black/40 pb-3">
              <p className="font-bold text-[10px] text-gray-900 uppercase">--- SHOP OPERATING EXPENSES (වියදම්) ---</p>
              <div className="flex justify-between font-bold text-red-700">
                <span>Total Expenses:</span>
                <span>Rs. {data.profitAndLoss.operatingExpenses.toFixed(2)}</span>
              </div>
              {data.expensesList && data.expensesList.length > 0 && (
                <div className="pt-1 space-y-0.5">
                  {data.expensesList.slice(0, 5).map(e => (
                    <div key={e.id} className="flex justify-between text-[9px] text-gray-700">
                      <span className="truncate max-w-[160px]">· {e.title}</span>
                      <span>Rs. {e.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  {data.expensesList.length > 5 && (
                    <p className="text-[8px] text-gray-500 text-center">+ {data.expensesList.length - 5} more expenses...</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Profit & Loss Audit */}
          <div className="space-y-1 border-b border-dashed border-black/40 pb-3">
            <p className="font-bold text-[10px] text-gray-900 uppercase">--- PROFIT & LOSS AUDIT (ලබා අලාභ) ---</p>
            <div className="flex justify-between text-gray-800">
              <span>Net Revenue:</span>
              <span>Rs. {data.profitAndLoss.netRevenue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Cost of Goods (COGS):</span>
              <span>- Rs. {data.profitAndLoss.cogs.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 pt-0.5 border-t border-black/10">
              <span>Gross Profit:</span>
              <span>Rs. {data.profitAndLoss.grossProfit.toFixed(2)}</span>
            </div>
            {data.profitAndLoss.wastageLoss > 0 && (
              <div className="flex justify-between text-rose-700">
                <span>Wastage/Damage Loss:</span>
                <span>- Rs. {data.profitAndLoss.wastageLoss.toFixed(2)}</span>
              </div>
            )}
            {data.profitAndLoss.operatingExpenses > 0 && (
              <div className="flex justify-between text-rose-700">
                <span>Operating Expenses:</span>
                <span>- Rs. {data.profitAndLoss.operatingExpenses.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-emerald-800 text-sm pt-1 border-t border-black/30">
              <span>NET PROFIT (ශුද්ධ ලාභය):</span>
              <span>Rs. {data.profitAndLoss.netProfit.toFixed(2)}</span>
            </div>
          </div>

          {/* Shared Cash Drawer Reconciliation & Opening Cash Breakdown */}
          <div className="space-y-1 pt-1">
            <p className="font-bold text-[10px] text-gray-900 uppercase">--- SHARED CASH DRAWER (පොදු ලච්චුව) ---</p>
            <div className="flex justify-between font-bold text-gray-900">
              <span>Opening Cash Today:</span>
              <span>Rs. {(data.drawerReconciliation?.openingCash ?? 0).toFixed(2)}</span>
            </div>

            {/* Who deposited cash and how much */}
            {data.openingCashLogs && data.openingCashLogs.length > 0 && (
              <div className="py-1.5 border-t border-b border-black/10 my-1 space-y-1">
                <p className="text-[9px] font-bold text-gray-700 uppercase">Opening Cash Log (තැන්පත් කළ අය):</p>
                {data.openingCashLogs.map(l => {
                  let timeStr = '';
                  if (l.timestamp) {
                    try {
                      const d = new Date(l.timestamp);
                      if (!isNaN(d.getTime())) {
                        timeStr = ` (${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })})`;
                      }
                    } catch {
                      timeStr = '';
                    }
                  }
                  return (
                    <div key={l.id || Math.random().toString()} className="flex justify-between text-[9px] text-gray-800 font-mono">
                      <span>· @{l.addedBy || 'user'}{timeStr}:</span>
                      <span className="font-bold text-emerald-800">+ Rs. {(l.amount ?? 0).toFixed(2)}</span>
                    </div>
                  );
                })}
                {data.openingCashUserSummary && data.openingCashUserSummary.length > 0 && (
                  <div className="pt-1 border-t border-dashed border-black/20 space-y-0.5">
                    {data.openingCashUserSummary.map(u => (
                      <div key={u.addedBy} className="flex justify-between text-[9px] font-bold text-gray-900 font-mono">
                        <span>  └ Total @{u.addedBy}:</span>
                        <span className="text-emerald-800">Rs. {(u.totalAmount ?? 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between font-black text-black pt-1 border-t border-black/30">
              <span>EXPECTED CASH IN DRAWER:</span>
              <span>Rs. {(data.drawerReconciliation?.expectedCashInDrawer ?? 0).toFixed(2)}</span>
            </div>
            <p className="text-[8px] text-gray-500 text-center mt-2">Digicore POS System • Shared Cash Drawer Architecture</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all"
          >
            <Printer size={16} />
            <span>Print 80mm Thermal Receipt (මුද්‍රණය කරන්න)</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-2xl font-bold text-xs cursor-pointer transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

