import React, { useState, useEffect } from 'react';
import { useDbQuery } from '@/hooks/db-hooks';
import type { StoreSettings } from '@/hooks/db-hooks';
import { Section, SettingCard } from '../Settings';
import ThemeColorPicker from '@/admin/components/ThemeColorPicker';
import { setThemeColor } from '@/hooks/use-theme-color';
import { cn } from '@/lib/utils';

// --- Icons ---
import { Paintbrush } from 'lucide-react';

export default function DisplayTab({ hasEditAccess }: { hasEditAccess: boolean }) {
  // --- Data & State ---
  const storeSettings = useDbQuery<StoreSettings>('storeSettings')?.[0];
  const [themeHue, setThemeHue] = useState(storeSettings?.themeColor ?? '217');

  // Sinkronisasi data ke state lokal
  useEffect(() => { 
    setThemeHue(storeSettings?.themeColor ?? '217'); 
  }, [storeSettings?.themeColor]);

  return (
    <div className="space-y-4 sm:space-y-6 pb-8 animate-in fade-in duration-500">
      
      {/* ── Banner Peringatan Mode Lihat Saja (Original) ── */}
      {!hasEditAccess && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 select-none">
          <span className="text-base shrink-0">🔒</span>
          <span><strong>Mode Lihat Saja:</strong> Anda tidak memiliki izin untuk mengubah tema warna utama aplikasi.</span>
        </div>
      )}

      {/* ── Konten Utama Pengaturan Tampilan ── */}
      <div className={cn(
        "space-y-4 sm:space-y-6 transition-all duration-300", 
        !hasEditAccess && "pointer-events-none opacity-75"
      )}>
        <Section 
          hideHeader
          title="Tampilan & Tema UI" 
          description="Personalisasi mode warna utama dan preferensi visual aplikasi."
        >
          
          <SettingCard className="border-slate-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden">
            
            {/* Header Card dengan Ikon dan Deskripsi */}
            <div className="flex items-center gap-4 p-5 border-b border-border/50 bg-gradient-to-br from-card to-primary/5 transition-colors duration-300 group-hover:to-primary/10">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-primary/20 bg-primary/10 text-primary shadow-sm group-hover:scale-105 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                <Paintbrush className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-[14px] sm:text-[15px] font-bold text-foreground flex items-center gap-1.5 group-hover:text-primary transition-colors">
                  Warna Tema Dominan
                </h3>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                  Pilih identitas warna yang akan diterapkan pada tombol, menu, dan elemen aktif lainnya.
                </p>
              </div>
            </div>

            {/* Area Color Picker */}
            <div className="p-5 bg-card">
              <div className="max-w-2xl">
                <ThemeColorPicker
                  value={themeHue}
                  onChange={hue => { 
                    setThemeHue(hue); 
                    setThemeColor(hue); 
                  }}
                />
              </div>
            </div>
            
          </SettingCard>

        </Section>
      </div>
      
    </div>
  );
}
