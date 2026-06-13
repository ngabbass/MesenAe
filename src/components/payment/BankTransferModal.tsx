/**
 * BankTransferModal
 * Pilih bank → Snap membuka halaman VA bank tersebut secara langsung
 * via enabled_payments — tidak melalui halaman pilihan Snap.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, RefreshCw, ChevronLeft, Landmark } from 'lucide-react';
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

interface BankTransferModalProps {
  isOpen: boolean;
  amount: number;
  customerName?: string;
  orderId?: string;
  paymentMethod?: PaymentMethod | null;
  onSuccess: () => void;
  onClose: () => void;
}

interface BankOption {
  id: string;
  name: string;
  snapKey: string;
  color: string;
  abbr: string;
}

const BANKS: BankOption[] = [
  { id: 'bca', name: 'BCA', snapKey: 'bca_va', color: '#005CA9', abbr: 'BCA' },
  { id: 'bni', name: 'BNI', snapKey: 'bni_va', color: '#F68F1E', abbr: 'BNI' },
  { id: 'bri', name: 'BRI', snapKey: 'bri_va', color: '#004B87', abbr: 'BRI' },
  { id: 'mandiri', name: 'Mandiri', snapKey: 'mandiri_bill', color: '#003087', abbr: 'MND' },
  { id: 'seabank', name: 'SeaBank', snapKey: 'other_va', color: '#FF5722', abbr: 'SEA' },
  { id: 'permata', name: 'Permata', snapKey: 'permata_va', color: '#E30613', abbr: 'PRM' },
  { id: 'cimb', name: 'CIMB', snapKey: 'cimb_va', color: '#c0392b', abbr: 'CIMB' },
  { id: 'other', name: 'Bank Lain', snapKey: 'other_va', color: '#64748b', abbr: 'ATM' },
];

type Step = 'select' | 'loading' | 'success' | 'error';

export function BankTransferModal({
  isOpen,
  amount,
  customerName,
  orderId,
  paymentMethod,
  onSuccess,
  onClose,
}: BankTransferModalProps) {
  const [step, setStep] = useState<Step>('select');
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
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
        setSelectedBank(null);
        setErrorMsg(null);
        MidtransService.loadSnapScript().catch((e) => console.warn('Snap script:', e));
      }
    }
  }, [isOpen, isManual]);

  const handleBankSelect = useCallback(async (bank: BankOption) => {
    if ((window as any).midtransSnapActive) {
      console.warn('Midtrans Snap active. Ignoring.');
      return;
    }
    (window as any).midtransSnapActive = true;
    
    setSelectedBank(bank);
    setStep('loading');
    setErrorMsg(null);
    const orderId = `MA-VA-${bank.id.toUpperCase()}-${Date.now()}`;

    try {
      const token = await MidtransService.createTransactionToken({
        transaction_details: { order_id: orderId, gross_amount: Math.round(amount) },
        item_details: [{ name: 'Total Belanja MesenAe', price: Math.round(amount), quantity: 1 }],
        customer_details: { first_name: customerName || 'Pelanggan MesenAe' },
        enabled_payments: [bank.snapKey],
      });

      if (!window.snap) throw new Error('Midtrans Snap belum siap.');

      window.snap.pay(token, {
        onSuccess: () => {
          (window as any).midtransSnapActive = false;
          setStep('success');
          setTimeout(() => onSuccessRef.current(), 1200);
        },
        onPending: () => {
          (window as any).midtransSnapActive = false;
          setStep('select');
        },
        onError: (result: any) => {
          (window as any).midtransSnapActive = false;
          console.error('Snap Bank Transfer Error:', result);
          setStep('error');
          setErrorMsg('Pembayaran gagal. Silakan pilih bank lain atau coba lagi.');
        },
        onClose: () => {
          (window as any).midtransSnapActive = false;
          setStep('select');
        },
      });
    } catch (err: any) {
      (window as any).midtransSnapActive = false;
      console.error('Bank Transfer Error:', err);
      setStep('error');
      setErrorMsg(err.message || `Gagal memulai transfer via ${bank.name}`);
    }
  }, [amount, customerName]);

  const handleClose = () => {
    if (step === 'loading') return;
    onClose();
  };

  // Tutup dialog utama saat confirmOpen agar tidak stacking
  const dialogOpen = isOpen && !confirmOpen;

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
                  <button onClick={() => setStep('select')} className="mr-1 p-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors" aria-label="Kembali">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                🏦 Transfer Bank
              </DialogTitle>
              <DialogDescription className="text-white/80 text-xs mt-0.5">
                Pilih bank dan ikuti instruksi pembayaran
              </DialogDescription>
            </DialogHeader>
            <div className="mt-3 bg-white/15 backdrop-blur-md rounded-xl p-3 text-center border border-white/10">
              <p className="text-[11px] text-white/70 font-semibold uppercase tracking-wider">Total Transfer</p>
              <p className="text-2xl font-black text-white mt-0.5 tracking-tight">Rp {amount.toLocaleString('id-ID')}</p>
              <p className="text-xs text-white/70 mt-1">{customerName || 'Pelanggan MesenAe'}</p>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 overflow-y-auto max-h-[55vh] custom-scrollbar-hide">
            {/* Manual Transfer */}
            {step === 'select' && isManual && paymentMethod && (
              <div className="animate-in fade-in zoom-in duration-300">
                <p className="text-sm text-muted-foreground mb-3 font-medium text-center">Silakan transfer ke rekening berikut:</p>
                
                <div className="bg-muted rounded-xl p-4 border mb-4 flex flex-col items-center text-center gap-2 shadow-inner">
                  {paymentMethod.iconName ? (
                    <img src={`/ico/${paymentMethod.iconName}.svg`} alt={paymentMethod.bankName} className="h-10 object-contain mb-1" />
                  ) : (
                    <Landmark className="w-10 h-10 text-primary mb-1 opacity-80" />
                  )}
                  <div>
                    <p className="text-xs text-primary uppercase tracking-wider font-bold">{paymentMethod.bankName}</p>
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

            {/* Midtrans Bank Selection */}
            {step === 'select' && !isManual && (
              <>
                <p className="text-[11px] text-muted-foreground font-bold mb-3 uppercase tracking-wider">Pilih Bank Tujuan</p>
                <div className="grid grid-cols-4 gap-2">
                  {BANKS.map((bank) => (
                    <button
                      key={bank.id}
                      onClick={() => handleBankSelect(bank)}
                      className="flex flex-col items-center justify-center p-2 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all active:scale-95 gap-1"
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-black text-white bg-muted overflow-hidden"
                        style={{ backgroundColor: bank.color }}
                      >
                        {['bca', 'bni', 'bri', 'mandiri', 'seabank'].includes(bank.id) ? (
                          <img src={`/ico/${bank.id}.svg`} alt={bank.name} className="w-full h-full object-contain p-1 bg-white" />
                        ) : (
                          bank.abbr
                        )}
                      </div>
                      <span className="text-[10px] font-semibold text-foreground leading-tight text-center">
                        {bank.name}
                      </span>
                    </button>
                  ))}
                </div>
                <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground text-xs font-semibold mt-3 rounded-xl" onClick={handleClose}>
                  Batalkan
                </Button>
              </>
            )}

            {step === 'loading' && (
              <div className="flex flex-col items-center py-6 gap-3">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground font-medium">
                  Menyiapkan pembayaran via {selectedBank?.name}...
                </p>
              </div>
            )}

            {step === 'success' && (
              <div className="flex flex-col items-center py-4 gap-3">
                <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center shadow-md animate-bounce">
                  <CheckCircle2 className="w-9 h-9 text-emerald-500" />
                </div>
                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">Transfer Berhasil!</p>
                <p className="text-xs text-muted-foreground">Halaman akan segera dialihkan.</p>
              </div>
            )}

            {step === 'error' && (
              <div className="flex flex-col items-center py-4 gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-rose-500" />
                </div>
                <p className="text-sm text-destructive font-medium">{errorMsg}</p>
                <div className="flex gap-2 w-full">
                  <Button size="sm" variant="outline" onClick={() => setStep('select')} className="flex-1 gap-1 rounded-xl text-xs font-bold h-10">
                    <ChevronLeft className="w-3.5 h-3.5" /> Pilih Bank Lain
                  </Button>
                  {selectedBank && (
                    <Button size="sm" onClick={() => handleBankSelect(selectedBank)} className="flex-1 gap-1 rounded-xl text-xs font-bold h-10 bg-primary hover:bg-primary/90 text-white">
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
