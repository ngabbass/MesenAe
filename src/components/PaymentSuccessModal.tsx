/**
 * PaymentSuccessModal — Muncul di Pesanan Aktif setelah pembayaran berhasil.
 * Menampilkan animasi sukses + tombol-tombol cetak yang tersedia.
 */
import { useState } from 'react';
import { CheckCircle2, FileText, ChefHat, Tag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { Transaction, TransactionItemRecord, StoreSettings } from '@/hooks/db-hooks';
import { formatReceiptTable } from '@/lib/utils';

import Receipt from '@/components/Receipt';
import { KitchenReceiptModal } from '@/kitchen/KitchenApp';
import VariantLabelModal from '@/components/VariantLabelModal';

interface PaymentSuccessModalProps {
  open: boolean;
  onClose: () => void;
  transaction: Transaction;
  items: TransactionItemRecord[];
  storeSettings?: StoreSettings;
  paymentMethodName?: string;
  /** Apakah pesanan masuk ke dapur? */
  needsKitchen?: boolean;
}

export default function PaymentSuccessModal({
  open,
  onClose,
  transaction,
  items,
  storeSettings,
  paymentMethodName = 'Tunai',
  needsKitchen = true,
}: PaymentSuccessModalProps) {
  const [openCustomer, setOpenCustomer] = useState(false);
  const [openKitchen, setOpenKitchen] = useState(false);
  const [openVariant, setOpenVariant] = useState(false);

  const hasVariants = items.some(
    (it) => it.selectedVariants && it.selectedVariants.length > 0
  );
  const variantCount = items.filter(
    (it) => it.selectedVariants && it.selectedVariants.length > 0
  ).length;

  const rp = (n: number) => `Rp ${(Number(n) || 0).toLocaleString('id-ID')}`;

  return (
    <>
      {/* Modal Sukses Pembayaran */}
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-sm md:max-w-md w-[92vw] max-h-[90vh] overflow-y-auto rounded-3xl p-0 bg-background border border-border shadow-2xl">

          {/* Hero Section */}
          <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center border-b border-border/80">
            {/* Ikon sukses animasi */}
            <div className="relative mb-4">
              <div className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center animate-in zoom-in duration-500">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" strokeWidth={2} />
              </div>
              {/* Ping animation */}
              <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping" style={{ animationDuration: '2s' }} />
            </div>

            <h2 className="text-2xl font-black text-foreground tracking-tight mb-1">
              Pembayaran Berhasil!
            </h2>
            <p className="text-muted-foreground text-sm font-medium mb-4">
              {transaction.receiptNumber}
            </p>

            {/* Info ringkas */}
            <div className="w-full bg-muted/50 rounded-2xl border border-border divide-y divide-border/80">
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total</span>
                <span className="font-black text-foreground text-base">{rp(transaction.total)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Metode</span>
                <span className="font-bold text-foreground/80 text-sm">{paymentMethodName}</span>
              </div>
              {transaction.tableNumber && formatReceiptTable(transaction.tableNumber) !== 'Bawa Pulang' ? (
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Meja</span>
                  <span className="font-black text-foreground text-sm">{formatReceiptTable(transaction.tableNumber)}</span>
                </div>
              ) : (
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tipe</span>
                  <span className="font-bold text-foreground/80 text-sm">Bawa Pulang</span>
                </div>
              )}
            </div>
          </div>

          {/* Tombol-tombol Cetak */}
          <div className="p-5 space-y-2.5">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-center mb-3">
              Pilihan Cetak
            </p>

            {/* Struk Pelanggan */}
            <button
              onClick={() => setOpenCustomer(true)}
              className="w-full flex items-center gap-4 p-3.5 rounded-2xl bg-card border border-border hover:border-primary/50 hover:bg-muted/80 transition-all group text-left shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-bold text-foreground text-sm">Struk Pelanggan</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Struk pembayaran lengkap</p>
              </div>
            </button>

            {/* Struk Dapur */}
            {needsKitchen && (
              <button
                onClick={() => setOpenKitchen(true)}
                className="w-full flex items-center gap-4 p-3.5 rounded-2xl bg-card border border-border hover:border-primary/50 hover:bg-muted/80 transition-all group text-left shadow-sm"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <ChefHat className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm">Struk Dapur</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Tiket untuk barista / koki</p>
                </div>
              </button>
            )}

            {/* Label Varian */}
            {hasVariants && (
              <button
                onClick={() => setOpenVariant(true)}
                className="w-full flex items-center gap-4 p-3.5 rounded-2xl bg-card border border-border hover:border-primary/50 hover:bg-muted/80 transition-all group text-left shadow-sm"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Tag className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-foreground text-sm">Label Varian</p>
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5">
                      {variantCount} Item
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Label stiker per produk varian</p>
                </div>
              </button>
            )}

            {/* Tutup */}
            <Button
              variant="ghost"
              className="w-full mt-2 rounded-2xl py-5 font-bold text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-2"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
              Selesai
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Struk Pelanggan */}
      {openCustomer && (
        <Receipt
          open={openCustomer}
          onClose={() => setOpenCustomer(false)}
          transaction={transaction}
          items={items}
          storeSettings={storeSettings}
          paymentMethodName={paymentMethodName}
        />
      )}

      {/* Modal Struk Dapur */}
      {openKitchen && (
        <KitchenReceiptModal
          open={openKitchen}
          onClose={() => setOpenKitchen(false)}
          transaction={transaction}
          items={items}
          storeSettings={storeSettings}
          onOpenVariantLabels={
            hasVariants
              ? () => { setOpenVariant(true); }
              : undefined
          }
        />
      )}

      {/* Modal Label Varian */}
      {openVariant && (
        <VariantLabelModal
          open={openVariant}
          onClose={() => setOpenVariant(false)}
          items={items}
          transaction={transaction}
          storeSettings={storeSettings}
        />
      )}
    </>
  );
}
