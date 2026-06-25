import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';
import { 
  ArrowUpFromLine, 
  Plus, 
  ChevronLeft, 
  AlertTriangle, 
  Calendar, 
  Tag, 
  FileText,
  Boxes,
  Search
} from 'lucide-react';

import { useDbQuery, dbInsert, dbUpdate, dbDelete } from '@/hooks/db-hooks';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const REASONS = ['Rusak', 'Hilang', 'Kadaluarsa', 'Retur ke Supplier', 'Pemakaian Sendiri', 'Lainnya'];

export default function StockOutPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { canEdit } = usePermissions();
  const hasEditAccess = canEdit('stockOut');

  const [selectedStockOut, setSelectedStockOut] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Form States
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  // Filter States
  const [search, setSearch] = useState('');
  const [filterReason, setFilterReason] = useState('all');

  // Database Hooks
  const stockOuts = useDbQuery<any>('stockOuts') || [];
  const products = useDbQuery<any>('products') || [];

  const getProductName = (pid: number | string) => products.find((p: any) => String(p.id) === String(pid))?.name ?? 'Produk Tidak Diketahui';

  // Mengurutkan riwayat dari yang terbaru dan melakukan pencarian/filter
  const sortedStockOuts = stockOuts.filter((so: any) => {
    const matchesReason = filterReason === 'all' || so.reason === filterReason;
    const prodName = getProductName(so.productId).toLowerCase();
    const reasonText = so.reason.toLowerCase();
    const notesMatch = so.notes ? so.notes.toLowerCase().includes(search.toLowerCase()) : false;
    const matchesSearch = prodName.includes(search.toLowerCase()) || reasonText.includes(search.toLowerCase()) || notesMatch;
    return matchesReason && matchesSearch;
  }).sort(
    (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const selectedProduct = products.find((p: any) => String(p.id) === String(productId));

  const openAdd = () => {
    setProductId('');
    setQuantity('');
    setReason('');
    setNotes('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak. Anda tidak memiliki izin untuk mengelola stok.');
      return;
    }
    const qty = Number(quantity);
    
    if (!productId || qty <= 0 || !reason) {
      toast.error('Mohon lengkapi semua field utama');
      return;
    }

    const product = products.find((p: any) => String(p.id) === String(productId));
    if (!product) {
      toast.error('Produk tidak ditemukan');
      return;
    }

    if (qty > product.stock) {
      toast.error(`Jumlah pengeluaran (${qty}) melebihi stok yang tersedia (${product.stock})`);
      return;
    }

    try {
      setIsSubmitting(true);

      // 1. Catat transaksi pengurangan stok
      await dbInsert('stockOuts', {
        productId: productId,
        quantity: qty,
        reason,
        date: new Date().toISOString(),
        notes: notes.trim(),
      });

      // 2. Potong jumlah stok produk utama
      await dbUpdate('products', product.id, {
        stock: product.stock - qty,
        updatedAt: new Date().toISOString(),
      });

      toast.success(`Stok ${product.name} berhasil dikurangi sebanyak ${qty}`);
      setDialogOpen(false);
    } catch (error: any) {
      console.error(error);
      toast.error('Gagal memproses penyesuaian stok: ' + (error.message || error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 w-full animate-in fade-in duration-300">
      {!hasEditAccess && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 select-none">
          <span className="text-base shrink-0">🔒</span>
          <span><strong>Mode Lihat Saja:</strong> Anda tidak memiliki izin untuk mengelola stok keluar.</span>
        </div>
      )}

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-extrabold text-foreground uppercase tracking-wider">Stok Keluar</h2>
          <p className="text-[10px] text-muted-foreground font-semibold">
            Kelola data dan riwayat penyesuaian stok keluar
          </p>
        </div>
        {hasEditAccess && (
          <Button size="sm" onClick={openAdd} className="h-9 gap-1.5 shrink-0 rounded-xl font-bold shadow-sm bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            <Plus className="w-4 h-4" /> Catat Pengurangan
          </Button>
        )}
      </div>

      {/* Kontrol & Filter */}
      <div className="bg-card/50 border border-border/40 p-3 rounded-2xl shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Cari nama produk atau keterangan..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-10 h-10 rounded-xl bg-background border-border/70 shadow-sm"
          />
        </div>
        <div className="w-full sm:w-56 shrink-0">
          <Select value={filterReason} onValueChange={setFilterReason}>
            <SelectTrigger className="h-10 rounded-xl bg-background border-border/70 shadow-sm">
              <SelectValue placeholder="Semua Alasan" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Semua Alasan</SelectItem>
              {REASONS.map(r => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground font-semibold pl-1">
        Menampilkan <span className="text-foreground">{sortedStockOuts.length}</span> dari <span className="text-foreground">{stockOuts.length}</span> riwayat catatan
      </div>

      {/* Render Daftar Riwayat Catatan */}
      {sortedStockOuts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-card/40 border border-dashed border-border/60 rounded-2xl">
          <div className="bg-muted p-4 rounded-full mb-3">
            <ArrowUpFromLine className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-sm font-medium text-foreground">Tidak ada riwayat stok keluar</h3>
          <p className="text-xs text-muted-foreground max-w-xs mt-1">Seluruh log pembuangan barang cacat, kadaluarsa, atau barang hilang akan muncul di sini.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedStockOuts.map((so: any) => (
            <Card key={so.id} onClick={() => { setSelectedStockOut(so); setDetailOpen(true); }} className="border-0 shadow-sm hover:shadow hover:bg-muted/10 transition-all duration-200 rounded-2xl overflow-hidden bg-card cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground truncate">{getProductName(so.productId)}</h3>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[11px] font-bold bg-destructive/10 text-destructive dark:bg-destructive/95 dark:text-destructive-foreground px-2 py-0.5 rounded-md">
                        -{so.quantity} Unit
                      </span>
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 bg-muted px-2 py-0.5 rounded-md">
                        <Tag className="w-3 h-3" /> {so.reason}
                      </span>
                    </div>

                    {so.notes && (
                      <div className="flex items-start gap-1 mt-2.5 text-xs text-muted-foreground bg-muted/40 p-2 rounded-lg italic border border-border/30">
                        <FileText className="w-3.5 h-3.5 mt-0.5 text-muted-foreground/60 flex-shrink-0" />
                        <span className="line-clamp-2">"{so.notes}"</span>
                      </div>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0 flex flex-col justify-between items-end h-full">
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(so.date), 'dd MMM yyyy', { locale: id })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Form Stock Out */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[92vw] sm:max-w-md max-h-[90vh] rounded-2xl p-0 overflow-hidden flex flex-col border border-border/60 shadow-2xl">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/50 bg-muted/10 shrink-0">
            <DialogTitle className="text-lg font-bold flex items-center gap-1.5">
              <ArrowUpFromLine className="w-5 h-5 text-destructive" /> Catat Stok Keluar
            </DialogTitle>
            <DialogDescription className="text-xs">
              Kurangi kuantitas persediaan barang secara manual disertai dengan alasan operasional yang jelas.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
            {/* Input Pemilihan Produk */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Pilih Produk <span className="text-destructive">*</span></Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="h-11 rounded-xl bg-background border-border/70">
                  <SelectValue placeholder="Pilih produk penyesuaian" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {products.filter((p: any) => p.stock > 0).map((p: any) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name} <span className="text-xs text-muted-foreground">(Stok: {p.stock})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Grid Jumlah & Alasan */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Jumlah Keluar <span className="text-destructive">*</span></Label>
                <Input 
                  type="number" 
                  min="1"
                  max={selectedProduct?.stock}
                  value={quantity} 
                  onChange={e => setQuantity(e.target.value)} 
                  placeholder="0" 
                  className="h-11 rounded-xl bg-background border-border/70" 
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Alasan Pengurangan <span className="text-destructive">*</span></Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="h-11 rounded-xl bg-background border-border/70">
                    <SelectValue placeholder="Pilih alasan" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {REASONS.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Estimasi Sisa Persediaan */}
            {selectedProduct && quantity && (
              <div className={`p-3 rounded-xl flex items-center justify-between text-xs transition-all border ${
                (selectedProduct.stock - Number(quantity)) <= 0 
                  ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30 text-amber-700 dark:text-amber-400' 
                  : 'bg-muted/60 border-border/40 text-muted-foreground'
              }`}>
                <span className="font-medium flex items-center gap-1.5">
                  {(selectedProduct.stock - Number(quantity)) <= 0 ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  ) : (
                    <Boxes className="w-3.5 h-3.5 text-foreground/60" />
                  )}
                  Estimasi Sisa Stok:
                </span>
                <span className="font-bold text-foreground text-sm">
                  {selectedProduct.stock - Number(quantity)} {selectedProduct.unit || 'Unit'}
                </span>
              </div>
            )}

            {/* Kolom Keterangan / Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Keterangan Tambahan</Label>
              <Input 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                placeholder="Lokasi kejadian / nama pemeriksa (Opsional)" 
                className="h-11 rounded-xl bg-background border-border/70" 
              />
            </div>

            {/* Tombol Eksekusi Submit */}
            <Button 
              variant="destructive"
              className="w-full h-12 text-sm font-semibold rounded-xl shadow-md transition-all mt-2" 
              onClick={handleSave}
              disabled={isSubmitting || (selectedProduct && (selectedProduct.stock - Number(quantity) < 0))}
            >
              {isSubmitting ? 'Memproses Data...' : 'Konfirmasi & Kurangi Stok'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Detail Stok Keluar */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-[92vw] sm:max-w-md max-h-[90vh] rounded-2xl p-0 overflow-hidden flex flex-col border border-border/60 shadow-2xl">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/50 bg-muted/10 shrink-0">
            <DialogTitle className="text-lg font-bold flex items-center gap-1.5 text-destructive">
              <ArrowUpFromLine className="w-5 h-5 text-destructive" /> Detail Stok Keluar
            </DialogTitle>
          </DialogHeader>
          
          {selectedStockOut && (
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="space-y-3.5">
                <div>
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">Nama Produk</Label>
                  <p className="text-sm font-bold text-foreground mt-0.5">{getProductName(selectedStockOut.productId)}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-3">
                  <div>
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Alasan Pengurangan</Label>
                    <p className="text-xs font-semibold text-foreground mt-0.5 flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5" /> {selectedStockOut.reason}
                    </p>
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Tanggal Keluar</Label>
                    <p className="text-xs font-semibold text-foreground mt-0.5">
                      {format(new Date(selectedStockOut.date), 'dd MMMM yyyy HH:mm', { locale: id })}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-3">
                  <div>
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Jumlah Keluar</Label>
                    <p className="text-sm font-bold text-destructive mt-0.5">-{selectedStockOut.quantity} Unit</p>
                  </div>
                </div>

                {selectedStockOut.notes && (
                  <div className="border-t border-border/40 pt-3">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Keterangan</Label>
                    <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl italic border border-border/30 mt-1">
                      "{selectedStockOut.notes}"
                    </p>
                  </div>
                )}
              </div>

              {hasEditAccess && (
                <div className="border-t border-border/40 pt-4 flex gap-3 mt-4">
                  <Button 
                    variant="destructive"
                    className="w-full h-11 text-xs font-bold tracking-wide rounded-xl shadow-md transition-all active:scale-95 gap-2"
                    onClick={async () => {
                      if (window.confirm(`Hapus catatan stok keluar ini? Tindakan ini akan mengembalikan stok produk sebanyak ${selectedStockOut.quantity} unit.`)) {
                        try {
                          setIsDeleting(true);
                          const prod = products.find((p: any) => String(p.id) === String(selectedStockOut.productId));
                          if (prod) {
                            const newStock = (prod.stock || 0) + selectedStockOut.quantity;
                            await dbUpdate('products', prod.id, { stock: newStock });
                          }
                          await dbDelete('stockOuts', selectedStockOut.id);
                          toast.success('Catatan stok keluar berhasil dihapus');
                          setDetailOpen(false);
                          setSelectedStockOut(null);
                        } catch (err: any) {
                          toast.error('Gagal menghapus catatan stok keluar: ' + (err.message || err));
                        } finally {
                          setIsDeleting(false);
                        }
                      }
                    }}
                    disabled={isDeleting}
                  >
                    Hapus Catatan Stok Keluar
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
