import React from 'react';
import { useCashier } from './CashierContext';
import { dbAdmin as db } from '@/lib/db';
import { dbUpdate } from '@/hooks/db-hooks';
import { toast } from 'sonner';
import { X, Check } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// Import external modular modals
import Receipt from '@/components/Receipt';
import BarcodeScanner from '@/admin/components/BarcodeScanner';
import { MidtransPaymentModal } from '@/components/MidtransPaymentModal';
import PaymentModal from '@/admin/components/PaymentModal';
import ProcessingBillsModal from '@/admin/components/CashierProcessingBillsModal';

const CashierModals: React.FC = React.memo(() => {
  const {
    processingBillsOpen,
    setProcessingBillsOpen,
    processingBills,
    checkoutOpen,
    setCheckoutOpen,
    subtotal,
    txDiscountAmount,
    customerName,
    setCustomerName,
    tableNumber,
    setTableNumber,
    remarks,
    setRemarks,
    paymentMethods,
    isCheckingOut,
    setPayments,
    setPaymentMethodId,
    setCheckoutDataCache,
    setMidtransPaymentType,
    processCheckoutToDb,
    paymentMethodId,
    checkoutDataCache,
    
    // Discount Dialog
    discountDialogOpen,
    setDiscountDialogOpen,
    voucherApplied,
    setVoucherApplied,
    voucherCode,
    setVoucherCode,
    vouchers,
    voucherLoading,
    setVoucherLoading,
    tempDiscountType,
    setTempDiscountType,
    tempDiscountValue,
    setTempDiscountValue,
    txDiscountType,
    setTxDiscountType,
    txDiscountValue,
    setTxDiscountValue,

    // Receipt Dialog
    lastTransaction,
    receiptOpen,
    setReceiptOpen,
    lastTxItems,
    storeSettings,

    // Scanner
    scannerOpen,
    setScannerOpen,
    handleScan,

    // Cancel Bill
    cancelDialogOpen,
    setCancelDialogOpen,
    cancelTargetTx,
    setCancelTargetTx,
    cancelOpenBill,

    // Midtrans Payment
    midtransPaymentType,
    total,

    // Variant Selection
    variantProduct,
    setVariantProduct,
    variantSelection,
    setVariantSelection,
    variantNotes,
    setVariantNotes,
    addToCart
  } = useCashier();

  return (
    <React.Fragment>
      {/* Processing Bills Sheet */}
      <ProcessingBillsModal
        open={processingBillsOpen}
        onOpenChange={setProcessingBillsOpen}
        processingBills={processingBills}
        onCompleteBill={async (id) => {
          await dbUpdate('transactions', id, { status: 'lunas' });
          toast.success('Pesanan telah diselesaikan!');
          if (processingBills.length <= 1) setProcessingBillsOpen(false);
        }}
      />

      {/* Checkout Dialog */}
      <PaymentModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        baseTotal={subtotal - txDiscountAmount}
        initialCustomerName={customerName}
        initialTableNumber={tableNumber}
        initialRemarks={remarks}
        paymentMethods={paymentMethods || []}
        isCheckingOut={isCheckingOut}
        onCheckout={(data) => {
          setPayments(data.finalPayments);
          setPaymentMethodId(data.primaryMethodId.toString());
          setCustomerName(data.customerName);
          setTableNumber(data.tableNumber);
          setRemarks(data.remarks);
          
          if (data.paymentMethodCategory && ['qris', 'transfer', 'e-wallet', 'lainnya'].includes(data.paymentMethodCategory)) {
            setCheckoutDataCache(data);
            setCheckoutOpen(false);
            setMidtransPaymentType(data.paymentMethodCategory as 'qris' | 'transfer' | 'e-wallet' | 'lainnya');
          } else {
            processCheckoutToDb(data);
          }
        }}
      />

      {/* Discount Dialog */}
      <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
        <DialogContent className="max-w-[400px] w-[95vw] max-h-[90vh] rounded-xl flex flex-col p-0 overflow-hidden border border-border/60 shadow-2xl">
          <DialogHeader className="px-6 py-5 border-b border-border/50 bg-muted/10 shrink-0">
            <DialogTitle>Diskon & Voucher</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-5 overflow-y-auto flex-1 custom-scrollbar">

            {/* === VOUCHER INPUT === */}
            <div className="bg-muted/40 rounded-xl p-3 space-y-2 border border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kode Voucher</p>
              {voucherApplied ? (
                <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-2">
                  <div>
                    <p className="font-bold text-green-700 dark:text-green-400 text-sm font-mono">{voucherApplied.code}</p>
                    <p className="text-xs text-green-600 dark:text-green-500">
                      Diskon {voucherApplied.type === 'percentage' ? `${voucherApplied.value}%` : `Rp ${voucherApplied.value.toLocaleString('id-ID')}`} berhasil diterapkan
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                    setVoucherApplied(null);
                    setVoucherCode('');
                    setTxDiscountType(null);
                    setTxDiscountValue('');
                  }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={voucherCode}
                    onChange={e => setVoucherCode(e.target.value.toUpperCase())}
                    placeholder="Masukkan kode voucher"
                    className="h-9 text-sm font-mono uppercase"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const found = vouchers.find(v => v.code === voucherCode.trim().toUpperCase());
                        if (found) {
                          setVoucherApplied(found);
                          setTempDiscountType(found.type as 'percentage' | 'nominal');
                          setTempDiscountValue(String(found.value));
                          toast.success(`Voucher ${found.code} berhasil diterapkan!`);
                        } else {
                          toast.error('Kode voucher tidak ditemukan atau tidak aktif');
                        }
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-9 text-xs shrink-0"
                    disabled={voucherLoading || !voucherCode.trim()}
                    onClick={() => {
                      setVoucherLoading(true);
                      const found = vouchers.find(v => v.code === voucherCode.trim().toUpperCase());
                      if (found) {
                        setVoucherApplied(found);
                        setTempDiscountType(found.type as 'percentage' | 'nominal');
                        setTempDiscountValue(String(found.value));
                        toast.success(`Voucher ${found.code} berhasil!`);
                      } else {
                        toast.error('Kode voucher tidak ditemukan atau tidak aktif');
                      }
                      setVoucherLoading(false);
                    }}
                  >
                    Apply
                  </Button>
                </div>
              )}
            </div>

            {/* === MANUAL DISCOUNT === */}
            {!voucherApplied && (
              <React.Fragment>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Jenis Diskon Manual</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setTempDiscountType('nominal')}
                      className={cn(
                        'p-3 rounded-xl text-sm font-semibold border-2 transition-colors', 
                        tempDiscountType === 'nominal' ? 'border-primary bg-primary/5 text-primary' : 'border-muted bg-muted/50 text-muted-foreground'
                      )}
                    >
                      Nominal (Rp)
                    </button>
                    <button
                      onClick={() => setTempDiscountType('percentage')}
                      className={cn(
                        'p-3 rounded-xl text-sm font-semibold border-2 transition-colors', 
                        tempDiscountType === 'percentage' ? 'border-primary bg-primary/5 text-primary' : 'border-muted bg-muted/50 text-muted-foreground'
                      )}
                    >
                      Persen (%)
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-sm font-medium">{tempDiscountType === 'percentage' ? 'Persentase Diskon' : 'Jumlah Diskon'}</p>
                  <Input
                    type="number"
                    value={tempDiscountValue}
                    onChange={e => setTempDiscountValue(e.target.value)}
                    placeholder={tempDiscountType === 'percentage' ? 'Contoh: 10' : 'Contoh: 5000'}
                    className="h-12 text-lg font-bold text-center"
                  />
                  {tempDiscountType === 'percentage' && Number(tempDiscountValue) > 0 && (
                    <p className="text-xs text-muted-foreground text-center">
                      = Rp {(subtotal * Number(tempDiscountValue) / 100).toLocaleString('id-ID')} dari Rp {subtotal.toLocaleString('id-ID')}
                    </p>
                  )}
                </div>
              </React.Fragment>
            )}

            <div className="flex gap-2">
              {txDiscountType && (
                <Button variant="outline" className="h-11 text-destructive border-destructive/30" onClick={() => {
                  setTxDiscountType(null);
                  setTxDiscountValue('');
                  setVoucherApplied(null);
                  setVoucherCode('');
                  setDiscountDialogOpen(false);
                }}>
                  Hapus
                </Button>
              )}
              <Button 
                className="flex-1 h-11 font-semibold" 
                onClick={() => {
                  if (Number(tempDiscountValue) > 0 || voucherApplied) {
                    setTxDiscountType(tempDiscountType);
                    setTxDiscountValue(tempDiscountValue);
                  } else {
                    setTxDiscountType(null);
                    setTxDiscountValue('');
                  }
                  setDiscountDialogOpen(false);
                }}
              >
                Simpan Diskon
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      {lastTransaction && (
        <Receipt
          open={receiptOpen}
          onClose={() => setReceiptOpen(false)}
          transaction={lastTransaction}
          items={lastTxItems}
          storeSettings={storeSettings}
          paymentMethodName={paymentMethods?.find(pm => pm.id === lastTransaction.paymentMethodId)?.name || 'Tunai'}
        />
      )}

      {/* Barcode Scanner */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
      />

      {/* Cancel Open Bill Confirmation */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-[400px] w-[95vw] rounded-xl">
          <DialogHeader>
            <DialogTitle>Batalkan Bill?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Bill ini akan dihapus dan stok produk akan dikembalikan. Apakah Anda yakin ingin membatalkan bill ini?
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => { setCancelDialogOpen(false); setCancelTargetTx(null); }}>
              Tidak
            </Button>
            <Button
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => {
                if (cancelTargetTx) {
                  cancelOpenBill(cancelTargetTx);
                }
                setCancelDialogOpen(false);
              }}
            >
              Batalkan Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Midtrans Payment Modal */}
      <MidtransPaymentModal
        isOpen={midtransPaymentType !== null}
        paymentType={midtransPaymentType}
        amount={total}
        customerName={customerName}
        paymentMethod={paymentMethods?.find(m => m.id!.toString() === (checkoutDataCache?.primaryMethodId?.toString() || paymentMethodId))}
        onSuccess={() => {
          setMidtransPaymentType(null);
          processCheckoutToDb(checkoutDataCache || undefined);
          setCheckoutDataCache(null);
        }}
        onPending={() => {
          setMidtransPaymentType(null);
          toast.warning('Pembayaran pending, silakan selesaikan via Midtrans.');
        }}
        onError={(err) => {
          toast.error('Gagal memproses pembayaran via Midtrans');
          console.error(err);
        }}
        onClose={() => setMidtransPaymentType(null)}
      />

      {/* Variant Selection Dialog */}
      <Dialog open={!!variantProduct} onOpenChange={v => !v && setVariantProduct(null)}>
        <DialogContent className="max-w-[440px] w-[95vw] max-h-[90vh] rounded-xl flex flex-col p-0 overflow-hidden border border-border/60 shadow-2xl">
          <DialogHeader className="px-6 py-5 border-b border-border/50 bg-muted/10 shrink-0">
            <DialogTitle>{variantProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 px-6 py-5 custom-scrollbar">
            {variantProduct?.variants?.map((group, gIdx) => (
              <div key={gIdx} className="bg-muted/30 rounded-xl p-3 border border-border">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">{group.name}</span>
                    <span className="text-[10px] text-muted-foreground">{group.type === 'single' ? 'Pilih satu' : 'Pilih banyak'}</span>
                  </div>
                  {group.required && <Badge variant="secondary" className="text-[9px] bg-primary/10 text-primary">WAJIB</Badge>}
                </div>
                <div className="space-y-1.5">
                  {group.options.map((opt, oIdx) => {
                    const isSelected = variantSelection[group.name]?.[opt.name] !== undefined;
                    return (
                      <div
                        key={oIdx}
                        onClick={() => {
                          setVariantSelection(prev => {
                            const newSel = { ...prev };
                            if (!newSel[group.name]) newSel[group.name] = {};
                            if (group.type === 'single') {
                              newSel[group.name] = { [opt.name]: opt.price };
                            } else {
                              if (newSel[group.name][opt.name] !== undefined) delete newSel[group.name][opt.name];
                              else newSel[group.name][opt.name] = opt.price;
                            }
                            return newSel;
                          });
                        }}
                        className={`flex justify-between items-center p-2 rounded-lg cursor-pointer border transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border bg-background'}`}
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <div className={`w-4 h-4 flex items-center justify-center border ${group.type === 'single' ? 'rounded-full' : 'rounded'} ${isSelected ? 'border-primary bg-primary' : 'border-input'}`}>
                            {isSelected && <div className={`bg-primary-foreground ${group.type === 'single' ? 'w-1.5 h-1.5 rounded-full' : 'w-2 h-2 flex items-center justify-center'}`}>
                              {group.type !== 'single' && <Check className="w-2 h-2" />}
                            </div>}
                          </div>
                          <span>{opt.name}</span>
                        </div>
                        {opt.price > 0 && <span className="text-xs text-muted-foreground">+ Rp {opt.price.toLocaleString('id-ID')}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="space-y-1.5 mt-2">
              <label className="text-xs font-semibold">Catatan</label>
              <Input
                value={variantNotes}
                onChange={e => setVariantNotes(e.target.value)}
                placeholder="Contoh: Jangan pedas..."
                className="h-9"
              />
            </div>
          </div>
          <div className="shrink-0 px-6 pb-5 pt-4 border-t border-border bg-muted/5">
            <Button
              className="w-full"
              disabled={(() => {
                if (!variantProduct?.variants) return false;
                for (const group of variantProduct.variants) {
                  if (group.required && Object.keys(variantSelection[group.name] || {}).length === 0) return true;
                }
                return false;
              })()}
              onClick={() => {
                const flatVariants: { groupName: string; optionName: string; price: number }[] = [];
                for (const groupName in variantSelection) {
                  for (const optionName in variantSelection[groupName]) {
                    flatVariants.push({ groupName, optionName, price: variantSelection[groupName][optionName] });
                  }
                }
                addToCart(variantProduct, flatVariants, variantNotes);
              }}
            >
              Tambah ke Keranjang
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </React.Fragment>
  );
});

CashierModals.displayName = 'CashierModals';

export default CashierModals;
