/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ProductUnit = 'kg' | 'g' | 'pcs';

export interface User {
  id: string;
  name: string;
  username: string;
  role: 'superuser' | 'admin' | 'cashier';
  password?: string;
  shop_name?: string;
  phone_number?: string;
  invoice_prefix?: string;
  store_id?: string;
}

export interface Product {
  id: string;
  name: string;
  unit: ProductUnit;
  buyPrice: number;
  sellPrice: number;
  stock: number;
  lahiru_stock: number;
  jayantha_stock: number;
  min_stock_level: number;
  buying_price: number;
  wholesale_price: number;
  retail_price: number;
  store_id?: string;
}

export interface TransactionItem {
  productId: string;
  productName: string;
  qty: number; // Net Qty (grossQty - deductionQty)
  grossQty?: number; // Gross weight/qty
  deductionQty?: number; // Tare/stem weight deduction (-kg)
  unit: ProductUnit;
  price: number;
  total: number;
  new_wholesale_price?: number;
  new_retail_price?: number;
  buyingPrice?: number;
  wholesalePrice?: number;
  retailPrice?: number;
}

export interface CreditPaymentLog {
  id: string;
  date: string; // ISO string
  amount: number;
  payment_method: 'Cash' | 'Bank Transfer' | 'Cheque' | 'Card' | 'Other';
  note?: string;
  addedBy: string;
}

export interface Transaction {
  id: string;
  date: string; // ISO string 2026-05-24T...
  type: 'sell' | 'buy' | 'return';
  items: TransactionItem[];
  subtotal: number;
  discount: number;
  total: number;
  contactName: string; // customer name for sell, supplier name for buy/return
  createdBy: string; // username of user who performed it
  invoice_no?: string;
  user_id?: string;
  payment_method?: string;
  amount_paid?: number;
  total_profit?: number;
  is_wholesale?: boolean;
  ref_invoice_no?: string;
  return_reason?: string;
  credit_status?: 'pending' | 'partially_paid' | 'paid';
  credit_paid_amount?: number;
  credit_payments?: CreditPaymentLog[];
  store_id?: string;
}

export interface TodayStats {
  sales: number;
  purchases: number;
  profit: number;
  totalProducts: number;
}

export interface OpeningCashLog {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: string;
  amount: number;
  addedBy: string; // username of operator e.g. lahiru, jayantha
  store_id?: string;
}

export interface Expense {
  id: string;
  date: string; // ISO string e.g. 2026-07-26T10:00:00.000Z
  category: string; // e.g. 'Stationery/Books', 'Food/Meals', 'Tea/Refreshments', 'Utilities', 'Transport', 'Other'
  title: string;
  amount: number;
  addedBy: string; // username of user who recorded it
  note?: string;
  store_id?: string;
}

export interface ShopProfile {
  shopName: string;
  shopSinhalaName: string;
  address: string;
  phone1: string;
  phone2: string;
  footerNote: string;
  footerSubNote?: string;
  invoice_prefix?: string;
  store_id?: string;
}

export type StockAdjustmentReason = 'wastage' | 'drying_loss' | 'damage' | 'audit_loss' | 'other';

export interface StockAdjustment {
  id: string; // e.g. ADJ-1748291024
  date: string; // ISO string e.g. 2026-08-16T...
  productId: string;
  productName: string;
  qty: number; // reduction qty in base or item unit
  unit: ProductUnit;
  reason: StockAdjustmentReason;
  reasonNote?: string;
  costPerUnit: number; // Buying price per kg/unit at time of adjustment
  totalLoss: number; // qty * costPerUnit
  adjustedBy: string; // username e.g. lahiru, jayantha, admin
  desk: 'lahiru' | 'jayantha'; // which inventory desk was reduced
}

