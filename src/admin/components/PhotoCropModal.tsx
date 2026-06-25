import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { X, Check, ZoomIn, ZoomOut, Crop } from 'lucide-react';
import { compressImage } from '@/lib/image-utils';
import { toast } from 'sonner';

interface PhotoCropModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  onCropped: (croppedDataUrl: string) => void;
  disableCompression?: boolean;
  aspectRatio?: number; // Target ratio (width / height)
}

export default function PhotoCropModal({ open, onOpenChange, file, onCropped, disableCompression = false, aspectRatio = 1 }: PhotoCropModalProps) {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setImgSrc(url);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleCrop = async () => {
    if (!imgRef.current || !containerRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Output size
      const TARGET_WIDTH = aspectRatio > 1 ? 1260 : 800;
      const TARGET_HEIGHT = Math.round(TARGET_WIDTH / aspectRatio);
      canvas.width = TARGET_WIDTH;
      canvas.height = TARGET_HEIGHT;

      const img = imgRef.current;
      const container = containerRef.current; // Mengacu pada kotak transparan di tengah

      const containerRect = container.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();

      // Hitung rasio skala dari ukuran di layar ke ukuran asli gambar
      const scaleX = img.naturalWidth / imgRect.width;
      const scaleY = img.naturalHeight / imgRect.height;

      // Hitung koordinat crop relatif terhadap gambar
      const cropX = (containerRect.left - imgRect.left) * scaleX;
      const cropY = (containerRect.top - imgRect.top) * scaleY;
      const cropW = containerRect.width * scaleX;
      const cropH = containerRect.height * scaleY;

      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);
      ctx.drawImage(
        img,
        cropX, cropY, cropW, cropH, // Source
        0, 0, TARGET_WIDTH, TARGET_HEIGHT // Destination
      );

      // Konversi ke blob untuk diteruskan ke compressImage atau dikirim mentah
      const dataUrl = canvas.toDataURL('image/jpeg', disableCompression ? 1.0 : 0.9);
      
      if (disableCompression) {
        onCropped(dataUrl);
        return;
      }

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const croppedFile = new File([blob], 'cropped.jpg', { type: 'image/jpeg' });

      const finalDataUrl = await compressImage(croppedFile, aspectRatio > 1 ? 0.5 : 0.3);
      onCropped(finalDataUrl);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memotong gambar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) onOpenChange(false);
    }}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-background rounded-2xl border-border/60 shadow-2xl z-[999]">
        
        <DialogHeader className="p-4 border-b border-border/50 relative">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Crop className="w-5 h-5 text-primary" />
            Sesuaikan Foto
          </DialogTitle>
        </DialogHeader>

        <div className="p-0">
          {/* Area Editor Gambar */}
          <div className="relative w-full h-[320px] bg-neutral-900 flex items-center justify-center overflow-hidden">
            
            {/* Wrapper Interaksi (Drag & Drop) */}
            <div
              className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing touch-none flex items-center justify-center"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {/* Gambar yang bisa digeser */}
              <img
                ref={imgRef}
                src={imgSrc}
                alt="Crop preview"
                className="absolute max-w-none transition-transform duration-75 ease-out"
                style={{
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  top: '50%',
                  left: '50%',
                  transformOrigin: 'center center',
                  pointerEvents: 'none', // Pointer event ditangani oleh wrapper
                  minWidth: '100%',
                  minHeight: '100%',
                  objectFit: 'contain'
                }}
                onLoad={(e) => {
                  const target = e.currentTarget;
                  const parent = target.parentElement;
                  if (parent) {
                    const parentAspect = parent.offsetWidth / parent.offsetHeight;
                    const imgAspect = target.naturalWidth / target.naturalHeight;
                    if (imgAspect > parentAspect) {
                      target.style.height = '100%';
                      target.style.width = 'auto';
                    } else {
                      target.style.width = '100%';
                      target.style.height = 'auto';
                    }
                  }
                }}
              />

              {/* Overlay Masking & Kotak Crop (Tidak mengganggu pointer events) */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div 
                  ref={containerRef}
                  className="relative border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
                  style={{
                    width: aspectRatio > 1 ? '320px' : `${256 * aspectRatio}px`,
                    height: aspectRatio > 1 ? `${320 / aspectRatio}px` : '256px',
                    maxWidth: '90vw'
                  }}
                >
                  {/* Grid Rule of Thirds (3x3) */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-30">
                    <div className="border-b border-r border-white"></div>
                    <div className="border-b border-r border-white"></div>
                    <div className="border-b border-white"></div>
                    <div className="border-b border-r border-white"></div>
                    <div className="border-b border-r border-white"></div>
                    <div className="border-b border-white"></div>
                    <div className="border-r border-white"></div>
                    <div className="border-r border-white"></div>
                    <div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Kontrol Zoom */}
          <div className="px-6 py-5 bg-background">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              
              <Slider
                value={[zoom]}
                min={0.5}
                max={3}
                step={0.01}
                onValueChange={([val]) => setZoom(val)}
                className="flex-1 cursor-pointer"
              />
              
              <button 
                onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-border/50 gap-2 sm:justify-end flex-row bg-muted/20">
          <Button variant="outline" className="flex-1 sm:flex-none font-semibold rounded-xl" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button className="flex-1 sm:flex-none font-bold rounded-xl" onClick={handleCrop}>
            <Check className="w-4 h-4 mr-2" strokeWidth={3} />
            Simpan Foto
          </Button>
        </DialogFooter>
        
      </DialogContent>
    </Dialog>
  );
}
