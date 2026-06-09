import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';
import { 
  ArrowDownToLine, 
  Plus, 
  ChevronLeft, 
  Layers, 
  Calendar, 
  User, 
  FileText,
  Search
} from 'lucide-react';

import { useDbQuery, dbInsert, dbUpdate, dbDelete } from '@/hooks/db-hooks';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function StockInPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { canEdit } = usePermissions();
  const hasEditAccess = canEdit('stockIn');

  const [selectedStockIn, setSelectedStockIn] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form States
  const [productId, setProductId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [notes, setNotes] = useState('');
  
  // Filter States
  const [filterSupplier, setFilterSupplier] = useState('all');
  const [search, setSearch] = useState('');

  // Database Hooks
  const stockIns = useDbQuery<any>('stockIns') || [];
  const products = useDbQuery<any>('products') || [];
  const suppliers = useDbQuery<any>('suppliers') || [];

  // Filter Data
  const getProductName = (pid: number | string) => products.find((p: any) => String(p.id) === String(pid))?.name ?? 'Produk Tidak Diketahui';
  const getSupplierName = (sid: number | string) => suppliers.find((s: any) => String(s.id) === String(sid))?.name ?? 'Supplier Tidak Diketahui';

  const filteredStockIns = stockIns.filter((si: any) => {
    const matchesSupplier = filterSupplier === 'all' || String(si.supplierId) === String(filterSupplier);
    const prodName = getProductName(si.productId).toLowerCase();
    const notesMatch = si.notes ? si.notes.toLowerCase().includes(search.toLowerCase()) : false;
    const matchesSearch = prodName.includes(search.toLowerCase()) || notesMatch;
    return matchesSupplier && matchesSearch;
  }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());


  const openAdd = () => {
    setProductId('');
    setSupplierId('');
    setQuantity('');
    setBuyPrice('');
    setNotes('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak. Anda tidak memiliki izin untuk mengelola stok.');
      return;
    }
    const qty = Number(quantity);
    const price = Number(buyPrice);

    if (!productId || !supplierId || qty <= 0 || price <= 0) {
      toast.error('Mohon lengkapi semua field dengan benar');
      return;
    }

    const selectedProduct = productId;
    const selectedSupplier = supplierId;
    const product = products.find((p: any) => String(p.id) === String(selectedProduct));
    
    if (!product) {
      toast.error('Produk tidak ditemukan');
      return;
    }

    try {
      setIsSubmitting(true);
      const total = qty * price;

      // 1. Catat ke tabel stockIns
      await dbInsert('stockIns', {
        productId: selectedProduct,
        supplierId: selectedSupplier || '',
        quantity: qty,
        buyPrice: price,
        totalPrice: total,
        date: new Date().toISOString(),
        notes: notes.trim(),
      });

      // 2. Hitung HPP Baru menggunakan Average Cost (Weighted Average)
      const oldStock = product.stock || 0;
      const oldHpp = product.hpp || 0;
      const newStock = oldStock + qty;
      const newHpp = ((oldStock * oldHpp) + total) / newStock;

      // 3. Catat riwayat perubahan HPP
      await dbInsert('hppHistory', {
        productId: selectedProduct,
        oldHpp,
        newHpp,
        source: 'stock_in',
        date: new Date().toISOString(),
      });

      // 4. Perbarui data stok dan nilai HPP pada tabel produk
      await dbUpdate('products', selectedProduct, {
        stock: newStock,
        hpp: Math.round(newHpp),
        updatedAt: new Date().toISOString(),
      });

      toast.success(`Stok ${product.name} bertambah ${qty}. HPP diperbarui menjadi Rp ${Math.round(newHpp).toLocaleString('id-ID')}`);
      setDialogOpen(false);
    } catch (error: any) {
      console.error(error);
      toast.error('Gagal menyimpan data stock in: ' + (error.message || error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 w-full animate-in fade-in duration-300">
      {!hasEditAccess && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 select-none">
          <span className="text-base shrink-0">🔒</span>
          <span><strong>Mode Lihat Saja:</strong> Anda tidak memiliki izin untuk mengelola stok masuk.</span>
        </div>
      )}

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-extrabold text-foreground uppercase tracking-wider">Stok Masuk</h2>
          <p className="text-[10px] text-muted-foreground font-semibold">
            Kelola data dan riwayat stok masuk dari supplier
          </p>
        </div>
        {hasEditAccess && (
          <Button size="sm" onClick={openAdd} className="h-9 gap-1.5 shrink-0 rounded-xl font-bold shadow-sm">
            <Plus className="w-4 h-4" /> Tambah Stok
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
          <Select value={filterSupplier} onValueChange={setFilterSupplier}>
            <SelectTrigger className="h-10 rounded-xl bg-background border-border/70 shadow-sm">
              <SelectValue placeholder="Semua Supplier" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Semua Supplier</SelectItem>
              {suppliers.map((s: any) => (
                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground font-semibold pl-1">
        Menampilkan <span className="text-foreground">{filteredStockIns.length}</span> dari <span className="text-foreground">{stockIns.length}</span> riwayat catatan
      </div>

      {/* Daftar Riwayat Stock In */}
      {filteredStockIns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-card/40 border border-dashed border-border/60 rounded-2xl">
          <div className="bg-muted p-4 rounded-full mb-3">
            <ArrowDownToLine className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-sm font-medium text-foreground">Belum ada riwayat</h3>
          <p className="text-xs text-muted-foreground max-w-xs mt-1">Seluruh data pemasukan stok barang dari supplier akan terdaftar di sini.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStockIns.map((si: any) => (
            <Card key={si.id} onClick={() => { setSelectedStockIn(si); setDetailOpen(true); }} className="border-0 shadow-sm hover:shadow hover:bg-muted/10 transition-all duration-200 rounded-2xl overflow-hidden bg-card cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground truncate">{getProductName(si.productId)}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">Supplier: {getSupplierName(si.supplierId)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2 pt-1">
                      <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded-md">
                        +{si.quantity} Unit
                      </span>
                      <span className="text-xs text-muted-foreground">
                        @ Rp {si.buyPrice.toLocaleString('id-ID')}
                      </span>
                    </div>

                    {si.notes && (
                      <div className="flex items-start gap-1 mt-2 text-xs text-muted-foreground bg-muted/40 p-2 rounded-lg italic border border-border/30">
                        <FileText className="w-3.5 h-3.5 mt-0.5 text-muted-foreground/60 flex-shrink-0" />
                        <span className="line-clamp-2">"{si.notes}"</span>
                      </div>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0 flex flex-col justify-between h-full min-h-[70px]">
                    <div className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(si.date), 'dd MMM yyyy', { locale: id })}
                    </div>
                    <div className="mt-auto">
                      <p className="text-xs text-muted-foreground font-medium">Total Harga</p>
                      <p className="text-sm font-extrabold text-foreground tracking-tight">
                        Rp {si.totalPrice.toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Form Tambah Stok */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[92vw] sm:max-w-md max-h-[90vh] rounded-2xl p-0 overflow-hidden flex flex-col border-border/60 shadow-2xl">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/50 bg-muted/10 shrink-0">
            <DialogTitle className="text-lg font-bold">Tambah Stok Masuk</DialogTitle>
            <DialogDescription className="text-xs">
              Masukkan detail pembelian barang untuk menambah stok gudang dan memperbarui acuan nilai HPP.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
            {/* Pilihan Produk */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Pilih Produk <span className="text-destructive">*</span></Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="h-11 rounded-xl bg-background border-border/70">
                  <SelectValue placeholder="Pilih item barang" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {products.map((p: any) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name} <span className="text-xs text-muted-foreground">(Sisa: {p.stock ?? 0})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pilihan Supplier */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Supplier <span className="text-destructive">*</span></Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="h-11 rounded-xl bg-background border-border/70">
                  <SelectValue placeholder="Pilih nama supplier" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {suppliers.map((s: any) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Grid Input Kuantitas & Harga */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Jumlah Masuk <span className="text-destructive">*</span></Label>
                <Input 
                  type="number" 
                  min="1"
                  value={quantity} 
                  onChange={e => setQuantity(e.target.value)} 
                  placeholder="Contoh: 50" 
                  className="h-11 rounded-xl bg-background border-border/70" 
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Harga Beli / Unit <span className="text-destructive">*</span></Label>
                <Input 
                  type="number" 
                  min="0"
                  value={buyPrice} 
                  onChange={e => setBuyPrice(e.target.value)} 
                  placeholder="Rp" 
                  className="h-11 rounded-xl bg-background border-border/70" 
                />
              </div>
            </div>

            {/* Preview Akumulasi Angka Total */}
            {Number(quantity) > 0 && Number(buyPrice) > 0 && (
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-3 rounded-xl flex items-center justify-between text-xs transition-all duration-200">
                <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-500" /> Total Pengeluaran:
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  Rp {(Number(quantity) * Number(buyPrice)).toLocaleString('id-ID')}
                </span>
              </div>
            )}

            {/* Kolom Catatan Opsional */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Catatan Tambahan</Label>
              <Input 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                placeholder="No. Invoice / Keterangan (Opsional)" 
                className="h-11 rounded-xl bg-background border-border/70" 
              />
            </div>

            {/* Tombol Simpan */}
            <Button 
              className="w-full h-12 text-sm font-semibold rounded-xl shadow-md transition-all mt-2" 
              onClick={handleSave}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Menyimpan Data...' : 'Konfirmasi & Simpan Stok'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Detail Stok Masuk */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-[92vw] sm:max-w-md max-h-[90vh] rounded-2xl p-0 overflow-hidden flex flex-col border border-border/60 shadow-2xl">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/50 bg-muted/10 shrink-0">
            <DialogTitle className="text-lg font-bold">Detail Stok Masuk</DialogTitle>
          </DialogHeader>
          
          {selectedStockIn && (
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="space-y-3.5">
                <div>
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">Nama Produk</Label>
                  <p className="text-sm font-bold text-foreground mt-0.5">{getProductName(selectedStockIn.productId)}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-3">
                  <div>
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Supplier</Label>
                    <p className="text-xs font-semibold text-foreground mt-0.5">{getSupplierName(selectedStockIn.supplierId)}</p>
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Tanggal Masuk</Label>
                    <p className="text-xs font-semibold text-foreground mt-0.5">
                      {format(new Date(selectedStockIn.date), 'dd MMMM yyyy HH:mm', { locale: id })}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 border-t border-border/40 pt-3">
                  <div>
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Jumlah</Label>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">+{selectedStockIn.quantity} Unit</p>
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Harga Beli</Label>
                    <p className="text-sm font-semibold text-foreground mt-0.5">Rp {selectedStockIn.buyPrice.toLocaleString('id-ID')}</p>
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Total</Label>
                    <p className="text-sm font-bold text-foreground mt-0.5">Rp {selectedStockIn.totalPrice.toLocaleString('id-ID')}</p>
                  </div>
                </div>

                {selectedStockIn.notes && (
                  <div className="border-t border-border/40 pt-3">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Catatan</Label>
                    <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl italic border border-border/30 mt-1">
                      "{selectedStockIn.notes}"
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
                      if (window.confirm(`Hapus catatan stok masuk ini? Tindakan ini akan mengurangi stok produk sebanyak ${selectedStockIn.quantity} unit.`)) {
                        try {
                          setIsDeleting(true);
                          const prod = products.find((p: any) => String(p.id) === String(selectedStockIn.productId));
                          if (prod) {
                            const newStock = Math.max(0, (prod.stock || 0) - selectedStockIn.quantity);
                            await dbUpdate('products', prod.id, { stock: newStock });
                          }
                          await dbDelete('stockIns', selectedStockIn.id);
                          toast.success('Catatan stok masuk berhasil dihapus');
                          setDetailOpen(false);
                          setSelectedStockIn(null);
                        } catch (err: any) {
                          toast.error('Gagal menghapus catatan stok masuk: ' + (err.message || err));
                        } finally {
                          setIsDeleting(false);
                        }
                      }
                    }}
                    disabled={isDeleting}
                  >
                    Hapus Catatan Stok Masuk
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
