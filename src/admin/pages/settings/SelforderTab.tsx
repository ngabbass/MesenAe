import React, { useState, useEffect } from 'react';
import { useDbQuery, dbUpdate } from '@/hooks/db-hooks';
import type { StoreSettings } from '@/hooks/db-hooks';
import { Section, SettingCard } from '../Settings';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// --- Icons ---
import { Link as LinkIcon, Package, UtensilsCrossed, Smartphone, Coins, Loader2, Save, Layout } from 'lucide-react';

const themes = [
  {
    id: 'standar',
    name: 'Standar',
    desc: 'Desain minimalis, modern, bersih, dan fungsional.',
    preview: (
      <div className="w-full h-full bg-background rounded-md border border-border p-2 flex flex-col justify-between">
        <div className="flex gap-1 items-center">
          <div className="w-2.5 h-2.5 rounded-full bg-primary/70" />
          <div className="w-8 h-1.5 bg-muted rounded" />
        </div>
        <div className="space-y-1">
          <div className="w-full h-1 bg-muted rounded" />
          <div className="w-3/4 h-1 bg-muted rounded" />
        </div>
        <div className="w-full h-3.5 bg-primary rounded flex items-center justify-center">
          <div className="w-5 h-0.5 bg-primary-foreground/80 rounded" />
        </div>
      </div>
    )
  },
  {
    id: 'neobrutalism',
    name: 'Neobrutalism',
    desc: 'Tampilan retro-modern dengan garis tebal, kontras tinggi, dan bayangan tegas.',
    preview: (
      <div className="w-full h-full bg-[#FFFBEB] rounded-md border-2 border-black p-2 flex flex-col justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex gap-1 items-center">
          <div className="w-2.5 h-2.5 rounded-full bg-[#3B82F6] border border-black" />
          <div className="w-8 h-1.5 bg-black rounded-none" />
        </div>
        <div className="space-y-1">
          <div className="w-full h-1 bg-black rounded-none" />
          <div className="w-3/4 h-1 bg-black rounded-none" />
        </div>
        <div className="w-full h-3.5 bg-[#F59E0B] border border-black rounded-none flex items-center justify-center shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
          <div className="w-5 h-0.5 bg-black rounded-none" />
        </div>
      </div>
    )
  },
  {
    id: 'glashmorphism',
    name: 'Glassmorphism',
    desc: 'Efek kaca transparan dengan latar belakang blur dan gradien lembut.',
    preview: (
      <div className="w-full h-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 rounded-md p-2 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.1),transparent)]" />
        <div className="flex gap-1 items-center z-10">
          <div className="w-2.5 h-2.5 rounded-full bg-white/40 border border-white/20 backdrop-blur-[1px]" />
          <div className="w-8 h-1.5 bg-white/30 rounded backdrop-blur-[1px]" />
        </div>
        <div className="space-y-1 z-10">
          <div className="w-full h-1 bg-white/30 rounded backdrop-blur-[1px]" />
          <div className="w-3/4 h-1 bg-white/30 rounded backdrop-blur-[1px]" />
        </div>
        <div className="w-full h-3.5 bg-white/25 border border-white/35 rounded flex items-center justify-center backdrop-blur-sm z-10">
          <div className="w-5 h-0.5 bg-white/80 rounded" />
        </div>
      </div>
    )
  },
  {
    id: 'claymorphism',
    name: 'Claymorphism',
    desc: 'Tampilan 3D organik yang lembut dan warna tenang.',
    preview: (
      <div className="w-full h-full bg-slate-100 rounded-md p-2 flex flex-col justify-between">
        <div className="flex gap-1 items-center">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[inset_-1px_-1px_2px_rgba(0,0,0,0.2),_inset_1px_1px_2px_rgba(255,255,255,0.6)]" />
          <div className="w-8 h-1.5 bg-indigo-200 rounded-lg shadow-[inset_1px_1px_2px_rgba(0,0,0,0.05)]" />
        </div>
        <div className="space-y-1">
          <div className="w-full h-1 bg-indigo-200 rounded-lg shadow-[inset_1px_1px_2px_rgba(0,0,0,0.05)]" />
          <div className="w-3/4 h-1 bg-indigo-200 rounded-lg shadow-[inset_1px_1px_2px_rgba(0,0,0,0.05)]" />
        </div>
        <div className="w-full h-3.5 bg-indigo-500 rounded-lg flex items-center justify-center shadow-[inset_-1.5px_-1.5px_3px_rgba(0,0,0,0.3),_inset_1.5px_1.5px_3px_rgba(255,255,255,0.4),_0_2px_4px_rgba(99,102,241,0.2)]">
          <div className="w-5 h-0.5 bg-white/80 rounded-lg" />
        </div>
      </div>
    )
  }
];

