import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { CameraOff, SwitchCamera, Barcode, ScanLine, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Haptics } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

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

// ── Interface (unchanged) ──
interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export default function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  // ── Refs ──
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);       // hidden, for frame capture (fallback)
  const overlayRef = useRef<HTMLCanvasElement>(null);      // visible, for bounding boxes
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);
  const detectionLockRef = useRef<boolean>(false);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const html5QrcodeDivRef = useRef<HTMLDivElement | null>(null);
  const fallbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef<boolean>(true);
  const confirmedValueRef = useRef<string>('');
  const cameraSessionRef = useRef<string>('');
  const lastBeepTimeRef = useRef<number>(0);

  // ── State ──
  const [scanning, setScanning] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCameraIdx, setActiveCameraIdx] = useState(0);
  const [isInitializing, setIsInitializing] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [alertModal, setAlertModal] = useState({ open: false, title: '', message: '' });
  const [flashOn, setFlashOn] = useState(false);
  const [foundPulse, setFoundPulse] = useState(false);

  const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  // ── Helpers ──
  const vibrate = useCallback(() => {
    try {
      if (Capacitor.isNativePlatform()) {
        Haptics.vibrate({ duration: 100 }).catch(() => {});
      } else if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    } catch (_) {}
  }, []);

  const showAlert = useCallback((title: string, message: string) => {
    setAlertModal({ open: true, title, message });
  }, []);

  // ── Flash / Torch ──
  const toggleFlash = useCallback(async () => {
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
            advanced: [{ torch: nextVal } as any],
          });
          setFlashOn(nextVal);
        } else {
          toast.info('Flash tidak didukung oleh kamera ini.');
        }
      }
    } catch (e) {
      console.warn('Gagal mengubah status flash:', e);
    }
  }, [flashOn]);

  // ── Stop camera & cleanup ──
  const stopCamera = useCallback(() => {
    // Cancel animation frame
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = 0;
    }

    // Cancel fallback interval
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }

    // Destroy html5-qrcode fallback instance
    if (html5QrcodeRef.current) {
      try {
        html5QrcodeRef.current.clear();
      } catch (_) {}
      html5QrcodeRef.current = null;
    }

    // Remove hidden div for html5-qrcode
    if (html5QrcodeDivRef.current) {
      try {
        html5QrcodeDivRef.current.remove();
      } catch (_) {}
      html5QrcodeDivRef.current = null;
    }

    // Turn off torch
    if (Capacitor.isNativePlatform()) {
      import('@capawesome/capacitor-torch')
        .then(({ Torch }) => Torch.disable().catch(() => {}))
        .catch(() => {});
    }
    setFlashOn(false);

    // Stop media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // Clear overlay canvas
    const overlay = overlayRef.current;
    if (overlay) {
      const ctx = overlay.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
    }

    setScanning(false);
    setIsInitializing(false);
    detectionLockRef.current = false;
    confirmedValueRef.current = '';
    setFoundPulse(false);
  }, []);

  // ── Overlay drawing helpers ──
  const drawBoundingBox = useCallback(
    (
      points: { x: number; y: number }[],
      value: string,
      confirmed: boolean,
    ) => {
      const overlay = overlayRef.current;
      const video = videoRef.current;
      const container = containerRef.current;
      if (!overlay || !video || !container || !points || points.length < 4) return;

      const containerW = container.clientWidth;
      const containerH = container.clientHeight;
      overlay.width = containerW;
      overlay.height = containerH;

      const ctx = overlay.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, containerW, containerH);

      // Compute object-cover transform (video -> display coordinates)
      const videoW = video.videoWidth;
      const videoH = video.videoHeight;
      if (videoW === 0 || videoH === 0) return;

      const videoAspect = videoW / videoH;
      const containerAspect = containerW / containerH;

      let scale: number;
      let offsetX: number;
      let offsetY: number;

      if (videoAspect > containerAspect) {
        // video is wider: height fills, width crops
        scale = containerH / videoH;
        offsetX = (containerW - videoW * scale) / 2;
        offsetY = 0;
      } else {
        // video is taller: width fills, height crops
        scale = containerW / videoW;
        offsetX = 0;
        offsetY = (containerH - videoH * scale) / 2;
      }

      const transform = (p: { x: number; y: number }) => ({
        x: p.x * scale + offsetX,
        y: p.y * scale + offsetY,
      });

      const transformed = points.map(transform);

      // Draw polygon fill
      ctx.beginPath();
      ctx.moveTo(transformed[0].x, transformed[0].y);
      for (let i = 1; i < transformed.length; i++) {
        ctx.lineTo(transformed[i].x, transformed[i].y);
      }
      ctx.closePath();

      ctx.fillStyle = confirmed
        ? 'rgba(0, 230, 118, 0.18)'
        : 'rgba(0, 230, 118, 0.12)';
      ctx.fill();

      // Draw polygon border
      ctx.strokeStyle = '#00e676';
      ctx.lineWidth = confirmed ? 4 : 3;
      ctx.shadowColor = '#00e676';
      ctx.shadowBlur = confirmed ? 18 : 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Corner dots
      for (const pt of transformed) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#00e676';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Value text above the box
      const minY = Math.min(...transformed.map((p) => p.y));
      const centerX =
        transformed.reduce((sum, p) => sum + p.x, 0) / transformed.length;

      ctx.font = 'bold 13px "JetBrains Mono", "Fira Code", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      const textY = Math.max(minY - 10, 18);
      const textMetrics = ctx.measureText(value);
      const textW = textMetrics.width + 16;
      const textH = 24;

      // Text background pill
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      const rx = centerX - textW / 2;
      const ry = textY - textH;
      const rr = 6;
      ctx.roundRect(rx, ry, textW, textH, rr);
      ctx.fill();

      ctx.fillStyle = '#00e676';
      ctx.fillText(value, centerX, textY - 5);
    },
    [],
  );

  const clearOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    if (overlay) {
      const ctx = overlay.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
    }
  }, []);

  // ── Handle confirmed detection ──
  const handleDetection = useCallback(
    (value: string, cornerPoints?: { x: number; y: number }[]) => {
      if (detectionLockRef.current) return;
      detectionLockRef.current = true;
      confirmedValueRef.current = value;

      // Play beep sound from public folder with a 1.5-second fail-safe cooldown guard
      const now = Date.now();
      if (now - lastBeepTimeRef.current > 1500) {
        lastBeepTimeRef.current = now;
        try {
          const audio = new Audio('/beep.mp3');
          audio.play().catch(() => {});
        } catch (_) {}
      }

      vibrate();

      // For fallback path: show pulse animation
      if (!cornerPoints) {
        setFoundPulse(true);
      }

      // Continue scanning for 350ms to keep tracking box visible
      setTimeout(() => {
        if (!mountedRef.current) return;
        onScan(value);
        // Small delay then close
        setTimeout(() => {
          if (mountedRef.current) {
            stopCamera();
            onClose();
          }
        }, 50);
      }, 350);
    },
    [onScan, onClose, stopCamera, vibrate],
  );

  // ── BarcodeDetector scan loop ──
  const startBarcodeDetectorLoop = useCallback(
    (detector: BarcodeDetectorInstance) => {
      const scan = async () => {
        const video = videoRef.current;
        if (!video || !streamRef.current || video.readyState < video.HAVE_ENOUGH_DATA) {
          animationRef.current = requestAnimationFrame(() => scan());
          return;
        }

        try {
          const results = await detector.detect(video);

          if (results.length > 0) {
            const best = results[0];

            // If already locked on a confirmed detection, just keep drawing
            if (detectionLockRef.current && confirmedValueRef.current) {
              drawBoundingBox(best.cornerPoints, confirmedValueRef.current, true);
              animationRef.current = requestAnimationFrame(() => scan());
              return;
            }

            drawBoundingBox(best.cornerPoints, best.rawValue, false);
            handleDetection(best.rawValue, best.cornerPoints);
          } else {
            if (!detectionLockRef.current) {
              clearOverlay();
            }
          }
        } catch (err) {
          // BarcodeDetector.detect can throw on certain frames
        }

        animationRef.current = requestAnimationFrame(() => scan());
      };

      animationRef.current = requestAnimationFrame(() => scan());
    },
    [drawBoundingBox, clearOverlay, handleDetection],
  );

  // ── html5-qrcode Fallback scan loop ──
  const startFallbackLoop = useCallback(() => {
    // Create hidden div for Html5Qrcode
    const hiddenDiv = document.createElement('div');
    hiddenDiv.id = '__barcode_scanner_fallback_div';
    hiddenDiv.style.display = 'none';
    document.body.appendChild(hiddenDiv);
    html5QrcodeDivRef.current = hiddenDiv;

    const html5qr = new Html5Qrcode('__barcode_scanner_fallback_div', {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.ITF,
      ],
      verbose: false,
    });
    html5QrcodeRef.current = html5qr;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    fallbackIntervalRef.current = setInterval(async () => {
      if (detectionLockRef.current) return;
      if (!video || !streamRef.current || video.readyState < video.HAVE_ENOUGH_DATA) return;
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
        });
        if (!blob) return;

        const file = new File([blob], 'frame.jpg', { type: 'image/jpeg' });
        const result = await html5qr.scanFile(file, false);

        if (result && !detectionLockRef.current) {
          handleDetection(result);
        }
      } catch (_) {
        // No barcode found in this frame – expected
      }
    }, 180);
  }, [handleDetection]);

  // ── Start camera ──
  const startCamera = useCallback(
    async (mode?: 'environment' | 'user', deviceId?: string) => {
      const sessionId = Math.random().toString(36).substring(7);
      cameraSessionRef.current = sessionId;

      setIsInitializing(true);
      setScanError(null);
      detectionLockRef.current = false;
      confirmedValueRef.current = '';
      setFoundPulse(false);

      const targetMode = mode || facingMode;

      // ── Security & permission checks ──
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        const isHttp = window.location.protocol === 'http:';
        const isNotLocalhost =
          window.location.hostname !== 'localhost' &&
          window.location.hostname !== '127.0.0.1';
        let errorMsg =
          'Browser Anda tidak mendukung akses kamera (MediaDevices).';
        if (isHttp && isNotLocalhost) {
          errorMsg =
            'Kamera diblokir karena halaman dibuka melalui protokol HTTP yang tidak aman. Silakan gunakan HTTPS (misal: Ngrok/Local tunnel) atau jalankan melalui Capacitor (aplikasi native).';
        }
        setScanError(errorMsg);
        toast.error(errorMsg);
        setIsInitializing(false);
        return;
      }

      // Capacitor native permission check
      if (Capacitor.isNativePlatform()) {
        try {
          const { Camera } = await import('@capacitor/camera');
          const perm = await Camera.checkPermissions();
          if (perm.camera !== 'granted') {
            const req = await Camera.requestPermissions({
              permissions: ['camera'],
            });
            if (req.camera !== 'granted') {
              const errorMsg = 'Izin kamera native ditolak oleh pengguna.';
              setScanError(errorMsg);
              toast.error(errorMsg);
              setIsInitializing(false);
              return;
            }
          }
        } catch (e) {
          console.warn('Gagal mengecek izin kamera native Capacitor:', e);
        }
      }

      // Wait for video element to be in DOM
      let attempts = 0;
      while (!videoRef.current && attempts < 25) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        attempts++;
      }

      if (!videoRef.current) {
        const errMsg = 'Elemen video kamera tidak ditemukan di DOM.';
        setScanError(errMsg);
        toast.error(errMsg);
        setIsInitializing(false);
        return;
      }

      try {
        // ── 3-tier constraint fallback ──
        let stream: MediaStream | null = null;

        const videoConstraintBase: any = deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: targetMode };

        // Tier 1: High-res + focusMode
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              ...videoConstraintBase,
              width: { min: 640, ideal: 1920, max: 3840 },
              height: { min: 480, ideal: 1080, max: 2160 },
              focusMode: { ideal: 'continuous' } as any,
            },
            audio: false,
          });
        } catch (err1) {
          console.warn('Tier 1 constraint gagal, mencoba Tier 2...', err1);
          if (cameraSessionRef.current !== sessionId) return;

          // Tier 2: 1280×720
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                ...videoConstraintBase,
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: false,
            });
          } catch (err2) {
            console.warn('Tier 2 constraint gagal, mencoba Tier 3...', err2);
            if (cameraSessionRef.current !== sessionId) return;

            // Tier 3: basic facingMode only
            stream = await navigator.mediaDevices.getUserMedia({
              video: videoConstraintBase,
              audio: false,
            });
          }
        }

        if (cameraSessionRef.current !== sessionId) {
          if (stream) {
            stream.getTracks().forEach((t) => t.stop());
          }
          return;
        }

        if (!stream) {
          throw new Error('Tidak dapat memperoleh stream kamera.');
        }

        streamRef.current = stream;
        setFacingMode(targetMode);

        const video = videoRef.current;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');

        try {
          await video.play();
        } catch (playErr) {
          console.warn('Auto-play terganggu:', playErr);
        }

        if (cameraSessionRef.current !== sessionId) {
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          return;
        }

        setScanning(true);
        setIsInitializing(false);

        // ── Start detection loop ──
        if (hasBarcodeDetector && window.BarcodeDetector) {
          const detector = new window.BarcodeDetector({
            formats: [
              'ean_13',
              'ean_8',
              'upc_a',
              'upc_e',
              'code_128',
              'code_39',
              'itf',
            ],
          });
          startBarcodeDetectorLoop(detector);
        } else {
          // Fallback to html5-qrcode scanFile
          startFallbackLoop();
        }

        // ── Enumerate cameras in background ──
        setTimeout(async () => {
          if (!mountedRef.current) return;
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(
              (d) => d.kind === 'videoinput',
            );
            if (mountedRef.current && videoDevices.length > 0) {
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
            console.warn('Enumerasi kamera di background gagal:', err);
          }
        }, 800);
      } catch (err: unknown) {
        const msg = err instanceof Error
          ? err.message.toLowerCase()
          : String(err).toLowerCase();
        console.error('Camera startup crashed:', err);

        let errorMsg = 'Gagal memulai sistem kamera.';
        if (msg.includes('notallowed') || msg.includes('permission')) {
          errorMsg =
            'Akses kamera ditolak. Silakan izinkan akses kamera di pengaturan browser Anda.';
        } else if (
          msg.includes('notfound') ||
          msg.includes('device not found')
        ) {
          errorMsg =
            'Kamera tidak ditemukan. Pastikan perangkat Anda memiliki kamera yang berfungsi.';
        } else if (msg.includes('notreadable') || msg.includes('in use')) {
          errorMsg = 'Kamera sedang digunakan oleh aplikasi/tab lain.';
        } else if (msg.includes('overconstrained')) {
          errorMsg =
            'Konfigurasi kamera tidak didukung oleh perangkat ini.';
        } else {
          errorMsg = `Gagal memulai sistem kamera: ${err instanceof Error ? err.message : String(err)}`;
        }

        setScanError(errorMsg);
        toast.error(errorMsg);
        setIsInitializing(false);
      }
    },
    [
      facingMode,
      hasBarcodeDetector,
      startBarcodeDetectorLoop,
      startFallbackLoop,
    ],
  );

  // ── Camera switching (Direct Front/Back Toggle in 1 Click) ──
  const handleSwitchCamera = useCallback(() => {
    if (isInitializing) return;

    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    stopCamera();
    setTimeout(() => {
      startCamera(newMode);
    }, 350); // Robust 350ms delay for native/mobile hardware to release stream locks
  }, [isInitializing, facingMode, stopCamera, startCamera]);

  const runNativeScan = useCallback(async () => {
    try {
      const { BarcodeScanner: MlKitScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning');
      
      const perm = await MlKitScanner.requestPermissions();
      if (perm.camera !== 'granted') {
        toast.error('Izin kamera ditolak. Tidak dapat melakukan pemindaian.');
        onClose();
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
        formats: [
          BarcodeFormat.Ean13,
          BarcodeFormat.Ean8,
          BarcodeFormat.UpcA,
          BarcodeFormat.UpcE,
          BarcodeFormat.Code128,
          BarcodeFormat.Code39,
          BarcodeFormat.Itf,
        ],
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
          onScan(val);
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
      onClose();
    }
  }, [onScan, onClose]);

  // ── Lifecycle ──
  useEffect(() => {
    mountedRef.current = true;

    if (open) {
      if (Capacitor.isNativePlatform()) {
        runNativeScan();
        return;
      }

      // Small delay to let Dialog animate in and DOM settle
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          startCamera();
        }
      }, 100);
      return () => {
        clearTimeout(timer);
        mountedRef.current = false;
        stopCamera();
      };
    } else {
      stopCamera();
      return () => {
        mountedRef.current = false;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, runNativeScan]);

  const handleClose = useCallback(() => {
    stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  // Mirroring has been completely removed to ensure direct/natural camera feed
  const shouldMirror = false;

  if (Capacitor.isNativePlatform()) {
    return null;
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) handleClose();
        }}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-[480px] rounded-2xl p-0 overflow-hidden border border-border shadow-2xl z-[100] bg-background text-foreground [&>button]:hidden">
          <style
            dangerouslySetInnerHTML={{
              __html: `
              @keyframes barcode-found {
                0% { box-shadow: inset 0 0 0 0 rgba(0, 230, 118, 0); }
                30% { box-shadow: inset 0 0 60px 10px rgba(0, 230, 118, 0.25); }
                100% { box-shadow: inset 0 0 0 0 rgba(0, 230, 118, 0); }
              }
              .animate-barcode-found {
                animation: barcode-found 0.5s ease-out forwards;
              }
            `,
            }}
          />

          {/* ── HEADER ── */}
          <div className="bg-background px-5 py-4 border-b border-border/50 relative z-20">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-foreground text-[16px] font-bold flex items-center gap-2">
                <Barcode className="w-5 h-5 text-foreground" />
                Scan Barcode Produk
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-[12px] font-medium">
                Posisikan barcode di dalam area kotak pemindai.
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* ── AREA KAMERA ── */}
          <div
            ref={containerRef}
            className="relative bg-black w-full h-[55vh] max-h-[420px] overflow-hidden"
          >
            {/* Video element */}
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300"
              playsInline
              autoPlay
              muted
            />

            {/* Hidden canvas for fallback frame capture */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Overlay canvas for bounding boxes (BarcodeDetector only) */}
            <canvas
              ref={overlayRef}
              className="absolute inset-0 w-full h-full pointer-events-none z-25"
              style={{ zIndex: 25 }}
            />

            {scanError ? (
              /* ── ERROR STATE ── */
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 px-6 text-center z-35 animate-in fade-in duration-300">
                <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4 text-destructive border border-destructive/20 shadow-lg">
                  <CameraOff className="w-6 h-6" />
                </div>
                <h3 className="text-white text-[15px] font-bold mb-2">
                  Gagal Memulai Kamera
                </h3>
                <p className="text-zinc-400 text-[12px] leading-relaxed max-w-[280px] mb-6">
                  {scanError}
                </p>
                <div className="flex gap-3 w-full max-w-[280px]">
                  <Button
                    type="button"
                    onClick={() => {
                      setScanError(null);
                      startCamera();
                    }}
                    className="flex-1 h-10 rounded-xl bg-blue-600 text-white font-semibold text-[13px] hover:bg-blue-700 active:scale-[0.98] transition-all"
                  >
                    Coba Lagi
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSwitchCamera}
                    className="flex-1 h-10 rounded-xl bg-transparent border-zinc-700 text-zinc-300 font-semibold text-[13px] hover:bg-zinc-800 hover:text-white"
                  >
                    Ganti Kamera
                  </Button>
                </div>
              </div>
            ) : scanning ? (
              <>
                {/* Flash button (top-left) */}
                <div className="absolute top-4 left-4 z-40">
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    onClick={toggleFlash}
                    disabled={isInitializing}
                    className={`rounded-full w-10 h-10 backdrop-blur-md border transition-all shadow-lg ${
                      flashOn
                        ? 'bg-amber-500 hover:bg-amber-600 border-amber-400 text-white shadow-amber-500/30'
                        : 'bg-white/20 hover:bg-white/30 border-white/20 text-white'
                    }`}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      {flashOn ? (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                          fill="currentColor"
                        />
                      ) : (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      )}
                    </svg>
                  </Button>
                </div>

                {/* Switch camera button (top-right) */}
                <div className="absolute top-4 right-4 z-40">
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    onClick={handleSwitchCamera}
                    disabled={isInitializing}
                    className="rounded-full w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/20 text-white shadow-lg transition-all"
                  >
                    <SwitchCamera
                      className={`w-5 h-5 ${isInitializing ? 'animate-spin' : ''}`}
                    />
                  </Button>
                </div>

                {/* Scan zone guide overlay - stretched slightly to -top-2 to seal subpixel boundary leaks */}
                <div className="absolute -top-2 bottom-0 left-0 right-0 flex items-center justify-center pointer-events-none z-20">
                  <div className="absolute inset-0 bg-black/55 backdrop-blur-[0.5px]" />

                  {/* Scan zone rectangle */}
                  <div
                    className={`relative w-[85%] max-w-[340px] h-[120px] shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] rounded-xl overflow-hidden ${
                      foundPulse ? 'animate-barcode-found' : ''
                    }`}
                  >
                    {/* Corner brackets */}
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-[3px] border-l-[3px] border-blue-500 rounded-tl-xl z-20" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-[3px] border-r-[3px] border-blue-500 rounded-tr-xl z-20" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-[3px] border-l-[3px] border-blue-500 rounded-bl-xl z-20" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[3px] border-r-[3px] border-blue-500 rounded-br-xl z-20" />
                  </div>
                </div>

                {/* Floating hint pill */}
                <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none z-30">
                  <span className="bg-black/70 backdrop-blur-md text-white text-sm font-medium px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2">
                    <ScanLine className="w-4 h-4 text-blue-500" />
                    Arahkan ke Barcode
                  </span>
                </div>
              </>
            ) : (
              /* ── LOADING STATE ── */
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 z-30">
                <div className="w-8 h-8 border-[3px] border-white/10 border-t-white rounded-full animate-spin mb-3" />
                <p className="text-white/80 text-sm font-medium">
                  Memuat Kamera...
                </p>
              </div>
            )}
          </div>

          {/* ── FOOTER ── */}
          <div className="p-4 bg-background border-t border-border/50">
            <Button
              variant="ghost"
              className="w-full h-11 font-semibold text-[13px] rounded-xl bg-muted/40 hover:bg-muted/80 active:scale-[0.98] transition-all flex items-center justify-center text-foreground"
              onClick={handleClose}
            >
              <CameraOff className="w-4 h-4 mr-2 opacity-70" />
              Batal & Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Alert Modal ── */}
      <Dialog
        open={alertModal.open}
        onOpenChange={(open) =>
          setAlertModal((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="sm:max-w-md text-center flex flex-col items-center rounded-2xl z-[110]">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-center text-lg">
              {alertModal.title}
            </DialogTitle>
            <DialogDescription className="text-center pt-2">
              {alertModal.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center w-full mt-4">
            <Button
              type="button"
              onClick={() =>
                setAlertModal((prev) => ({ ...prev, open: false }))
              }
              className="w-full sm:w-auto min-w-[120px] rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white"
            >
              Mengerti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
