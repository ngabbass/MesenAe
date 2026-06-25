import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { toPng } from 'html-to-image';
import { Download, Share2, Printer, Loader2, ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Transaction, StoreSettings, TransactionItemRecord } from '@/hooks/db-hooks';
import { universalPrint, printHtmlContent } from '@/lib/print-helper';
import { formatReceiptTable } from '@/lib/utils';
import { Capacitor } from '@capacitor/core';

interface KitchenReceiptProps {
  open: boolean;
  onClose: () => void;
  transaction: Transaction;
  items: TransactionItemRecord[];
  storeSettings?: StoreSettings;
}

export default function KitchenReceipt({ open, onClose, transaction, items, storeSettings }: KitchenReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const [downloading, setDownloading] = useState<boolean>(false);
  const [sharing, setSharing] = useState<boolean>(false);
  const [printing, setPrinting] = useState<boolean>(false);

  // Helper to convert dataUrl to Blob for browser sharing
  const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    const res = await fetch(dataUrl);
    return await res.blob();
  };

  const captureReceipt = async (): Promise<string | null> => {
    if (!receiptRef.current) return null;
    try {
      // Menggunakan pixelRatio tinggi secara konstan (3) untuk native & web
      // agar gambar tetap tajam saat di-downscale oleh print spooler
      const url = await toPng(receiptRef.current, {
        cacheBust: true,
        fontEmbedCSS: '',
        pixelRatio: 3, 
        backgroundColor: '#ffffff',
        style: {
          transform: 'none',
          animation: 'none',
          transition: 'none',
        }
      });
      return url;
    } catch (err) {
      console.warn('Gagal membuat gambar struk dapur via toPng:', err);
      toast.error('Gagal membuat gambar struk dapur');
      return null;
    }
  };

  const handleSystemPrint = async () => {
    setPrinting(true);
    try {
      const dataUrl = await captureReceipt();
      if (!dataUrl) { setPrinting(false); return; }

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
      
      // @ts-ignore
      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        try {
          const base64Data = dataUrl.split(',')[1];
          const fileName = `Dapur_${transaction.receiptNumber}_${Date.now()}.png`;
          
          const { Filesystem, Directory } = await import('@capacitor/filesystem');
          await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Documents
          });
          toast.success(`Struk Dapur disimpan di folder Documents (${fileName})`);
        } catch (e) {
          console.error('Error saving file:', e);
          toast.error('Gagal menyimpan struk ke penyimpanan lokal');
        }
      } else {
        const link = document.createElement('a');
        link.download = `Dapur-${transaction.receiptNumber}.png`;
        link.href = dataUrl;
        link.click();
        toast.success('Struk Dapur berhasil diunduh');
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const dataUrl = await captureReceipt();
      if (!dataUrl) return;

      try {
        // @ts-ignore
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
          const { Filesystem, Directory } = await import('@capacitor/filesystem');
          const { Share } = await import('@capacitor/share');
          
          const fileName = `Dapur_${transaction.receiptNumber}.png`;
          const base64Data = dataUrl.split(',')[1];
          const result = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache
          });
          
          await Share.share({
            title: `Struk Dapur - ${transaction.receiptNumber}`,
            text: `Pesanan Dapur dari ${storeSettings?.storeName || 'Toko'}`,
            url: result.uri,
            dialogTitle: 'Bagikan Struk Dapur'
          });
        } else {
          const blob = await dataUrlToBlob(dataUrl);
          if (!blob) return;

          if (navigator.share) {
            const file = new File([blob], `Dapur-${transaction.receiptNumber}.png`, { type: 'image/png' });
            await navigator.share({
              title: `Struk Dapur - ${transaction.receiptNumber}`,
              text: `Pesanan Dapur dari ${storeSettings?.storeName || 'Toko'}`,
              files: [file],
            });
          } else {
            let textList = `*DAPUR: ${storeSettings?.storeName || 'Toko'}*\n`;
            textList += `No: ${transaction.receiptNumber}\n`;
            textList += `Meja: ${formatReceiptTable(transaction.tableNumber)}\n`;
            textList += `Tanggal: ${format(new Date(transaction.date), 'dd MMM yyyy HH:mm', { locale: id })}\n\n`;
            textList += `*PESANAN:*\n`;
            
            items.forEach(item => {
              textList += `- [${item.quantity}x] ${item.productName}\n`;
              if (item.selectedVariants && item.selectedVariants.length > 0) {
                textList += `  + ${item.selectedVariants.map(v => v.optionName).join(', ')}\n`;
              }
              if (item.notes) textList += `  Catatan: ${item.notes}\n`;
            });

            const text = encodeURIComponent(textList);
            window.open(`https://wa.me/?text=${text}`, '_blank');
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          toast.error('Gagal membagikan struk');
        }
      }
    } finally {
      setSharing(false);
    }
  };

  const handlePrint = async () => {
    // @ts-ignore
    const isNative = window.Capacitor ? window.Capacitor.isNativePlatform() : false;
    
    if (!isNative) {
      handleSystemPrint();
      return;
    }

    let dapurPrinter: any = null;
    try {
      const saved = localStorage.getItem('mesenae_printers');
      if (saved) {
        const printers = JSON.parse(saved);
        dapurPrinter = printers.find((p: any) => p.role === 'Struk Dapur & Varian' || p.role === 'Dapur');
      }
    } catch (e) {
      console.warn('Gagal memuat konfigurasi printer:', e);
    }

    if (!dapurPrinter) {
      toast.info('Printer belum dikonfigurasi. Membuka dialog cetak sistem...');
      handleSystemPrint();
      return;
    }

    setPrinting(true);
    let server: any = null;
    let characteristic: any = null;

    try {
      if (!isNative) {
        toast.info('Mencari printer Bluetooth Web...');
        // @ts-expect-error Web Bluetooth API requires ignoring TS checks here
        const device = await navigator.bluetooth.requestDevice({
          filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
          optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'],
        });

        server = await device.gatt.connect();
        const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
      } else {
        toast.info('Menghubungkan ke Printer Dapur...');
      }

      // Build ESC/POS text untuk Dapur
      const encoder = new TextEncoder();
      const lines: string[] = [];
      
      // Konstanta Command ESC/POS
      const SIZE_LARGE = '\x1D\x21\x11'; // Double Width & Height
      const SIZE_NORMAL = '\x1D\x21\x00'; // Normal Size
      const BOLD_ON = '\x1B\x45\x01';
      const BOLD_OFF = '\x1B\x45\x00';
      
      lines.push('\x1B\x40'); // Inisialisasi printer
      lines.push('\x1B\x61\x01'); // Center align
      
      // Header Toko & Label Dapur
      lines.push(`${BOLD_ON}${storeSettings?.storeName || 'Toko'}\n`);
      lines.push(`*** TIKET DAPUR ***\n${BOLD_OFF}`);
      
      lines.push('--------------------------------\n');
      lines.push(`No: ${transaction.receiptNumber}\n`);
      lines.push(`${format(new Date(transaction.date), 'dd/MM/yyyy HH:mm')}\n`);
      if (transaction.customerName) lines.push(`Pel: ${transaction.customerName}\n`);
      
      // Meja: Dibuat SANGAT BESAR agar terlihat koki
      lines.push(`${SIZE_LARGE}MEJA: ${formatReceiptTable(transaction.tableNumber)}\n${SIZE_NORMAL}`);
      
      lines.push('--------------------------------\n');
      lines.push('\x1B\x61\x00'); // Left align
      
      // Daftar Menu
      for (const item of items) {
        // Kuantitas dan Nama Produk di-Highlight dengan SIZE_LARGE
        lines.push(`${SIZE_LARGE}[${item.quantity}x] ${item.productName}\n${SIZE_NORMAL}`);
        
        if (item.selectedVariants && item.selectedVariants.length > 0) {
          lines.push(`  + ${item.selectedVariants.map(v => v.optionName).join(', ')}\n`);
        }
        if (item.notes) {
          // Catatan dicetak tebal
          lines.push(`${BOLD_ON}  *** CATATAN: ${item.notes} ***\n${BOLD_OFF}`);
        }
        lines.push('\n'); // Spasi ekstra antar pesanan agar mudah dibaca
      }
      
      lines.push('--------------------------------\n');
      lines.push('\x1B\x61\x01'); // Center
      lines.push(`-- SELESAI --\n\n\n`);

      const data = encoder.encode(lines.join(''));
      
      if (isNative) {
        await new Promise<void>((resolve, reject) => {
          // @ts-ignore
          if (!window.bluetoothSerial) {
            reject(new Error('Bluetooth Serial plugin missing'));
            return;
          }
          
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
        toast.success('Struk Dapur berhasil dicetak!');
      } else {
        for (let i = 0; i < data.length; i += 100) {
          const chunk = data.slice(i, i + 100);
          await characteristic.writeValue(chunk);
        }
        toast.success('Struk Dapur berhasil dicetak!');
        await server.disconnect();
      }
    } catch (err: unknown) {
      console.error('Direct print failed, falling back to system:', err);
      toast.warning('Gagal terkoneksi ke printer Bluetooth. Mengalihkan ke cetak sistem...');
      handleSystemPrint();
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl p-6 bg-slate-50 border-none">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-center text-slate-800 flex items-center justify-center gap-2">
            <ChefHat className="text-orange-500 w-6 h-6" />
            Tiket Dapur
          </DialogTitle>
        </DialogHeader>

        {/* Preview Struk HTML */}
        <div 
          ref={receiptRef} 
          className="relative bg-white text-slate-900 p-5 rounded-lg mx-auto shadow-sm border-2 border-slate-200" 
          style={{ width: '300px', fontFamily: "'Courier New', Courier, monospace" }}
        >
          <div className="text-center mb-3">
            <p className="font-bold text-sm tracking-widest uppercase">{storeSettings?.storeName || 'Toko'}</p>
            <div className="mt-1.5 text-xs font-black tracking-widest uppercase border border-slate-400 rounded px-2 py-0.5 inline-block">
              TIKET DAPUR
            </div>
          </div>

          <div className="border-t-2 border-dashed border-slate-300 my-3" />

          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">No. Order</span>
              <span className="font-bold">{transaction.receiptNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Waktu</span>
              <span>{format(new Date(transaction.date), 'dd/MM/yy HH:mm')}</span>
            </div>
            {transaction.customerName && (
              <div className="flex justify-between">
                <span className="text-slate-500">Pemesan</span>
                <span className="font-semibold">{transaction.customerName}</span>
              </div>
            )}
            <div className="flex justify-between items-center border border-slate-300 p-2 rounded-md mt-2">
              <span className="text-slate-600 font-bold text-xs">MEJA</span>
              <span className="font-black text-lg">{formatReceiptTable(transaction.tableNumber)}</span>
            </div>
          </div>

          <div className="border-t-2 border-dashed border-slate-300 my-3" />

          <div className="space-y-4 min-h-[100px]">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2">
                <div className="font-black text-base w-7 shrink-0">
                  {item.quantity}x
                </div>
                <div className="flex-1">
                  <span className="font-bold text-sm uppercase leading-tight block">
                    {item.productName}
                  </span>
                  
                  {item.selectedVariants && item.selectedVariants.length > 0 && (
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                      + {item.selectedVariants.map(v => v.optionName).join(', ')}
                    </div>
                  )}
                  
                  {item.notes && (
                    <div className="text-[11px] italic text-slate-600 mt-0.5 font-semibold">
                      📝 {item.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t-2 border-dashed border-slate-300 mt-4 mb-2" />

          <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            -- SELESAI --
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <Button 
            variant="outline" 
            className="flex flex-col items-center gap-2 h-auto py-3.5 bg-white hover:bg-slate-50 border-slate-200" 
            onClick={handleDownload} 
            disabled={downloading || sharing || printing}
          >
            {downloading ? <Loader2 className="w-5 h-5 animate-spin text-orange-500" /> : <Download className="w-5 h-5 text-slate-600" />}
            <span className="text-[11px] font-medium text-slate-600">Unduh</span>
          </Button>

          <Button 
            variant="outline" 
            className="flex flex-col items-center gap-2 h-auto py-3.5 bg-white hover:bg-slate-50 border-slate-200" 
            onClick={handleShare} 
            disabled={downloading || sharing || printing}
          >
            {sharing ? <Loader2 className="w-5 h-5 animate-spin text-orange-500" /> : <Share2 className="w-5 h-5 text-slate-600" />}
            <span className="text-[11px] font-medium text-slate-600">WA Dapur</span>
          </Button>

          <Button 
            variant="outline" 
            className="flex flex-col items-center gap-2 h-auto py-3.5 bg-white hover:bg-slate-50 border-slate-200" 
            onClick={handlePrint} 
            disabled={downloading || sharing || printing}
          >
            {printing ? <Loader2 className="w-5 h-5 animate-spin text-orange-500" /> : <Printer className="w-5 h-5 text-slate-600" />}
            <span className="text-[11px] font-medium text-slate-600">Cetak</span>
          </Button>
        </div>

        <Button 
          variant="secondary" 
          className="w-full mt-2 rounded-xl py-5 font-bold shadow-sm" 
          onClick={onClose}
        >
          Tutup
        </Button>
      </DialogContent>
    </Dialog>
  );
}
