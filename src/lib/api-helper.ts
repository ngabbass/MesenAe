import { Capacitor } from '@capacitor/core';

/**
 * Mendapatkan URL API absolut saat berjalan di platform native Capacitor,
 * atau tetap menggunakan relative path jika berjalan di web browser.
 */
export function getApiUrl(path: string): string {
  if (Capacitor.isNativePlatform()) {
    // Membaca dari environment variable VITE_API_BASE_URL (jika ada) atau fallback ke domain produksi utama
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://mesenae.vercel.app';
    
    // Pastikan path diawali slash dan baseUrl tidak diakhiri slash ganda
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    
    return `${cleanBaseUrl}${cleanPath}`;
  }
  return path;
}
