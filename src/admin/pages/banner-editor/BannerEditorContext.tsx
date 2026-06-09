import React, { useState, useRef, useCallback, useEffect, createContext, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useDbQuery, dbInsert, dbUpdate, dbDelete, dbUploadFile } from '@/hooks/db-hooks';
import { compressImage } from '@/lib/image-utils';

// ============================================================================
// FLOOD FILL ALGORITHM (0 dependencies)
// ============================================================================

export const floodFillRemoveBackground = async (
  imageUrl: string,
  startX: number,
  startY: number,
  tolerance: number
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return reject('No canvas context');
      
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      const width = canvas.width;
      const height = canvas.height;
      
      const getPixelIdx = (x: number, y: number) => (y * width + x) * 4;
      const startIdx = getPixelIdx(startX, startY);
      const targetR = data[startIdx];
      const targetG = data[startIdx + 1];
      const targetB = data[startIdx + 2];
      const targetA = data[startIdx + 3];
      
      if (targetA === 0) return resolve(imageUrl);
      
      const visited = new Uint8Array(width * height);
      const queue = [[startX, startY]];
      
      const colorMatch = (r: number, g: number, b: number, a: number) => {
        if (a === 0) return false;
        return Math.abs(r - targetR) <= tolerance && Math.abs(g - targetG) <= tolerance && Math.abs(b - targetB) <= tolerance;
      };
      
      let head = 0;
      while (head < queue.length) {
        const [x, y] = queue[head++];
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        
        const linearIdx = y * width + x;
        if (visited[linearIdx]) continue;
        visited[linearIdx] = 1;
        
        const pIdx = linearIdx * 4;
        if (colorMatch(data[pIdx], data[pIdx + 1], data[pIdx + 2], data[pIdx + 3])) {
          data[pIdx + 3] = 0;
          queue.push([x + 1, y]);
          queue.push([x - 1, y]);
          queue.push([x, y + 1]);
          queue.push([x, y - 1]);
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject('Gagal memuat gambar (CORS/URL tidak valid)');
    img.src = imageUrl;
  });
};

// ============================================================================
// CONSTANTS
// ============================================================================

export const COLOR_PALETTE = [
  '#FFFFFF', '#F8FAFC', '#E2E8F0', '#94A3B8', '#475569', '#1E293B', '#0F172A', '#000000',
  '#FEF2F2', '#FCA5A5', '#EF4444', '#B91C1C', '#7F1D1D',
  '#FFF7ED', '#FED7AA', '#F97316', '#C2410C', '#7C2D12',
  '#FEFCE8', '#FEF08A', '#EAB308', '#A16207', '#713F12',
  '#F0FDF4', '#86EFAC', '#22C55E', '#15803D', '#14532D',
  '#ECFEFF', '#67E8F9', '#06B6D4', '#0E7490', '#164E63',
  '#EFF6FF', '#93C5FD', '#3B82F6', '#1D4ED8', '#1E3A8A',
  '#F5F3FF', '#C4B5FD', '#8B5CF6', '#6D28D9', '#4C1D95',
  '#FDF4FF', '#E879F9', '#A21CAF', '#701A75',
];

export const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

// ============================================================================
// SHARED UI PRIMITIVES
// ============================================================================

export const Button = ({ children, className = '', variant = 'primary', size = 'md', ...props }: any) => {
  const base = "inline-flex items-center justify-center rounded-xl font-bold transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: any = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-md",
    secondary: "bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100",
    outline: "border-2 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100",
    ghost: "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100",
    danger: "bg-red-500 hover:bg-red-600 text-white shadow-md",
  };
  const sizes: any = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
    icon: "h-10 w-10 p-0",
  };
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props}>{children}</button>;
};

export const Input = ({ className = '', ...props }: any) => (
  <input className={cn("flex h-10 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 text-zinc-900 dark:text-zinc-100 transition-all", className)} {...props} />
);

export const Label = ({ className = '', children, ...props }: any) => (
  <label className={cn("text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block mb-1.5", className)} {...props}>{children}</label>
);

