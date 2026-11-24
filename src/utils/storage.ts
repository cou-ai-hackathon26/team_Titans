import type { SavedScanRecord } from '../types/clinical';

const DB_NAME = 'oshudhguard_offline_db';
const STORE_NAME = 'verified_prescriptions';
const FALLBACK_KEY = 'oshudhguard_saved_scans_v1';

function openOfflineDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'prescriptionId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveScanOffline(record: SavedScanRecord): Promise<void> {
  const db = await openOfflineDb();
  if (db) {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    return;
  }

  try {
    const existing = await loadSavedScansOffline();
    const filtered = existing.filter((r) => r.prescriptionId !== record.prescriptionId);
    const updated = [record, ...filtered].slice(0, 15);
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export async function loadSavedScansOffline(): Promise<SavedScanRecord[]> {
  const db = await openOfflineDb();
  if (db) {
    return new Promise<SavedScanRecord[]>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const items = (req.result as SavedScanRecord[]) ?? [];
        items.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
        resolve(items);
      };
      req.onerror = () => resolve([]);
    });
  }

  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedScanRecord[];
  } catch {
    return [];
  }
}

export async function deleteSavedScanOffline(prescriptionId: string): Promise<void> {
  const db = await openOfflineDb();
  if (db) {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(prescriptionId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    return;
  }

  try {
    const existing = await loadSavedScansOffline();
    const updated = existing.filter((r) => r.prescriptionId !== prescriptionId);
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}
