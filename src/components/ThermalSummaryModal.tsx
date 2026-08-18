import React, { useState, useEffect, useRef } from 'react';
import { ShopProfile, Expense } from '../types';
import { toSinhalaProductName, formatCurrency } from '../utils';
import { convertCanvasToEscPosRaster } from './PrintReceipt';
import {
  X,
  Bluetooth,
  Printer,
  Download,
  Sparkles,
  Loader2,
  CheckCircle2,
  Moon,
  Banknote,
  TrendingUp,
  Receipt,
  Scale,
  Calculator,
  AlertTriangle
} from 'lucide-react';

export interface SummaryReportPayload {
  entityType: 'lahiru' | 'jayantha' | 'combined';
  reportType: 'daily' | 'monthly';
  selectedDate: string;
  selectedMonth: string;
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
  wholesaleStats: {
    sales: number;
    profit: number;
    count: number;
  };
  salesAudit?: {
    grossSales: number;
    discountsGiven: number;
    netSales: number;
    cardSales: number;
    directCashSales: number;
    creditSales: number;
    customerCreditRecovered: number;
    totalCashInflow: number;
  };
  purchasesAudit?: {
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
  profitAndLoss?: {
    grossRevenue: number;
    discounts: number;
    netRevenue: number;
    cogs: number; // Cost of goods sold (Buying price)
    grossProfit: number; // netRevenue - cogs
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
  drawerReconciliation?: {
    openingCash: number;
    cashSales: number;
    creditRecovered: number;
    cashPurchases: number;
    supplierCreditPaid: number;
    pettyCashExpenses: number;
    expectedCashInDrawer: number;
    actualCashCounted?: number;
    cashVariance?: number;
  };
  productsBreakdown: Array<{
    id: string;
    name: string;
    unit: string;
    qty: number;
    value: number;
    profit: number;
  }>;
  shopProfile?: ShopProfile;
  currentUserUsername?: string;
}

interface ThermalSummaryModalProps {
  data: SummaryReportPayload | null;
  onClose: () => void;
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function drawDottedLine(ctx: CanvasRenderingContext2D, y: number, width: number) {
  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.2;
  ctx.moveTo(10, y);
  ctx.lineTo(width - 10, y);
  ctx.stroke();
  ctx.restore();
}

function drawSolidLine(ctx: CanvasRenderingContext2D, y: number, width: number, thickness: number = 1.5) {
  ctx.beginPath();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = thickness;
  ctx.moveTo(10, y);
  ctx.lineTo(width - 10, y);
  ctx.stroke();
}

function drawDoubleLine(ctx: CanvasRenderingContext2D, y: number, width: number) {
  drawSolidLine(ctx, y, width, 1.2);
  drawSolidLine(ctx, y + 3, width, 1.2);
}

function drawLeftRightRow(
  ctx: CanvasRenderingContext2D,
  leftText: string,
  rightText: string,
  y: number,
  width: number,
  isBold: boolean = false,
  fontSize: number = 22,
  indent: number = 12,
  linePadding: number = 7
): number {
  ctx.font = `${isBold ? 'bold ' : ''}${fontSize}px sans-serif`;
  const leftW = ctx.measureText(leftText).width;
  const rightW = ctx.measureText(rightText).width;
  const availW = width - indent - 14;

  if (leftW + rightW + 10 <= availW) {
    ctx.textAlign = 'left';
    ctx.fillText(leftText, indent, y);
    ctx.textAlign = 'right';
    ctx.fillText(rightText, width - 14, y);
    return y + fontSize + linePadding;
  } else {
    // Wrap to two lines: Left title on line 1, Right value on line 2 (right-aligned) - Guaranteed NO OVERLAP
    ctx.textAlign = 'left';
    ctx.fillText(leftText, indent, y);
    const line2Y = y + fontSize + 3;
    ctx.textAlign = 'right';
    ctx.fillText(rightText, width - 14, line2Y);
    return line2Y + fontSize + linePadding;
  }
}

export function generateSummaryThermalCanvas(
  data: SummaryReportPayload,
  paperSize: '80mm' | '58mm' = '80mm',
  actualCashInput?: number | null
): HTMLCanvasElement {
  const is80 = paperSize === '80mm';
  const width = is80 ? 576 : 384;
  const isZ = !!data.isZReport;

  // Calculate generous dynamic height based on products & expenses count
  const expCount = (data.expensesList || []).length;
  const itemsCount = Math.min(data.productsBreakdown.length, 25);
  
  const baseHeight = is80 
    ? (isZ ? 2800 : 1800) 
    : (isZ ? 2200 : 1400);
  const itemsHeight = itemsCount * (is80 ? 70 : 50);
  const expHeight = expCount * (is80 ? 45 : 30);
  const totalAllocatedHeight = baseHeight + itemsHeight + expHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = totalAllocatedHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Solid white thermal background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, totalAllocatedHeight);

  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  let y = is80 ? 18 : 12;

  // 1. Resolve Shop Identity
  const isJayantha = data.entityType === 'jayantha';
  const isLahiru = data.entityType === 'lahiru';
  const isCombined = data.entityType === 'combined';

  let shopName = 'LAHIYA SPICES CENTER';
  let shopSinhala = 'ළහියා කුළුබඩු එකතු කිරීමේ මධ්‍යස්ථානය';
  let shopAddress = 'Wewalwatta, Rathnapura';
  let shopPhone = '074 0050211 / 076 0808246';

  if (isJayantha) {
    shopName = 'JAYANTHA SPICES CENTER';
    shopSinhala = 'ජයන්ත කුළුබඩු එකතු කිරීමේ මධ්‍යස්ථානය';
    shopPhone = '077 602 1831';
  } else if (isCombined) {
    shopName = 'KULUBADU ENTERPRISE';
    shopSinhala = 'සමස්ත කුළුබඩු මධ්‍යස්ථාන සාරාංශය';
    if (data.shopProfile?.shopName && data.shopProfile.shopName !== 'LAHIRU SPICES CENTER' && data.shopProfile.shopName !== 'LAHIYA SPICES CENTER') {
      shopName = data.shopProfile.shopName;
    }
  } else if (data.shopProfile?.shopName && data.shopProfile.shopName !== 'JAYANTHA SPICES CENTER' && data.shopProfile.shopName !== 'LAHIRU SPICES CENTER' && data.shopProfile.shopName !== 'LAHIYA SPICES CENTER') {
    shopName = data.shopProfile.shopName;
    if (data.shopProfile.shopSinhalaName) shopSinhala = data.shopProfile.shopSinhalaName;
  }

  // Shop Title (Bold 32px / 22px)
  ctx.font = is80 ? 'bold 32px sans-serif' : 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(shopName, width / 2, y);
  y += is80 ? 38 : 26;

  // Sinhala Subtitle
  if (shopSinhala) {
    ctx.font = is80 ? 'bold 24px sans-serif' : 'bold 16px sans-serif';
    ctx.fillText(shopSinhala, width / 2, y);
    y += is80 ? 32 : 22;
  }

  // Address & Phone
  if (shopAddress) {
    ctx.font = is80 ? '21px sans-serif' : '14px sans-serif';
    ctx.fillText(`📍 ${shopAddress}`, width / 2, y);
    y += is80 ? 28 : 19;
  }
  if (shopPhone) {
    ctx.font = is80 ? 'bold 21px sans-serif' : 'bold 14px sans-serif';
    ctx.fillText(`📞 ${shopPhone}`, width / 2, y);
    y += is80 ? 30 : 20;
  }

  drawSolidLine(ctx, y, width, is80 ? 2 : 1.5);
  y += is80 ? 14 : 10;

  // 2. Report Headline & Time Window
  const reportHeadline = isZ
    ? 'Z-REPORT (END OF DAY CLOSING)'
    : (data.reportType === 'daily' ? 'DAILY FINANCIAL SUMMARY' : 'MONTHLY FINANCIAL SUMMARY');

  ctx.font = is80 ? 'bold 25px sans-serif' : 'bold 17px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`*** ${reportHeadline} ***`, width / 2, y);
  y += is80 ? 32 : 22;

  // Desk / Entity Tag
  let entityLabel = 'LAHIRU DESK (L-SERIES)';
  if (isJayantha) entityLabel = 'JAYANTHA DESK (J-SERIES)';
  if (isCombined) entityLabel = 'ENTERPRISE CONSOLIDATED (ALL DESKS)';

  ctx.font = is80 ? 'bold 21px sans-serif' : 'bold 14px sans-serif';
  ctx.fillText(`[ ${entityLabel} ]`, width / 2, y);
  y += is80 ? 28 : 18;

  if (isZ) {
    const zSeq = data.zSequenceNo || `Z-${(data.selectedDate || '').replace(/-/g, '')}-01`;
    ctx.font = is80 ? 'bold 19px monospace' : 'bold 13px monospace';
    ctx.fillText(`REGISTER AUDIT REF: #${zSeq}`, width / 2, y);
    y += is80 ? 28 : 18;
  }

  drawDottedLine(ctx, y, width);
  y += is80 ? 14 : 10;

  // Metadata: Date Window & Printed Timestamp
  y = drawLeftRightRow(ctx, 'DATE / PERIOD:', data.timeFrameStr, y, width, true, is80 ? 21 : 14);
  const nowStr = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  y = drawLeftRightRow(ctx, 'PRINTED AT:', `${nowStr} (@${data.currentUserUsername || 'admin'})`, y, width, false, is80 ? 19 : 13);

  drawSolidLine(ctx, y, width, is80 ? 2 : 1.5);
  y += is80 ? 14 : 10;

  // 3. SALES AUDIT & REVENUE BREAKDOWN
  ctx.font = is80 ? 'bold 23px sans-serif' : 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('1. SALES & REVENUE (විකුණුම් හා ආදායම)', 12, y);
  y += is80 ? 30 : 20;

  const salesAudit = data.salesAudit || {
    grossSales: data.stats.sales,
    discountsGiven: 0,
    netSales: data.stats.sales,
    cardSales: 0,
    directCashSales: data.creditStats.directCashSales,
    creditSales: data.creditStats.creditSales,
    customerCreditRecovered: data.creditStats.customerCreditRecovered,
    totalCashInflow: data.creditStats.directCashSales + data.creditStats.customerCreditRecovered
  };

  if (salesAudit.discountsGiven > 0) {
    y = drawLeftRightRow(ctx, 'Gross Sales (දළ අලෙවිය):', `Rs. ${salesAudit.grossSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, width, false, is80 ? 20 : 13);
    y = drawLeftRightRow(ctx, 'Less: Discounts (ලබාදුන් වට්ටම්):', `-Rs. ${salesAudit.discountsGiven.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, width, false, is80 ? 20 : 13);
  }

  y = drawLeftRightRow(
    ctx,
    `Total Net Sales (මුළු ශුද්ධ විකුණුම් ${data.stats.salesCount} බිල්පත්):`,
    `Rs. ${data.stats.sales.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    y,
    width,
    true,
    is80 ? 22 : 15
  );

  // Tender Breakdown
  y = drawLeftRightRow(ctx, '  • Direct Cash Sales (මුදල් විකුණුම්):', `Rs. ${salesAudit.directCashSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, width, false, is80 ? 19 : 13);

  if (salesAudit.cardSales > 0) {
    y = drawLeftRightRow(ctx, '  • Card / Bank (කාඩ්පත්/බැංකු):', `Rs. ${salesAudit.cardSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, width, false, is80 ? 19 : 13);
  }

  if (salesAudit.creditSales > 0) {
    y = drawLeftRightRow(ctx, '  • Credit Sales (ණයට දුන්):', `Rs. ${salesAudit.creditSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, width, false, is80 ? 19 : 13);
  }

  if (salesAudit.customerCreditRecovered > 0) {
    y = drawLeftRightRow(ctx, '  • Credit Collected (පැරණි ණය අයවීම්):', `+Rs. ${salesAudit.customerCreditRecovered.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, width, false, is80 ? 19 : 13);
  }

  y = drawLeftRightRow(
    ctx,
    '  => TOTAL CASH COLLECTED (ලැබුණු මුදල්):',
    `Rs. ${salesAudit.totalCashInflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    y,
    width,
    true,
    is80 ? 21 : 14
  );

  drawDottedLine(ctx, y, width);
  y += is80 ? 14 : 10;

  // 4. PURCHASES AUDIT (මිලදී ගැනීම්)
  ctx.font = is80 ? 'bold 23px sans-serif' : 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('2. STOCK PURCHASES (කුළුබඩු මිලදී ගැනීම්)', 12, y);
  y += is80 ? 30 : 20;

  const purchasesAudit = data.purchasesAudit || {
    directCashPurchases: data.creditStats.directCashPurchases,
    creditPurchases: data.creditStats.creditPurchases,
    supplierCreditPaid: data.creditStats.supplierCreditPaid,
    totalCashOutflow: data.creditStats.directCashPurchases + data.creditStats.supplierCreditPaid
  };

  y = drawLeftRightRow(
    ctx,
    `Total Stock Buys (මිලදී ගැනීම් ${data.stats.buysCount} බිල්පත්):`,
    `Rs. ${data.stats.buys.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    y,
    width,
    true,
    is80 ? 21 : 14
  );

  y = drawLeftRightRow(ctx, '  • Direct Cash Buys (අත්පිට මුදලට):', `Rs. ${purchasesAudit.directCashPurchases.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, width, false, is80 ? 19 : 13);

  if (purchasesAudit.creditPurchases > 0) {
    y = drawLeftRightRow(ctx, '  • Credit Buys (ණයට ගත්):', `Rs. ${purchasesAudit.creditPurchases.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, width, false, is80 ? 19 : 13);
  }

  if (purchasesAudit.supplierCreditPaid > 0) {
    y = drawLeftRightRow(ctx, '  • Supplier Credit Paid (ණය පියවීම්):', `-Rs. ${purchasesAudit.supplierCreditPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, width, false, is80 ? 19 : 13);
  }

  y = drawLeftRightRow(
    ctx,
    '  => TOTAL CASH SPENT ON BUYS (මිලදී ගත් මුදල්):',
    `Rs. ${purchasesAudit.totalCashOutflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    y,
    width,
    true,
    is80 ? 21 : 14
  );

  drawDottedLine(ctx, y, width);
  y += is80 ? 14 : 10;

  // 5. EXPENSES & PETTY CASH TRACKING (සුළු වියදම්)
  ctx.font = is80 ? 'bold 23px sans-serif' : 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('3. PETTY CASH & EXPENSES (දවසේ සුළු වියදම්)', 12, y);
  y += is80 ? 30 : 20;

  if (!data.expensesList || data.expensesList.length === 0) {
    ctx.font = is80 ? 'italic 19px sans-serif' : 'italic 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('දවස තුළ සටහන් කළ සුළු වියදම් නොමැත (Rs. 0.00)', 14, y);
    y += is80 ? 26 : 18;
  } else {
    data.expensesList.forEach(exp => {
      const expTitle = `${exp.category ? `[${exp.category}] ` : ''}${exp.title}`;
      y = drawLeftRightRow(ctx, `  • ${expTitle}:`, `-Rs. ${exp.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, width, false, is80 ? 19 : 13);
    });
  }

  y = drawLeftRightRow(
    ctx,
    'Total Expenses (මුළු සුළු වියදම් එකතුව):',
    `-Rs. ${data.stats.expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    y,
    width,
    true,
    is80 ? 21 : 14
  );

  drawSolidLine(ctx, y, width, is80 ? 2 : 1.5);
  y += is80 ? 14 : 10;

  // 6. DAILY PROFIT & LOSS AUDIT (ලාභ අලාභ වාර්තාව)
  ctx.font = is80 ? 'bold 23px sans-serif' : 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('4. PROFIT & LOSS (දෛනික ලාභ අලාභ වාර්තාව)', 12, y);
  y += is80 ? 30 : 20;

  const pnl = data.profitAndLoss || {
    grossRevenue: data.stats.sales,
    discounts: 0,
    netRevenue: data.stats.sales,
    cogs: Math.max(0, data.stats.sales - (data.stats.profit + data.stats.wastageLoss + data.stats.expenses)),
    grossProfit: data.stats.profit + data.stats.wastageLoss + data.stats.expenses,
    wastageLoss: data.stats.wastageLoss,
    operatingExpenses: data.stats.expenses,
    netProfit: data.stats.profit
  };

  y = drawLeftRightRow(ctx, 'Net Sales Revenue (ශුද්ධ ආදායම):', `Rs. ${pnl.netRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, width, false, is80 ? 20 : 13);
  y = drawLeftRightRow(ctx, 'Cost of Goods / COGS (භාණ්ඩ ගැනුම් පිරිවැය):', `-Rs. ${pnl.cogs.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, width, false, is80 ? 20 : 13);

  drawDottedLine(ctx, y, width);
  y += is80 ? 8 : 6;

  y = drawLeftRightRow(ctx, 'GROSS PROFIT (දළ ලාභය):', `Rs. ${pnl.grossProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, width, true, is80 ? 22 : 15);

  if (pnl.wastageLoss > 0) {
    y = drawLeftRightRow(ctx, 'Less: Wastage / Damage (පාඩු):', `-Rs. ${pnl.wastageLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, width, false, is80 ? 19 : 13);
  }

  if (pnl.operatingExpenses > 0) {
    y = drawLeftRightRow(ctx, 'Less: Petty Cash / Expenses (වියදම්):', `-Rs. ${pnl.operatingExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, width, false, is80 ? 19 : 13);
  }

  y += is80 ? 4 : 2;
  drawSolidLine(ctx, y, width, is80 ? 2.5 : 2);
  y += is80 ? 10 : 8;

  // NET PROFIT HIGHLIGHT BOX - Robust non-overlapping design
  const boxHeight = is80 ? 68 : 50;
  ctx.lineWidth = is80 ? 2 : 1.5;
  ctx.strokeRect(10, y, width - 20, boxHeight);
  
  ctx.font = is80 ? 'bold 21px sans-serif' : 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('NET PROFIT (ශුද්ධ ලාභය):', 20, y + (is80 ? 12 : 8));

  ctx.font = is80 ? 'bold 26px sans-serif' : 'bold 18px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`Rs. ${pnl.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, width - 20, y + (is80 ? 34 : 24));

  y += boxHeight + (is80 ? 16 : 12);
  drawSolidLine(ctx, y, width, is80 ? 2 : 1.5);
  y += is80 ? 14 : 10;

  // 7. CASH DRAWER / TILL RECONCILIATION (මුදල් ලාච්චුවේ ශේෂය)
  ctx.font = is80 ? 'bold 23px sans-serif' : 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('5. CASH DRAWER AUDIT (ලාච්චුවේ මුදල් ශේෂය)', 12, y);
  y += is80 ? 30 : 20;

  const drawer = data.drawerReconciliation || {
    openingCash: data.stats.openingCash,
    cashSales: salesAudit.directCashSales,
    creditRecovered: salesAudit.customerCreditRecovered,
    cashPurchases: purchasesAudit.directCashPurchases,
    supplierCreditPaid: purchasesAudit.supplierCreditPaid,
    pettyCashExpenses: data.stats.expenses,
    expectedCashInDrawer: Math.max(0, data.stats.openingCash + salesAudit.directCashSales + salesAudit.customerCreditRecovered - purchasesAudit.directCashPurchases - purchasesAudit.supplierCreditPaid - data.stats.expenses),
    actualCashCounted: actualCashInput ?? undefined,
    cashVariance: actualCashInput !== undefined && actualCashInput !== null ? (actualCashInput - Math.max(0, data.stats.openingCash + salesAudit.directCashSales + salesAudit.customerCreditRecovered - purchasesAudit.directCashPurchases - purchasesAudit.supplierCreditPaid - data.stats.expenses)) : undefined
  };

  y = drawLeftRightRow(ctx, '(+) Morning Opening Cash (ආරම්භක මුදල්):', `+Rs. ${drawer.openingCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, width, false, is80 ? 20 : 13);
  y = drawLeftRightRow(ctx, '(+) Direct Cash Sales (මුදල් විකුණුම්):', `+Rs. ${drawer.cashSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, width, false, is80 ? 20 : 13);

  if (drawer.creditRecovered > 0) {
    y = drawLeftRightRow(ctx, '(+) Credit Recoveries (ණය අයවීම්):', `+Rs. ${drawer.creditRecovered.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, width, false, is80 ? 20 : 13);
  }

  if (drawer.cashPurchases > 0) {
    y = drawLeftRightRow(ctx, '(-) Cash Stock Buys (මුදල් මිලදී ගැනීම්):', `-Rs. ${drawer.cashPurchases.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, width, false, is80 ? 20 : 13);
  }

  if (drawer.supplierCreditPaid > 0) {
    y = drawLeftRightRow(ctx, '(-) Supplier Credit Paid (ණය පියවීම්):', `-Rs. ${drawer.supplierCreditPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, width, false, is80 ? 20 : 13);
  }

  if (drawer.pettyCashExpenses > 0) {
    y = drawLeftRightRow(ctx, '(-) Petty Cash / Expenses (දවසේ වියදම්):', `-Rs. ${drawer.pettyCashExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, width, false, is80 ? 20 : 13);
  }

  drawDottedLine(ctx, y, width);
  y += is80 ? 8 : 6;

  // EXPECTED DRAWER CASH
  y = drawLeftRightRow(
    ctx,
    '(=) EXPECTED DRAWER CASH (තිබිය යුතු මුදල):',
    `Rs. ${drawer.expectedCashInDrawer.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    y,
    width,
    true,
    is80 ? 22 : 15
  );

  // If actual cash was entered
  if (actualCashInput !== undefined && actualCashInput !== null) {
    const diff = actualCashInput - drawer.expectedCashInDrawer;
    y = drawLeftRightRow(
      ctx,
      '  • Actual Cash Counted (ගණනය කළ මුදල):',
      `Rs. ${actualCashInput.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      y,
      width,
      true,
      is80 ? 20 : 13
    );

    let diffText = '0.00 (Balanced / නිවැරදියි)';
    if (diff > 0) diffText = `+Rs. ${diff.toLocaleString('en-US', { minimumFractionDigits: 2 })} (OVER)`;
    else if (diff < 0) diffText = `-Rs. ${Math.abs(diff).toLocaleString('en-US', { minimumFractionDigits: 2 })} (SHORT)`;

    y = drawLeftRightRow(
      ctx,
      '  • Cash Difference (වෙනස):',
      diffText,
      y,
      width,
      true,
      is80 ? 20 : 13
    );
  }

  drawSolidLine(ctx, y, width, is80 ? 2 : 1.5);
  y += is80 ? 14 : 10;

  // 8. PRODUCT SPICE BREAKDOWN (කුළුබඩු විස්තරය) - 2-Tier non-overlapping layout
  ctx.font = is80 ? 'bold 23px sans-serif' : 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('6. SPICE BREAKDOWN (කුළුබඩු විකිණුම් විස්තරය)', 12, y);
  y += is80 ? 30 : 20;

  drawDottedLine(ctx, y, width);
  y += is80 ? 10 : 6;

  // Product Rows
  if (data.productsBreakdown.length === 0) {
    ctx.font = is80 ? 'italic 19px sans-serif' : 'italic 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('මෙම කාලය තුළ විකිණුම් දත්ත නොමැත.', width / 2, y);
    y += is80 ? 30 : 20;
  } else {
    data.productsBreakdown.slice(0, 25).forEach(prod => {
      // Row Tier 1: Spice Name in Bold
      ctx.font = is80 ? 'bold 21px sans-serif' : 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      const sName = toSinhalaProductName(prod.name);
      ctx.fillText(sName, 12, y);
      y += is80 ? 25 : 17;

      // Row Tier 2: Qty & Total Sales (Left) and Profit (Right)
      ctx.font = is80 ? '19px sans-serif' : '13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`  ${prod.qty.toFixed(1)} ${prod.unit}  •  Sales: Rs. ${prod.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, 14, y);

      ctx.font = is80 ? 'bold 19px sans-serif' : 'bold 13px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Profit: Rs. ${prod.profit.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, width - 14, y);

      y += is80 ? 28 : 19;
    });
  }

  drawDottedLine(ctx, y, width);
  y += is80 ? 18 : 12;

  // 9. SIGNATURES (Z-Report Audit Verification)
  if (isZ) {
    ctx.font = is80 ? '19px sans-serif' : '13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('.................................', 20, y);
    ctx.textAlign = 'right';
    ctx.fillText('.................................', width - 20, y);
    y += is80 ? 24 : 16;

    ctx.font = is80 ? 'bold 17px sans-serif' : 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Cashier / Operator', 30, y);
    ctx.textAlign = 'right';
    ctx.fillText('Manager / Auditor', width - 30, y);
    y += is80 ? 30 : 20;

    drawSolidLine(ctx, y, width, is80 ? 2 : 1.5);
    y += is80 ? 14 : 10;
  }

  // 10. Footer
  ctx.font = is80 ? 'bold 21px sans-serif' : 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isZ ? '*** END OF Z-REPORT (CLOSE REGISTER) ***' : '*** END OF SUMMARY REPORT ***', width / 2, y);
  y += is80 ? 28 : 18;

  ctx.font = is80 ? '17px sans-serif' : '11px sans-serif';
  ctx.fillText('Software Powered by Digicore Solution', width / 2, y);
  y += is80 ? 30 : 20;

  // Auto-trim canvas to actual height used (zero extra blank paper, zero cutoff)
  const finalHeight = Math.max(300, y + (is80 ? 20 : 15));
  const trimmedCanvas = document.createElement('canvas');
  trimmedCanvas.width = width;
  trimmedCanvas.height = finalHeight;
  const trimmedCtx = trimmedCanvas.getContext('2d');
  if (trimmedCtx) {
    trimmedCtx.fillStyle = '#FFFFFF';
    trimmedCtx.fillRect(0, 0, width, finalHeight);
    trimmedCtx.drawImage(canvas, 0, 0, width, finalHeight, 0, 0, width, finalHeight);
    return trimmedCanvas;
  }

  return canvas;
}

export default function ThermalSummaryModal({
  data,
  onClose,
  onToast
}: ThermalSummaryModalProps) {
  const [paperSize, setPaperSize] = useState<'80mm' | '58mm'>('80mm');
  const [reportMode, setReportMode] = useState<'z_report' | 'summary'>('z_report');
  const [actualCashInput, setActualCashInput] = useState<string>('');
  const [printing, setPrinting] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Set default report mode from data payload
  useEffect(() => {
    if (data?.isZReport) {
      setReportMode('z_report');
    }
  }, [data]);

  // Generate preview when modal opens, paper size changes, or actual cash changes
  useEffect(() => {
    if (!data) return;
    try {
      const parsedActualCash = actualCashInput.trim() !== '' && !isNaN(Number(actualCashInput))
        ? Number(actualCashInput)
        : null;

      const enrichedData: SummaryReportPayload = {
        ...data,
        isZReport: reportMode === 'z_report'
      };

      const canvas = generateSummaryThermalCanvas(enrichedData, paperSize, parsedActualCash);
      canvasRef.current = canvas;
      setPreviewUrl(canvas.toDataURL('image/png'));
    } catch (e) {
      console.error('Failed to generate summary thermal preview:', e);
    }
  }, [data, paperSize, reportMode, actualCashInput]);

  if (!data) return null;

  const currentPayload: SummaryReportPayload = {
    ...data,
    isZReport: reportMode === 'z_report'
  };

  const parsedActual = actualCashInput.trim() !== '' && !isNaN(Number(actualCashInput))
    ? Number(actualCashInput)
    : null;

  const expectedDrawerCash = data.drawerReconciliation?.expectedCashInDrawer ?? 0;
  const cashDifference = parsedActual !== null ? parsedActual - expectedDrawerCash : null;

  // 1. Direct Web Bluetooth Print (ESC/POS Raster)
  const handleBluetoothPrint = async () => {
    if (!data) return;

    if (!('bluetooth' in navigator)) {
      onToast?.('ඔබගේ Browser එකෙහි Web Bluetooth පහසුකම නැත. RawBT app එක වෙත යොමු කෙරේ...', 'error');
      handleRawBtPrint();
      return;
    }

    setPrinting(true);

    try {
      onToast?.(`Bluetooth Thermal Printer (${paperSize}) සොයමින්...`, 'info');
      const navBt = (navigator as any).bluetooth;

      const device = await navBt.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer service
          '49535343-fe7d-41aa-a37b-ab3713738837', // ISSC SPP Serial
          '00001101-0000-1000-8000-00805f9b34fb', // Bluetooth Serial Port
          '0000ff00-0000-1000-8000-00805f9b34fb',
          '0000af00-0000-1000-8000-00805f9b34fb',
          '0000e025-0000-1000-8000-00805f9b34fb',
          '00004953-0000-1000-8000-00805f9b34fb',
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
          '00001800-0000-1000-8000-00805f9b34fb',
          '00001801-0000-1000-8000-00805f9b34fb',
          '0000180a-0000-1000-8000-00805f9b34fb'
        ]
      });

      if (!device) {
        setPrinting(false);
        return;
      }

      setConnectedDevice(device.name || 'Bluetooth Printer');
      onToast?.(`"${device.name || 'Printer'}" වෙත සම්බන්ධ වෙමින්...`, 'info');

      device.addEventListener('gattserverdisconnected', () => {
        setConnectedDevice(null);
      });

      const canvas = generateSummaryThermalCanvas(currentPayload, paperSize, parsedActual);
      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();

      let writeChar: any = null;
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const c of characteristics) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              writeChar = c;
              break;
            }
          }
        } catch (e) {
          console.warn('GATT service search:', e);
        }
        if (writeChar) break;
      }

      if (!writeChar) {
        throw new Error('No write characteristic found on printer');
      }

      // Convert to ESC/POS Raster bitmap
      const escRasterBytes = convertCanvasToEscPosRaster(canvas);

      const CHUNK_SIZE = 128;
      for (let i = 0; i < escRasterBytes.length; i += CHUNK_SIZE) {
        const chunk = escRasterBytes.slice(i, i + CHUNK_SIZE);
        if (writeChar.properties.writeWithoutResponse) {
          await writeChar.writeValueWithoutResponse(chunk);
        } else {
          await writeChar.writeValue(chunk);
        }
        await new Promise(res => setTimeout(res, 15));
      }

      setPrinting(false);
      onToast?.(`සිංහල අකුරු සහිත ${paperSize} ${reportMode === 'z_report' ? 'Z-Report' : 'Summary Report'} ${device.name || 'Printer'} වෙතින් සාර්ථකව මුද්‍රණය විය!`, 'success');
    } catch (err: any) {
      console.warn('Direct Bluetooth print error:', err);
      setPrinting(false);
      if (err.name === 'NotFoundError') {
        onToast?.('Bluetooth Printer තේරීම අවලංගු කරන ලදී.', 'info');
      } else {
        onToast?.('Direct Bluetooth සම්බන්ධතාව සාර්ථක නැත. RawBT app එක වෙත යොමු කෙරේ...', 'error');
        setTimeout(() => {
          handleRawBtPrint();
        }, 300);
      }
    }
  };

  // 2. RawBT Android App Scheme Print
  const handleRawBtPrint = () => {
    if (!data) return;
    try {
      const canvas = generateSummaryThermalCanvas(currentPayload, paperSize, parsedActual);
      const dataUrl = canvas.toDataURL('image/png');
      const base64Png = dataUrl.replace(/^data:image\/png;base64,/, '');

      onToast?.(`RawBT වෙත ${paperSize} Image Summary සූදානම් කෙරේ...`, 'info');
      const rawbtUrl = `rawbt:data:image/png;base64,${base64Png}`;
      window.location.href = rawbtUrl;

      setTimeout(() => {
        onToast?.('RawBT app එක විවෘත නොවූයේ නම් Browser Print හෝ Image බාගත කිරීම භාවිතා කරන්න.', 'info');
      }, 2500);
    } catch (e) {
      console.error('RawBT print error:', e);
      onToast?.('RawBT ආකෘතිය සෑදීම අසාර්ථක විය.', 'error');
    }
  };

  // 3. Browser Print (Clean 80mm Roll CSS)
  const handleBrowserPrint = () => {
    if (!previewUrl) return;

    const printWin = window.open('', '_blank', 'width=600,height=800');
    if (!printWin) {
      onToast?.('Popup Window විවෘත කිරීම Browser එක මඟින් අවහිර කර ඇත. කරුණාකර allow කරන්න.', 'error');
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${data.brandName} - ${reportMode === 'z_report' ? 'Z-Report' : 'Summary'}</title>
          <style>
            @page {
              margin: 0;
              size: ${paperSize === '80mm' ? '80mm' : '58mm'} auto;
            }
            body {
              margin: 0;
              padding: 0;
              background: #fff;
              display: flex;
              justify-content: center;
              font-family: sans-serif;
            }
            img {
              width: 100%;
              max-width: ${paperSize === '80mm' ? '72mm' : '52mm'};
              display: block;
              margin: 0 auto;
            }
          </style>
        </head>
        <body>
          <img src="${previewUrl}" onload="window.print(); setTimeout(() => window.close(), 1000);" />
        </body>
      </html>
    `);
    printWin.document.close();
  };

  // 4. Download Image
  const handleDownloadImage = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `${data.brandName.toLowerCase().replace(/\s+/g, '_')}_${reportMode}_${data.selectedDate || data.selectedMonth}_${paperSize}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onToast?.(`${paperSize} Thermal Image එක බාගත කරන ලදී.`, 'success');
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[95vh] my-auto">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <Printer size={20} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>{reportMode === 'z_report' ? 'Z-Report (End of Day Audit)' : 'Financial Summary Slip'}</span>
                <span className="text-[10px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full font-mono font-bold border border-violet-500/30">
                  {data.brandName}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                80mm Bluetooth POS / Direct Print / Drawer Reconciliation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Report Mode Tabs */}
            <div className="flex bg-slate-900 border border-slate-700 rounded-xl p-1 text-xs">
              <button
                onClick={() => setReportMode('z_report')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  reportMode === 'z_report'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Moon size={13} />
                <span>Z-Report (Day End)</span>
              </button>
              <button
                onClick={() => setReportMode('summary')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  reportMode === 'summary'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <TrendingUp size={13} />
                <span>Quick Summary</span>
              </button>
            </div>

            {/* Paper Size Selector */}
            <div className="flex bg-slate-900 border border-slate-700 rounded-xl p-1 text-xs">
              <button
                onClick={() => setPaperSize('80mm')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  paperSize === '80mm'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                80mm
              </button>
              <button
                onClick={() => setPaperSize('58mm')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  paperSize === '58mm'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                58mm
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex flex-col md:flex-row gap-6 items-center md:items-start justify-center bg-slate-950/40">
          {/* Visual Receipt Paper Preview Container */}
          <div className="flex-1 w-full max-w-sm flex flex-col items-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-400" />
              <span>Thermal Slip Preview ({paperSize} - {reportMode === 'z_report' ? 'Z-Report' : 'Summary'})</span>
            </span>

            <div className="w-full bg-white rounded-xl shadow-2xl p-2 sm:p-3 overflow-hidden border-2 border-slate-400/20 max-h-[62vh] overflow-y-auto">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="80mm Thermal Receipt Preview"
                  className="w-full h-auto block rounded shadow-inner"
                />
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-500 font-mono text-xs">
                  Generating preview...
                </div>
              )}
            </div>
          </div>

          {/* Action Control Panel & Drawer Reconciliation Form */}
          <div className="w-full md:w-72 space-y-4 flex flex-col justify-center">
            {/* Drawer Cash Audit Calculator Card */}
            {reportMode === 'z_report' && (
              <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl space-y-2.5">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                  <Calculator size={14} />
                  <span>Drawer Reconciliation (ලාච්චුවේ මුදල්)</span>
                </span>

                <div className="text-xs space-y-1 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <div className="flex justify-between text-slate-400">
                    <span>Expected in Till:</span>
                    <strong className="text-emerald-400 font-mono">{formatCurrency(expectedDrawerCash)}</strong>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 font-semibold mt-2 mb-1">
                      Actual Physical Cash (ගණනය කළ මුදල):
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs text-slate-500 font-mono">Rs.</span>
                      <input
                        type="number"
                        step="any"
                        placeholder={expectedDrawerCash.toString()}
                        value={actualCashInput}
                        onChange={(e) => setActualCashInput(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {cashDifference !== null && (
                    <div className={`mt-2 p-2 rounded-lg text-xs font-bold flex items-center justify-between ${
                      cashDifference === 0
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                        : cashDifference > 0
                        ? 'bg-sky-950/60 text-sky-400 border border-sky-500/30'
                        : 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                    }`}>
                      <span>{cashDifference === 0 ? 'Balanced (සමබරයි)' : cashDifference > 0 ? 'Over (අතිරික්ත)' : 'Short (හිඟය)'}:</span>
                      <span className="font-mono">
                        {cashDifference > 0 ? `+Rs. ${cashDifference.toLocaleString()}` : `-Rs. ${Math.abs(cashDifference).toLocaleString()}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Print Buttons Card */}
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-3">
              <span className="text-xs font-bold text-slate-300 block border-b border-slate-800 pb-1.5">
                Print & Export Actions
              </span>

              {/* 1. Direct Web Bluetooth Button */}
              <button
                onClick={handleBluetoothPrint}
                disabled={printing}
                className="w-full py-3 px-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {printing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>මුද්‍රණය වෙමින් පවතී...</span>
                  </>
                ) : (
                  <>
                    <Bluetooth size={16} />
                    <span>Direct Bluetooth Print ({paperSize})</span>
                  </>
                )}
              </button>

              {connectedDevice && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                  <CheckCircle2 size={13} />
                  <span className="truncate">Connected: {connectedDevice}</span>
                </div>
              )}

              {/* 2. RawBT Android App Button */}
              <button
                onClick={handleRawBtPrint}
                className="w-full py-2.5 px-3 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Printer size={15} />
                <span>RawBT (Android App)</span>
              </button>

              {/* 3. Browser Print Button */}
              <button
                onClick={handleBrowserPrint}
                className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Printer size={15} />
                <span>Browser Thermal Print</span>
              </button>

              {/* 4. Download Image Button */}
              <button
                onClick={handleDownloadImage}
                className="w-full py-2.5 px-3 bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-700/60 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Download size={15} />
                <span>Save PNG Slip</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-400 space-y-1 bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
              <strong className="text-slate-300 block">💡 Z-Report විශේෂාංග:</strong>
              <p>• <strong>Gross & Net Profit:</strong> භාණ්ඩවල Cost Price සහ Selling Price මත පදනම්ව නිවැරදිව ගණනය වේ.</p>
              <p>• <strong>Petty Cash:</strong> සුළු වියදම් ලැයිස්තුව ආදායමෙන් අඩු වී ශුද්ධ ලාභය හා Cash Drawer ශේෂය පෙන්වයි.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