export const Switch = ({ checked, onCheckedChange }: any) => (
  <button type="button" role="switch" aria-checked={checked} onClick={() => onCheckedChange(!checked)}
    className={cn("relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", checked ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700")}>
    <span className={cn("pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform", checked ? "translate-x-5" : "translate-x-0")} />
  </button>
);

export const Slider = ({ value, min, max, step = 1, onValueChange, onPointerUp, className = '' }: any) => (
  <input type="range" min={min} max={max} step={step} value={value[0]} onChange={(e) => onValueChange([parseFloat(e.target.value)])} onPointerUp={onPointerUp}
    className={cn("w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600", className)} />
);

export function PanelSection({ title, icon: Icon, children, defaultOpen = true }: any) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800 last:border-0">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
        <div className="flex items-center gap-2">{Icon && <Icon className="w-4 h-4" />}{title}</div>
        {open ? <ChevronUpIcon /> : <ChevronDownIcon />}
      </button>
      {open && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </div>
  );
}

const ChevronUpIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>;
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;

export function ColorPicker({ value, onChange }: any) {
  return (
    <div className="space-y-2">
      <div className="flex gap-1 overflow-x-auto pb-1 hide-scrollbar">
        {COLOR_PALETTE.map(c => (
          <button key={c} onClick={() => onChange(c)}
            style={{ backgroundColor: c }}
            className={cn(
              "shrink-0 w-6 h-6 rounded-full border-2 transition-all hover:scale-110",
              value?.toUpperCase() === c.toUpperCase()
                ? 'border-blue-500 scale-110 ring-2 ring-blue-400/40'
                : 'border-white/30 dark:border-zinc-600'
            )}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)}
          className="w-9 h-9 p-0.5 rounded-lg border border-zinc-300 dark:border-zinc-600 cursor-pointer bg-transparent shrink-0" />
        <Input value={value || ''} onChange={(e: any) => onChange(e.target.value)} className="h-9 text-xs font-mono uppercase" placeholder="#000000" />
      </div>
    </div>
  );
}

export function SliderRow({ label, value, min, max, step = 1, unit = '', defaultValue, onChange, onPointerUp }: any) {
  const handleDoubleClick = () => {
    if (defaultValue !== undefined) {
      onChange(defaultValue);
      toast.info(`Reset ke ${defaultValue}${unit}`);
      setTimeout(() => onPointerUp?.(), 50);
    }
  };
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center select-none">
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className="text-[11px] font-mono text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">{value}{unit}</span>
      </div>
      <div onDoubleClick={handleDoubleClick} title="Double-click untuk reset">
        <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]: any) => onChange(v)} onPointerUp={onPointerUp} />
      </div>
    </div>
  );
}

export function RichTextEditor({ value, onChange, placeholder, minHeight = '36px' }: any) {
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (editorRef.current && document.activeElement !== editorRef.current) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);
  const applyFormat = (cmd: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, null as any);
    onChange(editorRef.current?.innerHTML || '');
  };
  return (
    <div className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all">
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
        {[{ cmd: 'bold', label: 'B', cls: 'font-bold' }, { cmd: 'italic', label: 'I', cls: 'italic' }, { cmd: 'underline', label: 'U', cls: 'underline' }].map(({ cmd, label, cls }) => (
          <button key={cmd} type="button"
            onMouseDown={e => { e.preventDefault(); applyFormat(cmd); }}
            className={cn('w-6 h-6 rounded text-[11px] flex items-center justify-center transition-colors text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100', cls)}
          >{label}</button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={(e: any) => onChange(e.currentTarget.innerHTML)}
        style={{ minHeight }}
        className="w-full px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none rte-placeholder"
        data-placeholder={placeholder}
      />
    </div>
  );
}

// Custom SVG Icons
export const RotateCcwIcon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={props.className}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
);
export const RotateCwIcon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={props.className}><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
);
export const Wand2Icon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>
);

export interface OverlayData {
  id: string;
  imageUrl: string;
  x: number;
  y: number;
  scale: number;
  rotate: number;
  flipX: boolean;
  borderRadius: number;
  filter: { brightness: number; contrast: number; saturate: number; blur: number };
}

// ============================================================================
// CONTEXT TYPE
// ============================================================================

interface BannerEditorContextType {
  // Data stores
  banners: any;
  products: any;
  storeSettings: any;

  // Navigation
  navigate: ReturnType<typeof useNavigate>;
  editBanner: any;
  setEditBanner: any;

  // Form state
  bannerType: string; setBannerType: any;
  bannerProductId: string; setBannerProductId: any;
  bannerLink: string; setBannerLink: any;
  bannerIsActive: boolean; setBannerIsActive: any;
  bannerBgType: string; setBannerBgType: any;
  bannerBgColor: string; setBannerBgColor: any;
  bannerGradientLeft: string; setBannerGradientLeft: any;
  bannerGradientRight: string; setBannerGradientRight: any;
  bannerGradientAngle: number; setBannerGradientAngle: any;
  bannerImage: any; setBannerImage: any;
  bannerBadgeStyle: string; setBannerBadgeStyle: any;
  bannerHeadingStyle: string; setBannerHeadingStyle: any;
  bannerHeading: string; setBannerHeading: any;
  bannerTitle: string; setBannerTitle: any;
  bannerDescription: string; setBannerDescription: any;
  bannerButtonText: string; setBannerButtonText: any;
  overlays: OverlayData[]; setOverlays: any;
  activeOverlayId: string | null; setActiveOverlayId: any;

  // Canvas state

  activeSnapX: number | null; setActiveSnapX: any;
  activeSnapY: number | null; setActiveSnapY: any;
  layers: any[]; setLayers: any;
  selectedId: string | null; setSelectedId: any;
  zoom: number; setZoom: any;
  bgFilter: any; setBgFilter: any;
  bgGradientOverlayEnabled: boolean; setBgGradientOverlayEnabled: any;
  bgGradientOverlayColor: string; setBgGradientOverlayColor: any;
  bgGradientOverlayOpacityLeft: number; setBgGradientOverlayOpacityLeft: any;
  bgGradientOverlayOpacityRight: number; setBgGradientOverlayOpacityRight: any;
  bgGradientOverlayAngle: number; setBgGradientOverlayAngle: any;

