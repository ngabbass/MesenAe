import { Capacitor, registerPlugin } from '@capacitor/core';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface NativePrintPluginType {
  printHtml(options: { html: string; title?: string; mediaSize?: string }): Promise<{ success: boolean }>;
  listBluetoothPrinters(): Promise<{ printers: { name: string; address: string; id: string }[] }>;
  printBluetoothEscPos(options: { address: string; data: string }): Promise<{ success: boolean }>;
}

const NativePrint = registerPlugin<NativePrintPluginType>('NativePrint');

// Polyfill window.bluetoothSerial to redirect SPP commands to NativePrint on Android
const polyfillBluetoothSerial = () => {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    // Keep track of active connection state and buffer
    (window as any)._activeBluetoothAddress = null;
    (window as any)._bluetoothWriteBuffer = null;

    // @ts-ignore
    window.bluetoothSerial = {
      disconnect: (success?: () => void, failure?: (err: any) => void) => {
        const address = (window as any)._activeBluetoothAddress;
        const buffer = (window as any)._bluetoothWriteBuffer;
        
        if (address && buffer && buffer.length > 0) {
          // Convert binary buffer to base64 safely
          let binary = '';
          const len = buffer.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(buffer[i]);
          }
          const base64Data = window.btoa(binary);
          
          // Clear active session
          (window as any)._bluetoothWriteBuffer = null;
          (window as any)._activeBluetoothAddress = null;

          NativePrint.printBluetoothEscPos({ address, data: base64Data })
            .then(() => {
              if (success) success();
            })
            .catch((err: any) => {
              console.warn('[BluetoothSerial Polyfill] Direct write failed:', err);
              if (failure) failure(err);
            });
        } else {
          (window as any)._bluetoothWriteBuffer = null;
          (window as any)._activeBluetoothAddress = null;
          if (success) success();
        }
      },
      list: (success: (results: any[]) => void, failure: (err: any) => void) => {
        NativePrint.listBluetoothPrinters()
          .then((res: any) => {
            success(res.printers || []);
          })
          .catch((err: any) => {
            if (failure) failure(err);
          });
      },
      connect: (address: string, success: () => void, failure: (err: any) => void) => {
        (window as any)._activeBluetoothAddress = address;
        (window as any)._bluetoothWriteBuffer = new Uint8Array(0);
        if (success) success();
      },
      write: (dataBuffer: ArrayBuffer, success: () => void, failure: (err: any) => void) => {
        const currentBuffer = (window as any)._bluetoothWriteBuffer;
        if (currentBuffer) {
          const incoming = new Uint8Array(dataBuffer);
          const newBuffer = new Uint8Array(currentBuffer.length + incoming.length);
          newBuffer.set(currentBuffer);
          newBuffer.set(incoming, currentBuffer.length);
          (window as any)._bluetoothWriteBuffer = newBuffer;
          if (success) success();
        } else {
          const address = (window as any)._activeBluetoothAddress;
          if (!address) {
            if (failure) failure("No printer connected");
            return;
          }
          const incoming = new Uint8Array(dataBuffer);
          let binary = '';
          const len = incoming.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(incoming[i]);
          }
          const base64Data = window.btoa(binary);

          NativePrint.printBluetoothEscPos({ address, data: base64Data })
            .then(() => {
              if (success) success();
            })
            .catch((err: any) => {
              if (failure) failure(err);
            });
        }
      }
    };
  }
};

