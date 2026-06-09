import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Printer,
  Bluetooth,
  Wifi,
  MonitorSmartphone,
  Trash2,
  CheckCircle2,
  Search,
  X,
  Volume2,
  Copy,
  HelpCircle,
  Settings2,
  RefreshCw,
  Plus,
  Sliders,
  AlertTriangle,
  Info,
  Cable,
  Tag
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface AppPrinter {
  id: string;
  role: 'Struk Pembelian' | 'Struk Dapur & Varian' | 'Label Harga & Barcode' | string;
  name: string;
  type: 'bluetooth' | 'wifi' | 'usb_otg' | 'system';
  address: string; // MAC for BT, IP for Wi-Fi/LAN, USB port or system name
  port?: string; // Port for Wi-Fi (default: 9100)
  paperSize: '58mm' | '80mm' | 'label_30x20' | 'label_40x30';
  copies: number; // 1, 2, 3
  buzzer: boolean; // Beep on print
}

const ROLES = [
  'Struk Pembelian',
  'Struk Dapur & Varian',
  'Label Harga & Barcode'
];

export default function PrinterSettings({ hasEditAccess = true }: { hasEditAccess?: boolean }) {
  const [printers, setPrinters] = useState<AppPrinter[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  
  // Modals & Dialogs
  const [scanOpen, setScanOpen] = useState(false);
  const [wifiOpen, setWifiOpen] = useState(false);
  const [usbOpen, setUsbOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  
  // Selection States
  const [selectedRole, setSelectedRole] = useState<string>('Struk Pembelian');
  const [editingPrinter, setEditingPrinter] = useState<AppPrinter | null>(null);

  // Inputs
  const [wifiIp, setWifiIp] = useState('');
  const [wifiPort, setWifiPort] = useState('9100');
  const [wifiName, setWifiName] = useState('Printer Jaringan Wi-Fi/LAN');

  const [usbName, setUsbName] = useState('Printer Direct USB OTG');
  const [usbPort, setUsbPort] = useState('USB001');

  // Load saved printers
  useEffect(() => {
    const saved = localStorage.getItem('mesenae_printers');
    if (saved) {
      try {
        setPrinters(JSON.parse(saved));
      } catch (e) {
        console.warn('Gagal parse saved printers:', e);
      }
    }
  }, []);

  const savePrinters = (newPrinters: AppPrinter[]) => {
    setPrinters(newPrinters);
    localStorage.setItem('mesenae_printers', JSON.stringify(newPrinters));
  };

  // Scanning Bluetooth Thermal Printer
  const scanBluetooth = async () => {
    if (!Capacitor.isNativePlatform()) {
      toast.error('Bluetooth Native hanya tersedia di perangkat Android/iOS');
      // Mock devices for web preview
      setDevices([
        { name: 'RPP02N Thermal Printer 58mm', address: '00:11:22:33:44:55' },
        { name: 'POS-80C Kitchen Printer 80mm', address: 'AA:BB:CC:DD:EE:FF' },
        { name: 'XP-365B Barcode & Label Printer', address: '12:34:56:78:9A:BC' }
      ]);
      setScanOpen(true);
      return;
    }
    
    setScanOpen(true);
    setIsScanning(true);
    setDevices([]);

    try {
      // @ts-ignore
      if (window.bluetoothSerial) {
        // Force disconnect any dangling bluetooth connection first
        // @ts-ignore
        window.bluetoothSerial.disconnect(() => {}, () => {});
        
        // Scan paired/discoverable devices
        // @ts-ignore
        window.bluetoothSerial.list((results: any[]) => {
          setDevices(results);
          setIsScanning(false);
        }, (err: any) => {
          toast.error('Gagal memindai printer Bluetooth: ' + err);
          setIsScanning(false);
        });
      } else {
        toast.error('Plugin Bluetooth Serial tidak terpasang di Capacitor.');
        setIsScanning(false);
      }
    } catch (e) {
      setIsScanning(false);
      console.error(e);
    }
  };

  // Add Wi-Fi / LAN Printer
  const addWifiPrinter = () => {
    if (!wifiIp.trim()) {
      toast.error('Alamat IP Printer wajib diisi.');
      return;
    }
    // Simple IP validator
    const ipPattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipPattern.test(wifiIp)) {
      toast.error('Format alamat IP tidak valid.');
      return;
    }

    const newPrinter: AppPrinter = {
      id: String(Date.now()),
      role: selectedRole,
      name: wifiName.trim() || 'Wi-Fi/LAN POS Printer',
      type: 'wifi',
      address: wifiIp.trim(),
      port: wifiPort.trim() || '9100',
      paperSize: selectedRole === 'Label Harga & Barcode' ? 'label_40x30' : '80mm',
      copies: 1,
      buzzer: selectedRole === 'Struk Dapur & Varian'
    };

    savePrinters([...printers.filter(p => p.role !== selectedRole), newPrinter]);
    toast.success(`Printer Wi-Fi/LAN ditugaskan ke ${selectedRole}`);
    setWifiOpen(false);
    // Reset inputs
    setWifiIp('');
    setWifiPort('9100');
    setWifiName('Printer Jaringan Wi-Fi/LAN');
  };

  // Add USB OTG Direct Printer
  const addUsbPrinter = () => {
    const newPrinter: AppPrinter = {
      id: String(Date.now()),
      role: selectedRole,
      name: usbName.trim() || 'USB OTG Printer',
      type: 'usb_otg',
      address: usbPort.trim() || 'USB001',
      paperSize: selectedRole === 'Label Harga & Barcode' ? 'label_40x30' : '58mm',
      copies: 1,
      buzzer: false
    };

    savePrinters([...printers.filter(p => p.role !== selectedRole), newPrinter]);
    toast.success(`Printer USB OTG ditugaskan ke ${selectedRole}`);
    setUsbOpen(false);
    // Reset inputs
    setUsbName('Printer Direct USB OTG');
    setUsbPort('USB001');
  };

  const connectAndSavePrinter = (device: any) => {
    const newPrinter: AppPrinter = {
      id: String(Date.now()),
      role: selectedRole,
      name: device.name || 'Unknown Bluetooth Printer',
      type: 'bluetooth',
      address: device.address || device.id,
      paperSize: selectedRole === 'Label Harga & Barcode' ? 'label_40x30' : '58mm',
      copies: 1,
      buzzer: selectedRole === 'Struk Dapur & Varian'
    };
    
    savePrinters([...printers.filter(p => p.role !== selectedRole), newPrinter]);
    toast.success(`Printer ${newPrinter.name} ditugaskan ke ${selectedRole}`);
    setScanOpen(false);
  };

  const removePrinter = (id: string) => {
    const p = printers.find(x => x.id === id);
    savePrinters(printers.filter(pr => pr.id !== id));
    if (p) toast.info(`Printer untuk rute ${p.role} telah dihapus.`);
  };

  const openPrinterConfig = (printer: AppPrinter) => {
    setEditingPrinter({ ...printer });
    setEditOpen(true);
  };

  const savePrinterConfig = () => {
    if (!editingPrinter) return;
    savePrinters(printers.map(p => p.id === editingPrinter.id ? editingPrinter : p));
    toast.success(`Pengaturan printer ${editingPrinter.role} disimpan.`);
    setEditOpen(false);
  };

  // Test Print: Generates a beautiful custom test invoice based on printer role
  const testPrint = async (printer: AppPrinter) => {
    toast.info(`Mengirim cetak uji coba ke ${printer.role}...`);
    
    // ESC/POS Command Lists
    const lines: (string | Uint8Array)[] = [];
    lines.push('\x1B\x40'); // Initialize printer

    if (printer.role === 'Struk Pembelian') {
      // 1. RECEIPT PRINTER TEST
      lines.push('\x1B\x61\x01'); // Center
      lines.push('\x1B\x45\x01'); // Bold ON
      lines.push('MESEN AE POS\n');
      lines.push('STRUK UJI COBA KASIR\n');
      lines.push('\x1B\x45\x00'); // Bold OFF
      lines.push('--------------------------------\n');
      lines.push('\x1B\x61\x00'); // Left
      lines.push(`No: TX-${Date.now().toString().slice(-6)}\n`);
      lines.push('Item: 1x Kopi Aren Latte   18.000\n');
      lines.push('Item: 1x Roti Bakar Coklat 15.000\n');
      lines.push('--------------------------------\n');
      lines.push('TOTAL:                     33.000\n');
      lines.push('Bayar:                     50.000\n');
      lines.push('Kembali:                   17.000\n');
      lines.push('--------------------------------\n');
      lines.push('\x1B\x61\x01'); // Center
      lines.push('[✓] KONEKSI PRINTER KASIR OK!\n');
    } else if (printer.role === 'Struk Dapur & Varian') {
      // 2. KITCHEN TICKET TEST
      lines.push('\x1B\x61\x01'); // Center
      lines.push('\x1B\x45\x01'); // Bold ON
      lines.push('*** TIKET DAPUR ***\n');
      lines.push('PESANAN MEJA: 05\n');
      lines.push('\x1B\x65\x02'); // Large text height
      lines.push('1x KOPI SUSU AREN\n');
      lines.push('\x1B\x65\x00'); // Normal text
      lines.push('\x1B\x45\x00'); // Bold OFF
      lines.push('  - Varian: ICE, Cup Large\n');
      lines.push('  - Gula: Sedikit (Less Sugar)\n');
      lines.push('  - Catatan: Kirim setelah roti\n');
      lines.push('--------------------------------\n');
      lines.push(`Order: #${Date.now().toString().slice(-4)}\n`);
      
      if (printer.buzzer) {
        lines.push('\x1B\x42\x02\x02'); // Beep buzzer 2 times
      }
    } else {
      // 3. BARCODE & LABEL PRINTER TEST
      lines.push('\x1B\x61\x01'); // Center
      lines.push('\x1B\x45\x01'); // Bold
      lines.push('LABEL BARCODE TEST\n');
      lines.push('\x1B\x45\x00'); // Normal
      lines.push('Kopi Susu Aren - Ice\n');
      lines.push('Rp 18.000\n');
      lines.push('SKU: KOP-AREN-005\n');
      lines.push('|| ||| |||| || ||| |||\n'); // Simulating barcode lines for text-based fallback
      lines.push('--------------------------------\n');
    }
    
    lines.push('\n\n\n\n'); // Feed line paper cut
    lines.push('\x1D\x56\x42\x00'); // Cut command

    // Encode text to byte stream
    const textEncoder = new TextEncoder();
    const chunkList: Uint8Array[] = [];
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

    if (printer.type === 'bluetooth') {
      if (!Capacitor.isNativePlatform()) {
        toast.success(`[Web Preview] Struk ${printer.role} terkirim ke emulator Bluetooth Mock.`);
        console.log(`[Mock Printer Print - BT Address: ${printer.address}]`, data);
        return;
      }
      
      // Native Bluetooth Print
      // @ts-ignore
      if (!window.bluetoothSerial) {
        toast.error('Plugin Bluetooth Serial tidak ditemukan.');
        return;
      }

      // @ts-ignore
      window.bluetoothSerial.disconnect(() => {}, () => {});

      setTimeout(() => {
        // @ts-ignore
        window.bluetoothSerial.connect(printer.address, () => {
          // @ts-ignore
          window.bluetoothSerial.write(data.buffer, () => {
            // @ts-ignore
            window.bluetoothSerial.disconnect();
            toast.success(`Uji coba cetak ${printer.role} berhasil!`);
          }, (err: any) => {
            // @ts-ignore
            window.bluetoothSerial.disconnect();
            toast.error('Gagal menulis data printer: ' + err);
          });
        }, (err: any) => {
          // @ts-ignore
          window.bluetoothSerial.disconnect();
          toast.error('Gagal terhubung ke printer. Pastikan bluetooth menyala.');
        });
      }, 150);
    } else if (printer.type === 'wifi') {
      toast.info(`Wi-Fi/LAN Print IP ${printer.address}:${printer.port || '9100'} dipicu. (Diperlukan printer ethernet/LAN).`);
    } else if (printer.type === 'usb_otg' || printer.type === 'system') {
      // System printing triggers Android OS print manager which handles standard USB printers beautifully via OTG cables!
      if (Capacitor.isNativePlatform()) {
        // @ts-ignore
        if (window.cordova && window.cordova.plugins && window.cordova.plugins.printer) {
          const htmlContent = `
            <div style="font-family: monospace; text-align: center; width: 58mm; padding: 5px; font-size: 10px;">
              <h3>MESEN AE POS</h3>
              <p><b>TES PRINTER DIRECT USB OTG</b></p>
              <hr style="border-top: 1px dashed black;" />
              <p style="text-align: left;">Rute: ${printer.role}</p>
              <p style="text-align: left;">Koneksi: USB OTG (${printer.address})</p>
              <hr style="border-top: 1px dashed black;" />
              <h3>[✓] KONEKSI SUKSES</h3>
            </div>
          `;
          // @ts-ignore
          window.cordova.plugins.printer.print(htmlContent, { name: 'MesenAe Test USB Print' }, () => {
            toast.success('Dialog Print USB OTG selesai.');
          });
        } else {
          toast.error('Plugin Printer System USB OTG tidak ditemukan.');
        }
      } else {
        window.print();
      }
    }
  };

  return (
    <div className="space-y-6">
      
      {!hasEditAccess && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 select-none">
          <span className="text-base shrink-0">🔒</span>
          <span><strong>Mode Lihat Saja:</strong> Anda tidak memiliki izin untuk mengelola konfigurasi printer.</span>
        </div>
      )}

      {/* Main Configuration Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Setup Printer Toggles */}
        <Card className="p-5 border-border/60 shadow-sm bg-card lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <h4 className="text-sm font-extrabold flex items-center gap-1.5"><Sliders className="w-4 h-4 text-primary" /> Rute Jalur Cetak POS</h4>
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Status Perangkat</span>
          </div>

          <div className="space-y-3">
            {ROLES.map(role => {
              const printer = printers.find(p => p.role === role);
              return (
                <div 
                  key={role} 
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all ${
                    printer 
                      ? 'bg-accent/20 border-primary/20 shadow-sm' 
                      : 'bg-muted/30 border-border/60 hover:bg-muted/50'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black tracking-wide text-foreground">{role}</span>
                      {printer && (
                        <Badge variant="secondary" className={`text-[9px] font-bold py-0 px-2 rounded-full capitalize ${
                          printer.type === 'bluetooth' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' : 
                          printer.type === 'wifi' ? 'bg-green-500/10 text-green-600 border-green-500/20' : 
                          'bg-purple-500/10 text-purple-600 border-purple-500/20'
                        }`}>
                          {printer.type === 'usb_otg' ? 'USB OTG' : printer.type}
                        </Badge>
                      )}
                    </div>
                    {printer ? (
                      <div className="space-y-0.5">
                        <p className="text-xs font-extrabold text-primary truncate">{printer.name}</p>
                        <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-2 flex-wrap">
                          <span>Koneksi: {printer.address}</span>
                          <span>•</span>
                          <span>Format: {
                            printer.paperSize === 'label_40x30' ? 'Label 40x30mm' :
                            printer.paperSize === 'label_30x20' ? 'Label 30x20mm' :
                            printer.paperSize
                          }</span>
                          <span>•</span>
                          <span>Salinan: {printer.copies}x</span>
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 animate-pulse" /> Printer belum ditentukan
                      </p>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3 sm:mt-0 shrink-0">
                    {printer ? (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-xs font-bold gap-1 rounded-lg shadow-sm border-border/60"
                          onClick={() => testPrint(printer)}
                        >
                          Tes Cetak
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-xs font-bold gap-1 rounded-lg border-border/60"
                          onClick={() => openPrinterConfig(printer)}
                        >
                          <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg"
                          onClick={() => removePrinter(printer.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <div className="flex gap-1.5 flex-wrap">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-[10px] font-bold h-8 rounded-lg border-border/60 bg-background/50 hover:bg-accent/40"
                          onClick={() => { setSelectedRole(role); scanBluetooth(); }}
                        >
                          <Bluetooth className="w-3 h-3 mr-1 text-blue-500" /> Bluetooth
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-[10px] font-bold h-8 rounded-lg border-border/60 bg-background/50 hover:bg-accent/40"
                          onClick={() => { setSelectedRole(role); setWifiOpen(true); }}
                        >
                          <Wifi className="w-3 h-3 mr-1 text-green-500" /> Wi-Fi/LAN
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-[10px] font-bold h-8 rounded-lg border-border/60 bg-background/50 hover:bg-accent/40"
                          onClick={() => { setSelectedRole(role); setUsbOpen(true); }}
                        >
                          <Cable className="w-3 h-3 mr-1 text-purple-500" /> USB OTG
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Right Side: Setup Wizard, Manual, Network Addition */}
        <div className="space-y-4">
          
          {/* Quick Connect Methods */}
          <Card className="p-5 border-border/60 shadow-sm bg-card space-y-3">
            <h4 className="text-xs font-black text-muted-foreground uppercase tracking-wider">Tambah Koneksi Printer</h4>
            <div className="grid grid-cols-1 gap-2.5">
              <Button 
                variant="outline" 
                className="w-full justify-start h-12 text-left bg-blue-50/40 hover:bg-blue-50 dark:bg-blue-950/10 dark:hover:bg-blue-950/20 border-blue-200/50 dark:border-blue-900/40"
                onClick={() => { setSelectedRole('Struk Pembelian'); scanBluetooth(); }}
              >
                <Bluetooth className="w-5 h-5 mr-3 text-blue-500 shrink-0" />
                <div>
                  <p className="text-xs font-extrabold text-foreground">Scan Bluetooth Termal</p>
                  <p className="text-[10px] text-muted-foreground">Hubungkan printer nirkabel (wireless)</p>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full justify-start h-12 text-left bg-green-50/40 hover:bg-green-50 dark:bg-green-950/10 dark:hover:bg-green-950/20 border-green-200/50 dark:border-green-900/40"
                onClick={() => { setSelectedRole('Struk Dapur & Varian'); setWifiOpen(true); }}
              >
                <Wifi className="w-5 h-5 mr-3 text-green-500 shrink-0" />
                <div>
                  <p className="text-xs font-extrabold text-foreground">Koneksikan Wi-Fi / IP LAN</p>
                  <p className="text-[10px] text-muted-foreground">Hubungkan printer router ethernet kabel</p>
                </div>
              </Button>

              <Button 
                variant="outline" 
                className="w-full justify-start h-12 text-left bg-purple-50/40 hover:bg-purple-50 dark:bg-purple-950/10 dark:hover:bg-purple-950/20 border-purple-200/50 dark:border-purple-900/40"
                onClick={() => { setSelectedRole('Label Harga & Barcode'); setUsbOpen(true); }}
              >
                <Cable className="w-5 h-5 mr-3 text-purple-500 shrink-0" />
                <div>
                  <p className="text-xs font-extrabold text-foreground">Kabel USB OTG Direct</p>
                  <p className="text-[10px] text-muted-foreground">Sambungkan tablet POS ke printer kabel USB</p>
                </div>
              </Button>
            </div>
          </Card>

          {/* Setup Guide Checklist */}
          <Card className="p-5 border-border/60 shadow-sm bg-card space-y-3">
            <h4 className="text-xs font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-primary" /> Integrasi Hardware POS Direct
            </h4>
            <div className="space-y-3 text-[11px] leading-relaxed font-semibold text-muted-foreground">
              <div className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-black text-primary">✓</span>
                <p>**Bluetooth**: Cocok untuk struk kasir portable. Sandingkan (pairing) printer bluetooth di pengaturan Android HP sebelum memindai.</p>
              </div>
              <div className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-black text-primary">✓</span>
                <p>**Wi-Fi / LAN**: Andal untuk bar/dapur jarak jauh. Masukkan alamat IP Statik printer dengan port standar 9100.</p>
              </div>
              <div className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-black text-primary">✓</span>
                <p>**USB OTG**: Hubungkan printer kabel via konektor USB OTG untuk mencetak langsung menggunakan Android Print Service.</p>
              </div>
            </div>
          </Card>

        </div>
      </div>

      {/* DIALOG 1: Bluetooth Scanning Modal */}
      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-primary animate-pulse" /> Cari Printer untuk "{selectedRole}"
            </DialogTitle>
          </DialogHeader>
          
          <div className="min-h-[200px] mt-4">
            {isScanning ? (
              <div className="flex flex-col items-center justify-center h-full space-y-4 text-muted-foreground pt-10">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-xs font-extrabold animate-pulse">Memindai printer bluetooth tersanding...</p>
              </div>
            ) : devices.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                <p className="text-[10px] text-muted-foreground font-bold mb-2">Pilih perangkat Bluetooth untuk rute "{selectedRole}":</p>
                {devices.map((dev, i) => (
                  <div 
                    key={i} 
                    className="flex items-center justify-between p-3 border border-border/60 rounded-xl hover:bg-accent/20 hover:border-primary/30 transition-all cursor-pointer"
                    onClick={() => connectAndSavePrinter(dev)}
                  >
                    <div>
                      <p className="text-xs font-extrabold text-foreground">{dev.name || 'Printer Bluetooth Tanpa Nama'}</p>
                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{dev.address || dev.id}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 rounded-lg font-black text-xs text-primary hover:bg-primary/10">
                      Pilih
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground pt-10 space-y-3">
                <X className="w-10 h-10 mx-auto text-destructive/60 opacity-60" />
                <p className="text-xs font-extrabold">Tidak Ada Printer Bluetooth Tersanding</p>
                <p className="text-[10px] max-w-[280px] mx-auto text-muted-foreground leading-relaxed">
                  Aktifkan bluetooth HP, lakukan pairing printer thermal Anda di menu pengaturan Android Bluetooth, lalu buka kembali menu scan ini.
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter className="mt-6">
            <Button variant="outline" className="w-full rounded-xl font-bold h-9 text-xs" onClick={() => setScanOpen(false)}>Batal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: Add Wi-Fi Printer Dialog */}
      <Dialog open={wifiOpen} onOpenChange={setWifiOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wifi className="w-5 h-5 text-green-500" /> Hubungkan Printer Wi-Fi/LAN
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Jalur Rute POS</Label>
              <div className="text-xs font-black p-2 bg-muted/50 rounded-lg border text-primary uppercase">{selectedRole}</div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Nama Printer</Label>
              <Input 
                value={wifiName}
                onChange={e => setWifiName(e.target.value)}
                placeholder="Misal: Printer Wi-Fi Dapur"
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Alamat IP (IP Address)</Label>
                <Input 
                  value={wifiIp}
                  onChange={e => setWifiIp(e.target.value)}
                  placeholder="192.168.1.100"
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Port</Label>
                <Input 
                  value={wifiPort}
                  onChange={e => setWifiPort(e.target.value)}
                  placeholder="9100"
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6 flex flex-row gap-2">
            <Button variant="outline" className="flex-1 rounded-xl h-9 text-xs font-bold" onClick={() => setWifiOpen(false)}>Batal</Button>
            <Button className="flex-1 rounded-xl h-9 text-xs font-bold" onClick={addWifiPrinter}>Simpan Printer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: Add USB OTG Printer Dialog */}
      <Dialog open={usbOpen} onOpenChange={setUsbOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cable className="w-5 h-5 text-purple-500" /> Hubungkan Kabel USB OTG Direct
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Jalur Rute POS</Label>
              <div className="text-xs font-black p-2 bg-muted/50 rounded-lg border text-primary uppercase">{selectedRole}</div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Nama Printer USB</Label>
              <Input 
                value={usbName}
                onChange={e => setUsbName(e.target.value)}
                placeholder="Misal: Printer Label USB"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Port USB (Direct)</Label>
              <Input 
                value={usbPort}
                onChange={e => setUsbPort(e.target.value)}
                placeholder="USB001"
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="text-[10px] text-muted-foreground border border-purple-500/20 bg-purple-500/5 rounded-lg p-2.5 leading-relaxed font-semibold">
              Sambungkan kabel printer USB ke tablet POS menggunakan konektor USB OTG. Printer USB akan diakses langsung melalui sistem Android Print Service. Pastikan perangkat Anda sudah mengenali koneksi USB.
            </div>
          </div>

          <DialogFooter className="mt-6 flex flex-row gap-2">
            <Button variant="outline" className="flex-1 rounded-xl h-9 text-xs font-bold" onClick={() => setUsbOpen(false)}>Batal</Button>
            <Button className="flex-1 rounded-xl h-9 text-xs font-bold" onClick={addUsbPrinter}>Simpan Printer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 4: Advanced Printer Configuration */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" /> Pengaturan Printer "{editingPrinter?.role}"
            </DialogTitle>
          </DialogHeader>

          {editingPrinter && (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Nama Perangkat</Label>
                <Input 
                  value={editingPrinter.name}
                  onChange={e => setEditingPrinter({ ...editingPrinter, name: e.target.value })}
                  className="h-9 text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">Format / Ukuran Kertas</Label>
                  <select 
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={editingPrinter.paperSize}
                    onChange={e => setEditingPrinter({ ...editingPrinter, paperSize: e.target.value as any })}
                  >
                    {editingPrinter.role === 'Label Harga & Barcode' ? (
                      <>
                        <option value="label_40x30">Label 40x30 mm</option>
                        <option value="label_30x20">Label 30x20 mm</option>
                        <option value="58mm">Thermal Roll 58mm</option>
                        <option value="80mm">Thermal Roll 80mm</option>
                      </>
                    ) : (
                      <>
                        <option value="58mm">Thermal Roll 58mm</option>
                        <option value="80mm">Thermal Roll 80mm</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">Jumlah Salinan Struk</Label>
                  <select 
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={editingPrinter.copies}
                    onChange={e => setEditingPrinter({ ...editingPrinter, copies: parseInt(e.target.value) })}
                  >
                    <option value={1}>1 Rangkap</option>
                    <option value={2}>2 Rangkap (Duplikat)</option>
                    <option value={3}>3 Rangkap (Triplikat)</option>
                  </select>
                </div>
              </div>

              {/* Buzzer Beep Alert Toggle */}
              {editingPrinter.role === 'Struk Dapur & Varian' && (
                <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/40 border-border/60">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-extrabold flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4 text-primary" /> Bunyi Bel / Buzzer
                    </Label>
                    <p className="text-[10px] text-muted-foreground font-medium max-w-[240px]">
                      Nyalakan alarm bel beeper pada printer thermal ketika mencetak struk tiket dapur.
                    </p>
                  </div>
                  <Switch 
                    checked={editingPrinter.buzzer}
                    onCheckedChange={checked => setEditingPrinter({ ...editingPrinter, buzzer: checked })}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-6 flex flex-row gap-2">
            <Button variant="outline" className="flex-1 rounded-xl h-9 text-xs font-bold" onClick={() => setEditOpen(false)}>Batal</Button>
            <Button className="flex-1 rounded-xl h-9 text-xs font-bold" onClick={savePrinterConfig}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