export default function SelforderTab({ hasEditAccess }: { hasEditAccess: boolean }) {
  // --- Data & State ---
  const storeSettings = useDbQuery<StoreSettings>('storeSettings')?.[0];

  const [customerUrl, setCustomerUrl] = useState('');
  const [isSavingCustomerUrl, setIsSavingCustomerUrl] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<'ambil' | 'diantar'>('diantar');
  const [enableWhatsappNotification, setEnableWhatsappNotification] = useState<boolean>(false);
  const [enableSplitBill, setEnableSplitBill] = useState<boolean>(true);
  const [savingThemeId, setSavingThemeId] = useState<string | null>(null);

  // Sinkronisasi data ke state lokal
  useEffect(() => {
    if (storeSettings) {
      // Smart detection & correction for customerUrl
      let dbUrl = storeSettings.customerUrl || '';
      
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      if (!dbUrl) {
        // Fallback jika kosong
        dbUrl = isLocal ? 'http://localhost:8081' : 'https://mesen-ae.vercel.app';
      } else {
        // Jika terisi URL admin lokal (port 8080)
        const isLocalAdmin = dbUrl.includes('localhost:8080') || dbUrl.includes('127.0.0.1:8080');
        if (isLocalAdmin) {
          dbUrl = dbUrl.replace(':8080', ':8081');
        }
      }
      
      setCustomerUrl(dbUrl);
      setDeliveryMode(storeSettings.deliveryMode || 'diantar');
      setEnableWhatsappNotification(storeSettings.enableWhatsappNotification || false);
      setEnableSplitBill(storeSettings.enableSplitBill !== false);
    }
  }, [storeSettings]);

  // --- Handlers ---
  const saveCustomerUrl = async () => {
    if (!hasEditAccess) { toast.error('Akses ditolak.'); return; }
    let url = customerUrl.trim();
    if (!url) { toast.error('URL tidak boleh kosong'); return; }
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
    
    setIsSavingCustomerUrl(true);
    try {
      if (storeSettings?.id) {
        await dbUpdate('storeSettings', storeSettings.id, { customerUrl: url });
        toast.success('URL Aplikasi Self-Order berhasil disimpan');
      } else {
        toast.error('Pengaturan toko belum diinisialisasi');
      }
    } catch (error: any) {
      toast.error('Gagal menyimpan URL: ' + (error.message || error));
    } finally { setIsSavingCustomerUrl(false); }
  };

  const saveDeliveryModeDirect = async (mode: 'ambil' | 'diantar') => {
    if (!hasEditAccess) { toast.error('Akses ditolak.'); return; }
    try {
      if (storeSettings?.id) {
        await dbUpdate('storeSettings', storeSettings.id, { deliveryMode: mode });
        toast.success('Sistem penjualan berhasil diperbarui');
      }
    } catch (e: any) {
      toast.error('Gagal memperbarui sistem penjualan: ' + e.message);
    }
  };

  const saveWhatsappNotificationToggle = async (checked: boolean) => {
    if (!hasEditAccess) { toast.error('Akses ditolak.'); return; }
    setEnableWhatsappNotification(checked);
    try {
      if (storeSettings?.id) {
        await dbUpdate('storeSettings', storeSettings.id, { enableWhatsappNotification: checked });
        toast.success(checked ? 'Permintaan nomor WhatsApp pelanggan diaktifkan' : 'Permintaan nomor WhatsApp pelanggan dinonaktifkan');
      }
    } catch (e: any) {
      toast.error('Gagal memperbarui pengaturan WhatsApp: ' + e.message);
    }
  };

  const saveSplitBillToggle = async (checked: boolean) => {
    if (!hasEditAccess) { toast.error('Akses ditolak.'); return; }
    setEnableSplitBill(checked);
    try {
      if (storeSettings?.id) {
        await dbUpdate('storeSettings', storeSettings.id, { enableSplitBill: checked });
        toast.success(checked ? 'Fitur Split Bill diaktifkan' : 'Fitur Split Bill dinonaktifkan');
      }
    } catch (e: any) {
      toast.error('Gagal memperbarui pengaturan split bill: ' + e.message);
    }
  };

  const saveTheme = async (themeId: string) => {
    if (!hasEditAccess) { toast.error('Akses ditolak.'); return; }
    setSavingThemeId(themeId);
    try {
      if (storeSettings?.id) {
        await dbUpdate('storeSettings', storeSettings.id, { selfOrderTheme: themeId });
        const friendlyName = themeId === 'glashmorphism' ? 'Glassmorphism' : themeId.charAt(0).toUpperCase() + themeId.slice(1);
        toast.success(`Tema Self-Order berhasil diubah ke "${friendlyName}"`);
      } else {
        toast.error('Pengaturan toko belum diinisialisasi');
      }
    } catch (error: any) {
      toast.error('Gagal menyimpan tema: ' + (error.message || error));
    } finally {
      setSavingThemeId(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-8 animate-in fade-in duration-500">
      
      {/* ── Banner Peringatan Mode Lihat Saja ── */}
      {!hasEditAccess && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 select-none">
          <span className="text-base shrink-0">🔒</span>
          <span><strong>Mode Lihat Saja:</strong> Anda tidak memiliki izin untuk mengubah pengaturan Self Order.</span>
        </div>
      )}

      {/* ── Konten Utama Pengaturan Self Order ── */}
      <div className={cn(
        "space-y-4 sm:space-y-6 transition-all duration-300", 
        !hasEditAccess && "pointer-events-none opacity-75"
      )}>
        <Section 
          hideHeader
          title="Pengaturan Self Order" 
          description="Kelola URL, sistem penjualan, dan fitur pelanggan Self-Order."
        >
          
          {/* ── 1. URL Web Self-Order ── */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5"><LinkIcon className="w-3.5 h-3.5" /> URL Web Self-Order</p>
            <SettingCard>
              <div className="p-4 space-y-3">
                <p className="text-xs text-muted-foreground leading-snug">Alamat URL Web Selforder. URL ini akan menjadi dasar pembuatan QR Code pemesanan.</p>
                <div className="flex gap-2">
                  <Input 
                    value={customerUrl}
                    onChange={e => setCustomerUrl(e.target.value)}
                    placeholder="https://mesenae-customer.vercel.app"
                    className="bg-muted/50 h-9"
                  />
                  {hasEditAccess && (
                    <Button onClick={saveCustomerUrl} disabled={isSavingCustomerUrl} className="h-9 px-4 shrink-0 shadow-sm gap-2 font-semibold">
                      {isSavingCustomerUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Simpan
                    </Button>
                  )}
                </div>
              </div>
            </SettingCard>
          </div>

          {/* ── 2. Sistem Penjualan ── */}
          <div className="mt-6">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Sistem Pengantaran</p>
            <SettingCard>
              <div className="p-4 space-y-3">
                <p className="text-xs text-muted-foreground leading-snug">Pilih penyerahan pesanan: diantar ke meja pelanggan atau diambil sendiri secara mandiri.</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={!hasEditAccess}
                    onClick={() => {
                      setDeliveryMode('diantar');
                      saveDeliveryModeDirect('diantar');
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
                      deliveryMode === 'diantar' ? "border-primary bg-primary/10 text-primary shadow-sm" : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <UtensilsCrossed className="w-5 h-5 mb-1.5" />
                    <span className="text-xs font-semibold">Diantar ke Meja</span>
                  </button>
                  <button
                    type="button"
                    disabled={!hasEditAccess}
                    onClick={() => {
                      setDeliveryMode('ambil');
                      saveDeliveryModeDirect('ambil');
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
                      deliveryMode === 'ambil' ? "border-primary bg-primary/10 text-primary shadow-sm" : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Package className="w-5 h-5 mb-1.5" />
                    <span className="text-xs font-semibold">Ambil Sendiri</span>
                  </button>
                </div>
              </div>
            </SettingCard>
          </div>

          {/* ── 3. Minta Nomor WhatsApp Pelanggan ── */}
          <div className="mt-6">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> Minta Nomor WhatsApp Pelanggan</p>
            <SettingCard>
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Aktifkan Minta Nomor Pelanggan</p>
                  <p className="text-xs text-muted-foreground leading-snug">Meminta nomor WhatsApp pelanggan untuk didata, dan dapat mengirim notifikasi ketika pesanan siap.</p>
                </div>
                <Switch
                  disabled={!hasEditAccess}
                  checked={enableWhatsappNotification}
                  onCheckedChange={(checked) => saveWhatsappNotificationToggle(checked)}
                />
              </div>
            </SettingCard>
          </div>

          {/* ── 4. Pembagian Tagihan (Split Bill) ── */}
          <div className="mt-6">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5"><Coins className="w-3.5 h-3.5" /> Pembagian Tagihan (Split Bill)</p>
            <SettingCard>
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Aktifkan Fitur Split Bill</p>
                  <p className="text-xs text-muted-foreground leading-snug">Menampilkan opsi pembagian tagihan (Split Bill) di halaman checkout.</p>
                </div>
                <Switch
                  disabled={!hasEditAccess}
                  checked={enableSplitBill}
                  onCheckedChange={(checked) => saveSplitBillToggle(checked)}
                />
              </div>
            </SettingCard>
          </div>

          {/* ── 5. Tema Tampilan Self Order ── */}
          <div className="mt-6">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5"><Layout className="w-3.5 h-3.5" /> Tema Tampilan Self Order</p>
            <SettingCard>
              <div className="p-4 space-y-4">
                <p className="text-xs text-muted-foreground leading-snug">Pilih desain tampilan Web Self-Order.</p>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-2">
                  {themes.map(t => {
                    const isActive = (storeSettings?.selfOrderTheme ?? 'standar') === t.id;
                    const isSaving = savingThemeId === t.id;
                    return (
                      <div 
                        key={t.id} 
                        className={cn(
                          "flex flex-col justify-between p-2.5 sm:p-3.5 rounded-xl border bg-card transition-all",
                          isActive ? "border-primary ring-1 ring-primary/30" : "border-border/60 hover:border-border hover:bg-muted/10"
                        )}
                      >
                        <div className="space-y-2 sm:space-y-3">
                          {/* Visual Preview Box */}
                          <div className="h-20 sm:h-28 rounded-lg overflow-hidden border border-border/80 bg-muted/40 p-1.5 sm:p-2 flex flex-col justify-between select-none">
                            {t.preview}
                          </div>
                          
                          <div>
                            <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1">
                              <span className="text-xs sm:text-sm font-semibold text-foreground">{t.name}</span>
                              {isActive && (
                                <span className="w-fit text-[9px] sm:text-[10px] font-bold text-primary bg-primary/10 px-1.5 sm:px-2 py-0.5 rounded-full">Aktif</span>
                              )}
                            </div>
                            <p className="text-[10px] sm:text-[11px] text-muted-foreground leading-snug mt-1 line-clamp-3 sm:line-clamp-none">{t.desc}</p>
                          </div>
                        </div>
                        
                        <Button
                          size="sm"
                          variant={isActive ? "outline" : "default"}
                          disabled={!hasEditAccess || isSaving || isActive}
                          onClick={() => saveTheme(t.id)}
                          className="w-full mt-3 sm:mt-4 h-8 text-xs font-semibold"
                        >
                          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                          {isActive ? "Aktif" : "Pilih & Simpan"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </SettingCard>
          </div>

        </Section>
      </div>
      
    </div>
  );
}
