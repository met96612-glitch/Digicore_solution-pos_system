import { Product, Transaction, User, ShopProfile, StockAdjustment, StockAdjustmentReason } from './types';

export const STOCK_ADJUSTMENT_REASONS: {
  value: StockAdjustmentReason;
  label: string;
  sinhala: string;
  icon: string;
  badgeClass: string;
}[] = [
    {
      value: 'wastage',
      label: 'Dust / Garbage / Wastage',
      sinhala: 'කුණු / අපද්‍රව්‍ය ඉවත් කිරීම් (Wastage & Dust)',
      icon: '🧹',
      badgeClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
    },
    {
      value: 'drying_loss',
      label: 'Drying / Moisture Weight Loss',
      sinhala: 'වියළීම නිසා බර අඩුවීම (Drying Loss)',
      icon: '☀️',
      badgeClass: 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
    },
    {
      value: 'damage',
      label: 'Damage / Mold / Insects',
      sinhala: 'නරක් වීම් / දිලීර / කෘමි හානි (Spoilage)',
      icon: '🍂',
      badgeClass: 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
    },
    {
      value: 'audit_loss',
      label: 'Stock Audit Discrepancy',
      sinhala: 'තොග ගණන් බැලීමේ අඩුවීම් (Audit Shortage)',
      icon: '⚖️',
      badgeClass: 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
    },
    {
      value: 'other',
      label: 'Other Stock Deduction',
      sinhala: 'වෙනත් තොග අඩුවීම් (Other Loss)',
      icon: '📝',
      badgeClass: 'bg-slate-500/10 text-slate-300 border border-slate-500/20'
    }
  ];

const SPICE_NAME_MAP: Record<string, string> = {
  'ceylon cinnamon alba': 'කුරුඳු',
  'cinnamon': 'කුරුඳු',
  'black pepper premium': 'ගම්මිරිස්',
  'black pepper': 'ගම්මිරිස්',
  'turmeric powder organic': 'කහ කුඩු',
  'turmeric powder': 'කහ කුඩු',
  'turmeric': 'කහ කුඩු',
  'green cardamom': 'එනසාල්',
  'cardamom': 'එනසාල්',
  'cloves handpicked': 'කරාබුනැටි',
  'cloves': 'කරාබුනැටි',
  'chili flakes': 'කෑලි මිරිස්',
  'chilli flakes': 'කෑලි මිරිස්',
  'nutmeg with mace': 'සාදික්කා',
  'nutmeg': 'සාදික්කා',
  'roasted curry powder': 'බැදපු තුනපහ',
  'curry powder': 'තුනපහ කුඩු',
  'coriander seeds': 'කොත්තමල්ලි',
  'coriander': 'කොත්තමල්ලි',
  'fenugreek seeds': 'උළුහාල්',
  'fenugreek': 'උළුහාල්',
  'chili powder': 'මිරිස් කුඩු',
  'chilli powder': 'මිරිස් කුඩු',
  'raw curry powder': 'අමු තුනපහ',
  'mustard seeds': 'අබ',
  'mustard': 'අබ',
  'cumin seeds': 'දුරු',
  'fennel seeds': 'මහදුරු',
  'cardamom powder': 'එනසාල් කුඩු',
  'cinnamon powder': 'කුරුඳු කුඩු',
  'pepper powder': 'ගම්මිරිස් කුඩු',
  'garlic': 'සුදුලූනු',
  'ginger': 'ඉඟුරු',
  'curry leaves': 'කරපිංචා',
  'tamarind': 'සියඹලා',
  'goraka': 'ගෝරකා',
  'mace': 'වසාවාසි',
};

export function toSinhalaProductName(name: string): string {
  if (!name) return '';
  const trimmed = name.trim();

  // 1. If name contains Sinhala characters inside parentheses e.g. "Ceylon Cinnamon Alba (කුරුඳු)"
  const insideParenMatch = trimmed.match(/\(([\u0D80-\u0DFF\s]+)\)/);
  if (insideParenMatch && insideParenMatch[1].trim()) {
    return insideParenMatch[1].trim();
  }

  // 2. If name contains Sinhala characters anywhere, remove english/parentheses around it
  const onlySinhalaAndSpaces = trimmed.replace(/[^\u0D80-\u0DFF\s]/g, '').trim();
  if (onlySinhalaAndSpaces.length > 0) {
    return onlySinhalaAndSpaces.replace(/\s+/g, ' ');
  }

  // 3. If name is in English, check mapping
  const lower = trimmed.toLowerCase().replace(/\s*\([^)]*\)/g, '').trim();
  if (SPICE_NAME_MAP[lower]) {
    return SPICE_NAME_MAP[lower];
  }

  // 4. Check if any key in SPICE_NAME_MAP is a substring
  for (const [key, val] of Object.entries(SPICE_NAME_MAP)) {
    if (lower.includes(key)) {
      return val;
    }
  }

  // Fallback return trimmed name
  return trimmed;
}

