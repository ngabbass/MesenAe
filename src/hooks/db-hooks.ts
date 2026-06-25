import { useEffect, useState } from 'react';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, getDocs, query, orderBy, limit as dbLimit, startAfter as dbStartAfter, DocumentData, QueryDocumentSnapshot, increment, writeBatch } from 'firebase/firestore';
import { db as firestoreDb } from '@/lib/firebase';
import { uploadToCloudinary, deleteFromCloudinary } from '@/lib/cloudinary';
import { OfflineQueueService } from '@/lib/offlineQueue';

// ══════════════════════════════════════════════════════════
//  Types
// ══════════════════════════════════════════════════════════
export interface ProductVariantOption { name: string; price: number; }
export interface ProductVariantGroup { name: string; type: 'single' | 'multiple'; required: boolean; options: ProductVariantOption[]; }
export interface Category { id?: string | number; name: string; color: string; icon: string; needsKitchen?: boolean; }
export interface Product { id?: string | number; name: string; sku: string; categoryId: string | number; price: number; hpp: number; stock: number; trackStock?: boolean; unit: string; variants?: ProductVariantGroup[]; photo?: string; barcode?: string; }
export interface ExpenseCategory { id?: string | number; name: string; color: string; icon: string; order?: number; isDefault?: number; createdAt?: string; isDeleted?: number; }
export interface Expense { id?: string | number; title: string; categoryId: string | number; amount: number; paymentMethodId: string | number; date: string; notes?: string; createdAt?: string; isDeleted?: boolean; }
export interface Customer { id?: string | number; name: string; phone?: string; totalTransactions?: number; totalSpent?: number; lastVisit?: string; createdAt?: string; }
export interface Supplier { id?: string | number; name: string; phone: string; address: string; notes: string; }
export interface StockIn { id?: string | number; productId: string | number; supplierId: string | number; quantity: number; buyPrice: number; totalPrice: number; date: Date | string; notes: string; }
export interface StockOut { id?: string | number; productId: string | number; quantity: number; reason: string; date: Date | string; notes: string; }
export interface HppHistory { id?: string | number; productId: string | number; oldHpp: number; newHpp: number; source: string; date: Date | string; }
export interface PaymentMethod { id?: string | number; name: string; category: string; isDefault: boolean; provider?: string; qrisString?: string; accountName?: string; accountNumber?: string; bankName?: string; iconName?: string; sortOrder?: number; }
export interface Transaction { id?: string | number; subtotal: number; discountType: string | null; discountValue: number; discountAmount: number; taxAndService?: number; taxAmount?: number; adminFee?: number; total: number; paymentMethodId: string | number; paymentAmount: number; payments?: any[]; change: number; profit: number; date: Date | string; receiptNumber: string; status: 'lunas' | 'belum lunas' | 'batal' | 'partial' | string; kitchenStatus?: string; orderNumber?: string; customerName?: string; tableNumber?: string; remarks?: string; needsKitchen?: boolean; openedAt?: Date | string; closedAt?: Date | string; }
export interface TransactionItemRecord { id?: string | number; transactionId: string | number; productId: string | number; productName: string; quantity: number; price: number; hpp: number; discountType: string | null; discountValue: number; discountAmount: number; subtotal: number; selectedVariants?: any[]; notes?: string; }
export interface StoreSettings { id?: string | number; storeName: string; address: string; phone: string; receiptFooter: string; onboardingDone: boolean; themeColor?: string; selfOrderTheme?: string; logo?: string; tables?: string[]; promoBanners?: any[]; deliveryMode?: 'ambil' | 'diantar'; enableWhatsappNotification?: boolean; enableKitchen?: boolean; enableTax?: boolean; taxPercentage?: number; enableAdminFee?: boolean; adminFeeValue?: number; enableSplitBill?: boolean; }
export interface User { id?: string | number; username: string; password_hash: string; role: string; name?: string; whatsapp?: string; }
export interface Voucher { id?: string | number; code: string; type: string; value: number; isActive: boolean; showInCustomerApp?: boolean; applicableProductIds?: (string | number)[]; validUntil: Date | string | null; }
export interface Banner { id?: string | number; type?: string; heading?: string; title: string; description?: string; voucherId?: number | null; productId?: number | null; imageUrl?: string | null; buttonText?: string; link?: string; isActive: boolean; bgType?: 'image' | 'solid' | 'gradient'; bgColor?: string; bgGradient?: string; canvasLayers?: any[]; canvasBgFilter?: any; canvasOverlayFilter?: any; bgGradientOverlay?: { enabled: boolean; color: string; opacityLeft: number; opacityRight: number; angle: number; }; createdAt?: string; headingPos?: { x: number, y: number }; titlePos?: { x: number, y: number }; descPos?: { x: number, y: number }; buttonPos?: { x: number, y: number }; overlayPos?: { x: number, y: number }; overlayFlipX?: boolean; overlayRotate?: number; overlayScale?: number; overlayImageUrl?: string | null; overlays?: any[]; badgeStyle?: string; headingStyle?: string; }


