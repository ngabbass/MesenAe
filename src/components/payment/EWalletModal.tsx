import { useState, useCallback, useEffect, useRef, JSX } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, RefreshCw, ChevronLeft, Wallet } from 'lucide-react';
import { MidtransService } from '@/services/midtransService';
import { PaymentMethod } from '@/hooks/db-hooks';
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

// ==========================================
// Tipe Data & Interfaces
// ==========================================

interface EWalletModalProps {
  isOpen: boolean;
  amount: number;
  customerName?: string;
  orderId?: string;
  paymentMethod?: PaymentMethod | null;
  onSuccess: () => void;
  onClose: () => void;
}

interface WalletOption {
  id: string;
  name: string;
  snapKey: string;
  bg: string;
  borderColor: string;
  svg: React.ReactNode;
  desc: string;
  tag?: string;
}

type Step = 'select' | 'loading' | 'success' | 'error';

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options: any) => void;
    };
  }
}

// ==========================================
// Konfigurasi E-Wallet
// ==========================================

const WALLETS: WalletOption[] = [
  {
    id: 'gopay',
    name: 'GoPay',
    snapKey: 'gopay',
    bg: 'bg-[#00AED6]/10 dark:bg-[#00AED6]/20',
    borderColor: 'hover:border-[#00AED6] focus:ring-[#00AED6]/20',
    svg: <img src="/ico/gopay.svg" alt="GoPay" className="w-full h-full object-contain p-1.5 drop-shadow-sm" />,
    desc: 'Bayar instan via aplikasi Gojek atau GoPay',
    tag: 'Populer',
  },
  {
    id: 'shopeepay',
    name: 'ShopeePay',
    snapKey: 'shopeepay',
    bg: 'bg-[#EE4D2D]/10 dark:bg-[#EE4D2D]/20',
    borderColor: 'hover:border-[#EE4D2D] focus:ring-[#EE4D2D]/20',
    svg: <img src="/ico/shopeepay.svg" alt="ShopeePay" className="w-full h-full object-contain p-1.5 drop-shadow-sm" />,
    desc: 'Buka aplikasi Shopee untuk konfirmasi PIN',
  },
  {
    id: 'ovo',
    name: 'OVO',
    snapKey: 'ovo',
    bg: 'bg-[#4C3493]/10 dark:bg-[#4C3493]/20',
    borderColor: 'hover:border-[#4C3493] focus:ring-[#4C3493]/20',
    svg: <img src="/ico/ovo.svg" alt="OVO" className="w-full h-full object-contain p-1.5 drop-shadow-sm" />,
    desc: 'Masukkan nomor HP yang terdaftar di OVO',
  },
  {
    id: 'dana',
    name: 'DANA',
    snapKey: 'dana',
    bg: 'bg-[#118EEA]/10 dark:bg-[#118EEA]/20',
    borderColor: 'hover:border-[#118EEA] focus:ring-[#118EEA]/20',
    svg: <img src="/ico/dana.svg" alt="DANA" className="w-full h-full object-contain p-1.5 drop-shadow-sm" />,
    desc: 'Scan barcode via QRIS menggunakan aplikasi DANA',
    tag: 'QRIS',
  },
  {
    id: 'linkaja',
    name: 'LinkAja',
    snapKey: 'linkaja',
    bg: 'bg-[#E22B29]/10 dark:bg-[#E22B29]/20',
    borderColor: 'hover:border-[#E22B29] focus:ring-[#E22B29]/20',
    svg: <img src="/ico/linkaja.svg" alt="LinkAja" className="w-full h-full object-contain p-1.5 drop-shadow-sm" />,
    desc: 'Bayar menggunakan saldo LinkAja',
  },
];

// ==========================================
// Komponen Utama
// ==========================================

