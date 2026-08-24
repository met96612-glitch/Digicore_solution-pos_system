import { createClient } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL = 'https://vmwjofihygzmcurumvsq.supabase.co';
export const DEFAULT_SUPABASE_KEY = 'sb_publishable_3OTfY2AkPnWIVgalizjKag_w9JPyUVP';

// Get keys from either import.meta.env, localStorage, or default fallback
export function getSupabaseKeys() {
  const customUrl = localStorage.getItem('lahiya_supabase_url') || '';
  const customKey = localStorage.getItem('lahiya_supabase_key') || '';

  const metaEnv = (import.meta as any).env || {};
  const envUrl = metaEnv.VITE_SUPABASE_URL || '';
  const envKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';

  const url = customUrl || envUrl || DEFAULT_SUPABASE_URL;
  const key = customKey || envKey || DEFAULT_SUPABASE_KEY;

  return {
    url,
    key,
    isCustom: !!customUrl
  };
}

export function createSupabaseClient() {
  const { url, key } = getSupabaseKeys();
  if (!url || !key) return null;
  try {
    return createClient(url, key);
  } catch (error) {
    console.warn('Failed to initialize Supabase client:', error);
    return null;
  }
}

// Check if connection is fully configured and working
export async function testSupabaseConnection(url: string, key: string): Promise<boolean> {
  if (!url || !key) return false;
  try {
    const client = createClient(url, key);
    // Just run a simple health query (or try fetching a dummy table/auth session space)
    const { error } = await client.from('products').select('id').limit(1);
    // If the error is 'relation "products" does not exist', this means we DID successfully connect to Supabase database, but the table schema needs to be setup. Which is expected!
    if (error && error.code === 'PGRST116') {
      return true; // Table doesn't exist yet but credentials/connection are authenticated!
    }
    if (error && error.message.includes('FetchError')) {
      return false; // Network or wrong URL
    }
    if (error && error.message.includes('Invalid API key') || (error && error.code === '401')) {
      return false; // Wrong API Key
    }
    return true;
  } catch (e) {
    return false;
  }
}