// ── Table name mapping (camelCase → snake_case) ──────────────
const TABLE_MAP: Record<string, string> = {
  categories: 'categories',
  products: 'products',
  suppliers: 'suppliers',
  stockIns: 'stock_ins',
  stockOuts: 'stock_outs',
  hppHistory: 'hpp_history',
  paymentMethods: 'payment_methods',
  transactions: 'transactions',
  transactionItems: 'transaction_items',
  storeSettings: 'store_settings',
  users: 'users',
  vouchers: 'vouchers',
  banners: 'banners',
  expenseCategories: 'expense_categories',
  expenses: 'expenses',
  customers: 'customers',
};

// ── Converters ────────────────────────────────────────────────
const mapSnakeToCamel = (obj: any): any => {
  if (obj === undefined || obj === null) return obj;
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(mapSnakeToCamel);
  const out: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
    out[camelKey] = mapSnakeToCamel(value);
  }
  return out;
};

const mapCamelToSnake = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(mapCamelToSnake);
  const out: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    const snakeKey = key.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
    out[snakeKey] = mapCamelToSnake(value);
  }
  return out;
};

// ══════════════════════════════════════════════════════════
//  IndexedDB Local Cache System for 100% Offline Autonomy
// ══════════════════════════════════════════════════════════

const CACHE_DB_NAME = 'MesenAeLocalCacheDB';
const CACHE_DB_VERSION = 2;

function openCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tables = Object.values(TABLE_MAP);
      tables.forEach(tableName => {
        if (!db.objectStoreNames.contains(tableName)) {
          db.createObjectStore(tableName, { keyPath: 'id' });
        }
      });
    };
  });
}

export async function getLocalCache(tableName: string): Promise<any[]> {
  try {
    const db = await openCacheDB();
    const transaction = db.transaction(tableName, 'readonly');
    const store = transaction.objectStore(tableName);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error(`[LocalCache] Failed to read cache for ${tableName}:`, e);
    return [];
  }
}

