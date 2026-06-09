import { useDbQuery, dbInsert, dbUpdate, dbDelete, dbUploadFile, dbDeleteFile } from '@/hooks/db-hooks';
import { cldThumb, cldFull } from '@/lib/cld';
import { type Product, type Category } from '@/hooks/db-hooks';
import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Package as PackageIcon, Camera, X, ImageIcon, ZoomIn, ScanBarcode, Loader2, Tag, Layers, QrCode, FolderTree, Infinity } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { compressImage } from '@/lib/image-utils';
import BarcodeScanner from '@/admin/components/BarcodeScanner';
import PhotoCropModal from '@/admin/components/PhotoCropModal';
import ProductVariantEditor from '@/admin/components/ProductVariantEditor';
import { ProductVariantGroup } from '@/hooks/db-hooks';
import { Card, CardContent } from '@/components/ui/card';
import { ProductsSkeleton } from '@/admin/components/SkeletonLoaders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { usePermissions } from '@/hooks/use-permissions';
import Categories from '../components/Categories';

export default function Produk() {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false);

  const { canEdit } = usePermissions();
  const hasEditAccess = canEdit('products');

  // Form state
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [price, setPrice] = useState('');
  const [hpp, setHpp] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [barcode, setBarcode] = useState('');
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [variants, setVariants] = useState<ProductVariantGroup[]>([]);
  const [trackStock, setTrackStock] = useState(true);

  // Refs
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const products = useDbQuery<Product>('products');
  const categories = useDbQuery<Category>('categories');

  const filtered = useMemo(() => {
    return products?.filter(p => {
      const matchSearch = (p.name || '').toLowerCase().includes(search.toLowerCase()) || (p.sku || '').toLowerCase().includes(search.toLowerCase());
      const matchCategory = filterCategory === 'all' || String(p.categoryId) === String(filterCategory);
      return matchSearch && matchCategory;
    }) ?? [];
  }, [products, search, filterCategory]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories?.forEach(c => map.set(String(c.id!), c));
    return map;
  }, [categories]);

  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // If we have data, we are no longer loading
    if ((products && products.length > 0) || (categories && categories.length > 0)) {
      setLoading(false);
    }
    // Timeout fallback for empty database (prevent infinite skeleton)
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [products?.length, categories?.length]);

  const getCategoryName = useCallback((catId: string | number) => categoryMap.get(String(catId))?.name ?? '-', [categoryMap]);
  const getCategoryColor = useCallback((catId: string | number) => categoryMap.get(String(catId))?.color ?? '#999', [categoryMap]);

  const openAdd = () => {
    setEditProduct(null);
    setName(''); setSku(''); setCategoryId(categories?.[0]?.id?.toString() ?? ''); setPrice(''); setHpp(''); setStock(''); setUnit('pcs'); setBarcode(''); setPhoto(undefined); setVariants([]); setTrackStock(true);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setName(p.name); setSku(p.sku); setCategoryId(p.categoryId.toString()); setPrice(p.price.toString()); setHpp(p.hpp.toString()); setStock(p.stock.toString()); setUnit(p.unit); setBarcode(p.barcode ?? ''); setPhoto(p.photo); setVariants(p.variants || []); setTrackStock(p.trackStock !== false);
    setDialogOpen(true);
  };

  const handlePhotoFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }
    // Langsung arahkan ke alat Crop dalam ukuran dan resolusi aslinya!
    setCropFile(file);
  };

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handlePhotoFile(file);
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handlePhotoFile(file);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak. Anda tidak memiliki izin untuk mengelola produk.');
      return;
    }
    if (!name.trim() || !categoryId) return;

    setIsSaving(true);
    try {
      let finalPhotoUrl = photo;
      if (photo && photo.startsWith('data:image')) {
        const res = await fetch(photo);
        const blob = await res.blob();
        const compressedDataUrl = await compressImage(blob, 0.3);
        const fileName = `product-${Date.now()}.jpg`;
        const url = await dbUploadFile('products', fileName, compressedDataUrl);
        if (url) finalPhotoUrl = url;
      }

      let finalSku = sku.trim();
      if (!finalSku) {
        // Generate SKU based on initials
        const words = name.trim().split(/[\s-]+/);
        let initials = words.map(w => w[0].toUpperCase()).join('').substring(0, 3);
        if (!initials) initials = 'PRD';
        
        let maxNumber = 0;
        products?.forEach(p => {
          if (p.sku && p.sku.startsWith(initials)) {
            const numPart = p.sku.substring(initials.length);
            const num = parseInt(numPart, 10);
            if (!isNaN(num) && num > maxNumber) {
              maxNumber = num;
            }
          }
        });
        
        finalSku = `${initials}${(maxNumber + 1).toString().padStart(4, '0')}`;
      }

      const data: any = {
        name: name.trim(),
        categoryId: Number(categoryId),
        price: Number(price) || 0,
        hpp: Number(hpp) || 0,
        stock: trackStock ? (Number(stock) || 0) : 0,
        trackStock,
        unit: unit.trim() || 'pcs',
        variants,
        barcode: barcode.trim() || undefined,
        photo: finalPhotoUrl || undefined,
        sku: finalSku, 
        updatedAt: new Date().toISOString(),
      };

      if (editProduct?.id) {
        if (editProduct.photo && finalPhotoUrl && editProduct.photo !== finalPhotoUrl) {
          await dbDeleteFile(editProduct.photo);
        } else if (editProduct.photo && !finalPhotoUrl) {
          // If the user removed the photo explicitly
          await dbDeleteFile(editProduct.photo);
        }
        await dbUpdate('products', editProduct.id, data);
        toast.success('Produk berhasil diperbarui');
      } else {
        await dbInsert('products', { ...data, createdAt: new Date().toISOString() } as Product);
        toast.success('Produk berhasil ditambahkan');
      }
      setDialogOpen(false);
    } catch (error: any) {
      toast.error('Terjadi kesalahan saat menyimpan produk: ' + (error.message || error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak. Anda tidak memiliki izin untuk mengelola produk.');
      return;
    }
    if (deleteId) {
      const p = products?.find(x => x.id === deleteId);
      if (p?.photo) {
        await dbDeleteFile(p.photo);
      }
      await dbDelete('products', deleteId);
      toast.success('Produk berhasil dihapus');
      setDeleteId(null);
    }
  };

  return (
    <div className="pt-2 pb-24 space-y-6 w-full mx-auto animate-in fade-in duration-300">
      
      {!hasEditAccess && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 select-none">
          <span className="text-base shrink-0">🔒</span>
          <span><strong>Mode Lihat Saja:</strong> Anda tidak memiliki izin untuk mengelola data produk.</span>
        </div>
      )}

      {loading ? (
        <ProductsSkeleton />
      ) : (
        <>
          {/* Action Header */}
          <div className={cn("grid gap-3 w-full", hasEditAccess ? "grid-cols-2 sm:flex sm:justify-end" : "grid-cols-1 sm:flex sm:justify-end")}>
            <Button 
              variant="outline" 
              onClick={() => setCategoriesModalOpen(true)} 
              className="h-11 px-3 sm:px-4 rounded-xl font-bold border-primary/20 hover:bg-primary/5 hover:text-primary transition-all duration-200 text-foreground w-full sm:w-auto"
            >
              <Tag className="w-4 h-4 mr-2 text-primary shrink-0" />
              <span className="truncate">Kelola Kategori</span>
            </Button>
            {hasEditAccess && (
              <Button onClick={openAdd} className="h-11 px-3 sm:px-5 rounded-xl font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98] w-full sm:w-auto">
                <Plus className="w-5 h-5 mr-1.5 sm:mr-2 shrink-0" strokeWidth={3} />
                <span className="truncate">Tambah Produk</span>
              </Button>
            )}
          </div>

      {/* Search & Filter Bar */}
      <div className="bg-card border border-border/50 p-3 rounded-2xl shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Cari nama produk atau SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-11 bg-background border-border/60 rounded-xl shadow-sm focus-visible:ring-1"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-[180px] h-11 bg-background border-border/60 rounded-xl font-semibold shadow-sm">
            <SelectValue placeholder="Semua Kategori" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all" className="font-medium">Semua Kategori</SelectItem>
            {categories?.map(c => (
              <SelectItem key={c.id} value={c.id!.toString()} className="font-medium">
                <span className="flex items-center gap-2">
                  <span className="text-base">{c.icon}</span> {c.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Counter */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 transition-colors">
          {filtered.length} Produk Ditemukan
        </Badge>
      </div>

      {/* Product Grid / List */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-dashed border-border/60 rounded-[2rem] p-12 flex flex-col items-center justify-center text-center opacity-80">
          <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-4">
            <PackageIcon className="w-10 h-10 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">Produk Tidak Ditemukan</h3>
          <p className="text-sm text-muted-foreground max-w-sm">Belum ada produk yang ditambahkan atau cocok dengan pencarian Anda.</p>
          {hasEditAccess && (
          <Button variant="outline" className="mt-6 rounded-xl border-primary/20 text-primary hover:bg-primary/5 font-bold" onClick={openAdd}>
            <Plus className="w-4 h-4 mr-2" /> Tambah Produk Baru
          </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(p => (
            <Card key={p.id} className="group border border-border/50 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300 rounded-2xl overflow-hidden bg-card relative">
              <div className="p-3 sm:p-4 flex items-center gap-4 relative z-10">
                
                {/* 1. Image Section */}
                <div
                  className={cn(
                    'w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-muted/50 flex items-center justify-center shrink-0 overflow-hidden relative border border-border/50',
                    p.photo && 'cursor-pointer hover:opacity-90 transition-opacity group/img'
                  )}
                  onClick={() => p.photo && setLightboxSrc(p.photo)}
                >
                  {p.photo ? (
                    <>
                      <img src={cldThumb(p.photo)} alt={p.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                        <ZoomIn className="w-5 h-5 text-white" />
                      </div>
                    </>
                  ) : (
                    <PackageIcon className="w-8 h-8 text-muted-foreground/30" strokeWidth={1.5} />
                  )}
                </div>
                
                {/* 2. Product Identity */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-extrabold text-foreground truncate mb-1.5">{p.name}</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] sm:text-xs font-bold tracking-wide uppercase px-2.5 py-0.5 border-border/60 bg-muted/30" style={{ color: getCategoryColor(p.categoryId) }}>
                      {getCategoryName(p.categoryId)}
                    </Badge>
                    <span className="text-[11px] sm:text-xs text-muted-foreground font-mono flex items-center gap-1 bg-accent/50 px-2 py-0.5 rounded-md">
                      <Tag className="w-3 h-3" /> {p.sku || 'No SKU'}
                    </span>
                  </div>
                </div>

                {/* 3. Pricing & Stock */}
                <div className="flex flex-col items-end justify-center gap-1.5 shrink-0 ml-auto">
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hidden sm:block mb-0.5">Harga Jual</p>
                    <p className="text-base sm:text-lg font-black text-primary leading-none">Rp {p.price.toLocaleString('id-ID')}</p>
                  </div>
                  <div className={cn(
                    'flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] sm:text-xs font-bold transition-colors',
                    p.trackStock === false
                      ? 'bg-muted/50 border-border/50 text-muted-foreground'
                      : p.stock <= 5
                        ? 'bg-destructive/10 border-destructive/20 text-destructive'
                        : 'bg-success/10 border-success/20 text-success'
                  )}>
                    {p.trackStock === false ? (
                      <><Infinity className="w-3 h-3" /> Tanpa Stok</>
                    ) : (
                      <><Layers className="w-3 h-3" /> Stok: {p.stock}</>
                    )}
                  </div>
                </div>

                {/* 4. Actions (Hover Slide In) */}
                {hasEditAccess && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex-col gap-2 shrink-0 opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 hidden sm:flex bg-card/95 p-1.5 rounded-xl border border-border/50 shadow-sm z-20">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary hover:text-white" onClick={() => openEdit(p)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive hover:text-white" onClick={() => setDeleteId(p.id!)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                
                {/* Mobile Actions */}
                {hasEditAccess && (
                <div className="flex sm:hidden flex-col gap-1 shrink-0 ml-1">
                   <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-primary" onClick={() => openEdit(p)}><Edit2 className="w-3.5 h-3.5" /></Button>
                   <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-destructive" onClick={() => setDeleteId(p.id!)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
                )}
                
              </div>
            </Card>
          ))}
        </div>
      )}
      </>
      )}

      {/* Dialog Form Tambah / Edit Product */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl rounded-[2rem] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 border-border/60 shadow-2xl">
          <DialogHeader className="px-6 py-5 border-b border-border/50 bg-muted/10 shrink-0">
            <DialogTitle className="text-xl font-extrabold flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                {editProduct ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" strokeWidth={3} />}
              </div>
              {editProduct ? 'Edit Informasi Produk' : 'Tambah Produk Baru'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 custom-scrollbar">
            
            {/* Photo Dropzone Section */}
            <div className="bg-card border border-border/60 rounded-2xl p-4 flex flex-col sm:flex-row gap-5 items-center sm:items-start shadow-sm">
              <div
                className={cn(
                  'w-32 h-32 rounded-xl flex items-center justify-center shrink-0 overflow-hidden relative border-2 border-dashed transition-all',
                  photo 
                    ? 'border-primary/40 bg-muted/20 cursor-pointer group hover:opacity-90' 
                    : 'border-border bg-muted/10 hover:border-primary/50 hover:bg-primary/5'
                )}
                onClick={() => photo ? setLightboxSrc(photo) : galleryInputRef.current?.click()}
              >
                {photo ? (
                  <>
                    <img src={photo} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                      <ZoomIn className="w-6 h-6 text-white" />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground/60">
                    <Camera className="w-8 h-8" strokeWidth={1.5} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Foto Produk</span>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col justify-center w-full space-y-2">
                <p className="text-sm font-semibold text-foreground">Unggah Foto (Opsional)</p>
                <p className="text-xs text-muted-foreground mb-2 leading-relaxed">Pilih foto dengan pencahayaan terang agar menu terlihat lebih menarik. Format JPG/PNG.</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" className="h-9 rounded-lg text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20" onClick={() => galleryInputRef.current?.click()}>
                    <ImageIcon className="w-3.5 h-3.5 mr-1.5" /> Galeri
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg text-xs font-bold border-border/60 hover:bg-muted" onClick={() => cameraInputRef.current?.click()}>
                    <Camera className="w-3.5 h-3.5 mr-1.5" /> Kamera
                  </Button>
                  {photo && (
                    <Button type="button" variant="ghost" size="sm" className="h-9 rounded-lg text-xs font-bold text-destructive hover:bg-destructive/10" onClick={() => setPhoto(undefined)}>
                      Hapus
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Hidden Inputs */}
              <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleGallerySelect} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCameraCapture} />
            </div>

            {/* Basic Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nama Produk <span className="text-destructive">*</span></Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Misal: Kopi Gula Aren" className="h-11 bg-background rounded-xl focus-visible:ring-1" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Kategori <span className="text-destructive">*</span></Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="h-11 bg-background rounded-xl font-medium focus:ring-1"><SelectValue placeholder="Pilih Kategori" /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {categories?.map(c => (
                      <SelectItem key={c.id} value={c.id!.toString()} className="font-medium">{c.icon} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pricing Grid */}
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2 relative group">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Harga Jual <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground group-focus-within:text-primary transition-colors">Rp</span>
                  <Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" className="h-11 pl-10 bg-background rounded-xl font-mono text-base focus-visible:ring-1" />
                </div>
              </div>
              <div className="space-y-2 relative group">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">HPP (Modal)</Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground group-focus-within:text-foreground transition-colors">Rp</span>
                  <Input type="number" value={hpp} onChange={e => setHpp(e.target.value)} placeholder="0" className="h-11 pl-10 bg-background rounded-xl font-mono text-base focus-visible:ring-1" />
                </div>
              </div>
            </div>

            {/* Inventory Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Stok Awal</Label>
                <Input type="number" value={stock} onChange={e => setStock(e.target.value)} placeholder="0" className="h-11 bg-background rounded-xl font-mono text-base focus-visible:ring-1" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Satuan</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger className="h-11 bg-background rounded-xl font-medium focus:ring-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {['pcs', 'kg', 'gram', 'liter', 'ml', 'porsi', 'cup', 'botol', 'bungkus'].map(u => (
                      <SelectItem key={u} value={u} className="font-medium">{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Barcode (SKU)</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Opsional" className="h-11 pl-9 bg-background rounded-xl text-sm focus-visible:ring-1" />
                  </div>
                  <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-xl bg-muted/30 hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-colors" title="Scan Barcode" onClick={() => setScannerOpen(true)}>
                    <ScanBarcode className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Track Stock Toggle */}
            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
              <div>
                <p className="text-sm font-bold text-foreground">Kelola Stok</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {trackStock ? 'Stok dikelola — berkurang saat terjual' : 'Tanpa stok — produk selalu tersedia'}
                </p>
              </div>
              <Switch checked={trackStock} onCheckedChange={setTrackStock} />
            </div>

            {/* Variant Editor Component */}
            <div className="pt-2">
              <ProductVariantEditor variants={variants} onChange={setVariants} />
            </div>

          </div>

          <DialogFooter className="px-6 py-4 border-t border-border/50 bg-muted/10 shrink-0 gap-2 sm:gap-0">
            <Button variant="outline" className="h-12 rounded-xl font-bold border-border/60 hover:bg-muted" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              Batal
            </Button>
            <Button className="h-12 rounded-xl font-bold shadow-md hover:shadow-lg active:scale-[0.98] transition-all px-8" onClick={handleSave} disabled={!name.trim() || !categoryId || isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" /> 
                  {photo && photo.startsWith('data:image') ? 'Mengunggah...' : 'Menyimpan...'}
                </>
              ) : (
                editProduct ? 'Simpan Perubahan' : 'Tambah Produk'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="max-w-[400px] rounded-2xl p-6">
          <AlertDialogHeader>
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2 mx-auto">
              <Trash2 className="w-6 h-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center text-xl">Hapus Produk Ini?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Tindakan ini tidak dapat dibatalkan. Produk akan dihapus dari sistem secara permanen.
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

      {/* Photo Lightbox */}
      {lightboxSrc && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/90 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={() => setLightboxSrc(null)}>
          <button className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors backdrop-blur-md border border-white/10" onClick={() => setLightboxSrc(null)}>
            <X className="w-6 h-6 text-white" />
          </button>
          <img src={cldFull(lightboxSrc)} alt="Preview" className="max-w-full max-h-[85dvh] rounded-2xl object-contain shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()} />
        </div>,
        document.body
      )}

      {/* Barcode Scanner */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => {
          setBarcode(code);
          setScannerOpen(false);
          toast.success('Barcode berhasil dipindai');
        }}
      />

      {/* Photo Cropper Modal */}
      <PhotoCropModal
        open={!!cropFile}
        onOpenChange={(open) => { if (!open) setCropFile(null); }}
        file={cropFile}
        onCropped={async (croppedDataUrl) => {
          setPhoto(croppedDataUrl);
          setCropFile(null);
          
          try {
            const res = await fetch(croppedDataUrl);
            const blob = await res.blob();
            const compressedDataUrl = await compressImage(blob, 0.3);
            const url = await dbUploadFile('products', `product-${Date.now()}.jpg`, compressedDataUrl);
            if (url) {
              setPhoto(url);
            }
          } catch (e) {
            console.error("Product photo upload error", e);
          }
        }}
        disableCompression={true}
      />

      {/* Modal Kelola Kategori */}
      <Categories open={categoriesModalOpen} onOpenChange={setCategoriesModalOpen} />

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.3); border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(156, 163, 175, 0.5); }
      `}} />
    </div>
  );
}