  // History
  history: any[]; historyIndex: number;
  handleUndo: () => void;
  handleRedo: () => void;

  // Mobile
  isMobilePanelOpen: boolean; setIsMobilePanelOpen: any;

  // Crop
  cropBgFile: File | null; setCropBgFile: any;
  cropBgOpen: boolean; setCropBgOpen: any;

  // Refs
  canvasRef: React.RefObject<any>;
  bgFileInputRef: React.RefObject<any>;
  overlayFileInputRef: React.RefObject<any>;
  dragState: React.MutableRefObject<any>;

  // Functions
  getSnapshot: () => any;
  pushHistory: (customSnap?: any) => void;
  hexToRgb: (hex: string) => string;
  handleProductSelect: (prodId: string) => void;
  handleBannerTypeChange: (type: string) => void;
  onLayerPointerDown: (e: any, id: string) => void;
  onResizePointerDown: (e: any, id: string) => void;
  onOverlayPointerDown: (e: any, id: string) => void;
  handleBgImageSelect: (e: any) => void;
  handleBgCropSuccess: (croppedDataUrl: string) => Promise<void>;
  handleAddImageFile: (e: any) => void;
  handleSaveBanner: () => Promise<void>;

  // Computed
  canvasBg: string | undefined;
  bgFilterStyle: string;
}

const BannerEditorContext = createContext<BannerEditorContextType | null>(null);

export const useBannerEditor = () => {
  const ctx = useContext(BannerEditorContext);
  if (!ctx) throw new Error('useBannerEditor must be used within BannerEditorProvider');
  return ctx;
};

// ============================================================================
// PROVIDER
// ============================================================================

