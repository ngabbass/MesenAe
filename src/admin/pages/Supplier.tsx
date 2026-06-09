import React, { useState } from 'react';
import { 
  Truck, 
  Plus, 
  Edit2, 
  Trash2, 
  Phone, 
  MapPin, 
  Search, 
  FileText, 
  NotebookTabs 
} from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';

import { useDbQuery, dbInsert, dbUpdate, dbDelete } from '@/hooks/db-hooks';
import { type Supplier } from '@/hooks/db-hooks';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';

export default function SupplierPage() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);

  // Form States
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Database Hooks
  const suppliers = useDbQuery<Supplier>('suppliers') || [];

  const { canEdit } = usePermissions();
  const hasEditAccess = canEdit('suppliers');

  // Filter pencarian supplier dinamis (Nama & No Telepon)
  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone && s.phone.includes(search))
  );

  const openAdd = () => {
    setEditSupplier(null);
    setName('');
    setPhone('');
    setAddress('');
    setNotes('');
    setDialogOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditSupplier(s);
    setName(s.name);
    setPhone(s.phone || '');
    setAddress(s.address || '');
    setNotes(s.notes || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak. Anda tidak memiliki izin untuk mengelola supplier.');
      return;
    }
    if (!name.trim()) {
      toast.error('Nama supplier wajib diisi');
      return;
    }

    const data = { 
      name: name.trim(), 
      phone: phone.trim(), 
      address: address.trim(), 
      notes: notes.trim() 
    };

    try {
      setIsSubmitting(true);
      if (editSupplier?.id) {
        await dbUpdate('suppliers', editSupplier.id, data);
        toast.success(`Data supplier "${data.name}" berhasil diperbarui`);
      } else {
        await dbInsert('suppliers', { ...data, createdAt: new Date().toISOString() });
        toast.success(`Supplier "${data.name}" berhasil ditambahkan`);
      }
      setDialogOpen(false);
    } catch (error: any) {
      console.error(error);
      toast.error('Gagal menyimpan data supplier: ' + (error.message || error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak. Anda tidak memiliki izin untuk mengelola supplier.');
      return;
    }
    if (!deleteId) return;

    try {
      await dbDelete('suppliers', deleteId);
      toast.success('Supplier berhasil dihapus dari sistem');
    } catch (error: any) {
      console.error(error);
      toast.error('Gagal menghapus data supplier: ' + (error.message || error));
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4 w-full animate-in fade-in duration-300">
      {!hasEditAccess && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 select-none">
          <span className="text-base shrink-0">🔒</span>
          <span><strong>Mode Lihat Saja:</strong> Anda tidak memiliki izin untuk mengelola supplier.</span>
        </div>
      )}

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-extrabold text-foreground uppercase tracking-wider">Daftar Supplier</h2>
          <p className="text-[10px] text-muted-foreground font-semibold">
            Manajemen kemitraan dan data pemasok bahan baku
          </p>
        </div>
        {hasEditAccess && (
          <Button size="sm" onClick={openAdd} className="h-9 gap-1.5 shrink-0 rounded-xl font-bold shadow-sm">
            <Plus className="w-4 h-4" /> Tambah Supplier
          </Button>
        )}
      </div>

      {/* Kolom Input Pencarian */}
      <div className="bg-card/50 border border-border/40 p-3 rounded-2xl shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Cari nama supplier atau nomor telepon..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-10 h-10 rounded-xl bg-background border-border/70 shadow-sm"
          />
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground font-semibold pl-1">
        Menampilkan <span className="text-foreground">{filteredSuppliers.length}</span> dari <span className="text-foreground">{suppliers.length}</span> mitra tercatat
      </div>

      {/* Render Daftar Supplier */}
      {filteredSuppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-card/40 border border-dashed border-border/60 rounded-2xl">
          <div className="bg-muted p-4 rounded-full mb-3">
            <Truck className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-sm font-medium text-foreground">Supplier tidak ditemukan</h3>
          <p className="text-xs text-muted-foreground max-w-xs mt-1">Coba periksa kembali kata kunci atau tambahkan data kemitraan baru.</p>
          {search && (
            <Button variant="outline" size="sm" className="mt-4 rounded-xl" onClick={() => setSearch('')}>
              Reset Pencarian
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSuppliers.map(s => (
            <Card key={s.id} className="border-0 shadow-sm hover:shadow hover:bg-muted/10 transition-all duration-200 rounded-2xl overflow-hidden bg-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground truncate">{s.name}</h3>
                    
                    <div className="space-y-1">
                      {s.phone && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground/70" /> 
                          <span>{s.phone}</span>
                        </div>
                      )}
                      {s.address && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground/70 flex-shrink-0" /> 
                          <span className="truncate">{s.address}</span>
                        </div>
                      )}
                    </div>

                    {s.notes && (
                      <div className="flex items-start gap-1.5 mt-2.5 text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg italic border border-border/30">
                        <FileText className="w-3.5 h-3.5 mt-0.5 text-muted-foreground/60 flex-shrink-0" />
                        <span className="line-clamp-2">"{s.notes}"</span>
                      </div>
                    )}
                  </div>

                  {/* Tombol Aksi */}
                  {hasEditAccess && (
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-muted" onClick={() => openEdit(s)}>
                      <Edit2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-destructive/10 text-destructive" onClick={() => setDeleteId(s.id!)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Form Dialog Add/Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[92vw] sm:max-w-md max-h-[90vh] rounded-2xl p-0 overflow-hidden flex flex-col border border-border/60 shadow-2xl">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/50 bg-muted/10 shrink-0">
            <DialogTitle className="text-lg font-bold flex items-center gap-1.5">
              <NotebookTabs className="w-5 h-5 text-primary" /> {editSupplier ? 'Ubah Profil' : 'Registrasi'} Supplier
            </DialogTitle>
            <DialogDescription className="text-xs">
              Lengkapi informasi kontak dan alamat operasional rekanan vendor untuk mempermudah pemesanan stok (*restock*).
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Nama Perusahaan / Supplier <span className="text-destructive">*</span></Label>
              <Input 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="Contoh: PT Sumber Jaya Mandiri" 
                className="h-11 rounded-xl bg-background border-border/70"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Nomor Telepon / WhatsApp</Label>
              <Input 
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
                placeholder="Contoh: 08123456789" 
                className="h-11 rounded-xl bg-background border-border/70" 
                type="tel" 
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Alamat Kantor / Gudang</Label>
              <Input 
                value={address} 
                onChange={e => setAddress(e.target.value)} 
                placeholder="Nama jalan, kota atau komplek ruko" 
                className="h-11 rounded-xl bg-background border-border/70" 
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Catatan Internal</Label>
              <Textarea 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                placeholder="Termin pembayaran, nama penanggung jawab (sales), atau spesialisasi produk" 
                rows={3} 
                className="rounded-xl bg-background border-border/70 resize-none"
              />
            </div>

            <Button 
              className="w-full h-12 text-sm font-semibold rounded-xl shadow-md transition-all mt-2" 
              onClick={handleSave} 
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Data Kontrak'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog Delete */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl p-5">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">Apakah Anda benar-benar yakin?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Tindakan ini tidak dapat dibatalkan. Menghapus supplier akan memutuskan relasi data pada laporan pembelian masa mendatang.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 gap-2 flex-row justify-end">
            <AlertDialogCancel className="rounded-xl text-xs h-10 mt-0">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl text-xs h-10">
              Ya, Hapus Permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
