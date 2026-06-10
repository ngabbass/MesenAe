import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, MessageCircle, RotateCcw, Loader2, Share2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ReportWhatsAppModal from './ReportWhatsAppModal';
import ReportPrint from './ReportPrint';
import type { MesenAeReportData } from './ReportPrint';
import { printHtmlContent, universalPrint, printElementNative, printReportA4 } from '@/lib/print-helper';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReportShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Callback to generate report data for a given date range */
  onGenerate: (startDate: string, endDate: string) => Promise<MesenAeReportData>;
  storeName: string;
}

type RangeType = '7' | '30' | 'custom';

export default function ReportShareModal({ isOpen, onClose, onGenerate, storeName }: ReportShareModalProps) {
  const [rangeType, setRangeType] = useState<RangeType>('30');
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d;
  });
  const [endDate, setEndDate] = useState<Date>(() => new Date());
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<MesenAeReportData | null>(null);

  // WA modal
  const [waOpen, setWaOpen] = useState(false);
  const [waMessage, setWaMessage] = useState('');
  const [printing, setPrinting] = useState(false);

  if (!isOpen) return null;

  const applyPreset = (type: RangeType) => {
    const today = new Date();
    if (type === '7') {
      const d = new Date(today); d.setDate(d.getDate() - 7);
      setStartDate(d);
    } else if (type === '30') {
      const d = new Date(today); d.setDate(d.getDate() - 30);
      setStartDate(d);
    }
    setEndDate(today);
    setRangeType(type);
  };

  const handleGenerate = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      const data = await onGenerate(startStr, endStr);
      setReportData(data);
    } catch {
      // error handled by parent
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    const printElement = document.getElementById('mesenae-print-section');
    if (!printElement || !reportData) {
      toast.error('Data laporan belum siap');
      return;
    }
    
    setPrinting(true);
    try {
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      const docName = `Laporan_Keuangan_${startStr}_to_${endStr}`;
      
      const isNative = Capacitor.isNativePlatform();
      if (isNative) {
        // Kirim HTML murni untuk dokumen panjang (A4 landscape), bukan PNG
        await printReportA4('mesenae-print-section', docName);
      } else {
        // Di Web, cetak langsung raw HTML agar page-break dan margins normal
        const htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>${docName}</title>
              <style>
                #mesenae-print-section {
                  position: static !important;
                  width: 100% !important;
                  height: auto !important;
                  overflow: visible !important;
                  opacity: 1 !important;
                  visibility: visible !important;
                  display: block !important;
                  pointer-events: auto !important;
                }
              </style>
            </head>
            <body>
              ${printElement.outerHTML}
            </body>
          </html>
        `;

        const printed = await printHtmlContent(htmlContent, docName);
        if (!printed) {
          await universalPrint(htmlContent, docName);
        }
      }
    } catch (err: any) {
      console.error('Print report failed:', err);
      toast.error('Gagal mencetak laporan: ' + (err?.message || err));
    } finally {
      setPrinting(false);
    }
  };

  const buildWaMessage = (data: MesenAeReportData): string => {
    const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
    const fmtDate = (s: string) => new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const nb = '\u00A0'; // non-breaking space for alignment
    const pad = (text: string, len = 18) => text + nb.repeat(Math.max(0, len - text.length));

    const topSection = data.topProducts.length === 0
      ? 'Belum ada data penjualan.'
      : data.topProducts.map((p, i) =>
          `${i + 1}. *${p.name}*\n   Terjual: ${p.qty} unit | Sisa Stok: ${p.stock} pcs\n   Pendapatan: ${rp(p.revenue)} | Laba: *${rp(p.profit)}*`
        ).join('\n\n');

    const bottomSection = !data.bottomProducts || data.bottomProducts.length === 0
      ? 'Belum ada data produk kurang diminati.'
      : data.bottomProducts.map((p, i) =>
          `${i + 1}. *${p.name}*\n   Terjual: ${p.qty} unit | Sisa Stok: ${p.stock} pcs\n   Pendapatan: ${rp(p.revenue)} | Laba: *${rp(p.profit)}*`
        ).join('\n\n');

    const taxLine = data.totalTaxAmount !== undefined && data.totalTaxAmount > 0
      ? `\n• ${pad('Pajak (PPN)')} : ${rp(data.totalTaxAmount)}`
      : '';
    const adminLine = data.totalAdminFee !== undefined && data.totalAdminFee > 0
      ? `\n• ${pad('Biaya Admin')} : ${rp(data.totalAdminFee)}`
      : '';

    return `*LAPORAN ${data.storeName.toUpperCase()}*
Periode: ${fmtDate(data.startDate)} s/d ${fmtDate(data.endDate)}

━━━━━━━━━━━━━━━━━━━━━━━━
*RINGKASAN KEUANGAN*
━━━━━━━━━━━━━━━━━━━━━━━━
• ${pad('Jumlah Transaksi')} : ${data.txCount} transaksi
• ${pad('Pendapatan Kotor')} : ${rp(data.totalRevenue)}
• ${pad('Total Diskon')} : ${rp(data.totalDiscount)}${taxLine}${adminLine}
• ${pad('Penjualan Bersih')} : ${rp(data.netSales)}
• ${pad('HPP / Modal')} : ${rp(data.totalHpp)}
• ${pad('Laba Kotor')} : ${rp(data.grossProfit)}
• ${pad('Total Pengeluaran')} : ${rp(data.totalExpenses ?? 0)}
• ${pad('*Laba Bersih*', 18)} : *${rp(data.netProfit ?? data.grossProfit)}*
• ${pad('Margin')} : ${data.marginPercent.toFixed(1)}%

━━━━━━━━━━━━━━━━━━━━━━━━
*PRODUK TERLARIS*
━━━━━━━━━━━━━━━━━━━━━━━━
${topSection}

━━━━━━━━━━━━━━━━━━━━━━━━
*PRODUK KURANG DIMINATI*
━━━━━━━━━━━━━━━━━━━━━━━━
${bottomSection}

━━━━━━━━━━━━━━━━━━━━━━━━
_Dibuat: ${new Date().toLocaleString('id-ID')}_
_MesenAe — Aplikasi Kasir UMKM_`.trim();
  };

  const handleOpenWa = () => {
    if (!reportData) return;
    setWaMessage(buildWaMessage(reportData));
    setWaOpen(true);
  };

  const handleSendWa = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(waMessage)}`;
    window.open(url, '_blank');
    setWaOpen(false);
  };

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  const modalContent = (
    <>
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        {/* Modal */}
        <div className="relative w-full sm:max-w-[500px] max-h-[92dvh] bg-background rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b shrink-0 bg-primary">
            <div className="flex items-center gap-2.5">
              <Share2 className="w-5 h-5 text-white" />
              <h3 className="font-bold text-base text-white">Bagikan Laporan</h3>
            </div>
            <button onClick={onClose} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {!reportData ? (
              /* ── STEP 1: Pilih Periode ── */
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground mb-2 block">Periode Waktu</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['7', '30', 'custom'] as RangeType[]).map(type => (
                      <button
                        key={type}
                        onClick={() => type !== 'custom' ? applyPreset(type) : setRangeType('custom')}
                        className={`py-2.5 rounded-xl font-semibold text-sm transition-all border-2 ${
                          rangeType === type
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/40'
                        }`}
                      >
                        {type === '7' ? '7 Hari' : type === '30' ? '30 Hari' : 'Custom'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 flex flex-col items-center">
                  <Label className="text-xs font-semibold text-muted-foreground self-start mb-1">Rentang Tanggal</Label>
                  <div className="flex items-center justify-center gap-2 bg-muted/30 border border-border/50 p-2.5 rounded-2xl w-fit mx-auto">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-10 text-xs font-semibold gap-2 rounded-xl border-border/60 bg-background shadow-sm hover:bg-muted w-[140px] px-2.5 justify-start",
                            startDate && "border-primary/50 text-primary bg-primary/5"
                          )}
                        >
                          <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">
                            {startDate ? format(startDate, 'dd MMM yyyy', { locale: localeId }) : 'Pilih Tanggal'}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-xl z-[10000]" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={(date) => {
                            if (date) {
                              setStartDate(date);
                              setRangeType('custom');
                            }
                          }}
                          initialFocus
                          className="p-3"
                        />
                      </PopoverContent>
                    </Popover>

                    <span className="text-muted-foreground/50 font-bold text-xs">-</span>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-10 text-xs font-semibold gap-2 rounded-xl border-border/60 bg-background shadow-sm hover:bg-muted w-[140px] px-2.5 justify-start",
                            endDate && "border-primary/50 text-primary bg-primary/5"
                          )}
                        >
                          <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">
                            {endDate ? format(endDate, 'dd MMM yyyy', { locale: localeId }) : 'Pilih Tanggal'}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-xl z-[10000]" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={(date) => {
                            if (date) {
                              setEndDate(date);
                              setRangeType('custom');
                            }
                          }}
                          initialFocus
                          className="p-3"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <Button
                  className="w-full h-12 text-base font-semibold gap-2"
                  onClick={handleGenerate}
                  disabled={loading || !startDate || !endDate}
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</>
                  ) : (
                    <><FileText className="w-4 h-4" /> Buat Laporan</>
                  )}
                </Button>
              </div>
            ) : (
              /* ── STEP 2: Hasil & Aksi ── */
              <div className="space-y-4">
                {/* Period info + reset */}
                <div className="flex items-center justify-between bg-muted/50 rounded-xl px-4 py-3 border border-border/50">
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold">Periode Laporan</p>
                    <p className="text-sm font-bold mt-0.5">
                      {startDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} — {endDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs font-bold hover:bg-muted" onClick={() => setReportData(null)}>
                    <RotateCcw className="w-3.5 h-3.5" /> Atur Ulang
                  </Button>
                </div>

                <div className="space-y-3 pt-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Bagikan Laporan</p>

                  {/* PDF */}
                  <button
                    onClick={handlePrint}
                    disabled={printing}
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-primary/20 bg-primary/5 dark:bg-primary/10 hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
                      {printing ? (
                        <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" />
                      ) : (
                        <FileText className="w-5 h-5 text-primary-foreground" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-bold text-primary">
                        {printing ? 'Memproses Cetakan...' : 'Cetak / Simpan PDF'}
                      </p>
                      <p className="text-[11px] text-primary/70">
                        {printing ? 'Menghubungkan ke printer...' : 'Buka dialog cetak sistem'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-primary/50" />
                  </button>

                  {/* WhatsApp */}
                  <button
                    onClick={handleOpenWa}
                    disabled={printing}
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#25d366] flex items-center justify-center shrink-0">
                      <MessageCircle className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Kirim via WhatsApp</p>
                      <p className="text-[11px] text-emerald-500/80">Preview & edit pesan sebelum kirim</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-emerald-400" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WA Preview Modal */}
      <ReportWhatsAppModal
        isOpen={waOpen}
        message={waMessage}
        onClose={() => setWaOpen(false)}
        onSend={handleSendWa}
        onEdit={setWaMessage}
      />

      {/* Print Layout (hidden on screen, visible on print) */}
      {reportData && <ReportPrint data={reportData} />}
    </>
  );

  return createPortal(modalContent, document.body);
}
