/**
 * MidtransPaymentModal — Router Utama
 * Membuka modal yang sesuai berdasarkan jenis pembayaran:
 *  - 'qris'      → QrisPaymentModal    (Snap full, langsung ke halaman QRIS)
 *  - 'transfer'  → BankTransferModal   (pilih bank → tampilkan VA)
 *  - 'e-wallet'  → EWalletModal        (pilih dompet → QR / deeplink)
 *  - 'lainnya'   → OtherPaymentModal   (Snap full, semua metode tersedia)
 */
import { QrisPaymentModal } from '@/components/payment/QrisPaymentModal';
import { BankTransferModal } from '@/components/payment/BankTransferModal';
import { EWalletModal } from '@/components/payment/EWalletModal';
import { OtherPaymentModal } from '@/components/payment/OtherPaymentModal';

import { PaymentMethod } from '@/hooks/db-hooks';

export type MidtransPaymentType = 'qris' | 'transfer' | 'e-wallet' | 'lainnya';

export interface MidtransPaymentModalProps {
  isOpen: boolean;
  paymentType: MidtransPaymentType | null;
  amount: number;
  customerName?: string;
  orderId?: string;
  paymentMethod?: PaymentMethod | null;
  onSuccess: () => void;
  onPending: () => void;
  onError: (error?: any) => void;
  onClose: () => void;
}

export function MidtransPaymentModal({
  isOpen,
  paymentType,
  amount,
  customerName,
  orderId,
  paymentMethod,
  onSuccess,
  onClose,
}: MidtransPaymentModalProps) {
  if (!isOpen || !paymentType) return null;

  const sharedProps = { isOpen, amount, customerName, orderId, paymentMethod, onSuccess, onClose } as any;

  if (paymentType === 'qris') return <QrisPaymentModal     {...sharedProps} />;
  if (paymentType === 'transfer') return <BankTransferModal    {...sharedProps} />;
  if (paymentType === 'e-wallet') return <EWalletModal         {...sharedProps} />;
  if (paymentType === 'lainnya') return <OtherPaymentModal    {...sharedProps} />;

  return null;
}
