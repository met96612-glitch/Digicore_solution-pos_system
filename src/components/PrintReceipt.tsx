import { useState } from 'react';
import { Transaction, ShopProfile } from '../types';
import { formatDateString, toSinhalaProductName, DEFAULT_SHOP_PROFILE } from '../utils';
import { X, Receipt, Bluetooth, Printer, Loader2, Trash2 } from 'lucide-react';

interface PrintReceiptProps {
  transaction: Transaction | null;
  shopProfile?: ShopProfile;
  onClose: () => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
  onDelete?: (txId: string) => void;
}

function drawDottedLine(ctx: CanvasRenderingContext2D, y: number, width: number) {
  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.moveTo(10, y);
  ctx.lineTo(width - 10, y);
  ctx.stroke();
  ctx.restore();
}

/**
 * Intelligent non-overlapping Left-Right row renderer.
 * Automatically wraps value to next line if left & right text would collide.
 */
function drawLeftRightRow(
  ctx: CanvasRenderingContext2D,
  leftText: string,
  rightText: string,
  y: number,
  width: number,
  lineHeight: number = 28
): number {
  const leftW = ctx.measureText(leftText).width;
  const rightW = ctx.measureText(rightText).width;
  const availW = width - 24;

  if (leftW + rightW + 10 <= availW) {
    ctx.textAlign = 'left';
    ctx.fillText(leftText, 12, y);
    ctx.textAlign = 'right';
    ctx.fillText(rightText, width - 12, y);
    return y + lineHeight;
  } else {
    // If text would overlap, draw left text first, then right text on next line
    ctx.textAlign = 'left';
    ctx.fillText(leftText, 12, y);
    const nextY = y + lineHeight - 4;
    ctx.textAlign = 'right';
    ctx.fillText(rightText, width - 12, nextY);
    return nextY + lineHeight;
  }
}

// Bulletproof direct 2D Canvas receipt generator (Zero CSS / html2canvas dependency)
export function resolveShopHeaderDetails(transaction: Transaction, shopProfile?: ShopProfile) {
  const isJayanthaTx = transaction.id.startsWith('J') || transaction.createdBy === 'jayantha' || transaction.user_id === 'u4';
  const isLahiruTx = transaction.id.startsWith('L') || transaction.createdBy === 'lahiru' || transaction.user_id === 'u3';

  const defaultLahiruName = 'LAHIYA SPICE COLLECTORS';
  const defaultLahiruSinhala = 'ළහියා කුළුබඩු එකතු කිරීමේ මධ්‍යස්ථානය';
  const defaultLahiruAddress = 'Wewalwatta, Rathnapura';
  const defaultLahiruPhone = '074 0050211 / 076 0808246';

  const defaultJayanthaName = 'JAYANTHA SPICE COLLECTORS';
  const defaultJayanthaSinhala = 'ජයන්ත කුළුබඩු එකතු කිරීමේ මධ්‍යස්ථානය';
  const defaultJayanthaAddress = 'Wewalwatta, Rathnapura';
  const defaultJayanthaPhone = '077 602 1831';

  const configuredName = shopProfile?.shopName?.trim() || '';
  const configuredSinhala = shopProfile?.shopSinhalaName?.trim() || '';
  const configuredAddress = shopProfile?.address?.trim() || 'Wewalwatta, Rathnapura';
  const configuredPhone = [shopProfile?.phone1, shopProfile?.phone2].filter(Boolean).map(p => p?.trim()).filter(Boolean).join(' / ');
  const footerNote = shopProfile?.footerNote || '*** THANK YOU! COME AGAIN ***';
  const footerSubNote = shopProfile?.footerSubNote || 'Software Powered by Digicore Solution';

  // Check if profile was changed to something custom (not the standard Lahiru or Jayantha presets)
  const isCustomStore = configuredName &&
    configuredName !== 'LAHIRU SPICE COLLECTORS' &&
    configuredName !== 'LAHIYA SPICE COLLECTORS' &&
    configuredName !== 'LAHIRU SPICES CENTER' &&
    configuredName !== 'LAHIYA SPICES CENTER' &&
    configuredName !== 'JAYANTHA SPICE COLLECTORS' &&
    configuredName !== 'JAYANTHA SPICES CENTER';

  let shopName = defaultLahiruName;
  let shopSinhala = defaultLahiruSinhala;
  let shopAddress = defaultLahiruAddress;
  let shopPhone = defaultLahiruPhone;

  if (isCustomStore) {
    // Custom user configured store identity
    shopName = configuredName;
    shopSinhala = configuredSinhala || defaultLahiruSinhala;
    shopAddress = configuredAddress || defaultLahiruAddress;
    shopPhone = configuredPhone || (isJayanthaTx ? defaultJayanthaPhone : defaultLahiruPhone);
  } else if (isJayanthaTx) {
    // Jayantha's bill
    shopName = defaultJayanthaName;
    shopSinhala = defaultJayanthaSinhala;
    shopAddress = defaultJayanthaAddress;
    shopPhone = (configuredName === defaultJayanthaName && configuredPhone) ? configuredPhone : defaultJayanthaPhone;
  } else {
    // Lahiru's bill or Default
    shopName = defaultLahiruName;
    shopSinhala = defaultLahiruSinhala;
    shopAddress = defaultLahiruAddress;
    shopPhone = (configuredName === defaultLahiruName && configuredPhone) ? configuredPhone : defaultLahiruPhone;
  }

  const cashierName = isJayanthaTx
    ? 'Jayantha De Silva (@jayantha)'
    : (isLahiruTx ? 'Lahiru Kumara (@lahiru)' : `@${transaction.createdBy || 'cashier'}`);

  return {
    shopName,
    shopSinhala,
    shopAddress,
    shopPhone,
    footerNote,
    footerSubNote,
    cashierName
  };
}

