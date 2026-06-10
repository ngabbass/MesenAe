import React, { useState, useEffect, useRef } from 'react';
import { useDbQuery, dbInsert, dbUpdate, dbUploadFile, dbDeleteFile } from '@/hooks/db-hooks';
import type { StoreSettings } from '@/hooks/db-hooks';
import { Section, SettingCard } from '../Settings';
import { Edit2, Store, ZoomIn, Link as LinkIcon, Save, Loader2, UtensilsCrossed, Package, Smartphone, Camera, X, Percent, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { compressImage } from '@/lib/image-utils';
import PhotoCropModal from '@/admin/components/PhotoCropModal';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export default function StoreInfoTab({ hasEditAccess }: { hasEditAccess: boolean }) {
  const storeSettings = useDbQuery<StoreSettings>('storeSettings')?.[0];
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  /* ── Store ── */
  const [storeDialog, setStoreDialog]   = useState(false);
  const [storeName,   setStoreName]     = useState('');
  const [storeAddr,   setStoreAddr]     = useState('');
  const [storePhone,  setStorePhone]    = useState('');
  const [storeLogo,   setStoreLogo]     = useState<string | undefined>();
  const [receiptFooter, setReceiptFooter] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'ambil' | 'diantar'>('diantar');
  const [enableWhatsappNotification, setEnableWhatsappNotification] = useState<boolean>(false);
  const [enableKitchen, setEnableKitchen] = useState<boolean>(true);
  const [enableTax, setEnableTax] = useState<boolean>(false);
  const [taxPercentage, setTaxPercentage] = useState<number>(0);
  const [enableAdminFee, setEnableAdminFee] = useState<boolean>(false);
  const [adminFeeValue, setAdminFeeValue] = useState<number>(0);
  const [enableSplitBill, setEnableSplitBill] = useState<boolean>(true);
  const [isSavingStore, setIsSavingStore] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);

  const [customerUrl, setCustomerUrl] = useState('');
  const [isSavingCustomerUrl, setIsSavingCustomerUrl] = useState(false);

  useEffect(() => {
    if (storeSettings) {
      setCustomerUrl(storeSettings.customerUrl || '');
      setDeliveryMode(storeSettings.deliveryMode || 'diantar');
      setEnableWhatsappNotification(storeSettings.enableWhatsappNotification || false);
      setEnableKitchen(storeSettings.enableKitchen !== false);
      setEnableTax(storeSettings.enableTax || false);
      setTaxPercentage(storeSettings.taxPercentage || 0);
      setEnableAdminFee(storeSettings.enableAdminFee || false);
      setAdminFeeValue(storeSettings.adminFeeValue || 0);
      setEnableSplitBill(storeSettings.enableSplitBill !== false);
    }
  }, [storeSettings]);

  const saveDeliveryModeDirect = async (mode: 'ambil' | 'diantar') => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak.');
      return;
    }
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
    if (!hasEditAccess) {
      toast.error('Akses ditolak.');
      return;
    }
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

  const saveKitchenToggle = async (checked: boolean) => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak.');
      return;
    }
    setEnableKitchen(checked);
    try {
      if (storeSettings?.id) {
        await dbUpdate('storeSettings', storeSettings.id, { enableKitchen: checked });
        toast.success(checked ? 'Dapur diaktifkan' : 'Dapur dinonaktifkan');
      }
    } catch (e: any) {
      toast.error('Gagal memperbarui pengaturan dapur: ' + e.message);
    }
  };

  const saveTaxToggle = async (checked: boolean) => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak.');
      return;
    }
    setEnableTax(checked);
    try {
      if (storeSettings?.id) {
        await dbUpdate('storeSettings', storeSettings.id, { enableTax: checked });
        toast.success(checked ? 'Pajak (PPN) diaktifkan' : 'Pajak (PPN) dinonaktifkan');
      }
    } catch (e: any) {
      toast.error('Gagal memperbarui pengaturan pajak: ' + e.message);
    }
  };

  const saveTaxPercentage = async () => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak.');
      return;
    }
    try {
      if (storeSettings?.id) {
        await dbUpdate('storeSettings', storeSettings.id, { taxPercentage });
        toast.success('Persentase pajak berhasil disimpan');
      }
    } catch (e: any) {
      toast.error('Gagal menyimpan persentase pajak: ' + e.message);
    }
  };

  const saveAdminFeeToggle = async (checked: boolean) => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak.');
      return;
    }
    setEnableAdminFee(checked);
    try {
      if (storeSettings?.id) {
        await dbUpdate('storeSettings', storeSettings.id, { enableAdminFee: checked });
        toast.success(checked ? 'Biaya admin diaktifkan' : 'Biaya admin dinonaktifkan');
      }
    } catch (e: any) {
      toast.error('Gagal memperbarui pengaturan biaya admin: ' + e.message);
    }
  };

  const saveAdminFeeValue = async () => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak.');
      return;
    }
    try {
      if (storeSettings?.id) {
        await dbUpdate('storeSettings', storeSettings.id, { adminFeeValue });
        toast.success('Nominal biaya admin berhasil disimpan');
      }
    } catch (e: any) {
      toast.error('Gagal menyimpan biaya admin: ' + e.message);
    }
  };

  const saveSplitBillToggle = async (checked: boolean) => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak.');
      return;
    }
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

  const saveCustomerUrl = async () => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak.');
      return;
    }
    let url = customerUrl.trim();
    if (!url) { toast.error('URL tidak boleh kosong'); return; }
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
    
    setIsSavingCustomerUrl(true);
    try {
      if (storeSettings?.id) {
        await dbUpdate('storeSettings', storeSettings.id, { customerUrl: url });
        toast.success('URL Aplikasi Customer berhasil disimpan');
      } else {
        toast.error('Pengaturan toko belum diinisialisasi');
      }
    } catch (error: any) {
      toast.error('Gagal menyimpan URL: ' + (error.message || error));
    } finally { setIsSavingCustomerUrl(false); }
  };

  const logoInputRef = useRef<HTMLInputElement>(null);

  const openStoreEdit = () => {
    setStoreName(storeSettings?.storeName ?? '');
    setStoreAddr(storeSettings?.address ?? '');
    setStorePhone(storeSettings?.phone ?? '');
    setStoreLogo(storeSettings?.logo);
    setReceiptFooter(storeSettings?.receiptFooter ?? 'Terima kasih atas kunjungan Anda!');
    setDeliveryMode(storeSettings?.deliveryMode ?? 'diantar');
    setEnableWhatsappNotification(storeSettings?.enableWhatsappNotification ?? false);
    setEnableTax(storeSettings?.enableTax ?? false);
    setTaxPercentage(storeSettings?.taxPercentage ?? 0);
    setEnableAdminFee(storeSettings?.enableAdminFee ?? false);
    setAdminFeeValue(storeSettings?.adminFeeValue ?? 0);
    setEnableSplitBill(storeSettings?.enableSplitBill !== false);
    setStoreDialog(true);
  };

  const saveStore = async () => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak. Anda tidak memiliki izin untuk mengedit pengaturan.');
      return;
    }
    setIsSavingStore(true);
    try {
      let finalLogoUrl = storeLogo;
      if (storeLogo && storeLogo.startsWith('data:image')) {
        const res = await fetch(storeLogo);
        const blob = await res.blob();
        const compressedDataUrl = await compressImage(blob, 0.5);
        const url = await dbUploadFile('storeSettings', `logo-${Date.now()}.jpg`, compressedDataUrl);
        if (url) finalLogoUrl = url;
      }

      if (storeSettings?.id) {
        if (storeSettings.logo && finalLogoUrl && storeSettings.logo !== finalLogoUrl) {
          await dbDeleteFile(storeSettings.logo);
        } else if (storeSettings.logo && !finalLogoUrl) {
          await dbDeleteFile(storeSettings.logo);
        }
      }

      const updates = {
        storeName: storeName.trim(), address: storeAddr.trim(),
        phone: storePhone.trim(), logo: finalLogoUrl || undefined,
        receiptFooter: receiptFooter.trim(), tables: storeSettings?.tables ?? [],
        deliveryMode,
        enableWhatsappNotification,
        enableKitchen,
        enableTax,
        taxPercentage,
        enableAdminFee,
        adminFeeValue,
        enableSplitBill
      };
      
      if (storeSettings?.id) {
        await dbUpdate('storeSettings', storeSettings.id, updates);
      } else {
        await dbInsert('storeSettings', { ...updates, onboardingDone: false, themeColor: storeSettings?.themeColor });
      }
      toast.success('Info toko disimpan');
      setStoreDialog(false);
    } catch (error: any) {
      toast.error('Gagal menyimpan info toko: ' + (error.message || error));
    } finally { setIsSavingStore(false); }
  };

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('File harus berupa gambar'); return; }
    setCropFile(file);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {!hasEditAccess && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 select-none">
          <span className="text-base shrink-0">🔒</span>
          <span><strong>Mode Lihat Saja:</strong> Anda tidak memiliki izin untuk mengubah pengaturan dasar toko.</span>
        </div>
      )}
      <div className={cn("space-y-4", !hasEditAccess && "pointer-events-none opacity-75")}>
        <Section
          hideHeader
          title="Info Toko"
          description="Identitas, kontak, dan informasi dasar operasional toko."
        >
          {/* Store hero card */}
          <SettingCard>
            <div className="flex items-center justify-between gap-4 p-4 bg-gradient-to-r from-primary/6 via-primary/3 to-transparent">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div 
                  className={cn(
                    "w-14 h-14 rounded-xl bg-background border border-border shadow-sm flex items-center justify-center overflow-hidden shrink-0 relative",
                    storeSettings?.logo && "cursor-pointer group hover:border-primary/50 transition-colors"
                  )}
                  onClick={() => storeSettings?.logo && setLightboxSrc(storeSettings.logo)}
                >
                  {storeSettings?.logo
                    ? (
                      <>
                        <img src={storeSettings.logo} alt="Logo" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <ZoomIn className="w-5 h-5 text-white" />
                        </div>
                      </>
                    )
                    : <Store className="w-6 h-6 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{storeSettings?.storeName || 'Toko Saya'}</p>
                    <Badge variant={storeSettings?.deliveryMode === 'ambil' ? 'secondary' : 'default'} className="text-[10px] h-5 px-1.5 font-bold">
                      {storeSettings?.deliveryMode === 'ambil' ? 'Ambil Sendiri' : 'Pesan Antar'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{storeSettings?.address || 'Alamat belum diatur'}</p>
                  <p className="text-xs text-muted-foreground">{storeSettings?.phone || 'Telepon belum diatur'}</p>
                </div>
              </div>
              {hasEditAccess && (
                <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs shrink-0 self-center shadow-sm" onClick={openStoreEdit}>
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </Button>
              )}
            </div>
          </SettingCard>

          <div className="mt-6">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5"><LinkIcon className="w-3.5 h-3.5" /> URL Aplikasi Customer</p>
            <SettingCard>
              <div className="p-4 space-y-3">
                <p className="text-xs text-muted-foreground leading-snug">URL domain (hosting) tempat aplikasi pembeli diakses. URL ini akan menjadi dasar pembuatan QR Code pemesanan di meja.</p>
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

          <div className="mt-6">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Sistem Penjualan (Pesanan di Tempat)</p>
            <SettingCard>
              <div className="p-4 space-y-3">
                <p className="text-xs text-muted-foreground leading-snug">Pilih penyerahan pesanan: diantar langsung ke meja pelanggan atau diambil sendiri secara mandiri.</p>
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

          <div className="mt-6">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5"><UtensilsCrossed className="w-3.5 h-3.5" /> Layar Dapur</p>
            <SettingCard>
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground leading-snug">Aktifkan sistem layar display dapur untuk mengelola antrean pesanan.</p>
                </div>
                <Switch
                  disabled={!hasEditAccess}
                  checked={enableKitchen}
                  onCheckedChange={(checked) => saveKitchenToggle(checked)}
                />
              </div>
            </SettingCard>
          </div>

          <div className="mt-6">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> Minta Nomor WhatsApp Pelanggan</p>
            <SettingCard>
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Aktifkan Minta Nomor Pelanggan</p>
                  <p className="text-xs text-muted-foreground leading-snug">Meminta nomor WhatsApp pelanggan saat memesan secara mandiri (self-order) agar status pesanan siap saji dikirim otomatis via Fonnte.</p>
                </div>
                <Switch
                  disabled={!hasEditAccess}
                  checked={enableWhatsappNotification}
                  onCheckedChange={(checked) => saveWhatsappNotificationToggle(checked)}
                />
              </div>
            </SettingCard>
          </div>

          <div className="mt-6">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5"><Coins className="w-3.5 h-3.5" /> Pembagian Tagihan (Split Bill)</p>
            <SettingCard>
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Aktifkan Fitur Split Bill</p>
                  <p className="text-xs text-muted-foreground leading-snug">Menampilkan opsi pembagian tagihan (Split Bill) untuk pembeli di halaman checkout.</p>
                </div>
                <Switch
                  disabled={!hasEditAccess}
                  checked={enableSplitBill}
                  onCheckedChange={(checked) => saveSplitBillToggle(checked)}
                />
              </div>
            </SettingCard>
          </div>

          <div className="mt-6">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5"><Percent className="w-3.5 h-3.5" /> Pajak &amp; Biaya Layanan</p>
            <SettingCard>
              {/* Pajak (PPN) */}
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Aktifkan Pajak (PPN)</p>
                  <p className="text-xs text-muted-foreground leading-snug">Menambahkan pajak PPN sebesar persentase tertentu ke total pesanan.</p>
                </div>
                <Switch
                  disabled={!hasEditAccess}
                  checked={enableTax}
                  onCheckedChange={(checked) => saveTaxToggle(checked)}
                />
              </div>
              {enableTax && (
                <div className="p-4 border-t border-border flex items-end gap-3 bg-muted/20">
                  <div className="flex-1 max-w-[200px] space-y-1.5">
                    <Label className="text-xs font-medium">Persentase Pajak (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={taxPercentage || ''}
                      onChange={e => setTaxPercentage(Number(e.target.value))}
                      className="bg-background h-9"
                    />
                  </div>
                  <Button onClick={saveTaxPercentage} className="h-9 px-3 shrink-0 shadow-sm">Simpan %</Button>
                </div>
              )}

              {/* Biaya Admin */}
              <div className="p-4 border-t border-border flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Aktifkan Biaya Admin</p>
                  <p className="text-xs text-muted-foreground leading-snug">Menambahkan biaya admin flat ke total pesanan (manual atau online).</p>
                </div>
                <Switch
                  disabled={!hasEditAccess}
                  checked={enableAdminFee}
                  onCheckedChange={(checked) => saveAdminFeeToggle(checked)}
                />
              </div>
              {enableAdminFee && (
                <div className="p-4 border-t border-border flex items-end gap-3 bg-muted/20">
                  <div className="flex-1 max-w-[200px] space-y-1.5">
                    <Label className="text-xs font-medium">Nominal Biaya Admin (Rp)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={adminFeeValue || ''}
                      onChange={e => setAdminFeeValue(Number(e.target.value))}
                      className="bg-background h-9"
                    />
                  </div>
                  <Button onClick={saveAdminFeeValue} className="h-9 px-3 shrink-0 shadow-sm">Simpan Rp</Button>
                </div>
              )}
            </SettingCard>
          </div>
        </Section>
      </div>

      {/* ── Store Dialog ── */}
      <Dialog open={storeDialog} onOpenChange={setStoreDialog}>
        <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="w-4 h-4" /> Info Toko
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Logo */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Logo Toko</Label>
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-16 h-16 rounded-xl bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden shrink-0 relative",
                    storeLogo ? "cursor-pointer group hover:border-primary/50 transition-colors" : "cursor-pointer hover:border-primary/50 transition-colors"
                  )}
                  onClick={() => storeLogo ? setLightboxSrc(storeLogo) : logoInputRef.current?.click()}
                >
                  {storeLogo
                    ? (
                      <>
                        <img src={storeLogo} alt="Logo" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <ZoomIn className="w-5 h-5 text-white" />
                        </div>
                      </>
                    )
                    : <Camera className="w-5 h-5 text-muted-foreground/50" />}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => logoInputRef.current?.click()}>
                    <Camera className="w-3.5 h-3.5" /> {storeLogo ? 'Ganti Logo' : 'Pilih Logo'}
                  </Button>
                  {storeLogo && (
                    <Button type="button" variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive" onClick={() => setStoreLogo(undefined)}>
                      <X className="w-3.5 h-3.5" /> Hapus Logo
                    </Button>
                  )}
                </div>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nama Toko</Label>
                <Input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="Warung Makan Barokah" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telepon</Label>
                <Input 
                  value={storePhone} 
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    if (val.length <= 12) {
                      setStorePhone(val);
                    }
                  }} 
                  type="tel" 
                  inputMode="numeric" 
                  placeholder="08xxxxxxxxxx" 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Alamat</Label>
              <Input value={storeAddr} onChange={e => setStoreAddr(e.target.value)} placeholder="Jl. Diponegoro No. 1" />
            </div>

            <Button className="w-full mt-4" onClick={saveStore} disabled={isSavingStore}>
              {isSavingStore ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</> : 'Simpan Info Toko'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PhotoCropModal
        open={!!cropFile}
        onOpenChange={(v) => { if (!v) setCropFile(null); }}
        file={cropFile}
        onCropped={async (dataUrl) => {
          setStoreLogo(dataUrl);
          setCropFile(null);

          try {
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const compressedDataUrl = await compressImage(blob, 0.5);
            const url = await dbUploadFile('storeSettings', `logo-${Date.now()}.jpg`, compressedDataUrl);
            if (url) {
              setStoreLogo(url);
            }
          } catch (e) {
            console.error("Store logo upload error", e);
          }
        }}
        disableCompression={true}
      />
      {/* Photo Lightbox */}
      {lightboxSrc && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/90 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={() => setLightboxSrc(null)}>
          <button className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors backdrop-blur-md border border-white/10" onClick={() => setLightboxSrc(null)}>
            <X className="w-5 h-5 text-white" />
          </button>
          <img src={lightboxSrc} alt="Preview" className="max-w-full max-h-[85dvh] rounded-2xl object-contain shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()} />
        </div>,
        document.body
      )}
    </div>
  );
}