export function EWalletModal({
  isOpen,
  amount,
  customerName,
  orderId,
  paymentMethod,
  onSuccess,
  onClose,
}: EWalletModalProps): JSX.Element {
  const [step, setStep] = useState<Step>('select');
  const [selectedWallet, setSelectedWallet] = useState<WalletOption | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [snapActive, setSnapActive] = useState<boolean>(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  
  const onSuccessRef = useRef(onSuccess);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const isManual = paymentMethod?.provider === 'manual';

  useEffect(() => {
    if (isOpen) {
      if (isManual) {
        setStep('select');
      } else {
        setStep('select');
        setSelectedWallet(null);
        setErrorMsg(null);
        MidtransService.loadSnapScript().catch((e) =>
          console.warn('Snap script load error:', e)
        );
      }
    }
  }, [isOpen, isManual]);

  const handleWalletSelect = useCallback(
    async (wallet: WalletOption) => {
      if ((window as any).midtransSnapActive) {
        console.warn('Midtrans Snap active. Ignoring.');
        return;
      }
      (window as any).midtransSnapActive = true;
      setSelectedWallet(wallet);
      setStep('loading');
      setErrorMsg(null);

      const orderId = `MA-EW-${wallet.id.toUpperCase()}-${Date.now()}`;

      try {
        const token = await MidtransService.createTransactionToken({
          transaction_details: { order_id: orderId, gross_amount: Math.round(amount) },
          item_details: [{ name: 'Total Belanja MesenAe', price: Math.round(amount), quantity: 1 }],
          customer_details: { first_name: customerName || 'Pelanggan MesenAe' },
          enabled_payments: wallet.id === 'dana' ? ['qris'] : [wallet.snapKey],
        });

        if (!window.snap) throw new Error('Sistem pembayaran Midtrans belum siap.');

        setSnapActive(true);
        setStep('select');

        window.snap.pay(token, {
          onSuccess: () => {
            setSnapActive(false);
            (window as any).midtransSnapActive = false;
            setStep('success');
            setTimeout(() => onSuccessRef.current(), 1200);
          },
          onPending: () => {
            setSnapActive(false);
            (window as any).midtransSnapActive = false;
            setStep('select');
          },
          onError: (result: any) => {
            console.error(`Snap ${wallet.name} Error:`, result);
            setSnapActive(false);
            (window as any).midtransSnapActive = false;
            setStep('error');
            setErrorMsg(`Pembayaran via ${wallet.name} gagal. Silakan coba lagi.`);
          },
          onClose: () => {
            setSnapActive(false);
            (window as any).midtransSnapActive = false;
            setStep('select');
          },
        });
      } catch (err: any) {
        (window as any).midtransSnapActive = false;
        console.error('E-Wallet Error:', err);
        setStep('error');
        setErrorMsg(err.message || `Gagal memproses transaksi menggunakan ${wallet.name}`);
      }
    },
    [amount, customerName]
  );

  const handleClose = (): void => {
    if (step === 'loading' || snapActive) return;
    setSnapActive(false);
    onClose();
  };

  // Tutup dialog utama saat confirmOpen agar tidak stacking
  const dialogOpen = isOpen && !snapActive;

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-[92vw] sm:max-w-[400px] rounded-2xl p-0 overflow-hidden z-[100] border shadow-2xl [&>button]:text-white [&>button]:hover:text-white/80 [&>button]:top-3 [&>button]:right-3 [&>button]:z-[110]">
          
          {/* Header */}
          <div className="bg-gradient-to-br from-primary to-primary/80 p-4 text-white relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-white text-base font-bold flex items-center gap-2 tracking-tight">
                {step === 'error' && (
                  <button
                    onClick={() => setStep('select')}
                    className="mr-1 p-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                    aria-label="Kembali"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                <div className="bg-white rounded-md px-1.5 py-0.5 flex items-center justify-center shrink-0 shadow-sm h-6">
                  <img src="/ico/ewallet.svg" alt="E-Wallet" className="h-4 w-auto object-contain" />
                </div>
                Pembayaran Digital
              </DialogTitle>
              <DialogDescription className="text-white/80 text-xs mt-0.5">
                Konfirmasi nominal tagihan & pilih metode dompet digital
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
          <div className="p-4 overflow-y-auto max-h-[55vh] custom-scrollbar-hide">
            
            {/* Manual E-Wallet */}
            {step === 'select' && isManual && paymentMethod && (
              <div className="animate-in fade-in zoom-in duration-300">
                <p className="text-sm text-muted-foreground mb-3 font-medium text-center">Silakan transfer E-Wallet ke nomor berikut:</p>
                
                <div className="bg-muted rounded-xl p-4 border mb-4 flex flex-col items-center text-center gap-2 shadow-inner">
                  {paymentMethod.iconName ? (
                    <img src={`/ico/${paymentMethod.iconName}.svg`} alt={paymentMethod.bankName} className="h-10 object-contain mb-1 drop-shadow-sm" />
                  ) : (
                    <Wallet className="w-10 h-10 text-primary mb-1 opacity-80 drop-shadow-sm" />
                  )}
                  <div>
                    <p className="text-xs text-primary font-bold uppercase tracking-widest">{paymentMethod.bankName}</p>
                    <p className="text-xl font-black tracking-tight text-foreground mt-1">{paymentMethod.accountNumber}</p>
                    <p className="text-sm font-semibold text-muted-foreground mt-1">a.n {paymentMethod.accountName}</p>
                  </div>
                </div>

                <Button
                  className="w-full font-bold rounded-xl h-11 text-sm bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20"
                  onClick={() => setConfirmOpen(true)}
                >
                  Konfirmasi Pembayaran
                </Button>
              </div>
            )}

            {/* Midtrans Wallet Selection */}
            {step === 'select' && !isManual && (
              <>
                <p className="text-[11px] text-muted-foreground font-bold mb-3 uppercase tracking-wider">
                  Metode Tersedia
                </p>
                <div className="flex flex-col gap-2.5">
                  {WALLETS.map((wallet) => (
                    <button
                      key={wallet.id}
                      onClick={() => handleWalletSelect(wallet)}
                      className={`group flex items-center gap-3.5 p-3 rounded-xl border-2 bg-muted/50 hover:bg-background transition-all duration-200 outline-none focus:ring-4 text-left shadow-sm hover:shadow-md ${wallet.borderColor}`}
                    >
                      <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-md border-2 border-background bg-card overflow-hidden">
                        {wallet.svg}
                      </div>
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                            {wallet.name}
                          </p>
                          {wallet.tag && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50">
                              {wallet.tag}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                          {wallet.desc}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
                
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground hover:text-foreground text-xs font-semibold mt-3 rounded-xl"
                  onClick={handleClose}
                >
                  Batalkan Transaksi
                </Button>
              </>
            )}

            {/* Loading */}
            {step === 'loading' && (
              <div className="flex flex-col items-center py-8 gap-4">
                <div className="relative flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full border-4 border-muted animate-pulse absolute" />
                  <Loader2 className="w-9 h-9 text-primary animate-spin relative z-10" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-foreground">
                    Menghubungkan ke {selectedWallet?.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                    Mohon tunggu sebentar...
                  </p>
                </div>
              </div>
            )}

            {/* Sukses */}
            {step === 'success' && (
              <div className="flex flex-col items-center py-6 gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center shadow-md animate-bounce">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
                <div>
                  <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">Pembayaran Sukses!</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                    Halaman akan segera dialihkan.
                  </p>
                </div>
              </div>
            )}

            {/* Error */}
            {step === 'error' && (
              <div className="flex flex-col items-center py-4 gap-3 text-center">
                <div className="w-14 h-14 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center shadow-sm">
                  <XCircle className="w-9 h-9 text-rose-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-rose-600 dark:text-rose-400">Gagal Memproses Pembayaran</p>
                  <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed">{errorMsg}</p>
                </div>
                <div className="flex gap-2 w-full mt-1">
                  <Button
                    size="sm" variant="outline"
                    onClick={() => setStep('select')}
                    className="flex-1 gap-1.5 rounded-xl text-xs font-bold h-10"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Ganti Metode
                  </Button>
                  {selectedWallet && (
                    <Button
                      size="sm"
                      onClick={() => handleWalletSelect(selectedWallet)}
                      className="flex-1 gap-1.5 rounded-xl text-xs font-bold h-10 bg-primary hover:bg-primary/90 text-white"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* AlertDialog Konfirmasi — z-[200] agar di atas modal utama */}
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
    </>
  );
}
