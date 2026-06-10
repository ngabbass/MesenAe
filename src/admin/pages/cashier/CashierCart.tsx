import React, { useMemo } from 'react';
import { useCashier, getItemSubtotal } from './CashierContext';
import { 
  ShoppingCart, Plus, Minus, X, Pencil, User, Hash, Tag, Save, CreditCard, Trash2 
} from "lucide-react";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useDbQuery } from '@/hooks/db-hooks';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CashierCart: React.FC = React.memo(() => {
  const {
    cart,
    cartCount,
    editingTxId,
    removeFromCart,
    updateQty,
    editingItemNotes,
    setEditingItemNotes,
    tempItemNotes,
    setTempItemNotes,
    updateItemNotes,
    customerName,
    setCustomerName,
    tableNumber,
    setTableNumber,
    txDiscountAmount,
    txDiscountType,
    txDiscountValue,
    setTempDiscountType,
    setTempDiscountValue,
    setDiscountDialogOpen,
    subtotal,
    ppnAmount,
    adminFee,
    total,
    hasEditAccess,
    saveOpenBill,
    setCheckoutOpen,
    paymentMethods,
    setPaymentMethodId,
    setPaymentAmount,
    setIsQuickAdding,
    cartOpen,
    setCartOpen,
    rp,
    setCart
  } = useCashier();

  const storeSettings = useDbQuery<any>('storeSettings')?.[0];
  const tables = useMemo(() => Array.isArray(storeSettings?.tables) ? storeSettings.tables : [], [storeSettings?.tables]);

  const handleResetCart = () => {
    if (cart.length === 0) return;
    const oldCart = [...cart];
    setCart([]);
    toast.success("Keranjang dikosongkan", {
      action: {
        label: "Batal (Undo)",
        onClick: () => setCart(oldCart)
      }
    });
  };

  return (
    <React.Fragment>
      {/* Desktop Cart Panel */}
      <div className="hidden md:flex md:w-80 lg:w-96 flex-col bg-card rounded-xl border border-border shrink-0 h-fit min-h-[450px] self-start shadow-sm mt-0">
        <div className="p-4 border-b border-border shrink-0 flex items-center justify-between">
          <h3 className="text-base font-bold flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-primary" />
            Keranjang ({cartCount} item)
            {editingTxId && <span className="text-xs font-normal text-muted-foreground">— edit</span>}
          </h3>
          {cart.length > 0 && hasEditAccess && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs font-bold text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2.5 rounded-lg shrink-0 gap-1"
              onClick={handleResetCart}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset
            </Button>
          )}
        </div>
        {cart.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <p className="text-sm text-muted-foreground">Keranjang kosong</p>
          </div>
        ) : (
          <div className="flex flex-col flex-1">
            <div className="flex-1 space-y-3 p-4">
              {cart.map((item, index) => (
                <div key={index} className="bg-muted/50 p-3 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{item.product.name}</p>
                      {item.selectedVariants && item.selectedVariants.length > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          + {item.selectedVariants.map(v => v.optionName).join(', ')}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">Rp {(item.product.price || 0).toLocaleString('id-ID')} × {item.qty}</p>
                      <p className="text-sm font-bold text-primary">{rp(getItemSubtotal(item))}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 rounded-full" 
                        onClick={() => item.qty === 1 ? removeFromCart(index) : updateQty(index, -1)}
                        disabled={!hasEditAccess}
                      >
                        {item.qty === 1 ? <X className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                      </Button>
                      <span className="w-8 text-center text-sm font-bold">{item.qty}</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 rounded-full" 
                        onClick={() => updateQty(index, 1)}
                        disabled={!hasEditAccess}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.notes ? (
                      <button
                        className={cn("flex items-center gap-1 text-[10px] text-accent bg-accent/10 px-2 py-0.5 rounded-full", !hasEditAccess && "cursor-default")}
                        onClick={() => { if (hasEditAccess) { setEditingItemNotes(index); setTempItemNotes(item.notes || ''); } }}
                        disabled={!hasEditAccess}
                      >
                        {hasEditAccess && <Pencil className="w-2.5 h-2.5 mr-1" />}
                        {item.notes}
                      </button>
                    ) : (
                      hasEditAccess && (
                        <button
                          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                          onClick={() => { setEditingItemNotes(index); setTempItemNotes(''); }}
                        >
                          <Pencil className="w-2.5 h-2.5" />
                          Tambah catatan
                        </button>
                      )
                    )}
                  </div>
                  {editingItemNotes === index && (
                    <div className="flex gap-2 items-center">
                      <Input
                        autoFocus
                        value={tempItemNotes}
                        onChange={e => setTempItemNotes(e.target.value)}
                        placeholder="Contoh: less sugar..."
                        className="h-8 text-xs"
                        onKeyDown={e => {
                          if (e.key === 'Enter') { updateItemNotes(index, tempItemNotes); setEditingItemNotes(null); }
                          if (e.key === 'Escape') setEditingItemNotes(null);
                        }}
                      />
                      <Button size="sm" className="h-8 text-xs" onClick={() => { updateItemNotes(index, tempItemNotes); setEditingItemNotes(null); }}>OK</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 px-4 mb-2">
              <div className="relative flex-[1.2]">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground z-10" />
                <Input
                  placeholder="Nama pelanggan"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="pl-8 h-9 text-xs"
                  disabled={!hasEditAccess}
                />
              </div>
              <div className="relative flex-[0.8] min-w-0">
                <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground z-10" />
                <Select value={tableNumber} onValueChange={setTableNumber} disabled={!hasEditAccess}>
                  <SelectTrigger className="pl-8 h-9 text-xs rounded-lg bg-background border-border/70 w-full text-left">
                    <SelectValue placeholder="Pilih Meja" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-[200px]">
                    <SelectItem value="Bawa Pulang">Bawa Pulang</SelectItem>
                    {tables.map((t: string) => {
                      const label = t.includes(' - ') ? t : (t.toLowerCase().startsWith('meja') ? t : `Meja ${t}`);
                      return (
                        <SelectItem key={t} value={t}>
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3 px-4 pb-4">
              {txDiscountAmount > 0 ? (
                <button
                  onClick={() => { if (hasEditAccess) { setTempDiscountType(txDiscountType!); setTempDiscountValue(txDiscountValue); setDiscountDialogOpen(true); } }}
                  className={cn("flex items-center gap-1.5 text-xs text-destructive font-medium", !hasEditAccess && "cursor-default pointer-events-none")}
                  disabled={!hasEditAccess}
                >
                  <Tag className="w-3.5 h-3.5" />
                  Diskon: {txDiscountType === 'percentage' ? `${txDiscountValue}%` : `Rp ${Number(txDiscountValue).toLocaleString('id-ID')}`}
                  {hasEditAccess && <span className="text-[10px] underline ml-1">Ubah</span>}
                </button>
              ) : (
                hasEditAccess && (
                  <button
                    onClick={() => { setTempDiscountType('nominal'); setTempDiscountValue(''); setDiscountDialogOpen(true); }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>Tambah Diskon</span>
                  </button>
                )
              )}

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{rp(subtotal)}</span>
              </div>
              {txDiscountAmount > 0 && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>Diskon</span>
                  <span>-{rp(txDiscountAmount)}</span>
                </div>
              )}
              {ppnAmount > 0 && (
                <div className="flex justify-between text-sm text-blue-600">
                  <span>Pajak (PPN {storeSettings?.taxPercentage || 0}%)</span>
                  <span>{rp(ppnAmount)}</span>
                </div>
              )}
              {adminFee > 0 && (
                <div className="flex justify-between text-sm text-blue-600">
                  <span>Biaya Admin</span>
                  <span>{rp(adminFee)}</span>
                </div>
              )}
              <div className="flex justify-between items-center font-bold text-lg border-t border-slate-100 dark:border-slate-800 pt-3">
                <span>Total</span>
                <span className="text-primary">{rp(total)}</span>
              </div>

              {hasEditAccess && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-12 text-sm font-semibold border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800"
                    onClick={saveOpenBill}
                    disabled={cart.length === 0}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Simpan Pesanan
                  </Button>
                  <Button
                    className="flex-1 h-12 text-sm font-semibold"
                    onClick={() => { 
                      if (!tableNumber || !tableNumber.trim()) {
                        toast.error('Harap pilih nomor meja terlebih dahulu untuk Makan di Tempat!');
                        return;
                      }
                      setCheckoutOpen(true); 
                      setPaymentMethodId(paymentMethods?.[0]?.id?.toString() ?? ''); 
                      setPaymentAmount(total.toString()); 
                      setIsQuickAdding(false); 
                    }}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Bayar
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cart FAB (mobile only) */}
      {cartCount > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="md:hidden fixed bottom-6 right-4 flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 rounded-full shadow-xl active:scale-95 transition-transform z-40"
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="font-bold text-sm">{cartCount} item</span>
          <span className="text-sm font-bold">• Rp {(total || 0).toLocaleString('id-ID')}</span>
        </button>
      )}

      {/* Cart Sheet (mobile only) */}
      <div className="md:hidden">
        <Sheet open={cartOpen} onOpenChange={(open) => { setCartOpen(open); if (!open) setEditingItemNotes(null); }}>
          <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl max-w-lg mx-auto">
            <SheetHeader>
              <SheetTitle className="text-left flex items-center justify-between pr-6">
                <span>
                  Keranjang ({cartCount} item)
                  {editingTxId && <span className="text-xs font-normal text-muted-foreground ml-2">— edit open bill</span>}
                </span>
                {cart.length > 0 && hasEditAccess && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs font-bold text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2.5 rounded-lg gap-1"
                    onClick={handleResetCart}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Reset
                  </Button>
                )}
              </SheetTitle>
            </SheetHeader>
            <div className="flex flex-col h-full mt-4">
              <div className="flex-1 overflow-y-auto space-y-3 pb-4">
                {cart.map((item, index) => (
                  <div key={index} className="bg-muted/50 p-3 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{item.product.name}</p>
                        {item.selectedVariants && item.selectedVariants.length > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            + {item.selectedVariants.map(v => v.optionName).join(', ')}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">Rp {(item.product.price || 0).toLocaleString('id-ID')} × {item.qty}</p>
                        <p className="text-sm font-bold text-primary">{rp(getItemSubtotal(item))}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-8 w-8 rounded-full" 
                          onClick={() => item.qty === 1 ? removeFromCart(index) : updateQty(index, -1)}
                          disabled={!hasEditAccess}
                        >
                          {item.qty === 1 ? <X className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        </Button>
                        <span className="w-8 text-center text-sm font-bold">{item.qty}</span>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-8 w-8 rounded-full" 
                          onClick={() => updateQty(index, 1)}
                          disabled={!hasEditAccess}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.notes ? (
                        <button
                          className={cn("flex items-center gap-1 text-[10px] text-accent bg-accent/10 px-2 py-0.5 rounded-full", !hasEditAccess && "cursor-default")}
                          onClick={() => { if (hasEditAccess) { setEditingItemNotes(index); setTempItemNotes(item.notes || ''); } }}
                          disabled={!hasEditAccess}
                        >
                          {hasEditAccess && <Pencil className="w-2.5 h-2.5 mr-1" />}
                          {item.notes}
                        </button>
                      ) : (
                        hasEditAccess && (
                          <button
                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                            onClick={() => { setEditingItemNotes(index); setTempItemNotes(''); }}
                          >
                            <Pencil className="w-2.5 h-2.5" />
                            Tambah catatan
                          </button>
                        )
                      )}
                    </div>
                    {/* Inline notes editor */}
                    {editingItemNotes === index && (
                      <div className="flex gap-2 items-center">
                        <Input
                          autoFocus
                          value={tempItemNotes}
                          onChange={e => setTempItemNotes(e.target.value)}
                          placeholder="Contoh: less sugar..."
                          className="h-8 text-xs"
                          onKeyDown={e => {
                            if (e.key === 'Enter') { updateItemNotes(index, tempItemNotes); setEditingItemNotes(null); }
                            if (e.key === 'Escape') setEditingItemNotes(null);
                          }}
                        />
                        <Button size="sm" className="h-8 text-xs" onClick={() => { updateItemNotes(index, tempItemNotes); setEditingItemNotes(null); }}>OK</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Customer / Table quick inputs */}
              <div className={cn("space-y-2 mb-2", !hasEditAccess && "pointer-events-none opacity-85")}>
                <div className="flex bg-muted/50 p-1 rounded-lg">
                  <button 
                    className={cn(
                      "flex-1 text-[11px] py-1.5 rounded-md font-bold transition-all", 
                      tableNumber === 'Bawa Pulang' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setTableNumber('Bawa Pulang')}
                    disabled={!hasEditAccess}
                  >
                    Bawa Pulang (Take Away)
                  </button>
                  <button 
                    className={cn(
                      "flex-1 text-[11px] py-1.5 rounded-md font-bold transition-all", 
                      tableNumber !== 'Bawa Pulang' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setTableNumber(tableNumber === 'Bawa Pulang' ? '' : tableNumber)}
                    disabled={!hasEditAccess}
                  >
                    Makan di Tempat
                  </button>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Nama pelanggan"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      className="pl-8 h-9 text-xs"
                      disabled={!hasEditAccess}
                    />
                  </div>
                  {tableNumber !== 'Bawa Pulang' && (
                    <div className="relative flex-[0.8] min-w-0">
                      <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground z-10" />
                      <Select value={tableNumber} onValueChange={setTableNumber} disabled={!hasEditAccess}>
                        <SelectTrigger className="pl-8 h-9 text-xs rounded-lg bg-background border-border/70 w-full text-left">
                          <SelectValue placeholder="Pilih Meja" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl max-h-[200px]">
                          {tables.length === 0 ? (
                            <SelectItem value="none" disabled>Belum ada meja</SelectItem>
                          ) : (
                            tables.map((t: string) => {
                              const label = t.includes(' - ') ? t : (t.toLowerCase().startsWith('meja') ? t : `Meja ${t}`);
                              return (
                                <SelectItem key={t} value={t}>
                                  {label}
                                </SelectItem>
                              );
                            })
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div className="border-t pt-4 space-y-3 pb-6">
                {txDiscountAmount > 0 ? (
                  <button
                    onClick={() => { if (hasEditAccess) { setTempDiscountType(txDiscountType!); setTempDiscountValue(txDiscountValue); setDiscountDialogOpen(true); } }}
                    className={cn("flex items-center gap-1.5 text-xs text-destructive font-medium", !hasEditAccess && "cursor-default pointer-events-none")}
                    disabled={!hasEditAccess}
                  >
                    <Tag className="w-3.5 h-3.5" />
                    Diskon: {txDiscountType === 'percentage' ? `${txDiscountValue}%` : `Rp ${Number(txDiscountValue).toLocaleString('id-ID')}`}
                    {hasEditAccess && <span className="text-[10px] underline ml-1">Ubah</span>}
                  </button>
                ) : (
                  hasEditAccess && (
                    <button
                      onClick={() => { setTempDiscountType('nominal'); setTempDiscountValue(''); setDiscountDialogOpen(true); }}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>Tambah Diskon</span>
                    </button>
                  )
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{rp(subtotal)}</span>
                </div>
                {txDiscountAmount > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Diskon</span>
                    <span>-{rp(txDiscountAmount)}</span>
                  </div>
                )}
                {ppnAmount > 0 && (
                  <div className="flex justify-between text-sm text-blue-600">
                    <span>Pajak (PPN {storeSettings?.taxPercentage || 0}%)</span>
                    <span>{rp(ppnAmount)}</span>
                  </div>
                )}
                {adminFee > 0 && (
                  <div className="flex justify-between text-sm text-blue-600">
                    <span>Biaya Admin</span>
                    <span>{rp(adminFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">{rp(total)}</span>
                </div>

                {/* Action buttons */}
                {hasEditAccess && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 h-12 text-sm font-semibold border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800"
                      onClick={saveOpenBill}
                      disabled={cart.length === 0}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Simpan Pesanan
                    </Button>
                    <Button
                      className="flex-1 h-12 text-sm font-semibold"
                      onClick={() => { 
                        if (!tableNumber || !tableNumber.trim()) {
                          toast.error('Harap pilih nomor meja terlebih dahulu untuk Makan di Tempat!');
                          return;
                        }
                        setCheckoutOpen(true); 
                        setPaymentMethodId(paymentMethods?.[0]?.id?.toString() ?? ''); 
                        setPaymentAmount(total.toString()); 
                        setIsQuickAdding(false); 
                      }}
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Bayar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </React.Fragment>
  );
});

CashierCart.displayName = 'CashierCart';

export default CashierCart;
