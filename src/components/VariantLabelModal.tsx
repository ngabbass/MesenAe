import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Download, Printer, Loader2, Tag, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { TransactionItemRecord, Transaction, StoreSettings } from '@/hooks/db-hooks';
import { universalPrint, printHtmlContent } from '@/lib/print-helper';
import { Capacitor } from '@capacitor/core';

interface VariantLabelModalProps {
  open: boolean;
  onClose: () => void;
  items: TransactionItemRecord[];
  transaction: Transaction;
  storeSettings?: StoreSettings;
}

function LabelCard({
  item,
  transaction,
  storeSettings,
  labelRef,
}: {
  item: TransactionItemRecord;
  transaction: Transaction;
  storeSettings?: StoreSettings;
  labelRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div
      ref={labelRef}
      className="bg-white text-black rounded-lg border-2 border-gray-300 mx-auto flex-shrink-0"
      style={{
        width: '240px',
        fontFamily: "'Courier New', Courier, monospace",
        padding: '12px',
      }}
    >
      <div className="text-center border-b border-dashed border-gray-300 pb-2 mb-2">
        <p className="font-black text-[10px] uppercase tracking-widest">{storeSettings?.storeName || 'CAFE'}</p>
      </div>

      <p className="font-black text-sm uppercase leading-tight text-center mb-2">
        {item.productName}
      </p>

      <div className="space-y-1 mb-2">
        {item.selectedVariants?.map((v, idx) => (
          <div key={idx} className="flex items-start gap-1">
            <span className="text-[9px] font-bold text-gray-500 uppercase shrink-0 mt-0.5">{v.groupName}:</span>
            <span className="text-[11px] font-black text-black leading-tight">{v.optionName}</span>
          </div>
        ))}
      </div>

      {item.notes && (
        <div className="bg-gray-100 rounded px-2 py-1 mb-2">
          <p className="text-[10px] font-bold italic text-black">📝 {item.notes}</p>
        </div>
      )}

      <div className="border-t border-dashed border-gray-300 pt-2 flex justify-between items-center">
        <span className="text-[9px] text-gray-500 font-bold">
          {transaction.tableNumber ? `Meja ${transaction.tableNumber}` : 'Bawa Pulang'}
        </span>
        <span className="font-black text-xs bg-black text-white px-2 py-0.5 rounded">
          x{item.quantity}
        </span>
      </div>
    </div>
  );
}