// Syncer to help create and mirror data
export async function syncDataToSupabase(
  products: any[],
  transactions: any[],
  users: any[]
): Promise<{ success: boolean; log: string }> {
  const client = createSupabaseClient();
  if (!client) {
    return { success: false, log: 'Supabase is not configured yet.' };
  }

  let log = '';
  let encounteredRlsError = false;
  try {
    // 1. Sync Products
    log += 'Syncing products...\n';
    for (const prod of products) {
      const { error } = await safeUpsert(client, 'products', {
        id: prod.id,
        name: prod.name,
        unit: prod.unit,
        buyPrice: prod.buyPrice ?? prod.buying_price ?? 0,
        sellPrice: prod.sellPrice ?? prod.retail_price ?? 0,
        stock: prod.stock ?? 0,
        lahiru_stock: prod.lahiru_stock ?? prod.stock ?? 0,
        jayantha_stock: prod.jayantha_stock ?? prod.stock ?? 0,
        min_stock_level: prod.min_stock_level ?? 5.0,
        buying_price: prod.buying_price ?? prod.buyPrice ?? 0,
        wholesale_price: prod.wholesale_price ?? (prod.sellPrice * 0.9),
        retail_price: prod.retail_price ?? prod.sellPrice ?? 0,
        category: prod.category || 'Spices',
        image: prod.image || '',
        store_id: prod.store_id || ''
      });
      if (error) {
        log += `⚠️ Product sync error for ${prod.name}: ${error.message}\n`;
        if (error.message?.toLowerCase().includes('row-level security') || error.message?.toLowerCase().includes('rls') || error.code === '42501') {
          encounteredRlsError = true;
        }
      }
    }

    // 2. Sync Transactions
    log += 'Syncing transactions...\n';
    for (const tx of transactions) {
      const isCredit = tx.payment_method?.toLowerCase() === 'credit' || tx.paymentMethod?.toLowerCase() === 'credit';
      const amountPaid = tx.amount_paid !== undefined && tx.amount_paid !== null 
        ? Number(tx.amount_paid) 
        : (isCredit ? 0 : Number(tx.total));
      const creditPaidAmt = tx.credit_paid_amount !== undefined && tx.credit_paid_amount !== null
        ? Number(tx.credit_paid_amount)
        : amountPaid;

      let defaultStatus = 'paid';
      if (isCredit) {
        if (creditPaidAmt >= tx.total) defaultStatus = 'paid';
        else if (creditPaidAmt > 0) defaultStatus = 'partially_paid';
        else defaultStatus = 'pending';
      }

      const { error } = await safeUpsert(client, 'transactions', {
        id: tx.id,
        date: tx.date,
        type: tx.type,
        total: tx.total,
        subtotal: tx.subtotal,
        discount: tx.discount,
        contactName: tx.contactName || '',
        paymentMethod: tx.payment_method || tx.paymentMethod || 'cash',
        createdBy: tx.createdBy,
        items: typeof tx.items === 'string' ? tx.items : JSON.stringify(tx.items),
        invoice_no: tx.invoice_no || '',
        user_id: tx.user_id || '',
        payment_method: tx.payment_method || tx.paymentMethod || 'cash',
        amount_paid: amountPaid,
        total_profit: tx.total_profit ?? 0,
        is_wholesale: tx.is_wholesale ?? false,
        credit_status: tx.credit_status || defaultStatus,
        credit_paid_amount: creditPaidAmt,
        credit_payments: tx.credit_payments ? (typeof tx.credit_payments === 'string' ? tx.credit_payments : JSON.stringify(tx.credit_payments)) : null,
        store_id: tx.store_id || ''
      });
      if (error) {
        log += `⚠️ Transaction sync error for ${tx.id}: ${error.message}\n`;
        if (error.message?.toLowerCase().includes('row-level security') || error.message?.toLowerCase().includes('rls') || error.code === '42501') {
          encounteredRlsError = true;
        }
      }
    }

    // 3. Sync Users
    log += 'Syncing users...\n';
    for (const u of users) {
      const { error } = await safeUpsert(client, 'users', {
        id: u.id,
        name: u.name,
        username: u.username,
        role: u.role,
        password: u.password,
        shop_name: u.shop_name || '',
        phone_number: u.phone_number || '',
        invoice_prefix: u.invoice_prefix || '',
        store_id: u.store_id || (u.username === 'jayantha' ? 'store_2' : 'store_1')
      });
      if (error) {
        log += `⚠️ User sync error for ${u.username}: ${error.message}\n`;
        if (error.message?.toLowerCase().includes('row-level security') || error.message?.toLowerCase().includes('rls') || error.code === '42501') {
          encounteredRlsError = true;
        }
      }
    }

    if (encounteredRlsError) {
      localStorage.setItem('supabase_last_rls_error', 'true');
      window.dispatchEvent(new CustomEvent('supabase-rls-error', { detail: 'Row-level security policy violation during batch sync.' }));
    } else {
      const hadRlsError = localStorage.getItem('supabase_last_rls_error');
      if (hadRlsError) {
        localStorage.removeItem('supabase_last_rls_error');
        window.dispatchEvent(new CustomEvent('supabase-rls-resolved'));
      }
    }

    log += '✅ Sync completed successfully!';
    return { success: !encounteredRlsError, log };
  } catch (err: any) {
    log += `❌ Error high level sync failed: ${err?.message || err}`;
    return { success: false, log };
  }
}