async function writeLocalCache(tableName: string, data: any[]): Promise<void> {
  try {
    const queue = await OfflineQueueService.getQueue();
    const pendingInsertOrUpdateIds = new Set(
      queue
        .filter(item => item.tableName === tableName && (item.type === 'insert' || item.type === 'update'))
        .map(item => String(item.recordId))
    );
    const pendingDeleteIds = new Set(
      queue
        .filter(item => item.tableName === tableName && item.type === 'delete')
        .map(item => String(item.recordId))
    );

    const db = await openCacheDB();
    const transaction = db.transaction(tableName, 'readwrite');
    const store = transaction.objectStore(tableName);

    // Get current cache entries
    const allCached: any[] = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    const newDataIds = new Set(data.map(item => String(item.id)));

    // 1. Delete items from cache if they are NOT in the new Firestore data AND NOT pending in the offline queue (as insert/update)
    for (const cachedItem of allCached) {
      if (cachedItem && cachedItem.id) {
        const cachedIdStr = String(cachedItem.id);
        if (!newDataIds.has(cachedIdStr) && !pendingInsertOrUpdateIds.has(cachedIdStr)) {
          store.delete(cachedItem.id);
        }
      }
    }

    // 2. Put all new items from Firestore
    // EXCEPT if they are pending delete in the offline queue,
    // or if they have a pending update/insert (preserving local unsynced edits)
    for (const item of data) {
      if (item && item.id) {
        const itemIdStr = String(item.id);
        if (pendingDeleteIds.has(itemIdStr)) {
          continue;
        }
        if (pendingInsertOrUpdateIds.has(itemIdStr)) {
          continue;
        }
        store.put(item);
      }
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (e) {
    console.error(`[LocalCache] Failed to write cache for ${tableName}:`, e);
  }
}

async function writeLocalCacheItem(tableName: string, item: any): Promise<void> {
  try {
    const db = await openCacheDB();
    const transaction = db.transaction(tableName, 'readwrite');
    const store = transaction.objectStore(tableName);
    if (item && item.id) {
      await new Promise<void>((resolve, reject) => {
        const request = store.put(item);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    }
  } catch (e) {
    console.error(`[LocalCache] Failed to write item to cache for ${tableName}:`, e);
  }
}

async function getLocalCacheItem(tableName: string, id: string): Promise<any | null> {
  try {
    const db = await openCacheDB();
    const transaction = db.transaction(tableName, 'readonly');
    const store = transaction.objectStore(tableName);
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error(`[LocalCache] Failed to read item ${id} from cache for ${tableName}:`, e);
    return null;
  }
}

async function deleteLocalCacheItem(tableName: string, id: string): Promise<void> {
  try {
    const db = await openCacheDB();
    const transaction = db.transaction(tableName, 'readwrite');
    const store = transaction.objectStore(tableName);
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (e) {
    console.error(`[LocalCache] Failed to delete item from cache for ${tableName}:`, e);
  }
}

// ══════════════════════════════════════════════════════════
//  useDbQuery — Offline-First with IndexedDB & Real-time Sync
//  Strategi hemat cost:
//  - REALTIME collections (transactions, storeSettings): onSnapshot selalu aktif
//  - STATIC collections (products, categories, dll): snapshot sekali, cache 5 menit
// ══════════════════════════════════════════════════════════

/** Collections yang HARUS realtime (pesanan aktif, dapur, dll) */
const REALTIME_COLLECTIONS = new Set([
  'transactions',
  'store_settings',
  'payment_methods',
]);

/** Waktu cache untuk non-realtime collections (ms) */
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit

/** In-memory TTL store untuk tahu kapan terakhir fetch Firestore */
const lastFirestoreFetch: Record<string, number> = {};

export function useDbQuery<T = any>(tableCamelCase: string): T[] {
  const tableName = TABLE_MAP[tableCamelCase] || tableCamelCase;
  const [data, setData] = useState<T[]>([]);
  const isRealtime = REALTIME_COLLECTIONS.has(tableName);

  useEffect(() => {
    let mounted = true;

    // 1. Tampilkan data dari cache lokal IndexedDB terlebih dahulu (instan/luring)
    getLocalCache(tableName).then(cachedData => {
      if (mounted && cachedData && cachedData.length > 0) {
        setData(mapSnakeToCamel(cachedData) as T[]);
      }
    });

    let unsubscribe = () => {};

    if (isRealtime) {
      // 2a. Koleksi REALTIME: Berlangganan ke Firestore snapshot
      const colRef = collection(firestoreDb, tableName);
      unsubscribe = onSnapshot(
        colRef,
        async (snapshot) => {
          const docsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          lastFirestoreFetch[tableName] = Date.now();
          await writeLocalCache(tableName, docsData).catch(console.error);
          const updatedCachedData = await getLocalCache(tableName);
          if (mounted) {
            setData(mapSnakeToCamel(updatedCachedData) as T[]);
          }
        },
        (error) => {
          if (import.meta.env.DEV) {
            console.warn(`[useDbQuery] Firestore snapshot error for ${tableName}:`, error);
          }
        }
      );
    } else {
      // 2b. Koleksi STATIS: Hanya fetch dari Firestore jika cache TTL kedaluwarsa atau belum pernah fetch
      const now = Date.now();
      const lastFetch = lastFirestoreFetch[tableName] || 0;
      
      if (now - lastFetch > CACHE_TTL_MS) {
        const colRef = collection(firestoreDb, tableName);
        getDocs(colRef).then(snapshot => {
          const docsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          lastFirestoreFetch[tableName] = Date.now();
          writeLocalCache(tableName, docsData).then(async () => {
            const updatedCachedData = await getLocalCache(tableName);
            if (mounted) {
              setData(mapSnakeToCamel(updatedCachedData) as T[]);
            }
          }).catch(console.error);
        }).catch(error => {
          if (import.meta.env.DEV) {
            console.warn(`[useDbQuery] Firestore getDocs error for ${tableName}:`, error);
          }
        });
      }
    }

    // 3. Listener custom untuk pembaruan lokal saat luring (offline write)
    const handleLocalUpdate = async () => {
      const cachedData = await getLocalCache(tableName);
      if (mounted) {
        setData(mapSnakeToCamel(cachedData) as T[]);
      }
    };

    window.addEventListener(`local-update-${tableName}`, handleLocalUpdate);

    return () => {
      mounted = false;
      unsubscribe();
      window.removeEventListener(`local-update-${tableName}`, handleLocalUpdate);
    };
  }, [tableName, isRealtime]);

  return data;
}

// ══════════════════════════════════════════════════════════
//  CRUD helpers — Offline-First with Immediate Local Execution
// ══════════════════════════════════════════════════════════

/** Insert satu record, kembalikan ID record baru secara instan */
export async function dbInsert(tableCamelCase: string, data: any): Promise<string> {
  const tableName = TABLE_MAP[tableCamelCase] || tableCamelCase;
  const snakeData = mapCamelToSnake(data);
  const docId = data?.id ? String(data.id) : String(Date.now() + Math.floor(Math.random() * 1000));
  const record = { ...snakeData, id: docId };

  // Tulis ke cache IndexedDB lokal secara instan
  await writeLocalCacheItem(tableName, record);
  // Picu event update lokal agar UI langsung memperbarui datanya (misal: Layar Dapur / Riwayat)
  window.dispatchEvent(new CustomEvent(`local-update-${tableName}`));

  const online = await OfflineQueueService.isOnline();
  if (!online) {
    // Simpan ke antrean sinkronisasi luring
    await OfflineQueueService.enqueue('insert', tableName, docId, record);
  } else {
    const docRef = doc(firestoreDb, tableName, docId);
    await setDoc(docRef, record).catch(async (err) => {
      console.warn("[dbInsert] Gagal menulis ke cloud Firestore, dialihkan ke antrean offline:", err);
      await OfflineQueueService.enqueue('insert', tableName, docId, record);
    });
  }

  return docId;
}

/** Update record berdasarkan ID */
export async function dbUpdate(tableCamelCase: string, id: number | string, data: any): Promise<void> {
  const tableName = TABLE_MAP[tableCamelCase] || tableCamelCase;
  const snakeData = mapCamelToSnake(data);

  // Ambil data lama dari cache lokal untuk digabungkan agar properti lain tidak terhapus
  const existing = await getLocalCacheItem(tableName, String(id));
  const record = { ...(existing || {}), ...snakeData, id: String(id) };

  // Perbarui cache IndexedDB lokal secara instan
  await writeLocalCacheItem(tableName, record);
  window.dispatchEvent(new CustomEvent(`local-update-${tableName}`));

  const online = await OfflineQueueService.isOnline();
  if (!online) {
    let queueData = { ...snakeData };
    if (tableName === 'products' && 'stock' in snakeData) {
      const oldStock = existing?.stock !== undefined ? Number(existing.stock) : 0;
      const newStock = Number(snakeData.stock);
      queueData.stock_delta = newStock - oldStock;
      delete queueData.stock;
    }
    await OfflineQueueService.enqueue('update', tableName, String(id), queueData);
  } else {
    const docRef = doc(firestoreDb, tableName, String(id));
    let updateData = { ...snakeData };
    if (tableName === 'products' && 'stock' in snakeData) {
      const oldStock = existing?.stock !== undefined ? Number(existing.stock) : 0;
      const newStock = Number(snakeData.stock);
      const delta = newStock - oldStock;
      updateData.stock = increment(delta);
    }
    await updateDoc(docRef, updateData).catch(async (err) => {
      console.warn("[dbUpdate] Gagal update ke cloud Firestore, dialihkan ke antrean offline:", err);
      let queueData = { ...snakeData };
      if (tableName === 'products' && 'stock' in snakeData) {
        const oldStock = existing?.stock !== undefined ? Number(existing.stock) : 0;
        const newStock = Number(snakeData.stock);
        queueData.stock_delta = newStock - oldStock;
        delete queueData.stock;
      }
      await OfflineQueueService.enqueue('update', tableName, String(id), queueData);
    });
  }
}

/** Hard delete record berdasarkan ID */
export async function dbDelete(tableCamelCase: string, id: number | string): Promise<void> {
  const tableName = TABLE_MAP[tableCamelCase] || tableCamelCase;

  // Hapus dari cache IndexedDB lokal secara instan
  await deleteLocalCacheItem(tableName, String(id));
  window.dispatchEvent(new CustomEvent(`local-update-${tableName}`));

  const online = await OfflineQueueService.isOnline();
  if (!online) {
    await OfflineQueueService.enqueue('delete', tableName, String(id), null);
  } else {
    const docRef = doc(firestoreDb, tableName, String(id));
    await deleteDoc(docRef).catch(async (err) => {
      console.warn("[dbDelete] Gagal menghapus di cloud Firestore, dialihkan ke antrean offline:", err);
      await OfflineQueueService.enqueue('delete', tableName, String(id), null);
    });
  }
}

/** Upload file ke Cloudinary, kembalikan URL secure */
export async function dbUploadFile(
  bucket: string,
  fileName: string,
  file: File | Blob | string
): Promise<string | null> {
  return uploadToCloudinary(bucket, fileName, file);
}

/** Hapus file dari Cloudinary secara permanen menggunakan public_id-nya (via API Secret) */
export async function dbDeleteFile(url: string | null | undefined): Promise<boolean> {
  return deleteFromCloudinary(url);
}

// ══════════════════════════════════════════════════════════
//  Pagination — Transaction History with Offline Fallback
// ══════════════════════════════════════════════════════════
// Pagination relies on the types and helpers imported from 'firebase/firestore' at the top of the file.

export function usePaginatedTransactions(limitCount: number = 20) {
  const [data, setData] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  const loadMore = async (reset: boolean = false) => {
    if (loading || (!hasMore && !reset)) return;
    setLoading(true);
    try {
      const online = await OfflineQueueService.isOnline();
      if (!online) {
        // Mode Offline: ambil semua transaksi dari cache lokal IndexedDB, urutkan tanggal desc
        const cachedTransactions = await getLocalCache('transactions');
        const sorted = cachedTransactions.sort((a: any, b: any) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        const camelData = mapSnakeToCamel(sorted) as Transaction[];
        setData(camelData);
        setHasMore(false);
        setLoading(false);
        return;
      }

      const colRef = collection(firestoreDb, 'transactions');
      let q = query(colRef, orderBy('date', 'desc'), dbLimit(limitCount));
      
      if (!reset && lastDoc) {
        q = query(colRef, orderBy('date', 'desc'), dbStartAfter(lastDoc), dbLimit(limitCount));
      }
      
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        setHasMore(false);
      } else {
        const docsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const camelData = mapSnakeToCamel(docsData) as Transaction[];
        setData(prev => reset ? camelData : [...prev, ...camelData]);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        if (snapshot.docs.length < limitCount) setHasMore(false);
      }
    } catch (err) {
      console.error('Error fetching paginated transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMore(true);
  }, []); // Initial load

  const refresh = () => {
    setHasMore(true);
    loadMore(true);
  };

  return { data, loading, hasMore, loadMore, refresh };
}

/** Update beberapa record sekaligus (batch) untuk sort order */
export async function dbBatchUpdateSortOrder(tableCamelCase: string, updates: { id: string | number; sortOrder: number }[]): Promise<void> {
  const tableName = TABLE_MAP[tableCamelCase] || tableCamelCase;
  
  // 1. Perbarui cache IndexedDB lokal secara instan untuk semua item
  for (const u of updates) {
    const existing = await getLocalCacheItem(tableName, String(u.id));
    const record = { ...(existing || {}), sort_order: u.sortOrder, id: String(u.id) };
    await writeLocalCacheItem(tableName, record);
  }
  window.dispatchEvent(new CustomEvent(`local-update-${tableName}`));

  // 2. Kirim batch ke Firestore
  const online = await OfflineQueueService.isOnline();
  if (!online) {
    // Jika offline, masukkan masing-masing ke antrean offline
    for (const u of updates) {
      await OfflineQueueService.enqueue('update', tableName, String(u.id), { sort_order: u.sortOrder });
    }
  } else {
    // Jika online, gunakan writeBatch
    const batch = writeBatch(firestoreDb);
    for (const u of updates) {
      const docRef = doc(firestoreDb, tableName, String(u.id));
      batch.update(docRef, { sort_order: u.sortOrder });
    }
    
    await batch.commit().catch(async (err) => {
      console.warn("[dbBatchUpdateSortOrder] Gagal update ke cloud Firestore, dialihkan ke antrean offline:", err);
      for (const u of updates) {
        await OfflineQueueService.enqueue('update', tableName, String(u.id), { sort_order: u.sortOrder });
      }
    });
  }
}

/** Hard delete beberapa record sekaligus (batch) berdasarkan ID */
export async function dbBatchDelete(
  deletes: { tableCamelCase: string; id: number | string }[]
): Promise<void> {
  // 1. Hapus dari cache IndexedDB lokal secara instan untuk semua item
  for (const d of deletes) {
    const tableName = TABLE_MAP[d.tableCamelCase] || d.tableCamelCase;
    await deleteLocalCacheItem(tableName, String(d.id));
    window.dispatchEvent(new CustomEvent(`local-update-${tableName}`));
  }

  // 2. Kirim batch ke Firestore
  const online = await OfflineQueueService.isOnline();
  if (!online) {
    // Jika offline, masukkan masing-masing ke antrean offline
    for (const d of deletes) {
      const tableName = TABLE_MAP[d.tableCamelCase] || d.tableCamelCase;
      await OfflineQueueService.enqueue('delete', tableName, String(d.id), null);
    }
  } else {
    // Jika online, gunakan writeBatch
    const batch = writeBatch(firestoreDb);
    for (const d of deletes) {
      const tableName = TABLE_MAP[d.tableCamelCase] || d.tableCamelCase;
      const docRef = doc(firestoreDb, tableName, String(d.id));
      batch.delete(docRef);
    }

    await batch.commit().catch(async (err) => {
      console.warn("[dbBatchDelete] Gagal menghapus di cloud Firestore, dialihkan ke antrean offline:", err);
      for (const d of deletes) {
        const tableName = TABLE_MAP[d.tableCamelCase] || d.tableCamelCase;
        await OfflineQueueService.enqueue('delete', tableName, String(d.id), null);
      }
    });
  }
}