export default function VariantLabelModal({
  open,
  onClose,
  items,
  transaction,
  storeSettings,
}: VariantLabelModalProps) {
  const variantItems = items.filter(
    (it) => it.selectedVariants && it.selectedVariants.length > 0
  );

  const [currentIdx, setCurrentIdx] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const labelRef = useRef<HTMLDivElement>(null);
  const printAllRef = useRef<HTMLDivElement>(null);

  const handleSystemPrint = async () => {
    setPrinting(true);
    try {
      const dataUrl = await captureLabel();
      if (!dataUrl) { setPrinting(false); return; }

      const cordovaPrinted = await printHtmlContent(dataUrl, 'Label Varian');
      if (!cordovaPrinted) await universalPrint(dataUrl, 'Label Varian');
    } catch (err) { toast.error('Gagal cetak label'); } finally { setPrinting(false); }
  };

  const handleSystemPrintAll = async () => {
    setPrinting(true);
    try {
      if (!printAllRef.current) { setPrinting(false); return; }
      
      // Menggunakan pixelRatio konstan agar gambar tetap tajam di semua device
      const dataUrl = await toPng(printAllRef.current, {
        cacheBust: true,
        fontEmbedCSS: '',
        pixelRatio: 4,
        backgroundColor: '#ffffff',
        style: { transform: 'none', animation: 'none', transition: 'none' }
      });
      
      if (!dataUrl) { setPrinting(false); return; }

      const cordovaPrinted = await printHtmlContent(dataUrl, 'Semua Label Varian');
      if (!cordovaPrinted) await universalPrint(dataUrl, 'Semua Label Varian');
    } catch (err) { toast.error('Gagal cetak semua label'); } finally { setPrinting(false); }
  };

  const currentItem = variantItems[currentIdx];
  const total = variantItems.length;

  const captureLabel = async (): Promise<string | null> => {
    if (!labelRef.current) return null;
    try {
      return await toPng(labelRef.current, {
        cacheBust: true,
        fontEmbedCSS: '',
        pixelRatio: 4, // Konsisten tinggi agar saat di-scale tidak blur
        backgroundColor: '#ffffff',
        style: { transform: 'none', animation: 'none', transition: 'none' }
      });
    } catch (err) {
      console.warn('Gagal membuat gambar label via toPng:', err);
      toast.error('Gagal membuat gambar label');
      return null;
    }
  };

  const handleDownloadSingle = async () => {
    setDownloading(true);
    try {
      const dataUrl = await captureLabel();
      if (!dataUrl) return;
      const link = document.createElement('a');
      link.download = `Label-${currentItem.productName.replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Label berhasil diunduh');
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = async () => {
    // @ts-ignore
    const isNative = window.Capacitor ? window.Capacitor.isNativePlatform() : false;
    
    if (!isNative) {
      handleSystemPrint();
      return;
    }

    let labelPrinter: any = null;
    try {
      const saved = localStorage.getItem('mesenae_printers');
      if (saved) {
        const printers = JSON.parse(saved);
        labelPrinter = printers.find((p: any) => p.role === 'Label Harga & Barcode' || p.role === 'Label');
      }
    } catch (e) {
      console.warn('Gagal memuat konfigurasi printer untuk single label:', e);
    }

    if (!labelPrinter) {
      toast.info('Printer label belum dikonfigurasi. Membuka dialog cetak sistem...');
      handleSystemPrint();
      return;
    }

    setPrinting(true);
    let server: any = null;
    let characteristic: any = null;

    try {
      if (!isNative) {
        toast.info('Mencari printer Bluetooth Web...');
        // @ts-expect-error Web Bluetooth API
        const device = await navigator.bluetooth.requestDevice({
          filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
          optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'],
        });
        server = await device.gatt.connect();
        const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
      } else {
        toast.info('Menghubungkan ke Printer Label...');
      }

      const encoder = new TextEncoder();
      const lines: string[] = [];
      
      const SIZE_LARGE = '\x1D\x21\x11';
      const SIZE_NORMAL = '\x1D\x21\x00';
      const BOLD_ON = '\x1B\x45\x01';
      const BOLD_OFF = '\x1B\x45\x00';

      lines.push('\x1B\x40'); // Init
      lines.push('\x1B\x61\x01'); // Center

      lines.push(`${storeSettings?.storeName || 'CAFE'}\n`);
      lines.push('------------------------\n');

      // Nama produk dibuat Double Width & Height agar sangat jelas
      lines.push(`${SIZE_LARGE}${currentItem.productName.toUpperCase()}\n${SIZE_NORMAL}`);

      lines.push('\x1B\x61\x00'); // Left

      if (currentItem.selectedVariants && currentItem.selectedVariants.length > 0) {
        currentItem.selectedVariants.forEach((v) => {
          lines.push(`${v.groupName}: `);
          lines.push(`${BOLD_ON}${v.optionName}\n${BOLD_OFF}`);
        });
      }

      if (currentItem.notes) {
        lines.push(`Ket: ${currentItem.notes}\n`);
      }

      lines.push('------------------------\n');
      lines.push('\x1B\x61\x01'); // Center
      lines.push(`${transaction.tableNumber ? `Meja ${transaction.tableNumber}` : 'Bawa Pulang'}  |  x${currentItem.quantity}\n`);
      lines.push('\n\n\n\n'); // Ekstra feed paper agar aman dipotong

      const data = encoder.encode(lines.join(''));

      if (isNative) {
        await new Promise<void>((resolve, reject) => {
          // @ts-ignore
          if (!window.bluetoothSerial) {
            reject(new Error('Bluetooth Serial plugin missing')); return;
          }
          // @ts-ignore
          window.bluetoothSerial.disconnect(() => {}, () => {});
          
          setTimeout(() => {
            // @ts-ignore
            window.bluetoothSerial.connect(labelPrinter.address, () => {
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
        toast.success(`Label "${currentItem.productName}" berhasil dicetak!`);
      } else {
        for (let i = 0; i < data.length; i += 100) {
          await characteristic.writeValue(data.slice(i, i + 100));
        }
        toast.success(`Label "${currentItem.productName}" berhasil dicetak!`);
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

  const handlePrintAll = async () => {
    // @ts-ignore
    const isNative = window.Capacitor ? window.Capacitor.isNativePlatform() : false;
    
    if (!isNative) {
      handleSystemPrintAll();
      return;
    }

    let labelPrinter: any = null;
    try {
      const saved = localStorage.getItem('mesenae_printers');
      if (saved) {
        const printers = JSON.parse(saved);
        labelPrinter = printers.find((p: any) => p.role === 'Label Harga & Barcode' || p.role === 'Label');
      }
    } catch (e) {
      console.warn('Gagal memuat konfigurasi printer untuk multiple labels:', e);
    }

    if (!labelPrinter) {
      toast.info('Printer label belum dikonfigurasi. Membuka dialog cetak sistem...');
      handleSystemPrintAll();
      return;
    }

    setPrinting(true);
    let server: any = null;
    let characteristic: any = null;

    try {
      if (!isNative) {
        toast.info('Mencari printer Bluetooth...');
        // @ts-expect-error Web Bluetooth API
        const device = await navigator.bluetooth.requestDevice({
          filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
          optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'],
        });
        server = await device.gatt.connect();
        const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
      } else {
        toast.info('Menghubungkan ke Printer Label...');
      }

      const encoder = new TextEncoder();
      const SIZE_LARGE = '\x1D\x21\x11';
      const SIZE_NORMAL = '\x1D\x21\x00';
      const BOLD_ON = '\x1B\x45\x01';
      const BOLD_OFF = '\x1B\x45\x00';

      if (isNative) {
        await new Promise<void>((resolve, reject) => {
          // @ts-ignore
          if (!window.bluetoothSerial) {
            reject(new Error('Bluetooth Serial plugin missing')); return;
          }
          // @ts-ignore
          window.bluetoothSerial.disconnect(() => {}, () => {});
          
          setTimeout(async () => {
            // @ts-ignore
            window.bluetoothSerial.connect(labelPrinter.address, async () => {
              try {
                for (const item of variantItems) {
                  const lines: string[] = [];

                  lines.push('\x1B\x40'); // Init
                  lines.push('\x1B\x61\x01'); // Center
                  lines.push(`${storeSettings?.storeName || 'CAFE'}\n`);
                  lines.push('------------------------\n');
                  
                  // Product Name - Large & Bold
                  lines.push(`${SIZE_LARGE}${item.productName.toUpperCase()}\n${SIZE_NORMAL}`);
                  
                  lines.push('\x1B\x61\x00'); // Left

                  if (item.selectedVariants && item.selectedVariants.length > 0) {
                    item.selectedVariants.forEach((v) => {
                      lines.push(`${v.groupName}: `);
                      lines.push(`${BOLD_ON}${v.optionName}\n${BOLD_OFF}`);
                    });
                  }
                  if (item.notes) {
                    lines.push(`Ket: ${item.notes}\n`);
                  }

                  lines.push('------------------------\n');
                  lines.push('\x1B\x61\x01'); // Center
                  lines.push(`${transaction.tableNumber ? `Meja ${transaction.tableNumber}` : 'Bawa Pulang'}  |  x${item.quantity}\n`);
                  lines.push('\n\n\n\n');

                  const data = encoder.encode(lines.join(''));
                  await new Promise<void>((resWrite, rejWrite) => {
                    // @ts-ignore
                    window.bluetoothSerial.write(data.buffer, () => resWrite(), (e) => rejWrite(e));
                  });
                  await new Promise((r) => setTimeout(r, 200));
                }
                
                // @ts-ignore
                window.bluetoothSerial.disconnect();
                resolve();
              } catch (errWrite) {
                // @ts-ignore
                window.bluetoothSerial.disconnect();
                reject(errWrite);
              }
            }, (connErr: any) => {
              // @ts-ignore
              window.bluetoothSerial.disconnect();
              reject(connErr);
            });
          }, 150);
        });
        toast.success(`Semua ${variantItems.length} label berhasil dicetak!`);
      } else {
        for (const item of variantItems) {
          const lines: string[] = [];

          lines.push('\x1B\x40'); // Init
          lines.push('\x1B\x61\x01'); // Center
          lines.push(`${storeSettings?.storeName || 'CAFE'}\n`);
          lines.push('------------------------\n');
          
          lines.push(`${SIZE_LARGE}${item.productName.toUpperCase()}\n${SIZE_NORMAL}`);
          
          lines.push('\x1B\x61\x00'); // Left

          if (item.selectedVariants && item.selectedVariants.length > 0) {
            item.selectedVariants.forEach((v) => {
              lines.push(`${v.groupName}: `);
              lines.push(`${BOLD_ON}${v.optionName}\n${BOLD_OFF}`);
            });
          }
          if (item.notes) {
            lines.push(`Ket: ${item.notes}\n`);
          }

          lines.push('------------------------\n');
          lines.push('\x1B\x61\x01'); // Center
          lines.push(`${transaction.tableNumber ? `Meja ${transaction.tableNumber}` : 'Bawa Pulang'}  |  x${item.quantity}\n`);
          lines.push('\n\n\n\n');

          const data = encoder.encode(lines.join(''));
          for (let i = 0; i < data.length; i += 100) {
            await characteristic.writeValue(data.slice(i, i + 100));
            await new Promise((r) => setTimeout(r, 20)); 
          }
          await new Promise((r) => setTimeout(r, 200));
        }

        toast.success(`Semua ${variantItems.length} label berhasil dicetak!`);
        await server.disconnect();
      }
    } catch (err: unknown) {
      console.error('Direct print failed, falling back to system:', err);
      toast.warning('Gagal terkoneksi ke printer Bluetooth. Mengalihkan ke cetak sistem...');
      handleSystemPrintAll();
    } finally {
      setPrinting(false);
    }
  };

  if (variantItems.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm md:max-w-xl w-[95vw] max-h-[90vh] overflow-y-auto rounded-3xl p-6 bg-background border border-primary/20 shadow-2xl flex flex-col">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-center text-foreground flex items-center justify-center gap-2 text-lg font-black tracking-tight">
            <Tag className="text-primary w-5 h-5" />
            Label Varian
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between mb-4">
          <Badge className="bg-primary/10 text-primary border border-primary/20 font-bold text-xs px-3">
            {currentIdx + 1} / {total} Item
          </Badge>
          <span className="text-xs text-muted-foreground font-medium">
            {transaction.tableNumber ? `Meja ${transaction.tableNumber}` : 'Bawa Pulang'}
          </span>
        </div>

        <div className="flex items-center gap-2 mb-5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl disabled:opacity-30"
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx((i) => i - 1)}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          <div className="flex-1 overflow-hidden">
            <LabelCard
              item={currentItem}
              transaction={transaction}
              storeSettings={storeSettings}
              labelRef={labelRef as React.RefObject<HTMLDivElement>}
            />
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl disabled:opacity-30"
            disabled={currentIdx === total - 1}
            onClick={() => setCurrentIdx((i) => i + 1)}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {total > 1 && (
          <div className="flex justify-center gap-1.5 mb-5">
            {variantItems.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIdx(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentIdx
                    ? 'bg-primary w-4'
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/60'
                }`}
              />
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-3">
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-16 bg-card border border-border hover:bg-muted hover:border-primary/50 text-muted-foreground hover:text-primary rounded-2xl transition-all shadow-sm"
            onClick={handleDownloadSingle}
            disabled={downloading || printing}
          >
            {downloading ? (
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            ) : (
              <Download className="w-5 h-5 text-muted-foreground" />
            )}
            <span className="text-[10px] font-bold uppercase tracking-wider">Unduh Label</span>
          </Button>

          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-16 bg-primary border border-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30 rounded-2xl transition-all"
            onClick={handlePrint}
            disabled={downloading || printing}
          >
            {printing ? (
              <Loader2 className="w-5 h-5 animate-spin text-primary-foreground" />
            ) : (
              <Printer className="w-5 h-5 text-primary-foreground" />
            )}
            <span className="text-[10px] font-bold uppercase tracking-wider">Cetak Label</span>
          </Button>
        </div>

        {total > 1 && (
          <Button
            className="w-full bg-card hover:bg-muted text-foreground border border-border hover:border-primary/50 rounded-2xl py-5 font-bold transition-all shadow-sm group"
            onClick={handlePrintAll}
            disabled={downloading || printing}
          >
            {printing ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2 text-primary" />
            ) : (
              <Printer className="w-4 h-4 mr-2 text-primary group-hover:scale-110 transition-transform" />
            )}
            Cetak Semua {total} Label Sekaligus
          </Button>
        )}

        <Button
          variant="ghost"
          className="w-full mt-2 rounded-xl py-5 font-bold text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-2 transition-all"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
          Tutup
        </Button>

        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', display: 'block', background: 'white' }}>
          <div ref={printAllRef} className="flex flex-col gap-4 items-center bg-white text-black p-4">
            {variantItems.map((item, idx) => (
              <div key={idx} className="print-label-page mb-6 border-b pb-4 last:border-0 last:pb-0" style={{ width: '240px', fontFamily: "'Courier New', Courier, monospace", pageBreakAfter: 'always', breakAfter: 'page' }}>
                <div className="text-center border-b border-dashed border-gray-300 pb-2 mb-2">
                  <p className="font-black text-[10px] uppercase tracking-widest">{storeSettings?.storeName || 'CAFE'}</p>
                </div>
                <p className="font-black text-sm uppercase leading-tight text-center mb-2">{item.productName}</p>
                <div className="space-y-1 mb-2">
                  {item.selectedVariants?.map((v, vIdx) => (
                    <div key={vIdx} className="flex items-start gap-1">
                      <span className="text-[9px] font-bold text-gray-500 uppercase shrink-0 mt-0.5">{v.groupName}:</span>
                      <span className="text-[11px] font-black text-black leading-tight">{v.optionName}</span>
                    </div>
                  ))}
                </div>
                {item.notes && (
                  <div className="bg-gray-100 rounded px-2 py-1 mb-2">
                    <p className="text-[10px] font-bold italic text-black">📝 {item.notes}</p>
                  </div>
                )}
                <div className="border-t border-dashed border-gray-300 pt-2 flex justify-between items-center">
                  <span className="text-[9px] text-gray-500 font-bold">
                    {transaction.tableNumber ? `Meja ${transaction.tableNumber}` : 'Bawa Pulang'}
                  </span>
                  <span className="font-black text-xs bg-black text-white px-2 py-0.5 rounded">x{item.quantity}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