// Initial products (empty array so no dummy products are forced into system)
export const INITIAL_PRODUCTS: Product[] = [];

// Default user accounts:
// Super User: superuser / 123
// Admin: admin / 123
// Cashier: cashier / 123
export const INITIAL_USERS: User[] = [];

export const INITIAL_TRANSACTIONS: Transaction[] = [];

export const DEFAULT_SHOP_PROFILE: ShopProfile = {
  shopName: '',
  shopSinhalaName: '',
  address: '',
  phone1: '',
  phone2: '',
  footerNote: '*** THANK YOU! COME AGAIN ***',
  footerSubNote: 'Software Powered by Digicore Solution'
};

export function getLocalTodayDateString(dateObj: Date = new Date()): string {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatCurrency(amount?: number | null): string {
  const val = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return `Rs. ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDateString(isoString?: string): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString || '';
    return date.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  } catch {
    return isoString || '';
  }
}

export function generateInvoiceNumber(type: 'sell' | 'buy'): string {
  const prefix = type === 'sell' ? 'S' : 'B';
  const now = new Date();
  const year = now.getFullYear().toString().substring(2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');

  const randNum = Math.floor(1000 + Math.random() * 9000); // 4 digit random
  return `${prefix}-${year}${month}${day}-${randNum}`;
}

export function generateNextInvoiceNumber(prefix: string, transactions: Transaction[]): string {
  const matching = transactions.filter(tx => {
    if (!tx || !tx.id) return false;
    if (prefix === 'L' || prefix === 'J') {
      return tx.id.startsWith(`${prefix}-`) && !tx.id.startsWith(`${prefix}-BUY-`);
    } else {
      return tx.id.startsWith(`${prefix}-`);
    }
  });

  if (matching.length === 0) {
    return `${prefix}-0001`;
  }

  let maxNum = 0;
  matching.forEach(tx => {
    const parts = tx.id.split('-');
    if (parts.length >= 2) {
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  return `${prefix}-${(maxNum + 1).toString().padStart(4, '0')}`;
}

export function mergeTransactions(supaTx: Transaction[], localTx: Transaction[]): Transaction[] {
  const map = new Map<string, Transaction>();

  supaTx.forEach(tx => {
    if (tx && tx.id) {
      map.set(tx.id, tx);
    }
  });

  localTx.forEach(tx => {
    if (!tx || !tx.id) return;
    const existing = map.get(tx.id);
    if (!existing) {
      map.set(tx.id, tx);
    } else {
      const localLogCount = tx.credit_payments?.length ?? 0;
      const supaLogCount = existing.credit_payments?.length ?? 0;
      const localPaid = tx.credit_paid_amount ?? tx.amount_paid ?? 0;
      const supaPaid = existing.credit_paid_amount ?? existing.amount_paid ?? 0;
      const preferLocal = localLogCount > supaLogCount || localPaid > supaPaid;

      map.set(tx.id, {
        ...existing,
        ...tx,
        credit_payments: preferLocal ? (tx.credit_payments || existing.credit_payments) : (existing.credit_payments || tx.credit_payments),
        credit_paid_amount: preferLocal ? localPaid : supaPaid,
        amount_paid: preferLocal ? localPaid : supaPaid,
        credit_status: preferLocal ? (tx.credit_status || existing.credit_status) : (existing.credit_status || tx.credit_status)
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => {
    const timeA = new Date(a.date || 0).getTime();
    const timeB = new Date(b.date || 0).getTime();
    return timeB - timeA;
  });
}

export function mergeProducts(primaryProds: Product[], secondaryProds: Product[]): Product[] {
  const map = new Map<string, Product>();

  // 1. Insert secondary/fallback products first
  secondaryProds.forEach(p => {
    if (p && p.id) {
      map.set(String(p.id), p);
    }
  });

  // 2. Override with primary/updated products
  primaryProds.forEach(p => {
    if (!p || !p.id) return;
    const pId = String(p.id);
    const existing = map.get(pId);
    if (!existing) {
      map.set(pId, p);
    } else {
      const stock = Number(p.stock !== undefined && p.stock !== null ? p.stock : (existing.stock ?? 0));
      map.set(pId, {
        ...existing,
        ...p,
        stock,
        lahiru_stock: stock,
        jayantha_stock: stock,
      });
    }
  });

  return Array.from(map.values());
}

export function exportToCSV(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      // Escape commas and double quotes
      const safeCell = cell.replace(/"/g, '""');
      return safeCell.includes(',') || safeCell.includes('\n') || safeCell.includes('"')
        ? `"${safeCell}"`
        : safeCell;
    }).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToExcel(
  filename: string,
  title: string,
  timeFrameStr: string,
  kpis: { label: string; value: string }[],
  transactions: Array<{ id: string; date: string; type: string; party: string; subtotal: number; discount: number; total: number; user: string }>,
  productBreakdown: Array<{ id: string; name: string; unit: string; qty: number; value: number; profit: number }>,
  expensesList?: Array<{ id: string; date: string; category: string; title: string; amount: number; addedBy: string; note?: string }>,
  openingCashLogsList?: Array<{ id: string; date: string; timestamp: string; amount: number; addedBy: string }>,
  adjustmentsList?: Array<{ id: string; date: string; productName: string; qty: number; unit: string; reason: string; totalLoss: number; adjustedBy: string; desk: string; note?: string }>
) {
  const tableHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Financial Summary</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: Arial, sans-serif; }
        .title { font-size: 16pt; font-weight: bold; color: #1e1b4b; background-color: #e0e7ff; text-align: center; }
        .header { font-weight: bold; background-color: #4338ca; color: #ffffff; text-align: center; }
        .kpi-label { font-weight: bold; background-color: #f1f5f9; }
        .kpi-val { font-weight: bold; color: #047857; text-align: right; }
        .number { text-align: right; }
        .section-hdr { font-weight: bold; font-size: 12pt; background-color: #312e81; color: #ffffff; }
        table, td, th { border: 1px solid #cbd5e1; border-collapse: collapse; padding: 6px; }
      </style>
    </head>
    <body>
      <table>
        <tr><td colspan="8" class="title">${title}</td></tr>
        <tr><td colspan="8" style="text-align: center;">Reporting Period: ${timeFrameStr} | Generated: ${new Date().toLocaleString()}</td></tr>
        <tr><td colspan="8"></td></tr>
        
        <tr><td colspan="8" class="section-hdr">FINANCIAL SUMMARY (KPIs)</td></tr>
        <tr class="header"><td colspan="4">Metric Description</td><td colspan="4">Financial Amount (Rs.)</td></tr>
        ${kpis.map(k => `<tr><td colspan="4" class="kpi-label">${k.label}</td><td colspan="4" class="kpi-val">${k.value}</td></tr>`).join('')}
        
        ${openingCashLogsList && openingCashLogsList.length > 0 ? `
        <tr><td colspan="8"></td></tr>
        <tr><td colspan="8" class="section-hdr" style="background-color: #065f46;">OPENING CASH DEPOSITS LOG (උදෑසන ආරම්භක මුදල් තැන්පතු)</td></tr>
        <tr class="header" style="background-color: #047857;">
          <th colspan="2">Log ID</th>
          <th colspan="2">Date & Time</th>
          <th colspan="2">Operator</th>
          <th colspan="2">Deposited Amount (Rs.)</th>
        </tr>
        ${openingCashLogsList.map(oc => `
          <tr>
            <td colspan="2">${oc.id}</td>
            <td colspan="2">${new Date(oc.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
            <td colspan="2">@${oc.addedBy}</td>
            <td colspan="2" class="number" style="color:#047857; font-weight:bold;">+Rs. ${oc.amount.toFixed(2)}</td>
          </tr>
        `).join('')}
        <tr>
          <td colspan="6" style="font-weight:bold; text-align:right; background-color:#d1fae5;">TOTAL OPENING CASH DEPOSITED:</td>
          <td colspan="2" class="number" style="font-weight:bold; color:#047857; background-color:#d1fae5;">Rs. ${openingCashLogsList.reduce((sum, oc) => sum + oc.amount, 0).toFixed(2)}</td>
        </tr>
        ` : ''}

        ${adjustmentsList && adjustmentsList.length > 0 ? `
        <tr><td colspan="8"></td></tr>
        <tr><td colspan="8" class="section-hdr" style="background-color: #c2410c;">STOCK ADJUSTMENT & WASTAGE LOSS LOG (තොග අඩුවීම් හා නරක්වීම්)</td></tr>
        <tr class="header" style="background-color: #9a3412;">
          <th>Adj ID</th>
          <th>Date & Time</th>
          <th>Desk</th>
          <th>Product Name</th>
          <th>Reason</th>
          <th>Qty Deducted</th>
          <th>Operator</th>
          <th>Loss Amount (Rs.)</th>
        </tr>
        ${adjustmentsList.map(a => `
          <tr>
            <td>${a.id}</td>
            <td>${new Date(a.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
            <td>${a.desk.toUpperCase()}</td>
            <td><strong>${a.productName}</strong></td>
            <td>${a.reason}${a.note ? ` (${a.note})` : ''}</td>
            <td class="number">${a.qty.toFixed(2)} ${a.unit}</td>
            <td>@${a.adjustedBy}</td>
            <td class="number" style="color:#c2410c; font-weight:bold;">-${a.totalLoss.toFixed(2)}</td>
          </tr>
        `).join('')}
        <tr>
          <td colspan="7" style="font-weight:bold; text-align:right; background-color:#ffedd5;">TOTAL WASTAGE & DAMAGE LOSS:</td>
          <td class="number" style="font-weight:bold; color:#c2410c; background-color:#ffedd5;">Rs. ${adjustmentsList.reduce((sum, a) => sum + a.totalLoss, 0).toFixed(2)}</td>
        </tr>
        ` : ''}

        ${expensesList && expensesList.length > 0 ? `
        <tr><td colspan="8"></td></tr>
        <tr><td colspan="8" class="section-hdr" style="background-color: #9f1239;">SHOP EXTRA EXPENSES LOG (අමතර කඩේ වියදම්)</td></tr>
        <tr class="header" style="background-color: #881337;">
          <th colspan="2">Expense ID</th>
          <th>Date & Time</th>
          <th>Category</th>
          <th colspan="2">Expense Title / Details</th>
          <th>Operator</th>
          <th>Amount (Rs.)</th>
        </tr>
        ${expensesList.map(e => `
          <tr>
            <td colspan="2">${e.id}</td>
            <td>${new Date(e.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
            <td>${e.category}</td>
            <td colspan="2">${e.title}${e.note ? ` (${e.note})` : ''}</td>
            <td>@${e.addedBy}</td>
            <td class="number" style="color:#e11d48; font-weight:bold;">-${e.amount.toFixed(2)}</td>
          </tr>
        `).join('')}
        <tr>
          <td colspan="7" style="font-weight:bold; text-align:right; background-color:#ffe4e6;">TOTAL EXTRA EXPENSES:</td>
          <td class="number" style="font-weight:bold; color:#e11d48; background-color:#ffe4e6;">Rs. ${expensesList.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}</td>
        </tr>
        ` : ''}

        <tr><td colspan="8"></td></tr>
        <tr><td colspan="8" class="section-hdr">DETAILED TRANSACTION LOGS</td></tr>
        <tr class="header">
          <th>Invoice ID</th>
          <th>Date & Time</th>
          <th>Type</th>
          <th>Party / Customer</th>
          <th>Subtotal (Rs.)</th>
          <th>Discount (Rs.)</th>
          <th>Grand Total (Rs.)</th>
          <th>Operator</th>
        </tr>
        ${transactions.map(t => `
          <tr>
            <td>${t.id}</td>
            <td>${t.date}</td>
            <td>${t.type.toUpperCase()}</td>
            <td>${t.party}</td>
            <td class="number">${t.subtotal.toFixed(2)}</td>
            <td class="number">${t.discount.toFixed(2)}</td>
            <td class="number" style="font-weight:bold; color:#047857;">${t.total.toFixed(2)}</td>
            <td>${t.user}</td>
          </tr>
        `).join('')}
        
        <tr><td colspan="8"></td></tr>
        <tr><td colspan="8" class="section-hdr">PRODUCT PERFORMANCE BREAKDOWN</td></tr>
        <tr class="header">
          <th colspan="2">Product ID</th>
          <th colspan="2">Product Name</th>
          <th>Unit</th>
          <th>Total Qty</th>
          <th>Total Revenue (Rs.)</th>
          <th>Estimated Net Profit (Rs.)</th>
        </tr>
        ${productBreakdown.map(p => `
          <tr>
            <td colspan="2">${p.id}</td>
            <td colspan="2">${p.name}</td>
            <td>${p.unit}</td>
            <td class="number">${p.qty.toFixed(2)}</td>
            <td class="number">${p.value.toFixed(2)}</td>
            <td class="number" style="font-weight:bold; color:#4338ca;">${p.profit.toFixed(2)}</td>
          </tr>
        `).join('')}
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.replace(/\.csv$/, '') + '.xls');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function printReportDocument(
  title: string,
  timeFrameStr: string,
  brandName: string,
  kpis: { label: string; value: string }[],
  transactions: Array<{ id: string; date: string; type: string; party: string; subtotal: number; discount: number; total: number; user: string }>,
  productBreakdown: Array<{ id: string; name: string; unit: string; qty: number; value: number; profit: number }>,
  expensesList?: Array<{ id: string; date: string; category: string; title: string; amount: number; addedBy: string; note?: string }>,
  openingCashLogsList?: Array<{ id: string; date: string; timestamp: string; amount: number; addedBy: string }>,
  adjustmentsList?: Array<{ id: string; date: string; productName: string; qty: number; unit: string; reason: string; totalLoss: number; adjustedBy: string; desk: string; note?: string }>
) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to view and print the PDF report.');
    return;
  }

  const expensesTotal = expensesList ? expensesList.reduce((sum, e) => sum + e.amount, 0) : 0;
  const openingCashTotal = openingCashLogsList ? openingCashLogsList.reduce((sum, e) => sum + e.amount, 0) : 0;
  const adjustmentsTotal = adjustmentsList ? adjustmentsList.reduce((sum, a) => sum + a.totalLoss, 0) : 0;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} - ${timeFrameStr}</title>
      <style>
        @page { size: A4 portrait; margin: 12mm; }
        body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; margin: 0; padding: 20px; font-size: 11px; line-height: 1.4; }
        .header { text-align: center; border-bottom: 2px solid #4338ca; padding-bottom: 10px; margin-bottom: 16px; }
        .brand { font-size: 20px; font-weight: 800; color: #312e81; text-transform: uppercase; letter-spacing: 0.5px; }
        .subbrand { font-size: 12px; font-weight: 600; color: #4f46e5; margin-top: 2px; }
        .report-title { font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 8px; text-transform: uppercase; background: #e0e7ff; padding: 5px 12px; display: inline-block; border-radius: 6px; }
        .meta-bar { display: flex; justify-content: space-between; font-size: 10px; color: #64748b; margin-bottom: 16px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 6px; }
        
        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
        .kpi-card { border: 1px solid #e2e8f0; background: #f8fafc; padding: 10px; border-radius: 8px; text-align: center; }
        .kpi-label { font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: 700; }
        .kpi-val { font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 3px; font-family: monospace; }
        .kpi-val.green { color: #047857; }
        .kpi-val.purple { color: #4338ca; }
        .kpi-val.rose { color: #e11d48; }
        .kpi-val.orange { color: #c2410c; }

        .section-hdr { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #1e1b4b; background: #f1f5f9; padding: 6px 10px; border-left: 4px solid #4338ca; margin-top: 18px; margin-bottom: 8px; }
        .section-hdr.emerald { border-left-color: #059669; background: #ecfdf5; color: #064e3b; }
        .section-hdr.rose { border-left-color: #e11d48; background: #fff1f2; color: #881337; }
        .section-hdr.orange { border-left-color: #ea580c; background: #fff7ed; color: #9a3412; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10px; }
        th { background: #312e81; color: #ffffff; font-weight: 700; text-transform: uppercase; font-size: 9px; padding: 6px 5px; text-align: left; }
        th.emerald { background: #047857; }
        th.rose { background: #9f1239; }
        th.orange { background: #c2410c; }
        td { padding: 6px 5px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background: #f8fafc; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-mono { font-family: monospace; font-weight: 700; }
        .badge { font-size: 8px; font-weight: 700; padding: 2px 5px; border-radius: 4px; text-transform: uppercase; display: inline-block; }
        .badge-sell { background: #d1fae5; color: #065f46; }
        .badge-buy { background: #fef3c7; color: #92400e; }
        .badge-return { background: #ffe4e6; color: #9f1239; }

        .footer-sig { margin-top: 35px; display: flex; justify-content: space-between; padding-top: 15px; border-top: 1px solid #cbd5e1; page-break-inside: avoid; }
        .sig-box { width: 180px; text-align: center; font-size: 10px; color: #475569; }
        .sig-line { border-top: 1px dashed #94a3b8; margin-top: 30px; margin-bottom: 4px; }

        @media print {
          body { padding: 0; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 15px; text-align: right;">
        <button onclick="window.print()" style="background: #4338ca; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          🖨️ Print / Save as PDF (මුද්‍රණය කරන්න)
        </button>
      </div>

      <div class="header">
        <div class="brand">${brandName}</div>
        <div class="subbrand">ළහිරු සහ ජයන්ත කුළුබඩු සමාගම • Lahiya & Jayantha Spices Enterprise</div>
        <div class="report-title">${title}</div>
      </div>

      <div class="meta-bar">
        <span><strong>Reporting Time Frame:</strong> ${timeFrameStr}</span>
        <span><strong>Generated Date:</strong> ${new Date().toLocaleString()}</span>
      </div>

      <div class="kpi-grid">
        ${kpis.map(k => `
          <div class="kpi-card">
            <div class="kpi-label">${k.label}</div>
            <div class="kpi-val ${k.label.includes('Sales') || k.label.includes('Revenue') ? 'green' : k.label.includes('Wastage') || k.label.includes('Damage') ? 'orange' : k.label.includes('Expenses') ? 'rose' : k.label.includes('Profit') ? 'purple' : ''}">${k.value}</div>
          </div>
        `).join('')}
      </div>

      ${openingCashLogsList && openingCashLogsList.length > 0 ? `
      <div class="section-hdr emerald">Opening Cash Deposits Log (${openingCashLogsList.length} Records) - උදෑසන ආරම්භක මුදල් තැන්පතු</div>
      <table>
        <thead>
          <tr>
            <th class="emerald">Log ID</th>
            <th class="emerald">Date & Time</th>
            <th class="emerald text-center">Operator / User</th>
            <th class="emerald text-right">Deposited Amount (LKR)</th>
          </tr>
        </thead>
        <tbody>
          ${openingCashLogsList.map(oc => `
            <tr>
              <td class="font-mono">${oc.id}</td>
              <td>${new Date(oc.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
              <td class="text-center"><strong>@${oc.addedBy}</strong></td>
              <td class="text-right font-mono" style="font-weight: 800; color: #047857;">+ Rs. ${oc.amount.toFixed(2)}</td>
            </tr>
          `).join('')}
          <tr style="background:#ecfdf5;">
            <td colspan="3" class="text-right" style="font-weight:800; color:#064e3b;">TOTAL OPENING CASH DEPOSITED:</td>
            <td class="text-right font-mono" style="font-weight:900; color:#047857; font-size:11px;">Rs. ${openingCashTotal.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      ` : ''}

      ${adjustmentsList && adjustmentsList.length > 0 ? `
      <div class="section-hdr orange">Stock Adjustment & Wastage Loss Log (${adjustmentsList.length} Records) - තොග අඩුවීම් හා නරක්වීම් පාඩු</div>
      <table>
        <thead>
          <tr>
            <th class="orange">Adj ID</th>
            <th class="orange">Date & Time</th>
            <th class="orange text-center">Desk</th>
            <th class="orange">Product</th>
            <th class="orange">Reason / Cause</th>
            <th class="orange text-right">Qty Deducted</th>
            <th class="orange text-center">Operator</th>
            <th class="orange text-right">Loss Amount (LKR)</th>
          </tr>
        </thead>
        <tbody>
          ${adjustmentsList.map(a => `
            <tr>
              <td class="font-mono">${a.id}</td>
              <td>${new Date(a.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
              <td class="text-center font-mono"><strong>${a.desk.toUpperCase()}</strong></td>
              <td><strong>${a.productName}</strong></td>
              <td>${a.reason}${a.note ? ` <span style="color:#64748b; font-size:9px;">(${a.note})</span>` : ''}</td>
              <td class="text-right font-mono">${a.qty.toFixed(2)} ${a.unit}</td>
              <td class="text-center">@${a.adjustedBy}</td>
              <td class="text-right font-mono" style="font-weight: 800; color: #c2410c;">- Rs. ${a.totalLoss.toFixed(2)}</td>
            </tr>
          `).join('')}
          <tr style="background:#fff7ed;">
            <td colspan="7" class="text-right" style="font-weight:800; color:#9a3412;">TOTAL STOCK WASTAGE & DAMAGE LOSS:</td>
            <td class="text-right font-mono" style="font-weight:900; color:#c2410c; font-size:11px;">Rs. ${adjustmentsTotal.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      ` : ''}

      ${expensesList && expensesList.length > 0 ? `
      <div class="section-hdr rose">Shop Extra Expenses Log (${expensesList.length} Records) - අමතර කඩේ වියදම්</div>
      <table>
        <thead>
          <tr>
            <th class="rose">ID</th>
            <th class="rose">Date & Time</th>
            <th class="rose">Category</th>
            <th class="rose">Expense Details / Title</th>
            <th class="rose text-center">Operator</th>
            <th class="rose text-right">Amount (LKR)</th>
          </tr>
        </thead>
        <tbody>
          ${expensesList.map(e => `
            <tr>
              <td class="font-mono">${e.id}</td>
              <td>${new Date(e.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
              <td><strong>${e.category}</strong></td>
              <td>${e.title}${e.note ? ` <span style="color:#64748b; font-size:9px;">(${e.note})</span>` : ''}</td>
              <td class="text-center">@${e.addedBy}</td>
              <td class="text-right font-mono" style="font-weight: 800; color: #e11d48;">- Rs. ${e.amount.toFixed(2)}</td>
            </tr>
          `).join('')}
          <tr style="background:#fff1f2;">
            <td colspan="5" class="text-right" style="font-weight:800; color:#881337;">TOTAL EXTRA SHOP EXPENSES:</td>
            <td class="text-right font-mono" style="font-weight:900; color:#e11d48; font-size:11px;">Rs. ${expensesTotal.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      ` : ''}

      <div class="section-hdr">Detailed Transaction Logs (${transactions.length} Records)</div>
      <table>
        <thead>
          <tr>
            <th>Invoice ID</th>
            <th>Date & Time</th>
            <th>Type</th>
            <th>Client / Party Name</th>
            <th class="text-right">Subtotal</th>
            <th class="text-right">Discount</th>
            <th class="text-right">Grand Total</th>
            <th class="text-center">Cashier</th>
          </tr>
        </thead>
        <tbody>
          ${transactions.length === 0 ? `<tr><td colspan="8" class="text-center" style="padding: 16px; color: #94a3b8;">No transactions found for this period.</td></tr>` : ''}
          ${transactions.map(t => `
            <tr>
              <td class="font-mono">${t.id}</td>
              <td>${new Date(t.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
              <td><span class="badge badge-${t.type}">${t.type}</span></td>
              <td>${t.party}</td>
              <td class="text-right font-mono">Rs. ${t.subtotal.toFixed(2)}</td>
              <td class="text-right font-mono">Rs. ${t.discount.toFixed(2)}</td>
              <td class="text-right font-mono" style="font-weight: 800; color: #047857;">Rs. ${t.total.toFixed(2)}</td>
              <td class="text-center">@${t.user}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="section-hdr">Product Performance Breakdown</div>
      <table>
        <thead>
          <tr>
            <th>Product ID</th>
            <th>Product Name</th>
            <th>Unit</th>
            <th class="text-right">Quantity</th>
            <th class="text-right">Total Revenue / Value</th>
            <th class="text-right">Estimated Net Profit</th>
          </tr>
        </thead>
        <tbody>
          ${productBreakdown.length === 0 ? `<tr><td colspan="6" class="text-center" style="padding: 16px; color: #94a3b8;">No products recorded.</td></tr>` : ''}
          ${productBreakdown.map(p => `
            <tr>
              <td class="font-mono">${p.id}</td>
              <td><strong>${p.name}</strong></td>
              <td class="text-center">${p.unit}</td>
              <td class="text-right font-mono">${p.qty.toFixed(2)} ${p.unit}</td>
              <td class="text-right font-mono">Rs. ${p.value.toFixed(2)}</td>
              <td class="text-right font-mono" style="font-weight: 800; color: #4338ca;">Rs. ${p.profit.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="footer-sig">
        <div class="sig-box">
          <div class="sig-line"></div>
          <div>Prepared By (ගණකාධිකාරී)</div>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div>Authorized Signature (අනුමත කළේ)</div>
        </div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