// Helper to upsert data safely by automatically dropping keys that don't exist in Supabase schema cache
export async function safeUpsert(client: any, table: string, dataObj: any): Promise<{ data: any; error: any }> {
  let record = Array.isArray(dataObj)
    ? dataObj.map(item => ({ ...item }))
    : { ...dataObj };

  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await client.from(table).upsert(record);
    if (!res.error) {
      return res;
    }

    const errorMsg = res.error.message || '';
    const match =
      errorMsg.match(/Could not find the '([^']+)' column/i) ||
      errorMsg.match(/column "([^"]+)" of relation/i) ||
      errorMsg.match(/column '([^']+)'/i);

    if (match && match[1]) {
      const missingCol = match[1];
      console.warn(`Supabase table '${table}' missing column '${missingCol}'. Retrying upsert without it...`);
      if (Array.isArray(record)) {
        record.forEach(item => delete item[missingCol]);
      } else {
        delete record[missingCol];
      }
      continue;
    }

    return res;
  }
  return await client.from(table).upsert(record);
}

// Specific quick sync helpers
export async function pushProductToSupabase(prodOrProds: any) {
  const client = createSupabaseClient();
  if (!client) return;
  const items = Array.isArray(prodOrProds) ? prodOrProds : [prodOrProds];
  if (items.length === 0) return;
  try {
    const records = items.map(prod => ({
      id: prod.id,
      name: prod.name,
      unit: prod.unit,
      buyPrice: prod.buyPrice ?? prod.buying_price ?? 0,
      sellPrice: prod.sellPrice ?? prod.retail_price ?? 0,
      stock: prod.stock ?? 0,
      lahiru_stock: prod.lahiru_stock ?? prod.stock ?? 0,
      jayantha_stock: prod.jayantha_stock ?? prod.stock ?? 0,
      min_stock_level: prod.min_stock_level ?? 5.0,
      buying_price: prod.buying_price ?? prod.buyPrice ?? 0,
      wholesale_price: prod.wholesale_price ?? (prod.sellPrice * 0.9),
      retail_price: prod.retail_price ?? prod.sellPrice ?? 0,
      category: prod.category || 'Spices',
      image: prod.image || '',
      store_id: prod.store_id || ''
    }));

    const { error } = await safeUpsert(client, 'products', records);
    if (error) {
      console.error('Supabase auto product sync error details:', error.message, error.details, error.hint, error);
      if (error.message?.toLowerCase().includes('row-level security') || error.message?.toLowerCase().includes('rls') || error.code === '42501') {
        localStorage.setItem('supabase_last_rls_error', 'true');
        window.dispatchEvent(new CustomEvent('supabase-rls-error', { detail: error.message }));
      }
    } else {
      // Clear error on successful upsert
      const hadRlsError = localStorage.getItem('supabase_last_rls_error');
      if (hadRlsError) {
        localStorage.removeItem('supabase_last_rls_error');
        window.dispatchEvent(new CustomEvent('supabase-rls-resolved'));
      }
    }
  } catch (e) {
    console.warn('Supabase auto product sync failed:', e);
  }
}