function generateDirectReceiptCanvas(
  transaction: Transaction,
  paperSize: '80mm' | '58mm' = '80mm',
  shopProfile?: ShopProfile
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const is80 = paperSize === '80mm';
  const width = is80 ? 576 : 384; // 576px for 80mm, 384px for 58mm

  const headerH = is80 ? 360 : 240;
  const deductionCount = transaction.items.filter(it => it.deductionQty && it.deductionQty > 0).length;
  const itemsH = transaction.items.length * (is80 ? 68 : 46) + deductionCount * (is80 ? 25 : 16) + (is80 ? 50 : 35);
  const totalsH = transaction.discount > 0 ? (is80 ? 180 : 125) : (is80 ? 140 : 95);
  const footerH = is80 ? 100 : 70;
  const totalH = headerH + itemsH + totalsH + footerH;

  canvas.width = width;
  canvas.height = totalH;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Background pure white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, totalH);

  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  let y = is80 ? 16 : 12;

  const {
    shopName,
    shopSinhala,
    shopAddress,
    shopPhone,
    footerNote,
    footerSubNote,
    cashierName
  } = resolveShopHeaderDetails(transaction, shopProfile);

  // Shop Title: 35px Bold
  ctx.font = is80 ? 'bold 35px sans-serif' : 'bold 23px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(shopName, width / 2, y);
  y += is80 ? 42 : 28;

  // සිංහල නාමය, ලිපිනය සහ දුරකථන: 26px - 28px Bold
  if (shopSinhala) {
    ctx.font = is80 ? 'bold 27px sans-serif' : 'bold 18px sans-serif';
    ctx.fillText(shopSinhala, width / 2, y);
    y += is80 ? 34 : 22;
  }

  if (shopAddress) {
    ctx.font = is80 ? 'bold 26px sans-serif' : 'bold 17px sans-serif';
    ctx.fillText(`📍 ${shopAddress}`, width / 2, y);
    y += is80 ? 32 : 20;
  }
  if (shopPhone) {
    ctx.font = is80 ? 'bold 26px sans-serif' : 'bold 17px sans-serif';
    ctx.fillText(`📞 ${shopPhone}`, width / 2, y);
    y += is80 ? 34 : 22;
  }

  drawDottedLine(ctx, y, width);
  y += is80 ? 16 : 10;

  // Transaction Info - 24px
  ctx.font = is80 ? '24px sans-serif' : '16px sans-serif';
  const rowLineH = is80 ? 30 : 20;
  y = drawLeftRightRow(ctx, 'BILL INVOICE NO:', transaction.id, y, width, rowLineH);
  y = drawLeftRightRow(ctx, 'DATE & TIME:', formatDateString(transaction.date), y, width, rowLineH);
  y = drawLeftRightRow(
    ctx,
    transaction.type === 'sell' ? 'CLIENT / CUSTOMER:' : (transaction.type === 'return' ? 'CUSTOMER / CLIENT:' : 'SUPPLIER / GROWER:'),
    (transaction.contactName || 'Walk-In Customer').toUpperCase(),
    y,
    width,
    rowLineH
  );
  y = drawLeftRightRow(ctx, 'PAYMENT METHOD:', (transaction.payment_method || 'CASH').toUpperCase(), y, width, rowLineH);

  if (transaction.type === 'sell') {
    const saleTypeStr = transaction.is_wholesale ? 'WHOLESALE / තොග' : 'RETAIL / සිල්ලර';
    y = drawLeftRightRow(ctx, 'SALE TYPE:', saleTypeStr, y, width, rowLineH);
  } else if (transaction.type === 'return') {
    y = drawLeftRightRow(ctx, 'BILL TYPE:', 'RETURN BILL / ආපසු බාරගැනීම', y, width, rowLineH);
    if (transaction.ref_invoice_no) {
      y = drawLeftRightRow(ctx, 'REF INVOICE NO:', transaction.ref_invoice_no, y, width, rowLineH);
    }
    if (transaction.return_reason) {
      y = drawLeftRightRow(ctx, 'RETURN REASON:', transaction.return_reason, y, width, rowLineH);
    }
  }

  y = drawLeftRightRow(ctx, 'CASHIER / DESK:', cashierName, y, width, rowLineH);

  drawDottedLine(ctx, y, width);
  y += is80 ? 16 : 10;

  // Item Details Header
  ctx.font = is80 ? 'bold 22px sans-serif' : 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ITEM DETAILS (DESCRIPTION & QTY)', 12, y);
  ctx.textAlign = 'right';
  ctx.fillText('TOTAL (RS)', width - 12, y);
  y += is80 ? 28 : 18;

  ctx.beginPath();
  ctx.lineWidth = is80 ? 2 : 1.5;
  ctx.strokeStyle = '#000000';
  ctx.moveTo(12, y);
  ctx.lineTo(width - 12, y);
  ctx.stroke();
  y += is80 ? 12 : 8;

  // Items rows - Clean 2-tier format: Zero collision
  transaction.items.forEach((it) => {
    // Tier 1: Item Name in bold
    ctx.font = is80 ? 'bold 24px sans-serif' : 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    const cleanName = toSinhalaProductName(it.productName);
    ctx.fillText(cleanName, 12, y);
    y += is80 ? 26 : 17;

    // Optional deduction text
    if (it.deductionQty && it.deductionQty > 0) {
      ctx.font = is80 ? '18px sans-serif' : '12px sans-serif';
      ctx.fillStyle = '#444444';
      const deductText = `(${it.grossQty || it.qty}${it.unit} - ${it.deductionQty}${it.unit} = ${it.qty}${it.unit})`;
      ctx.fillText(deductText, 16, y);
      ctx.fillStyle = '#000000';
      y += is80 ? 22 : 14;
    }

    // Tier 2: Qty x Unit Price (Left) and Item Total (Right)
    ctx.font = is80 ? '22px sans-serif' : '15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${it.qty} ${it.unit}  x  Rs. ${it.price.toFixed(2)}`, 16, y);

    ctx.font = is80 ? 'bold 23px sans-serif' : 'bold 16px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Rs. ${it.total.toFixed(2)}`, width - 12, y);

    y += is80 ? 30 : 20;
  });

  drawDottedLine(ctx, y, width);
  y += is80 ? 16 : 10;

  // Ledger summary
  ctx.font = is80 ? '24px sans-serif' : '16px sans-serif';
  y = drawLeftRightRow(ctx, 'Gross Subtotal:', `Rs. ${transaction.subtotal.toFixed(2)}`, y, width, is80 ? 30 : 20);

  if (transaction.discount > 0) {
    y = drawLeftRightRow(ctx, 'Discount Allowed (-):', `-Rs. ${transaction.discount.toFixed(2)}`, y, width, is80 ? 30 : 20);
  }

  // Net Ledger Total (මුළු එකතුව): 30px Bold
  ctx.font = is80 ? 'bold 30px sans-serif' : 'bold 20px sans-serif';
  const totalTitle = transaction.type === 'return' ? 'TOTAL REFUND / මුළු ආපසු:' : 'Net Ledger Total:';
  y = drawLeftRightRow(ctx, totalTitle, `Rs. ${transaction.total.toFixed(2)}`, y, width, is80 ? 40 : 26);

  drawDottedLine(ctx, y, width);
  y += is80 ? 16 : 10;

  // Footer
  ctx.textAlign = 'center';
  ctx.font = is80 ? 'bold 20px sans-serif' : 'bold 14px sans-serif';
  ctx.fillText(footerNote, width / 2, y);
  y += is80 ? 26 : 18;

  if (footerSubNote) {
    ctx.font = is80 ? '16px sans-serif' : '11px sans-serif';
    ctx.fillText(footerSubNote, width / 2, y);
  }

  return canvas;
}

