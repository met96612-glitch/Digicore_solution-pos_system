import React from 'react';
import { X, Printer, CheckCircle, FileText } from 'lucide-react';
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
                {data.isZReport ? 'Z-Report Daily Close' : 'Thermal Summary Report'}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {data.zSequenceNo || data.timeFrameStr}
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
            <p className="text-[10px] font-bold">END-OF-DAY Z-REPORT</p>
            <p className="text-[9px] text-gray-700">{data.timeFrameStr}</p>
            {data.zSequenceNo && (
              <p className="text-[9px] font-bold text-gray-900 mt-1">{data.zSequenceNo}</p>
            )}
          </div>

          {/* Sales Audit */}
          <div className="space-y-1 border-b border-dashed border-black/40 pb-3">
            <div className="flex justify-between font-bold text-gray-900 uppercase">
              <span>Gross Sales:</span>
              <span>Rs. {data.salesAudit.grossSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Discounts:</span>
              <span>- Rs. {data.salesAudit.discountsGiven.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-black text-black pt-1 border-t border-black/20">
              <span>NET REVENUE:</span>
              <span>Rs. {data.salesAudit.netSales.toFixed(2)}</span>
            </div>
          </div>

          {/* Cash Inflow & Drawer */}
          <div className="space-y-1 border-b border-dashed border-black/40 pb-3">
            <div className="flex justify-between text-gray-800">
              <span>Direct Cash Sales:</span>
              <span>Rs. {data.salesAudit.directCashSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-800">
              <span>Credit Recovered:</span>
              <span>Rs. {data.salesAudit.customerCreditRecovered.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-800">
              <span>Credit Sales Issued:</span>
              <span>Rs. {data.salesAudit.creditSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-black pt-1">
              <span>Opening Cash:</span>
              <span>Rs. {data.drawerReconciliation.openingCash.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-black text-emerald-700 text-sm pt-1 border-t border-black/20">
              <span>EXPECTED DRAWER:</span>
              <span>Rs. {data.drawerReconciliation.expectedCashInDrawer.toFixed(2)}</span>
            </div>
          </div>

          {/* Profit Summary */}
          <div className="space-y-1 text-center pt-1">
            <div className="flex justify-between font-bold text-black">
              <span>ESTIMATED NET PROFIT:</span>
              <span>Rs. {data.profitAndLoss.netProfit.toFixed(2)}</span>
            </div>
            <p className="text-[8px] text-gray-500 mt-2">Generated by Digicore POS Solution</p>
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
