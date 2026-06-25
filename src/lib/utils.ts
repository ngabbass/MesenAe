import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const FORMAT_IDR = (price: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
};

export const saveLocalTransactionId = (txId: string | number) => {
  try {
    const existingStr = localStorage.getItem('mesenae_my_tx_ids');
    const existing: (string | number)[] = existingStr ? JSON.parse(existingStr) : [];
    if (!existing.includes(txId)) {
      existing.push(txId);
      localStorage.setItem('mesenae_my_tx_ids', JSON.stringify(existing));
    }
  } catch (e) {
    console.error('Error saving txId to local storage:', e);
  }
};

export const getLocalTransactionIds = (): (string | number)[] => {
  try {
    const existingStr = localStorage.getItem('mesenae_my_tx_ids');
    return existingStr ? JSON.parse(existingStr) : [];
  } catch (e) {
    console.error('Error getting txIds from local storage:', e);
    return [];
  }
};

export const generateTableId = (str: string): string => {
  if (!str) return 'takeaway';
  if (str === 'Bawa Pulang') return 'takeaway';
  
  // cyrb53 hash
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const combined = (h1 >>> 0) ^ (h2 >>> 0);
  
  // Convert the combined hash into an 8-character alphanumeric string
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  let seed = combined;
  for (let i = 0; i < 8; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    result += chars[seed % chars.length];
  }
  return result;
};

export const formatReceiptTable = (t: string | number | null | undefined): string => {
  const s = String(t || '').trim();
  const lower = s.toLowerCase();
  if (!s || lower === 'bawa pulang' || lower === 'take away' || lower === 'takeaway') {
    return 'Bawa Pulang';
  }
  if (s.includes(' - ')) {
    const parts = s.split(' - ');
    const area = parts[0].trim();
    const table = parts[1].trim();
    const tableLabel = /^\d+$/.test(table) ? `Meja ${table}` : table;
    return `${tableLabel} (${area})`;
  }
  const cleanTable = s.replace(/^(meja\s+)+/i, '').trim();
  return /^\d+$/.test(cleanTable) ? `Meja ${cleanTable}` : cleanTable;
};
