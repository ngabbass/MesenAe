import { useDbQuery, dbInsert, dbUpdate, dbDelete } from '@/hooks/db-hooks';
import { type Voucher, type Product } from '@/hooks/db-hooks';
import { useState } from 'react';
import { Plus, Ticket, Edit2, Trash2, Tag, Percent, ListFilter, Sparkles, Eye, EyeOff } from 'lucide-react';
import { RpIcon } from '@/components/ui/RpIcon';
import { usePermissions } from '@/hooks/use-permissions';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { FORMAT_IDR } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { VouchersSkeleton } from '@/admin/components/SkeletonLoaders';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
export default function Vouchers() {
  const { canEdit } = usePermissions();
  const hasEditAccess = canEdit('marketing');

  // --- Voucher States ---
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editVoucher, setEditVoucher] = useState<Voucher | null>(null);

  const [code, setCode] = useState('');
  const [type, setType] = useState<'percentage' | 'nominal'>('percentage');
  const [value, setValue] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [showInCustomerApp, setShowInCustomerApp] = useState(true);
  const [applicableProductIds, setApplicableProductIds] = useState<number[]>([]);

  // Queries
  const vouchers = useDbQuery<Voucher>('vouchers');
  const products = useDbQuery<Product>('products');

  // Loading state
  if (vouchers === undefined || products === undefined) {
    return <VouchersSkeleton />;
  }

  // --- Voucher Handlers ---
  const openAdd = () => {
    setEditVoucher(null);
    setCode('');
    setType('percentage');
    setValue('');
    setIsActive(true);
    setShowInCustomerApp(true);
    setApplicableProductIds([]);
    setDialogOpen(true);
  };

  const openEdit = (v: Voucher) => {
    setEditVoucher(v);
    setCode(v.code || '');
    setType((v.type as 'percentage' | 'nominal') || 'percentage');
    setValue(v.value !== undefined && v.value !== null ? v.value.toString() : '');
    setIsActive(v.isActive ?? true);
    setShowInCustomerApp(v.showInCustomerApp ?? true);
    setApplicableProductIds(v.applicableProductIds || []);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const cleanCode = (code || '').trim().toUpperCase();
    const cleanValue = Number(value) || 0;
    if (!cleanCode || !cleanValue) return;

    const data = {
      code: cleanCode,
      type,
      value: cleanValue,
      isActive,
      showInCustomerApp,
      applicableProductIds,
      validUntil: null,
      updatedAt: new Date().toISOString(),
    };

    try {
      if (editVoucher?.id) {
        await dbUpdate('vouchers', editVoucher.id, data);
        toast.success('Voucher berhasil diperbarui');
      } else {
        await dbInsert('vouchers', { ...data, createdAt: new Date().toISOString() } as Voucher);
        toast.success('Voucher baru berhasil dibuat');
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast.error('Gagal menyimpan voucher: ' + (err.message || err));
    }
  };

  const handleDelete = async () => {
    if (deleteId) {
      try {
        await dbDelete('vouchers', deleteId);
        toast.success('Voucher berhasil dihapus');
      } catch (err: any) {
        toast.error('Gagal menghapus voucher: ' + (err.message || err));
      } finally {
        setDeleteId(null);
      }
    }
  };

  return (
    <div className="pt- pb-24 space-y-6 w-full mx-auto animate-in fade-in duration-300">
      {/* Action Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Kelola Voucher</h2>
        {hasEditAccess && (
          <Button onClick={openAdd} className="h-11 px-5 rounded-xl font-bold bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20 active:scale-[0.98] transition-all shrink-0">
            <Plus className="w-5 h-5 mr-2" strokeWidth={3} />
            Buat Voucher
          </Button>
        )}
      </div>
      {!hasEditAccess && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 select-none">
          <span className="text-base shrink-0">🔒</span>
          <span><strong>Mode Lihat Saja:</strong> Anda tidak memiliki izin untuk mengelola voucher promo.</span>
        </div>
      )}

          {vouchers.length === 0 ? (
            <div className="bg-card border border-dashed border-border/60 rounded-[2rem] p-12 flex flex-col items-center justify-center text-center opacity-80 mt-6">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Ticket className="w-10 h-10 text-primary/50" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">Belum Ada Voucher</h3>
              <p className="text-sm text-muted-foreground max-w-sm">Anda belum membuat kode promo apapun. Mulai buat sekarang untuk memberi kejutan ke pelanggan.</p>
              <Button variant="outline" className="mt-6 rounded-xl border-primary/20 text-primary hover:bg-primary/10 font-bold" onClick={openAdd}>
                <Plus className="w-4 h-4 mr-2" /> Buat Voucher Pertama
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
              {vouchers.map((v, idx) => (
                <Card key={v.id} className={cn(
                  "group relative overflow-hidden border-0 shadow-md hover:shadow-xl hover:border-primary/40 transition-all duration-300 rounded-[1.5rem] flex flex-col",
                  v.isActive 
                    ? "bg-gradient-to-br from-card via-card to-primary/5 dark:from-card dark:to-primary/10 ring-1 ring-primary/20" 
                    : "bg-muted opacity-70 grayscale-[0.4] ring-1 ring-border/50"
                )}>
                  
                  {/* Efek Garis Putus-putus Khas Tiket */}
                  <div className="absolute left-[30%] sm:left-[25%] top-0 bottom-0 border-l-2 border-dashed border-primary/20 dark:border-primary/30 z-10" />
                  <div className="absolute left-[30%] sm:left-[25%] top-[-10px] w-5 h-5 bg-background rounded-full border-b-2 border-primary/20 dark:border-primary/30 z-10 -translate-x-1/2 shadow-inner" />
                  <div className="absolute left-[30%] sm:left-[25%] bottom-[-10px] w-5 h-5 bg-background rounded-full border-t-2 border-primary/20 dark:border-primary/30 z-10 -translate-x-1/2 shadow-inner" />



                  {/* Shine Effect */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[100%] group-hover:animate-shimmer z-0 pointer-events-none" />

                  <div className="flex h-full relative z-20">
                    
                    <div className={cn(
                      "w-[30%] sm:w-[25%] flex flex-col items-center justify-center p-4 relative overflow-hidden",
                      v.isActive 
                        ? (idx % 2 === 0 ? "bg-gradient-to-br from-primary via-primary/90 to-primary/80" : "bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600") + " text-white shadow-[inset_0_0_20px_rgba(0,0,0,0.2)]" 
                        : "bg-muted-foreground/20 text-muted-foreground"
                    )}>
                      {v.isActive && (
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
                      )}
                      {v.type === 'percentage' ? (
                        <Percent className="w-8 h-8 mb-1 opacity-50" strokeWidth={2} />
                      ) : (
                        <RpIcon className="w-8 h-8 mb-1 opacity-50" strokeWidth={2} />
                      )}
                      <h4 className="text-2xl font-black tracking-tighter text-center leading-none">
                        {v.type === 'percentage' ? `${v.value ?? 0}%` : FORMAT_IDR(v.value ?? 0).replace('Rp', '')}
                      </h4>
                      <span className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70">Diskon</span>
                    </div>

                    {/* Bagian Kanan Tiket (Detail & Aksi) */}
                    <div className="flex-1 p-5 pl-8 pr-5 flex flex-col relative z-20">
                      <div className="flex justify-between items-start gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <Badge variant="outline" className={cn(
                              "text-[9px] uppercase tracking-widest font-black px-1.5 py-0 border-none shadow-none",
                              v.isActive ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
                            )}>
                              {v.isActive ? 'Aktif' : 'Nonaktif'}
                            </Badge>
                            <Badge variant="outline" className={cn(
                              "text-[9px] uppercase tracking-widest font-black px-1.5 py-0 border-none shadow-none",
                              (v.showInCustomerApp ?? true) ? "bg-blue-500/10 text-blue-600" : "bg-amber-500/10 text-amber-600"
                            )}>
                              {(v.showInCustomerApp ?? true) ? 'Tampil di Menu' : 'Sembunyi di Menu'}
                            </Badge>
                          </div>
                          <h3 className="font-extrabold text-2xl font-mono tracking-widest text-foreground truncate">{v.code || '-'}</h3>
                          
                          {v.applicableProductIds && v.applicableProductIds.length > 0 ? (
                            <p className="text-[11px] font-medium text-muted-foreground mt-2 flex items-center gap-1.5">
                              <ListFilter className="w-3.5 h-3.5" /> Berlaku untuk {v.applicableProductIds.length} produk pilihan
                            </p>
                          ) : (
                            <p className="text-[11px] font-medium text-muted-foreground mt-2 flex items-center gap-1.5">
                              <Tag className="w-3.5 h-3.5" /> Berlaku untuk semua produk
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-auto pt-4 flex items-center justify-between border-t border-border/30">
                        {/* Toggles on the left */}
                        <div className="flex items-center gap-2.5">
                          {/* Toggle Aktif */}
                          <div className="flex items-center gap-1.5">
                            <Switch 
                              checked={v.isActive} 
                              disabled={!hasEditAccess}
                              onCheckedChange={async (checked) => {
                                try {
                                  await dbUpdate('vouchers', v.id!, { isActive: checked });
                                  toast.success(`Voucher ${v.code} ${checked ? 'diaktifkan' : 'dinonaktifkan'}`);
                                } catch (err: any) {
                                  toast.error('Gagal memperbarui status: ' + (err.message || err));
                                }
                              }}
                              className="data-[state=checked]:bg-primary scale-75 origin-left animate-none"
                            />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                              Aktif
                            </span>
                          </div>

                          {/* Divider */}
                          <div className="w-[1px] h-4 bg-border/60" />

                          {/* Tampilkan Eye Icon Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!hasEditAccess}
                            onClick={async () => {
                              try {
                                const nextVal = !(v.showInCustomerApp ?? true);
                                await dbUpdate('vouchers', v.id!, { showInCustomerApp: nextVal });
                                toast.success(`Voucher ${v.code} ${nextVal ? 'ditampilkan' : 'disembunyikan'} di aplikasi pelanggan`);
                              } catch (err: any) {
                                toast.error('Gagal memperbarui tampilan: ' + (err.message || err));
                              }
                            }}
                            className={cn(
                              "h-8 w-8 rounded-lg transition-all shrink-0",
                              (v.showInCustomerApp ?? true)
                                ? "text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                                : "text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                            )}
                            title={(v.showInCustomerApp ?? true) ? "Ditampilkan di Aplikasi Pelanggan" : "Disembunyikan dari Aplikasi Pelanggan"}
                          >
                            {(v.showInCustomerApp ?? true) ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </Button>
                        </div>
 
                        {/* Edit and Delete Buttons on the right ("mepet kanan") */}
                        {hasEditAccess && (
                          <div className="flex gap-2">
                            <Button variant="secondary" size="icon" className="h-8 w-8 rounded-lg shadow-sm hover:bg-primary hover:text-white transition-colors" onClick={() => openEdit(v)}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="secondary" size="icon" className="h-8 w-8 rounded-lg shadow-sm hover:bg-destructive hover:text-white transition-colors" onClick={() => setDeleteId(v.id!)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

      {/* ==========================================
          MODALS & DIALOGS
          ========================================== */}

      {/* Modal Add/Edit Voucher */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[92vw] sm:max-w-[600px] max-h-[90vh] rounded-[1.5rem] md:rounded-[2rem] p-0 overflow-hidden border-border/60 shadow-2xl flex flex-col">
          <DialogHeader className="px-6 py-5 border-b border-border/50 bg-muted/10 shrink-0">
            <DialogTitle className="text-xl font-extrabold flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                {editVoucher ? <Edit2 className="w-5 h-5" /> : <Ticket className="w-5 h-5" strokeWidth={2.5} />}
              </div>
              {editVoucher ? 'Edit Voucher' : 'Buat Voucher Baru'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-5">
            <div className="space-y-2 group">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Kode Promo <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                  value={code} 
                  onChange={e => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))} 
                  placeholder="Contoh: MERDEKA50" 
                  className="h-12 pl-10 uppercase font-mono font-bold tracking-widest bg-background rounded-xl focus-visible:ring-1 focus-visible:ring-primary" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tipe Diskon <span className="text-destructive">*</span></Label>
                <Select value={type} onValueChange={(val: 'percentage' | 'nominal') => setType(val)}>
                  <SelectTrigger className="h-12 bg-background rounded-xl font-semibold focus:ring-1 focus:ring-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="percentage" className="font-medium">Persentase (%)</SelectItem>
                    <SelectItem value="nominal" className="font-medium">Nominal (Rp)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 group">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nilai Diskon <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground group-focus-within:text-primary transition-colors">
                    {type === 'nominal' ? 'Rp' : '%'}
                  </span>
                  <Input 
                    type="number" 
                    value={value} 
                    onChange={e => setValue(e.target.value)} 
                    placeholder={type === 'percentage' ? "10" : "10000"} 
                    className="h-12 pl-9 bg-background rounded-xl font-mono text-base focus-visible:ring-1 focus-visible:ring-primary" 
                  />
                </div>
              </div>
            </div>


            
            <div className="space-y-2">
              <div className="flex justify-between items-end mb-1">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Produk Spesifik</Label>
                <span className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded text-muted-foreground">Opsional</span>
              </div>
              <div className="border border-border/60 rounded-xl p-2 max-h-[160px] overflow-y-auto custom-scrollbar bg-background/50 space-y-1">
                {products.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 text-center">Belum ada produk di database.</p>
                ) : (
                  products.map((p) => {
                    const isChecked = applicableProductIds.includes(p.id!);
                    return (
                      <label 
                        key={p.id} 
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors border border-transparent",
                          isChecked ? "bg-primary/5 border-primary/20" : "hover:bg-muted"
                        )}
                      >
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setApplicableProductIds([...applicableProductIds, p.id!]);
                            else setApplicableProductIds(applicableProductIds.filter(id => id !== p.id));
                          }}
                          className="w-4 h-4 rounded-md border-muted-foreground/50 text-primary focus:ring-primary"
                        />
                        <span className={cn("text-sm flex-1 truncate select-none", isChecked ? "font-bold text-primary" : "font-medium text-foreground")}>
                          {p.name}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              <p className="text-[10px] text-muted-foreground font-medium">Jika tidak ada yang dipilih, voucher berlaku untuk total tagihan seluruh produk.</p>
            </div>


          </div>
          
          <DialogFooter className="px-6 py-4 border-t border-border/50 bg-muted/10 gap-2 sm:gap-0 shrink-0">
            <Button variant="outline" className="h-11 rounded-xl font-bold border-border/60 hover:bg-muted" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button className="h-11 rounded-xl font-bold bg-primary hover:bg-primary/90 text-white shadow-md active:scale-[0.98] transition-all px-8" onClick={handleSave} disabled={!code || !code.trim() || !value}>
              {editVoucher ? 'Simpan Perubahan' : 'Terbitkan Voucher'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Voucher Modal */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="max-w-[400px] rounded-2xl p-6">
          <AlertDialogHeader>
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2 mx-auto">
              <Trash2 className="w-6 h-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center text-xl font-extrabold">Hapus Voucher?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Voucher promo ini akan dihapus secara permanen dan tidak dapat digunakan lagi oleh pelanggan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 sm:justify-center flex-row gap-3">
            <AlertDialogCancel className="flex-1 mt-0 rounded-xl h-11 font-bold">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="flex-1 rounded-xl h-11 font-bold bg-destructive hover:bg-destructive/90 text-white shadow-md shadow-destructive/20">
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.3); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(156, 163, 175, 0.5); }
      `}} />
    </div>
  );
}
