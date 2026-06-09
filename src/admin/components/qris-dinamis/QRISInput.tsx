import { useRef, useState, useCallback, useEffect } from "react";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, Scan, AlertTriangle, XCircle, SwitchCamera, Trash2, CameraOff } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Haptics } from "@capacitor/haptics";

// ── BarcodeDetector type shim for TypeScript ──
interface BarcodeDetectorResult {
  rawValue: string;
  format: string;
  boundingBox: DOMRectReadOnly;
  cornerPoints: { x: number; y: number }[];
}

interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): Promise<BarcodeDetectorResult[]>;
}

interface BarcodeDetectorConstructor {
  new (opts?: { formats: string[] }): BarcodeDetectorInstance;
  getSupportedFormats(): Promise<string[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onReset: () => void;
  errors: string[];
  disabled?: boolean;
}

export function QRISInput({ value, onChange, onReset, errors, disabled }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const detectionLockRef = useRef(false);
  const cameraSessionRef = useRef<string>('');
  const lastBeepTimeRef = useRef<number>(0);
  
  const [scanning, setScanning] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [dragOver, setDragOver] = useState(false);
  const [alertModal, setAlertModal] = useState({ open: false, title: "", message: "" });
  const [flashOn, setFlashOn] = useState(false);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCameraIdx, setActiveCameraIdx] = useState(0);
  const [isInitializing, setIsInitializing] = useState(false);

  // Mirroring has been completely removed to ensure direct/natural camera feed
  const shouldMirror = false;

