import { Network } from '@capacitor/network';
import { db as firestoreDb } from './firebase';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, limit, query, getDocs, writeBatch, increment } from 'firebase/firestore';
import { toast } from 'sonner';

export interface QueueItem {
  id: string; // Unique ID for queue entry
  type: 'insert' | 'update' | 'delete';
  tableName: string;
  recordId: string; // The ID of the document being modified
  data: any;
  timestamp: number;
}

const DB_NAME = 'MesenAeOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'transaction_queue';

// Open IndexedDB database connection
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export const OfflineQueueService = {
  // Check if device is connected to internet
  async isOnline(): Promise<boolean> {
    try {
      const status = await Network.getStatus();
      return status.connected;
    } catch {
      return navigator.onLine;
    }
  },

  // Enqueue a mutation
  async enqueue(
    type: 'insert' | 'update' | 'delete',
    tableName: string,
    recordId: string,
    data: any
  ): Promise<void> {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const queueId = `${tableName}_${recordId}_${type}_${Date.now()}`;
      const item: QueueItem = {
        id: queueId,
        type,
        tableName,
        recordId,
        data,
        timestamp: Date.now(),
      };

      await new Promise<void>((resolve, reject) => {
        const request = store.put(item);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      console.log(`[OfflineQueue] Enqueued ${type} for ${tableName}#${recordId}`);
      
      // Dispatch custom event to notify components of queue change
      window.dispatchEvent(new CustomEvent('offline-queue-changed'));
    } catch (err) {
      console.error('[OfflineQueue] Failed to enqueue mutation:', err);
    }
  },

  // Get all pending items in the queue
  async getQueue(): Promise<QueueItem[]> {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      return await new Promise<QueueItem[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const items = request.result as QueueItem[];
          // Sort by timestamp to preserve chronological order
          items.sort((a, b) => a.timestamp - b.timestamp);
          resolve(items);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('[OfflineQueue] Failed to get queue:', err);
      return [];
    }
  },

  // Remove an item from the queue
  async dequeue(id: string): Promise<void> {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      console.log(`[OfflineQueue] Dequeued mutation ${id}`);
      window.dispatchEvent(new CustomEvent('offline-queue-changed'));
    } catch (err) {
      console.error('[OfflineQueue] Failed to dequeue mutation:', err);
    }
  },

  // Clear all queue items
  async clearQueue(): Promise<void> {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      window.dispatchEvent(new CustomEvent('offline-queue-changed'));
    } catch (err) {
      console.error('[OfflineQueue] Failed to clear queue:', err);
    }
  },

  // Main sync engine with conflict resolution
  async syncQueue(): Promise<{ success: boolean; syncedCount: number; failedCount: number }> {
    const online = await this.isOnline();
    if (!online) {
      return { success: false, syncedCount: 0, failedCount: 0 };
    }

    // Pastikan user sudah terautentikasi sebelum sinkronisasi untuk menghindari penolakan Security Rules
    const hasAdminAuth = localStorage.getItem('admin_auth');
    if (!hasAdminAuth) {
      console.warn('[OfflineQueue] User is not authenticated, skipping sync to avoid Security Rules rejection.');
      return { success: false, syncedCount: 0, failedCount: 0 };
    }

    const queue = await this.getQueue();
    if (queue.length === 0) {
      return { success: true, syncedCount: 0, failedCount: 0 };
    }

    console.log(`[OfflineQueue] Starting sync for ${queue.length} mutations...`);
    let syncedCount = 0;
    let failedCount = 0;

    // Kita akan proses antrean dalam chunk batch (maksimal 100 item per batch agar aman)
    const BATCH_SIZE = 100;
    
    for (let i = 0; i < queue.length; i += BATCH_SIZE) {
      const chunk = queue.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(firestoreDb);
      const batchItems: QueueItem[] = [];
      const skippedItemIds: string[] = [];

      for (const item of chunk) {
        try {
          const docRef = doc(firestoreDb, item.tableName, item.recordId);
          let shouldWrite = true;

          // Conflict Resolution: Check server timestamp
          if (item.type === 'update' || item.type === 'insert') {
            try {
              const serverSnap = await getDoc(docRef);
              if (serverSnap.exists()) {
                const serverData = serverSnap.data();
                const serverUpdatedAtStr = serverData.updated_at || serverData.updatedAt;
                const serverUpdatedAt = serverUpdatedAtStr ? new Date(serverUpdatedAtStr).getTime() : 0;
                
                if (serverUpdatedAt > item.timestamp) {
                  console.warn(`[OfflineQueue] Conflict detected for ${item.tableName}#${item.recordId}. Server version is newer.`);
                  
                  if (item.tableName === 'products' && ('stock' in item.data || 'stock_delta' in item.data)) {
                    console.log('[OfflineQueue] Stock delta merge handling via increment in batch.');
                  } else {
                    console.log('[OfflineQueue] Keeping server version for transaction to prevent data loss.');
                    await this.dequeue(item.id);
                    skippedItemIds.push(item.id);
                    shouldWrite = false;
                  }
                }
              }
            } catch (e) {
              console.warn('[OfflineQueue] Could not fetch server doc for conflict check, proceeding with overwrite:', e);
            }
          }

          if (shouldWrite) {
            if (item.type === 'insert' || item.type === 'update') {
              if (item.tableName === 'products' && 'stock_delta' in item.data) {
                const syncData = { ...item.data };
                syncData.stock = increment(Number(item.data.stock_delta));
                delete syncData.stock_delta;
                batch.set(docRef, syncData, { merge: true });
              } else {
                batch.set(docRef, item.data, { merge: true });
              }
            } else if (item.type === 'delete') {
              batch.delete(docRef);
            }
            batchItems.push(item);
          }
        } catch (itemErr) {
          console.error(`[OfflineQueue] Error preparing item ${item.id} for batch:`, itemErr);
        }
      }

      // Jika ada item yang dimasukkan ke batch, commit
      if (batchItems.length > 0) {
        try {
          await batch.commit();
          console.log(`[OfflineQueue] Batch committed successfully for ${batchItems.length} items.`);
          // Dequeue all successful items
          for (const item of batchItems) {
            await this.dequeue(item.id);
            syncedCount++;
          }
        } catch (batchErr: any) {
          console.warn('[OfflineQueue] Batch commit failed. Falling back to individual processing for this chunk:', batchErr);
          
          // Fallback: proses individual jika batch gagal (misal karena ada 1 record yang permission-denied)
          for (const item of batchItems) {
            try {
              const docRef = doc(firestoreDb, item.tableName, item.recordId);
              if (item.type === 'insert' || item.type === 'update') {
                if (item.tableName === 'products' && 'stock_delta' in item.data) {
                  const syncData = { ...item.data };
                  syncData.stock = increment(Number(item.data.stock_delta));
                  delete syncData.stock_delta;
                  await setDoc(docRef, syncData, { merge: true });
                } else {
                  await setDoc(docRef, item.data, { merge: true });
                }
              } else if (item.type === 'delete') {
                await deleteDoc(docRef);
              }
              await this.dequeue(item.id);
              syncedCount++;
            } catch (err: any) {
              console.error(`[OfflineQueue] Individual sync failed for item ${item.id}:`, err);
              const errorCode = err?.code || '';
              const isPermanentError = [
                'permission-denied',
                'not-found',
                'invalid-argument',
                'failed-precondition'
              ].includes(errorCode);

              if (isPermanentError) {
                console.warn(`[OfflineQueue] Permanent error (${errorCode}) detected. Dequeuing item to prevent Head-of-Line blocking.`);
                await this.dequeue(item.id);
              } else {
                failedCount++;
              }
            }
          }
        }
      }

      // Tambahkan item yang di-skip ke count sukses karena sudah di-dequeue
      syncedCount += skippedItemIds.length;
    }

    console.log(`[OfflineQueue] Sync complete. Synced: ${syncedCount}, Failed: ${failedCount}`);
    return {
      success: failedCount === 0,
      syncedCount,
      failedCount
    };
  }
};

// Set up automatic listeners for Network reconnection
try {
  Network.addListener('networkStatusChange', async (status) => {
    if (status.connected) {
      console.log('[OfflineQueue] Network reconnected! Auto-triggering sync...');
      const result = await OfflineQueueService.syncQueue();
      if (result.syncedCount > 0) {
        toast.success(`${result.syncedCount} data transaksi offline berhasil disinkronkan ke server cloud!`, {
          duration: 5000,
          position: 'bottom-right'
        });
      }
    }
  }).catch((e) => {
    console.warn('[OfflineQueue] Network listener could not be registered:', e);
  });
} catch (e) {
  console.warn('[OfflineQueue] Network plugin failed to initialize:', e);
}
