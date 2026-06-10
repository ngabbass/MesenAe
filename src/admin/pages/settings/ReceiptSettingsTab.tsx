import { useState, useEffect, useRef } from 'react';
import { 
  Camera, Save, Loader2, CheckCircle2, Printer, ImageIcon,
  Sliders, Type, AlignCenter, Trash2, GripVertical, Store, Utensils, Coffee, Zap,
  QrCode, Copy
} from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { dbUploadFile, dbDeleteFile, dbUpdate, type StoreSettings } from '@/hooks/db-hooks';
import { compressImage } from '@/lib/image-utils';
import { cn } from '@/lib/utils';
import PhotoCropModal from '@/admin/components/PhotoCropModal';
import { QRCodeSVG } from 'qrcode.react';

export interface ReceiptTypography {
  fontFamily: 'monospace' | 'sans-serif' | 'courier' | 'receipt-font';
  fontSize: number;
  lineHeight: 'tight' | 'normal' | 'relaxed';
  alignment: 'left' | 'center' | 'right';
  compactMode: boolean;
  paperWidth: '58mm';
}

// Helper to remove white background pixels smoothly from images
async function removeWhiteBackground(imageUrl: string): Promise<string> {
  if (!imageUrl) return '';
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let canvas: HTMLCanvasElement | null = document.createElement('canvas');
      try {
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          canvas.width = 0;
          canvas.height = 0;
          canvas = null;
          resolve(imageUrl);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Calculate average pixel brightness for grayscale
          const avg = (r + g + b) / 3;
          
          // Convert to grayscale
          data[i] = avg;
          data[i + 1] = avg;
          data[i + 2] = avg;
          
          // If the pixel is close to white (brightness > 210)
          if (avg > 210) {
            // Apply smooth alpha gradient for anti-aliasing
            const alpha = Math.max(0, 255 - (avg - 210) * (255 / 45));
            data[i + 3] = Math.min(data[i + 3], alpha);
          }
        }
        ctx.putImageData(imgData, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        
        canvas.width = 0;
        canvas.height = 0;
        canvas = null;
        
        resolve(dataUrl);
      } catch (err) {
        console.error('Error removing white background:', err);
        if (canvas) {
          canvas.width = 0;
          canvas.height = 0;
          canvas = null;
        }
        resolve(imageUrl);
      }
    };
    img.onerror = () => {
      resolve(imageUrl);
    };
    img.src = imageUrl;
  });
}

interface ReceiptSettingsProps {
  storeSettings: StoreSettings | undefined;
  hasEditAccess: boolean;
}

type TemplateType = 'minimarket' | 'fnb' | 'classic' | 'minimalis';
type FooterBlock = 'line1' | 'line2' | 'image';

// ─── Sortable Footer Item ────────────────────────────────────────────
function SortableFooterItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    position: 'relative' as const,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 bg-background rounded-xl border transition-all pl-2 pr-3 py-2',
        isDragging ? 'shadow-md border-primary/40 bg-muted/20 opacity-95' : 'border-border/80 hover:border-primary/20'
      )}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-foreground p-1 shrink-0 touch-none">
        <GripVertical className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────
