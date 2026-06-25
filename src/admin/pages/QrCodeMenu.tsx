import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { QrCode, Download, Printer, Copy, Plus, Trash2, LayoutGrid, Link2, Check, X, Edit2, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import { useDbQuery, dbInsert, dbUpdate } from '@/hooks/db-hooks';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { printHtmlContent, universalPrint } from '@/lib/print-helper';
import { cn, generateTableId } from '@/lib/utils';
import { TakeawayIcon } from '@/components/ui/TakeawayIcon';

// Transparent pixel untuk "melubangi" ruang di QR Code
const transparentPixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export default function QrCodeMenu() {
  const { canEdit } = usePermissions();
  const hasEditAccess = canEdit('marketing') || canEdit('tools') || canEdit('settings');
  const storeSettings = useDbQuery<any>('storeSettings')?.[0];
  
  const [tables, setTables] = useState<string[]>([]);
  const [activeTable, setActiveTable] = useState<string>('');
  
  // State untuk area
  const [newAreaName, setNewAreaName] = useState('');
  const [editingAreaName, setEditingAreaName] = useState<string | null>(null);
  const [editAreaInput, setEditAreaInput] = useState('');

  // State untuk input meja baru per area
  const [newTableInputs, setNewTableInputs] = useState<Record<string, string>>({});

  // State untuk mode edit nama meja
  const [isEditing, setIsEditing] = useState(false);
  const [editTableName, setEditTableName] = useState('');
  const [copied, setCopied] = useState(false);
  
  // State untuk konfirmasi hapus meja
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<string | null>(null);
  
  const qrRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Sync dengan Database
  useEffect(() => {
    if (!storeSettings) {
      setTables([]);
      return;
    }
    const existingTables = Array.isArray(storeSettings.tables) ? storeSettings.tables : [];
    setTables(existingTables);
    
    // Jika tidak ada meja aktif, set ke meja pertama atau default
    if (!activeTable) {
      if (existingTables.length > 0) setActiveTable(existingTables[0]);
      else setActiveTable('Bawa Pulang');
    }
  }, [storeSettings, activeTable]);

  // Ambil list area dari storeSettings.tableAreas. Jika belum ada, default.
  const areasList = useMemo(() => {
    if (storeSettings?.tableAreas && Array.isArray(storeSettings.tableAreas) && storeSettings.tableAreas.length > 0) {
      return storeSettings.tableAreas;
    }
    // Extract areas yang exist di tables saat ini
    const extractedAreas = new Set<string>();
    tables.forEach(t => {
      if (t !== 'Bawa Pulang') {
        if (t.includes(' - ')) {
          extractedAreas.add(t.split(' - ')[0]);
        } else {
          extractedAreas.add('Lantai 1');
        }
      }
    });
    if (extractedAreas.size === 0) {
      return ["Lantai 1", "Lantai 2", "Indoor", "Outdoor"];
    }
    return Array.from(extractedAreas);
  }, [storeSettings?.tableAreas, tables]);

  // Helper parser
  const parseTableString = (t: string) => {
    if (t === 'Bawa Pulang') {
      return { area: 'Sistem', displayName: 'Bawa Pulang' };
    }
    if (t.includes(' - ')) {
      const parts = t.split(' - ');
      return { area: parts[0], displayName: parts[1] };
    }
    const defaultArea = areasList[0] || 'Lantai 1';
    return { area: defaultArea, displayName: t };
  };

  const formatTableLabel = (t: string) => {
    const parsed = parseTableString(t);
    return /^\d+$/.test(parsed.displayName) ? `Meja ${parsed.displayName}` : parsed.displayName;
  };

  const getTablesInArea = (areaName: string) => {
    return tables.filter(t => {
      if (t === 'Bawa Pulang') return false;
      const parsed = parseTableString(t);
      return parsed.area === areaName;
    });
  };

  // Tambah Area Baru
  const handleAddArea = async () => {
    const cleanedArea = newAreaName.trim();
    if (!cleanedArea) {
      toast.error('Nama area tidak boleh kosong');
      return;
    }
    if (areasList.some(a => a.toLowerCase() === cleanedArea.toLowerCase())) {
      toast.error(`Area "${cleanedArea}" sudah ada`);
      return;
    }
    const updatedAreas = [...areasList, cleanedArea];
    try {
      if (storeSettings?.id) {
        await dbUpdate('storeSettings', storeSettings.id, { tableAreas: updatedAreas });
      } else {
        await dbInsert('storeSettings', {
          storeName: storeSettings?.storeName ?? 'Toko Saya',
          address: storeSettings?.address ?? '',
          phone: storeSettings?.phone ?? '',
          receiptFooter: storeSettings?.receiptFooter ?? 'Terima kasih atas kunjungan Anda!',
          onboardingDone: storeSettings?.onboardingDone ?? false,
          themeColor: storeSettings?.themeColor,
          logo: storeSettings?.logo,
          tableAreas: updatedAreas,
          tables: tables,
        });
      }
      setNewAreaName('');
      toast.success(`Area "${cleanedArea}" berhasil ditambahkan`);
    } catch (err: any) {
      toast.error('Gagal menambahkan area: ' + err.message);
    }
  };

  // Edit Nama Area
  const startEditingArea = (area: string) => {
    setEditingAreaName(area);
    setEditAreaInput(area);
  };

  const handleSaveAreaRename = async (oldAreaName: string) => {
    const cleaned = editAreaInput.trim();
    if (!cleaned) {
      toast.error('Nama area tidak boleh kosong');
      return;
    }
    if (cleaned.toLowerCase() === oldAreaName.toLowerCase()) {
      setEditingAreaName(null);
      return;
    }
    if (areasList.some(a => a.toLowerCase() === cleaned.toLowerCase())) {
      toast.error(`Area "${cleaned}" sudah ada`);
      return;
    }

    const updatedAreas = areasList.map(a => a === oldAreaName ? cleaned : a);

    // Update prefix semua meja di area ini
    const updatedTables = tables.map(t => {
      if (t.includes(' - ')) {
        const parts = t.split(' - ');
        if (parts[0] === oldAreaName) {
          return `${cleaned} - ${parts[1]}`;
        }
      } else if (oldAreaName === 'Lantai 1') {
        return `${cleaned} - ${t}`;
      }
      return t;
    });

    try {
      if (storeSettings?.id) {
        await dbUpdate('storeSettings', storeSettings.id, { 
          tableAreas: updatedAreas,
          tables: updatedTables
        });
      }
      setTables(updatedTables);
      
      if (activeTable.includes(' - ')) {
        const parts = activeTable.split(' - ');
        if (parts[0] === oldAreaName) {
          setActiveTable(`${cleaned} - ${parts[1]}`);
        }
      } else if (activeTable !== 'Bawa Pulang' && oldAreaName === 'Lantai 1') {
        setActiveTable(`${cleaned} - ${activeTable}`);
      }

      setEditingAreaName(null);
      toast.success(`Area "${oldAreaName}" diubah menjadi "${cleaned}"`);
    } catch (err: any) {
      toast.error('Gagal memperbarui area: ' + err.message);
    }
  };

  // Hapus Area (hanya jika kosong)
  const handleRemoveArea = async (areaToRemove: string) => {
    const tablesInArea = getTablesInArea(areaToRemove);
    if (tablesInArea.length > 0) {
      toast.error(`Gagal menghapus area: Masih ada ${tablesInArea.length} meja di area ini.`);
      return;
    }
    
    const updatedAreas = areasList.filter(a => a !== areaToRemove);
    try {
      if (storeSettings?.id) {
        await dbUpdate('storeSettings', storeSettings.id, { tableAreas: updatedAreas });
        toast.success(`Area "${areaToRemove}" berhasil dihapus`);
      }
    } catch (err: any) {
      toast.error('Gagal menghapus area: ' + err.message);
    }
  };

  // Tambah Meja Baru ke Area
  const handleAddTableToArea = async (area: string) => {
    const rawTable = newTableInputs[area] || '';
    const cleaned = rawTable.replace(/meja/gi, '').trim();
    if (!cleaned) {
      toast.error('Nomor/Nama meja tidak boleh kosong');
      return;
    }
    
    const fullTableString = `${area} - ${cleaned}`;
    
    if (tables.some(t => t.toLowerCase() === fullTableString.toLowerCase())) {
      toast.error(`Meja "${cleaned}" sudah terdaftar di area "${area}"`);
      return;
    }
    
    const updatedTables = [...tables, fullTableString];
    
    try {
      if (storeSettings?.id) {
        await dbUpdate('storeSettings', storeSettings.id, { tables: updatedTables });
      } else {
        await dbInsert('storeSettings', {
          storeName: storeSettings?.storeName ?? 'Toko Saya',
          address: storeSettings?.address ?? '',
          phone: storeSettings?.phone ?? '',
          receiptFooter: storeSettings?.receiptFooter ?? 'Terima kasih',
          onboardingDone: false,
          tables: updatedTables,
        });
      }
      setTables(updatedTables);
      setNewTableInputs(prev => ({ ...prev, [area]: '' }));
      setActiveTable(fullTableString);
      toast.success(`Meja "${cleaned}" ditambahkan ke area "${area}"`);
    } catch (error: any) {
      toast.error('Gagal menyimpan meja: ' + error.message);
    }
  };

  // Mode Edit Nama Meja
  const startEditing = () => {
    const parsed = parseTableString(activeTable);
    setEditTableName(parsed.displayName);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    const parsed = parseTableString(activeTable);
    const cleaned = editTableName.replace(/meja/gi, '').trim();
    if (!cleaned) {
      toast.error('Nama meja tidak boleh kosong');
      return;
    }
    
    const newFullString = parsed.area !== 'Sistem' ? `${parsed.area} - ${cleaned}` : cleaned;
    
    if (newFullString.toLowerCase() === 'bawa pulang') {
      toast.error('Gunakan nama meja lain.');
      return;
    }
    
    if (newFullString !== activeTable && tables.some(t => t.toLowerCase() === newFullString.toLowerCase())) {
      toast.error(`Meja "${cleaned}" sudah terdaftar di area "${parsed.area}"`);
      return;
    }

    const updatedTables = tables.map(t => (t === activeTable ? newFullString : t));
    
    try {
      if (storeSettings?.id) {
        await dbUpdate('storeSettings', storeSettings.id, { tables: updatedTables });
        setTables(updatedTables);
        setActiveTable(newFullString);
        setIsEditing(false);
        toast.success('Nama meja berhasil diperbarui');
      }
    } catch (error: any) {
      toast.error('Gagal memperbarui meja: ' + error.message);
    }
  };

  // Konfirmasi & Eksekusi Hapus Meja
  const confirmRemoveTable = (table: string) => {
    setTableToDelete(table);
    setDeleteConfirmOpen(true);
  };

  const handleRemoveTable = async () => {
    if (!tableToDelete) return;
    
    const updatedTables = tables.filter(t => t !== tableToDelete);
    try {
      if (storeSettings?.id) {
        await dbUpdate('storeSettings', storeSettings.id, { tables: updatedTables });
        toast.success(`Meja berhasil dihapus`);
        
        if (activeTable === tableToDelete) {
          setActiveTable(updatedTables.length > 0 ? updatedTables[0] : 'Bawa Pulang');
        }
      }
    } catch (error: any) {
      toast.error('Gagal menghapus meja: ' + error.message);
    } finally {
      setDeleteConfirmOpen(false);
      setTableToDelete(null);
    }
  };

  // URL Generator untuk QR Code
  const generatedUrl = useMemo(() => {
    let base = storeSettings?.customerUrl || '';
    
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (!base) {
      // Fallback pintar jika kosong
      base = isLocal ? 'http://localhost:8081' : 'https://mesenae-customer.vercel.app';
    } else {
      // Jika terisi URL admin lokal (port 8080)
      const isLocalAdmin = base.includes('localhost:8080') || base.includes('127.0.0.1:8080');
      if (isLocalAdmin) {
        base = base.replace(':8080', ':8081');
      }
    }
    
    if (base.endsWith('/')) base = base.slice(0, -1);
    if (!base.startsWith('http')) base = 'https://' + base;
    const tableId = generateTableId(activeTable || 'Bawa Pulang');
    return `${base}/?table=${tableId}`;
  }, [activeTable, storeSettings?.customerUrl]);

  // Copy Link to Clipboard
  const copyToClipboard = () => {
    if (!generatedUrl) {
      toast.error('Tautan pelanggan belum diatur di Pengaturan Toko');
      return;
    }
    navigator.clipboard.writeText(generatedUrl);
    toast.success('Tautan berhasil disalin ke clipboard');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Ekspor QR Code ke PNG
  const downloadQrCode = async () => {
    if (!generatedUrl) {
      toast.error('Tautan pelanggan belum diatur di Pengaturan Toko');
      return;
    }
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      // @ts-ignore
      const isNative = window.Capacitor && window.Capacitor.isNativePlatform();
      const pngFile = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: isNative ? 2 : 4,
        backgroundColor: '#ffffff',
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          margin: '0',
        }
      });
      
      const fileName = `QR_${activeTable.replace(/\s+/g, '_')}_${Date.now()}.png`;

      if (isNative) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const base64Data = pngFile.split(',')[1];
        
        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents
        });
        toast.success(`QR Code disimpan di folder Documents (${fileName})`);
      } else {
        const downloadLink = document.createElement('a');
        downloadLink.download = fileName;
        downloadLink.href = pngFile;
        downloadLink.click();
        toast.success('QR Code berhasil diunduh');
      }
    } catch {
      toast.error('Gagal mengunduh QR Code');
    } finally {
      setDownloading(false);
    }
  };

  // Print QR Code
  const printQrCode = async () => {
    if (!generatedUrl) {
      toast.error('Tautan pelanggan belum diatur di Pengaturan Toko');
      return;
    }
    if (!cardRef.current) return;
    setPrinting(true);
    try {
      // @ts-ignore
      const isNative = window.Capacitor && window.Capacitor.isNativePlatform();
      
      toast.info('Menyiapkan gambar QR Code untuk dicetak...');
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: isNative ? 2 : 4,
        backgroundColor: '#ffffff',
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          margin: '0',
        }
      });

      if (!dataUrl) {
        toast.error('Gagal menangkap gambar QR Code');
        setPrinting(false);
        return;
      }

      // Desain CSS Khusus agar Mutlak 1 Halaman dan Presisi
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Cetak QR Code - ${activeTable}</title>
            <style>
              @page {
                margin: 0;
              }
              html, body {
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100%;
                background: #ffffff;
                overflow: hidden; /* Mencegah halaman ekstra */
              }
              .print-wrap {
                width: 100vw;
                height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 8mm; /* Margin aman print mekanis */
                box-sizing: border-box;
              }
              img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain; /* Mengamankan proporsi tanpa stretch/crop */
                display: block;
              }
            </style>
          </head>
          <body>
            <div class="print-wrap">
              <img src="${dataUrl}" alt="QR Code" />
            </div>
          </body>
        </html>
      `;

      const printed = await printHtmlContent(htmlContent, `QR_Meja_${activeTable}`);
      if (!printed) {
        await universalPrint(htmlContent, `QR_Meja_${activeTable}`);
      }
    } catch (err: any) {
      console.error('Print QR Code failed:', err);
      toast.error('Gagal memproses cetak QR: ' + (err?.message || err));
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="pt-4 pb-24 w-full px-2 sm:px-4 mx-auto">
      {!hasEditAccess && (
        <div className="flex items-center gap-2.5 px-4 py-3 mb-6 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 select-none">
          <span className="text-base shrink-0">🔒</span>
          <span><strong>Mode Lihat Saja:</strong> Anda tidak memiliki izin untuk mengelola QR menu meja.</span>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        
        {/* Kolom Kiri: Manajemen Area & Meja */}
        <div className="lg:col-span-5 w-full flex flex-col gap-4">
          <div className="flex flex-col gap-2.5">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground ml-1">
              Kelola Area & Meja
            </h3>
            
            {hasEditAccess && (
              <div className="flex gap-1.5 w-full">
                <Input 
                  type="text"
                  placeholder="Tambah Area Baru (misal: VIP, Outdoor)..."
                  value={newAreaName}
                  onChange={e => setNewAreaName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddArea()}
                  className="h-8 text-xs rounded-lg bg-muted/30 focus-visible:bg-background border-border/70 shadow-none flex-1"
                />
                <Button 
                  onClick={handleAddArea} 
                  disabled={!newAreaName.trim()} 
                  className="h-8 px-3 font-semibold shadow-none rounded-lg shrink-0 transition-all active:scale-95 text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Tambah Area
                </Button>
              </div>
            )}
          </div>

          <Card 
            onClick={() => {
              setActiveTable('Bawa Pulang');
              setIsEditing(false);
            }}
            className={cn(
              "cursor-pointer transition-all border border-border/50 rounded-2xl shadow-sm",
              activeTable === 'Bawa Pulang' 
                ? "border-primary bg-primary/5 shadow-md shadow-primary/5" 
                : "hover:border-primary/40 hover:bg-muted/10 bg-card"
            )}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                  <TakeawayIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs">Bawa Pulang (Take Away)</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Order mandiri tanpa nomor meja</p>
                </div>
              </div>
              {activeTable === 'Bawa Pulang' && (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                  <Check className="w-3.5 h-3.5 font-bold" />
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {areasList.map(area => {
              const areaTables = getTablesInArea(area);
              return (
                <Card key={area} className="shadow-sm border-border/50 bg-card overflow-hidden rounded-2xl">
                  <CardHeader className="pb-3 border-b border-border/40 bg-muted/10 flex flex-row items-center justify-between space-y-0 py-3.5 px-4">
                    {editingAreaName === area ? (
                      <div className="flex items-center gap-1.5 flex-1 min-w-0 mr-2">
                        <Input
                          value={editAreaInput}
                          onChange={e => setEditAreaInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSaveAreaRename(area)}
                          className="h-8 text-xs font-semibold py-0"
                          autoFocus
                        />
                        <Button size="icon" className="h-8 w-8 shrink-0 bg-emerald-500 hover:bg-emerald-600" onClick={() => handleSaveAreaRename(area)}>
                          <Check className="w-3.5 h-3.5 text-white" />
                        </Button>
                        <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => setEditingAreaName(null)}>
                          <X className="w-3.5 h-3.5 text-slate-500" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 truncate">
                        <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-foreground truncate">
                          {area}
                        </CardTitle>
                        {hasEditAccess && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => startEditingArea(area)}>
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    )}
                    {hasEditAccess && areaTables.length === 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveArea(area)}
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
                        title="Hapus Area"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </CardHeader>
                  
                  <CardContent className="p-4 flex flex-col gap-3">
                    {areaTables.length === 0 ? (
                      <div className="py-4 text-center text-xs text-muted-foreground italic">
                        Belum ada meja di area ini
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {areaTables.map(t => {
                          const parsed = parseTableString(t);
                          const isActive = activeTable === t;
                          const label = formatTableLabel(t);
                          if (isActive && isEditing) {
                            return (
                              <div 
                                key={t}
                                className="col-span-2 sm:col-span-3 flex gap-1.5 items-center w-full"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Input 
                                  value={editTableName}
                                  onChange={(e) => setEditTableName(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                                  className="h-8 text-xs font-semibold py-0 flex-1 bg-background border-border/80 focus-visible:bg-background"
                                  autoFocus
                                />
                                <Button size="icon" className="h-8 w-8 shrink-0 bg-emerald-500 hover:bg-emerald-600 rounded-lg" onClick={handleSaveEdit}>
                                  <Check className="w-3.5 h-3.5 text-white" />
                                </Button>
                                <Button size="icon" variant="outline" className="h-8 w-8 shrink-0 rounded-lg" onClick={() => setIsEditing(false)}>
                                  <X className="w-3.5 h-3.5 text-slate-500" />
                                </Button>
                              </div>
                            );
                          }

                          return (
                            <div 
                              key={t}
                              className={cn(
                                "relative group flex items-center justify-between pl-3 pr-1 py-2 rounded-xl border text-[11px] font-bold transition-all cursor-pointer select-none min-w-0 gap-1",
                                isActive 
                                  ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                                  : "bg-background border-border/80 hover:border-primary/40 hover:bg-muted/10 text-foreground"
                              )}
                              onClick={() => {
                                setActiveTable(t);
                                setIsEditing(false);
                              }}
                            >
                              <span className="truncate pr-1">{label}</span>
                              {hasEditAccess && isActive && (
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEditing();
                                    }}
                                    className="h-5 w-5 rounded-lg flex items-center justify-center transition-colors text-primary-foreground hover:bg-white/10"
                                    title="Ubah Nama Meja"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      confirmRemoveTable(t);
                                    }}
                                    className="h-5 w-5 rounded-lg flex items-center justify-center transition-colors text-primary-foreground hover:bg-white/10"
                                    title="Hapus Meja"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {hasEditAccess && (
                      <div className="flex gap-1.5 mt-1 pt-3 border-t border-border/40">
                        <Input 
                          placeholder="No. Meja (misal: 5, VIP)..."
                          value={newTableInputs[area] || ''}
                          onChange={e => setNewTableInputs(prev => ({ ...prev, [area]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && handleAddTableToArea(area)}
                          className="h-8 text-xs rounded-lg bg-muted/30 focus-visible:bg-background border-border/70 shadow-none"
                        />
                        <Button 
                          size="sm"
                          onClick={() => handleAddTableToArea(area)}
                          className="h-8 w-8 shrink-0 rounded-lg p-0 font-bold"
                          disabled={!(newTableInputs[area] || '').trim()}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Kolom Kanan: Visual QR Code & Actions */}
        <div className="lg:col-span-7 flex flex-col w-full h-full">
          <Card className="shadow-sm border-border/50 w-full overflow-hidden bg-card text-card-foreground">
            <div className="bg-muted/10 px-4 sm:px-6 py-4 border-b border-border/40">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary" />
                Preview & Cetak QR Code
              </CardTitle>
            </div>
            
            <CardContent className="p-4 sm:p-8 flex flex-col items-center justify-center relative bg-muted/5 min-h-[400px] sm:min-h-[500px]">
              {!activeTable ? (
                <div className="text-center space-y-4 opacity-50 py-10">
                  <LayoutGrid className="w-16 h-16 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium">Belum ada meja yang dipilih</p>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center">
                  
                  {/* Container QR Card */}
                  <div className="w-full max-w-[360px] sm:max-w-[400px] mx-auto mb-8 sm:mb-10 transform transition-all hover:scale-[1.01] hover:shadow-2xl rounded-[36px]">
                    
                    {/* CARD REF - Diperbaiki class pembungkusnya untuk menghindari warp */}
                    <div 
                      ref={cardRef}
                      className="bg-white p-6 sm:p-10 rounded-[36px] shadow-xl shadow-black/5 relative flex flex-col items-center text-center"
                      style={{ 
                        width: '100%',
                        boxSizing: 'border-box',
                        border: '1px solid #f1f5f9'
                      }}
                    >
                      {/* Header Logo / Teks Toko */}
                      <div className="w-full mb-7 sm:mb-9">
                        <h4 className="font-extrabold text-slate-900 uppercase tracking-[0.15em] text-lg sm:text-xl mb-1.5 leading-tight px-2 whitespace-nowrap overflow-hidden text-ellipsis">
                          {storeSettings?.storeName || 'Toko Kami'}
                        </h4>
                        <p className="text-[13px] sm:text-sm text-slate-500 font-semibold tracking-wide whitespace-nowrap">
                          Scan QR Code untuk memesan
                        </p>
                      </div>

                      {/* Komponen Inti QR Code */}
                      <div 
                        ref={qrRef} 
                        className="bg-white p-4 sm:p-5 rounded-[28px] sm:rounded-[32px] border-2 border-slate-100/80 shadow-sm inline-flex relative justify-center items-center"
                      >
                        {generatedUrl ? (
                          <>
                            <QRCodeSVG 
                              value={generatedUrl} 
                              size={220} 
                              className="w-[200px] h-[200px] sm:w-[240px] sm:h-[240px]"
                              level={"H"} 
                              includeMargin={false}
                              imageSettings={{
                                src: transparentPixel,
                                height: 48,
                                width: 48,
                                excavate: true,
                              }}
                            />
                            
                            {/* Overlay Logo Toko Tengah */}
                            <div 
                              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white flex items-center justify-center shadow-md border border-slate-100"
                              style={{
                                width: '72px',
                                height: '72px',
                                borderRadius: '22px',
                              }}
                            >
                              <img 
                                src={storeSettings?.logo || '/logo.png'} 
                                alt="Logo" 
                                style={{
                                  width: '56px', 
                                  height: '56px',
                                  borderRadius: '14px',
                                  objectFit: 'cover'
                                }}
                                crossOrigin="anonymous" 
                              />
                            </div>
                          </>
                        ) : (
                          <div className="w-[200px] h-[200px] sm:w-[240px] sm:h-[240px] flex flex-col items-center justify-center text-slate-400 p-4 text-xs font-bold text-center leading-relaxed">
                            Tautan pelanggan belum diatur di Pengaturan Toko
                          </div>
                        )}
                      </div>
                      
                      {/* Label Meja Bawah */}
                      <div className="mt-8 sm:mt-10 w-full flex flex-col items-center gap-2">
                        <div className="flex flex-col items-center gap-2 max-w-[90%]">
                          {/* Area Box */}
                          {(() => {
                            const parsed = parseTableString(activeTable);
                            return parsed.area !== 'Sistem' ? (
                              <div className="bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-black px-2.5 py-1 rounded-lg leading-none uppercase shadow-sm whitespace-nowrap">
                                {parsed.area}
                              </div>
                            ) : null;
                          })()}
                          
                          {/* Table Box */}
                          <div className="flex items-center gap-2">
                            <div className="inline-flex items-center justify-center bg-slate-900 text-white font-black px-6 sm:px-8 py-3.5 rounded-2xl text-xl sm:text-2xl tracking-wider shadow-lg shadow-slate-900/20 leading-none whitespace-nowrap">
                              <span>
                                {(() => {
                                  const parsed = parseTableString(activeTable);
                                  return /^\d+$/.test(parsed.displayName) ? `Meja ${parsed.displayName}` : parsed.displayName;
                                })()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <p className="text-[10px] sm:text-[11px] text-slate-400 mt-2 font-bold tracking-[0.2em] uppercase whitespace-nowrap">
                          Powered By MesenAe
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Area Tombol Aksi QR Code */}
                  <div className="w-full max-w-[400px] space-y-4 px-2 sm:px-0">
                    
                    {/* Link Bar */}
                    <div className="flex gap-2 p-1.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner items-center pr-2 w-full">
                      <div className="bg-slate-200/50 dark:bg-slate-800 text-slate-500 p-2.5 rounded-xl shrink-0 ml-1">
                        <Link2 className="w-4 h-4" />
                      </div>
                      <input 
                        readOnly 
                        value={generatedUrl} 
                        className="font-mono text-[11px] sm:text-xs h-9 border-0 bg-transparent focus:outline-none focus-visible:ring-0 flex-1 min-w-0 truncate px-1 text-slate-600 dark:text-slate-300 font-medium select-all" 
                      />
                      <Button 
                        variant="ghost" 
                        onClick={copyToClipboard} 
                        className={cn(
                          "shrink-0 h-9 w-9 p-0 rounded-xl font-bold shadow-sm transition-all duration-200 border",
                          copied 
                            ? "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500" 
                            : "bg-white dark:bg-slate-800 hover:bg-primary hover:text-primary-foreground border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                        )}
                        title="Salin Tautan"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <Button 
                        onClick={downloadQrCode} 
                        disabled={downloading || printing}
                        className="w-full gap-2 font-bold h-14 sm:h-12 rounded-2xl text-[14px] sm:text-[15px] shadow-sm hover:shadow-md transition-all bg-primary/90 hover:bg-primary"
                      >
                        {downloading ? <Loader2 className="w-[18px] h-[18px] mb-0.5 animate-spin" /> : <Download className="w-[18px] h-[18px] mb-0.5" />}
                        Simpan PNG
                      </Button>
                      <Button 
                        onClick={printQrCode} 
                        variant="outline" 
                        disabled={downloading || printing}
                        className="w-full gap-2 font-bold h-14 sm:h-12 rounded-2xl text-[14px] sm:text-[15px] shadow-sm border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all text-foreground disabled:opacity-60"
                      >
                        {printing ? <Loader2 className="w-[18px] h-[18px] mb-0.5 animate-spin" /> : <Printer className="w-[18px] h-[18px] mb-0.5" />}
                        Cetak Meja
                      </Button>
                    </div>

                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Dialog Konfirmasi Hapus Modal */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-[400px] w-[95vw] rounded-[28px] p-6 sm:p-8">
          <AlertDialogHeader>
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4 mx-auto ring-8 ring-red-50 dark:ring-red-950">
              <Trash2 className="w-8 h-8 text-red-600 dark:text-red-500" />
            </div>
            <AlertDialogTitle className="text-center text-xl sm:text-2xl font-black text-foreground">
              Hapus Meja Ini?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-base mt-2 text-muted-foreground leading-relaxed">
              Tindakan ini tidak bisa dibatalkan. QR Code untuk meja <strong className="text-foreground">{formatTableLabel(tableToDelete || '')}</strong> tidak akan valid lagi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 sm:justify-center flex-row gap-3 sm:gap-4 w-full">
            <AlertDialogCancel className="flex-1 mt-0 rounded-xl h-12 sm:h-14 font-bold text-foreground border-2 border-border/50 hover:bg-muted/50 text-[15px] transition-all">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemoveTable} 
              className="flex-1 mt-0 rounded-xl h-12 sm:h-14 font-bold bg-red-600 hover:bg-red-700 text-white text-[15px] shadow-lg shadow-red-500/25 transition-all"
            >
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
