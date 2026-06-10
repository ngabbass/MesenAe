import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * cleanOldPrintCache — Membersihkan file print lama di folder Cache Capacitor.
 */
async function cleanOldPrintCache() {
  try {
    const result = await Filesystem.readdir({
      path: '',
      directory: Directory.Cache
    });
    
    const now = Date.now();
    for (const file of result.files) {
      const name = file.name;
      if (
        name.startsWith('print_') || 
        name.startsWith('Cetak_') || 
        name.includes('_Laporan_') || 
        name.includes('_Struk_') || 
        name.startsWith('QR_') || 
        name.startsWith('Dapur_') || 
        name.startsWith('Label_')
      ) {
        try {
          const stat = await Filesystem.stat({
            path: name,
            directory: Directory.Cache
          });
          const modifiedTime = stat.mtime || stat.ctime || 0;
          if (modifiedTime && (now - modifiedTime > 5 * 60 * 1000)) { // 5 menit TTL
            await Filesystem.deleteFile({
              path: name,
              directory: Directory.Cache
            });
            console.log(`[PrintCache] Deleted old print cache file: ${name}`);
          }
        } catch (err) {
          // Abaikan jika gagal mengambil stat/hapus
        }
      }
    }
  } catch (e) {
    console.warn('[PrintCache] Failed to clean old print cache files:', e);
  }
}

/**
 * printHtmlContent — Kirim data ke printer native via cordova-plugin-printer.
 */
