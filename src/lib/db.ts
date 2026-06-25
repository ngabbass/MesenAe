import { collection, query, where, orderBy, limit as fLimit, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc, getDoc, onSnapshot, increment } from 'firebase/firestore';
import { db as firestoreDb } from './firebase';
import { mapCategory, mapProduct, mapStoreSettings } from './sync';
import { OfflineQueueService } from './offlineQueue';

export const isDbConfigured = true;

// Caching mechanism removed as per user request to rely purely on Firestore.

// ============================================================
// CLEAN UNDEFINED VALUES FOR FIRESTORE
// ============================================================
const cleanUndefined = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(cleanUndefined);
  const out: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      out[key] = cleanUndefined(value);
    }
  }
  return out;
};

// ============================================================
// FIRESTORE QUERY BUILDER
// ============================================================

class FirestoreQueryBuilder {
  private tableName: string;
  private filters: { field: string; op: any; value: any }[] = [];
  private orderClauses: { field: string; dir: 'asc' | 'desc' }[] = [];
  private limitCount?: number;
  private actionType: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private actionData: any = null;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(columns: string = '*') {
    return this;
  }

  eq(column: string, value: any) {
    const snakeColumn = column.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
    this.filters.push({ field: snakeColumn, op: '==', value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    const snakeColumn = column.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
    this.orderClauses.push({ field: snakeColumn, dir: options?.ascending === false ? 'desc' : 'asc' });
    return this;
  }

  limit(num: number) {
    this.limitCount = num;
    return this;
  }

  async single() {
    this.limitCount = 1;
    const res = await this.execute();
    if (res.error) return { data: null, error: res.error };
    return { data: res.data ? res.data[0] || null : null, error: null };
  }

  then(onfulfilled?: (value: any) => any) {
    return this.execute().then(onfulfilled);
  }

  update(values: any) {
    this.actionType = 'update';
    this.actionData = values;
    return this;
  }

  delete() {
    this.actionType = 'delete';
    return this;
  }

  insert(values: any) {
    this.actionType = 'insert';
    this.actionData = values;
    return this;
  }

  async execute() {
    try {
      if (this.actionType === 'select') {
        const colRef = collection(firestoreDb, this.tableName);
        let q: any = colRef;
        
        for (const f of this.filters) {
          q = query(q, where(f.field, f.op, f.value));
        }
        for (const o of this.orderClauses) {
          q = query(q, orderBy(o.field, o.dir));
        }
        if (this.limitCount) {
          q = query(q, fLimit(this.limitCount));
        }
        
        try {
          const snapshot = await getDocs(q);
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          return { data, error: null };
        } catch (err: any) {
          console.warn(`[FirestoreDB] Network fetch failed for ${this.tableName}.`);
          return { data: null, error: err };
        }
      } 
      else if (this.actionType === 'insert') {
        const colRef = collection(firestoreDb, this.tableName);
        const cleanedData = cleanUndefined(this.actionData);
        if (Array.isArray(cleanedData)) {
           const results = [];
           for (const item of cleanedData) {
              const docId = item.id ? String(item.id) : String(Date.now() + Math.floor(Math.random() * 1000));
              const docRef = doc(firestoreDb, this.tableName, docId);
              
              const online = await OfflineQueueService.isOnline();
              if (!online) {
                await OfflineQueueService.enqueue('insert', this.tableName, docId, { ...item, id: docId });
              }
              
              await setDoc(docRef, { ...item, id: docId });
              results.push({ id: docId, ...item });
           }
           return { data: results, error: null };
        } else {
           const docId = cleanedData.id ? String(cleanedData.id) : String(Date.now() + Math.floor(Math.random() * 1000));
           const docRef = doc(firestoreDb, this.tableName, docId);
           
           const online = await OfflineQueueService.isOnline();
           if (!online) {
             await OfflineQueueService.enqueue('insert', this.tableName, docId, { ...cleanedData, id: docId });
           }
           
           await setDoc(docRef, { ...cleanedData, id: docId });
           return { data: { id: docId, ...cleanedData }, error: null };
        }
      } 
      else if (this.actionType === 'update') {
        const cleanedData = cleanUndefined(this.actionData);
        const idFilter = this.filters.find(f => f.field === 'id');
        if (idFilter) {
            const docRef = doc(firestoreDb, this.tableName, String(idFilter.value));
            
            const online = await OfflineQueueService.isOnline();
            if (!online) {
              await OfflineQueueService.enqueue('update', this.tableName, String(idFilter.value), cleanedData);
            }
            
            await updateDoc(docRef, cleanedData);
            return { data: null, error: null };
        } else {
            const colRef = collection(firestoreDb, this.tableName);
            let q: any = colRef;
            for (const f of this.filters) { q = query(q, where(f.field, f.op, f.value)); }
            const snapshot = await getDocs(q);
            for (const d of snapshot.docs) {
               const online = await OfflineQueueService.isOnline();
               if (!online) {
                 await OfflineQueueService.enqueue('update', this.tableName, d.id, cleanedData);
               }
               await updateDoc(d.ref, cleanedData);
            }
            return { data: null, error: null };
        }
      }
      else if (this.actionType === 'delete') {
        const idFilter = this.filters.find(f => f.field === 'id');
        if (idFilter) {
           const docRef = doc(firestoreDb, this.tableName, String(idFilter.value));
           
           const online = await OfflineQueueService.isOnline();
           if (!online) {
             await OfflineQueueService.enqueue('delete', this.tableName, String(idFilter.value), null);
           }
           
           await deleteDoc(docRef);
           return { data: null, error: null };
        } else {
           const colRef = collection(firestoreDb, this.tableName);
           let q: any = colRef;
           for (const f of this.filters) { q = query(q, where(f.field, f.op, f.value)); }
           const snapshot = await getDocs(q);
           for (const d of snapshot.docs) {
              const online = await OfflineQueueService.isOnline();
              if (!online) {
                await OfflineQueueService.enqueue('delete', this.tableName, d.id, null);
              }
              await deleteDoc(d.ref);
           }
           return { data: null, error: null };
        }
      }
    } catch (err: any) {
      console.error(`[FirestoreDB] Error executing ${this.actionType} on ${this.tableName}:`, err);
      return { data: null, error: err };
    }
    return { data: null, error: new Error('Unknown action type') };
  }
}

// ============================================================
// DATABASE CLIENT
// ============================================================

export const db = {
  from: (tableName: string) => {
    return new FirestoreQueryBuilder(tableName);
  },
  channel: (name: string) => ({
    on: (...args: any[]) => ({ subscribe: (cb?: (...args: any[]) => void) => { if (cb) setTimeout(() => cb('SUBSCRIBED'), 100); return { on: (...a: any[]) => ({ subscribe: (c?: (...args: any[]) => void) => { if (c) setTimeout(() => c('SUBSCRIBED'), 100); } }) }; } }),
    subscribe: (cb?: (...args: any[]) => void) => { if (cb) setTimeout(() => cb('SUBSCRIBED'), 100); },
    send: () => Promise.resolve('ok'),
  }),
  removeChannel: (_channel: any) => { /* no-op */ }
};

export const dbAdmin = db;

// ============================================================
// HELPER METHODS
// ============================================================

export async function dbUpsert(
  table: string,
  data: Record<string, unknown> | Record<string, unknown>[],
  onConflict = 'id'
) {
  try {
    const cleaned = cleanUndefined(data);
    if (Array.isArray(cleaned)) {
      for (const item of cleaned) {
        const docId = item[onConflict] ? String(item[onConflict]) : String(Date.now());
        const docRef = doc(firestoreDb, table, docId);
        
        const online = await OfflineQueueService.isOnline();
        if (!online) {
          await OfflineQueueService.enqueue('insert', table, docId, { ...item, id: docId });
        }
        
        await setDoc(docRef, { ...item, id: docId }, { merge: true });
      }
    } else {
      const docId = cleaned[onConflict] ? String(cleaned[onConflict]) : String(Date.now());
      const docRef = doc(firestoreDb, table, docId);
      
      const online = await OfflineQueueService.isOnline();
      if (!online) {
        await OfflineQueueService.enqueue('insert', table, docId, { ...cleaned, id: docId });
      }
      
      await setDoc(docRef, { ...cleaned, id: docId }, { merge: true });
    }
  } catch (err) {
    console.error(`[FirestoreDB] dbUpsert error in table ${table}:`, err);
  }
}

export async function dbDelete(table: string, id: number | string) {
  try {
    const docRef = doc(firestoreDb, table, String(id));
    
    const online = await OfflineQueueService.isOnline();
    if (!online) {
      await OfflineQueueService.enqueue('delete', table, String(id), null);
    }
    
    await deleteDoc(docRef);
  } catch (err) {
    console.error(`[FirestoreDB] dbDelete error in table ${table}#${id}:`, err);
  }
}

export async function dbSelect<T = unknown>(
  table: string,
  filter?: Record<string, unknown>
): Promise<T[]> {
  try {
    const colRef = collection(firestoreDb, table);
    let q: any = colRef;
    if (filter) {
      for (const [key, value] of Object.entries(filter)) {
        q = query(q, where(key, '==', value));
      }
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as T[];
  } catch (err) {
    console.error(`[FirestoreDB] dbSelect error in table ${table}:`, err);
    return [];
  }
}

export async function testDbConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    // Just a simple read to check connection
    await getDocs(query(collection(firestoreDb, 'store_settings'), fLimit(1)));
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// ============================================================
// CUSTOMER & BACKEND API MAPPERS
// ============================================================

export async function fetchCategories(): Promise<any[]> {
  const rows = await dbSelect<any>('categories');
  return rows.map(mapCategory);
}

export async function fetchProducts(): Promise<any[]> {
  const rows = await dbSelect<any>('products');
  return rows.map(mapProduct);
}

export async function fetchStoreSettings(): Promise<any | null> {
  const rows = await dbSelect<any>('store_settings');
  return rows.length > 0 ? mapStoreSettings(rows[0]) : null;
}

export async function createTransaction(transactionData: any): Promise<string | null> {
  try {
    const docId = String(Date.now() + Math.floor(Math.random() * 1000));
    const docRef = doc(firestoreDb, 'transactions', docId);
    
    const online = await OfflineQueueService.isOnline();
    if (!online) {
      await OfflineQueueService.enqueue('insert', 'transactions', docId, { ...transactionData, id: docId });
    }
    
    await setDoc(docRef, { ...transactionData, id: docId });
    return docId;
  } catch (err) {
    console.error('[FirestoreDB] createTransaction:', err);
    return null;
  }
}

export async function createTransactionItems(items: any[]): Promise<boolean> {
  try {
    for (const item of items) {
      const docId = String(Date.now() + Math.floor(Math.random() * 10000));
      const docRef = doc(firestoreDb, 'transaction_items', docId);
      
      const online = await OfflineQueueService.isOnline();
      if (!online) {
        await OfflineQueueService.enqueue('insert', 'transaction_items', docId, { ...item, id: docId });
      }
      
      await setDoc(docRef, { ...item, id: docId });
    }
    return true;
  } catch (err) {
    console.error('[FirestoreDB] createTransactionItems:', err);
    return false;
  }
}

export async function updateProductStock(productId: number | string, newStock: number): Promise<boolean> {
  try {
    const docRef = doc(firestoreDb, 'products', String(productId));
    
    // Hitung delta jika online
    let delta = 0;
    const online = await OfflineQueueService.isOnline();
    
    if (online) {
      try {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const oldStock = Number(snap.data().stock || 0);
          delta = newStock - oldStock;
        }
      } catch (_) {}
      
      if (delta !== 0) {
        await updateDoc(docRef, { stock: increment(delta) });
      } else {
        await updateDoc(docRef, { stock: newStock });
      }
    } else {
      // Offline fallback: enqueue stock change
      await OfflineQueueService.enqueue('update', 'products', String(productId), { stock: newStock });
    }
    return true;
  } catch (err) {
    console.error('[FirestoreDB] updateProductStock:', err);
    return false;
  }
}

export async function fetchTransactionByOrderNumber(orderNumber: string): Promise<any | null> {
  const rows = await dbSelect<any>('transactions', { order_number: orderNumber });
  return rows.length > 0 ? rows[0] : null;
}

export async function fetchTransactionByReceiptNumber(receiptNumber: string): Promise<any | null> {
  const rows = await dbSelect<any>('transactions', { receipt_number: receiptNumber });
  return rows.length > 0 ? rows[0] : null;
}

export async function fetchTransactionsByCustomerName(customerName: string): Promise<any[]> {
  return dbSelect<any>('transactions', { customer_name: customerName });
}

export async function fetchTransactionItems(transactionId: string | number): Promise<any[]> {
  return dbSelect<any>('transaction_items', { transaction_id: String(transactionId) });
}

export async function appendPaymentToTransactionByReceipt(receiptNumber: string, payment: any): Promise<boolean> {
  try {
    const existing = await fetchTransactionByReceiptNumber(receiptNumber);
    if (!existing) {
      console.warn('[db] appendPayment: transaction not found', receiptNumber);
      return false;
    }

    let payments: any[] = [];
    try { payments = existing.payments ? (typeof existing.payments === 'string' ? JSON.parse(existing.payments) : existing.payments) : []; } catch (_) { payments = []; }
    payments.push(payment);

    const totalPaid = payments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
    const totalDue = Number(existing.total) || 0;
    const newStatus = totalPaid >= totalDue ? 'lunas' : (totalPaid > 0 ? 'partial' : existing.status || 'belum lunas');

    const updates: any = {
      payments: JSON.stringify(payments),
      payment_amount: totalPaid,
      status: newStatus,
      closed_at: newStatus === 'lunas' ? new Date().toISOString() : existing.closed_at || null
    };

    // Jika pesanan sudah lunas namun masih pending di dapur, segera kirim ke dapur
    if (newStatus === 'lunas' && existing.kitchen_status === 'pending') {
      updates.kitchen_status = 'diproses';
    }

    const docRef = doc(firestoreDb, 'transactions', String(existing.id));
    
    const online = await OfflineQueueService.isOnline();
    if (!online) {
      await OfflineQueueService.enqueue('update', 'transactions', String(existing.id), updates);
    }
    
    await updateDoc(docRef, updates);

    return true;
  } catch (err) {
    console.error('[db] appendPaymentToTransactionByReceipt error', err);
    return false;
  }
}

// ============================================================
// REALTIME POLLING ENGINES -> ON_SNAPSHOT (Firestore Native)
// ============================================================

export function subscribeToTransactionUpdates(
  transactionId: string | number,
  onUpdate: (transaction: any) => void
): () => void {
  const docRef = doc(firestoreDb, 'transactions', String(transactionId));
  const unsubscribe = onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      onUpdate({ id: docSnap.id, ...docSnap.data() });
    }
  });
  return unsubscribe;
}

export function subscribeToProductUpdates(onUpdate: (products: any[]) => void): () => void {
  const colRef = collection(firestoreDb, 'products');
  const unsubscribe = onSnapshot(colRef, (snapshot) => {
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    onUpdate(products.map(mapProduct));
  });
  return unsubscribe;
}