try {
  polyfillBluetoothSerial();
} catch (e) {
  console.error('[BluetoothSerial Polyfill] Failed to initialize:', e);
}

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

  // Coba gunakan plugin NativePrint di Android
  if (Capacitor.getPlatform() === 'android') {
    try {
      const trimmed = htmlContent.trim();
      let isBase64Image = false;
      let rawBase64 = '';
      
      if (trimmed.startsWith('data:image/') && trimmed.includes('base64,')) {
        isBase64Image = true;
        rawBase64 = trimmed.split('base64,')[1];
      } else if (trimmed.includes('base64,')) {
        const match = trimmed.match(/src=["']data:image\/[^;]+;base64,([^"']+)["']/);
        if (match && match[1]) {
          isBase64Image = true;
          rawBase64 = match[1];
        }
      } else if (trimmed.startsWith('base64://')) {
        isBase64Image = true;
        rawBase64 = trimmed.substring(9);
      }

      let printableHtml = htmlContent;
      if (isBase64Image && rawBase64) {
        printableHtml = `
          <html>
            <head>
              <title>${documentName}</title>
              <style>
                @page { margin: 0; size: auto; }
                html, body { margin: 0; padding: 0; background: #fff; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; }
                .img-wrap { padding: 0; display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; }
                img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; margin: 0 auto; }
              </style>
            </head>
            <body>
              <div class="img-wrap"><img src="data:image/png;base64,${rawBase64}" alt="${documentName}" /></div>
            </body>
          </html>
        `;
      }

      toast.info('Membuka dialog cetak native...');
      const res = await NativePrint.printHtml({
        html: printableHtml,
        title: documentName,
        mediaSize: (documentName.toLowerCase().includes('laporan') || documentName.toLowerCase().includes('cetak_')) ? 'A4' : 'default'
      });
      if (res.success) {
        toast.success(`Cetak "${documentName}" berhasil!`);
        return true;
      }
    } catch (err: any) {
      console.warn('[Print] NativePrint failed, falling back to legacy methods...', err);
    }
  }

  // @ts-ignore
  const cordova = window.cordova;
  if (!cordova || !cordova.plugins || !cordova.plugins.printer) {
    console.info('[Print] cordova-plugin-printer tidak tersedia.');
    return false;
  }

  // Bersihkan cache lama secara asinkronus
  cleanOldPrintCache().catch(() => {});

  try {
    const trimmed = htmlContent.trim();
    
    // Deteksi apakah ini adalah base64 image (untuk struk/barcode yang sudah PNG)
    let isBase64Image = false;
    let rawBase64 = '';
    
    if (trimmed.startsWith('data:image/') && trimmed.includes('base64,')) {
      isBase64Image = true;
      rawBase64 = trimmed.split('base64,')[1];
    } else if (trimmed.includes('base64,')) {
      // Ekstrak base64 dari HTML yang membungkus gambar
      const match = trimmed.match(/src=["']data:image\/[^;]+;base64,([^"']+)["']/);
      if (match && match[1]) {
        isBase64Image = true;
        rawBase64 = match[1];
      }
    } else if (trimmed.startsWith('base64://')) {
      isBase64Image = true;
      rawBase64 = trimmed.substring(9);
    }

    // Jika ini adalah gambar base64, save sebagai PNG file
    if (isBase64Image && rawBase64) {
      const fileName = `print_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: rawBase64,
        directory: Directory.Cache
      });
      
      const printTarget = savedFile.uri;
      console.log('[Print] Image saved to cache:', printTarget);
      
      toast.info(`Menghubungkan ke printer untuk "${documentName}"...`);
      
      return new Promise<boolean>((resolve) => {
        // @ts-ignore
        cordova.plugins.printer.print(printTarget, { name: documentName }, (res: any) => {
          console.log('[Print] Native printer success:', res);
          toast.success(`Cetak "${documentName}" berhasil!`);
          resolve(true);
        }, (err: any) => {
          console.warn('[Print] Printer error:', err);
          toast.error(`Cetak gagal: ${err || 'Error'}`);
          resolve(false);
        });
      });
    }
    
    // PERBAIKAN CRITICAL: Untuk HTML murni, plugin cordova-plugin-printer v0.8.0
    // TIDAK BISA render HTML dengan baik - hanya tampilkan teks HTML
    // Solusi: Gunakan universalPrint yang akan render via iframe/share
    console.warn('[Print] HTML string detected - falling back to universalPrint for proper rendering');
    return await universalPrint(htmlContent, documentName);
    
  } catch (err: any) {
    console.warn('[Print] Error:', err);
    toast.error(`Gagal mencetak: ${err.message || err}`);
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
  
  if (isDataUrl || isBase64Prefix) {
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
    if (Capacitor.getPlatform() === 'android') {
      try {
        toast.info('Membuka dialog cetak native...');
        const res = await NativePrint.printHtml({
          html: printableHtml,
          title: documentName,
          mediaSize: (documentName.toLowerCase().includes('laporan') || documentName.toLowerCase().includes('cetak_')) ? 'A4' : 'default'
        });
        if (res.success) {
          toast.success(`Cetak "${documentName}" berhasil!`);
          return true;
        }
      } catch (err: any) {
        console.warn('[universalPrint] NativePrint failed, trying legacy methods...', err);
      }
    }

    toast.info('Membuka dialog cetak...');
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

        // PERBAIKAN: Coba dialog cetak native (cordova-plugin-printer) DULU
        // @ts-ignore
        const cordova = window.cordova;
        if (cordova?.plugins?.printer) {
          try {
            const printed = await new Promise<boolean>((resolve) => {
              // @ts-ignore
              cordova.plugins.printer.print(result.uri, { name: documentName }, (res: any) => {
                console.log('[universalPrint] Printer success:', res);
                toast.success(`Cetak "${documentName}" berhasil!`);
                resolve(true);
              }, (err: any) => {
                console.warn('[universalPrint] Printer error:', err);
                resolve(false);
              });
            });
            if (printed) return true;
          } catch (printerErr) {
            console.warn('[universalPrint] Printer plugin error:', printerErr);
          }
        }

        // Fallback ke Share jika printer plugin tidak tersedia/gagal
        toast.info('Membuka dialog berbagi dokumen...');
        await Share.share({
          title: documentName,
          text: `Dokumen: ${documentName}`,
          url: result.uri,
          dialogTitle: 'Bagikan / Cetak Dokumen'
        });
        return true;
      }

      // Jika HTML murni (tanpa base64 image) — simpan sebagai HTML lalu coba cetak
      const fileName = `${documentName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.html`;
      const result = await Filesystem.writeFile({
        path: fileName,
        data: htmlContent,
        directory: Directory.Cache,
        encoding: Encoding.UTF8
      });

      // Coba printer plugin dulu untuk HTML file
      // @ts-ignore
      const cordova2 = window.cordova;
      if (cordova2?.plugins?.printer) {
        try {
          const printed = await new Promise<boolean>((resolve) => {
            // @ts-ignore
            cordova2.plugins.printer.print(result.uri, { name: documentName }, (res: any) => {
              resolve(true);
            }, (err: any) => {
              resolve(false);
            });
          });
          if (printed) return true;
        } catch (_) {}
      }

      // Fallback ke Share
      await Share.share({
        title: documentName,
        text: `Dokumen: ${documentName}`,
        url: result.uri,
        dialogTitle: 'Bagikan / Cetak Dokumen'
      });
      return true;
    } catch (shareErr) {
      console.error('[universalPrint] Print/Share fallback failed:', shareErr);
      toast.error('Gagal membuka dialog cetak dokumen.');
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
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @page { 
            margin: 0 !important; 
            size: auto; 
          }
          * {
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box;
          }
          html, body { 
            width: 100%;
            height: 100%;
            margin: 0 !important; 
            padding: 0 !important; 
            background: white;
            overflow: hidden;
          }
          body {
            display: flex;
            justify-content: center;
            align-items: flex-start;
          }
          .img-wrap { 
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            margin: 0 !important;
            padding: 0 !important;
          }
          img { 
            width: 100% !important; 
            max-width: 100% !important; 
            height: auto !important; 
            display: block; 
            margin: 0 !important;
            padding: 0 !important;
            object-fit: contain;
            object-position: top center;
          }
          @media print {
            @page {
              margin: 0 !important;
              size: auto;
            }
            body {
              margin: 0 !important;
              padding: 0 !important;
            }
            img {
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              page-break-inside: avoid;
            }
          }
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
 * Untuk Capacitor native: Konversi ke PNG dengan width penuh agar presisi dan rapi
 * Untuk Web: Kirim HTML langsung
 */
export async function printReportA4(elementId: string, documentName: string = 'Laporan'): Promise<boolean> {
  const el = document.getElementById(elementId);
  if (!el) {
    toast.error(`Elemen dengan ID "${elementId}" tidak ditemukan.`);
    return false;
  }

  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();

  // Jika di Android (baik native maupun web), cetak HTML langsung agar vector dan tajam serta support multi-halaman tanpa OOM
  if (platform === 'android') {
    toast.info(`Menyiapkan dokumen "${documentName}"...`);
    const rawHtml = el.outerHTML;
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${documentName}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta charset="UTF-8">
          <style>
            @page { 
              size: A4 portrait; 
              margin: 15mm 10mm; 
            }
            body { 
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
              padding: 0; 
              margin: 0; 
              background: white; 
              color: black; 
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            * { box-sizing: border-box; }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 10px; 
              margin-bottom: 15px; 
              page-break-inside: auto;
            }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
            th, td { 
              border: 1px solid #cbd5e1; 
              padding: 6px 8px; 
              text-align: left; 
              font-size: 10px; 
              word-wrap: break-word;
            }
            th { 
              background-color: #f8fafc; 
              font-weight: bold; 
              color: #334155; 
            }
            h1 { 
              font-size: 18px;
              margin: 0 0 8px 0; 
              color: #0f172a; 
              page-break-after: avoid;
            }
            h2 { 
              font-size: 16px;
              margin: 0 0 6px 0; 
              color: #0f172a; 
              page-break-after: avoid;
            }
            h3 { 
              font-size: 14px;
              margin: 0 0 5px 0; 
              color: #0f172a; 
              page-break-after: avoid;
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .no-print, button, .lucide { display: none !important; }
            canvas { 
              max-width: 100% !important; 
              height: auto !important; 
            }
            svg {
              max-width: 100%;
              height: auto;
            }
            .report-header {
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 2px solid #334155;
            }
            .summary-box {
              padding: 10px;
              margin: 10px 0;
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
            }
          </style>
        </head>
        <body>
          ${rawHtml}
        </body>
      </html>
    `;

    try {
      const printed = await printHtmlContent(fullHtml, documentName);
      if (!printed) {
        return await universalPrint(fullHtml, documentName);
      }
      return true;
    } catch (err: any) {
      console.error('[PrintReport] Android Error:', err);
      toast.error(`Gagal mencetak: ${err.message || err}`);
      return false;
    }
  }

  if (isNative) {
    // CAPACITOR NATIVE (Non-Android / iOS): Convert HTML ke PNG dengan ukuran A4 penuh
    toast.info(`Menyiapkan dokumen "${documentName}"...`);
    
    // Simpan style asli
    const originalStyle = el.getAttribute('style') || '';
    
    // CRITICAL FIX: Inject <style> tag untuk override @media screen { display:none!important }
    // Karena el.style.display = 'block' TIDAK CUKUP melawan !important di stylesheet
    const forceVisibleStyle = document.createElement('style');
    forceVisibleStyle.id = '__mesenae_force_print_visible__';
    forceVisibleStyle.textContent = `
      #${elementId},
      #${elementId} * {
        display: revert !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      #${elementId} {
        display: block !important;
        position: absolute !important;
        left: -9999px !important;
        top: 0 !important;
        z-index: 99999 !important;
        width: 794px !important;
        min-width: 794px !important;
        max-width: 794px !important;
        box-sizing: border-box !important;
        background-color: #ffffff !important;
        overflow: visible !important;
      }
    `;
    document.head.appendChild(forceVisibleStyle);
    
    try {
      // Juga set inline style sebagai backup
      el.style.setProperty('display', 'block', 'important');
      el.style.setProperty('position', 'absolute', 'important');
      el.style.setProperty('left', '-9999px', 'important');
      el.style.setProperty('top', '0', 'important');
      el.style.setProperty('opacity', '1', 'important');
      el.style.setProperty('visibility', 'visible', 'important');
      el.style.setProperty('z-index', '99999', 'important');
      el.style.setProperty('width', '794px', 'important');
      el.style.setProperty('min-width', '794px', 'important');
      el.style.setProperty('max-width', '794px', 'important');
      el.style.setProperty('box-sizing', 'border-box', 'important');
      el.style.setProperty('background-color', '#ffffff', 'important');
      el.style.setProperty('overflow', 'visible', 'important');
      
      // Tunggu render DOM — lebih lama karena element baru saja di-force visible
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Convert ke PNG dengan ukuran exact A4
      const dataUrl = await toPng(el, {
        cacheBust: true,
        pixelRatio: 2, // Cukup tinggi tapi tidak bikin OOM
        backgroundColor: '#ffffff',
        width: 794, // Fixed A4 width
        style: {
          margin: '0',
          padding: '15mm',
          transform: 'scale(1)',
        }
      });
      
      // Hapus force-visible style dan restore style asli
      forceVisibleStyle.remove();
      if (originalStyle) {
        el.setAttribute('style', originalStyle);
      } else {
        el.removeAttribute('style');
      }
      
      if (!dataUrl || dataUrl.length < 100) {
        console.error('[PrintReport] toPng() menghasilkan data kosong');
        toast.error('Gagal merender dokumen — data kosong');
        return false;
      }
      
      // Langsung kirim dataUrl PNG (base64)
      // printHtmlContent akan detect base64 → save file PNG → cordova printer dialog
      console.log('[PrintReport] Sending PNG dataUrl directly, length:', dataUrl.length);
      const printed = await printHtmlContent(dataUrl, documentName);
      if (printed) {
        return true;
      }
      
      // Fallback: bungkus dalam HTML sederhana berisi <img> agar universalPrint tetap kirim PNG
      const imgHtml = `<html><head><title>${documentName}</title><style>@page{margin:0}body{margin:0;padding:0;background:#fff}img{width:100%;height:auto;display:block}</style></head><body><img src="${dataUrl}" alt="${documentName}"/></body></html>`;
      toast.info('Mencoba metode alternatif...');
      return await universalPrint(imgHtml, documentName);
      
    } catch (err: any) {
      // Restore style jika error
      forceVisibleStyle.remove();
      if (originalStyle) {
        el.setAttribute('style', originalStyle);
      } else {
        el.removeAttribute('style');
      }
      
      console.error('[PrintReport] Error converting to PNG:', err);
      toast.error(`Gagal menyiapkan dokumen: ${err.message || err}`);
      return false;
    }
  } else {
    // WEB BROWSER: Kirim HTML langsung
    toast.info(`Menyiapkan dokumen "${documentName}"...`);
    
    const rawHtml = el.outerHTML;
    
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${documentName}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta charset="UTF-8">
          <style>
            @page { 
              size: A4 portrait; 
              margin: 15mm 10mm; 
            }
            body { 
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
              padding: 0; 
              margin: 0; 
              background: white; 
              color: black; 
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            * { box-sizing: border-box; }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 10px; 
              margin-bottom: 15px; 
              page-break-inside: auto;
            }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
            th, td { 
              border: 1px solid #cbd5e1; 
              padding: 6px 8px; 
              text-align: left; 
              font-size: 10px; 
              word-wrap: break-word;
            }
            th { 
              background-color: #f8fafc; 
              font-weight: bold; 
              color: #334155; 
            }
            h1 { 
              font-size: 18px;
              margin: 0 0 8px 0; 
              color: #0f172a; 
              page-break-after: avoid;
            }
            h2 { 
              font-size: 16px;
              margin: 0 0 6px 0; 
              color: #0f172a; 
              page-break-after: avoid;
            }
            h3 { 
              font-size: 14px;
              margin: 0 0 5px 0; 
              color: #0f172a; 
              page-break-after: avoid;
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .no-print, button, .lucide { display: none !important; }
            canvas { 
              max-width: 100% !important; 
              height: auto !important; 
            }
            svg {
              max-width: 100%;
              height: auto;
            }
            .report-header {
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 2px solid #334155;
            }
            .summary-box {
              padding: 10px;
              margin: 10px 0;
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
            }
          </style>
        </head>
        <body>
          ${rawHtml}
        </body>
      </html>
    `;

    try {
      const printed = await printHtmlContent(fullHtml, documentName);
      if (!printed) {
        return await universalPrint(fullHtml, documentName);
      }
      return true;
    } catch (err: any) {
      console.error('[PrintReport] Error:', err);
      toast.error(`Gagal mencetak: ${err.message || err}`);
      return false;
    }
  }
}