export async function pushTransactionToSupabase(tx: any) {
  const client = createSupabaseClient();
  if (!client) return;
  try {
    const isCredit = tx.payment_method?.toLowerCase() === 'credit' || tx.paymentMethod?.toLowerCase() === 'credit';
    const amountPaid = tx.amount_paid !== undefined && tx.amount_paid !== null 
      ? Number(tx.amount_paid) 
      : (isCredit ? 0 : Number(tx.total));
    const creditPaidAmt = tx.credit_paid_amount !== undefined && tx.credit_paid_amount !== null
      ? Number(tx.credit_paid_amount)
      : amountPaid;

    let defaultStatus = 'paid';
    if (isCredit) {
      if (creditPaidAmt >= tx.total) defaultStatus = 'paid';
      else if (creditPaidAmt > 0) defaultStatus = 'partially_paid';
      else defaultStatus = 'pending';
    }

    const { error } = await safeUpsert(client, 'transactions', {
      id: tx.id,
      date: tx.date,
      type: tx.type,
      total: tx.total,
      subtotal: tx.subtotal,
      discount: tx.discount,
      contactName: tx.contactName || '',
      paymentMethod: tx.payment_method || tx.paymentMethod || 'cash',
      createdBy: tx.createdBy,
      items: typeof tx.items === 'string' ? tx.items : JSON.stringify(tx.items),
      invoice_no: tx.invoice_no || '',
      user_id: tx.user_id || '',
      payment_method: tx.payment_method || tx.paymentMethod || 'cash',
      amount_paid: amountPaid,
      total_profit: tx.total_profit ?? 0,
      is_wholesale: tx.is_wholesale ?? false,
      credit_status: tx.credit_status || defaultStatus,
      credit_paid_amount: creditPaidAmt,
      credit_payments: tx.credit_payments ? (typeof tx.credit_payments === 'string' ? tx.credit_payments : JSON.stringify(tx.credit_payments)) : null,
      store_id: tx.store_id || ''
    });
    if (error) {
      console.error(`Supabase transaction upsert error for ${tx.id}:`, error.message, error.details, error);
      if (error.message?.toLowerCase().includes('row-level security') || error.message?.toLowerCase().includes('rls') || error.code === '42501') {
        localStorage.setItem('supabase_last_rls_error', 'true');
        window.dispatchEvent(new CustomEvent('supabase-rls-error', { detail: error.message }));
      }
    } else {
      const hadRlsError = localStorage.getItem('supabase_last_rls_error');
      if (hadRlsError) {
        localStorage.removeItem('supabase_last_rls_error');
        window.dispatchEvent(new CustomEvent('supabase-rls-resolved'));
      }
    }
  } catch (e) {
    console.warn('Supabase auto transaction sync failed:', e);
  }
}

export async function pushUserToSupabase(u: any) {
  const client = createSupabaseClient();
  if (!client) return;
  try {
    const { error } = await safeUpsert(client, 'users', {
      id: u.id,
      name: u.name,
      username: u.username,
      role: u.role,
      password: u.password,
      shop_name: u.shop_name || '',
      phone_number: u.phone_number || '',
      invoice_prefix: u.invoice_prefix || '',
      store_id: u.store_id || (u.username === 'jayantha' ? 'store_2' : 'store_1')
    });
    if (error) {
      console.error(`Supabase user upsert error for ${u.username}:`, error.message, error.details, error);
      if (error.message?.toLowerCase().includes('row-level security') || error.message?.toLowerCase().includes('rls') || error.code === '42501') {
        localStorage.setItem('supabase_last_rls_error', 'true');
        window.dispatchEvent(new CustomEvent('supabase-rls-error', { detail: error.message }));
      }
    } else {
      const hadRlsError = localStorage.getItem('supabase_last_rls_error');
      if (hadRlsError) {
        localStorage.removeItem('supabase_last_rls_error');
        window.dispatchEvent(new CustomEvent('supabase-rls-resolved'));
      }
    }
  } catch (e) {
    console.warn('Supabase auto user sync failed:', e);
  }
}

export async function removeUserFromSupabase(userId: string) {
  const client = createSupabaseClient();
  if (!client) return;
  try {
    await client.from('users').delete().eq('id', userId);
  } catch (e) {
    console.warn('Supabase auto user delete failed:', e);
  }
}

export async function removeProductFromSupabase(prodId: string) {
  const client = createSupabaseClient();
  if (!client) return;
  try {
    await client.from('products').delete().eq('id', prodId);
  } catch (e) {
    console.warn('Supabase auto product delete failed:', e);
  }
}

export async function removeTransactionFromSupabase(txId: string) {
  const client = createSupabaseClient();
  if (!client) return;
  try {
    await client.from('transactions').delete().eq('id', txId);
  } catch (e) {
    console.warn('Supabase auto transaction delete failed:', e);
  }
}

