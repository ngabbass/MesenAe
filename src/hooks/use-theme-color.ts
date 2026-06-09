import { useEffect } from 'react';
import { useDbQuery, dbUpdate, getLocalCache } from '@/hooks/db-hooks';
import { db } from '@/lib/db';

// Predefined theme color options with HSL values
export const THEME_COLORS = [
  { name: 'Oranye', hue: '25', saturation: '95%', lightness: '53%' },
  { name: 'Biru', hue: '217', saturation: '91%', lightness: '60%' },
  { name: 'Hijau', hue: '142', saturation: '71%', lightness: '45%' },
  { name: 'Ungu', hue: '262', saturation: '83%', lightness: '58%' },
  { name: 'Merah', hue: '0', saturation: '84%', lightness: '60%' },
  { name: 'Pink', hue: '330', saturation: '81%', lightness: '60%' },
  { name: 'Teal', hue: '172', saturation: '66%', lightness: '50%' },
  { name: 'Kuning', hue: '45', saturation: '93%', lightness: '47%' },
] as const;

import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { NavigationBar } from '@hugotomazi/capacitor-navigation-bar';

export function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function getThemeHSL(hue: string) {
  const preset = THEME_COLORS.find(c => c.hue === hue);
  if (preset) return `${preset.hue} ${preset.saturation} ${preset.lightness}`;
  return `${hue} 91% 60%`;
}

export async function applyThemeColor(hue: string) {
  const hsl = getThemeHSL(hue);
  document.documentElement.style.setProperty('--primary', hsl);
  document.documentElement.style.setProperty('--ring', hsl);
  
  const isDarkMode = document.documentElement.classList.contains('dark');

  // Update meta theme-color for PWA
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', isDarkMode ? '#09090b' : `hsl(${hsl})`);
  }

  // Update Android Status Bar & Navigation Bar
  if (Capacitor.isNativePlatform()) {
    try {
      // Enable transparent Status Bar Overlay so WebView occupies the full screen bezel-to-bezel
      await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      await StatusBar.show().catch(() => {});
      
      if (isDarkMode) {
        // Dark mode: status bar icons are light (Style.Dark) so they remain visible
        await StatusBar.setStyle({ style: Style.Dark });
        // Navigation bar: icons should be white (darkButtons: false) so they remain visible on dark background
        await NavigationBar.setColor({ color: '#00000000', darkButtons: false }).catch(() => {});
      } else {
        // Light mode: status bar icons are dark (Style.Light) so they remain visible
        await StatusBar.setStyle({ style: Style.Light });
        // Navigation bar: icons should be black (darkButtons: true) so they remain visible on light background
        await NavigationBar.setColor({ color: '#00000000', darkButtons: true }).catch(() => {});
      }
    } catch (e) {
      console.warn("Could not set status or navigation bar color", e);
    }
  }
}

export function useThemeColor() {
  const storeSettings = useDbQuery<any>('storeSettings')?.[0];
  const activeHue = storeSettings?.themeColor ?? '217';

  // Apply theme color on mount or setting change
  useEffect(() => {
    applyThemeColor(activeHue);
  }, [activeHue]);

  // Set up MutationObserver to react to dark/light mode toggling instantly
  useEffect(() => {
    const observer = new MutationObserver(() => {
      applyThemeColor(activeHue);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, [activeHue]);

  return activeHue;
}

export async function setThemeColor(hue: string) {
  applyThemeColor(hue);
  const cachedSettings = await getLocalCache('store_settings');
  const settings = cachedSettings[0];
  if (settings?.id) {
    await dbUpdate('store_settings', settings.id, { themeColor: hue });
  }
}
