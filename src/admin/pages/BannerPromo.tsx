import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Layout, GripVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useDbQuery, dbUpdate, dbDelete } from '@/hooks/db-hooks';
import { DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cldBanner, cldUrl } from '@/lib/cld';
import { usePermissions } from '@/hooks/use-permissions';

// ── inline helpers ──────────────────────────────────────────────────────────
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

const Button = ({ children, className, variant = 'primary', size = 'md', ...props }: any) => {
  const base = "inline-flex items-center justify-center rounded-xl font-bold transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: any = {
    primary:   "bg-blue-600 hover:bg-blue-700 text-white shadow-md",
    secondary: "bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100",
    outline:   "border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 shadow-sm",
    ghost:     "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100",
    danger:    "bg-red-500 hover:bg-red-600 text-white shadow-md",
  };
  const sizes: any = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-base", icon: "h-10 w-10 p-0" };
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props}>{children}</button>;
};

const Switch = ({ checked, onCheckedChange, disabled }: any) => (
  <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => !disabled && onCheckedChange(!checked)}
    className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none", checked ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700", disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer")}>
    <span className={cn("pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform", checked ? "translate-x-5" : "translate-x-0")} />
  </button>
);

const Badge = ({ children, variant = 'default', className }: any) => {
  const variants: any = {
    default: "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100",
    success: "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300",
  };
  return <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ring-zinc-500/20", variants[variant], className)}>{children}</span>;
};

const Card = ({ children, className }: any) => (
  <div className={cn("rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 shadow-sm", className)}>{children}</div>
);

// ── helpers ─────────────────────────────────────────────────────────────────
function hexToRgb(hex: string) {
  if (!hex) return '0, 0, 0';
  const c = hex.startsWith('#') ? hex.slice(1) : hex;
  return `${parseInt(c.slice(0,2),16)||0}, ${parseInt(c.slice(2,4),16)||0}, ${parseInt(c.slice(4,6),16)||0}`;
}

