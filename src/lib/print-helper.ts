import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * printHtmlContent — Kirim HTML ke printer native via cordova-plugin-printer.
 * Diubah menjadi async untuk mencegah Race Condition saat menyimpan file cache.
 * Jika plugin tidak tersedia, kembalikan false sehingga pemanggil bisa menggunakan fallback universalPrint().
 */
export async function printHtmlContent(htmlContent: string, documentName: string = 'Document'): Promise<boolean> {
  const isNative = Capacitor.isNativePlatform();
  if (isNative) {
    // @ts-ignore
    const cordova = window.cordova;
    if (cordova && cordova.plugins && cordova.plugins.printer) {
      try {
        let printTarget = '';

        const trimmed = htmlContent.trim();
        const isHtml = trimmed.startsWith('<html>') || 
                      trimmed.startsWith('<!DOCTYPE') || 
                      trimmed.includes('<html') || 
                      trimmed.includes('<body');

        if (isHtml) {
          // Kirim HTML langsung ke cordova-plugin-printer sebagai string HTML.
          // Plugin ini dirancang untuk menerima string HTML dan merendernya secara internal
          // melalui WebView native. Menyimpan ke file lalu mengirim URI file://
          // menyebabkan plugin mencetak path URI sebagai teks biasa, bukan merender kontennya.
          printTarget = htmlContent;
          console.log('[Print] Passing HTML content directly to cordova printer (length:', htmlContent.length, ')');
        } else {
          // Proses data base64 / data URL murni (bukan dokumen HTML)
          let rawBase64 = '';
          if (htmlContent.startsWith('base64://')) {
            rawBase64 = htmlContent.substring('base64://'.length);
          } else if (htmlContent.startsWith('data:image/')) {
            const base64Marker = 'base64,';
            const markerIndex = htmlContent.indexOf(base64Marker);
            if (markerIndex !== -1) {
              rawBase64 = htmlContent.substring(markerIndex + base64Marker.length);
            }
          } else if (htmlContent.includes('data:image/') && htmlContent.includes('base64,')) {
            const base64Marker = 'base64,';
            const markerIndex = htmlContent.indexOf(base64Marker);
            if (markerIndex !== -1) {
              const sliced = htmlContent.substring(markerIndex + base64Marker.length);
              const endQuoteIndex = sliced.indexOf('"');
              const endSingleQuoteIndex = sliced.indexOf("'");
              const endTagIndex = sliced.indexOf('<');
              let endCharIndex = sliced.length;
              if (endQuoteIndex !== -1) endCharIndex = Math.min(endCharIndex, endQuoteIndex);
              if (endSingleQuoteIndex !== -1) endCharIndex = Math.min(endCharIndex, endSingleQuoteIndex);
              if (endTagIndex !== -1) endCharIndex = Math.min(endCharIndex, endTagIndex);

              rawBase64 = sliced.substring(0, endCharIndex);
            }
          }

          if (rawBase64) {
            const fileName = `print_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
            const savedFile = await Filesystem.writeFile({
              path: fileName,
              data: rawBase64,
              directory: Directory.Cache
            });
            printTarget = savedFile.uri;
            console.log('[Print] Image base64 saved to cache file URI:', printTarget);
          } else {
            // Fallback terakhir jika string tidak dikenal
            printTarget = htmlContent;
          }
        }

        toast.info(`Menghubungkan ke printer untuk "${documentName}"...`);
        
        // Return Promise agar memblokir eksekusi sampai ada respon dari native plugin
        return new Promise<boolean>((resolve) => {
          // @ts-ignore
          cordova.plugins.printer.print(printTarget, { name: documentName }, (res: any) => {
            console.log('[Print] Native cordova printer command sent:', res);
            toast.success(`Cetak "${documentName}" berhasil dikirim!`);
            resolve(true);
          }, (err: any) => {
            console.warn('[Print] cordova printer error:', err);
            toast.error(`Cetak "${documentName}" gagal: ${err || 'Error'}`);
            resolve(false);
          });
        });
      } catch (err: any) {
        console.warn('[Print] Gagal mengeksekusi printHtmlContent native:', err);
        toast.error(`Gagal mencetak "${documentName}": ${err.message || err}`);
        return false;
      }
    }
    // Plugin tidak tersedia — kembalikan false tanpa error toast
    console.info('[Print] cordova-plugin-printer tidak tersedia, akan pakai universalPrint fallback.');
    return false;
  }
  return false;
}

/**
 * universalPrint — Fallback cetak universal yang bekerja di Capacitor WebView maupun browser.
 * * Alur:
 * 1. Coba via iframe yang di-inject ke document → print iframe contentWindow
 * 2. Jika iframe gagal → window.open() + print
 * * Bekerja di: Android Capacitor WebView, iOS WKWebView, Chrome, Firefox, Edge.
 */
export async function universalPrint(htmlContent: string, documentName: string = 'Document'): Promise<boolean> {
  const isNative = Capacitor.isNativePlatform();
  
  if (isNative) {
    // Di native platform (Capacitor), jika dialog cetak sistem (cordova-plugin-printer) tidak tersedia,
    // tawarkan fallback untuk membagikan dokumen via Share Dialog.
    toast.info('Printer sistem tidak tersedia. Membuka dialog berbagi...');
    try {
      // Cari base64 image di dalam htmlContent jika ada
      let base64Data = '';
      if (htmlContent.includes('data:image/') && htmlContent.includes('base64,')) {
        const marker = 'base64,';
        const startIdx = htmlContent.indexOf(marker);
        if (startIdx !== -1) {
          const sliced = htmlContent.substring(startIdx + marker.length);
          const endQuote = sliced.indexOf('"');
          const endSingleQuote = sliced.indexOf("'");
          const endTag = sliced.indexOf('<');
          let endIdx = sliced.length;
          if (endQuote !== -1) endIdx = Math.min(endIdx, endQuote);
          if (endSingleQuote !== -1) endIdx = Math.min(endIdx, endSingleQuote);
          if (endTag !== -1) endIdx = Math.min(endIdx, endTag);
          base64Data = sliced.substring(0, endIdx);
        }
      }

      if (base64Data) {
        // Jika ada base64 image, simpan sebagai PNG dan bagikan
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

      // Jika konten adalah HTML murni tanpa base64 image, simpan sebagai file HTML dan bagikan
      const trimmed = htmlContent.trim();
      const isHtml = trimmed.startsWith('<html>') || 
                    trimmed.startsWith('<!DOCTYPE') || 
                    trimmed.includes('<html') || 
                    trimmed.includes('<body');
      if (isHtml) {
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
      }
    } catch (shareErr) {
      console.error('[universalPrint] Share fallback failed:', shareErr);
    }
    // Jika semua fallback native gagal, kembalikan false agar tidak jatuh ke iframe print
    // yang tidak berfungsi di WebView Capacitor (hanya mencetak teks URI/blank)
    toast.error('Gagal membuka dialog cetak/berbagi dokumen.');
    return false;
  }

  // Fallback standar untuk web browser (iframe print)
  toast.info('Membuka dialog cetak sistem...');
  
  return new Promise<boolean>((resolve) => {
    try {
      // Buat iframe tersembunyi
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.style.border = 'none';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);

      const cleanup = () => {
        try {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        } catch (_) {}
      };

      // Timeout safety: bersihkan iframe setelah 30 detik
      const cleanupTimer = setTimeout(cleanup, 30000);

      iframe.onload = () => {
        try {
          const win = iframe.contentWindow;
          if (!win) {
            clearTimeout(cleanupTimer);
            cleanup();
            resolve(fallbackWindowPrint(htmlContent, documentName));
            return;
          }

          // Tulis konten HTML ke iframe
          const doc = win.document;
          doc.open();
          doc.write(htmlContent);
          doc.close();

          // Tunggu gambar selesai load sebelum memicu cetak
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
                console.warn('[universalPrint] iframe print failed:', printErr);
                clearTimeout(cleanupTimer);
                cleanup();
                resolve(fallbackWindowPrint(htmlContent, documentName));
              }
            }, 600);
          };

          Promise.all(imagePromises).then(printTrigger).catch(() => {
            printTrigger();
          });
        } catch (loadErr) {
          console.warn('[universalPrint] iframe load error:', loadErr);
          clearTimeout(cleanupTimer);
          cleanup();
          resolve(fallbackWindowPrint(htmlContent, documentName));
        }
      };

      iframe.onerror = () => {
        clearTimeout(cleanupTimer);
        cleanup();
        resolve(fallbackWindowPrint(htmlContent, documentName));
      };

      // Trigger iframe load dengan srcdoc atau blank src
      try {
        iframe.srcdoc = htmlContent;
      } catch (_) {
        // Fallback: set src kosong lalu tulis via onload
        iframe.src = 'about:blank';
      }

    } catch (err) {
      console.error('[universalPrint] Fatal error:', err);
      resolve(fallbackWindowPrint(htmlContent, documentName));
    }
  });
}

/**
 * fallbackWindowPrint — Fallback terakhir: buka window baru dan panggil window.print().
 */
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
      setTimeout(() => {
        try { printWin.close(); } catch (_) {}
      }, 1500);
    }, 500);
    return true;
  } catch (err) {
    console.error('[fallbackWindowPrint] Error:', err);
    toast.error('Gagal membuka dialog cetak sistem.');
    return false;
  }
}

/**
 * findActiveBluetoothPrinter — Cari printer bluetooth terpasang di local storage.
 */
function findActiveBluetoothPrinter(): { name: string; address: string } | null {
  try {
    const saved = localStorage.getItem('mesenae_printers');
    if (saved) {
      const printers = JSON.parse(saved);
      if (Array.isArray(printers)) {
        // Coba cari printer kasir utama dulu
        let printer = printers.find(p => (p.role === 'Struk Pembelian' || p.role === 'Kasir') && p.type === 'bluetooth');
        if (printer) return printer;

        // Fallback ke printer bluetooth apa saja yang tersedia
        printer = printers.find(p => p.type === 'bluetooth');
        if (printer) return printer;
      }
    }
  } catch (e) {
    console.warn('[Print] Gagal memuat setelan printer:', e);
  }
  return null;
}

/**
 * convertCanvasToEscPosRaster — Konversi canvas HTML5 ke format raster grafik ESC/POS (binarized 1-bit GS v 0).
 */
function convertCanvasToEscPosRaster(canvas: HTMLCanvasElement): Uint8Array | null {
  let tempCanvas: HTMLCanvasElement | null = null;
  try {
    const printWidth = 384; // Standard lebar printer thermal 58mm
    const printHeight = Math.round((canvas.height / canvas.width) * printWidth);

    tempCanvas = document.createElement('canvas');
    tempCanvas.width = printWidth;
    tempCanvas.height = printHeight;

    const ctx = tempCanvas.getContext('2d');
    if (!ctx) {
      tempCanvas.width = 0;
      tempCanvas.height = 0;
      tempCanvas = null;
      return null;
    }

    // Render grayscale dan binarisasi
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, printWidth, printHeight);
    ctx.drawImage(canvas, 0, 0, printWidth, printHeight);

    const imgData = ctx.getImageData(0, 0, printWidth, printHeight);
    const pixels = imgData.data;

    const xBytes = printWidth / 8; // 48 bytes per line
    const yLines = printHeight;

    // GS v 0 0 xL xH yL yH
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
            isBlack = luminance < 140; // Threshold kontras binarisasi
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

    tempCanvas.width = 0;
    tempCanvas.height = 0;
    tempCanvas = null;

    return combined;
  } catch (err) {
    console.error('[Print] Gagal konversi canvas ke raster:', err);
    if (tempCanvas) {
      tempCanvas.width = 0;
      tempCanvas.height = 0;
      tempCanvas = null;
    }
    return null;
  }
}

/**
 * printToBluetoothPrinter — Koneksi, inisialisasi, tulis grafik raster, dan potong kertas pada printer Bluetooth.
 */
async function printToBluetoothPrinter(address: string, rasterData: Uint8Array, documentName: string): Promise<boolean> {
  // @ts-ignore
  const bluetoothSerial = window.bluetoothSerial;
  if (!bluetoothSerial) {
    console.warn('[Print] Plugin bluetoothSerial tidak tersedia.');
    return false;
  }

  return new Promise<boolean>((resolve) => {
    toast.info(`Menghubungkan ke printer Bluetooth untuk "${documentName}"...`);
    
    // Putuskan koneksi sebelumnya agar socket bebas
    bluetoothSerial.disconnect(
      () => console.log('[Print] Sesi Bluetooth lama dibersihkan.'),
      () => {}
    );

    setTimeout(() => {
      bluetoothSerial.connect(
        address,
        () => {
          toast.info('Terhubung ke printer! Mengirim data cetak...');
          
          // Inisialisasi printer (ESC @) dan center align (ESC a 1)
          const initCmd = new Uint8Array([0x1B, 0x40, 0x1B, 0x61, 0x01]);
          // Feed baris & potong kertas (GS V 65 0)
          const feedCmd = new Uint8Array([0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x41, 0x00]);
          
          const totalLength = initCmd.length + rasterData.length + feedCmd.length;
          const data = new Uint8Array(totalLength);
          data.set(initCmd, 0);
          data.set(rasterData, initCmd.length);
          data.set(feedCmd, initCmd.length + rasterData.length);

          const chunkSize = 128; // Tulis dalam chunk kecil agar tidak membebani buffer printer
          let written = 0;

          const writeNextChunk = () => {
            if (written >= data.length) {
              setTimeout(() => {
                bluetoothSerial.disconnect(
                  () => {
                    toast.success(`Berhasil mencetak "${documentName}" ke printer Bluetooth!`);
                    resolve(true);
                  },
                  (err: any) => {
                    console.warn('[Print] Disconnect warning:', err);
                    resolve(true);
                  }
                );
              }, 500);
              return;
            }

            const chunk = data.slice(written, written + chunkSize);
            bluetoothSerial.write(
              chunk.buffer,
              () => {
                written += chunk.length;
                writeNextChunk();
              },
              (err: any) => {
                console.error('[Print] Gagal kirim ke printer Bluetooth:', err);
                toast.error('Gagal mengirim data cetak ke printer Bluetooth.');
                bluetoothSerial.disconnect();
                resolve(false);
              }
            );
          };

          writeNextChunk();
        },
        (connErr: any) => {
          console.warn('[Print] Gagal koneksi Bluetooth:', connErr);
          toast.error('Gagal terhubung ke printer Bluetooth. Pastikan printer menyala & sudah ter-pairing.');
          resolve(false);
        }
      );
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
        if (!ctx) {
          canvas.width = 0;
          canvas.height = 0;
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      } catch (err) {
        console.error('[Print] Gagal konversi image data url ke canvas:', err);
        resolve(null);
      }
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = dataUrl;
  });
}

/**
 * printElementNative — Mencetak elemen DOM tertentu berdasarkan ID.
 * Alur Prioritas di Capacitor Native:
 * 1. Tunggu render DOM selesai sepenuhnya (1200ms)
 * 2. Ambil gambar elemen menggunakan html-to-image (toPng) untuk mencegah force close WebView.
 * 3. Coba cetak ke Printer Bluetooth yang tersanding jika terkonfigurasi.
 * 4. Jika gagal/tidak ada Bluetooth, cetak base64 langsung ke Printer Sistem (AirPrint/Google Print) menggunakan cordova-plugin-printer.
 * 5. Jika gagal/tidak native, jalankan browser system print fallback.
 */
export async function printElementNative(elementId: string, documentName: string = 'Document'): Promise<boolean> {
  const el = document.getElementById(elementId);
  if (!el) {
    toast.error(`Elemen dengan ID "${elementId}" tidak ditemukan.`);
    return false;
  }

  const isNative = Capacitor.isNativePlatform();

  // 1. Render/Capture elemen DOM menjadi PNG berkualitas tinggi menggunakan html-to-image
  let dataUrl = '';
  const originalId = el.id;
  try {
    toast.info(`Menyiapkan data rendering "${documentName}"...`);
    // Berikan jeda waktu agar chart SVG ter-render 100% dengan benar
    await new Promise((resolve) => setTimeout(resolve, 1200));
    
    // Ubah ID sementara agar tidak terkena styling off-screen @media screen
    if (originalId) {
      el.id = originalId + '-temp-capture';
    }
    
    dataUrl = await toPng(el, {
      cacheBust: true,
      fontEmbedCSS: '',
      pixelRatio: isNative ? 1.5 : 3,
      backgroundColor: '#ffffff',
      style: {
        position: 'relative',
        top: '0',
        left: '0',
        width: '794px',
        minWidth: '794px',
        maxWidth: '794px',
        opacity: '1',
        visibility: 'visible',
        display: 'block',
      }
    });
  } catch (err: any) {
    console.warn('[Print] Gagal menangkap elemen dengan toPng:', err);
    toast.error(`Gagal merender dokumen: ${err.message || err}`);
    return false;
  } finally {
    if (originalId) {
      el.id = originalId;
    }
  }

  if (isNative) {
    // 2. Prioritas utama: Coba cetak ke printer Bluetooth thermal terkonfigurasi
    const btPrinter = findActiveBluetoothPrinter();
    // @ts-ignore
    if (btPrinter && window.bluetoothSerial && dataUrl) {
      try {
        let canvas = await convertDataUrlToCanvas(dataUrl);
        if (canvas) {
          const rasterData = convertCanvasToEscPosRaster(canvas);
          // Explicitly clear and nullify returned canvas
          canvas.width = 0;
          canvas.height = 0;
          canvas = null;
          if (rasterData) {
            const printed = await printToBluetoothPrinter(btPrinter.address, rasterData, documentName);
            if (printed) {
              return true; // Sukses cetak via Bluetooth!
            } else {
              toast.warning('Gagal terkoneksi ke printer Bluetooth. Mengalihkan ke cetak sistem...');
            }
          }
        }
      } catch (err) {
        console.warn('[Print] Cetak Bluetooth gagal:', err);
        toast.warning('Gagal terkoneksi ke printer Bluetooth. Mengalihkan ke cetak sistem...');
      }
      console.warn('[Print] Cetak Bluetooth gagal, beralih ke printer sistem...');
    }

    // 3. Prioritas kedua: Kirim sebagai dokumen HTML yang dibungkus rapi agar tercetak di tengah
    if (dataUrl) {
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
            <div class="img-wrap"><img src="${dataUrl}" /></div>
          </body>
        </html>
      `;
      const printed = await printHtmlContent(fullHtml, documentName);
      if (printed) {
        return true;
      }
    }
  }

  // 4. Fallback Terakhir: Cetak HTML biasa via browser / system print dialog menggunakan image wrapper untuk akurasi layout
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

  const nativePrinted = await printHtmlContent(fullHtml, documentName);
  if (nativePrinted) {
    return true;
  }

  // Fallback universal browser print (iframe/popup window)
  return universalPrint(fullHtml, documentName);
}