  const toggleFlash = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const { Torch } = await import('@capawesome/capacitor-torch');
        const status = await Torch.isEnabled();
        if (status.enabled) {
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
          showAlert("Info", "Flash tidak didukung oleh kamera ini.");
        }
      }
    } catch (e) {
      console.warn("Gagal mengubah status flash:", e);
    }
  };

  const showAlert = (title: string, message: string) => {
    setAlertModal({ open: true, title, message });
  };

  const decodeImageFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, canvas.width, canvas.height);
          if (code) {
            onChange(code.data);
          } else {
            onChange("");
            showAlert("Gagal Memindai", "Kode QR tidak ditemukan di dalam gambar. Silakan coba unggah gambar yang lebih jelas.");
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    },
    [onChange]
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) decodeImageFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      decodeImageFile(file);
    }
  };

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            decodeImageFile(file);
            return;
          }
        }
      }
    },
    [decodeImageFile]
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

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

      // Tunggu hingga element videoRef benar-benar ter-mount di DOM
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
        console.warn("First camera constraint failed, trying fallback 1 (no focusMode)...", err);
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
          console.warn("Second camera constraint failed, trying fallback 2 (basic)...", err2);
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

      // ── Enumerate cameras in background ──
      setTimeout(async () => {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(
            (d) => d.kind === 'videoinput',
          );
          if (videoDevices.length > 0) {
            setCameras(videoDevices);
            const rearIdx = videoDevices.findIndex(
              (d) =>
                d.label.toLowerCase().includes('back') ||
                d.label.toLowerCase().includes('rear') ||
                d.label.toLowerCase().includes('environment'),
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
      let detector: BarcodeDetectorInstance | null = null;
      if (hasBarcodeDetector && window.BarcodeDetector) {
        try {
          detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        } catch (e) {
          console.warn("Gagal inisialisasi BarcodeDetector:", e);
        }
      }

      // Shared helper to draw a beautiful real-time bounding box and checkmark
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

        // Draw corner points
        for (const pt of points) {
          ovCtx.beginPath();
          ovCtx.arc(pt.x, pt.y, confirmed ? 6 : 4, 0, Math.PI * 2);
          ovCtx.fillStyle = '#00e676';
          ovCtx.fill();
          ovCtx.strokeStyle = '#fff';
          ovCtx.lineWidth = 1.5;
          ovCtx.stroke();
        }

        // Draw success checkmark in the center of the bounding box
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

        // Sound cue (Web only) with a 1.5-second fail-safe cooldown guard
        const now = Date.now();
        if (now - lastBeepTimeRef.current > 1500) {
          lastBeepTimeRef.current = now;
          try {
            const audio = new Audio('/beep.mp3');
            audio.play().catch(() => {});
          } catch (_) {}
        }

        // Haptic vibration feedback
        if (Capacitor.isNativePlatform()) {
          Haptics.vibrate({ duration: 100 }).catch(() => {});
        } else if (typeof window !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(100);
        }

        // Lock bounding box immediately
        drawBoundingBox(points, true);

        // Keep QR box visible for 400ms before returning result
        setTimeout(() => {
          onChange(rawValue);
          setScanning(false);
        }, 400);
      };

      // ── Engine 1: Native BarcodeDetector (Highly efficient & rapid GPU loop) ──
      if (detector) {
        const scanNative = async () => {
          if (!streamRef.current || !video) return;

          const ov = overlayRef.current;
          if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
            // Sync overlay canvas size to display size
            if (ov && ov.parentElement) {
              const containerRect = ov.parentElement.getBoundingClientRect();
              if (ov.width !== Math.round(containerRect.width) || ov.height !== Math.round(containerRect.height)) {
                ov.width = Math.round(containerRect.width);
                ov.height = Math.round(containerRect.height);
              }
            }

            try {
              const results = await detector!.detect(video);
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

                const corners = best.cornerPoints.map(p => ({ x: txRaw(p.x), y: ty(p.y) }));

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
              // Ignore frames with transient errors
            }
          }
          animationRef.current = requestAnimationFrame(scanNative);
        };
        animationRef.current = requestAnimationFrame(scanNative);
      }
      // ── Engine 2: CPU-based jsQR Fallback (Throttled to 160ms for Safari/iOS) ──
      else {
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

        // Attach interval to streamRef to clear it upon unmount / camera stop
        (streamRef as any).fallbackInterval = fallbackInterval;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      showAlert("Akses Ditolak", "Kamera tidak dapat diakses. Pastikan Anda telah memberikan izin dan perangkat Anda memiliki kamera yang berfungsi.");
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
    }, 350); // Robust 350ms delay for native/mobile hardware to release stream locks
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
          onChange(val);
        }
      }
    } catch (err: any) {
      console.error('Native scan error:', err);
      if (err.message && (err.message.includes('cancel') || err.message.includes('dismiss'))) {
        // User cancelled
      } else {
        toast.error('Gagal menjalankan pemindaian native.');
      }
    } finally {
      setScanning(false);
    }
  }, [onChange]);

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

  const hasError = errors.length > 0;
  const hasValue = value.trim().length > 0;

  return (
    <div className="space-y-4">

      {/* Textarea Area */}
      <div className="space-y-2.5">
        
         {/* Header Section: Tombol Hapus mepet ke kanan */}
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold text-foreground/90">String QRIS</Label>
          {hasValue && !disabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-6 px-2 text-[11px] font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Hapus Teks
            </Button>
          )}
        </div>
        
        <div
          className={`relative rounded-xl border-2 transition-all duration-200 ${
            dragOver
              ? "border-primary border-dotted bg-primary/5 shadow-[0_0_0_4px_hsl(var(--primary)/0.1)]"
              : hasError
                ? "border-destructive/60 bg-destructive/[0.02] focus-within:border-destructive focus-within:border-dotted focus-within:shadow-[0_0_0_3px_hsl(var(--destructive)/0.1)]"
                : hasValue
                  ? "border-emerald-500/60 bg-emerald-50/30 dark:bg-emerald-950/10 focus-within:border-emerald-500 focus-within:border-dotted focus-within:shadow-[0_0_0_3px_hsl(142_76%_36%/0.1)]"
                  : "border-border hover:border-primary/40 bg-background focus-within:border-primary focus-within:border-dotted focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.1)]"
          }`}
          onDragOver={(e) => { if (!disabled) { e.preventDefault(); setDragOver(true); } }}
          onDragLeave={() => { if (!disabled) setDragOver(false); }}
          onDrop={(e) => { if (!disabled) handleDrop(e); }}
        >
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={disabled ? "Mode lihat saja" : "Paste string QRIS atau drag & drop gambar"}
            rows={6}
            className={`
              w-full border-0 shadow-none
              focus-visible:ring-0 focus-visible:outline-none
              resize-none bg-transparent
              font-mono text-sm leading-relaxed
              placeholder:text-muted-foreground/50
              pr-8
            `}
          />
          {dragOver && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-primary/5 pointer-events-none">
              <div className="text-center">
                <Upload className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium text-primary">Lepaskan untuk upload</p>
              </div>
            </div>
          )}
        </div>

        {/* Status indicator */}
        {hasValue && !hasError && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
            String QRIS valid dan siap dikonversi
          </p>
        )}
        {!hasValue && (
          <p className="text-xs text-muted-foreground">
            Mendukung paste teks, drag & drop gambar, dan paste gambar dari clipboard
          </p>
        )}
      </div>

      {/* Error messages */}
      {hasError && (
        <div className="rounded-xl bg-destructive/8 border border-destructive/25 p-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <p className="text-xs font-semibold text-destructive uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Ditemukan {errors.length} kesalahan
          </p>
          <ul className="space-y-1.5">
            {errors.map((err, i) => (
              <li key={i} className="flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
                <span className="text-sm text-destructive/90 leading-snug">{err}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          className="gap-2 h-11 w-full text-sm font-semibold rounded-xl border-border/70 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all"
        >
          <Upload className="w-4 h-4" />
          Upload Gambar
        </Button>

        <Button
          type="button"
          variant="default"
          size="lg"
          disabled={disabled}
          onClick={() => {
            try {
              const audio = new Audio('/beep.mp3');
              audio.volume = 0;
              audio.play().catch(() => {});
            } catch (_) {}
            setScanning(true);
          }}
          className="gap-2 h-11 w-full text-sm font-semibold rounded-xl transition-all"
        >
          <Scan className="w-4 h-4" />
          Scan Kamera
        </Button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Camera view Dialog Modal */}
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

            {/* Area Cutout Pemindai (Kotak) - stretched slightly to -top-2 to seal subpixel boundary leaks */}
            <div className="absolute -top-2 bottom-0 left-0 right-0 flex items-center justify-center pointer-events-none z-20">
              <div className="absolute inset-0 bg-black/55 backdrop-blur-[0.5px]" />
              
              {/* Zona Scan Kotak */}
              <div className="relative w-64 h-64 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] rounded-2xl overflow-hidden">
                {/* Siku Sudut yang Bersih, Fungsional & Menyesuaikan Tema */}
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

      {/* Alert Modal */}
      <Dialog open={alertModal.open} onOpenChange={(open) => setAlertModal(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-md text-center flex flex-col items-center rounded-2xl">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-center text-lg">{alertModal.title}</DialogTitle>
            <DialogDescription className="text-center pt-2">
              {alertModal.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center w-full mt-4">
            <Button
              type="button"
              onClick={() => setAlertModal(prev => ({ ...prev, open: false }))}
              className="w-full sm:w-auto min-w-[120px] rounded-xl font-semibold"
            >
              Mengerti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
