import React, { useState, useRef } from 'react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toPng } from 'html-to-image';
import {
  Download, Share2, Printer, Loader2, Flame, Tag, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatReceiptTable } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { printHtmlContent, universalPrint } from '@/lib/print-helper';
import type { Transaction, TransactionItemRecord, StoreSettings } from '@/hooks/db-hooks';
import { Capacitor } from '@capacitor/core';

interface KitchenReceiptModalProps {
  open: boolean;
  onClose: () => void;
  transaction: Transaction;
  items: TransactionItemRecord[];
  storeSettings?: StoreSettings;
  onOpenVariantLabels?: () => void;
}

export default function KitchenReceiptModal({
  open,
  onClose,
  transaction,
  items,
  storeSettings,
  onOpenVariantLabels,
}: KitchenReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Helper to convert dataUrl to Blob for browser sharing
  const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    const res = await fetch(dataUrl);
    return await res.blob();
  };

  const captureReceipt = async (): Promise<string | null> => {
    if (!receiptRef.current) return null;
    try {
      const isNative = Capacitor.isNativePlatform();
      return await toPng(receiptRef.current, {
        cacheBust: true,
        fontEmbedCSS: '',
        pixelRatio: isNative ? 1.5 : 3,
        backgroundColor: '#ffffff',
        style: {
          transform: 'none',
          animation: 'none',
          transition: 'none',
        }
      });
    } catch (err) {
      console.warn('Gagal membuat gambar struk dapur via toPng:', err);
      toast.error('Gagal membuat gambar struk dapur');
      return null;
    }
  };

  const handleSystemPrint = async () => {
    setPrinting(true);
    toast.info('Menyiapkan struk dapur untuk cetak...');
    try {
      const dataUrl = await captureReceipt();
      if (!dataUrl) return;

      const printed = await printHtmlContent(dataUrl, `Dapur_${transaction.receiptNumber}`);
      if (!printed) {
        await universalPrint(dataUrl, `Dapur_${transaction.receiptNumber}`);
      }
    } catch (err) {
      console.error('System print error:', err);
      toast.error('Gagal membuka cetak sistem');
    } finally {
      setPrinting(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const dataUrl = await captureReceipt();
      if (!dataUrl) return;
      const link = document.createElement('a');
      link.download = `Tiket-Dapur-${transaction.receiptNumber}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Tiket berhasil diunduh');
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const dataUrl = await captureReceipt();
      if (!dataUrl) return;
      const blob = await dataUrlToBlob(dataUrl);
      if (!blob) return;
      try {
        if (navigator.share) {
          const file = new File([blob], `Tiket-Dapur-${transaction.receiptNumber}.png`, {
            type: 'image/png',
          });
          await navigator.share({
            title: `Tiket Dapur - ${transaction.receiptNumber}`,
            text: `Pesanan Dapur: ${storeSettings?.storeName || 'Resto'}`,
            files: [file],
          });
        } else {
          let text = `*DAPUR: ${storeSettings?.storeName || 'Resto'}*\nNo: ${transaction.receiptNumber}\nMeja: ${formatReceiptTable(transaction.tableNumber)}\nWaktu: ${format(new Date(transaction.date), 'HH:mm - dd MMM', { locale: localeId })}\n\n*PESANAN:*\n`;
          items.forEach((item) => {
            text += `- [${item.quantity}x] ${item.productName}\n`;
            if (item.selectedVariants?.length)
              text += `  + ${item.selectedVariants.map((v: any) => v.optionName).join(', ')}\n`;
            if (item.notes) text += `  📝 ${item.notes}\n`;
          });
          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError')
          toast.error('Gagal membagikan tiket');
      }
    } finally {
      setSharing(false);
    }
  };

  const handlePrint = async () => {
    // @ts-ignore
    const isNative = window.Capacitor ? window.Capacitor.isNativePlatform() : false;
    if (!isNative) { handleSystemPrint(); return; }

    let dapurPrinter: any = null;
    try {
      const saved = localStorage.getItem('mesenae_printers');
      if (saved) {
        const printers = JSON.parse(saved);
        dapurPrinter = printers.find(
          (p: any) => p.role === 'Struk Dapur & Varian' || p.role === 'Dapur',
        );
      }
    } catch (e) { console.warn('Gagal memuat konfigurasi printer:', e); }

    if (!dapurPrinter) {
      toast.info('Printer belum dikonfigurasi. Membuka dialog cetak sistem...');
      handleSystemPrint();
      return;
    }

    setPrinting(true);
    try {
      const encoder = new TextEncoder();
      const lines: string[] = [];
      lines.push('\x1B\x40'); lines.push('\x1B\x61\x01');
      lines.push('\x1B\x45\x01');
      lines.push(`${storeSettings?.storeName || 'RESTO'}\n`);
      lines.push('*** TIKET DAPUR ***\n');
      lines.push('\x1B\x45\x00');
      lines.push('--------------------------------\n');
      lines.push(`No: ${transaction.receiptNumber}\n`);
      lines.push(`Tgl: ${format(new Date(transaction.date), 'dd/MM/yyyy HH:mm')}\n`);
      lines.push('\x1B\x45\x01');
      lines.push(`MEJA: ${formatReceiptTable(transaction.tableNumber)}\n`);
      lines.push('\x1B\x45\x00');
      lines.push('--------------------------------\n');
      lines.push('\x1B\x61\x00');
      for (const item of items) {
        lines.push('\x1B\x45\x01');
        lines.push(`[${item.quantity}x] ${item.productName}\n`);
        lines.push('\x1B\x45\x00');
        if (item.selectedVariants?.length)
          lines.push(`  + ${item.selectedVariants.map((v: any) => v.optionName).join(', ')}\n`);
        if (item.notes) lines.push(`  Ket: ${item.notes}\n`);
        lines.push('\n');
      }
      lines.push('--------------------------------\n');
      lines.push('\x1B\x61\x01');
      lines.push('-- SELESAI --\n\n\n');
      const data = encoder.encode(lines.join(''));

      await new Promise<void>((resolve, reject) => {
        // @ts-ignore
        if (!window.bluetoothSerial) { reject(new Error('Bluetooth Serial plugin missing')); return; }
        // @ts-ignore
        window.bluetoothSerial.disconnect(() => {}, () => {});
        setTimeout(() => {
          // @ts-ignore
          window.bluetoothSerial.connect(dapurPrinter.address, () => {
            // @ts-ignore
            window.bluetoothSerial.write(data.buffer, () => {
              // @ts-ignore
              window.bluetoothSerial.disconnect();
              resolve();
            }, (writeErr: any) => {
              // @ts-ignore
              window.bluetoothSerial.disconnect();
              reject(writeErr);
            });
          }, (connErr: any) => {
            // @ts-ignore
            window.bluetoothSerial.disconnect();
            reject(connErr);
          });
        }, 150);
      });
      toast.success('Tiket berhasil dicetak di Dapur!');
    } catch (err) {
      console.error('Direct print failed:', err);
      toast.warning('Gagal terkoneksi ke printer Bluetooth. Mengalihkan ke cetak sistem...');
      handleSystemPrint();
    } finally {
      setPrinting(false);
    }
  };

  const busy = downloading || sharing || printing;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm w-[95vw] max-h-[92vh] overflow-y-auto rounded-2xl p-0 bg-background border border-border shadow-2xl flex flex-col gap-0">

        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center justify-center gap-2.5 text-base font-black text-foreground">
            <div className="w-8 h-8 bg-orange-500/10 rounded-xl flex items-center justify-center border border-orange-500/20 shrink-0">
              <Flame className="w-4 h-4 text-orange-500" />
            </div>
            Tiket Dapur
          </DialogTitle>
        </DialogHeader>

        {/* Receipt paper */}
        <div className="px-5 py-5 flex justify-center bg-muted/30 shrink-0">
          <div
            ref={receiptRef}
            className="bg-white text-black shadow rounded-sm"
            style={{ width: 300, padding: 20, fontFamily: "'Courier New', monospace" }}
          >
            <div className="text-center mb-3">
              <h1 className="font-extrabold text-sm tracking-widest uppercase">
                {storeSettings?.storeName || 'RESTO'}
              </h1>
              <div className="mt-1.5 inline-block text-[10px] font-black tracking-widest uppercase border border-current rounded px-2 py-0.5">
                ✦ TIKET DAPUR ✦
              </div>
            </div>

            <div className="border-t-2 border-dashed border-gray-300 my-2.5" />

            <div className="text-[11px] space-y-1 font-bold">
              <div className="flex justify-between">
                <span className="text-gray-500">No. Order</span>
                <span className="font-mono">{transaction.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Waktu</span>
                <span>{format(new Date(transaction.date), 'dd/MM/yy HH:mm')}</span>
              </div>
              {transaction.customerName && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Pemesan</span>
                  <span className="uppercase truncate max-w-[130px]">{transaction.customerName}</span>
                </div>
              )}
              <div className="flex justify-between items-center mt-2 border border-gray-300 rounded p-1.5">
                <span className="text-gray-500 text-[10px]">NOMOR MEJA</span>
                <span className="font-black text-xl tracking-widest">
                  {formatReceiptTable(transaction.tableNumber)}
                </span>
              </div>
            </div>

            <div className="border-t-2 border-dashed border-gray-300 my-2.5" />

            <div className="space-y-2.5">
              {items.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <span className="font-black text-sm w-6 shrink-0">{item.quantity}×</span>
                  <div className="flex-1">
                    <p className="font-extrabold text-[11px] uppercase leading-snug">{item.productName}</p>
                    {item.selectedVariants && item.selectedVariants.length > 0 && (
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        + {item.selectedVariants.map((v: any) => v.optionName).join(', ')}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-[10px] italic text-gray-500 mt-0.5">📝 {item.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t-2 border-dashed border-gray-300 mt-4 mb-2" />
            <p className="text-center text-[9px] text-gray-400 font-bold uppercase tracking-widest">
              — SELESAI —
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 pt-4 space-y-2.5 shrink-0">
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                label: 'Unduh',
                Icon: Download,
                loading: downloading,
                onClick: handleDownload,
                className: 'border-border bg-card hover:bg-muted text-muted-foreground',
              },
              {
                label: 'Bagikan',
                Icon: Share2,
                loading: sharing,
                onClick: handleShare,
                className: 'border-border bg-card hover:bg-muted text-muted-foreground',
              },
              {
                label: 'Cetak',
                Icon: Printer,
                loading: printing,
                onClick: handlePrint,
                className: 'border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary',
              },
            ].map(({ label, Icon, loading, onClick, className }) => (
              <button
                key={label}
                onClick={onClick}
                disabled={busy}
                className={cn(
                  'flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                  className,
                )}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
                <span className="text-[10px] font-bold">{label}</span>
              </button>
            ))}
          </div>

          {onOpenVariantLabels && items.some((it) => it.selectedVariants?.length > 0) && (
            <button
              onClick={() => { onClose(); onOpenVariantLabels(); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-sm font-semibold transition-colors"
            >
              <Tag className="w-4 h-4 text-primary" />
              Label Varian ({items.filter((it) => it.selectedVariants?.length > 0).length} Item)
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-muted/40 hover:bg-muted text-muted-foreground text-sm font-semibold transition-colors"
          >
            <X className="w-4 h-4" />
            Tutup
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
