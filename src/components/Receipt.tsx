import { useRef, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { toPng } from 'html-to-image';
import { Download, Share2, Printer, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Transaction, StoreSettings, TransactionItemRecord } from '@/hooks/db-hooks';
import { cn, formatReceiptTable } from '@/lib/utils';
import { QRCodeCanvas } from 'qrcode.react';
import QRCode from 'qrcode';
import { useReactToPrint } from 'react-to-print';
import { printHtmlContent, universalPrint } from '@/lib/print-helper';
import { Capacitor } from '@capacitor/core';

// Helper to convert image URL to ESC/POS raster bit image (binarized 1-bit GS v 0 format)
async function convertImageUrlToEscPosRaster(url: string): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let canvas: HTMLCanvasElement | null = document.createElement('canvas');
      try {
        const printWidth = 384; // Standard width for 58mm printer
        const printHeight = Math.round((img.height / img.width) * printWidth);
        
        canvas.width = printWidth;
        canvas.height = printHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          canvas.width = 0;
          canvas.height = 0;
          canvas = null;
          resolve(null);
          return;
        }
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, printWidth, printHeight);
        ctx.drawImage(img, 0, 0, printWidth, printHeight);
        
        const imgData = ctx.getImageData(0, 0, printWidth, printHeight);
        const pixels = imgData.data;
        
        const xBytes = printWidth / 8; // 48 bytes
        const yLines = printHeight;
        
        const header = new Uint8Array([
          0x1D, 0x76, 0x30, 0x00, 
          xBytes & 0xFF, (xBytes >> 8) & 0xFF,
          yLines & 0xFF, (yLines >> 8) & 0xFF
        ]);
        
        const body = new Uint8Array(xBytes * yLines);
        
        for (let y = 0; y < yLines; y++) {
          for (let x = 0; x < xBytes; x++) {
            let byteVal = 0;
            for (let bit = 0; bit < 8; bit++) {
              const pixelX = x * 8 + bit;
              const idx = (y * printWidth + pixelX) * 4;
              const r = pixels[idx];
              const g = pixels[idx + 1];
              const b = pixels[idx + 2];
              const a = pixels[idx + 3];
              
              let isBlack = false;
              if (a > 30) {
                const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                isBlack = luminance < 128;
              }
              
              if (isBlack) {
                byteVal |= (1 << (7 - bit));
              }
            }
            body[y * xBytes + x] = byteVal;
          }
        }
        
        const combined = new Uint8Array(header.length + body.length);
        combined.set(header, 0);
        combined.set(body, header.length);
        
        canvas.width = 0;
        canvas.height = 0;
        canvas = null;
        
        resolve(combined);
      } catch (err) {
        console.error('Error generating raster bytes:', err);
        if (canvas) {
          canvas.width = 0;
          canvas.height = 0;
          canvas = null;
        }
        resolve(null);
      }
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = url;
  });
}

function resolveFontSize(val: any): string {
  if (typeof val === 'number') return `${val}px`;
  const map: Record<string, string> = { xs: '9px', sm: '11px', md: '13px', lg: '15px', xl: '17px' };
  return map[val] || '11px';
}

async function removeWhiteBackground(imageUrl: string): Promise<string> {
  if (!imageUrl) return '';
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let canvas: HTMLCanvasElement | null = document.createElement('canvas');
      try {
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          canvas.width = 0;
          canvas.height = 0;
          canvas = null;
          resolve(imageUrl);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const avg = (r + g + b) / 3;
          
          data[i] = avg;
          data[i + 1] = avg;
          data[i + 2] = avg;
          
          if (avg > 210) {
            const alpha = Math.max(0, 255 - (avg - 210) * (255 / 45));
            data[i + 3] = Math.min(data[i + 3], alpha);
          }
        }
        ctx.putImageData(imgData, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        
        canvas.width = 0;
        canvas.height = 0;
        canvas = null;
        
        resolve(dataUrl);
      } catch (err) {
        console.error('Error removing white background:', err);
        if (canvas) {
          canvas.width = 0;
          canvas.height = 0;
          canvas = null;
        }
        resolve(imageUrl);
      }
    };
    img.onerror = () => {
      resolve(imageUrl);
    };
    img.src = imageUrl;
  });
}

interface ReceiptProps {
  open: boolean;
  onClose: () => void;
  transaction: Transaction;
  items: TransactionItemRecord[];
  storeSettings: StoreSettings | undefined;
  paymentMethodName: string;
}

