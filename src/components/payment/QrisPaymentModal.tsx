/**
 * QrisPaymentModal — Buka Snap Midtrans dengan fokus QRIS
 *
 * Manual QRIS: Tampilkan QrisCard dengan tombol perbesar & konfirmasi
 * Midtrans QRIS: Buka Snap langsung ke halaman QRIS
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, RefreshCw, Maximize2, X } from 'lucide-react';
import { MidtransService } from '@/services/midtransService';
import { PaymentMethod, useDbQuery } from '@/hooks/db-hooks';
import { QrisCard } from '@/components/payment/QrisCard';
import { convertQRIS } from '@/lib/qris-dinamis';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface QrisPaymentModalProps {
  isOpen: boolean;
  amount: number;
  customerName?: string;
  orderId?: string;
  paymentMethod?: PaymentMethod | null;
  onSuccess: () => void;
  onClose: () => void;
}

type Status = 'loading' | 'snap_open' | 'success' | 'error';

export function QrisPaymentModal({
  isOpen,
  amount,
  customerName,
  orderId,
  paymentMethod,
  onSuccess,
  onClose,
}: QrisPaymentModalProps) {
  const [status, setStatus] = useState<Status>('loading');
  const storeSettingsList = useDbQuery<any>('storeSettings') || [];
  const storeSettings = storeSettingsList[0];
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [snapActive, setSnapActive] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");

  const onSuccessRef = useRef(onSuccess);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const [qrisData, setQrisData] = useState<string | null>(null);

  const openSnap = useCallback(async () => {
    setStatus('loading');
    setErrorMsg(null);
    setSnapActive(false);

    const isManual = paymentMethod?.provider === 'manual' && paymentMethod?.qrisString;
    if (isManual) {
      try {
        const dynamicQRIS = convertQRIS(paymentMethod.qrisString!, { amount });
        setQrisData(dynamicQRIS);
        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        setErrorMsg('Gagal membuat QRIS dinamis: ' + err.message);
      }
      return;
    }

    if ((window as any).midtransSnapActive) {
      console.warn('Midtrans Snap is already active. Ignoring request.');
      onCloseRef.current();
      return;
    }
    (window as any).midtransSnapActive = true;

    try {
      await MidtransService.loadSnapScript();
      const token = await MidtransService.createTransactionToken({
        transaction_details: {
          order_id: orderId ? `${orderId}-${Date.now()}` : `MA-QRIS-${Date.now()}`,
          gross_amount: Math.round(amount),
        },
        item_details: [
          { name: 'Total Belanja MesenAe', price: Math.round(amount), quantity: 1 },
        ],
        customer_details: {
          first_name: customerName || 'Pelanggan MesenAe',
        },
        enabled_payments: ['other_qris'],
      });

      setSnapActive(true);
      setStatus('snap_open');

      window.snap!.pay(token, {
        onSuccess: () => {
          setSnapActive(false);
          (window as any).midtransSnapActive = false;
          setStatus('success');
          setTimeout(() => onSuccessRef.current(), 1200);
        },
        onPending: () => {
          setSnapActive(false);
          (window as any).midtransSnapActive = false;
          onCloseRef.current();
        },
        onError: (result: any) => {
          console.error('[QRIS Snap Error]', result);
          setSnapActive(false);
          setStatus('error');
          setErrorMsg('Pembayaran gagal. Silakan coba lagi.');
        },
        onClose: () => {
          setSnapActive(false);
          (window as any).midtransSnapActive = false;
          onCloseRef.current();
        },
      });
    } catch (err: any) {
      console.error('[QRIS] Error:', err);
      setSnapActive(false);
      (window as any).midtransSnapActive = false;
      setStatus('error');
      setErrorMsg(err.message || 'Gagal memproses pembayaran. Coba lagi.');
    }
  }, [amount, customerName, orderId, paymentMethod]);

  useEffect(() => {
    if (isOpen) {
      openSnap();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    if (status === 'loading' || snapActive) return;
    setStatus('loading');
    onClose();
  };

  const isManual = paymentMethod?.provider === 'manual' && paymentMethod?.qrisString;
  const dialogOpen = isOpen && !snapActive && !confirmOpen && !previewOpen;

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleClose()}>
        {isManual ? (
          <DialogContent className="max-w-[92vw] sm:max-w-[400px] rounded-2xl p-0 overflow-hidden z-[100] border shadow-2xl [&>button]:text-white [&>button]:hover:text-white/80 [&>button]:top-3 [&>button]:right-3 [&>button]:z-[110]">
            {/* Header */}
            <div className="bg-gradient-to-br from-primary to-primary/80 p-4 text-white relative overflow-hidden text-left">
              <div className="absolute -right-8 -top-8 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <DialogHeader className="relative z-10">
                <DialogTitle className="text-white text-base font-bold flex items-center gap-2 tracking-tight">
                  <div className="bg-white rounded-md px-1.5 py-0.5 flex items-center justify-center shrink-0 shadow-sm h-6">
                    <img src="/ico/qris.svg" alt="QRIS" className="h-4.5 w-auto object-contain" />
                  </div>
                  QRIS Manual
                </DialogTitle>
                <DialogDescription className="text-white/80 text-xs mt-0.5">
                  Scan menggunakan E-Wallet & Mobile Banking apa pun
                </DialogDescription>
              </DialogHeader>
              <div className="mt-3 bg-white/15 backdrop-blur-md rounded-xl p-3 text-center border border-white/10">
                <p className="text-[11px] text-white/70 font-semibold uppercase tracking-wider">Total Tagihan</p>
                <p className="text-2xl font-black text-white mt-0.5 tracking-tight">
                  Rp {amount.toLocaleString('id-ID')}
                </p>
                <p className="text-xs text-white/70 mt-1 truncate">{customerName || 'Pelanggan'}</p>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto max-h-[55vh] custom-scrollbar-hide flex flex-col items-center gap-3">
              <div className="w-full flex justify-center">
                {qrisData && (
                  <div
                    onClick={() => { if (imageUrl) setPreviewOpen(true); }}
                    className="group relative cursor-pointer transition-all hover:ring-2 hover:ring-primary/40 rounded-[24px]"
                  >
                    <QrisCard
                      qrisString={qrisData}
                      onCanvasRendered={setImageUrl}
                      className="w-[240px] h-[348px] rounded-[20px] shadow-sm pointer-events-none"
                    />
                    {imageUrl && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 rounded-[24px] transition-all duration-300">
                        <div className="bg-background/90 backdrop-blur-sm text-foreground px-3 py-1.5 rounded-full font-medium text-xs flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-y-2 group-hover:translate-y-0">
                          <Maximize2 className="w-3.5 h-3.5" />
                          Perbesar
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Button
                className="w-full font-bold rounded-xl h-11 text-sm bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20"
                onClick={() => setConfirmOpen(true)}
              >
                Konfirmasi Pembayaran
              </Button>
            </div>
          </DialogContent>
        ) : (
          <DialogContent className="max-w-[92vw] sm:max-w-[400px] rounded-2xl p-0 overflow-hidden border shadow-2xl [&>button]:text-white [&>button]:hover:text-white/80 [&>button]:top-3 [&>button]:right-3 [&>button]:z-[110]">
            {/* Header (Midtrans) */}
            <div className="bg-gradient-to-br from-primary to-primary/80 p-4 text-white relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <DialogHeader className="relative z-10">
                <DialogTitle className="text-white text-base font-bold flex items-center gap-2">
                  <div className="bg-white rounded-md px-1.5 py-0.5 flex items-center justify-center shrink-0 shadow-sm h-6">
                    <img src="/ico/qris.svg" alt="QRIS" className="h-4.5 w-auto object-contain" />
                  </div>
                  Pembayaran QRIS
                </DialogTitle>
                <DialogDescription className="text-white/80 text-xs mt-0.5">
                  Scan dengan e-wallet dan mobile banking apapun
                </DialogDescription>
              </DialogHeader>
              <div className="mt-3 bg-white/15 backdrop-blur-md rounded-xl p-3 text-center border border-white/10">
                <p className="text-[11px] text-white/70 font-semibold uppercase tracking-wider">Total Tagihan</p>
                <p className="text-2xl font-black text-white mt-0.5 tracking-tight">Rp {amount.toLocaleString('id-ID')}</p>
                <p className="text-xs text-white/70 mt-1">{customerName || 'Pelanggan MesenAe'}</p>
              </div>
            </div>

            {/* Body (Midtrans) */}
            <div className="p-4 flex flex-col items-center gap-4">
              {status === 'loading' && (
                <div className="flex flex-col items-center py-6 gap-3">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground font-medium">Membuka halaman QRIS…</p>
                </div>
              )}
              {status === 'success' && (
                <div className="flex flex-col items-center py-2 gap-3">
                  <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle2 className="w-9 h-9 text-green-500" />
                  </div>
                  <p className="text-base font-bold text-green-600 dark:text-green-400">Pembayaran Berhasil!</p>
                  <p className="text-xs text-muted-foreground">Transaksi sedang disimpan…</p>
                </div>
              )}
              {status === 'error' && (
                <div className="flex flex-col items-center py-4 gap-3 w-full">
                  <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                    <XCircle className="w-8 h-8 text-destructive" />
                  </div>
                  <p className="text-sm text-destructive font-medium text-center leading-relaxed">{errorMsg}</p>
                  <div className="flex gap-2 w-full">
                    <Button size="sm" variant="outline" onClick={openSnap} className="flex-1 gap-1 rounded-xl">
                      <RefreshCw className="w-4 h-4" /> Coba Lagi
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleClose} className="flex-1 rounded-xl">
                      Tutup
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* AlertDialog Konfirmasi — z-[200] agar di atas semua modal */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-[400px] w-[95vw] rounded-2xl p-6 z-[200]">
          <AlertDialogHeader>
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-2 mx-auto">
              <CheckCircle2 className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <AlertDialogTitle className="text-center text-xl font-extrabold">Konfirmasi Pembayaran?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Apakah Anda yakin sudah menerima bukti pembayaran dari pelanggan untuk pesanan <strong>{orderId || '-'}</strong>?
              Tindakan ini akan menandai pesanan sebagai <strong>Lunas</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 sm:justify-center flex-row gap-3">
            <AlertDialogCancel className="flex-1 mt-0 rounded-xl h-11 font-bold">Belum</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onSuccessRef.current()}
              className="flex-1 rounded-xl h-11 font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20"
            >
              Ya, Konfirmasi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview QR Perbesar — z-[200] agar di atas modal pembayaran */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[440px] w-[95vw] bg-transparent border-none shadow-none p-0 z-[200] flex flex-col items-center justify-center outline-none [&>button]:hidden">
          <div className="sr-only">
            <DialogTitle>Preview Kartu QRIS</DialogTitle>
          </div>
          {imageUrl && (
            <div className="relative flex flex-col items-center gap-4 w-full">
              <img
                src={imageUrl}
                alt="QRIS Preview"
                className="w-full h-auto max-h-[80vh] object-contain rounded-[24px] shadow-2xl animate-in zoom-in-95 duration-300"
              />
              <Button
                variant="secondary"
                onClick={() => setPreviewOpen(false)}
                className="rounded-full px-6 h-12 shadow-xl bg-background/95 backdrop-blur-md border border-border/50 hover:bg-background text-foreground font-semibold gap-2 transition-all active:scale-95"
              >
                <X className="w-4 h-4" />
                Tutup Preview
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