export async function clearAllTransactionsInSupabase() {
  const client = createSupabaseClient();
  if (!client) return;
  try {
    const { data: txList, error: fetchErr } = await client.from('transactions').select('id');
    if (fetchErr) {
      console.warn('Failed to fetch transactions list for deletion:', fetchErr);
    }
    if (txList && txList.length > 0) {
      const ids = txList.map(t => t.id);
      const { error: delErr } = await client.from('transactions').delete().in('id', ids);
      if (delErr) {
        console.warn('Failed in.delete for transactions, trying neq delete:', delErr);
        await client.from('transactions').delete().neq('id', '_non_existent_placeholder_id_');
      }
    } else {
      await client.from('transactions').delete().neq('id', '_non_existent_placeholder_id_');
    }
  } catch (e) {
    console.warn('Failed to clear transactions from Supabase:', e);
  }
}

export async function resetProductsInSupabase(productsList: any[]) {
  const client = createSupabaseClient();
  if (!client) return;
  try {
    const { data: prodList } = await client.from('products').select('id');
    if (prodList && prodList.length > 0) {
      const ids = prodList.map(p => p.id);
      await client.from('products').delete().in('id', ids);
    } else {
      await client.from('products').delete().neq('id', '_non_existent_placeholder_id_');
    }

    if (productsList && productsList.length > 0) {
      const records = productsList.map(prod => ({
        id: prod.id,
        name: prod.name,
        unit: prod.unit,
        buyPrice: prod.buyPrice ?? prod.buying_price ?? 0,
        sellPrice: prod.sellPrice ?? prod.retail_price ?? 0,
        stock: prod.stock ?? 0,
        lahiru_stock: prod.lahiru_stock ?? prod.stock ?? 0,
        jayantha_stock: prod.jayantha_stock ?? prod.stock ?? 0,
        min_stock_level: prod.min_stock_level ?? 5.0,
        buying_price: prod.buying_price ?? prod.buyPrice ?? 0,
        wholesale_price: prod.wholesale_price ?? (prod.sellPrice * 0.9),
        retail_price: prod.retail_price ?? prod.sellPrice ?? 0,
        category: prod.category || 'Spices',
        image: prod.image || '',
        store_id: prod.store_id || ''
      }));
      await safeUpsert(client, 'products', records);
    }
  } catch (e) {
    console.warn('Failed to reset products in Supabase:', e);
  }
}

export async function resetUsersInSupabase(usersList: any[]) {
  const client = createSupabaseClient();
  if (!client) return;
  try {
    const { data: userList } = await client.from('users').select('id');
    if (userList && userList.length > 0) {
      const ids = userList.map(u => u.id);
      await client.from('users').delete().in('id', ids);
    } else {
      await client.from('users').delete().neq('id', '_non_existent_placeholder_id_');
    }

    if (usersList && usersList.length > 0) {
      const records = usersList.map(u => ({
        id: u.id,
        name: u.name,
        username: u.username,
        role: u.role,
        password: u.password,
        shop_name: u.shop_name || '',
        phone_number: u.phone_number || '',
        invoice_prefix: u.invoice_prefix || '',
        store_id: u.store_id || (u.username === 'jayantha' ? 'store_2' : 'store_1')
      }));
      await safeUpsert(client, 'users', records);
    }
  } catch (e) {
    console.warn('Failed to reset users in Supabase:', e);
  }
}