// Convert rendered canvas image into ESC/POS Raster bit-image commands (GS v 0)
export function convertCanvasToEscPosRaster(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext('2d');
  if (!ctx) return new Uint8Array(0);

  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const widthInBytes = Math.ceil(width / 8);
  const bytes: number[] = [];

  const push = (...vals: number[]) => bytes.push(...vals);

  // Initialize printer: ESC @
  push(0x1B, 0x40);

  // Center image alignment: ESC a 1
  push(0x1B, 0x61, 0x01);

  // ESC/POS Raster Bit Image command: GS v 0 0 xL xH yL yH
  const xL = widthInBytes % 256;
  const xH = Math.floor(widthInBytes / 256);
  const yL = height % 256;
  const yH = Math.floor(height / 256);

  push(0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH);

  for (let y = 0; y < height; y++) {
    for (let xByte = 0; xByte < widthInBytes; xByte++) {
      let byteVal = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = xByte * 8 + bit;
        if (x < width) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];

          // Check luminosity for thermal black threshold
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          if (a > 128 && luminance < 180) {
            byteVal |= 1 << (7 - bit);
          }
        }
      }
      bytes.push(byteVal);
    }
  }

  // Feed lines (ESC d 4)
  push(0x1B, 0x64, 0x04);

  return new Uint8Array(bytes);
}

