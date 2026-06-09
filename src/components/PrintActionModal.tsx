/**
 * PrintActionModal — Modal pilihan cetak yang muncul di seluruh aplikasi.
 * Menampilkan tombol-tombol cetak yang tersedia tergantung konteks:
 * - Struk Pelanggan (jika `showCustomerReceipt = true`)
 * - Struk Dapur (jika `showKitchenReceipt = true`)
 * - Label Varian (jika ada item yang punya varian)
 *
 * Setelah user memilih, modal ini menutup diri dan memanggil callback yang sesuai.
 */
import { useState } from 'react';
import { FileText, ChefHat, Tag, X, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { Transaction, TransactionItemRecord, StoreSettings } from '@/hooks/db-hooks';
import { formatReceiptTable } from '@/lib/utils';

// Import komponen struk yang ada
import Receipt from '@/components/Receipt';
import { KitchenReceiptModal } from '@/kitchen/KitchenApp';
import VariantLabelModal from '@/components/VariantLabelModal';

interface PrintActionModalProps {
  open: boolean;
  onClose: () => void;
  transaction: Transaction;
  items: TransactionItemRecord[];
  storeSettings?: StoreSettings;
  paymentMethodName?: string;
  /** Tampilkan tombol struk pelanggan */
  showCustomerReceipt?: boolean;
  /** Tampilkan tombol struk dapur */
  showKitchenReceipt?: boolean;
}

export default function PrintActionModal({
  open,
  onClose,
  transaction,
  items,
  storeSettings,
  paymentMethodName = 'Tunai',
  showCustomerReceipt = false,
  showKitchenReceipt = true,
}: PrintActionModalProps) {
  const [openCustomer, setOpenCustomer] = useState(false);
  const [openKitchen, setOpenKitchen] = useState(false);
  const [openVariant, setOpenVariant] = useState(false);

  const hasVariants = items.some(
    (it) => it.selectedVariants && it.selectedVariants.length > 0
  );
  const variantCount = items.filter(
    (it) => it.selectedVariants && it.selectedVariants.length > 0
  ).length;

  return (
    <>
      {/* Modal Pilihan Cetak */}
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-sm md:max-w-md w-[90vw] max-h-[90vh] overflow-y-auto rounded-3xl p-0 bg-background border border-border shadow-2xl">
          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/80">
            <DialogTitle className="text-center text-foreground flex items-center justify-center gap-2 text-lg font-black tracking-tight">
              <Printer className="w-5 h-5 text-muted-foreground" />
              Pilih Cetak
            </DialogTitle>
            <p className="text-center text-xs text-muted-foreground font-medium mt-1">
              {transaction.receiptNumber}
              {transaction.tableNumber && formatReceiptTable(transaction.tableNumber) !== 'Bawa Pulang'
                ? ` · ${formatReceiptTable(transaction.tableNumber)}`
                : ' · Bawa Pulang'}
            </p>
          </DialogHeader>

          {/* Pilihan Tombol */}
          <div className="p-5 space-y-3">
            {/* Struk Pelanggan */}
            {showCustomerReceipt && (
              <button
                onClick={() => setOpenCustomer(true)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-border hover:border-primary/50 hover:bg-muted/80 transition-all group text-left shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm">Struk Pelanggan</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Struk pembayaran lengkap</p>
                </div>
              </button>
            )}

            {/* Struk Dapur */}
            {showKitchenReceipt && (
              <button
                onClick={() => setOpenKitchen(true)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-border hover:border-primary/50 hover:bg-muted/80 transition-all group text-left shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <ChefHat className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm">Struk Dapur</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Tiket untuk barista / koki</p>
                </div>
              </button>
            )}

            {/* Label Varian */}
            {hasVariants && (
              <button
                onClick={() => setOpenVariant(true)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-border hover:border-primary/50 hover:bg-muted/80 transition-all group text-left shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Tag className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-foreground text-sm">Label Varian</p>
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5">
                      {variantCount} Item
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Label stiker per produk varian</p>
                </div>
              </button>
            )}

            {/* Tutup */}
            <button
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all text-sm font-medium mt-1"
            >
              <X className="w-4 h-4" />
              Tutup
            </button>
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