export default function ReceiptSettings({ storeSettings, hasEditAccess }: ReceiptSettingsProps) {
  const [hasInitialized, setHasInitialized] = useState(false);

  // Template
  const [template, setTemplate] = useState<TemplateType>('fnb');

  // Logo Toggle Checklist
  const [showLogo, setShowLogo] = useState<boolean>(true);
  const [showFooterImg, setShowFooterImg] = useState<boolean>(true);

  // Typography
  const [fontFamily, setFontFamily] = useState<'monospace' | 'sans-serif' | 'courier' | 'receipt-font'>('receipt-font');
  const [fontSize, setFontSize] = useState<number>(11);
  const [lineHeight, setLineHeight] = useState<'tight' | 'normal' | 'relaxed'>('tight');

  // Footer
  const [footerLine1, setFooterLine1] = useState('');
  const [footerLine2, setFooterLine2] = useState('');
  const [footerImg, setFooterImg] = useState<string | undefined>();
  const [footerOrder, setFooterOrder] = useState<FooterBlock[]>(['line1', 'line2', 'image']);
  const [processedLogo, setProcessedLogo] = useState<string | undefined>();
  const [footerType, setFooterType] = useState<'image' | 'qrcode'>('image');
  const [footerQrUrl, setFooterQrUrl] = useState<string>('');
  const [rawFooterImg, setRawFooterImg] = useState<string | undefined>();

  // Bold, Italic, Underline for Footer lines
  const [line1Bold, setLine1Bold] = useState(false);
  const [line1Italic, setLine1Italic] = useState(false);
  const [line1Underline, setLine1Underline] = useState(false);
  const [line2Bold, setLine2Bold] = useState(false);
  const [line2Italic, setLine2Italic] = useState(false);
  const [line2Underline, setLine2Underline] = useState(false);

  // Lightbox Preview Modal State
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Crop
  const [cropOpen, setCropOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Save
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // DnD sensors
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

  // ─── Initialize ────────────────────────────────────────────────────
  useEffect(() => {
    if (storeSettings && !hasInitialized) {
      const s = storeSettings as any;
      
      // Template - migrate finedining to classic
      const tmpl = s.receiptTemplate ?? 'fnb';
      setTemplate(tmpl === 'finedining' ? 'classic' : tmpl);

      // Logo Toggle
      setShowLogo(s.receiptShowLogo ?? true);
      setShowFooterImg(s.receiptShowFooterImg ?? true);

      // Typography
      const typo = s.receiptTypography || {};
      setFontFamily(typo.fontFamily ?? 'receipt-font');

      // Migrate string fontSize to number
      const storedSize = typo.fontSize;
      if (typeof storedSize === 'number') {
        setFontSize(storedSize);
      } else if (typeof storedSize === 'string') {
        const sizeMap: Record<string, number> = { xs: 9, sm: 11, md: 13, lg: 15, xl: 17 };
        setFontSize(sizeMap[storedSize] ?? 11);
      }

      setLineHeight(typo.lineHeight ?? 'tight');

      // Footer
      setFooterType(s.receiptFooterType ?? 'image');
      setFooterQrUrl(s.receiptFooterQrUrl ?? '');
      setFooterOrder(s.receiptFooterOrder ?? ['line1', 'line2', 'image']);

      const oldLines = s.receiptFooterLines || [];
      const oldText = s.receiptFooter || '';
      if (oldLines.length > 0) {
        setFooterLine1(oldLines[0] || '');
        setFooterLine2(oldLines[1] || '');
      } else {
        setFooterLine1(oldText || 'Terima Kasih Atas Kunjungan Anda');
        setFooterLine2('Layanan Konsumen: 0812-xxxx-xxxx');
      }

      // Styles
      const styles = s.receiptFooterStyles || {};
      setLine1Bold(styles.line1?.bold ?? false);
      setLine1Italic(styles.line1?.italic ?? false);
      setLine1Underline(styles.line1?.underline ?? false);
      setLine2Bold(styles.line2?.bold ?? false);
      setLine2Italic(styles.line2?.italic ?? false);
      setLine2Underline(styles.line2?.underline ?? false);

      setHasInitialized(true);
    }
  }, [storeSettings, hasInitialized]);

  useEffect(() => {
    let isMounted = true;
    if (storeSettings?.logo) {
      removeWhiteBackground(storeSettings.logo).then(res => {
        if (isMounted) setProcessedLogo(res);
      });
    } else {
      setProcessedLogo(undefined);
    }
    return () => { isMounted = false; };
  }, [storeSettings?.logo]);

  useEffect(() => {
    let isMounted = true;
    const footerImgUrl = storeSettings?.receiptFooterImg || '';
    if (footerImgUrl) {
      setRawFooterImg(footerImgUrl);
      removeWhiteBackground(footerImgUrl).then(res => {
        if (isMounted) setFooterImg(res);
      });
    } else {
      setRawFooterImg('');
      setFooterImg('');
    }
    return () => { isMounted = false; };
  }, [storeSettings?.receiptFooterImg]);

  const executeSave = async (
    tmpl = template, img = footerImg, l1 = footerLine1, l2 = footerLine2,
    order = footerOrder, font = fontFamily, size = fontSize,
    lh = lineHeight, logo = showLogo, footerLogo = showFooterImg,
    l1B = line1Bold, l1I = line1Italic, l1U = line1Underline,
    l2B = line2Bold, l2I = line2Italic, l2U = line2Underline,
    type = footerType, qrUrl = footerQrUrl, rawImg = rawFooterImg
  ) => {
    if (!storeSettings?.id) return;

    let finalImgUrl = rawImg;
    if (rawImg && rawImg.startsWith('data:image')) {
      const res = await fetch(rawImg);
      const blob = await res.blob();
      const compressedDataUrl = await compressImage(blob, 0.2);
      const folderPath = `stores/${storeSettings.id}/receipt`;
      const uploadedUrl = await dbUploadFile(folderPath, 'footer-image.webp', compressedDataUrl);
      if (uploadedUrl) {
        const oldUrl = (storeSettings as any).receiptFooterImg;
        if (oldUrl && oldUrl !== uploadedUrl) await dbDeleteFile(oldUrl);
        finalImgUrl = uploadedUrl;
      }
    } else if (!rawImg) {
      const oldUrl = (storeSettings as any).receiptFooterImg;
      if (oldUrl) await dbDeleteFile(oldUrl);
    }

    await dbUpdate('storeSettings', storeSettings.id, {
      receiptTemplate: tmpl,
      receiptShowLogo: logo,
      receiptShowFooterImg: footerLogo,
      receiptShowCashier: true,
      receiptShowCustomer: true,
      receiptShowTable: true,
      receiptHeaderTitle: '',
      receiptTypography: {
        fontFamily: font,
        fontSize: size,
        lineHeight: lh,
        alignment: 'center',
        compactMode: true,
        paperWidth: '58mm'
      },
      receiptFooterType: type,
      receiptFooterQrUrl: qrUrl,
      receiptFooterImg: finalImgUrl || null,
      receiptFooterLines: [l1.trim(), l2.trim()],
      receiptFooterOrder: order,
      receiptFooterStyles: {
        line1: { bold: l1B, italic: l1I, underline: l1U },
        line2: { bold: l2B, italic: l2I, underline: l2U }
      }
    });
  };

  const handleManualSave = async () => {
    if (!hasEditAccess) { toast.error('Akses ditolak.'); return; }
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      await executeSave();
      setSaveStatus('saved');
      toast.success('Konfigurasi struk berhasil disimpan');
    } catch (err: any) {
      setSaveStatus('error');
      toast.error('Gagal menyimpan: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Format berkas tidak valid.');
    if (file.size > 5 * 1024 * 1024) return toast.error('Maksimal 5MB.');
    setSelectedFile(file);
    setCropOpen(true);
    e.target.value = '';
  };

  // DnD handler
  const handleFooterDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = footerOrder.indexOf(active.id as FooterBlock);
      const newIndex = footerOrder.indexOf(over.id as FooterBlock);
      const newOrder = arrayMove(footerOrder, oldIndex, newIndex);
      setFooterOrder(newOrder);
    }
  };

  const handleTestBluetooth = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        toast.info('Memulai pencarian perangkat Bluetooth...', { duration: 3000 });
      }
      
      if (!('bluetooth' in navigator)) {
        toast.error('Bluetooth tidak didukung di perangkat ini.');
        return;
      }

      // @ts-expect-error Web Bluetooth API
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'] // typical receipt printer UUID
      });

      if (!device) return;

      toast.success(`Berhasil terhubung ke ${device.name || 'Printer Bluetooth'}!`);
      
    } catch (e: any) {
      console.error(e);
      toast.error('Gagal menghubungkan Bluetooth: ' + (e.message || String(e)));
    }
  };

  // ─── Loading ───────────────────────────────────────────────────────
  if (!storeSettings) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-pulse">
        {/* Left column skeleton */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-card border border-border/50 rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-muted-foreground/10" />
                <div className="h-5 w-32 rounded bg-muted-foreground/10" />
              </div>
              <div className="h-8 w-20 rounded-xl bg-muted-foreground/10" />
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 rounded bg-muted-foreground/20" />
                <div className="h-10 w-full rounded-xl bg-muted-foreground/10" />
              </div>
            ))}
          </div>
        </div>

        {/* Right column (Receipt preview) skeleton */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-border/60 rounded-2xl p-5 shadow-md h-[400px] flex flex-col justify-between">
            <div className="space-y-4 flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-muted-foreground/10" />
              <div className="h-5 w-32 rounded bg-muted-foreground/20" />
              <div className="h-3 w-48 rounded bg-muted-foreground/10" />
            </div>
            <div className="space-y-2">
              <div className="h-0.5 w-full bg-dashed border-t border-border/50" />
              <div className="flex justify-between">
                <div className="h-4 w-20 rounded bg-muted-foreground/20" />
                <div className="h-4 w-12 rounded bg-muted-foreground/10" />
              </div>
              <div className="h-0.5 w-full bg-dashed border-t border-border/50" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Font class mapper ─────────────────────────────────────────────
  const previewFontClass = cn({
    'font-mono tracking-tighter': fontFamily === 'receipt-font',
    'font-mono': fontFamily === 'monospace',
    'font-sans tracking-tight': fontFamily === 'sans-serif',
    'font-serif': fontFamily === 'courier'
  });

  // ─── Mock Data (Bahasa Indonesia) ──────────────────────────────────
  const mockItems = {
    minimarket: [
      { name: 'KOPI SUSU GULA AREN DINGIN', qty: 2, price: 15000, total: 30000 },
      { name: 'ROTI BAKAR COKELAT SPESIAL KEJU MELELEH', qty: 1, price: 12000, total: 12000 },
      { name: 'TEH BOTOL SOSRO KOTAK', qty: 1, price: 5000, total: 5000 },
    ],
    fnb: [
      { name: 'Nasi Goreng Ayam Spesial Telur Ceplok', notes: 'Pedas Gila', qty: 1, price: 25000, total: 25000 },
      { name: 'Es Teh Manis Selasih', notes: 'Gula Sedikit', qty: 2, price: 5000, total: 10000 },
    ],
    classic: [
      { name: 'Mie Goreng Spesial Komplit Extra Bakso', qty: 1, price: 18000, total: 18000 },
      { name: 'Es Jeruk Nipis Madu', qty: 1, price: 8000, total: 8000 },
    ],
    minimalis: [
      { name: 'Kopi Hitam Gayo Arabica', qty: 2, price: 12000, total: 24000 },
      { name: 'Kentang Goreng Mentega', qty: 1, price: 15000, total: 15000 },
    ],
  };

  const rp = (n: number) => n.toLocaleString('id-ID');

  // Preview totals calculations
  const subtotalMinimarket = 47000;
  const taxMinimarket = storeSettings?.enableTax ? Math.round(subtotalMinimarket * (storeSettings.taxPercentage || 0) / 100) : 0;
  const adminMinimarket = storeSettings?.enableAdminFee ? (storeSettings.adminFeeValue || 0) : 0;
  const totalMinimarket = subtotalMinimarket + taxMinimarket + adminMinimarket;
  const cashMinimarket = totalMinimarket + 3000;
  const changeMinimarket = 3000;

  const subtotalFnB = 35000;
  const taxFnB = storeSettings?.enableTax ? Math.round(subtotalFnB * (storeSettings.taxPercentage || 0) / 100) : 0;
  const adminFnB = storeSettings?.enableAdminFee ? (storeSettings.adminFeeValue || 0) : 0;
  const totalFnB = subtotalFnB + taxFnB + adminFnB;

  const subtotalClassic = 26000;
  const taxClassic = storeSettings?.enableTax ? Math.round(subtotalClassic * (storeSettings.taxPercentage || 0) / 100) : 0;
  const adminClassic = storeSettings?.enableAdminFee ? (storeSettings.adminFeeValue || 0) : 0;
  const totalClassic = subtotalClassic + taxClassic + adminClassic;
  const cashClassic = totalClassic + 4000;
  const changeClassic = 4000;

  const subtotalMinimalis = 39000;
  const taxMinimalis = storeSettings?.enableTax ? Math.round(subtotalMinimalis * (storeSettings.taxPercentage || 0) / 100) : 0;
  const adminMinimalis = storeSettings?.enableAdminFee ? (storeSettings.adminFeeValue || 0) : 0;
  const totalMinimalis = subtotalMinimalis + taxMinimalis + adminMinimalis;

  const getFooterStyle = (block: string) => {
    const isLine1 = block === 'line1';
    const bold = isLine1 ? line1Bold : line2Bold;
    const italic = isLine1 ? line1Italic : line2Italic;
    const underline = isLine1 ? line1Underline : line2Underline;
    return {
      fontWeight: bold ? 'bold' : 'normal',
      fontStyle: italic ? 'italic' : 'normal',
      textDecoration: underline ? 'underline' : 'none'
    };
  };

  // ─── Template configs ──────────────────────────────────────────────
  const templates: { key: TemplateType; label: string; icon: React.ReactNode }[] = [
    { key: 'minimarket', label: 'Minimarket', icon: <Store className="w-5 h-5" /> },
    { key: 'fnb', label: 'Kafe / Resto', icon: <Utensils className="w-5 h-5" /> },
    { key: 'classic', label: 'Klasik', icon: <Coffee className="w-5 h-5" /> },
    { key: 'minimalis', label: 'Minimalis', icon: <Zap className="w-5 h-5" /> },
  ];

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in duration-200">
      {/* ═══ LEFT: Controls ═══ */}
      <div className={cn("lg:col-span-7 space-y-6", !hasEditAccess && "pointer-events-none opacity-75")}>
        {!hasEditAccess && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 pointer-events-auto select-none">
            <span className="text-base shrink-0">🔒</span>
            <span><strong>Mode Lihat Saja:</strong> Anda tidak memiliki izin untuk mengubah pengaturan struk pembelian.</span>
          </div>
        )}
        <Card className="rounded-2xl p-6 border border-border shadow-sm space-y-6 bg-card">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border/80">
            <h2 className="text-sm font-bold text-foreground">Pengaturan Struk</h2>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-medium hidden sm:block">
                {saveStatus === 'saving' && <span className="text-amber-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Menyimpan...</span>}
                {saveStatus === 'saved' && <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Tersimpan</span>}
                {saveStatus === 'error' && <span className="text-destructive">⚠️ Gagal</span>}
              </span>
              <Button onClick={handleManualSave} disabled={isSaving} size="sm" className="h-8 rounded-xl px-3 text-[11px] font-bold gap-1.5 shadow-sm">
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Simpan
              </Button>
            </div>
          </div>

          {/* iOS Toggle Switch (Premium Toggle) */}
          <div className="flex items-center justify-between pt-1 pb-3 px-1 border-b border-border/50">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="showLogo" className="text-xs font-bold text-foreground cursor-pointer select-none">
                Tampilkan Logo Toko
              </Label>
              <span className="text-[10px] text-muted-foreground">Menampilkan logo utama toko di bagian paling atas struk</span>
            </div>
            <button
              type="button"
              id="showLogo"
              onClick={() => setShowLogo(!showLogo)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/20",
                showLogo ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out",
                  showLogo ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>



          {/* §1 — Template Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <Sliders className="w-3.5 h-3.5 text-primary/70" /> Tema Struk
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {templates.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTemplate(t.key)}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-1.5 relative overflow-hidden",
                    template === t.key
                      ? "bg-primary/5 border-primary text-primary shadow-sm"
                      : "bg-card border-border hover:border-primary/40 hover:bg-muted/50 text-muted-foreground"
                  )}
                >
                  {template === t.key && (
                    <div className="absolute top-0 right-0 w-6 h-6 bg-primary rounded-bl-xl flex items-center justify-center">
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {t.icon}
                  <span className="text-[11px] font-bold">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* §2 — Typography */}
          <div className="space-y-3 pt-5 border-t border-border/50">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <Type className="w-3.5 h-3.5 text-primary/70" /> Tipografi
            </div>
            <div className="grid grid-cols-3 gap-3 bg-muted/20 p-3 rounded-xl border border-border/50">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold">Jenis Font</Label>
                <select
                  value={fontFamily}
                  onChange={e => setFontFamily(e.target.value as any)}
                  className="w-full text-xs h-9 px-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <option value="receipt-font">Thermal</option>
                  <option value="monospace">Monospace</option>
                  <option value="sans-serif">Sans-Serif</option>
                  <option value="courier">Courier</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold">Ukuran Font</Label>
                <Input
                  type="number"
                  min={8}
                  max={16}
                  step={1}
                  value={fontSize}
                  onChange={e => setFontSize(Number(e.target.value))}
                  className="h-9 text-xs rounded-lg bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold">Spasi Baris</Label>
                <select
                  value={lineHeight}
                  onChange={e => setLineHeight(e.target.value as any)}
                  className="w-full text-xs h-9 px-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <option value="tight">Rapat</option>
                  <option value="normal">Normal</option>
                  <option value="relaxed">Renggang</option>
                </select>
              </div>
            </div>
          </div>

          {/* §3 — Footer Editor (DnD) */}
          <div className="space-y-3 pt-5 border-t border-border/50">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <AlignCenter className="w-3.5 h-3.5 text-primary/70" /> Penutup Struk
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleFooterDragEnd}>
              <SortableContext items={footerOrder} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {footerOrder.map(block => (
                    <SortableFooterItem key={block} id={block}>
                      {block === 'line1' && (
                        <div className="flex items-start gap-2 w-full">
                          <textarea
                            value={footerLine1}
                            onChange={e => setFooterLine1(e.target.value)}
                            rows={2}
                            className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-muted/10 focus:bg-background focus:ring-1 focus:ring-primary min-h-[52px] transition-all placeholder:text-muted-foreground/30 font-medium resize-none focus:outline-none"
                            placeholder="Terima Kasih Atas Kunjungan Anda"
                          />
                          <div className="flex items-center border border-border rounded-lg p-0.5 bg-muted/30 shrink-0 h-8">
                            <button
                              type="button"
                              onClick={() => setLine1Bold(!line1Bold)}
                              className={cn(
                                "p-1 rounded text-xs font-black w-6 h-6 flex items-center justify-center transition-colors",
                                line1Bold ? "bg-primary text-primary-foreground font-black" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                              )}
                              title="Tebal"
                            >
                              B
                            </button>
                            <button
                              type="button"
                              onClick={() => setLine1Italic(!line1Italic)}
                              className={cn(
                                "p-1 rounded text-xs italic font-serif w-6 h-6 flex items-center justify-center transition-colors",
                                line1Italic ? "bg-primary text-primary-foreground font-black" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                              )}
                              title="Miring"
                            >
                              I
                            </button>
                            <button
                              type="button"
                              onClick={() => setLine1Underline(!line1Underline)}
                              className={cn(
                                "p-1 rounded text-xs underline w-6 h-6 flex items-center justify-center transition-colors",
                                line1Underline ? "bg-primary text-primary-foreground font-black" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                              )}
                              title="Garis Bawah"
                            >
                              U
                            </button>
                          </div>
                        </div>
                      )}
                      {block === 'line2' && (
                        <div className="flex items-start gap-2 w-full">
                          <textarea
                            value={footerLine2}
                            onChange={e => setFooterLine2(e.target.value)}
                            rows={2}
                            className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-muted/10 focus:bg-background focus:ring-1 focus:ring-primary min-h-[52px] transition-all placeholder:text-muted-foreground/30 font-medium resize-none focus:outline-none"
                            placeholder="Layanan Konsumen: 0812-xxxx-xxxx"
                          />
                          <div className="flex items-center border border-border rounded-lg p-0.5 bg-muted/30 shrink-0 h-8">
                            <button
                              type="button"
                              onClick={() => setLine2Bold(!line2Bold)}
                              className={cn(
                                "p-1 rounded text-xs font-black w-6 h-6 flex items-center justify-center transition-colors",
                                line2Bold ? "bg-primary text-primary-foreground font-black" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                              )}
                              title="Tebal"
                            >
                              B
                            </button>
                            <button
                              type="button"
                              onClick={() => setLine2Italic(!line2Italic)}
                              className={cn(
                                "p-1 rounded text-xs italic font-serif w-6 h-6 flex items-center justify-center transition-colors",
                                line2Italic ? "bg-primary text-primary-foreground font-black" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                              )}
                              title="Miring"
                            >
                              I
                            </button>
                            <button
                              type="button"
                              onClick={() => setLine2Underline(!line2Underline)}
                              className={cn(
                                "p-1 rounded text-xs underline w-6 h-6 flex items-center justify-center transition-colors",
                                line2Underline ? "bg-primary text-primary-foreground font-black" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                              )}
                              title="Garis Bawah"
                            >
                              U
                            </button>
                          </div>
                        </div>
                      )}
                      {block === 'image' && (
                        <div className="w-full space-y-3">
                          {/* Segment Controller & Main Switch */}
                          <div className="flex items-center justify-between border-b border-border/30 pb-2">
                            <div className="flex items-center gap-1.5">
                              <div className="inline-flex rounded-lg p-0.5 bg-muted border border-border/50 text-[10px] font-semibold h-7 select-none">
                                <button
                                  type="button"
                                  onClick={() => setFooterType('image')}
                                  className={cn(
                                    "px-3 rounded-md transition-all duration-200",
                                    footerType === 'image' 
                                      ? "bg-background text-foreground shadow-sm font-bold" 
                                      : "text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  Foto
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFooterType('qrcode')}
                                  className={cn(
                                    "px-3 rounded-md transition-all duration-200",
                                    footerType === 'qrcode' 
                                      ? "bg-background text-foreground shadow-sm font-bold" 
                                      : "text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  QR Code
                                </button>
                              </div>
                              {!showFooterImg && (
                                <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider select-none">
                                  Nonaktif
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Toggle Aktif/Nonaktif */}
                              <div className="flex items-center gap-1.5 bg-muted/40 px-2 py-0.5 rounded-lg border border-border/30 h-7 shrink-0">
                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                                  {showFooterImg ? 'Aktif' : 'Off'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setShowFooterImg(!showFooterImg)}
                                  className={cn(
                                    "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                                    showFooterImg ? "bg-primary border-primary" : "bg-muted border-muted-foreground/30"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-background shadow transition duration-200 ease-in-out",
                                      showFooterImg ? "translate-x-3.5" : "translate-x-0"
                                    )}
                                  />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Conditional Inputs */}
                          <div className={cn("transition-all duration-300", !showFooterImg && "opacity-45 pointer-events-none")}>
                            {footerType === 'image' ? (
                              <div className="flex items-center justify-between gap-3 bg-muted/20 p-2 rounded-xl border border-border/40">
                                <div className="flex items-center gap-3">
                                  <div 
                                    onClick={() => rawFooterImg && showFooterImg && setLightboxOpen(true)}
                                    className={cn(
                                      "h-9 w-9 rounded-lg border border-border bg-background flex items-center justify-center overflow-hidden shadow-inner shrink-0 transition-all",
                                      rawFooterImg && showFooterImg ? "cursor-zoom-in hover:border-primary/55 hover:scale-105 active:scale-95" : ""
                                    )}
                                  >
                                    {(rawFooterImg || footerImg) ? (
                                      <img 
                                        crossOrigin="anonymous"
                                        src={rawFooterImg || footerImg} 
                                        className="w-full h-full object-contain p-0.5" 
                                      />
                                    ) : (
                                      <ImageIcon className="w-4 h-4 text-muted-foreground/30" />
                                    )}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs text-foreground font-semibold">Foto Struk Footer</span>
                                    <span className="text-[10px] text-muted-foreground">Format webp/png transparan</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-7 text-[10px] px-2.5 rounded-lg bg-background font-semibold">
                                    <Camera className="w-3 h-3 mr-1" /> {footerImg ? 'Ganti' : 'Unggah'}
                                  </Button>
                                  {footerImg && (
                                    <Button type="button" variant="ghost" size="sm" onClick={() => { setFooterImg(undefined); setRawFooterImg(undefined); }} className="h-7 text-[10px] px-2 text-destructive hover:bg-destructive/10 rounded-lg">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3 bg-muted/20 p-2 rounded-xl border border-border/40 w-full">
                                <div 
                                  onClick={() => footerQrUrl && showFooterImg && setLightboxOpen(true)}
                                  className={cn(
                                    "h-9 w-9 rounded-lg border border-border bg-white flex items-center justify-center overflow-hidden shadow-sm shrink-0 transition-all",
                                    footerQrUrl && showFooterImg ? "cursor-zoom-in hover:border-primary/55 hover:scale-105 active:scale-95" : ""
                                  )}
                                >
                                  {footerQrUrl ? (
                                    <QRCodeSVG value={footerQrUrl} size={28} level="M" includeMargin={false} />
                                  ) : (
                                    <QrCode className="w-4 h-4 text-muted-foreground/30" />
                                  )}
                                </div>
                                <div className="flex-1 flex gap-2">
                                  <Input 
                                    type="text" 
                                    placeholder="Masukkan link/URL qrcode..." 
                                    value={footerQrUrl}
                                    onChange={(e) => setFooterQrUrl(e.target.value)}
                                    className="h-8 text-xs rounded-lg px-2.5 bg-background shadow-inner flex-1"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-2.5 shrink-0 rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-all active:scale-95 animate-in fade-in flex items-center gap-1.5"
                                    onClick={() => {
                                      if (!footerQrUrl) {
                                        toast.error('Kolom URL QR Code kosong.');
                                        return;
                                      }
                                      navigator.clipboard.writeText(footerQrUrl);
                                      toast.success('Link QR Code berhasil disalin.');
                                    }}
                                    title="Salin Link QR Code"
                                  >
                                    <Copy className="w-3.5 h-3.5 text-foreground" />
                                    <span className="text-xs font-semibold">Salin</span>
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </SortableFooterItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFileSelect} />
          </div>
        </Card>
      </div>

      {/* ═══ RIGHT: Live Preview ═══ */}
      <div className="lg:col-span-5 sticky top-6">
        <Card className="rounded-2xl border border-border shadow-sm bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border/80 flex items-center">
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-bold text-foreground">Live Preview Struk</h3>
            </div>
          </div>
          <div className="p-6 bg-slate-50/50 dark:bg-zinc-900/50 flex flex-col items-center justify-center min-h-[480px]">
            <div
              className={cn(
                "bg-white text-black p-5 sm:p-6 shadow-xl border border-gray-200 transition-all duration-500 select-none w-[280px]",
                previewFontClass
              )}
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: lineHeight === 'tight' ? '1.15' : lineHeight === 'relaxed' ? '1.5' : '1.3',
                clipPath: 'polygon(0 6px, 2% 0, 4% 6px, 6% 0, 8% 6px, 10% 0, 12% 6px, 14% 0, 16% 6px, 18% 0, 20% 6px, 22% 0, 24% 6px, 26% 0, 28% 6px, 30% 0, 32% 6px, 34% 0, 36% 6px, 38% 0, 40% 6px, 42% 0, 44% 6px, 46% 0, 48% 6px, 50% 0, 52% 6px, 54% 0, 56% 6px, 58% 0, 60% 6px, 62% 0, 64% 6px, 66% 0, 68% 6px, 70% 0, 72% 6px, 74% 0, 76% 6px, 78% 0, 80% 6px, 82% 0, 84% 6px, 86% 0, 88% 6px, 90% 0, 92% 6px, 94% 0, 96% 6px, 98% 0, 100% 6px, 100% calc(100% - 6px), 98% 100%, 96% calc(100% - 6px), 94% 100%, 92% calc(100% - 6px), 90% 100%, 88% calc(100% - 6px), 86% 100%, 84% calc(100% - 6px), 82% 100%, 80% calc(100% - 6px), 78% 100%, 76% calc(100% - 6px), 74% 100%, 72% calc(100% - 6px), 70% 100%, 68% calc(100% - 6px), 66% 100%, 64% calc(100% - 6px), 62% 100%, 60% calc(100% - 6px), 58% 100%, 56% calc(100% - 6px), 54% 100%, 52% calc(100% - 6px), 50% 100%, 48% calc(100% - 6px), 46% 100%, 44% calc(100% - 6px), 42% 100%, 40% calc(100% - 6px), 38% 100%, 36% calc(100% - 6px), 34% 100%, 32% calc(100% - 6px), 30% 100%, 28% calc(100% - 6px), 26% 100%, 24% calc(100% - 6px), 22% 100%, 20% calc(100% - 6px), 18% 100%, 16% calc(100% - 6px), 14% 100%, 12% calc(100% - 6px), 10% 100%, 8% calc(100% - 6px), 6% 100%, 4% calc(100% - 6px), 2% 100%, 0 calc(100% - 6px))'
              }}
            >
          {/* ── MINIMARKET ── */}
          {template === 'minimarket' && (
            <div className="w-full text-left uppercase text-[0.85em] relative z-10">
              {showLogo && storeSettings.logo && (
                <div className="mb-3">
                  <div className="w-28 h-8 mb-2 overflow-hidden bg-transparent">
                    <img crossOrigin="anonymous" src={processedLogo || storeSettings.logo} className="w-full h-full object-contain object-left grayscale" />
                  </div>
                </div>
              )}
              <div className="mb-2">
                <h2 className="font-extrabold">{storeSettings.storeName?.toUpperCase() || 'TOKO SUMBER BERKAH'}</h2>
                <p className="text-[0.8em]">{storeSettings.address?.toUpperCase() || 'JL. DR SOETOMO NO. 93'}</p>
              </div>
              <div className="mb-2 uppercase text-[0.85em] font-medium leading-normal space-y-0.5">
                <div>No. Struk: TX1780075515416</div>
                <div className="flex justify-between w-full">
                  <span>TGL: 29.05.26-17:08</span>
                  <span>KASIR: BASITH</span>
                </div>
                <div className="flex justify-between w-full">
                  <span>PELANGGAN: AHMAD</span>
                  <span>MEJA: 04</span>
                </div>
              </div>
              <div className="border-t border-dashed border-black my-2" />
              <div className="space-y-1 uppercase text-[0.85em]">
                {mockItems.minimarket.map((item, i) => (
                  <div key={i} className="flex leading-tight font-medium py-0.5">
                    <span className="flex-1 pr-1 break-words whitespace-normal">{item.name}</span>
                    <span className="w-4 text-center shrink-0">{item.qty}</span>
                    <span className="w-14 text-right shrink-0">{rp(item.price)}</span>
                    <span className="w-14 text-right shrink-0">{rp(item.total)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-black my-2" />
              <div className="space-y-0.5 uppercase text-[0.85em]">
                <div className="flex justify-end gap-4">
                  <span>HARGA JUAL :</span><span className="w-20 text-right">{rp(subtotalMinimarket)}</span>
                </div>
                {taxMinimarket > 0 && (
                  <div className="flex justify-end gap-4">
                    <span>PPN ({storeSettings?.taxPercentage || 0}%) :</span><span className="w-20 text-right">{rp(taxMinimarket)}</span>
                  </div>
                )}
                {adminMinimarket > 0 && (
                  <div className="flex justify-end gap-4">
                    <span>BIAYA ADMIN :</span><span className="w-20 text-right">{rp(adminMinimarket)}</span>
                  </div>
                )}
                <div className="border-t border-dashed border-black my-1" />
                <div className="flex justify-end gap-4 font-extrabold text-[1.05em]">
                  <span>TOTAL :</span><span className="w-20 text-right">{rp(totalMinimarket)}</span>
                </div>
                <div className="flex justify-end gap-4">
                  <span>TUNAI :</span><span className="w-20 text-right">{rp(cashMinimarket)}</span>
                </div>
                <div className="flex justify-end gap-4">
                  <span>KEMBALI :</span><span className="w-20 text-right">{rp(changeMinimarket)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── FNB (Kafe/Resto) ── */}
          {template === 'fnb' && (
            <div className="w-full text-left text-[0.85em] relative z-10">
              <div className="text-center mb-4">
                {showLogo && storeSettings.logo && (
                  <div className="w-14 h-14 mx-auto mb-2 overflow-hidden bg-transparent">
                    <img crossOrigin="anonymous" src={processedLogo || storeSettings.logo} className="w-full h-full object-contain grayscale" />
                  </div>
                )}
                <h2 className="font-bold text-[1.2em]">{storeSettings.storeName?.toUpperCase() || 'KOPI NUSANTARA'}</h2>
                <p className="text-[0.8em] opacity-90">{storeSettings.address || 'Jl. Dr Soetomo No. 93'}</p>
              </div>
              <div className="mb-2 text-[0.85em] font-medium leading-relaxed">
                <div className="grid grid-cols-[65px_auto] gap-x-1">
                  <span>No Struk</span><span>: TX1780075515416</span>
                  <span>Tanggal</span><span>: 29 Mei 2026, 19.14</span>
                  <span>Kasir</span><span>: Basith</span>
                  <span>Nama</span><span>: Ahmad</span>
                  <span>Tipe</span><span>: Dine In (Meja 04)</span>
                </div>
              </div>
              <div className="border-t border-dashed border-black my-2" />
              <div className="space-y-2 text-[0.85em]">
                {mockItems.fnb.map((item: any, i) => (
                  <div key={i} className="leading-tight font-medium">
                    <div className="font-bold break-words whitespace-normal">{item.name}</div>
                    <div className="flex justify-between text-[0.95em] mt-0.5">
                      <span>{item.qty} x {rp(item.price)}</span>
                      <span>{rp(item.total)}</span>
                    </div>
                    {item.notes && <div className="opacity-80 text-[0.9em] pl-1">Catatan: {item.notes}</div>}
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-black my-2" />
              <div className="grid grid-cols-[100px_auto] gap-x-1 ml-auto max-w-[220px] text-[0.85em] font-medium">
                <span>Subtotal</span><span>: {rp(subtotalFnB)}</span>
                {taxFnB > 0 && (
                  <>
                    <span>Pajak (PPN {storeSettings?.taxPercentage || 0}%)</span><span>: {rp(taxFnB)}</span>
                  </>
                )}
                {adminFnB > 0 && (
                  <>
                    <span>Biaya Admin</span><span>: {rp(adminFnB)}</span>
                  </>
                )}
                <span className="font-extrabold text-[1.05em]">Total</span><span className="font-extrabold text-[1.05em]">: {rp(totalFnB)}</span>
                <span>Bayar</span><span>: QRIS</span>
              </div>
            </div>
          )}

          {/* ── CLASSIC ── */}
          {template === 'classic' && (
            <div className="w-full text-[0.85em] relative z-10">
              <div className="text-center mb-3">
                {showLogo && storeSettings.logo && (
                  <div className="w-16 h-16 mx-auto mb-2 overflow-hidden bg-transparent">
                    <img crossOrigin="anonymous" src={processedLogo || storeSettings.logo} className="w-full h-full object-contain grayscale" />
                  </div>
                )}
                <h2 className="font-extrabold text-[1.25em] tracking-wide">{storeSettings.storeName || 'TOKO SAYA'}</h2>
                {storeSettings.address && <p className="text-[0.8em] mt-1 leading-tight">{storeSettings.address}</p>}
                {storeSettings.phone && <p className="text-[0.8em] leading-tight">{storeSettings.phone}</p>}
              </div>
              <div className="border-t border-dashed border-black/60 my-2" />
              <div className="text-[0.85em] space-y-0.5 font-medium leading-relaxed">
                <div className="flex justify-between"><span>No. Struk: TX1780075515416</span><span>Tunai</span></div>
                <div className="flex justify-between"><span>29/05/2026</span><span>19:30</span></div>
              </div>
              <div className="border-t border-dashed border-black/40 my-2" />
              <div className="space-y-0.5 text-left font-medium leading-relaxed">
                <div className="flex justify-between"><span className="text-gray-500">Kasir:</span><span className="font-semibold">Basith</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Pelanggan:</span><span className="font-semibold">Ahmad</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Meja / Tipe:</span><span className="font-bold">Meja 03</span></div>
              </div>
              <div className="border-t border-dashed border-black/60 my-2" />
              <div className="space-y-2 text-[0.85em]">
                {mockItems.classic.map((item, i) => (
                  <div key={i} className="font-medium">
                    <div className="flex justify-between font-semibold"><span className="break-words whitespace-normal">{item.name}</span><span>{rp(item.total)}</span></div>
                    <div className="text-[0.9em] text-gray-500 pl-2 mt-0.5">{item.qty} x {rp(item.price)}</div>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-black/60 my-2" />
              <div className="space-y-1 text-[0.85em] font-medium">
                <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{rp(subtotalClassic)}</span></div>
                {taxClassic > 0 && (
                  <div className="flex justify-between"><span className="text-gray-600">Pajak (PPN {storeSettings?.taxPercentage || 0}%)</span><span>{rp(taxClassic)}</span></div>
                )}
                {adminClassic > 0 && (
                  <div className="flex justify-between"><span className="text-gray-600">Biaya Admin</span><span>{rp(adminClassic)}</span></div>
                )}
                <div className="flex justify-between font-black text-[1.05em] border-t border-gray-300 pt-1.5 mt-1.5"><span>Total</span><span>{rp(totalClassic)}</span></div>
                <div className="flex justify-between mt-1"><span className="text-gray-600">Bayar</span><span>{rp(cashClassic)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Kembali</span><span>{rp(changeClassic)}</span></div>
              </div>
            </div>
          )}

          {/* ── MINIMALIS ── */}
          {template === 'minimalis' && (
            <div className="w-full text-center text-[0.85em] relative z-10">
              <div className="mb-4">
                {showLogo && storeSettings.logo && (
                  <div className="w-10 h-10 mx-auto mb-2 overflow-hidden bg-transparent">
                    <img crossOrigin="anonymous" src={processedLogo || storeSettings.logo} className="w-full h-full object-contain grayscale" />
                  </div>
                )}
                <h2 className="font-bold text-[1.1em]">{storeSettings.storeName || 'Toko'}</h2>
              </div>
              <div className="border-t border-solid border-black/20 my-3" />
              <div className="opacity-80 flex justify-between font-medium">
                <span>29/05/2026</span><span>TX1780075515416</span>
              </div>
              <div className="text-left space-y-0.5 mt-1 mb-2 font-medium leading-relaxed">
                <div className="flex justify-between"><span className="opacity-60">Kasir</span><span>Basith</span></div>
                <div className="flex justify-between"><span className="opacity-60">Pelanggan</span><span>Ahmad</span></div>
                <div className="flex justify-between"><span className="opacity-60">Meja</span><span>05</span></div>
              </div>
              <div className="border-t border-solid border-black/20 my-3" />
              <div className="space-y-1.5 text-left text-[0.85em]">
                {mockItems.minimalis.map((item, i) => (
                  <div key={i} className="flex justify-between font-medium">
                    <span className="break-words whitespace-normal">{item.qty}x {item.name}</span>
                    <span>{rp(item.total)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-solid border-black/20 my-3" />
              {(taxMinimalis > 0 || adminMinimalis > 0) && (
                <div className="flex justify-between text-[0.85em] font-medium opacity-80">
                  <span>Subtotal</span><span>{rp(subtotalMinimalis)}</span>
                </div>
              )}
              {taxMinimalis > 0 && (
                <div className="flex justify-between text-[0.85em] font-medium opacity-80">
                  <span>Pajak (PPN {storeSettings?.taxPercentage || 0}%)</span><span>{rp(taxMinimalis)}</span>
                </div>
              )}
              {adminMinimalis > 0 && (
                <div className="flex justify-between text-[0.85em] font-medium opacity-80">
                  <span>Biaya Admin</span><span>{rp(adminMinimalis)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-[1.05em] text-[0.85em] font-medium mt-1">
                <span>Total</span><span>{rp(totalMinimalis)}</span>
              </div>
              <div className="flex justify-between text-[0.85em] opacity-80 mt-1 font-medium">
                <span>Pembayaran</span><span>QRIS</span>
              </div>
            </div>
          )}

          {/* ── Dynamic Footer ── */}
          <div className="border-t border-black mt-4 mb-3 opacity-40" />
          <div className="text-center space-y-2 pb-8 text-[0.85em]">
            {footerOrder.map((block, idx) => {
              if (block === 'line1' && footerLine1) {
                return (
                  <p 
                    key={idx} 
                    className="whitespace-pre-wrap leading-relaxed" 
                    style={getFooterStyle('line1')}
                  >
                    {footerLine1}
                  </p>
                );
              }
              if (block === 'line2' && footerLine2) {
                return (
                  <p 
                    key={idx} 
                    className="whitespace-pre-wrap leading-snug" 
                    style={getFooterStyle('line2')}
                  >
                    {footerLine2}
                  </p>
                );
              }
              if (block === 'image' && showFooterImg) {
                if (footerType === 'qrcode' && footerQrUrl) {
                  return (
                    <div 
                      key={idx} 
                      className="my-2 flex justify-center cursor-zoom-in hover:scale-105 transition-transform"
                      onClick={() => setLightboxOpen(true)}
                    >
                      <QRCodeSVG 
                        value={footerQrUrl} 
                        size={72} 
                        level="M" 
                        includeMargin={true} 
                        className="mx-auto bg-white p-0.5 rounded"
                      />
                    </div>
                  );
                }
                if (footerType === 'image' && footerImg) {
                  return (
                    <div 
                      key={idx} 
                      className="my-2 cursor-zoom-in hover:opacity-85 transition-opacity"
                      onClick={() => setLightboxOpen(true)}
                    >
                      <img
                        crossOrigin="anonymous"
                        src={footerImg}
                        className="max-w-20 h-auto mx-auto object-contain grayscale rounded-xl"
                        style={{ filter: 'grayscale(1) contrast(1.2) brightness(0.9)' }}
                        alt="Footer"
                      />
                    </div>
                  );
                }
              }
              return null;
            })}
            </div>
          </div>
        </div>
      </Card>
    </div>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
            {footerType === 'qrcode' && footerQrUrl ? (
              <div className="bg-white p-6 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
                <QRCodeSVG 
                  value={footerQrUrl} 
                  size={240} 
                  level="M" 
                  includeMargin={true} 
                />
                <p className="text-center text-xs text-slate-500 font-mono mt-3 select-all max-w-[240px] break-all">{footerQrUrl}</p>
              </div>
            ) : (rawFooterImg || footerImg) ? (
              <img 
                crossOrigin="anonymous"
                src={rawFooterImg || footerImg} 
                alt="Footer Preview" 
                className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl animate-in zoom-in-95 duration-200" 
              />
            ) : null}
            <p className="text-white text-center text-xs mt-4 font-medium">Klik di luar untuk menutup</p>
          </div>
        </div>
      )}

      {/* Crop Modal */}
      <PhotoCropModal
        open={cropOpen}
        onOpenChange={setCropOpen}
        file={selectedFile}
        aspectRatio={1}
        onCropped={(url) => {
          setRawFooterImg(url);
          removeWhiteBackground(url).then(processedUrl => {
            setFooterImg(processedUrl);
          });
          setCropOpen(false);
          setSelectedFile(null);
        }}
      />
    </div>
  );
}