export default function PrintReceipt({ transaction, shopProfile, onClose, onToast, onDelete }: PrintReceiptProps) {
  const [printing, setPrinting] = useState(false);
  const [connectedDeviceName, setConnectedDeviceName] = useState<string | null>(null);
  const [paperSize, setPaperSize] = useState<'80mm' | '58mm'>('80mm');

  if (!transaction) return null;

  const {
    shopName,
    shopSinhala,
    shopAddress,
    shopPhone,
    footerNote,
    footerSubNote,
    cashierName
  } = resolveShopHeaderDetails(transaction, shopProfile);

  // Instant direct canvas generator for thermal print bitmap (100% fail-proof)
  const renderReceiptToCanvas = async (): Promise<HTMLCanvasElement | null> => {
    try {
      return generateDirectReceiptCanvas(transaction, paperSize, shopProfile);
    } catch (err) {
      console.error('Failed to generate receipt canvas:', err);
      return null;
    }
  };

  // 1. Direct Web Bluetooth Print (Sends exact Canvas Image to Printer)
  const handleChromeBluetoothPrint = async () => {
    if (typeof window === 'undefined' || !('bluetooth' in navigator)) {
      onToast('ඔබගේ Browser එකෙහි Web Bluetooth පහසුකම නැත. RawBT app එක භාවිතා කරයි...', 'error');
      handleRawBtPrint();
      return;
    }

    setPrinting(true);

    try {
      onToast(`Bluetooth Thermal Printer (${paperSize}) සොයමින්...`, 'success');

      const navBt = (navigator as any).bluetooth;
      // CRITICAL: Must invoke requestDevice IMMEDIATELY in gesture callback before any async await
      const device = await navBt.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer service
          '49535343-fe7d-41aa-a37b-ab3713738837', // ISSC SPP Serial service
          '00001101-0000-1000-8000-00805f9b34fb', // Bluetooth Serial Port
          '0000ff00-0000-1000-8000-00805f9b34fb', // Custom POS printer UUID 1
          '0000af00-0000-1000-8000-00805f9b34fb', // Custom POS printer UUID 2
          '0000e025-0000-1000-8000-00805f9b34fb', // Custom POS printer UUID 3
          '00004953-0000-1000-8000-00805f9b34fb', // ISSC
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
          '00001800-0000-1000-8000-00805f9b34fb',
          '00001801-0000-1000-8000-00805f9b34fb',
          '0000180a-0000-1000-8000-00805f9b34fb',
        ],
      });

      if (!device) {
        setPrinting(false);
        return;
      }

      setConnectedDeviceName(device.name || 'Bluetooth Printer');
      onToast(`"${device.name || 'Printer'}" වෙත සම්බන්ධ වෙමින්...`, 'success');

      // Add connection listener
      device.addEventListener('gattserverdisconnected', () => {
        setConnectedDeviceName(null);
      });

      // Generate exact Sinhala direct canvas receipt according to selected paper size
      const canvas = generateDirectReceiptCanvas(transaction, paperSize, shopProfile);

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
          console.warn('GATT service query:', e);
        }
        if (writeChar) break;
      }

      if (writeChar) {
        // Convert canvas image into ESC/POS bitmap raster commands
        const escRasterBytes = convertCanvasToEscPosRaster(canvas);

        const CHUNK_SIZE = 128; // Send in chunks for smooth bluetooth transmission
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
        onToast(`සිංහල අකුරු සහිත ${paperSize} බිල ${device.name || 'Printer'} වෙතින් සාර්ථකව මුද්‍රණය විය!`, 'success');
        return;
      } else {
        throw new Error('No write characteristic found on Bluetooth printer');
      }
    } catch (err: any) {
      console.warn('Direct GATT Bluetooth print error:', err);
      setPrinting(false);
      if (err.name === 'NotFoundError') {
        onToast('Bluetooth Printer තේරීම අවලංගු කරන ලදී හෝ BLE උපකරණ සොයාගත නොහැකි විය.', 'error');
      } else {
        onToast('Direct GATT සම්බන්ධතාව සාර්ථක නැත. RawBT app එක වෙත යොමු කෙරේ...', 'error');
        // Auto fallback to RawBT which handles Bluetooth Classic printers
        setTimeout(() => {
          handleRawBtPrint();
        }, 300);
      }
    }
  };

  // 2. Android RawBT Image Intent Print (Exact image print for Sinhala text)
  const handleRawBtPrint = () => {
    setPrinting(true);
    onToast(`RawBT සඳහා ${paperSize} Image Receipt සූදානම් කරමින්...`, 'success');

    try {
      const canvas = generateDirectReceiptCanvas(transaction, paperSize, shopProfile);
      const dataUrl = canvas.toDataURL('image/png');
      const base64Png = dataUrl.replace(/^data:image\/png;base64,/, '');

      const rawbtUrl = `intent:${base64Png}#Intent;scheme=rawbt;package=ru.a23.rawbtprinter;S.title=Bill%20${transaction.id};end;`;
      window.location.href = rawbtUrl;

      setPrinting(false);
      onToast(`සිංහල අකුරු සහිත ${paperSize} Image Receipt එක RawBT වෙත යවන ලදී!`, 'success');
    } catch (e) {
      console.error('RawBT image print exception:', e);
      setPrinting(false);
      window.print();
    }
  };

  // 3. Browser Standard Print
  const handleBrowserPrint = () => {
    onToast('Browser මුද්‍රණ තිරය විවෘත වේ...', 'success');
    setTimeout(() => {
      window.print();
    }, 200);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in print:bg-white print:p-0">
      <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full shadow-2xl space-y-4 print:bg-white print:border-none print:shadow-none print:max-w-none print:p-0 print:w-auto max-h-[92vh] overflow-y-auto flex flex-col justify-between transition-all ${paperSize === '80mm' ? 'max-w-md' : 'max-w-sm'}`}>
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3 print:hidden">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              <Receipt size={16} className="text-violet-400" />
              <span>බිල්පත ({paperSize} Bill Receipt)</span>
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-200 cursor-pointer p-1 hover:bg-slate-800 rounded-lg transition-all">
              <X size={18} />
            </button>
          </div>

          {/* Paper Size Selector Tabs */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800/80 flex items-center gap-1 print:hidden">
            <button
              type="button"
              onClick={() => setPaperSize('80mm')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                paperSize === '80mm'
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>📄 80mm Wide (Standard POS)</span>
            </button>
            <button
              type="button"
              onClick={() => setPaperSize('58mm')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                paperSize === '58mm'
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>📱 58mm Mobile</span>
            </button>
          </div>
          <div className="overflow-x-auto p-1">
            {/* Thermal Slip Visual Preview */}
            <div
              id="thermalReceipt"
              className={`bg-slate-50 text-slate-900 py-6 rounded-xl font-mono leading-normal shadow-lg mx-auto border border-slate-200 select-all transition-all ${
                paperSize === '80mm' ? 'receipt-80mm px-5 text-xs' : 'receipt-58mm px-3 text-[10px]'
              }`}
            >
              {/* Header Info */}
              <div className="text-center space-y-1">
                <h2 className="text-sm md:text-base font-bold tracking-tight uppercase text-black">{shopName}</h2>
                <p className="text-[11px] md:text-xs text-slate-700 block font-normal font-sans">{shopSinhala}</p>
                <div className="text-[10px] md:text-xs text-slate-600 font-sans space-y-0.5 mt-1 block font-normal">
                  <p>📍 {shopAddress}</p>
                  <p>📞 {shopPhone}</p>
                </div>
              </div>

              {/* Dotted separator line */}
              <div className="border-t border-dotted border-slate-300 my-3"></div>

              {/* Transaction Metadata block */}
              <div className="space-y-1 font-sans text-slate-700 text-[11px] md:text-xs font-normal">
                <div className="thermal-meta-row">
                  <span className="thermal-meta-label">BILL INVOICE NO:</span>
                  <span className="thermal-meta-value font-mono text-slate-900">{transaction.id}</span>
                </div>
                <div className="thermal-meta-row">
                  <span className="thermal-meta-label">DATE & TIME:</span>
                  <span className="thermal-meta-value text-slate-800">{formatDateString(transaction.date)}</span>
                </div>
                <div className="thermal-meta-row">
                  <span className="thermal-meta-label">{transaction.type === 'sell' ? 'CLIENT / CUSTOMER:' : (transaction.type === 'return' ? 'CUSTOMER / CLIENT:' : 'SUPPLIER / GROWER:')}</span>
                  <span className="thermal-meta-value text-slate-900 uppercase">{transaction.contactName || 'Walk-In Customer'}</span>
                </div>
                <div className="thermal-meta-row">
                  <span className="thermal-meta-label">PAYMENT METHOD:</span>
                  <span className="thermal-meta-value text-slate-900 uppercase">{transaction.payment_method || 'CASH'}</span>
                </div>
                {transaction.type === 'sell' && (
                  <div className="thermal-meta-row">
                    <span className="thermal-meta-label">SALE TYPE:</span>
                    <span className="thermal-meta-value text-slate-900 uppercase">
                      {transaction.is_wholesale ? 'WHOLESALE / තොග' : 'RETAIL / සිල්ලර'}
                    </span>
                  </div>
                )}
                {transaction.type === 'return' && (
                  <>
                    <div className="thermal-meta-row">
                      <span className="thermal-meta-label">BILL TYPE:</span>
                      <span className="thermal-meta-value text-rose-700 font-bold uppercase">RETURN BILL / ආපසු බාරගැනීම</span>
                    </div>
                    {transaction.ref_invoice_no && (
                      <div className="thermal-meta-row">
                        <span className="thermal-meta-label">REF INVOICE NO:</span>
                        <span className="thermal-meta-value text-slate-900 font-mono">{transaction.ref_invoice_no}</span>
                      </div>
                    )}
                    {transaction.return_reason && (
                      <div className="thermal-meta-row">
                        <span className="thermal-meta-label">RETURN REASON:</span>
                        <span className="thermal-meta-value text-slate-900">{transaction.return_reason}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="thermal-meta-row">
                  <span className="thermal-meta-label">OPERATIONAL COUNTER:</span>
                  <span className="thermal-meta-value text-slate-800">@{transaction.createdBy}</span>
                </div>
              </div>

              {/* Dotted separator line */}
              <div className="border-t border-dotted border-slate-300 my-3"></div>

              {/* Items list - Responsive Flex-Wrap Item Grid for 80mm/58mm Thermal */}
              <div className="thermal-items-table font-sans">
                <div className="thermal-item-header text-slate-900">
                  <div className="thermal-col-name text-left">Item Details</div>
                  <div className="thermal-col-qty text-center">Qty</div>
                  <div className="thermal-col-price text-right">Price</div>
                  <div className="thermal-col-total text-right">Total</div>
                </div>

                <div className="divide-y divide-slate-100 text-slate-800">
                  {transaction.items.map((it, idx) => (
                    <div key={`${it.productId}-${idx}`} className="thermal-item-row">
                      <div className="thermal-col-name">
                        <div className="capitalize text-slate-900 leading-tight">
                          {toSinhalaProductName(it.productName)}
                        </div>
                        {it.deductionQty && it.deductionQty > 0 ? (
                          <div className="text-[9px] text-slate-600 font-normal font-mono mt-0.5">
                            ({it.grossQty || it.qty}{it.unit} - {it.deductionQty}{it.unit} = {it.qty}{it.unit})
                          </div>
                        ) : null}
                      </div>
                      <div className="thermal-col-qty text-slate-700">
                        {it.qty}
                        <span className="text-[9px] text-slate-500 ml-0.5 lowercase">{it.unit}</span>
                      </div>
                      <div className="thermal-col-price font-mono text-slate-700">
                        {it.price.toFixed(2)}
                      </div>
                      <div className="thermal-col-total text-slate-900 font-mono">
                        {it.total.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dotted separator line */}
              <div className="border-t border-dotted border-slate-300 my-3"></div>

              {/* Totals summary ledger block */}
              <div className="space-y-1 font-sans text-[11px] md:text-xs">
                <div className="thermal-meta-row text-slate-700">
                  <span className="thermal-meta-label">Gross Subtotal:</span>
                  <span className="thermal-meta-value font-mono text-slate-900">Rs. {transaction.subtotal.toFixed(2)}</span>
                </div>
                {transaction.discount > 0 && (
                  <div className="thermal-meta-row text-red-600">
                    <span className="thermal-meta-label">Discount Allowed (-):</span>
                    <span className="thermal-meta-value font-mono">-Rs. {transaction.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="thermal-meta-row text-slate-900 font-bold border-t border-slate-300 pt-2 mt-1.5 text-xs md:text-sm">
                  <span className="thermal-meta-label">{transaction.type === 'return' ? 'TOTAL REFUND (ආපසු ගෙවීම):' : 'Net Ledger Total:'}</span>
                  <span className="thermal-meta-value font-mono text-black font-extrabold underline decoration-double">Rs. {transaction.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Dotted separator line */}
              <div className="border-t border-dotted border-slate-300 my-3"></div>

              {/* Receipt Footer note */}
              <div className="text-center font-sans space-y-0.5 text-slate-600 text-[10px] md:text-xs tracking-wide">
                <p className="font-bold text-slate-800 uppercase">{footerNote}</p>
                {footerSubNote && (
                  <p className="text-slate-500 text-[9px] md:text-[10px] mt-0.5">{footerSubNote}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal actions */}
        <div className="space-y-2.5 pt-3 border-t border-slate-800 print:hidden mt-2 font-sans">
          {/* Main Direct Chrome Bluetooth Print Button */}
          <button
            onClick={handleChromeBluetoothPrint}
            disabled={printing}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-extrabold text-sm tracking-wide transition-all shadow-xl shadow-indigo-950/50 cursor-pointer flex items-center justify-center gap-2.5 active:scale-[0.98] border border-indigo-400/30 disabled:opacity-50"
          >
            {printing ? (
              <Loader2 size={18} className="animate-spin text-white" />
            ) : (
              <Bluetooth size={18} className="text-white animate-pulse" />
            )}
            <span>{printing ? 'Bluetooth මඟින් සම්බන්ධ වෙමින්...' : 'Bluetooth Print (Chrome) 🖨️'}</span>
          </button>

          {/* Connected Device status badge if available */}
          {connectedDeviceName && (
            <div className="text-center text-[10px] text-emerald-400 font-semibold flex items-center justify-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping"></span>
              <span>සම්බන්ධිත ප්‍රින්ටරය: {connectedDeviceName}</span>
            </div>
          )}

          {/* Secondary Action Grid */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleRawBtPrint}
              className="py-2.5 px-2.5 rounded-xl border border-emerald-500/40 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"
              title="Android RawBT App හරහා බිල මුද්‍රණය කරන්න"
            >
              <Bluetooth size={14} className="text-emerald-400 shrink-0" />
              <span>RawBT App 📱</span>
            </button>

            <button
              onClick={handleBrowserPrint}
              className="py-2.5 px-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98]"
              title="Browser Standard Print"
            >
              <Printer size={14} className="text-indigo-400 shrink-0" />
              <span>Standard Print 📄</span>
            </button>
          </div>

          {/* Delete Bill Action (if onDelete is provided) */}
          {onDelete && transaction && (
            <button
              onClick={() => {
                if (window.confirm(`මෙම බිල්පත #${transaction.id} සම්පූර්ණයෙන්ම මකා දැමීමට (Delete) අවශ්‍ය බව සහතිකද?`)) {
                  onDelete(transaction.id);
                  onClose();
                }
              }}
              className="w-full py-2 px-3 rounded-xl border border-rose-800/40 bg-rose-950/20 hover:bg-rose-900/40 text-rose-400 hover:text-rose-300 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98]"
            >
              <Trash2 size={13} className="text-rose-400" />
              <span>මෙම බිල්පත මකන්න (Delete Bill) 🗑️</span>
            </button>
          )}

          {/* Instructions card */}
          <div className="bg-slate-950/90 rounded-xl p-3 border border-slate-800/90 space-y-1.5 text-[10px]">
            <p className="font-bold text-amber-400 flex items-center gap-1">
              <span>💡 Bluetooth Printer Pair කරගන්නා ආකාරය:</span>
            </p>
            <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[9.5px] leading-relaxed">
              <li>
                පළමුව Phone එකේ <strong className="text-white">Settings ⚙️ ➔ Bluetooth</strong> වෙත ගොස් Printer එක Pair කරන්න (PIN code: <code className="text-amber-300 bg-slate-900 px-1 py-0.5 rounded">0000</code> හෝ <code className="text-amber-300 bg-slate-900 px-1 py-0.5 rounded">1234</code>).
              </li>
              <li>
                ඉන්පසු <strong className="text-indigo-300">Bluetooth Print (Chrome)</strong> ක්ලික් කර ඔබගේ Printer එක තෝරන්න.
              </li>
              <li>
                Bluetooth Direct සම්බන්ධතාවය නොලැබේ නම්, <strong className="text-emerald-300">RawBT App 📱</strong> ක්ලික් කරන්න. (Google Play Store හි <a href="https://play.google.com/store/apps/details?id=ru.a23.rawbtprinter" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline font-bold">RawBT Driver app</a> එක නොමිලේ තිබේ).
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

