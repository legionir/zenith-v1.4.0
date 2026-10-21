// packages/service-worker/src/sw-db.ts
//
// ماندگاری IndexedDB برای صف sync — استخراج مکانیکی از sw.ts،
// بدون تغییر رفتار (#40).

import { SYNC_DB_NAME, SYNC_DB_VERSION, SYNC_STORE } from './sw-state';
import type { QueuedMutation } from './sw-types';


/**
 * FEATURE (v0.5.0): باز کردنِ IndexedDB برای صفِ background sync.
 *
 * DB name: `zenith-sw-sync`، store: `mutations` با autoIncrement key (`id`).
 * اگر IndexedDB در دسترس نباشد (مثلاً در تستِ Node)، `null` برمی‌گرداند تا کد
 * به‌صورت graceful degrade کند.
 */
function openSyncDB(): Promise<IDBDatabase | null> {
  // SECURITY/FEATURE (v0.5.0): guard برای محیط‌های بدون IndexedDB.
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = indexedDB.open(SYNC_DB_NAME, SYNC_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(SYNC_STORE)) {
          db.createObjectStore(SYNC_STORE, {
            keyPath: 'id',
            autoIncrement: true,
          });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        // در صورت خطا، null برمی‌گردانیم تا کد به‌صورت in-memory ادامه دهد.
        resolve(null);
      };
    } catch (err) {
      resolve(null);
    }
  });
}

/**
 * FEATURE (v0.5.0): بارگذاریِ کلِ صف از IndexedDB.
 *
 * @returns آرایه‌ای از QueuedMutation (خالی اگر DB در دسترس نباشد).
 */
export async function loadQueue(): Promise<QueuedMutation[]> {
  const db = await openSyncDB();
  if (!db) return [];
  return new Promise<QueuedMutation[]>((resolve) => {
    try {
      const tx = db.transaction(SYNC_STORE, 'readonly');
      const store = tx.objectStore(SYNC_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as QueuedMutation[]) || []);
      req.onerror = () => resolve([]);
      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        try {
          db.close();
        } catch (e) {
          /* ignore */
        }
        resolve([]);
      };
    } catch (err) {
      try {
        db.close();
      } catch (e) {
        /* ignore */
      }
      resolve([]);
    }
  });
}

// NOTE: a `saveQueue(remaining)` helper used to rewrite the whole queue here.
// It was removed in v1.2.7 because clear()+put() silently dropped mutations
// enqueued concurrently during the retry loop; see processSyncQueue, which now
// deletes each mutation individually via removeFromQueue().

/**
 * FEATURE (v0.5.0): اضافه کردنِ یک mutation به IndexedDB.
 *
 * @returns کلیدِ تخصیص‌یافته (id) یا null در صورت شکست.
 */
export async function addToQueue(mutation: QueuedMutation): Promise<number | null> {
  const db = await openSyncDB();
  if (!db) return null;
  return new Promise<number | null>((resolve) => {
    try {
      const tx = db.transaction(SYNC_STORE, 'readwrite');
      const store = tx.objectStore(SYNC_STORE);
      const req = store.add(mutation);
      req.onsuccess = () => resolve(req.result as number);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => {
        try {
          db.close();
        } catch (e) {
          /* ignore */
        }
      };
      tx.onerror = () => {
        try {
          db.close();
        } catch (e) {
          /* ignore */
        }
        resolve(null);
      };
    } catch (err) {
      try {
        db.close();
      } catch (e) {
        /* ignore */
      }
      resolve(null);
    }
  });
}

/**
 * FEATURE (v0.5.0): حذفِ یک mutation با `id` از IndexedDB.
 */
export async function removeFromQueue(id: number): Promise<void> {
  const db = await openSyncDB();
  if (!db) return;
  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(SYNC_STORE, 'readwrite');
      const store = tx.objectStore(SYNC_STORE);
      store.delete(id);
      tx.oncomplete = () => {
        try {
          db.close();
        } catch (e) {
          /* ignore */
        }
        resolve();
      };
      tx.onerror = () => {
        try {
          db.close();
        } catch (e) {
          /* ignore */
        }
        resolve();
      };
    } catch (err) {
      try {
        db.close();
      } catch (e) {
        /* ignore */
      }
      resolve();
    }
  });
}