export async function printHtmlContent(htmlContent: string, documentName: string = 'Document'): Promise<boolean> {
  const isNative = Capacitor.isNativePlatform();
  if (!isNative) return false;

  // @ts-ignore
  const cordova = window.cordova;
  if (!cordova || !cordova.plugins || !cordova.plugins.printer) {
    console.info('[Print] cordova-plugin-printer tidak tersedia.');
    return false;
  }

  // Bersihkan cache lama secara asinkronus
  cleanOldPrintCache().catch(() => {});

  try {
    let printTarget = '';
    const trimmed = htmlContent.trim();
    
    let rawBase64 = '';
    
    // Ekstrak Base64 murni dari data URL atau dari tag HTML img
    if (trimmed.startsWith('data:image/') && trimmed.includes('base64,')) {
      rawBase64 = trimmed.split('base64,')[1];
    } else if (trimmed.includes('base64,')) {
      // Ini kemungkinan HTML yang membungkus gambar base64 (seperti dari Receipt/KitchenReceipt)
      const match = trimmed.match(/src=["']data:image\/[^;]+;base64,([^"']+)["']/);
      if (match && match[1]) {
        rawBase64 = match[1];
      } else {
        const parts = trimmed.split('base64,');
        if (parts.length > 1) {
          rawBase64 = parts[1].replace(/["'<].*/g, '').trim();
        }
      }
    } else if (trimmed.startsWith('base64://')) {
      rawBase64 = trimmed.substring(9);
    }

    if (rawBase64) {
      // Simpan Base64 sebagai file PNG di folder Cache Capacitor
      const fileName = `print_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: rawBase64,
        directory: Directory.Cache
      });
      
      // Plugin printer native SANGAT menyukai format file:// URI
      printTarget = savedFile.uri;
      console.log('[Print] Image base64 saved to cache file URI:', printTarget);
    } else {
      // FIX: Simpan HTML murni sebagai file .html agar OS merendernya dengan baik (Paginasi berfungsi)
      const fileName = `Laporan_${Date.now()}_${Math.floor(Math.random() * 1000)}.html`;
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: htmlContent,
        directory: Directory.Cache,
        encoding: Encoding.UTF8
      });
      
      printTarget = savedFile.uri;
      console.log('[Print] HTML content saved to cache file URI:', printTarget);
    }

    toast.info(`Menghubungkan ke printer untuk "${documentName}"...`);
    
    return new Promise<boolean>((resolve) => {
      // @ts-ignore
      cordova.plugins.printer.print(printTarget, { name: documentName }, (res: any) => {
        console.log('[Print] Native cordova printer command sent:', res);
        toast.success(`Cetak "${documentName}" berhasil!`);
        resolve(true);
      }, (err: any) => {
        console.warn('[Print] cordova printer error:', err);
        toast.error(`Cetak "${documentName}" gagal: ${err || 'Error'}`);
        resolve(false);
      });
    });
  } catch (err: any) {
    console.warn('[Print] Gagal mengeksekusi printHtmlContent native:', err);
    toast.error(`Gagal mencetak dokumen: ${err.message || err}`);
    return false;
  }
}

/**
 * universalPrint — Fallback cetak universal yang bekerja di Capacitor WebView maupun browser.
 */
export async function universalPrint(htmlContent: string, documentName: string = 'Document'): Promise<boolean> {
  const isNative = Capacitor.isNativePlatform();
  
  // Bersihkan cache lama secara asinkronus
  cleanOldPrintCache().catch(() => {});

  let printableHtml = htmlContent;
  const isDataUrl = htmlContent.startsWith('data:image/') && htmlContent.includes('base64,');
  const isBase64Prefix = htmlContent.startsWith('base64://');
  
  if (!isNative && (isDataUrl || isBase64Prefix)) {
    let imgSrc = htmlContent;
    if (isBase64Prefix) {
      imgSrc = `data:image/png;base64,${htmlContent.substring(9)}`;
    }
    printableHtml = `
      <html>
        <head>
          <title>${documentName}</title>
          <style>
            @page { margin: 0; size: auto; }
            body { margin: 0; padding: 0; background: #fff; display: flex; justify-content: center; align-items: flex-start; }
            .img-wrap { padding: 0; display: flex; justify-content: center; width: 100%; }
            img { width: 100%; max-width: 100%; height: auto; display: block; margin: 0 auto; box-shadow: none; }
          </style>
        </head>
        <body>
          <div class="img-wrap"><img src="${imgSrc}" alt="${documentName}" /></div>
        </body>
      </html>
    `;
  }

  if (isNative) {
    toast.info('Membuka dialog berbagi...');
    try {
      let base64Data = '';
      
      if (htmlContent.startsWith('data:image/') && htmlContent.includes('base64,')) {
        base64Data = htmlContent.split('base64,')[1];
      } else if (htmlContent.includes('base64,')) {
        const match = htmlContent.match(/src=["']data:image\/[^;]+;base64,([^"']+)["']/);
        if (match && match[1]) {
          base64Data = match[1];
        } else {
          const parts = htmlContent.split('base64,');
          if (parts.length > 1) {
            base64Data = parts[1].replace(/["'<].*/g, '').trim();
          }
        }
      }

      if (base64Data) {
        const fileName = `${documentName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache
        });

        await Share.share({
          title: documentName,
          text: `Dokumen: ${documentName}`,
          url: result.uri,
          dialogTitle: 'Bagikan / Cetak Dokumen'
        });
        return true;
      }

      // Jika HTML murni
      const fileName = `${documentName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.html`;
      const result = await Filesystem.writeFile({
        path: fileName,
        data: htmlContent,
        directory: Directory.Cache,
        encoding: Encoding.UTF8
      });

      await Share.share({
        title: documentName,
        text: `Dokumen: ${documentName}`,
        url: result.uri,
        dialogTitle: 'Bagikan / Cetak Dokumen'
      });
      return true;
    } catch (shareErr) {
      console.error('[universalPrint] Share fallback failed:', shareErr);
      toast.error('Gagal membuka dialog berbagi dokumen.');
      return false;
    }
  }

  // Web Browser Fallback (Iframe Print)
  toast.info('Membuka dialog cetak sistem...');
  
  return new Promise<boolean>((resolve) => {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const cleanup = () => {
        try { if (document.body.contains(iframe)) document.body.removeChild(iframe); } catch (_) {}
      };

      const cleanupTimer = setTimeout(cleanup, 30000);

      iframe.onload = () => {
        try {
          const win = iframe.contentWindow;
          if (!win) {
            clearTimeout(cleanupTimer);
            cleanup();
            resolve(fallbackWindowPrint(printableHtml, documentName));
            return;
          }

          const doc = win.document;
          doc.open();
          doc.write(printableHtml);
          doc.close();

          const images = doc.getElementsByTagName('img');
          const imagePromises = Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolveImg => {
              img.onload = resolveImg;
              img.onerror = resolveImg;
            });
          });

          const printTrigger = () => {
            setTimeout(() => {
              try {
                win.focus();
                win.print();
                clearTimeout(cleanupTimer);
                setTimeout(cleanup, 2000);
                resolve(true);
              } catch (printErr) {
                clearTimeout(cleanupTimer);
                cleanup();
                resolve(fallbackWindowPrint(printableHtml, documentName));
              }
            }, 600);
          };

          Promise.all(imagePromises).then(printTrigger).catch(() => printTrigger());
        } catch (loadErr) {
          clearTimeout(cleanupTimer);
          cleanup();
          resolve(fallbackWindowPrint(printableHtml, documentName));
        }
      };

      iframe.onerror = () => {
        clearTimeout(cleanupTimer);
        cleanup();
        resolve(fallbackWindowPrint(printableHtml, documentName));
      };

      try { iframe.srcdoc = printableHtml; } 
      catch (_) { iframe.src = 'about:blank'; }

    } catch (err) {
      resolve(fallbackWindowPrint(printableHtml, documentName));
    }
  });
}

