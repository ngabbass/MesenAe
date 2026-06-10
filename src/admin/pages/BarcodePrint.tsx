import React, { useState, useRef, useMemo } from 'react';
import { Printer, Settings, Tag, Package, Search, Plus, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useDbQuery, type Product } from '@/hooks/db-hooks';
import Barcode from 'react-barcode';
import { cn, FORMAT_IDR } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { printHtmlContent, universalPrint } from '@/lib/print-helper';
import { toPng } from 'html-to-image';

type PaperSize = 'a4' | 'thermal';

interface PrintItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
}

export default function BarcodePrint() {
  const products = useDbQuery<Product>('products') || [];
  
  // States
  const [printMode, setPrintMode] = useState<'barcode' | 'label'>('barcode');
  const [paperSize, setPaperSize] = useState<PaperSize>('a4');
  
  const [selectedItems, setSelectedItems] = useState<PrintItem[]>([]);
  
  // Custom Input State
  const [customName, setCustomName] = useState('');
  const [customSku, setCustomSku] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQuantity, setCustomQuantity] = useState('1');

  // Search DB State
  const [searchQuery, setSearchQuery] = useState('');

  // Memoized product search to prevent search performance bottleneck
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) {
      return products.slice(0, 50);
    }
    const query = searchQuery.toLowerCase();
    return products.filter(p => 
      (p.name || '').toLowerCase().includes(query) ||
      (p.sku || '').toLowerCase().includes(query) ||
      (p.barcode || '').toLowerCase().includes(query)
    ).slice(0, 50);
  }, [products, searchQuery]);

  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  React.useEffect(() => {
    if (!previewContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(previewContainerRef.current);
    return () => observer.disconnect();
  }, []);

  const handlePrint = async () => {
    const printEl = printRef.current;
    if (!printEl) return;

    setPrinting(true);
    try {
      const isNative = Capacitor.isNativePlatform();
      const isA4 = paperSize === 'a4';

      if (isNative) {
        // SELALU gunakan PNG capture di Capacitor native (termasuk multi-halaman A4)
        try {
          toast.info('Menyiapkan halaman cetak native...');
          
          // Simpan styles & class asli untuk di-restore
          const elementsToClean = Array.from(printEl.querySelectorAll('.a4-page, .thermal-page, .scaling-wrapper, .scaling-wrapper-thermal'));
          const originalStyles = elementsToClean.map(el => el.getAttribute('style') || '');
          
          // Bersihkan style dan classes pembungkus sementara agar toPng merasterisasi layout 100% asli
          elementsToClean.forEach(el => el.removeAttribute('style'));
          elementsToClean.forEach(el => {
            el.classList.remove('shadow-xl', 'border', 'border-gray-300', 'a4-page-scaled');
          });

          let dataUrl = '';
          try {
            if (paperSize === 'a4' && chunkedA4Items.length > 1) {
              // Multi-halaman A4: capture per halaman, gabungkan di canvas vertikal
              const pages = Array.from(printEl.querySelectorAll('.a4-page'));
              const pageImages: HTMLImageElement[] = [];
              
              for (const page of pages) {
                const pageDataUrl = await toPng(page as HTMLElement, {
                  cacheBust: true,
                  fontEmbedCSS: '',
                  pixelRatio: 1.5,
                  backgroundColor: '#ffffff'
                });
                const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                  const image = new Image();
                  image.onload = () => resolve(image);
                  image.onerror = reject;
                  image.src = pageDataUrl;
                });
                pageImages.push(img);
              }
              
              if (pageImages.length > 0) {
                // Gabungkan semua halaman secara vertikal ke satu canvas
                const totalHeight = pageImages.reduce((sum, img) => sum + img.height, 0);
                const maxWidth = Math.max(...pageImages.map(img => img.width));
                const combinedCanvas = document.createElement('canvas');
                combinedCanvas.width = maxWidth;
                combinedCanvas.height = totalHeight;
                const ctx = combinedCanvas.getContext('2d');
                if (ctx) {
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(0, 0, maxWidth, totalHeight);
                  let yOffset = 0;
                  for (const img of pageImages) {
                    ctx.drawImage(img, 0, yOffset);
                    yOffset += img.height;
                  }
                  dataUrl = combinedCanvas.toDataURL('image/png');
                  // Cleanup canvas
                  combinedCanvas.width = 0;
                  combinedCanvas.height = 0;
                }
              }
            } else {
              // Single page atau thermal: capture seluruh printEl
              dataUrl = await toPng(printEl, {
                cacheBust: true,
                fontEmbedCSS: '',
                pixelRatio: 1.5,
                backgroundColor: '#ffffff'
              });
            }
          } finally {
            // Restore styles asli
            elementsToClean.forEach((el, idx) => {
              if (originalStyles[idx]) el.setAttribute('style', originalStyles[idx]);
              else el.removeAttribute('style');
            });
            // Restore classes asli
            elementsToClean.forEach(el => {
              if (el.classList.contains('a4-page')) {
                el.classList.add('shadow-xl', 'border', 'border-gray-300', 'a4-page-scaled');
              } else if (el.classList.contains('thermal-page')) {
                el.classList.add('shadow-xl', 'border', 'border-gray-300');
              }
            });
          }

          if (dataUrl && dataUrl.length > 100) {
            // Kirim PNG ke dialog cetak native (cordova-plugin-printer)
            const printed = await printHtmlContent(dataUrl, `Cetak_${printMode === 'barcode' ? 'Barcode' : 'Label'}`);
            if (printed) {
              return;
            }
            // Fallback: bungkus dalam HTML berisi <img> agar universalPrint tetap kirim PNG
            const imgHtml = `<html><head><title>Cetak_${printMode === 'barcode' ? 'Barcode' : 'Label'}</title><style>@page{margin:0}body{margin:0;padding:0;background:#fff}img{width:100%;height:auto;display:block}</style></head><body><img src="${dataUrl}" alt="Cetak"/></body></html>`;
            await universalPrint(imgHtml, `Cetak_${printMode === 'barcode' ? 'Barcode' : 'Label'}`);
            return;
          }
        } catch (e) {
          console.warn('toPng native print failed, falling back to HTML print:', e);
        }
      }

      toast.info('Menyiapkan halaman cetak...');

      // Buat HTML bersih tanpa container scaling, shadow, border abu-abu agar mepet pas di kertas A4
      const pages = Array.from(printEl.querySelectorAll(isA4 ? '.a4-page' : '.thermal-page'));
      const pagesHtml = pages.map(page => {
        const pageClone = page.cloneNode(true) as HTMLDivElement;
        pageClone.removeAttribute('style');
        pageClone.classList.remove('shadow-xl', 'border', 'border-gray-300', 'a4-page-scaled');
        return pageClone.outerHTML;
      }).join('\n');

      const fullHtml = `
        <html>
          <head>
            <title>Cetak_${printMode === 'barcode' ? 'Barcode' : 'Label'}</title>
            <style>
              @page { 
                margin: 0; 
                size: ${isA4 ? 'A4 portrait' : '58mm auto'}; 
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
                width: 100% !important;
              }
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .print-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                width: 100%;
              }
              
              /* A4 Page Styling */
              .a4-page {
                width: 210mm !important;
                height: 297mm !important;
                min-width: 210mm !important;
                min-height: 297mm !important;
                max-width: 210mm !important;
                max-height: 297mm !important;
                padding: 10mm !important;
                box-sizing: border-box !important;
                background: white !important;
                display: grid !important;
                grid-template-columns: repeat(4, 1fr) !important;
                grid-template-rows: repeat(10, 1fr) !important;
                gap: 3mm 4mm !important;
                content-start: start !important;
                overflow: hidden !important;
                page-break-after: always !important;
                break-after: page !important;
              }
              
              /* Thermal Page Styling */
              .thermal-page {
                width: 58mm !important;
                padding: 2mm !important;
                box-sizing: border-box !important;
                background: white !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 2mm !important;
              }

              /* General items */
              .a4-page *, .thermal-page * {
                box-sizing: border-box !important;
              }
              
              /* Barcode Print Styling */
              .barcode-print-item {
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                text-align: center !important;
                background-color: white !important;
                color: black !important;
                overflow: hidden !important;
                border: 1px dashed #d1d5db !important;
                width: 100% !important;
                box-sizing: border-box !important;
                padding: 4px !important;
              }
              .a4-page .barcode-print-item {
                height: 25mm !important;
              }
              .thermal-page .barcode-print-item {
                height: 30mm !important;
              }
              .barcode-print-name {
                font-size: 9px !important;
                font-weight: bold !important;
                text-align: center !important;
                line-height: 1.25 !important;
                width: 100% !important;
                margin: 0 0 2px 0 !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                padding: 0 4px !important;
                box-sizing: border-box !important;
                display: block !important;
              }
              .barcode-print-wrapper {
                margin-top: 2px !important;
                transform: scale(0.7) !important;
                transform-origin: top center !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                width: 100% !important;
              }
              .barcode-print-wrapper svg {
                margin: 0 auto !important;
                display: block !important;
              }
              .label-print-details {
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                flex: 1 !important;
                width: 100% !important;
                text-align: center !important;
              }
              .label-print-price {
                font-size: 14px !important;
                font-weight: 900 !important;
                letter-spacing: -0.025em !important;
                margin: 0 !important;
                text-align: center !important;
                display: block !important;
                width: 100% !important;
              }
              .label-print-sku {
                font-size: 7px !important;
                color: #6b7280 !important;
                font-family: monospace !important;
                margin: 2px 0 0 0 !important;
                text-align: center !important;
                display: block !important;
                width: 100% !important;
              }
            </style>
          </head>
          <body>
            <div class="print-container">
              ${pagesHtml}
            </div>
          </body>
        </html>
      `;

      const printed = await printHtmlContent(fullHtml, `Cetak_${printMode === 'barcode' ? 'Barcode' : 'Label'}`);
      if (printed) {
        return;
      }

      await universalPrint(fullHtml, `Cetak_${printMode === 'barcode' ? 'Barcode' : 'Label'}`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memproses cetakan');
    } finally {
      setPrinting(false);
    }
  };

  const handleUniversalPrint = async () => {
    const isNative = Capacitor.isNativePlatform();
    
    // Web or A4 goes directly to standard system print modal
    if (!isNative || paperSize === 'a4') {
      await handlePrint();
      return;
    }

    setPrinting(true);
    // Direct thermal roll printing on native Capacitor
    let labelPrinter: any = null;
    try {
      const saved = localStorage.getItem('mesenae_printers');
      if (saved) {
        const printers = JSON.parse(saved);
        labelPrinter = printers.find((p: any) => p.role === 'Label Harga & Barcode' || p.role === 'Label');
      }
    } catch (e) {
      console.warn('Gagal memuat konfigurasi printer:', e);
    }

    if (!labelPrinter) {
      toast.info('Printer label belum dikonfigurasi. Mengalihkan ke cetak sistem...');
      await handlePrint();
      return;
    }

    try {
      // Build ESC/POS bytes for label printer
      const encoder = new TextEncoder();
      
      // Connect and print each selected item
      await new Promise<void>((resolve, reject) => {
        // @ts-ignore
        if (!window.bluetoothSerial) {
          reject(new Error('Plugin Bluetooth Serial tidak terpasang'));
          return;
        }
        
        // @ts-ignore
        window.bluetoothSerial.disconnect(() => {}, () => {});
        
        setTimeout(async () => {
          // @ts-ignore
          window.bluetoothSerial.connect(labelPrinter.address, async () => {
            try {
              for (const item of renderItems) {
                const lines: string[] = [];
                lines.push('\x1B\x40'); // Init
                lines.push('\x1B\x61\x01'); // Center
                
                lines.push('\x1B\x45\x01'); // Bold ON
                lines.push(`${item.name.toUpperCase()}\n`);
                lines.push('\x1B\x45\x00'); // Bold OFF
                
                if (printMode === 'barcode') {
                  // ESC/POS Commands for CODE128 Barcode: width 2, height 64, HRI text below
                  lines.push('\x1D\x77\x02'); // Width
                  lines.push('\x1D\x68\x40'); // Height
                  lines.push('\x1D\x48\x02'); // HRI position: below barcode
                  lines.push('\x1D\x6B\x49' + String.fromCharCode(item.sku.length + 2) + '{B' + item.sku + '\n');
                } else {
                  lines.push(`Harga: ${FORMAT_IDR(item.price)}\n`);
                  lines.push(`SKU: ${item.sku}\n`);
                }
                lines.push('\n\n\n'); // feed

                const data = encoder.encode(lines.join(''));
                // @ts-ignore
                await new Promise<void>((resW, rejW) => window.bluetoothSerial.write(data.buffer, () => resW(), (e) => rejW(e)));
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
      toast.success('Pencetakan label berhasil!');
    } catch (err: any) {
      console.error('Direct print failed, falling back to system:', err);
      toast.warning('Gagal terkoneksi ke printer Bluetooth. Mengalihkan ke cetak sistem...');
      await handlePrint();
    } finally {
      setPrinting(false);
    }
  };

  // Calculate items to render
  const renderItems = useMemo(() => {
    const items: PrintItem[] = [];
    selectedItems.forEach(item => {
      for (let i = 0; i < item.quantity; i++) {
        items.push(item);
      }
    });
    return items;
  }, [selectedItems]);

  // Chunk items for A4 pagination (4 columns x 10 rows = 40 items per page)
  const chunkedA4Items = useMemo(() => {
    const chunks: PrintItem[][] = [];
    for (let i = 0; i < renderItems.length; i += 40) {
      chunks.push(renderItems.slice(i, i + 40));
    }
    return chunks;
  }, [renderItems]);

  const addCustomItem = () => {
    if (!customName || (!customSku && printMode === 'barcode')) return;
    
    setSelectedItems(prev => [...prev, {
      id: Date.now().toString(),
      name: customName,
      sku: customSku || `SKU-${Math.floor(Math.random() * 10000)}`,
      price: Number(customPrice) || 0,
      quantity: Number(customQuantity) || 1
    }]);

    setCustomName('');
    setCustomSku('');
    setCustomPrice('');
    setCustomQuantity('1');
  };

  const addProductToPrint = (product: Product) => {
    const existing = selectedItems.find(i => i.id === product.id);
    if (existing) {
      setSelectedItems(prev => prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setSelectedItems(prev => [...prev, {
        id: product.id!,
        name: product.name,
        sku: product.barcode || product.sku || String(product.id || '').slice(0, 8),
        price: product.price,
        quantity: 1
      }]);
    }
  };

  const updateQuantity = (id: string, qty: number) => {
    if (qty <= 0) {
      setSelectedItems(prev => prev.filter(i => i.id !== id));
    } else {
      setSelectedItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
    }
  };

  return (
    <div className="w-full flex flex-col xl:flex-row gap-6 animate-in fade-in duration-500">
      
      {/* Kolom Kiri: Pengaturan & Input */}
      <div className="w-full xl:w-[450px] flex flex-col gap-6 shrink-0">

        <Tabs value={printMode} onValueChange={(v) => setPrintMode(v as any)} className="w-full">
          <TabsList className="grid grid-cols-2 w-full mb-6">
            <TabsTrigger value="barcode" className="font-bold flex gap-2"><Package className="w-4 h-4"/> Barcode</TabsTrigger>
            <TabsTrigger value="label" className="font-bold flex gap-2"><Tag className="w-4 h-4"/> Label Harga</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Pengaturan Kertas */}
        <Card className="p-4 bg-card/60 backdrop-blur border-border/50">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-foreground">
            <Settings className="w-4 h-4" /> Pengaturan Cetak
          </h3>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border border-border/50 hover:bg-accent/40 flex-1">
              <input 
                type="radio" 
                name="paper" 
                checked={paperSize === 'a4'} 
                onChange={() => setPaperSize('a4')} 
                className="accent-primary"
              />
              <span className="text-sm font-bold">Kertas A4 Grid</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border border-border/50 hover:bg-accent/40 flex-1">
              <input 
                type="radio" 
                name="paper" 
                checked={paperSize === 'thermal'} 
                onChange={() => setPaperSize('thermal')} 
                className="accent-primary"
              />
              <span className="text-sm font-bold">Thermal 58mm</span>
            </label>
          </div>
        </Card>

        {/* Input Kustom */}
        <Card className="p-4 bg-card/60 backdrop-blur border-border/50">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-foreground">
            <Plus className="w-4 h-4" /> Tambah Manual
          </h3>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nama Produk</Label>
              <Input 
                value={customName} 
                onChange={(e) => setCustomName(e.target.value)} 
                placeholder="Contoh: Kopi Susu" 
                className="h-9 mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Kode / SKU</Label>
                <Input 
                  value={customSku} 
                  onChange={(e) => setCustomSku(e.target.value)} 
                  placeholder="KOP-001" 
                  className="h-9 mt-1"
                />
              </div>
              {printMode === 'label' && (
                <div>
                  <Label className="text-xs">Harga</Label>
                  <Input 
                    type="number" 
                    value={customPrice} 
                    onChange={(e) => setCustomPrice(e.target.value)} 
                    placeholder="25000" 
                    className="h-9 mt-1"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-xs">Jumlah Cetak</Label>
                <Input 
                  type="number" 
                  min="1" 
                  value={customQuantity} 
                  onChange={(e) => setCustomQuantity(e.target.value)} 
                  className="h-9 mt-1"
                />
              </div>
              <Button onClick={addCustomItem} className="self-end h-9 font-bold">
                Tambah
              </Button>
            </div>
          </div>
        </Card>

        {/* Pilih dari Database */}
        <Card className="p-4 bg-card/60 backdrop-blur border-border/50 flex-1 flex flex-col min-h-[300px]">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-foreground">
            <Search className="w-4 h-4" /> Pilih dari Database
          </h3>
          <Input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama produk..." 
            className="h-9 mb-3"
          />
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
            {filteredProducts.map(p => (
              <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-background/50 hover:bg-accent/30 transition-colors">
                <div className="min-w-0 flex-1 mr-3">
                  <p className="text-sm font-bold truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate font-mono">{p.barcode || p.sku || '-'}</p>
                </div>
                <Button variant="outline" size="sm" className="shrink-0 h-7 text-xs font-bold" onClick={() => addProductToPrint(p)}>
                  + Pilih
                </Button>
              </div>
            ))}
          </div>
        </Card>

      </div>

      {/* Kolom Kanan: Pratinjau & Action */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">Pratinjau Kertas</h2>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setSelectedItems([])} className="font-bold" disabled={selectedItems.length === 0}>
              Kosongkan
            </Button>
            <Button onClick={handleUniversalPrint} className="font-bold shadow-lg" disabled={renderItems.length === 0 || printing}>
              {printing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />} Cetak
            </Button>
          </div>
        </div>
        
        {/* Daftar yang Dipilih (List) */}
        {selectedItems.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
            {selectedItems.map(item => (
              <div key={item.id} className="flex items-center bg-accent/40 border border-border/50 rounded-lg px-3 py-1.5 shrink-0 gap-3">
                <div className="min-w-0 max-w-[120px]">
                  <p className="text-xs font-bold truncate">{item.name}</p>
                </div>
                <div className="flex items-center gap-1.5 border-l border-border/50 pl-3">
                  <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-5 h-5 flex items-center justify-center bg-background rounded text-xs font-bold hover:bg-destructive hover:text-white">-</button>
                  <span className="text-xs font-bold w-6 text-center">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-5 h-5 flex items-center justify-center bg-background rounded text-xs font-bold hover:bg-primary hover:text-primary-foreground">+</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Kertas Print Area */}
        <div 
          ref={previewContainerRef} 
          className="flex-1 bg-slate-200 dark:bg-slate-800 rounded-2xl overflow-hidden border border-border/50 flex items-start justify-center p-8 overflow-y-auto relative min-h-[400px]"
        >
          {renderItems.length === 0 ? (
            <div className="m-auto text-center opacity-40">
              <Printer className="w-16 h-16 mx-auto mb-4" />
              <p className="text-lg font-bold">Belum ada item yang dipilih</p>
            </div>
          ) : (() => {
            const a4WidthPx = 794;
            const a4HeightPx = 1123;
            const thermalWidthPx = 220; // 58mm in px
            const paddingPx = 64; // padding p-8
            const availableWidth = containerWidth > paddingPx ? containerWidth - paddingPx : 300;
            const a4Scale = availableWidth < a4WidthPx ? (availableWidth / a4WidthPx) : 1;
            const thermalScale = availableWidth < thermalWidthPx ? (availableWidth / thermalWidthPx) : 1;

            return (
              <div 
                ref={printRef}
                className={cn(
                  "print-container flex flex-col items-center w-full bg-transparent"
                )}
              >
                {paperSize === 'a4' ? (
                  // Stacked A4 Pages Layout
                  chunkedA4Items.map((chunk, pageIdx) => (
                    <div
                      key={pageIdx}
                      className="scaling-wrapper print:w-[210mm] print:h-[297mm]"
                      style={{ 
                        width: `${a4WidthPx * a4Scale}px`, 
                        height: `${a4HeightPx * a4Scale}px`, 
                        overflow: 'hidden',
                        position: 'relative',
                        flexShrink: 0,
                        marginTop: pageIdx > 0 ? '1.5rem' : '0'
                      }}
                    >
                      <div
                        className={cn(
                          "a4-page a4-page-scaled bg-white shadow-xl w-[210mm] h-[297mm] min-w-[210mm] min-h-[297mm] max-w-[210mm] max-h-[297mm] p-[10mm] grid grid-cols-4 grid-rows-10 gap-x-[4mm] gap-y-[3mm] content-start overflow-hidden absolute top-0 left-0 border border-gray-300 origin-top-left"
                        )}
                        style={{
                          transform: `scale(${a4Scale})`,
                        }}
                      >
                        {chunk.map((item, i) => (
                          <div 
                            key={i} 
                            className="barcode-print-item flex flex-col items-center justify-center bg-white text-black overflow-hidden border border-dashed border-gray-300 w-full h-[25mm] p-1"
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textAlign: 'center',
                            }}
                          >
                            <p 
                              className="barcode-print-name text-[9px] font-bold text-center leading-tight truncate w-full px-1"
                              style={{
                                textAlign: 'center',
                              }}
                            >
                              {item.name}
                            </p>
                            
                            {printMode === 'barcode' ? (
                              <div 
                                className="barcode-print-wrapper mt-0.5 scale-[0.7] transform origin-top"
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Barcode 
                                  value={item.sku} 
                                  width={1.5} 
                                  height={30} 
                                  fontSize={12} 
                                  margin={0} 
                                  background="transparent" 
                                  lineColor="#000000"
                                  displayValue={true}
                                />
                              </div>
                            ) : (
                              <div 
                                className="label-print-details flex flex-col items-center justify-center flex-1 w-full"
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  textAlign: 'center',
                                }}
                              >
                                <p 
                                  className="label-print-price text-[14px] font-black tracking-tight"
                                  style={{
                                    textAlign: 'center',
                                  }}
                                >
                                  {FORMAT_IDR(item.price)}
                                </p>
                                <p 
                                  className="label-print-sku text-[7px] text-gray-500 font-mono mt-0.5"
                                  style={{
                                    textAlign: 'center',
                                  }}
                                >
                                  {item.sku}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  // Thermal Roll Layout (continuous single column)
                  <div
                    className="scaling-wrapper-thermal"
                    style={{
                      width: `${thermalWidthPx * thermalScale}px`,
                      overflow: 'hidden',
                      position: 'relative',
                      flexShrink: 0
                    }}
                  >
                    <div 
                      className="thermal-page bg-white shadow-xl w-[58mm] flex flex-col gap-2 p-2 shrink-0 origin-top-left"
                      style={{
                        transform: `scale(${thermalScale})`,
                      }}
                    >
                      {renderItems.map((item, i) => (
                        <div 
                          key={i} 
                          className="barcode-print-item flex flex-col items-center justify-center bg-white text-black overflow-hidden border border-dashed border-gray-300 w-full h-[30mm] p-1 shrink-0"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                          }}
                        >
                          <p 
                            className="barcode-print-name text-[9px] font-bold text-center leading-tight truncate w-full px-1"
                            style={{
                              textAlign: 'center',
                            }}
                          >
                            {item.name}
                          </p>
                          
                          {printMode === 'barcode' ? (
                            <div 
                              className="barcode-print-wrapper mt-0.5 scale-[0.7] transform origin-top"
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Barcode 
                                value={item.sku} 
                                width={1.5} 
                                height={30} 
                                fontSize={12} 
                                margin={0} 
                                background="transparent" 
                                lineColor="#000000"
                                displayValue={true}
                              />
                            </div>
                          ) : (
                            <div 
                              className="label-print-details flex flex-col items-center justify-center flex-1 w-full"
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                textAlign: 'center',
                              }}
                            >
                              <p 
                                className="label-print-price text-[14px] font-black tracking-tight"
                                style={{
                                  textAlign: 'center',
                                }}
                              >
                                {FORMAT_IDR(item.price)}
                              </p>
                              <p 
                                className="label-print-sku text-[7px] text-gray-500 font-mono mt-0.5"
                                style={{
                                  textAlign: 'center',
                                }}
                              >
                                {item.sku}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <style type="text/css" media="print">
                  {`
                    @page { size: ${paperSize === 'a4' ? 'A4' : '58mm auto'}; margin: 0; }
                    body { -webkit-print-color-adjust: exact; background: white !important; }
                    @media print {
                      .a4-page-scaled {
                        transform: none !important;
                        position: relative !important;
                        width: 210mm !important;
                        height: 297mm !important;
                        min-width: 210mm !important;
                        min-height: 297mm !important;
                        max-width: 210mm !important;
                        max-height: 297mm !important;
                      }
                      .thermal-page {
                        transform: none !important;
                        position: relative !important;
                        width: 58mm !important;
                      }
                      .scaling-wrapper {
                        width: 210mm !important;
                        height: 297mm !important;
                        overflow: visible !important;
                        margin-top: 0 !important;
                      }
                      .scaling-wrapper-thermal {
                        width: 58mm !important;
                        overflow: visible !important;
                      }
                      .print-container {
                        background: transparent !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                      }
                      .barcode-print-item {
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        justify-content: center !important;
                        text-align: center !important;
                        background-color: white !important;
                        color: black !important;
                        overflow: hidden !important;
                        border: 1px dashed #d1d5db !important;
                        width: 100% !important;
                        box-sizing: border-box !important;
                        padding: 4px !important;
                      }
                      .a4-page .barcode-print-item {
                        height: 25mm !important;
                      }
                      .thermal-page .barcode-print-item {
                        height: 30mm !important;
                      }
                      .barcode-print-name {
                        font-size: 9px !important;
                        font-weight: bold !important;
                        text-align: center !important;
                        line-height: 1.25 !important;
                        width: 100% !important;
                        margin: 0 0 2px 0 !important;
                        white-space: nowrap !important;
                        overflow: hidden !important;
                        text-overflow: ellipsis !important;
                        padding: 0 4px !important;
                        box-sizing: border-box !important;
                        display: block !important;
                      }
                      .barcode-print-wrapper {
                        margin-top: 2px !important;
                        transform: scale(0.7) !important;
                        transform-origin: top center !important;
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        justify-content: center !important;
                        width: 100% !important;
                      }
                      .barcode-print-wrapper svg {
                        margin: 0 auto !important;
                        display: block !important;
                      }
                      .label-print-details {
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        justify-content: center !important;
                        flex: 1 !important;
                        width: 100% !important;
                        text-align: center !important;
                      }
                      .label-print-price {
                        font-size: 14px !important;
                        font-weight: 900 !important;
                        letter-spacing: -0.025em !important;
                        margin: 0 !important;
                        text-align: center !important;
                        display: block !important;
                        width: 100% !important;
                      }
                      .label-print-sku {
                        font-size: 7px !important;
                        color: #6b7280 !important;
                        font-family: monospace !important;
                        margin: 2px 0 0 0 !important;
                        text-align: center !important;
                        display: block !important;
                        width: 100% !important;
                      }
                    }
                  `}
                </style>
              </div>
            );
          })()}
        </div>

      </div>
    </div>
  );
}