// ── Sortable Banner Card ─────────────────────────────────────────────────────
function SortableBannerCard({ banner, onDelete, onToggle, onEdit, hasEditAccess }: { banner: any, onDelete: (id: string) => void, onToggle: (id: string, current: boolean) => void, onEdit: (id: string) => void, hasEditAccess: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: banner.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  const b = banner;
  const bgPreview = b.bgType === 'solid' ? b.bgColor : b.bgType === 'gradient' ? b.bgGradient : undefined;
  const previewFilter = `brightness(${b.canvasBgFilter?.brightness || 100}%) contrast(${b.canvasBgFilter?.contrast || 100}%) saturate(${b.canvasBgFilter?.saturate || 100}%) blur(${b.canvasBgFilter?.blur || 0}px)`;
  const headP = b.headingPos ?? { x: 10, y: 20, w: 40 };
  const titleP = b.titlePos ?? { x: 10, y: 38, w: 60 };
  const descP  = b.descPos  ?? { x: 10, y: 60, w: 60 };
  const buttonP = b.buttonPos ?? { x: 10, y: 82 };
  const overP  = b.overlayPos ?? { x: 80, y: 50 };

  return (
    <div ref={setNodeRef} style={style} className={cn("relative group", isDragging && "shadow-2xl scale-[1.02] ring-2 ring-primary rounded-3xl")}>
      <Card className="overflow-hidden flex flex-col h-full border hover:border-primary/40 transition-colors">
        
        {/* ── Visual Preview ── */}
        <div
          className="aspect-[21/9] w-full relative bg-zinc-950 overflow-hidden shrink-0 border-b border-border"
          style={{ background: bgPreview, containerType: 'inline-size' }}
        >
          {/* Drag Handle */}
          {hasEditAccess && (
            <div 
              className="absolute top-4 left-4 z-20 w-8 h-8 rounded-lg bg-black/40 backdrop-blur border border-white/20 flex items-center justify-center text-white/80 cursor-grab active:cursor-grabbing hover:bg-black/60 transition-colors select-none touch-none"
              style={{ touchAction: 'none' }}
              {...attributes} 
              {...listeners}
            >
              <GripVertical className="w-5 h-5" />
            </div>
          )}

          {/* Background image */}
          {b.imageUrl && (
            <div className="absolute inset-0 z-0">
              <img src={cldBanner(b.imageUrl)} alt="Banner" className="w-full h-full object-cover" style={{ filter: previewFilter }} />
              {b.bgGradientOverlay?.enabled ? (
                <div className="absolute inset-0 z-[1]" style={{
                  background: `linear-gradient(${b.bgGradientOverlay.angle ?? 90}deg, rgba(${hexToRgb(b.bgGradientOverlay.color || '#000000')}, ${(b.bgGradientOverlay.opacityLeft ?? 70) / 100}), rgba(${hexToRgb(b.bgGradientOverlay.color || '#000000')}, ${(b.bgGradientOverlay.opacityRight ?? 0) / 100}))`
                }} />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent z-[1]" />
              )}
            </div>
          )}

          {/* Background gradient tanpa gambar: tampilkan gradien overlay jika ada */}
          {!b.imageUrl && b.bgGradientOverlay?.enabled && (
            <div className="absolute inset-0 z-[1]" style={{
              background: `linear-gradient(${b.bgGradientOverlay.angle ?? 90}deg, rgba(${hexToRgb(b.bgGradientOverlay.color || '#000000')}, ${(b.bgGradientOverlay.opacityLeft ?? 70) / 100}), rgba(${hexToRgb(b.bgGradientOverlay.color || '#000000')}, ${(b.bgGradientOverlay.opacityRight ?? 0) / 100}))`
            }} />
          )}

          {/* Overlay stiker */}
          {Array.isArray(b.overlays) && b.overlays.map((overlay: any, idx: number) => {
            const overlayFilterStyle = `brightness(${overlay.filter?.brightness ?? 100}%) contrast(${overlay.filter?.contrast ?? 100}%) saturate(${overlay.filter?.saturate ?? 100}%) blur(${overlay.filter?.blur ?? 0}px)`;
            return (
              <div
                key={overlay.id}
                style={{
                  position: 'absolute',
                  left: `${overlay.x}%`,
                  top: `${overlay.y}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 5 + idx,
                  width: `calc(${overlay.scale ?? 1} * 20cqw)`,
                }}
              >
                <img
                  src={cldUrl(overlay.imageUrl, { q: 'auto', f: 'auto', w: 600 })}
                  style={{
                    transform: `scaleX(${overlay.flipX ? -1 : 1}) rotate(${overlay.rotate ?? 0}deg)`,
                    filter: overlayFilterStyle,
                    borderRadius: `${overlay.borderRadius ?? 0}%`,
                  }}
                  className="w-full h-auto object-contain drop-shadow-2xl pointer-events-none"
                  alt="Overlay"
                />
              </div>
            );
          })}

          {/* Heading */}
          {b.heading && (
            <div style={{ position: 'absolute', left: `${headP.x}%`, top: `${headP.y}%`, transform: 'translate(0%, -50%)', zIndex: 10, width: `${headP.w ?? 40}%` }}>
              <span
                style={{
                  backgroundColor: b.headingStyle === 'solid-white' ? '#FFFFFF' : b.headingStyle === 'solid-dark' ? '#09090b' : b.headingStyle === 'outline-white' ? 'transparent' : b.headingStyle === 'neon' ? 'rgba(34,211,238,0.15)' : b.headingStyle === 'retro' ? '#fbbf24' : 'rgba(255,255,255,0.2)',
                  color: b.headingStyle === 'solid-white' ? '#0f172a' : b.headingStyle === 'solid-dark' ? '#ffffff' : b.headingStyle === 'neon' ? '#a5f3fc' : b.headingStyle === 'retro' ? '#09090b' : '#ffffff',
                  border: b.headingStyle === 'outline-white' ? '0.2cqw solid #ffffff' : b.headingStyle === 'neon' ? '0.15cqw solid #22d3ee' : b.headingStyle === 'retro' ? '0.2cqw solid #09090b' : '0.1cqw solid rgba(255,255,255,0.1)',
                  boxShadow: b.headingStyle === 'neon' ? '0 0 12px rgba(34,211,238,0.4)' : b.headingStyle === 'retro' ? '0.25cqw 0.25cqw 0px #09090b' : 'none',
                  backdropFilter: (b.headingStyle === 'glass' || !b.headingStyle) ? 'blur(8px)' : undefined,
                }}
                className="text-[2.2cqw] px-[1.5cqw] py-[0.5cqw] rounded inline-block uppercase tracking-widest select-none"
                dangerouslySetInnerHTML={{ __html: b.heading }}
              />
            </div>
          )}

          {/* Title */}
          {b.title && (
            <div style={{ position: 'absolute', left: `${titleP.x}%`, top: `${titleP.y}%`, transform: 'translate(0%, -50%)', zIndex: 10, width: `${titleP.w ?? 60}%` }}>
              <h4 className="font-black text-[4.5cqw] leading-[1.15] line-clamp-2 text-white m-0 select-none text-left drop-shadow" dangerouslySetInnerHTML={{ __html: b.title }} />
            </div>
          )}

          {/* Description */}
          {b.description && (
            <div style={{ position: 'absolute', left: `${descP.x}%`, top: `${descP.y}%`, transform: 'translate(0%, -50%)', zIndex: 10, width: `${descP.w ?? 60}%` }}>
              <p className="text-[2.8cqw] text-slate-100 line-clamp-2 leading-[1.3] font-medium m-0 select-none text-left drop-shadow" dangerouslySetInnerHTML={{ __html: b.description }} />
            </div>
          )}

          {/* Button */}
          {(b.link || b.buttonText) && (
            <div style={{ position: 'absolute', left: `${buttonP.x}%`, top: `${buttonP.y}%`, transform: 'translate(0%, -50%)', zIndex: 10 }}>
              <span
                style={{
                  backgroundColor: b.badgeStyle === 'solid' ? '#FFFFFF' : b.badgeStyle === 'outline' ? 'transparent' : b.badgeStyle === 'glass' ? 'rgba(255,255,255,0.2)' : b.badgeStyle === 'soft-dark' ? 'rgba(0,0,0,0.4)' : b.badgeStyle === 'neon' ? '#06b6d4' : b.badgeStyle === 'retro' ? '#eab308' : '#FFFFFF',
                  color: b.badgeStyle === 'solid' ? '#0F172A' : b.badgeStyle === 'outline' ? '#FFFFFF' : b.badgeStyle === 'glass' ? '#FFFFFF' : b.badgeStyle === 'soft-dark' ? '#FFFFFF' : b.badgeStyle === 'neon' ? '#ffffff' : b.badgeStyle === 'retro' ? '#09090b' : '#0F172A',
                  border: b.badgeStyle === 'solid' ? 'none' : b.badgeStyle === 'outline' ? '0.2cqw solid #FFFFFF' : b.badgeStyle === 'glass' ? '0.15cqw solid rgba(255,255,255,0.2)' : b.badgeStyle === 'soft-dark' ? '0.15cqw solid rgba(255,255,255,0.2)' : b.badgeStyle === 'neon' ? 'none' : b.badgeStyle === 'retro' ? '0.25cqw solid #09090b' : 'none',
                  boxShadow: b.badgeStyle === 'neon' ? '0 0 15px rgba(6,182,212,0.6)' : b.badgeStyle === 'retro' ? '0.3cqw 0.3cqw 0px #09090b' : 'none',
                  backdropFilter: (b.badgeStyle === 'glass' || b.badgeStyle === 'soft-dark') ? 'blur(8px)' : undefined,
                }}
                className="text-[2.4cqw] font-extrabold px-[2.5cqw] py-[0.8cqw] rounded-md shadow select-none inline-block"
              >
                {b.buttonText || 'Lihat Detail'}
              </span>
            </div>
          )}

          {/* Status badge — z-30 ensures it's always above overlays */}
          <div className="absolute top-4 right-4 flex gap-2 z-30">
            <Badge variant={b.isActive ? "success" : "default"} className="shadow-lg backdrop-blur-md bg-white/90 dark:bg-zinc-900/90 pointer-events-none">
              {b.isActive ? 'Ditampilkan' : 'Disembunyikan'}
            </Badge>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="p-4 flex flex-col flex-1 bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch checked={!!b.isActive} disabled={!hasEditAccess} onCheckedChange={() => onToggle(b.id, b.isActive)} />
              <span className="text-xs font-bold text-muted-foreground">Tampil</span>
            </div>
            {hasEditAccess && (
              <div className="flex gap-2 relative z-10">
                <Button variant="outline" size="sm" className="h-9 px-3 rounded-lg gap-1.5 text-xs font-semibold border border-border hover:border-primary hover:text-primary"
                  onClick={() => onEdit(b.id)}>
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </Button>
                <Button variant="danger" size="icon" className="h-9 w-9 rounded-lg"
                  onClick={() => onDelete(b.id)} title="Hapus Banner">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── component ────────────────────────────────────────────────────────────────
export default function BannerPromoList() {
  const { canEdit } = usePermissions();
  const hasEditAccess = canEdit('marketing');
  const dbBanners = (useDbQuery('banners') ?? []) as any[];
  const navigate = useNavigate();
  const [deleteBannerId, setDeleteBannerId] = useState<string | null>(null);
  const [orderedBanners, setOrderedBanners] = useState<any[]>([]);

  // Initialize sorted banners based on db query
  useEffect(() => {
    if (dbBanners.length > 0) {
      // Sort by order field, fallback to creation time or id
      const sorted = [...dbBanners].sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
        if (a.created_at && b.created_at) return b.created_at - a.created_at;
        return a.id.localeCompare(b.id);
      });
      setOrderedBanners(sorted);
    } else {
      setOrderedBanners([]);
    }
  }, [dbBanners]);

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
    if (!hasEditAccess) return;
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = orderedBanners.findIndex((item) => item.id === active.id);
      const newIndex = orderedBanners.findIndex((item) => item.id === over.id);
      
      const newOrder = arrayMove(orderedBanners, oldIndex, newIndex);
      setOrderedBanners(newOrder); // Optimistic UI update
      
      try {
        const promises = newOrder.map((item, idx) => {
          if (item.order !== idx) {
            return dbUpdate('banners', item.id, { order: idx });
          }
          return Promise.resolve();
        });
        await Promise.all(promises);
        toast.success('Urutan banner berhasil diperbarui');
      } catch (err) {
        toast.error('Gagal memperbarui urutan');
        // Reset to original if failed
        setOrderedBanners(dbBanners);
      }
    }
  };

  const handleToggleActive = async (id: string, cur: boolean) => {
    try {
      await dbUpdate('banners', id, { isActive: !cur });
      toast.success(!cur ? 'Banner ditampilkan' : 'Banner disembunyikan');
    } catch { toast.error('Gagal mengubah status'); }
  };

  const handleDeleteBanner = async () => {
    if (!deleteBannerId) return;
    try {
      await dbDelete('banners', deleteBannerId);
      toast.success('Banner berhasil dihapus');
      setDeleteBannerId(null);
    } catch { toast.error('Gagal menghapus banner'); }
  };

  return (
    <div className="pb-24 space-y-6 w-full animate-in fade-in duration-300">

      {/* Action Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Kelola Banner</h2>
        {hasEditAccess && (
          <Button onClick={() => navigate('/admin/banner/edit/new')} className="h-11 px-5 rounded-xl font-bold bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20 active:scale-[0.98] transition-all shrink-0">
            <Plus className="w-5 h-5 mr-2" strokeWidth={3} />
            Buat Banner Baru
          </Button>
        )}
      </div>
      {!hasEditAccess && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 select-none">
          <span className="text-base shrink-0">🔒</span>
          <span><strong>Mode Lihat Saja:</strong> Anda tidak memiliki izin untuk mengelola banner promo.</span>
        </div>
      )}

      {/* Content */}
      {orderedBanners.length === 0 ? (
        <div className="bg-card border-2 border-dashed border-border rounded-3xl p-16 flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
            <Layout className="w-12 h-12 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <h3 className="text-2xl font-black mb-2 text-foreground">Kanvas Kosong</h3>
          <p className="text-muted-foreground max-w-sm mb-8">Belum ada banner yang dibuat. Klik tombol di atas untuk memulai mahakarya Anda!</p>
          <Button variant="primary" onClick={() => navigate('/admin/banner/edit/new')} className="rounded-full px-8 shadow-lg">Mulai Desain</Button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedBanners.map(b => b.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {orderedBanners.map((b: any) => (
                <SortableBannerCard 
                  key={b.id} 
                  banner={b} 
                  onDelete={() => setDeleteBannerId(b.id)} 
                  onToggle={(id, cur) => handleToggleActive(id, cur)}
                  onEdit={(id) => navigate('/admin/banner/edit/' + id)}
                  hasEditAccess={hasEditAccess}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Delete dialog */}
      {deleteBannerId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[2rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-center mb-2">Hapus Banner?</h3>
            <p className="text-center text-zinc-500 dark:text-zinc-400 mb-8">
              Aksi ini tidak dapat dibatalkan. Semua desain banner Anda akan terhapus secara permanen dari database.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1 rounded-2xl h-12" onClick={() => setDeleteBannerId(null)}>Batal</Button>
              <Button variant="danger" className="flex-1 rounded-2xl h-12" onClick={handleDeleteBanner}>Ya, Hapus</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
