import React, { useState, useEffect } from 'react';
import { useDbQuery, dbInsert, dbUpdate, dbDelete } from '@/hooks/db-hooks';
import { Category } from '@/types';
import { Tag, Plus, Edit2, Trash2, Loader2, ArrowLeft, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableCategoryRowProps {
  c: Category;
  hasEditAccess: boolean;
  onEdit: (c: Category) => void;
  onDelete: (id: string) => void;
}

function SortableCategoryRow({ c, hasEditAccess, onEdit, onDelete }: SortableCategoryRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id! });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "flex items-center gap-4 px-4 py-3 bg-card transition-colors hover:bg-muted/30 border-b border-border/40 last:border-b-0", 
        isDragging && "shadow-md bg-muted ring-1 ring-primary/20 rounded-lg"
      )}
    >
      {hasEditAccess && (
        <div 
          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0 select-none touch-none py-1"
          style={{ touchAction: 'none' }}
          {...attributes} 
          {...listeners}
        >
          <GripVertical className="w-4.5 h-4.5" />
        </div>
      )}
      
      {/* Category Icon */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-inner border border-black/5 dark:border-white/5 font-bold"
        style={{ backgroundColor: c.color + '15', color: c.color }}
      >
        {c.icon}
      </div>

      {/* Category Name & Mode */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground truncate">{c.name}</span>
          {c.needsKitchen !== false ? (
            <span className="inline-flex items-center bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded text-[9px] font-bold border border-amber-500/15 uppercase tracking-wider">
              Dapur
            </span>
          ) : (
            <span className="inline-flex items-center bg-slate-500/10 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded text-[9px] font-bold border border-slate-500/15 uppercase tracking-wider">
              Ritel
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {hasEditAccess && (
        <div className="flex items-center gap-1 shrink-0">
          <Button 
            type="button"
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" 
            onClick={() => onEdit(c)}
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button 
            type="button"
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10" 
            onClick={() => onDelete(c.id!)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

interface CategoriesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function Categories({ open, onOpenChange }: CategoriesProps) {
  const dbCategories = useDbQuery<Category>('categories') || [];
  const [categories, setCategories] = useState<Category[]>([]);
  const [view, setView] = useState<'list' | 'add' | 'edit'>('list');

  useEffect(() => {
    if (dbCategories.length > 0) {
      const sorted = [...dbCategories].sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
        if (a.createdAt && b.createdAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        return a.id!.localeCompare(b.id!);
      });
      setCategories(sorted);
    } else {
      setCategories([]);
    }
  }, [dbCategories]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex((item) => item.id === active.id);
      const newIndex = categories.findIndex((item) => item.id === over.id);
      
      const newOrder = arrayMove(categories, oldIndex, newIndex);
      setCategories(newOrder); // Optimistic UI update
      
      if (!hasEditAccess) return;

      try {
        const promises = newOrder.map((item, idx) => {
          if (item.order !== idx) {
            return dbUpdate('categories', item.id!, { order: idx });
          }
          return Promise.resolve();
        });
        await Promise.all(promises);
        toast.success('Urutan kategori berhasil diperbarui');
      } catch (err) {
        toast.error('Gagal memperbarui urutan');
        setCategories(dbCategories); // Revert
      }
    }
  };

  /* ── Kategori State ── */
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeletingCat, setIsDeletingCat] = useState(false);

  const { canEdit } = usePermissions();
  const hasEditAccess = canEdit('categories');

  const [name, setName] = useState('');
  const [catIcon, setCatIcon] = useState('📦');
  const [catColor, setCatColor] = useState('#3b82f6');
  const [catNeedsKitchen, setCatNeedsKitchen] = useState(true);
  const [isSavingCat, setIsSavingCat] = useState(false);

  const handleIconChange = (val: string) => {
    if (!val) {
      setCatIcon('');
      return;
    }
    const codePoints = Array.from(val);
    if (codePoints.length > 0) {
      const lastEmoji = codePoints[codePoints.length - 1];
      setCatIcon(lastEmoji);
    }
  };

  const openAdd = () => {
    setEditCategory(null);
    setName('');
    setCatIcon('📦');
    setCatColor('#3b82f6');
    setCatNeedsKitchen(true);
    setView('add');
  };

  const openEdit = (c: Category) => {
    setEditCategory(c);
    setName(c.name);
    setCatIcon(c.icon);
    setCatColor(c.color);
    setCatNeedsKitchen(c.needsKitchen ?? true);
    setView('edit');
  };

  const handleDelete = (id: string) => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak. Anda tidak memiliki izin untuk mengelola kategori.');
      return;
    }
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    setIsDeletingCat(true);
    try {
      await dbDelete('categories', deleteConfirmId);
      toast.success('Kategori berhasil dihapus');
      setDeleteConfirmId(null);
    } catch (error: any) {
      toast.error('Gagal menghapus kategori: ' + (error.message || error));
    } finally {
      setIsDeletingCat(false);
    }
  };

  const saveCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasEditAccess) {
      toast.error('Akses ditolak. Anda tidak memiliki izin untuk mengelola kategori.');
      return;
    }
    if (!name.trim()) return;
    setIsSavingCat(true);
    try {
      if (editCategory) {
        await dbUpdate('categories', editCategory.id!, { name: name, icon: catIcon, color: catColor, needsKitchen: catNeedsKitchen });
      } else {
        await dbInsert('categories', { name: name, icon: catIcon, color: catColor, needsKitchen: catNeedsKitchen, createdAt: new Date().toISOString() });
      }
      setView('list');
      toast.success('Kategori berhasil disimpan');
    } catch (error: any) {
      toast.error('Gagal menyimpan kategori: ' + (error.message || error));
    } finally {
      setIsSavingCat(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      if (view !== 'list') {
        setView('list');
      } else {
        onOpenChange(false);
      }
    } else {
      onOpenChange(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl w-[94vw] max-h-[85vh] rounded-2xl overflow-hidden flex flex-col p-0 border border-border/60 shadow-2xl bg-background">
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-background h-full max-h-[85vh]">
          {/* Header */}
          <div className="px-6 py-5 border-b border-border/50 bg-muted/10 shrink-0 flex items-center justify-between">
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground leading-none">
                <Tag className="w-4.5 h-4.5 text-primary" />
                {view === 'list' ? 'Kelola Kategori' : view === 'add' ? 'Tambah Kategori' : 'Edit Kategori'}
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-none">
                {view === 'list' ? (
                  <>
                    {categories?.length ?? 0} kategori terdaftar. <span className="hidden sm:inline">Tarik handle untuk mengurutkan.</span>
                  </>
                ) : view === 'add' ? (
                  'Buat kategori baru untuk produk Anda.'
                ) : (
                  'Ubah rincian kategori yang sudah ada.'
                )}
              </p>
            </div>
            {view === 'list' && hasEditAccess && (
              <Button onClick={openAdd} size="sm" className="h-9 px-4 rounded-xl font-bold shadow-sm active:scale-[0.98] mr-5">
                <Plus className="w-4 h-4 mr-1.5" strokeWidth={3} />
                Tambah Kategori
              </Button>
            )}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar min-h-0">
            {!hasEditAccess && (
              <div className="flex items-center gap-2.5 px-4 py-3 mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 select-none">
                <span className="text-base shrink-0">🔒</span>
                <span><strong>Mode Lihat Saja:</strong> Anda tidak memiliki izin untuk mengelola kategori produk.</span>
              </div>
            )}

            {view === 'list' ? (
              /* Category List View */
              !categories?.length ? (
                <div className="flex flex-col items-center py-16 text-center text-muted-foreground gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <Tag className="w-6 h-6 opacity-40" />
                  </div>
                  <h3 className="text-base font-bold text-foreground mb-1">Kategori Kosong</h3>
                  <p className="text-xs text-muted-foreground max-w-sm">Belum ada kategori yang ditambahkan. Silahkan tambah kategori pertama Anda.</p>
                  {hasEditAccess && (
                    <Button variant="outline" size="sm" className="mt-4 rounded-xl border-primary/20 text-primary hover:bg-primary/5 font-bold" onClick={openAdd}>
                      <Plus className="w-4 h-4 mr-1.5" /> Tambah Kategori
                    </Button>
                  )}
                </div>
              ) : (
                <div className="border border-border/50 rounded-xl overflow-hidden bg-card divide-y divide-border/40 shadow-sm">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={categories.map(c => c.id!)} strategy={verticalListSortingStrategy}>
                      <div className="flex flex-col">
                        {categories.map((c) => (
                          <SortableCategoryRow 
                            key={c.id} 
                            c={c} 
                            hasEditAccess={hasEditAccess} 
                            onEdit={openEdit} 
                            onDelete={handleDelete} 
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              )
            ) : (
              /* Form View (Add / Edit) */
              <form onSubmit={saveCat} className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
                
                {/* Left Column */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Nama Kategori</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Cth: Makanan Berat"
                      className="h-11 text-sm rounded-xl"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Warna Tema Kategori</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={catColor}
                        onChange={(e) => setCatColor(e.target.value)}
                        className="h-11 w-14 p-1 cursor-pointer rounded-xl border border-border/50 shrink-0 bg-transparent"
                      />
                      <Input
                        type="text"
                        value={catColor}
                        onChange={(e) => setCatColor(e.target.value)}
                        placeholder="#3b82f6"
                        className="h-11 text-sm rounded-xl font-mono uppercase"
                        maxLength={7}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3.5 border border-border/50 bg-muted/20 rounded-xl">
                    <div className="space-y-0.5 pr-4">
                      <Label className="text-xs font-bold text-foreground">Disiapkan di Dapur</Label>
                      <p className="text-[10px] text-muted-foreground leading-normal">
                        Bila aktif, pesanan produk ini akan muncul di layar Dapur Koki.
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={catNeedsKitchen}
                          onChange={(e) => setCatNeedsKitchen(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary shadow-inner"></div>
                      </label>
                    </div>
                  </div>
                </div>
                
                {/* Right Column */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Ketik Ikon (Emoji)</Label>
                    <div className="flex gap-3 items-center">
                      {/* Large Emoji Preview Box */}
                      <div 
                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-bold shrink-0 border border-border/60 shadow-sm transition-all duration-300 hover:scale-105"
                        style={{ backgroundColor: catColor + '15', color: catColor }}
                      >
                        {catIcon}
                      </div>
                      <div className="flex-1">
                        <Input
                          value={catIcon}
                          onChange={(e) => handleIconChange(e.target.value)}
                          placeholder="📦"
                          className="h-11 text-center text-lg rounded-xl font-bold max-w-[80px]"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">Masukkan 1 emoji</p>
                      </div>
                    </div>
                  </div>

                  {/* Emoji Suggestions Picker */}
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Atau Pilih dari Saran</Label>
                    <div className="flex flex-wrap gap-1.5 max-h-[150px] overflow-y-auto custom-scrollbar border border-border/50 p-2.5 rounded-xl bg-muted/10 shadow-inner">
                      {['📦', '🍔', '🍕', '🍜', '🥤', '☕', '🧁', '🍦', '🏷️', '🚬', '🧼', '🧹', '📱', '🛒', '🛍️', '🍺', '🍚', '🍗', '🥐', '🍞', '🍟', '🥩', '🥘', '🍲', '🍣', '🍱', '🍧', '🍰', '🍹', '🍵', '🍶', '🍎', '🍓', '🥑', '🌶️', '🍳', '🥞', '🥗', '🍿', '🍽️'].map(emoji => (
                        <button
                          type="button"
                          key={emoji}
                          onClick={() => setCatIcon(emoji)}
                          className={cn(
                            "w-9 h-9 flex items-center justify-center text-xl rounded-lg transition-all hover:bg-muted active:scale-95",
                            catIcon === emoji ? "bg-primary/20 border-2 border-primary shadow-sm" : "bg-card border border-border/50 hover:border-primary/40 shadow-sm"
                          )}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions Form Footer */}
                <div className="flex gap-3 pt-4 border-t border-border/40 md:col-span-2 w-full mt-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="flex-1 h-11 font-bold text-sm rounded-xl"
                    onClick={() => setView('list')}
                  >
                    <ArrowLeft className="w-4 h-4 mr-1.5" />
                    Kembali
                  </Button>
                  <Button type="submit" className="flex-1 h-11 font-bold text-sm rounded-xl" disabled={isSavingCat}>
                    {isSavingCat ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</> : 'Simpan Kategori'}
                  </Button>
                </div>
              </form>
            )}
          </div>
          <style dangerouslySetInnerHTML={{__html: `
            .custom-scrollbar::-webkit-scrollbar { width: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.3); border-radius: 20px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(156, 163, 175, 0.5); }
          `}} />
        </div>

        {/* Dialog Konfirmasi Hapus */}
        <Dialog open={deleteConfirmId !== null} onOpenChange={(v) => { if (!v) setDeleteConfirmId(null); }}>
          <DialogContent className="max-w-sm rounded-2xl p-5 border border-border/60 shadow-2xl bg-background z-[150]">
            <div className="flex flex-col items-center text-center space-y-4 pt-2">
              <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                <Trash2 className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-base font-bold text-foreground">Hapus Kategori?</DialogTitle>
                <p className="text-xs text-muted-foreground leading-normal">
                  Apakah Anda yakin ingin menghapus kategori ini secara permanen? Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <Button 
                type="button"
                variant="outline" 
                className="flex-1 h-10 text-xs font-bold rounded-xl"
                onClick={() => setDeleteConfirmId(null)}
                disabled={isDeletingCat}
              >
                Batal
              </Button>
              <Button 
                type="button"
                variant="destructive" 
                className="flex-1 h-10 text-xs font-bold rounded-xl"
                onClick={confirmDelete}
                disabled={isDeletingCat}
              >
                {isDeletingCat ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Menghapus...</> : 'Ya, Hapus'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