function fallbackWindowPrint(htmlContent: string, documentName: string): boolean {
  try {
    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (!printWin) {
      toast.error('Gagal membuka jendela cetak. Coba izinkan popup di browser.');
      return false;
    }
    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
    printWin.document.title = documentName;
    setTimeout(() => {
      printWin.focus();
      printWin.print();
      setTimeout(() => { try { printWin.close(); } catch (_) {} }, 1500);
    }, 500);
    return true;
  } catch (err) {
    toast.error('Gagal membuka dialog cetak sistem.');
    return false;
  }
}

function findActiveBluetoothPrinter(): { name: string; address: string } | null {
  try {
    const saved = localStorage.getItem('mesenae_printers');
    if (saved) {
      const printers = JSON.parse(saved);
      if (Array.isArray(printers)) {
        let printer = printers.find(p => (p.role === 'Struk Pembelian' || p.role === 'Kasir') && p.type === 'bluetooth');
        if (printer) return printer;
        printer = printers.find(p => p.type === 'bluetooth');
        if (printer) return printer;
      }
    }
  } catch (e) {}
  return null;
}

function convertCanvasToEscPosRaster(canvas: HTMLCanvasElement): Uint8Array | null {
  let tempCanvas: HTMLCanvasElement | null = null;
  try {
    const printWidth = 384;
    const printHeight = Math.round((canvas.height / canvas.width) * printWidth);

    tempCanvas = document.createElement('canvas');
    tempCanvas.width = printWidth;
    tempCanvas.height = printHeight;

    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, printWidth, printHeight);
    ctx.drawImage(canvas, 0, 0, printWidth, printHeight);

    const imgData = ctx.getImageData(0, 0, printWidth, printHeight);
    const pixels = imgData.data;

    const xBytes = printWidth / 8;
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
          const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2], a = pixels[idx + 3];

          if (a > 30 && (0.299 * r + 0.587 * g + 0.114 * b) < 140) {
            byteVal |= (1 << (7 - bit));
          }
        }
        body[y * xBytes + x] = byteVal;
      }
    }

    const combined = new Uint8Array(header.length + body.length);
    combined.set(header, 0);
    combined.set(body, header.length);

    return combined;
  } catch (err) {
    return null;
  }
}

async function printToBluetoothPrinter(address: string, rasterData: Uint8Array, documentName: string): Promise<boolean> {
  // @ts-ignore
  const bluetoothSerial = window.bluetoothSerial;
  if (!bluetoothSerial) return false;

  return new Promise<boolean>((resolve) => {
    toast.info(`Menghubungkan ke printer Bluetooth...`);
    bluetoothSerial.disconnect(() => {}, () => {});

    setTimeout(() => {
      bluetoothSerial.connect(address, () => {
        toast.info('Terhubung! Mengirim data...');
        
        const initCmd = new Uint8Array([0x1B, 0x40, 0x1B, 0x61, 0x01]);
        const feedCmd = new Uint8Array([0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x41, 0x00]);
        
        const data = new Uint8Array(initCmd.length + rasterData.length + feedCmd.length);
        data.set(initCmd, 0);
        data.set(rasterData, initCmd.length);
        data.set(feedCmd, initCmd.length + rasterData.length);

        const chunkSize = 128;
        let written = 0;

        const writeNextChunk = () => {
          if (written >= data.length) {
            setTimeout(() => {
              bluetoothSerial.disconnect(() => {
                toast.success(`Berhasil mencetak "${documentName}"!`);
                resolve(true);
              }, () => resolve(true));
            }, 500);
            return;
          }

          const chunk = data.slice(written, written + chunkSize);
          bluetoothSerial.write(chunk.buffer, () => {
            written += chunk.length;
            writeNextChunk();
          }, () => {
            toast.error('Gagal mengirim data cetak ke printer Bluetooth.');
            bluetoothSerial.disconnect();
            resolve(false);
          });
        };
        writeNextChunk();
      }, () => {
        toast.error('Gagal terhubung ke printer Bluetooth.');
        resolve(false);
      });
    }, 500);
  });
}