export function normalizeProduct(p: any): any {
  if (!p) return p;
  const id = p.id ? String(p.id) : Math.random().toString(36).substring(2, 9);
  const stock = Number(p.stock ?? 0);
  const buyPrice = Number(p.buyPrice ?? p.buying_price ?? 0);
  const sellPrice = Number(p.sellPrice ?? p.retail_price ?? 0);
  const lahiru_stock = Number(p.lahiru_stock !== undefined && p.lahiru_stock !== null ? p.lahiru_stock : stock);
  const jayantha_stock = Number(p.jayantha_stock !== undefined && p.jayantha_stock !== null ? p.jayantha_stock : stock);

  return {
    ...p,
    id,
    name: p.name || 'Unnamed Product',
    unit: p.unit || 'kg',
    buyPrice,
    sellPrice,
    stock,
    lahiru_stock,
    jayantha_stock,
    min_stock_level: Number(p.min_stock_level !== undefined && p.min_stock_level !== null ? p.min_stock_level : 5.0),
    buying_price: Number(p.buying_price ?? buyPrice),
    wholesale_price: Number(p.wholesale_price ?? (sellPrice * 0.9)),
    retail_price: Number(p.retail_price ?? sellPrice),
    store_id: p.store_id || '',
  };
}

export async function fetchProductsFromSupabase(storeId?: string): Promise<any[] | null> {
  const client = createSupabaseClient();
  if (!client) return null;
  try {
    let query = client.from('products').select('*');
    if (storeId) {
      query = query.eq('store_id', storeId);
    }
    const { data, error } = await query;
    if (error) {
      console.warn('Failed to fetch products from Supabase:', error.message || error);
      return null;
    }
    if (!data) return [];
    return data.map(normalizeProduct);
  } catch (e) {
    console.warn(e);
    return null;
  }
}

export async function fetchTransactionsFromSupabase(storeId?: string): Promise<any[] | null> {
  const client = createSupabaseClient();
  if (!client) return null;
  try {
    let query = client.from('transactions').select('*');
    if (storeId) {
      query = query.eq('store_id', storeId);
    }
    const { data, error } = await query;
    if (error) {
      console.warn('Failed to fetch transactions from Supabase:', error.message || error);
      return null;
    }
    return data.map(tx => {
      let parsedItems = tx.items;
      if (typeof tx.items === 'string') {
        try {
          parsedItems = JSON.parse(tx.items);
        } catch (err) {
          console.warn('Failed to parse transaction items string:', tx.items);
        }
      }
      let parsedCreditPayments = tx.credit_payments;
      if (typeof tx.credit_payments === 'string') {
        try {
          parsedCreditPayments = JSON.parse(tx.credit_payments);
        } catch (err) {
          parsedCreditPayments = [];
        }
      }
      const pm = tx.payment_method || tx.paymentMethod || 'Cash';
      const isCredit = pm.toLowerCase() === 'credit';
      const amtPaid = tx.amount_paid !== undefined && tx.amount_paid !== null 
        ? Number(tx.amount_paid) 
        : (isCredit ? 0 : Number(tx.total || 0));
      const creditPaidAmt = tx.credit_paid_amount !== undefined && tx.credit_paid_amount !== null
        ? Number(tx.credit_paid_amount)
        : amtPaid;

      let defaultStatus = 'paid';
      if (isCredit) {
        if (creditPaidAmt >= (tx.total || 0)) defaultStatus = 'paid';
        else if (creditPaidAmt > 0) defaultStatus = 'partially_paid';
        else defaultStatus = 'pending';
      }

      return {
        ...tx,
        store_id: tx.store_id || '',
        items: parsedItems || [],
        payment_method: pm,
        paymentMethod: pm,
        amount_paid: amtPaid,
        credit_paid_amount: creditPaidAmt,
        credit_status: tx.credit_status || defaultStatus,
        credit_payments: parsedCreditPayments || []
      };
    });
  } catch (e) {
    console.warn(e);
    return null;
  }
}

export async function fetchUsersFromSupabase(storeId?: string): Promise<any[] | null> {
  const client = createSupabaseClient();
  if (!client) return null;
  try {
    let query = client.from('users').select('*');
    if (storeId) {
      query = query.eq('store_id', storeId);
    }
    const { data, error } = await query;
    if (error) {
      console.warn('Failed to fetch users from Supabase:', error.message || error);
      return null;
    }
    return data;
  } catch (e) {
    console.warn(e);
    return null;
  }
}
