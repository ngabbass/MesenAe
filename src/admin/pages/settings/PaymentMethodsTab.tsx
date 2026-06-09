import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useDbQuery, dbInsert, dbUpdate, dbDelete, dbBatchUpdateSortOrder } from '@/hooks/db-hooks';
import type { PaymentMethod } from '@/hooks/db-hooks';
import { Section, SettingCard } from '../Settings';
import { Plus, CreditCard, Copy, Loader2, Edit2, Trash2, GripVertical, Scan, SwitchCamera, CameraOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Capacitor } from '@capacitor/core';
import { Haptics } from '@capacitor/haptics';
import jsQR from 'jsqr';

const PM_CAT_ICONS: Record<string, React.ReactNode> = {
  tunai: <img src="/ico/tunai.png" alt="tunai" className="w-5 h-5 object-contain inline-block" />, 
  transfer: <img src="/ico/transfer.png" alt="transfer" className="w-5 h-5 object-contain inline-block" />, 
  'e-wallet': <img src="/ico/ewallet.png" alt="e-wallet" className="w-5 h-5 object-contain inline-block" />, 
  qris: <img src="/ico/qris.png" alt="qris" className="w-5 h-5 object-contain inline-block" />, 
  lainnya: <img src="/ico/lainnya.png" alt="lainnya" className="w-5 h-5 object-contain inline-block" />,
};

function SortablePaymentMethodItem({ id, pm, isLast, hasEditAccess, onEdit, onDelete }: { id: string, pm: PaymentMethod, isLast: boolean, hasEditAccess: boolean, onEdit: () => void, onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    position: 'relative' as any,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors bg-card', !isLast && 'border-b border-border/50', isDragging && 'shadow-lg border border-primary/20 opacity-90 rounded-lg')}
    >
      {hasEditAccess && (
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground mr-1 touch-none">
          <GripVertical className="w-4 h-4" />
        </div>
      )}
      <span className="text-base w-6 flex items-center justify-center">
        {pm.provider === 'manual' && pm.iconName ? (
          <img src={`/ico/${pm.iconName}.png`} alt={pm.iconName} className="w-5 h-5 object-contain inline-block" />
        ) : (
          PM_CAT_ICONS[pm.category] ?? '•'
        )}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{pm.name}</p>
        <p className="text-xs text-muted-foreground capitalize">{pm.category}</p>
      </div>
      {hasEditAccess && (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onEdit}>
          <Edit2 className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
      )}
    </div>
  );
}