async function convertDataUrlToCanvas(dataUrl: string): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      } catch (err) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export async function printElementNative(elementId: string, documentName: string = 'Document'): Promise<boolean> {
  const el = document.getElementById(elementId);
  if (!el) {
    toast.error(`Elemen dengan ID "${elementId}" tidak ditemukan.`);
    return false;
  }

  const isNative = Capacitor.isNativePlatform();
  let dataUrl = '';
  
  // Simpan style asli
  const originalStyle = el.getAttribute('style') || '';
  
  try {
    toast.info(`Menyiapkan data rendering "${documentName}"...`);
    
    // Override style secara kasar agar kelihatan oleh renderer html-to-image
    el.setAttribute(
      'style', 
      'position: relative !important; top: 0px !important; left: 0px !important; ' +
      'width: 794px !important; min-width: 794px !important; max-width: 794px !important; ' +
      'opacity: 1 !important; visibility: visible !important; display: block !important; ' +
      'z-index: 99999 !important; overflow: visible !important;'
    );
    
    await new Promise((resolve) => setTimeout(resolve, 600));
    
    // Konversi ke PNG dengan useCORS agar gambar eksternal ikut terender
    dataUrl = await toPng(el, {
      cacheBust: true,
      useCORS: true, 
      fontEmbedCSS: '',
      pixelRatio: isNative ? 1.5 : 3,
      backgroundColor: '#ffffff'
    });
  } catch (err: any) {
    toast.error(`Gagal merender dokumen: ${err.message || err}`);
    return false;
  } finally {
    // Kembalikan style asli
    if (originalStyle) {
      el.setAttribute('style', originalStyle);
    } else {
      el.removeAttribute('style');
    }
  }

  if (isNative) {
    // 1. Coba Printer Bluetooth Thermal
    const btPrinter = findActiveBluetoothPrinter();
    // @ts-ignore
    if (btPrinter && window.bluetoothSerial && dataUrl) {
      try {
        let canvas = await convertDataUrlToCanvas(dataUrl);
        if (canvas) {
          const rasterData = convertCanvasToEscPosRaster(canvas);
          canvas.width = 0; canvas.height = 0; canvas = null;
          if (rasterData) {
            const printed = await printToBluetoothPrinter(btPrinter.address, rasterData, documentName);
            if (printed) return true;
          }
        }
      } catch (err) {
        console.warn('[Print] Cetak Bluetooth gagal, beralih ke native...', err);
      }
    }

    // 2. Printer Sistem Native (AirPrint / Google Print)
    // PENTING: Langsung kirim dataUrl (Base64), JANGAN dibungkus dengan <html>
    if (dataUrl) {
      const nativePrinted = await printHtmlContent(dataUrl, documentName);
      if (nativePrinted) {
        return true;
      }
    }
  }

  // 3. Fallback Web Browser / Iframe
  // Di web, kita WAJIB membungkusnya dengan HTML agar iframe bisa menampilkan gambar
  const fullHtml = `
    <html>
      <head>
        <title>${documentName}</title>
        <style>
          @page { margin: 0; size: auto; }
          body { margin: 0; padding: 0; background: #fff; display: flex; justify-content: center; align-items: flex-start; }
          .img-wrap { padding: 0; display: flex; justify-content: center; width: 100%; }
          img { width: 100%; max-width: 100%; height: auto; display: block; margin: 0 auto; box-shadow: none; }
        </style>
      </head>
      <body>
        <div class="img-wrap"><img src="${dataUrl}" alt="${documentName}" /></div>
      </body>
    </html>
  `;

  return universalPrint(fullHtml, documentName);
}

/**
 * printReportA4 — Khusus untuk mencetak dokumen panjang (Invoice, Laporan Keuangan, Laporan Stok)
 * Bekerja dengan mengirimkan HTML murni, tanpa merendernya menjadi gambar.
 */
export async function printReportA4(elementId: string, documentName: string = 'Laporan'): Promise<boolean> {
  const el = document.getElementById(elementId);
  if (!el) {
    toast.error(`Elemen dengan ID "${elementId}" tidak ditemukan.`);
    return false;
  }

  const isNative = Capacitor.isNativePlatform();
  toast.info(`Menyiapkan dokumen "${documentName}"...`);

  // Ambil HTML mentah dari tabel/laporan
  const rawHtml = el.outerHTML;

  // Bungkus dengan struktur HTML dasar dan CSS untuk kertas A4
  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${documentName}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          /* Pengaturan standar kertas A4 */
          @page { size: A4; margin: 15mm; }
          body { 
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
            padding: 0; 
            margin: 0; 
            background: white; 
            color: black; 
          }
          /* Reset styling khusus print */
          * { box-sizing: border-box; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 12px; }
          th { background-color: #f8fafc; font-weight: bold; color: #334155; }
          h1, h2, h3 { margin: 0 0 10px 0; color: #0f172a; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          /* Sembunyikan elemen UI seperti tombol saat dicetak */
          .no-print, button { display: none !important; }
        </style>
      </head>
      <body>
        ${rawHtml}
      </body>
    </html>
  `;

  try {
    if (isNative) {
      // Kirim string HTML langsung ke fungsi utama
      return await printHtmlContent(fullHtml, documentName);
    } else {
      // Fallback untuk web
      return await universalPrint(fullHtml, documentName);
    }
  } catch (err: any) {
    console.error('[PrintReport] Error:', err);
    toast.error(`Gagal mencetak dokumen: ${err.message || err}`);
    return false;
  }
}