export default function Receipt({ open, onClose, transaction, items, storeSettings, paymentMethodName }: ReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const printWrapperRef = useRef<HTMLDivElement>(null);

  const [downloading, setDownloading] = useState<boolean>(false);
  const [sharing, setSharing] = useState<boolean>(false);
  const [printing, setPrinting] = useState<boolean>(false);
  const [processedLogo, setProcessedLogo] = useState<string | undefined>();
  const [processedFooterImg, setProcessedFooterImg] = useState<string | undefined>();

  const typo = (storeSettings as any)?.receiptTypography || {};
  const paperWidthVal = typo.paperWidth || '58mm';

  // Implementasi react-to-print diletakkan di atas (Aman dari pelanggaran aturan hooks)
  const handleReactPrint = useReactToPrint({
    contentRef: printWrapperRef,
    documentTitle: `Struk_${transaction?.receiptNumber || 'Pembayaran'}`,
    onBeforePrint: () => {
      return new Promise<void>((resolve) => {
        setPrinting(true);
        setTimeout(resolve, 250); // Delay aman memberi waktu browser menyiapkan dokumen
      });
    },
    onAfterPrint: () => setPrinting(false),
    onPrintError: (err) => {
      console.error('ReactToPrint Error:', err);
      setPrinting(false);
      toast.error('Gagal memproses cetak sistem Windows');
    },
    pageStyle: `
      @page {
        size: auto;
        margin: 0;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          background-color: white !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        /* Menghilangkan efek dekoratif potongan struk dan memaksa rata tengah di kertas thermal/A4 */
        #print-wrapper-id {
          margin: 0 auto !important;
          padding: 4mm 2mm !important;
          width: ${paperWidthVal} !important;
          max-width: ${paperWidthVal} !important;
          box-shadow: none !important;
          clip-path: none !important;
          -webkit-clip-path: none !important;
          border: none !important;
          page-break-after: auto;
        }
      }
    `,
  });

  const footerImgUrl = (storeSettings as any)?.receiptFooterImg || (storeSettings as any)?.receiptFooterImage;
  const fontFamilyVal = typo.fontFamily || 'courier';
  const fontSizeVal = typo.fontSize ?? 'sm';
  const lineHeightVal = typo.lineHeight || 'normal';
  const rawTemplate = (storeSettings as any)?.receiptTemplate ?? 'fnb';
  const template = rawTemplate === 'finedining' ? 'classic' : rawTemplate;
  const showLogo = (storeSettings as any)?.receiptShowLogo ?? true;
  const showFooterImg = (storeSettings as any)?.receiptShowFooterImg ?? true;
  const footerType = (storeSettings as any)?.receiptFooterType || 'image';
  const footerQrUrl = (storeSettings as any)?.receiptFooterQrUrl || '';

  useEffect(() => {
    let isMounted = true;
    if (open && storeSettings?.logo) {
      removeWhiteBackground(storeSettings.logo).then(res => {
        if (isMounted) setProcessedLogo(res);
      });
    } else {
      setProcessedLogo(undefined);
    }
    return () => { isMounted = false; };
  }, [open, storeSettings?.logo]);

  useEffect(() => {
    let isMounted = true;
    if (open && footerImgUrl) {
      removeWhiteBackground(footerImgUrl).then(res => {
        if (isMounted) setProcessedFooterImg(res);
      });
    } else {
      setProcessedFooterImg(undefined);
    }
    return () => { isMounted = false; };
  }, [open, footerImgUrl]);

  // JIKA DATA TRANSAKSI BELUM ADA, RETURN DI SINI (SETELAH SEMUA HOOK REGISTERED)
  if (!transaction) return null;

  const footerStyles = (storeSettings as any)?.receiptFooterStyles || {};
  const line1Bold = footerStyles.line1?.bold ?? false;
  const line1Italic = footerStyles.line1?.italic ?? false;
  const line1Underline = footerStyles.line1?.underline ?? false;
  const line2Bold = footerStyles.line2?.bold ?? false;
  const line2Italic = footerStyles.line2?.italic ?? false;
  const line2Underline = footerStyles.line2?.underline ?? false;

  const getFooterStyle = (block: string) => {
    const isLine1 = block === 'line1';
    const bold = isLine1 ? line1Bold : line2Bold;
    const italic = isLine1 ? line1Italic : line2Italic;
    const underline = isLine1 ? line1Underline : line2Underline;
    return {
      fontWeight: bold ? 'bold' : 'normal',
      fontStyle: italic ? 'italic' : 'normal',
      textDecoration: underline ? 'underline' : 'none'
    };
  };

  const safeItems = Array.isArray(items) ? items : [];
  const tableVal = transaction.tableNumber || (transaction as any).table_number;
  const isPaidTx = transaction.status === 'lunas' || transaction.status === 'completed';

  const txDiscountAmount = transaction.discountAmount ?? (transaction as any).discount_amount ?? 0;
  const txPaymentAmount = transaction.paymentAmount ?? (transaction as any).payment_amount ?? 0;
  const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    const res = await fetch(dataUrl);
    return await res.blob();
  };

  const captureReceipt = async (): Promise<string | null> => {
    const targetEl = printWrapperRef.current || receiptRef.current;
    if (!targetEl) return null;
    try {
      const isNative = Capacitor.isNativePlatform();
      return await toPng(targetEl, {
        cacheBust: true,
        fontEmbedCSS: '',
        pixelRatio: isNative ? 3 : 4, // Gambar ekstra tajam untuk download/share/native print
        backgroundColor: '#ffffff',
        style: {
          clipPath: 'none',
          borderRadius: '0',
          margin: '0' 
        }
      });
    } catch (err) {
      console.warn('Gagal membuat gambar struk via toPng:', err);
      toast.error('Gagal membuat gambar struk');
      return null;
    }
  };

  const handleSystemPrint = async () => {
    const isNative = Capacitor.isNativePlatform();
    
    // Web Desktop/Windows Print: Panggil antarmuka react-to-print (Bentuk Vektor HTML)
    if (!isNative) {
      if (handleReactPrint) {
        handleReactPrint();
      } else {
        toast.error('Fungsi cetak tidak siap.');
      }
      return;
    }

    // Mobile / Native Capacitor Print (Menggunakan HTML Image Fallback)
    setPrinting(true);
    try {
      const dataUrl = await captureReceipt();
      if (!dataUrl) { setPrinting(false); return; }
      
      const printWidth = paperWidthVal === '58mm' ? '58mm' : '80mm';
      const htmlContent = `
        <html>
          <head>
            <title>Cetak Struk</title>
            <style>
              @page { margin: 10mm auto; size: auto; }
              body { margin: 0; padding: 0; background: #fff; display: flex; justify-content: center; text-align: center; }
              .receipt-img-wrap { width: 100%; text-align: center; }
              img { 
                width: 100%; max-width: ${printWidth}; height: auto; 
                image-rendering: -webkit-optimize-contrast; 
                image-rendering: crisp-edges;
              }
            </style>
          </head>
          <body>
            <div class="receipt-img-wrap"><img src="${dataUrl}" /></div>
          </body>
        </html>
      `;

      const cordovaPrinted = await printHtmlContent(htmlContent, 'Cetak Struk');
      if (!cordovaPrinted) {
        await universalPrint(htmlContent, 'Cetak Struk');
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
      
      const isNative = Capacitor.isNativePlatform();
      if (isNative) {
        try {
          const base64Data = dataUrl.split(',')[1];
          const fileName = `Struk_${transaction.receiptNumber}_${Date.now()}.png`;
          
          const { Filesystem, Directory } = await import('@capacitor/filesystem');
          await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Documents
          });
          toast.success(`Struk disimpan di folder Documents (${fileName})`);
        } catch (e) {
          console.error('Error saving file:', e);
          toast.error('Gagal menyimpan struk ke penyimpanan lokal');
        }
      } else {
        const link = document.createElement('a');
        link.download = `Struk_${transaction.receiptNumber}.png`;
        link.href = dataUrl;
        link.click();
        toast.success('Struk berhasil diunduh');
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
        const isNative = Capacitor.isNativePlatform();
        if (isNative) {
          const { Filesystem, Directory } = await import('@capacitor/filesystem');
          const { Share } = await import('@capacitor/share');
          
          const fileName = `Struk_${transaction.receiptNumber}.png`;
          const base64Data = dataUrl.split(',')[1];
          const result = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache
          });
          
          await Share.share({
            title: `Struk Pembayaran - ${transaction.receiptNumber}`,
            text: `Terima kasih! Berikut adalah struk pembayaran Anda dari ${storeSettings?.storeName || 'Toko'}.`,
            url: result.uri,
            dialogTitle: 'Bagikan Struk'
          });
        } else {
          const blob = await dataUrlToBlob(dataUrl);
          if (!blob) return;

          if (navigator.share) {
            const file = new File([blob], `Struk_${transaction.receiptNumber}.png`, { type: 'image/png' });
            await navigator.share({
              title: `Struk Pembayaran - ${transaction.receiptNumber}`,
              text: `Terima kasih! Berikut adalah struk pembayaran Anda dari ${storeSettings?.storeName || 'Toko'}.`,
              files: [file],
            });
          } else {
            const text = encodeURIComponent(
              `*${storeSettings?.storeName || 'Toko'}*\n` +
              `No. Struk: ${transaction.receiptNumber}\n` +
              `Total: ${rp(transaction.total)}\n` +
              `Tanggal: ${format(new Date(transaction.date), 'dd MMM yyyy HH:mm', { locale: id })}`
            );
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
    const isNative = Capacitor.isNativePlatform();
    
    // Jika di lingkungan Web Desktop, langsung alihkan ke Windows Print (A4)
    if (!isNative) {
      handleSystemPrint();
      return;
    }

    let kasirPrinter: any = null;
    try {
      const saved = localStorage.getItem('mesenae_printers');
      if (saved) {
        const printers = JSON.parse(saved);
        kasirPrinter = printers.find((p: any) => p.role === 'Struk Pembelian' || p.role === 'Kasir');
      }
    } catch (e) {
      console.warn('Gagal memuat konfigurasi printer:', e);
    }

    if (!kasirPrinter) {
      toast.info('Printer Bluetooth belum dikonfigurasi. Membuka sistem cetak OS...');
      handleSystemPrint();
      return;
    }

    setPrinting(true);
    try {
      toast.info('Menghubungkan ke Printer Kasir...');

      const lines: (string | Uint8Array)[] = [];
      lines.push('\x1B\x40'); // Initialize printer
      lines.push('\x1B\x61\x01'); // Center align
      
      if (storeSettings?.logo) {
        try {
          const logoRaster = await convertImageUrlToEscPosRaster(storeSettings.logo);
          if (logoRaster) {
            lines.push(logoRaster);
            lines.push('\n');
          }
        } catch (e) {
          console.warn('Gagal memformat logo toko ke printer:', e);
        }
      }

      lines.push('\x1B\x61\x01'); 
      lines.push('\x1B\x45\x01'); 
      lines.push(`${storeSettings?.storeName || 'Toko'}\n`);
      lines.push('\x1B\x45\x00'); 
      
      if (storeSettings?.address) lines.push(`${storeSettings.address}\n`);
      if (storeSettings?.phone) lines.push(`${storeSettings.phone}\n`);
      
      lines.push('--------------------------------\n');
      lines.push('\x1B\x61\x00'); 
      lines.push(`No: ${transaction.receiptNumber}\n`);
      lines.push(`${format(new Date(transaction.date), 'dd/MM/yyyy HH:mm')}\n`);
      
      const cashierNameVal = transaction.cashierName || (transaction as any).cashier_name;
      if (cashierNameVal) lines.push(`Kasir: ${cashierNameVal}\n`);
      
      const buyerNameVal = transaction.customerName || (transaction as any).customer_name;
      if (buyerNameVal) lines.push(`Pelanggan: ${buyerNameVal}\n`);
      
      const tableVal = transaction.tableNumber || (transaction as any).table_number;
      if (tableVal) lines.push(`Meja/Tipe: ${formatReceiptTable(tableVal)}\n`);
      
      lines.push('--------------------------------\n');
      lines.push('\x1B\x61\x00'); 
      
      for (const item of safeItems) {
        lines.push(`${item.productName}\n`);
        let safeVariants = item.selectedVariants || item.selected_variants || [];
        if (typeof safeVariants === 'string') {
          try { safeVariants = JSON.parse(safeVariants); } catch (parseErr) { safeVariants = []; }
        }
        if (!Array.isArray(safeVariants)) safeVariants = [];

        if (safeVariants.length > 0) {
          lines.push(`  + ${safeVariants.map((v: any) => v.optionName || v.option_name).join(', ')}\n`);
        }
        if (item.notes) lines.push(`  Catatan: ${item.notes}\n`);
        lines.push(`  ${item.quantity} x ${rp(item.price)}  ${rp(item.subtotal)}\n`);
      }

      lines.push('--------------------------------\n');
      lines.push(`Subtotal:  ${rp(transaction.subtotal)}\n`);
      const txTaxAmount = transaction.tax_and_service || transaction.taxAndService || 0;
      if (txTaxAmount > 0) lines.push(`Biaya Admin: ${rp(txTaxAmount)}\n`);
      if (txDiscountAmount > 0) lines.push(`Diskon:   -${rp(txDiscountAmount)}\n`);
      
      lines.push('\x1B\x45\x01'); 
      lines.push(`TOTAL:     ${rp(transaction.total)}\n`);
      lines.push('\x1B\x45\x00'); 
      
      let paymentsList = transaction.payments || [];
      if (typeof paymentsList === 'string') {
        try { paymentsList = JSON.parse(paymentsList); } catch (parseErr) { paymentsList = []; }
      }
      if (!Array.isArray(paymentsList)) paymentsList = [];

      if (paymentsList.length > 0) {
        lines.push('--------------------------------\n');
        lines.push('Rincian Pembayaran:\n');
        paymentsList.forEach(p => {
          const methodName = p.method_name || p.methodName || 'Pembayaran';
          lines.push(`${methodName}: ${rp(p.amount)}\n`);
        });
      } else {
        lines.push(`Bayar:     ${rp(txPaymentAmount)}\n`);
      }
      lines.push(`Kembali:   ${rp(transaction.change)}\n`);
      lines.push('--------------------------------\n');
      
      lines.push('\x1B\x61\x01'); 
      const footerOrder: string[] = (storeSettings as any)?.receiptFooterOrder || ['line1', 'line2', 'image'];
      const footerLines: string[] = (storeSettings as any)?.receiptFooterLines || [];
      const footerImgUrl = (storeSettings as any)?.receiptFooterImg;

      for (const block of footerOrder) {
        if (block === 'line1' && footerLines[0]?.trim()) {
          footerLines[0].split('\n').forEach(sub => { if (sub.trim()) lines.push(`${sub}\n`); });
        }
        if (block === 'line2' && footerLines[1]?.trim()) {
          footerLines[1].split('\n').forEach(sub => { if (sub.trim()) lines.push(`${sub}\n`); });
        }
        if (block === 'image' && showFooterImg) {
          if (footerType === 'qrcode' && footerQrUrl) {
            try {
              const qrDataUrl = await QRCode.toDataURL(footerQrUrl, { width: 180, margin: 1 });
              const rasterData = await convertImageUrlToEscPosRaster(qrDataUrl);
              if (rasterData) {
                lines.push('\x1B\x61\x01');
                lines.push(rasterData);
                lines.push('\n');
              }
            } catch (e) {}
          } else if (footerType === 'image' && footerImgUrl) {
            try {
              const rasterData = await convertImageUrlToEscPosRaster(footerImgUrl);
              if (rasterData) {
                lines.push('\x1B\x61\x01');
                lines.push(rasterData);
                lines.push('\n');
              }
            } catch (e) {}
          }
        }
      }

      lines.push('\n\n\n');

      const chunkList: Uint8Array[] = [];
      const textEncoder = new TextEncoder();
      
      for (const item of lines) {
        if (typeof item === 'string') {
          chunkList.push(textEncoder.encode(item));
        } else if (item instanceof Uint8Array) {
          chunkList.push(item);
        }
      }
      
      let totalLength = 0;
      chunkList.forEach(c => totalLength += c.length);
      const data = new Uint8Array(totalLength);
      let offset = 0;
      chunkList.forEach(c => {
        data.set(c, offset);
        offset += c.length;
      });

      await new Promise<void>((resolve, reject) => {
        if (!window.bluetoothSerial) {
          reject(new Error('Bluetooth Serial plugin missing'));
          return;
        }
        
        window.bluetoothSerial.disconnect(
          () => console.log('Cleaned up previous BT connections'),
          () => {}
        );
        
        setTimeout(() => {
          window.bluetoothSerial!.connect(kasirPrinter.address, async () => {
            try {
              const chunkSize = 128;
              for (let i = 0; i < data.length; i += chunkSize) {
                const chunk = data.slice(i, i + chunkSize);
                await new Promise<void>((resWrite, rejWrite) => {
                  window.bluetoothSerial!.write(
                    chunk.buffer,
                    () => setTimeout(resWrite, 15),
                    (err: any) => rejWrite(err)
                  );
                });
              }
              window.bluetoothSerial!.disconnect(() => {}, () => {});
              resolve();
            } catch (writeErr: any) {
              window.bluetoothSerial!.disconnect(() => {}, () => {});
              reject(writeErr);
            }
          }, (connErr: any) => {
            window.bluetoothSerial!.disconnect(() => {}, () => {});
            reject(connErr);
          });
        }, 150);
      });
      toast.success('Struk berhasil dicetak!');
    } catch (err: unknown) {
      console.error('Direct print failed, falling back to system:', err);
      toast.warning('Gagal printer Bluetooth. Mengalihkan ke cetak sistem...');
      handleSystemPrint();
    } finally {
      setPrinting(false);
    }
  };

  const footerOrder: string[] = (storeSettings as any)?.receiptFooterOrder || ['line1', 'line2', 'image'];
  const footerLinesData: string[] = (storeSettings as any)?.receiptFooterLines || [];
  const footerImgData = (storeSettings as any)?.receiptFooterImg || (storeSettings as any)?.receiptFooterImage;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md md:max-w-xl w-[95vw] max-h-[90vh] overflow-y-auto rounded-3xl p-6 bg-background border border-border shadow-2xl flex flex-col">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-center text-foreground flex items-center justify-center gap-2">
            {isPaidTx ? (
              <>
                <CheckCircle2 className="text-emerald-500 w-6 h-6" />
                Pembayaran Berhasil
              </>
            ) : (
              <>
                <Clock className="text-amber-500 w-6 h-6 animate-pulse" />
                Detail Tagihan
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* printWrapperRef dengan ID penanda cetak sistem Windows */}
        <div 
          ref={printWrapperRef}
          id="print-wrapper-id"
          className={cn(
            "relative mx-auto bg-white text-black p-6 shadow-lg mb-6 overflow-hidden flex-shrink-0 transition-all duration-300",
            paperWidthVal === '58mm' ? "w-full max-w-[280px]" : "w-full max-w-[360px]"
          )}
          style={{ 
            fontFamily: fontFamilyVal === 'monospace' ? 'monospace' : fontFamilyVal === 'sans-serif' ? 'sans-serif' : fontFamilyVal === 'receipt-font' ? 'monospace' : "'Courier New', Courier, monospace",
            fontSize: resolveFontSize(fontSizeVal),
            lineHeight: lineHeightVal === 'tight' ? '1.15' : lineHeightVal === 'relaxed' ? '1.5' : '1.3',
            letterSpacing: fontFamilyVal === 'receipt-font' ? '-0.05em' : 'normal',
            clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 6px), 98% 100%, 96% calc(100% - 6px), 94% 100%, 92% calc(100% - 6px), 90% 100%, 88% calc(100% - 6px), 86% 100%, 84% calc(100% - 6px), 82% 100%, 80% calc(100% - 6px), 78% 100%, 76% calc(100% - 6px), 74% 100%, 72% calc(100% - 6px), 70% 100%, 68% calc(100% - 6px), 66% 100%, 64% calc(100% - 6px), 62% 100%, 60% calc(100% - 6px), 58% 100%, 56% calc(100% - 6px), 54% 100%, 52% calc(100% - 6px), 50% 100%, 48% calc(100% - 6px), 46% 100%, 44% calc(100% - 6px), 42% 100%, 40% calc(100% - 6px), 38% 100%, 36% calc(100% - 6px), 34% 100%, 32% calc(100% - 6px), 30% 100%, 28% calc(100% - 6px), 26% 100%, 24% calc(100% - 6px), 22% 100%, 20% calc(100% - 6px), 18% 100%, 16% calc(100% - 6px), 14% 100%, 12% calc(100% - 6px), 10% 100%, 8% calc(100% - 6px), 6% 100%, 4% calc(100% - 6px), 2% 100%, 0 calc(100% - 6px))'
          }}
        >
          <div ref={receiptRef} className="relative z-10 bg-white text-black">

            {/* ── MINIMARKET TEMPLATE ── */}
            {template === 'minimarket' && (
              <div className="w-full text-left uppercase text-[0.85em] relative z-10">
                {showLogo && storeSettings?.logo && (
                  <div className="mb-3 text-center">
                    <img crossOrigin="anonymous" src={processedLogo || storeSettings.logo} alt="Logo" className="w-28 h-8 object-contain mx-auto mb-2 grayscale" style={{ filter: 'grayscale(1) contrast(1.2) brightness(1.1)' }} />
                  </div>
                )}
                <div className="mb-2">
                  <h2 className="font-extrabold text-[1.1em]">{storeSettings?.storeName?.toUpperCase() || 'TOKO'}</h2>
                  {storeSettings?.address && <p className="text-[0.9em] leading-tight">{storeSettings.address.toUpperCase()}</p>}
                  {storeSettings?.phone && <p className="text-[0.9em] leading-tight">{storeSettings.phone}</p>}
                </div>
                <div className="mb-2 text-[0.95em] uppercase font-medium space-y-0.5">
                  <div>No. Struk: {transaction.receiptNumber}</div>
                  <div className="flex justify-between w-full">
                    <span>TGL: {format(new Date(transaction.date), 'dd.MM.yy-HH:mm')}</span>
                    <span>KASIR: {String(transaction.cashierName || (transaction as any).cashier_name || 'Staff').toUpperCase()}</span>
                  </div>
                  {(transaction.customerName || tableVal) && (
                    <div className="flex justify-between w-full gap-2 items-start">
                      <span className="flex-1 text-left min-w-0 break-words">PELANGGAN: {transaction.customerName ? String(transaction.customerName).toUpperCase() : '-'}</span>
                      <span className="shrink-0 text-right max-w-[60%] break-words">MEJA/TIPE: {tableVal ? formatReceiptTable(tableVal).toUpperCase() : '-'}</span>
                    </div>
                  )}
                </div>
                <div className="border-t border-dashed border-black my-2" />
                
                <div className="space-y-2">
                  {safeItems.map((item: any, i: number) => {
                    const pName = item.productName || item.product_name || 'Produk';
                    return (
                      <div key={i} className="leading-tight font-medium py-0.5">
                        <div className="break-words whitespace-normal text-left">{pName.toUpperCase()}</div>
                        <div className="flex justify-between w-full mt-0.5">
                          <span>{item.quantity} x {rp(item.price)}</span>
                          <span>{rp(item.subtotal)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="border-t border-dashed border-black my-2" />
                <div className="space-y-0.5 text-[0.95em] font-medium ml-auto max-w-[240px] w-full">
                  <div className="flex justify-between w-full">
                    <span>HARGA JUAL :</span><span>{rp(transaction.subtotal)}</span>
                  </div>
                  {txDiscountAmount > 0 && (
                    <div className="flex justify-between w-full">
                      <span>DISKON :</span><span>-{rp(txDiscountAmount)}</span>
                    </div>
                  )}
                  {((transaction.tax_and_service || transaction.taxAndService) > 0) && (
                    <div className="flex justify-between w-full">
                      <span>BIAYA ADMIN :</span><span>{rp(transaction.tax_and_service || transaction.taxAndService)}</span>
                    </div>
                  )}
                  <div className="border-t border-dashed border-black my-1" />
                  <div className="flex justify-between w-full font-extrabold text-[1.05em]">
                    <span>TOTAL :</span><span>{rp(transaction.total)}</span>
                  </div>
                  <div className="flex justify-between w-full">
                    <span>TUNAI/QRIS :</span><span>{rp(txPaymentAmount || transaction.total)}</span>
                  </div>
                  <div className="flex justify-between w-full">
                    <span>KEMBALI :</span><span>{rp(transaction.change)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── FNB (Kafe/Resto) TEMPLATE ── */}
            {template === 'fnb' && (
              <div className="w-full text-left text-[0.85em] relative z-10">
                <div className="text-center mb-4">
                  {showLogo && storeSettings?.logo && (
                    <div className="w-14 h-14 mx-auto mb-2 overflow-hidden bg-transparent">
                      <img crossOrigin="anonymous" src={processedLogo || storeSettings.logo} alt="Logo" className="w-full h-full object-contain mx-auto grayscale" />
                    </div>
                  )}
                  <h2 className="font-bold text-[1.25em]">{storeSettings?.storeName?.toUpperCase() || 'TOKO'}</h2>
                  {storeSettings?.address && <p className="opacity-90">{storeSettings.address}</p>}
                  {storeSettings?.phone && <p className="opacity-90 leading-tight">{storeSettings.phone}</p>}
                </div>
                <div className="mb-2 font-medium">
                  <div className="grid grid-cols-[65px_auto] gap-x-1">
                    <span>No Struk</span><span>: {transaction.receiptNumber}</span>
                    <span>Tanggal</span><span>: {format(new Date(transaction.date), 'dd MMM yyyy, HH:mm', { locale: id })}</span>
                    <span>Kasir</span><span>: {transaction.cashierName || (transaction as any).cashier_name || 'Staff'}</span>
                    {transaction.customerName && (
                      <><span>Nama</span><span>: {transaction.customerName}</span></>
                    )}
                    {tableVal && (
                      <>
                        <span>Meja/Tipe</span>
                        <span>: {formatReceiptTable(tableVal)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="border-t border-dashed border-black my-2" />
                
                <div className="space-y-2">
                  {safeItems.map((item: any, i: number) => {
                    const pName = item.productName || item.product_name || 'Produk';
                    let variants = item.selectedVariants || item.selected_variants || [];
                    if (typeof variants === 'string') {
                      try { variants = JSON.parse(variants); } catch (e) { variants = []; }
                    }
                    return (
                      <div key={i} className="leading-tight font-medium">
                        <div className="font-bold break-words whitespace-normal text-left">{pName}</div>
                        <div className="flex justify-between text-[0.95em] mt-0.5">
                          <span>{item.quantity} x {rp(item.price)}</span>
                          <span>{rp(item.subtotal)}</span>
                        </div>
                        {Array.isArray(variants) && variants.length > 0 && (
                          <div className="opacity-80 text-[0.9em] pl-1">+ {variants.map((v: any) => v.optionName || v.option_name).join(', ')}</div>
                        )}
                        {item.notes && <div className="opacity-80 text-[0.9em] pl-1">Catatan: {item.notes}</div>}
                      </div>
                    );
                  })}
                </div>
                
                <div className="border-t border-dashed border-black my-2" />
                <div className="space-y-1 ml-auto max-w-[240px] w-full font-medium text-[0.95em]">
                  <div className="flex justify-between">
                    <span>Subtotal</span><span>{rp(transaction.subtotal)}</span>
                  </div>
                  {txDiscountAmount > 0 && (
                    <div className="flex justify-between">
                      <span>Diskon</span><span>-{rp(txDiscountAmount)}</span>
                    </div>
                  )}
                  {((transaction.tax_and_service || transaction.taxAndService) > 0) && (
                    <div className="flex justify-between">
                      <span>Biaya Admin</span><span>{rp(transaction.tax_and_service || transaction.taxAndService)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-extrabold text-[1.1em] border-t border-dashed border-black/40 pt-1 mt-1">
                    <span>Total</span><span>{rp(transaction.total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bayar</span><span>{paymentMethodName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kembali</span><span>{rp(transaction.change)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── CLASSIC TEMPLATE ── */}
            {template === 'classic' && (
              <div className="w-full text-[0.85em] relative z-10">
                <div className="text-center mb-3">
                  {showLogo && storeSettings?.logo && (
                    <div className="w-16 h-16 mx-auto mb-2 overflow-hidden bg-transparent">
                      <img crossOrigin="anonymous" src={processedLogo || storeSettings.logo} alt="Logo" className="w-full h-full object-contain mx-auto grayscale" />
                    </div>
                  )}
                  <h2 className="font-extrabold text-[1.25em] tracking-wide">{storeSettings?.storeName || 'TOKO'}</h2>
                  {storeSettings?.address && <p className="text-[0.9em] mt-1 leading-tight">{storeSettings.address}</p>}
                  {storeSettings?.phone && <p className="text-[0.9em] leading-tight">{storeSettings.phone}</p>}
                </div>
                <div className="border-t border-dashed border-black/60 my-2" />
                <div className="space-y-0.5 font-medium">
                  <div className="flex justify-between"><span>No. Struk: {transaction.receiptNumber}</span><span>{paymentMethodName}</span></div>
                  <div className="flex justify-between">
                    <span>{format(new Date(transaction.date), 'dd/MM/yyyy')}</span>
                    <span>{format(new Date(transaction.date), 'HH:mm')}</span>
                  </div>
                </div>
                <div className="border-t border-dashed border-black/40 my-2" />
                <div className="space-y-0.5 text-left font-medium">
                  <div className="flex justify-between"><span className="text-gray-500">Kasir:</span><span className="font-semibold">{transaction.cashierName || (transaction as any).cashier_name || 'Staff'}</span></div>
                  {transaction.customerName && (
                    <div className="flex justify-between"><span className="text-gray-500">Pelanggan:</span><span className="font-semibold">{transaction.customerName}</span></div>
                  )}
                  {tableVal && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Meja / Tipe:</span>
                      <span className="font-bold">{formatReceiptTable(tableVal)}</span>
                    </div>
                  )}
                </div>
                <div className="border-t border-dashed border-black/60 my-2" />
                
                <div className="space-y-1.5 font-medium">
                  {safeItems.map((item: any, i: number) => {
                    const pName = item.productName || item.product_name || 'Produk';
                    let variants = item.selectedVariants || item.selected_variants || [];
                    if (typeof variants === 'string') {
                      try { variants = JSON.parse(variants); } catch (e) { variants = []; }
                    }
                    return (
                      <div key={i}>
                        <div className="flex justify-between font-semibold">
                          <span className="break-words whitespace-normal text-left">{pName}</span>
                          <span>{rp(item.subtotal)}</span>
                        </div>
                        <div className="text-[0.9em] text-gray-500 pl-2 text-left">
                          {item.quantity} x {rp(item.price)}
                          {Array.isArray(variants) && variants.length > 0 && ` (+ ${variants.map((v: any) => v.optionName || v.option_name).join(', ')})`}
                          {item.notes && ` (Catatan: ${item.notes})`}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="border-t border-dashed border-black/60 my-2" />
                <div className="space-y-1 font-medium">
                  <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{rp(transaction.subtotal)}</span></div>
                  {txDiscountAmount > 0 && (
                    <div className="flex justify-between"><span className="text-gray-600">Diskon</span><span>-{rp(txDiscountAmount)}</span></div>
                  )}
                  {((transaction.tax_and_service || transaction.taxAndService) > 0) && (
                    <div className="flex justify-between"><span className="text-gray-600">Biaya Admin</span><span>{rp(transaction.tax_and_service || transaction.taxAndService)}</span></div>
                  )}
                  <div className="flex justify-between font-black text-[1.1em] border-t border-gray-300 pt-1.5 mt-1.5"><span>Total</span><span>{rp(transaction.total)}</span></div>
                  <div className="flex justify-between mt-1"><span className="text-gray-600">Bayar</span><span>{rp(txPaymentAmount || transaction.total)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Kembali</span><span>{rp(transaction.change)}</span></div>
                </div>
              </div>
            )}

            {/* ── MINIMALIS TEMPLATE ── */}
            {template === 'minimalis' && (
              <div className="w-full text-center text-[0.85em] relative z-10">
                <div className="mb-4">
                  {showLogo && storeSettings?.logo && (
                    <div className="w-10 h-10 mx-auto mb-2 overflow-hidden bg-transparent">
                      <img crossOrigin="anonymous" src={processedLogo || storeSettings.logo} alt="Logo" className="w-full h-full object-contain mx-auto grayscale" />
                    </div>
                  )}
                  <h2 className="font-bold text-[1.15em]">{storeSettings?.storeName || 'Toko'}</h2>
                  {storeSettings?.address && <p className="text-[0.9em] opacity-75">{storeSettings.address}</p>}
                </div>
                <div className="border-t border-solid border-black/20 my-3" />
                <div className="opacity-80 flex justify-between font-medium">
                  <span>{format(new Date(transaction.date), 'dd/MM/yyyy')}</span>
                  <span>{transaction.receiptNumber}</span>
                </div>
                <div className="text-left space-y-0.5 mt-1 mb-2 font-medium">
                  <div className="flex justify-between"><span className="opacity-60">Kasir</span><span>{transaction.cashierName || (transaction as any).cashier_name || 'Staff'}</span></div>
                  {transaction.customerName && (
                    <div className="flex justify-between"><span className="opacity-60">Pelanggan</span><span>{transaction.customerName}</span></div>
                  )}
                  {tableVal && (
                    <div className="flex justify-between">
                      <span className="opacity-60">Meja/Tipe</span>
                      <span>{formatReceiptTable(tableVal)}</span>
                    </div>
                  )}
                </div>
                <div className="border-t border-solid border-black/20 my-3" />
                
                <div className="space-y-1.5 text-left font-medium">
                  {safeItems.map((item: any, i: number) => {
                    const pName = item.productName || item.product_name || 'Produk';
                    let variants = item.selectedVariants || item.selected_variants || [];
                    if (typeof variants === 'string') {
                      try { variants = JSON.parse(variants); } catch (e) { variants = []; }
                    }
                    return (
                      <div key={i} className="flex justify-between">
                        <span className="break-words whitespace-normal text-left pr-2">
                          {item.quantity}x {pName}
                          {Array.isArray(variants) && variants.length > 0 && ` (+${variants.map((v: any) => v.optionName || v.option_name).join(', ')})`}
                          {item.notes && ` (*${item.notes})`}
                        </span>
                        <span className="shrink-0">{rp(item.subtotal)}</span>
                      </div>
                    );
                  })}
                </div>
                
                <div className="border-t border-solid border-black/20 my-3" />
                <div className="space-y-0.5 font-medium">
                  <div className="flex justify-between">
                    <span>Subtotal</span><span>{rp(transaction.subtotal)}</span>
                  </div>
                  {txDiscountAmount > 0 && (
                    <div className="flex justify-between">
                      <span>Diskon</span><span>-{rp(txDiscountAmount)}</span>
                    </div>
                  )}
                  {((transaction.tax_and_service || transaction.taxAndService) > 0) && (
                    <div className="flex justify-between">
                      <span>Biaya Admin</span><span>{rp(transaction.tax_and_service || transaction.taxAndService)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-[1.1em] pt-1 mt-1 border-t border-dashed border-gray-300">
                    <span>Total</span><span>{rp(transaction.total)}</span>
                  </div>
                </div>
                <div className="flex justify-between opacity-80 mt-1.5 font-medium">
                  <span>Pembayaran</span><span>{paymentMethodName}</span>
                </div>
                <div className="flex justify-between opacity-80 font-medium">
                  <span>Kembali</span><span>{rp(transaction.change)}</span>
                </div>
              </div>
            )}

            {/* ── Dynamic Footer ── */}
            <div className="border-t border-black mt-4 mb-3 opacity-40" />
            <div className="relative z-10 pt-1 pb-3 space-y-2 text-gray-500 text-[0.85em] text-center">
              {footerOrder.map((block: string, idx: number) => {
                if (block === 'line1' && footerLinesData[0]?.trim()) {
                  return (
                    <p key={idx} className="whitespace-pre-wrap leading-relaxed" style={getFooterStyle('line1')}>
                      {footerLinesData[0].trim()}
                    </p>
                  );
                }
                if (block === 'line2' && footerLinesData[1]?.trim()) {
                  return (
                    <p key={idx} className="whitespace-pre-wrap leading-relaxed" style={getFooterStyle('line2')}>
                      {footerLinesData[1].trim()}
                    </p>
                  );
                }
                if (block === 'image' && showFooterImg) {
                  if (footerType === 'qrcode' && footerQrUrl) {
                    return (
                      <div key={idx} className="my-2.5 flex justify-center text-center">
                        <QRCodeCanvas value={footerQrUrl} size={72} level="M" includeMargin={true} className="mx-auto bg-white p-0.5 rounded" />
                      </div>
                    );
                  } else if (footerType === 'image' && footerImgData) {
                    return (
                      <div key={idx} className="my-2.5 text-center">
                        <img 
                          crossOrigin="anonymous" src={processedFooterImg || footerImgData} alt="Footer" 
                          className="h-16 w-auto mx-auto object-contain rounded-xl grayscale opacity-75 select-none" 
                          style={{ filter: 'grayscale(1) contrast(1.2)' }}
                        />
                      </div>
                    );
                  }
                }
                return null;
              })}
            </div>
          </div>
        </div>

        {/* Tombol Aksi */}
        <div className="grid grid-cols-3 gap-3 mt-2">
          <Button 
            variant="outline" 
            className="flex flex-col items-center justify-center gap-2 h-20 bg-card border-border hover:bg-muted hover:border-primary/50 text-muted-foreground hover:text-primary rounded-2xl transition-all shadow-sm" 
            onClick={handleDownload} 
            disabled={downloading || sharing || printing}
          >
            {downloading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <Download className="w-6 h-6 text-muted-foreground" />}
            <span className="text-[10px] font-bold uppercase tracking-wider">Unduh</span>
          </Button>

          <Button 
            variant="outline" 
            className="flex flex-col items-center justify-center gap-2 h-20 bg-card border-border hover:bg-muted hover:border-primary/50 text-muted-foreground hover:text-primary rounded-2xl transition-all shadow-sm" 
            onClick={handleShare} 
            disabled={downloading || sharing || printing}
          >
            {sharing ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <Share2 className="w-6 h-6 text-muted-foreground" />}
            <span className="text-[10px] font-bold uppercase tracking-wider">Bagikan</span>
          </Button>

          <Button 
            variant="outline" 
            className="flex flex-col items-center justify-center gap-2 h-20 bg-primary border-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30 rounded-2xl transition-all" 
            onClick={handlePrint} 
            disabled={downloading || sharing || printing}
          >
            {printing ? <Loader2 className="w-6 h-6 animate-spin text-primary-foreground" /> : <Printer className="w-6 h-6 text-primary-foreground" />}
            <span className="text-[10px] font-bold uppercase tracking-wider">Cetak Struk</span>
          </Button>
        </div>

        <Button 
          variant="outline" 
          className="w-full mt-3 rounded-2xl py-5 font-bold border-border/80 bg-muted/60 hover:bg-muted text-foreground" 
          onClick={onClose}
        >
          Tutup
        </Button>
      </DialogContent>
    </Dialog>
  );
}