export default function PaymentMethodsTab({ hasEditAccess }: { hasEditAccess: boolean }) {
  const paymentMethods  = useDbQuery<PaymentMethod>('paymentMethods');
  const sortedPaymentMethods = [...(paymentMethods || [])].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

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
      const oldIndex = sortedPaymentMethods.findIndex(item => item.id!.toString() === active.id);
      const newIndex = sortedPaymentMethods.findIndex(item => item.id!.toString() === over.id);
      
      const newOrder = arrayMove(sortedPaymentMethods, oldIndex, newIndex);
      
      // Update sortOrder for all items in batch
      const updates = newOrder.map((pm, index) => ({
        id: pm.id!,
        sortOrder: index
      }));
      
      try {
        await dbBatchUpdateSortOrder('paymentMethods', updates);
      } catch (err: any) {
        toast.error('Gagal menyimpan urutan: ' + err.message);
      }
    }
  };

  /* ── Payment Method ── */
  const [pmDialog,   setPmDialog]   = useState(false);
  const [pmName,     setPmName]     = useState('');
  const [pmCategory, setPmCategory] = useState('tunai');
  const [pmEditId,   setPmEditId]   = useState<number | null>(null);
  const [isSavingPm, setIsSavingPm] = useState(false);
  const [pmProvider, setPmProvider] = useState<'midtrans' | 'manual'>('manual');
  const [pmQrisString, setPmQrisString] = useState('');

  /* ── QR Code Scanner State & Refs ── */
  const [scanning, setScanning] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [flashOn, setFlashOn] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCameraIdx, setActiveCameraIdx] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);
  const detectionLockRef = useRef<boolean>(false);
  const lastBeepTimeRef = useRef<number>(0);
  const cameraSessionRef = useRef<string>('');

  const toggleFlash = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const { Torch } = await import('@capawesome/capacitor-torch');
        const isEnable = await Torch.isEnabled();
        if (isEnable.enabled) {
          await Torch.disable();
          setFlashOn(false);
        } else {
          await Torch.enable();
          setFlashOn(true);
        }
        return;
      }
      
      const track = streamRef.current?.getVideoTracks()[0];
      if (track) {
        const capabilities = track.getCapabilities() as any;
        if (capabilities.torch) {
          const nextVal = !flashOn;
          await track.applyConstraints({
            advanced: [{ torch: nextVal }]
          });
          setFlashOn(nextVal);
        } else {
          toast.info("Flash tidak didukung oleh kamera ini.");
        }
      }
    } catch (e) {
      console.warn("Gagal mengubah status flash:", e);
    }
  };

  const stopCamera = useCallback(() => {
    if (Capacitor.isNativePlatform()) {
      import('@capawesome/capacitor-torch').then(({ Torch }) => {
        Torch.disable().catch(() => {});
      });
    }
    setFlashOn(false);

    if (streamRef.current) {
      if ((streamRef.current as any).fallbackInterval) {
        clearInterval((streamRef.current as any).fallbackInterval);
      }
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = 0;
    }
    if (overlayRef.current) {
      const ctx = overlayRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    }
  }, []);

  const startCamera = async (mode: "environment" | "user" = facingMode, deviceId?: string) => {
    const sessionId = Math.random().toString(36).substring(7);
    cameraSessionRef.current = sessionId;

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      let attempts = 0;
      while (!videoRef.current && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 50));
        attempts++;
      }

      if (!videoRef.current) {
        throw new Error("Elemen video pratinjau kamera tidak ditemukan.");
      }

      const videoConstraintBase: any = deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: mode };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            ...videoConstraintBase,
            width: { min: 640, ideal: 1920, max: 3840 },
            height: { min: 480, ideal: 1080, max: 2160 },
            focusMode: { ideal: 'continuous' } as any
          },
        });
      } catch (err) {
        console.warn("First camera constraint failed, trying fallback 1...", err);
        if (cameraSessionRef.current !== sessionId) return;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              ...videoConstraintBase,
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
          });
        } catch (err2) {
          console.warn("Second camera constraint failed, trying fallback 2...", err2);
          if (cameraSessionRef.current !== sessionId) return;
          stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraintBase,
          });
        }
      }

      if (cameraSessionRef.current !== sessionId) {
        if (stream) {
          stream.getTracks().forEach(t => t.stop());
        }
        return;
      }

      streamRef.current = stream;
      setFacingMode(mode);

      setTimeout(async () => {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(d => d.kind === 'videoinput');
          if (videoDevices.length > 0) {
            setCameras(videoDevices);
            const rearIdx = videoDevices.findIndex(
              d => d.label.toLowerCase().includes('back') ||
                   d.label.toLowerCase().includes('rear') ||
                   d.label.toLowerCase().includes('environment')
            );
            if (rearIdx >= 0 && !deviceId) {
              setActiveCameraIdx(rearIdx);
            }
          }
        } catch (err) {
          console.warn('Enumerasi kamera gagal:', err);
        }
      }, 200);

      const video = videoRef.current;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      
      try {
        await video.play();
      } catch (playErr) {
        console.warn("Auto-play terganggu:", playErr);
      }

      if (cameraSessionRef.current !== sessionId) {
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
      let detector: any = null;
      if (hasBarcodeDetector && (window as any).BarcodeDetector) {
        try {
          detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        } catch (e) {
          console.warn("Gagal inisialisasi BarcodeDetector:", e);
        }
      }

      const drawBoundingBox = (points: { x: number; y: number }[], confirmed: boolean) => {
        const ov = overlayRef.current;
        if (!ov) return;
        const ovCtx = ov.getContext('2d');
        if (!ovCtx) return;

        const cW = ov.width;
        const cH = ov.height;
        ovCtx.clearRect(0, 0, cW, cH);

        ovCtx.save();
        ovCtx.shadowColor = '#00e676';
        ovCtx.shadowBlur = confirmed ? 22 : 12;

        ovCtx.beginPath();
        ovCtx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ovCtx.lineTo(points[i].x, points[i].y);
        }
        ovCtx.closePath();

        ovCtx.fillStyle = confirmed ? 'rgba(0, 230, 118, 0.18)' : 'rgba(0, 230, 118, 0.08)';
        ovCtx.fill();

        ovCtx.lineWidth = confirmed ? 5 : 3;
        ovCtx.strokeStyle = confirmed ? '#69f0ae' : '#00e676';
        ovCtx.lineJoin = 'round';
        ovCtx.stroke();
        ovCtx.shadowBlur = 0;

        for (const pt of points) {
          ovCtx.beginPath();
          ovCtx.arc(pt.x, pt.y, confirmed ? 6 : 4, 0, Math.PI * 2);
          ovCtx.fillStyle = '#00e676';
          ovCtx.fill();
          ovCtx.strokeStyle = '#fff';
          ovCtx.lineWidth = 1.5;
          ovCtx.stroke();
        }

        if (confirmed) {
          const cx = (points[0].x + points[2].x) / 2;
          const cy = (points[0].y + points[2].y) / 2;
          
          ovCtx.beginPath();
          ovCtx.arc(cx, cy, 22, 0, Math.PI * 2);
          ovCtx.fillStyle = 'rgba(0, 230, 118, 0.85)';
          ovCtx.shadowColor = '#00e676';
          ovCtx.shadowBlur = 18;
          ovCtx.fill();

          ovCtx.beginPath();
          ovCtx.moveTo(cx - 8, cy + 1);
          ovCtx.lineTo(cx - 2, cy + 8);
          ovCtx.lineTo(cx + 10, cy - 6);
          ovCtx.strokeStyle = '#fff';
          ovCtx.lineWidth = 3;
          ovCtx.lineCap = 'round';
          ovCtx.lineJoin = 'round';
          ovCtx.shadowBlur = 0;
          ovCtx.stroke();
        }
        ovCtx.restore();
      };

      const handleDetection = (rawValue: string, points: { x: number; y: number }[]) => {
        if (detectionLockRef.current) return;
        detectionLockRef.current = true;

        const now = Date.now();
        if (now - lastBeepTimeRef.current > 1500) {
          lastBeepTimeRef.current = now;
          try {
            const audio = new Audio('/beep.mp3');
            audio.play().catch(() => {});
          } catch (_) {}
        }

        if (Capacitor.isNativePlatform()) {
          Haptics.vibrate({ duration: 100 }).catch(() => {});
        } else if (typeof window !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(100);
        }

        drawBoundingBox(points, true);

        setTimeout(() => {
          setPmQrisString(rawValue);
          setScanning(false);
        }, 400);
      };

      if (detector) {
        const scanNative = async () => {
          if (!streamRef.current || !video) return;

          const ov = overlayRef.current;
          if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
            if (ov && ov.parentElement) {
              const containerRect = ov.parentElement.getBoundingClientRect();
              if (ov.width !== Math.round(containerRect.width) || ov.height !== Math.round(containerRect.height)) {
                ov.width = Math.round(containerRect.width);
                ov.height = Math.round(containerRect.height);
              }
            }

            try {
              const results = await detector.detect(video);
              if (results.length > 0) {
                const best = results[0];

                const cW = ov ? ov.width : 0;
                const cH = ov ? ov.height : 0;
                const vW = video.videoWidth;
                const vH = video.videoHeight;
                const scale = Math.max(cW / vW, cH / vH);
                const ox = (vW * scale - cW) / 2;
                const oy = (vH * scale - cH) / 2;
                const txRaw = (x: number) => x * scale - ox;
                const ty = (y: number) => y * scale - oy;

                const corners = best.cornerPoints.map((p: any) => ({ x: txRaw(p.x), y: ty(p.y) }));

                if (detectionLockRef.current) {
                  drawBoundingBox(corners, true);
                } else {
                  drawBoundingBox(corners, false);
                  handleDetection(best.rawValue, corners);
                }
              } else {
                if (!detectionLockRef.current && ov) {
                  const ovCtx = ov.getContext('2d');
                  if (ovCtx) ovCtx.clearRect(0, 0, ov.width, ov.height);
                }
              }
            } catch (err) {
              // ignore
            }
          }
          animationRef.current = requestAnimationFrame(scanNative);
        };
        animationRef.current = requestAnimationFrame(scanNative);
      } else {
        const fallbackInterval = setInterval(() => {
          if (detectionLockRef.current || !streamRef.current || !video) return;

          if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, canvas.width, canvas.height, {
              inversionAttempts: "dontInvert",
            });

            if (code) {
              const ov = overlayRef.current;
              if (ov && ov.parentElement) {
                const containerRect = ov.parentElement.getBoundingClientRect();
                if (ov.width !== Math.round(containerRect.width) || ov.height !== Math.round(containerRect.height)) {
                  ov.width = Math.round(containerRect.width);
                  ov.height = Math.round(containerRect.height);
                }
              }

              const cW = ov ? ov.width : 0;
              const cH = ov ? ov.height : 0;
              const vW = video.videoWidth;
              const vH = video.videoHeight;
              const scale = Math.max(cW / vW, cH / vH);
              const ox = (vW * scale - cW) / 2;
              const oy = (vH * scale - cH) / 2;
              const txRaw = (x: number) => x * scale - ox;
              const ty = (y: number) => y * scale - oy;

              const loc = code.location;
              const corners = [
                { x: txRaw(loc.topLeftCorner.x), y: ty(loc.topLeftCorner.y) },
                { x: txRaw(loc.topRightCorner.x), y: ty(loc.topRightCorner.y) },
                { x: txRaw(loc.bottomRightCorner.x), y: ty(loc.bottomRightCorner.y) },
                { x: txRaw(loc.bottomLeftCorner.x), y: ty(loc.bottomLeftCorner.y) },
              ];

              clearInterval(fallbackInterval);
              handleDetection(code.data, corners);
            }
          }
        }, 160);

        (streamRef as any).fallbackInterval = fallbackInterval;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      toast.error("Kamera tidak dapat diakses. Pastikan Anda telah memberikan izin kamera.");
      setScanning(false);
    }
  };

  const toggleCameraMode = () => {
    if (isInitializing) return;
    const newMode = facingMode === "environment" ? "user" : "environment";
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    setIsInitializing(true);
    setTimeout(() => {
      startCamera(newMode).finally(() => {
        setIsInitializing(false);
      });
    }, 350);
  };

  const runNativeQrisScan = useCallback(async () => {
    try {
      const { BarcodeScanner: MlKitScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning');
      
      const perm = await MlKitScanner.requestPermissions();
      if (perm.camera !== 'granted') {
        toast.error('Izin kamera ditolak. Tidak dapat melakukan pemindaian.');
        setScanning(false);
        return;
      }

      if (Capacitor.getPlatform() === 'android') {
        try {
          const avail = await MlKitScanner.isGoogleBarcodeScannerModuleAvailable();
          if (!avail.available) {
            toast.info('Mengunduh modul pemindai Google, silakan tunggu...');
            await MlKitScanner.installGoogleBarcodeScannerModule();
          }
        } catch (e) {
          console.warn('Gagal memverifikasi modul pemindai Google:', e);
        }
      }

      const { barcodes } = await MlKitScanner.scan({
        formats: [BarcodeFormat.QrCode],
      });

      if (barcodes && barcodes.length > 0) {
        const val = barcodes[0].rawValue;
        if (val) {
          try {
            const audio = new Audio('/beep.mp3');
            audio.play().catch(() => {});
          } catch (_) {}
          try {
            Haptics.vibrate({ duration: 150 }).catch(() => {});
          } catch (_) {}
          setPmQrisString(val);
        }
      }
    } catch (err: any) {
      console.error('Native scan error:', err);
      if (err.message && (err.message.includes('cancel') || err.message.includes('dismiss'))) {
        // cancelled
      } else {
        toast.error('Gagal menjalankan pemindaian native.');
      }
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    detectionLockRef.current = false;
    if (scanning) {
      if (Capacitor.isNativePlatform()) {
        runNativeQrisScan();
        return;
      }
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [scanning, runNativeQrisScan, facingMode]);
  const [pmBankName, setPmBankName] = useState('');
  const [pmAccountNumber, setPmAccountNumber] = useState('');
  const [pmAccountName, setPmAccountName] = useState('');
  const [pmIconName, setPmIconName] = useState('');

  const openPmAdd  = () => { setPmEditId(null); setPmName(''); setPmCategory('tunai'); setPmProvider('manual'); setPmQrisString(''); setPmBankName(''); setPmAccountNumber(''); setPmAccountName(''); setPmIconName(''); setPmDialog(true); };
  const openPmEdit = (pm: PaymentMethod) => { setPmEditId(pm.id!); setPmName(pm.name); setPmCategory(pm.category); setPmProvider((pm.provider as 'midtrans' | 'manual') || 'midtrans'); setPmQrisString(pm.qrisString || ''); setPmBankName(pm.bankName || ''); setPmAccountNumber(pm.accountNumber || ''); setPmAccountName(pm.accountName || ''); setPmIconName(pm.iconName || ''); setPmDialog(true); };
  
  const savePm = async () => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak. Anda tidak memiliki izin untuk mengedit pengaturan.');
      return;
    }
    if (!pmName.trim()) return;
    setIsSavingPm(true);
    try {
      const isManualTransferOrEwallet = (pmCategory === 'transfer' || pmCategory === 'e-wallet') && pmProvider === 'manual';
      const updates = { 
        name: pmName.trim(), 
        category: pmCategory,
        provider: pmCategory === 'qris' || pmCategory === 'transfer' || pmCategory === 'e-wallet' ? pmProvider : undefined,
        qrisString: pmCategory === 'qris' && pmProvider === 'manual' ? pmQrisString : undefined,
        bankName: isManualTransferOrEwallet ? pmBankName : undefined,
        accountNumber: isManualTransferOrEwallet ? pmAccountNumber : undefined,
        accountName: isManualTransferOrEwallet ? pmAccountName : undefined,
        iconName: isManualTransferOrEwallet ? pmIconName : undefined,
      };
      if (pmEditId) await dbUpdate('paymentMethods', pmEditId, updates);
      else await dbInsert('paymentMethods', { ...updates, isDefault: false, createdAt: new Date().toISOString() });
      setPmDialog(false); toast.success('Metode pembayaran disimpan');
    } catch (error: any) {
      toast.error('Gagal menyimpan metode pembayaran: ' + (error.message || error));
    } finally { setIsSavingPm(false); }
  };

  const deletePm = async (id: string | number) => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak. Anda tidak memiliki izin untuk mengedit pengaturan.');
      return;
    }
    await dbDelete('paymentMethods', id);
    toast.success('Dihapus');
  };

  return (
    <div className="space-y-4">
      {!hasEditAccess && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 select-none">
          <span className="text-base shrink-0">🔒</span>
          <span><strong>Mode Lihat Saja:</strong> Anda tidak memiliki izin untuk mengubah metode pembayaran.</span>
        </div>
      )}
      <div className={cn("space-y-4", !hasEditAccess && "pointer-events-none opacity-75")}>
        <Section
          hideHeader
          title="Metode Pembayaran"
        >
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-primary/5 border border-primary/15">
            <div className="flex items-center gap-2.5 text-xs text-primary font-medium">
              <CreditCard className="w-4 h-4 shrink-0" />
              <span>{paymentMethods?.length ?? 0} metode pembayaran aktif</span>
            </div>
            {hasEditAccess && (
              <Button size="sm" className="gap-1.5 h-8 text-xs shrink-0 shadow-sm" onClick={openPmAdd}>
                <Plus className="w-3.5 h-3.5" /> Tambah
              </Button>
            )}
          </div>
          {!paymentMethods?.length ? (
            <SettingCard>
              <div className="flex flex-col items-center py-10 text-center text-muted-foreground gap-2">
                <CreditCard className="w-8 h-8 opacity-25" />
                <p className="text-sm">Belum ada metode pembayaran</p>
                {hasEditAccess && (
                <Button size="sm" variant="outline" className="mt-1 gap-1.5 text-xs h-8" onClick={openPmAdd}>
                  <Plus className="w-3.5 h-3.5" /> Tambah Sekarang
                </Button>
                )}
              </div>
            </SettingCard>
          ) : (
            <SettingCard>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sortedPaymentMethods.map(pm => pm.id!.toString())}
                  strategy={verticalListSortingStrategy}
                >
                  {sortedPaymentMethods.map((pm, i) => (
                    <SortablePaymentMethodItem
                      key={pm.id}
                      id={pm.id!.toString()}
                      pm={pm}
                      isLast={i === sortedPaymentMethods.length - 1}
                      hasEditAccess={hasEditAccess}
                      onEdit={() => openPmEdit(pm)}
                      onDelete={() => deletePm(pm.id!)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </SettingCard>
          )}
        </Section>
      </div>

      {/* ── Payment Method Dialog ── */}
      <Dialog open={pmDialog} onOpenChange={setPmDialog}>
        <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{pmEditId ? 'Edit' : 'Tambah'} Metode Pembayaran</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nama Metode</Label>
              <Input value={pmName} onChange={e => setPmName(e.target.value)} placeholder="Contoh: Transfer BCA" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Kategori</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['tunai', 'transfer', 'e-wallet', 'qris', 'lainnya'] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => setPmCategory(c)}
                    className={cn(
                      'py-2 px-1 rounded-lg text-xs font-medium border transition-colors capitalize',
                      pmCategory === c
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-border/80'
                    )}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      {PM_CAT_ICONS[c]} {c}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {(pmCategory === 'qris' || pmCategory === 'transfer' || pmCategory === 'e-wallet') && (
              <div className="space-y-1.5 pt-2 border-t border-border/50">
                <Label className="text-xs">Sistem Pemrosesan</Label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPmProvider('midtrans')}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                      pmProvider === 'midtrans' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-border/80'
                    )}
                  >
                    Midtrans (Online)
                  </button>
                  <button
                    onClick={() => setPmProvider('manual')}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                      pmProvider === 'manual' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-border/80'
                    )}
                  >
                    Manual (Bebas Biaya)
                  </button>
                </div>
              </div>
            )}
            
            {pmCategory === 'qris' && pmProvider === 'manual' && (
              <div className="space-y-1.5">
                <Label className="text-xs">QRIS String Statis Dasar</Label>
                <div className="flex gap-2">
                  <Input 
                    value={pmQrisString} 
                    onChange={e => setPmQrisString(e.target.value)} 
                    placeholder="000201010211..." 
                    className="font-mono text-[10px] flex-1" 
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-2.5 shrink-0 rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-all active:scale-95 animate-in fade-in flex items-center gap-1.5"
                    onClick={() => {
                      if (!pmQrisString) {
                        toast.error('Kolom string kosong.');
                        return;
                      }
                      navigator.clipboard.writeText(pmQrisString);
                      toast.success('String QRIS berhasil disalin.');
                    }}
                    title="Salin String QRIS"
                  >
                    <Copy className="w-3.5 h-3.5 text-foreground" />
                    <span className="text-xs font-semibold">Salin</span>
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-9 px-2.5 shrink-0 rounded-lg transition-all active:scale-95 animate-in fade-in flex items-center gap-1.5"
                    onClick={() => {
                      try {
                        const audio = new Audio('/beep.mp3');
                        audio.volume = 0;
                        audio.play().catch(() => {});
                      } catch (_) {}
                      setScanning(true);
                    }}
                    title="Scan QRIS"
                  >
                    <Scan className="w-3.5 h-3.5 text-white" />
                    <span className="text-xs font-semibold">Scan</span>
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">Sistem akan otomatis mengubah string statis ini menjadi QRIS dinamis di kasir berdasarkan nominal transaksi.</p>
              </div>
            )}

            {(pmCategory === 'transfer' || pmCategory === 'e-wallet') && pmProvider === 'manual' && (
              <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="space-y-2">
                  <Label className="text-xs">{pmCategory === 'transfer' ? 'Pilih Bank' : 'Pilih E-Wallet'}</Label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {(pmCategory === 'transfer' 
                      ? ['bri', 'bca', 'bni', 'mandiri', 'seabank'] 
                      : ['dana', 'gopay', 'ovo', 'shopeepay', 'linkaja']).map(ico => (
                      <button
                        key={ico}
                        onClick={() => {
                          setPmIconName(ico);
                          setPmBankName(ico.toUpperCase());
                        }}
                        className={cn(
                          'p-3 rounded-xl border-2 flex items-center justify-center transition-all bg-background',
                          pmIconName === ico 
                            ? 'border-primary bg-primary/5 shadow-md scale-[1.02]' 
                            : 'border-border/60 hover:border-border hover:bg-muted/50'
                        )}
                        title={ico.toUpperCase()}
                      >
                        <img 
                          src={`/ico/${ico}.png`} 
                          alt={ico} 
                          className="w-12 h-12 object-contain" 
                          onError={(e) => e.currentTarget.style.display = 'none'} 
                        />
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-xs">{pmCategory === 'transfer' ? 'No. Rekening' : 'No. HP (E-Wallet)'}</Label>
                  <Input value={pmAccountNumber} onChange={e => setPmAccountNumber(e.target.value)} placeholder={pmCategory === 'transfer' ? "Contoh: 1234567890" : "Contoh: 081234567890"} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nama Pemilik {pmCategory === 'transfer' ? 'Rekening' : 'Akun'}</Label>
                  <Input value={pmAccountName} onChange={e => setPmAccountName(e.target.value)} placeholder="Contoh: Budi Santoso" />
                </div>
              </div>
            )}
            <Button className="w-full" onClick={savePm} disabled={!pmName.trim() || isSavingPm}>
              {isSavingPm ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</> : 'Simpan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Camera view Dialog Modal ── */}
      {!Capacitor.isNativePlatform() && (
        <Dialog open={scanning} onOpenChange={v => { if (!v) setScanning(false); }}>
          <DialogContent className="max-w-[95vw] sm:max-w-[480px] rounded-2xl p-0 overflow-hidden border border-border shadow-2xl z-[100] bg-background text-foreground [&>button]:hidden">

          {/* ── HEADER ── */}
          <div className="bg-background px-5 py-4 border-b border-border/50 relative z-20">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-foreground text-[16px] font-bold flex items-center gap-2">
                <Scan className="w-5 h-5 text-foreground" />
                Scan QRIS Merchant
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-[12px] font-medium">
                Posisikan kode QRIS di tengah kotak pemindai.
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* ── AREA KAMERA ── */}
          <div className="relative bg-black w-full h-[55vh] max-h-[420px] overflow-hidden">
            
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300"
              playsInline
              autoPlay
              muted
            />
            <canvas ref={canvasRef} className="hidden" />
            <canvas
              ref={overlayRef}
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
              style={{ objectFit: 'cover' }}
            />

            {/* Tombol Senter/Flash */}
            <div className="absolute top-4 left-4 z-40">
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={toggleFlash}
                className={`rounded-full w-10 h-10 backdrop-blur-md border transition-all shadow-lg ${
                  flashOn 
                    ? 'bg-amber-500 hover:bg-amber-600 border-amber-400 text-white shadow-amber-500/30' 
                    : 'bg-white/20 hover:bg-white/30 border-white/20 text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  {flashOn ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" fill="currentColor" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  )}
                </svg>
              </Button>
            </div>

            {/* Tombol Putar Kamera */}
            <div className="absolute top-4 right-4 z-40">
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={toggleCameraMode}
                className="rounded-full w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/20 text-white shadow-lg transition-all"
              >
                <SwitchCamera className="w-5 h-5" />
              </Button>
            </div>

            {/* Area Cutout Pemindai (Kotak) */}
            <div className="absolute -top-2 bottom-0 left-0 right-0 flex items-center justify-center pointer-events-none z-20">
              <div className="absolute inset-0 bg-black/55 backdrop-blur-[0.5px]" />
              
              {/* Zona Scan Kotak */}
              <div className="relative w-64 h-64 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] rounded-2xl overflow-hidden">
                {/* Siku Sudut */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-[4px] border-l-[4px] border-primary rounded-tl-2xl z-20" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-[4px] border-r-[4px] border-primary rounded-tr-2xl z-20" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[4px] border-l-[4px] border-primary rounded-bl-2xl z-20" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[4px] border-r-[4px] border-primary rounded-br-2xl z-20" />
                
                <div className="w-full h-full border border-white/10 rounded-2xl animate-pulse" />
              </div>
            </div>

            {/* Floating Hint Bawah */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none z-30">
              <span className="bg-black/70 backdrop-blur-md text-white text-sm font-medium px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2">
                <Scan className="w-4 h-4 text-primary" />
                Arahkan ke QRIS
              </span>
            </div>
          </div>

          {/* ── FOOTER ── */}
          <div className="p-4 bg-background border-t border-border/50">
            <Button 
              variant="ghost" 
              className="w-full h-11 font-semibold text-[13px] rounded-xl bg-muted/40 hover:bg-muted/80 active:scale-[0.98] transition-all flex items-center justify-center text-foreground" 
              onClick={() => setScanning(false)}
            >
              <CameraOff className="w-4 h-4 mr-2 opacity-70" />
              Batal & Tutup
            </Button>
          </div>
          
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
}