export function BannerEditorProvider({ children }: { children: React.ReactNode }) {
  // --- Data Stores ---
  const banners = useDbQuery('banners');
  const products = useDbQuery('products');
  const storeSettingsList = useDbQuery('storeSettings') ?? [];
  const storeSettings = storeSettingsList[0] || null;

  // --- Screens ---
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const hasInitialized = useRef(false);
  const [editBanner, setEditBanner] = useState<any>(null);

  // --- Form & Canvas Unified State ---
  const [bannerType, setBannerType] = useState('custom');
  const [bannerProductId, setBannerProductId] = useState('');
  const [bannerLink, setBannerLink] = useState('');
  const [bannerIsActive, setBannerIsActive] = useState(true);
  const [bannerBgType, setBannerBgType] = useState('gradient');
  const [bannerBgColor, setBannerBgColor] = useState('#1E293B');
  const [bannerGradientLeft, setBannerGradientLeft] = useState('#0061ff');
  const [bannerGradientRight, setBannerGradientRight] = useState('#60efff');
  const [bannerGradientAngle, setBannerGradientAngle] = useState(135);
  const [bannerImage, setBannerImage] = useState<any>(null);
  const [bannerBadgeStyle, setBannerBadgeStyle] = useState('solid');
  const [bannerHeadingStyle, setBannerHeadingStyle] = useState('glass');
  const [bannerHeading, setBannerHeading] = useState('SPESIAL PENAWARAN');
  const [bannerTitle, setBannerTitle] = useState('Promo Berkah Idul Adha');
  const [bannerDescription, setBannerDescription] = useState('Nikmati Keberkahan Idul Adha Promo Diskon 75% Dengan Kode Voucher BASITH');
  const [bannerButtonText, setBannerButtonText] = useState('Lihat Detail');
  
  const [overlays, setOverlays] = useState<OverlayData[]>([]);
  const [activeOverlayId, setActiveOverlayId] = useState<string | null>(null);

  // Canvas state
  const snapEnabled = true; // always on
  const [activeSnapX, setActiveSnapX] = useState<number | null>(null);
  const [activeSnapY, setActiveSnapY] = useState<number | null>(null);
  const [layers, setLayers] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [bgFilter, setBgFilter] = useState({ brightness: 100, contrast: 100, saturate: 100, blur: 0 });

  // Background Gradient Overlay
  const [bgGradientOverlayEnabled, setBgGradientOverlayEnabled] = useState(false);
  const [bgGradientOverlayColor, setBgGradientOverlayColor] = useState('#000000');
  const [bgGradientOverlayOpacityLeft, setBgGradientOverlayOpacityLeft] = useState(70);
  const [bgGradientOverlayOpacityRight, setBgGradientOverlayOpacityRight] = useState(0);
  const [bgGradientOverlayAngle, setBgGradientOverlayAngle] = useState(90);

  // History
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Mobile
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);

  // Crop
  const [cropBgFile, setCropBgFile] = useState<File | null>(null);
  const [cropBgOpen, setCropBgOpen] = useState(false);

  // Refs
  const canvasRef = useRef<any>(null);
  const bgFileInputRef = useRef<any>(null);
  const overlayFileInputRef = useRef<any>(null);
  const dragState = useRef<any>(null);

  // --- Snapshot / History ---
  const getSnapshot = useCallback(() => ({
    heading: bannerHeading, headingStyle: bannerHeadingStyle,
    title: bannerTitle, description: bannerDescription,
    buttonText: bannerButtonText, badgeStyle: bannerBadgeStyle,
    link: bannerLink, type: bannerType, productId: bannerProductId,
    bgType: bannerBgType, bgColor: bannerBgColor,
    gradientLeft: bannerGradientLeft, gradientRight: bannerGradientRight, gradientAngle: bannerGradientAngle,
    image: bannerImage, overlays,
    bgFilter,
    bgGradientOverlay: {
      enabled: bgGradientOverlayEnabled, color: bgGradientOverlayColor,
      opacityLeft: bgGradientOverlayOpacityLeft, opacityRight: bgGradientOverlayOpacityRight,
      angle: bgGradientOverlayAngle
    },
    layers
  }), [bannerHeading, bannerHeadingStyle, bannerTitle, bannerDescription, bannerButtonText, bannerBadgeStyle, bannerLink, bannerType, bannerProductId, bannerBgType, bannerBgColor, bannerGradientLeft, bannerGradientRight, bannerGradientAngle, bannerImage, overlays, bgFilter, bgGradientOverlayEnabled, bgGradientOverlayColor, bgGradientOverlayOpacityLeft, bgGradientOverlayOpacityRight, bgGradientOverlayAngle, layers]);

  const restoreSnapshot = useCallback((snap: any) => {
    if (!snap) return;
    setBannerHeading(snap.heading); setBannerHeadingStyle(snap.headingStyle);
    setBannerTitle(snap.title); setBannerDescription(snap.description);
    setBannerButtonText(snap.buttonText); setBannerBadgeStyle(snap.badgeStyle);
    setBannerLink(snap.link); setBannerType(snap.type);
    setBannerProductId(snap.productId); setBannerBgType(snap.bgType);
    setBannerBgColor(snap.bgColor); setBannerGradientLeft(snap.gradientLeft);
    setBannerGradientRight(snap.gradientRight); setBannerGradientAngle(snap.gradientAngle);
    setBannerImage(snap.image);
    setOverlays(snap.overlays || []);
    setBgFilter(snap.bgFilter);
    if (snap.bgGradientOverlay) {
      setBgGradientOverlayEnabled(snap.bgGradientOverlay.enabled);
      setBgGradientOverlayColor(snap.bgGradientOverlay.color);
      setBgGradientOverlayOpacityLeft(snap.bgGradientOverlay.opacityLeft);
      setBgGradientOverlayOpacityRight(snap.bgGradientOverlay.opacityRight);
      setBgGradientOverlayAngle(snap.bgGradientOverlay.angle);
    }
    setLayers(snap.layers);
  }, []);

  const pushHistory = useCallback((customSnap: any = null) => {
    const snap = customSnap || getSnapshot();
    setHistory(prev => {
      const nextHistory = prev.slice(0, historyIndex + 1);
      if (nextHistory.length > 0 && JSON.stringify(nextHistory[nextHistory.length - 1]) === JSON.stringify(snap)) {
        return prev;
      }
      const updated = [...nextHistory, snap];
      setHistoryIndex(updated.length - 1);
      return updated;
    });
  }, [getSnapshot, historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      restoreSnapshot(history[prevIndex]);
      toast.info('Undo berhasil');
    }
  }, [history, historyIndex, restoreSnapshot]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      restoreSnapshot(history[nextIndex]);
      toast.info('Redo berhasil');
    }
  }, [history, historyIndex, restoreSnapshot]);

  const hexToRgb = useCallback((hex: string) => {
    if (!hex) return '0, 0, 0';
    const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;
    const r = parseInt(cleanHex.slice(0, 2), 16) || 0;
    const g = parseInt(cleanHex.slice(2, 4), 16) || 0;
    const b = parseInt(cleanHex.slice(4, 6), 16) || 0;
    return `${r}, ${g}, ${b}`;
  }, []);

  // --- Product / Image Handlers ---
  const handleProductSelect = useCallback((prodId: string) => {
    setBannerProductId(prodId);
    if (!prodId) return;
    const prod = products?.find((p: any) => String(p.id) === String(prodId));
    if (prod && prod.photo) {
      setOverlays((prev: OverlayData[]) => {
        if (prev.length >= 2) {
          toast.warning('Maksimal 2 overlay');
          return prev;
        }
        toast.success(`Gambar produk "${prod.name}" berhasil ditambahkan!`);
        return [...prev, {
          id: `overlay_${Date.now()}`,
          imageUrl: prod.photo,
          x: 80, y: 50, scale: 1, rotate: 0, flipX: false, borderRadius: 0,
          filter: { brightness: 100, contrast: 100, saturate: 100, blur: 0 }
        }];
      });
    } else if (prod) {
      toast.warning(`Produk "${prod.name}" tidak memiliki foto.`);
    }
  }, [products]);

  const handleBannerTypeChange = useCallback((type: string) => {
    setBannerType(type);
    if (type !== 'menu') { setBannerProductId(''); }
  }, []);

  // --- Drag / Resize ---
  const onLayerPointerDown = useCallback((e: any, layerId: string) => {
    e.stopPropagation();
    const layer = layers.find((l: any) => l.id === layerId);
    if (!layer) return;
    setSelectedId(layerId);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dragState.current = { id: layerId, startX: e.clientX, startY: e.clientY, origX: layer.x, origY: layer.y };

    const onMove = (me: any) => {
      if (!dragState.current) return;
      if (me.cancelable) me.preventDefault();
      const dx = (me.clientX - dragState.current.startX) / rect.width * 100;
      const dy = (me.clientY - dragState.current.startY) / rect.height * 100;
      let nx = dragState.current.origX + dx;
      let ny = dragState.current.origY + dy;
      let snappedX: number | null = null;
      let snappedY: number | null = null;
      if (snapEnabled) {
        const snapPoints = [8, 50, 92];
        const threshold = 1.6;
        for (const pt of snapPoints) {
          if (Math.abs(nx - pt) < threshold) { nx = pt; snappedX = pt; }
          if (Math.abs(ny - pt) < threshold) { ny = pt; snappedY = pt; }
        }
      }
      if (nx < 0) nx = 0; if (nx > 100) nx = 100;
      if (ny < 0) ny = 0; if (ny > 100) ny = 100;
      nx = Math.round(nx * 10) / 10;
      ny = Math.round(ny * 10) / 10;
      setActiveSnapX(snappedX);
      setActiveSnapY(snappedY);
      setLayers(prev => prev.map(l => l.id === layerId ? { ...l, x: nx, y: ny } : l));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      dragState.current = null;
      setActiveSnapX(null);
      setActiveSnapY(null);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
  }, [layers]);

  const onResizePointerDown = useCallback((e: any, layerId: string) => {
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const layer = layers.find((l: any) => l.id === layerId);
    if (!layer) return;
    const startX = e.clientX;
    const startW = layer.w ?? 55;
    const onMove = (me: any) => {
      if (me.cancelable) me.preventDefault();
      const dx = (me.clientX - startX) / rect.width * 100;
      const nw = Math.round(Math.max(10, Math.min(92, startW + dx)) * 10) / 10;
      setLayers(prev => prev.map(l => l.id === layerId ? { ...l, w: nw } : l));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      pushHistory();
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
  }, [layers, pushHistory]);

  const onOverlayPointerDown = useCallback((e: any, id: string) => {
    e.stopPropagation();
    const overlay = overlays.find((o: any) => o.id === id);
    if (!overlay) return;
    setActiveOverlayId(id);
    setSelectedId(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dragState.current = { id, startX: e.clientX, startY: e.clientY, origX: overlay.x, origY: overlay.y };

    const onMove = (me: any) => {
      if (!dragState.current) return;
      if (me.cancelable) me.preventDefault();
      const dx = (me.clientX - dragState.current.startX) / rect.width * 100;
      const dy = (me.clientY - dragState.current.startY) / rect.height * 100;
      let nx = dragState.current.origX + dx;
      let ny = dragState.current.origY + dy;
      let snappedX: number | null = null;
      let snappedY: number | null = null;
      if (snapEnabled) {
        const snapPoints = [8, 50, 92];
        const threshold = 1.6;
        for (const pt of snapPoints) {
          if (Math.abs(nx - pt) < threshold) { nx = pt; snappedX = pt; }
          if (Math.abs(ny - pt) < threshold) { ny = pt; snappedY = pt; }
        }
      }
      if (nx < 0) nx = 0; if (nx > 100) nx = 100;
      if (ny < 0) ny = 0; if (ny > 100) ny = 100;
      nx = Math.round(nx * 10) / 10;
      ny = Math.round(ny * 10) / 10;
      setActiveSnapX(snappedX);
      setActiveSnapY(snappedY);
      setOverlays((prev: OverlayData[]) => prev.map(o => o.id === id ? { ...o, x: nx, y: ny } : o));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      dragState.current = null;
      setActiveSnapX(null);
      setActiveSnapY(null);
      pushHistory();
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
  }, [overlays, pushHistory, snapEnabled]);

  // --- File Handlers ---
  const handleBgImageSelect = useCallback((e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropBgFile(file);
    setCropBgOpen(true);
    if (bgFileInputRef.current) bgFileInputRef.current.value = '';
  }, []);

  const handleBgCropSuccess = useCallback(async (croppedDataUrl: string) => {
    setCropBgOpen(false);
    setBannerImage(croppedDataUrl);
    toast.success("Gambar background berhasil ditambahkan!");
    setCropBgFile(null);
    try {
      const res = await fetch(croppedDataUrl);
      const blob = await res.blob();
      const compressedDataUrl = await compressImage(blob, 0.5);
      const url = await dbUploadFile('banners', `bg_${Date.now()}`, compressedDataUrl);
      if (url) setBannerImage(url);
    } catch (e) {
      console.error("Background upload error", e);
    }
  }, []);

  const handleAddImageFile = useCallback((e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const dataUrl = ev.target?.result as string;
      setOverlays((prev: OverlayData[]) => {
        if (prev.length >= 2) {
          toast.warning('Maksimal 2 overlay');
          return prev;
        }
        return [...prev, {
          id: `overlay_${Date.now()}`,
          imageUrl: dataUrl,
          x: 80, y: 50, scale: 1, rotate: 0, flipX: false, borderRadius: 0,
          filter: { brightness: 100, contrast: 100, saturate: 100, blur: 0 }
        }];
      });
      toast.success("Gambar stiker overlay berhasil ditambahkan!");
      try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const compressedDataUrl = await compressImage(blob, 0.5);
        const url = await dbUploadFile('banners', `overlay_${Date.now()}`, compressedDataUrl);
        if (url) {
          setOverlays((prev: OverlayData[]) => prev.map((o, i) => i === prev.length - 1 ? { ...o, imageUrl: url } : o));
        }
      } catch (err) {
        console.error("Overlay upload error", err);
      }
    };
    reader.readAsDataURL(file);
    if (overlayFileInputRef.current) overlayFileInputRef.current.value = '';
  }, []);

  // --- Editor Open/Close ---
  const openEditor = useCallback((banner: any = null) => {
    if (banner) {
      setEditBanner(banner);
      setBannerType(banner.type || 'custom');
      setBannerProductId(banner.productId ? String(banner.productId) : '');
      setBannerLink(banner.link || '');
      setBannerIsActive(banner.isActive !== false);
      setBannerBgType(banner.bgType || 'gradient');
      setBannerBgColor(banner.bgColor || '#1E293B');

      let gradientLeftVal = '#0061ff', gradientRightVal = '#60efff', gradientAngleVal = 135;
      if (banner.bgGradient) {
        const match = banner.bgGradient.match(/linear-gradient\((\d+)deg,\s*(.+?),\s*(.+?)\)/);
        if (match) { gradientAngleVal = Number(match[1]); gradientLeftVal = match[2]; gradientRightVal = match[3]; }
      }
      setBannerGradientLeft(gradientLeftVal);
      setBannerGradientRight(gradientRightVal);
      setBannerGradientAngle(gradientAngleVal);
      setBannerImage(banner.imageUrl || null);
      const bgFilterVal = banner.canvasBgFilter || { brightness: 100, contrast: 100, saturate: 100, blur: 0 };
      setBgFilter(bgFilterVal);
      const overlayGradient = banner.bgGradientOverlay || { enabled: false, color: '#000000', opacityLeft: 70, opacityRight: 0, angle: 90 };
      setBgGradientOverlayEnabled(overlayGradient.enabled || false);
      setBgGradientOverlayColor(overlayGradient.color || '#000000');
      setBgGradientOverlayOpacityLeft(overlayGradient.opacityLeft !== undefined ? overlayGradient.opacityLeft : 70);
      setBgGradientOverlayOpacityRight(overlayGradient.opacityRight !== undefined ? overlayGradient.opacityRight : 0);
      setBgGradientOverlayAngle(overlayGradient.angle !== undefined ? overlayGradient.angle : 90);
      setBannerHeading(banner.heading || ''); setBannerTitle(banner.title || '');
      setBannerDescription(banner.description || ''); setBannerButtonText(banner.buttonText || '');
      setBannerBadgeStyle(banner.badgeStyle || 'solid'); setBannerHeadingStyle(banner.headingStyle || 'glass');

      const headingP = banner.headingPos ?? { x: 10, y: 20, w: 40 };
      const titleP = banner.titlePos ?? { x: 10, y: 38, w: 60 };
      const descP = banner.descPos ?? { x: 10, y: 60, w: 60 };
      const buttonP = banner.buttonPos ?? { x: 10, y: 82 };
      
      let loadedOverlays = banner.overlays || [];
      if (loadedOverlays.length === 0 && banner.overlayImageUrl) {
        loadedOverlays = [{
          id: 'overlay-legacy',
          imageUrl: banner.overlayImageUrl,
          x: banner.overlayPos?.x ?? 80,
          y: banner.overlayPos?.y ?? 50,
          scale: banner.overlayScale ?? 1,
          rotate: banner.overlayRotate ?? 0,
          flipX: banner.overlayFlipX ?? false,
          borderRadius: banner.overlayBorderRadius ?? 0,
          filter: banner.canvasOverlayFilter ?? { brightness: 100, contrast: 100, saturate: 100, blur: 0 }
        }];
      }
      setOverlays(loadedOverlays);
      setActiveOverlayId(null);

      const loadedLayers = [
        { id: 'heading-box', role: 'heading-box', x: headingP.x, y: headingP.y, w: headingP.w ?? 40, zIndex: 10, visible: true },
        { id: 'title-box', role: 'title-box', x: titleP.x, y: titleP.y, w: titleP.w ?? 60, zIndex: 10, visible: true },
        { id: 'desc-box', role: 'desc-box', x: descP.x, y: descP.y, w: descP.w ?? 60, zIndex: 10, visible: true },
        { id: 'button-box', role: 'button-box', x: buttonP.x, y: buttonP.y, zIndex: 10, visible: true }
      ];
      setLayers(loadedLayers);
      const initialSnapshot = {
        heading: banner.heading || '', headingStyle: banner.headingStyle || 'glass',
        title: banner.title || '', description: banner.description || '',
        buttonText: banner.buttonText || '', badgeStyle: banner.badgeStyle || 'solid',
        link: banner.link || '', type: banner.type || 'custom',
        productId: banner.productId ? String(banner.productId) : '',
        bgType: banner.bgType || 'gradient', bgColor: banner.bgColor || '#1E293B',
        gradientLeft: gradientLeftVal, gradientRight: gradientRightVal, gradientAngle: gradientAngleVal,
        image: banner.imageUrl || null, 
        overlays: loadedOverlays,
        bgFilter: bgFilterVal,
        bgGradientOverlay: overlayGradient, layers: loadedLayers
      };
      setHistory([initialSnapshot]); setHistoryIndex(0);
    } else {
      setEditBanner(null); setBannerType('custom'); setBannerProductId('');
      setBannerLink(''); setBannerIsActive(true); setBannerBgType('gradient');
      setBannerBgColor('#1E293B'); setBannerGradientLeft('#0061ff');
      setBannerGradientRight('#60efff'); setBannerGradientAngle(135);
      setBannerImage(null);
      setBgFilter({ brightness: 100, contrast: 100, saturate: 100, blur: 0 });
      setBgGradientOverlayEnabled(false); setBgGradientOverlayColor('#000000');
      setBgGradientOverlayOpacityLeft(70); setBgGradientOverlayOpacityRight(0);
      setBgGradientOverlayAngle(90);
      setBannerHeading('SPESIAL PENAWARAN'); setBannerTitle('Promo Berkah Idul Adha');
      setBannerDescription('Nikmati Keberkahan Idul Adha Promo Diskon 75% Dengan Kode Voucher BASITH');
      setBannerButtonText('Lihat Detail'); setBannerBadgeStyle('solid'); setBannerHeadingStyle('glass');
      setOverlays([]); setActiveOverlayId(null);
      
      const defaultLayers = [
        { id: 'heading-box', role: 'heading-box', x: 10, y: 20, w: 40, zIndex: 10, visible: true },
        { id: 'title-box', role: 'title-box', x: 10, y: 38, w: 60, zIndex: 10, visible: true },
        { id: 'desc-box', role: 'desc-box', x: 10, y: 60, w: 60, zIndex: 10, visible: true },
        { id: 'button-box', role: 'button-box', x: 10, y: 82, zIndex: 10, visible: true }
      ];
      setLayers(defaultLayers);
      const initialSnapshot = {
        heading: 'SPESIAL PENAWARAN', headingStyle: 'glass',
        title: 'Promo Berkah Idul Adha',
        description: 'Nikmati Keberkahan Idul Adha Promo Diskon 75% Dengan Kode Voucher BASITH',
        buttonText: 'Lihat Detail', badgeStyle: 'solid', link: '', type: 'custom', productId: '',
        bgType: 'gradient', bgColor: '#1E293B',
        gradientLeft: '#0061ff', gradientRight: '#60efff', gradientAngle: 135,
        image: null, overlays: [],
        bgFilter: { brightness: 100, contrast: 100, saturate: 100, blur: 0 },
        bgGradientOverlay: { enabled: false, color: '#000000', opacityLeft: 70, opacityRight: 0, angle: 90 },
        layers: defaultLayers
      };
      setHistory([initialSnapshot]); setHistoryIndex(0);
    }
    setSelectedId(null); setZoom(100);
  }, []);

  // --- Initialize from URL params ---
  useEffect(() => {
    if (hasInitialized.current) return;
    if (id === 'new') { hasInitialized.current = true; openEditor(null); return; }
    if (banners && (banners as any[]).length > 0) {
      const b = (banners as any[]).find((b: any) => String(b.id) === id);
      if (b) { hasInitialized.current = true; openEditor(b); }
      else { hasInitialized.current = true; navigate('/admin/banner'); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banners, id]);

  // --- Save ---
  const handleSaveBanner = useCallback(async () => {
    if (!bannerTitle.trim()) { toast.error('Judul Utama (Title) tidak boleh kosong'); return; }
    const loadingToastId = toast.loading('Menyimpan banner...');
    try {
      let finalBannerImage = bannerImage;
      if (bannerImage && bannerImage.startsWith('data:image')) {
        const res = await fetch(bannerImage);
        const blob = await res.blob();
        const compressedDataUrl = await compressImage(blob, 0.5);
        const url = await dbUploadFile('banners', `bg_${Date.now()}`, compressedDataUrl);
        if (url) finalBannerImage = url;
      }
      const headL = layers.find((l: any) => l.role === 'heading-box') || { x: 10, y: 20 };
      const titleL = layers.find((l: any) => l.role === 'title-box') || { x: 10, y: 38 };
      const descL = layers.find((l: any) => l.role === 'desc-box') || { x: 10, y: 60 };
      const buttonL = layers.find((l: any) => l.role === 'button-box') || { x: 10, y: 82 };
      const bannerData = {
        type: bannerType, heading: bannerHeading.trim(), title: bannerTitle.trim(),
        description: bannerDescription.trim(), voucherId: null,
        productId: bannerType === 'menu' ? Number(bannerProductId) : null,
        imageUrl: finalBannerImage, buttonText: bannerButtonText.trim(),
        link: bannerLink.trim(), isActive: bannerIsActive,
        bgType: bannerBgType, bgColor: bannerBgType === 'solid' ? bannerBgColor : null,
        bgGradient: bannerBgType === 'gradient' ? `linear-gradient(${bannerGradientAngle}deg, ${bannerGradientLeft}, ${bannerGradientRight})` : null,
        badgeStyle: bannerBadgeStyle, headingStyle: bannerHeadingStyle,
        canvasLayers: [], canvasBgFilter: bgFilter,
        bgGradientOverlay: {
          enabled: bgGradientOverlayEnabled, color: bgGradientOverlayColor,
          opacityLeft: bgGradientOverlayOpacityLeft, opacityRight: bgGradientOverlayOpacityRight,
          angle: bgGradientOverlayAngle
        },
        createdAt: editBanner ? editBanner.createdAt : new Date().toISOString(),
        headingPos: { x: Math.round(headL.x), y: Math.round(headL.y), w: Math.round(headL.w ?? 40) },
        titlePos: { x: Math.round(titleL.x), y: Math.round(titleL.y), w: Math.round(titleL.w ?? 60) },
        descPos: { x: Math.round(descL.x), y: Math.round(descL.y), w: Math.round(descL.w ?? 60) },
        buttonPos: { x: Math.round(buttonL.x), y: Math.round(buttonL.y) },
        overlays,
        // Clear legacy single-overlay fields to prevent ghost overlays in customer app
        overlayImageUrl: null, overlayPos: null, overlayFlipX: null,
        overlayRotate: null, overlayScale: null, overlayBorderRadius: null,
        canvasOverlayFilter: null,
      };
      if (editBanner) {
        await dbUpdate('banners', editBanner.id, bannerData);
        toast.success('Banner berhasil diperbarui!', { id: loadingToastId });
      } else {
        await dbInsert('banners', bannerData);
        toast.success('Banner baru berhasil diterbitkan!', { id: loadingToastId });
      }
      setTimeout(() => navigate('/admin/banner'), 1000);
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan banner', { id: loadingToastId });
    }
  }, [bannerTitle, bannerImage, overlays, layers, bannerType, bannerHeading, bannerDescription, bannerButtonText, bannerProductId, bannerLink, bannerIsActive, bannerBgType, bannerBgColor, bannerGradientAngle, bannerGradientLeft, bannerGradientRight, bannerBadgeStyle, bannerHeadingStyle, bgFilter, bgGradientOverlayEnabled, bgGradientOverlayColor, bgGradientOverlayOpacityLeft, bgGradientOverlayOpacityRight, bgGradientOverlayAngle, editBanner, navigate]);

  // --- Computed ---
  const canvasBg = bannerBgType === 'solid' ? bannerBgColor : bannerBgType === 'gradient' ? `linear-gradient(${bannerGradientAngle}deg, ${bannerGradientLeft}, ${bannerGradientRight})` : undefined;
  const bgFilterStyle = `brightness(${bgFilter.brightness}%) contrast(${bgFilter.contrast}%) saturate(${bgFilter.saturate}%) blur(${bgFilter.blur}px)`;

  const value: BannerEditorContextType = {
    banners, products, storeSettings, navigate, editBanner, setEditBanner,
    bannerType, setBannerType, bannerProductId, setBannerProductId,
    bannerLink, setBannerLink, bannerIsActive, setBannerIsActive,
    bannerBgType, setBannerBgType, bannerBgColor, setBannerBgColor,
    bannerGradientLeft, setBannerGradientLeft, bannerGradientRight, setBannerGradientRight,
    bannerGradientAngle, setBannerGradientAngle, bannerImage, setBannerImage,
    bannerBadgeStyle, setBannerBadgeStyle, bannerHeadingStyle, setBannerHeadingStyle,
    bannerHeading, setBannerHeading, bannerTitle, setBannerTitle,
    bannerDescription, setBannerDescription, bannerButtonText, setBannerButtonText,
    overlays, setOverlays, activeOverlayId, setActiveOverlayId,
    activeSnapX, setActiveSnapX, activeSnapY, setActiveSnapY,
    layers, setLayers, selectedId, setSelectedId, zoom, setZoom,
    bgFilter, setBgFilter,
    bgGradientOverlayEnabled, setBgGradientOverlayEnabled,
    bgGradientOverlayColor, setBgGradientOverlayColor,
    bgGradientOverlayOpacityLeft, setBgGradientOverlayOpacityLeft,
    bgGradientOverlayOpacityRight, setBgGradientOverlayOpacityRight,
    bgGradientOverlayAngle, setBgGradientOverlayAngle,
    history, historyIndex, handleUndo, handleRedo,
    isMobilePanelOpen, setIsMobilePanelOpen,
    cropBgFile, setCropBgFile, cropBgOpen, setCropBgOpen,
    canvasRef, bgFileInputRef, overlayFileInputRef, dragState,
    getSnapshot, pushHistory, hexToRgb,
    handleProductSelect, handleBannerTypeChange,
    onLayerPointerDown, onOverlayPointerDown, onResizePointerDown,
    handleBgImageSelect, handleBgCropSuccess, handleAddImageFile,
    handleSaveBanner, canvasBg, bgFilterStyle,
  };

  return (
    <BannerEditorContext.Provider value={value}>
      {children}
    </BannerEditorContext.Provider>
  );
}
