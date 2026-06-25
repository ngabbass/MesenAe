import React, { useState } from 'react';
import { 
  Package, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  TrendingUp, 
  AlertTriangle, 
  Warehouse, 
  BarChart3,
  Layers,
  Activity,
  Share2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { id } from 'date-fns/locale';

import { useDbQuery } from '@/hooks/db-hooks';
import StockReportShareModal from '@/admin/components/StockReportShareModal';

const REASON_LABELS: Record<string, string> = {
  rusak: 'Rusak',
  hilang: 'Hilang',
  retur: 'Retur ke Supplier',
  kadaluarsa: 'Kadaluarsa',
  expired: 'Kadaluarsa',
  'pemakaian sendiri': 'Pemakaian Sendiri',
  lainnya: 'Lainnya',
};

export default function StockReport() {
  const [period, setPeriod] = useState<'7' | '30'>('7');
  const [shareOpen, setShareOpen] = useState(false);
  const days = Number(period);
  const since = startOfDay(subDays(new Date(), days));

  const storeSettings = useDbQuery<any>('storeSettings')?.[0];

  // Database Hooks
  const products = useDbQuery<any>('products') || [];
  const allStockIns = useDbQuery<any>('stockIns') || [];
  const allStockOuts = useDbQuery<any>('stockOuts') || [];
  
  const stockIns = allStockIns.filter(si => new Date(si.date) >= since);
  const stockOuts = allStockOuts.filter(so => new Date(so.date) >= since);

  // Perhitungan Ringkasan (Summary)
  const totalStockIn = stockIns.reduce((sum, si) => sum + si.quantity, 0);
  const totalStockInValue = stockIns.reduce((sum, si) => sum + (si.totalPrice || 0), 0);
  const totalStockOut = stockOuts.reduce((sum, so) => sum + so.quantity, 0);
  const currentStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);

  // Kategorisasi Kondisi Stok Produk
  const lowStockProducts = products.filter(p => p.stock > 0 && p.stock <= 5);
  const outOfStockProducts = products.filter(p => p.stock === 0);

  // Pengelompokan Stok Keluar Berdasarkan Alasan
  const stockOutByReason = stockOuts.reduce((acc, so) => {
    const reasonKey = so.reason ? so.reason.trim() : 'Lainnya';
    acc[reasonKey] = (acc[reasonKey] || 0) + so.quantity;
    return acc;
  }, {} as Record<string, number>);

  // Formatter Fungsi Label Alasan Dinamis
  const formatReasonLabel = (rawReason: string) => {
    const normalized = rawReason.toLowerCase();
    return REASON_LABELS[normalized] || rawReason;
  };

  // Penyusunan Data Grafik Bar (Aktivitas Harian)
  const chartData = (() => {
    const map: Record<string, { stockIn: number; stockOut: number }> = {};
    
    // Inisialisasi runtunan tanggal mundur
    for (let i = days - 1; i >= 0; i--) {
      const dateStr = format(subDays(new Date(), i), 'dd/MM');
      map[dateStr] = { stockIn: 0, stockOut: 0 };
    }

    stockIns.forEach(si => {
      const dateStr = format(new Date(si.date), 'dd/MM');
      if (map[dateStr]) map[dateStr].stockIn += si.quantity;
    });

    stockOuts.forEach(so => {
      const dateStr = format(new Date(so.date), 'dd/MM');
      if (map[dateStr]) map[dateStr].stockOut += so.quantity;
    });

    return Object.entries(map).map(([date, data]) => ({ date, ...data }));
  })();

  const formatRupiah = (value: number) => `Rp ${(Number(value) || 0).toLocaleString('id-ID')}`;

  const handleGenerateReport = async (startDate: string, endDate: string) => {
    const start = startOfDay(new Date(startDate));
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const filteredStockIns = allStockIns.filter(si => {
      const d = new Date(si.date); return d >= start && d <= end;
    });
    const filteredStockOuts = allStockOuts.filter(so => {
      const d = new Date(so.date); return d >= start && d <= end;
    });

    const totIn = filteredStockIns.reduce((sum, si) => sum + si.quantity, 0);
    const totInVal = filteredStockIns.reduce((sum, si) => sum + (si.totalPrice || 0), 0);
    const totOut = filteredStockOuts.reduce((sum, so) => sum + so.quantity, 0);
    const currStok = products.reduce((sum, p) => sum + (p.stock || 0), 0);

    const lowProd = products.filter(p => p.stock > 0 && p.stock <= 5);
    const outProd = products.filter(p => p.stock === 0);

    const reasonMap = filteredStockOuts.reduce((acc, so) => {
      const reasonKey = so.reason ? so.reason.trim() : 'Lainnya';
      acc[reasonKey] = (acc[reasonKey] || 0) + so.quantity;
      return acc;
    }, {} as Record<string, number>);

    const dayMap: Record<string, { stockIn: number; stockOut: number }> = {};
    const cursor = new Date(start);
    while (cursor <= end) {
      dayMap[format(cursor, 'dd/MM')] = { stockIn: 0, stockOut: 0 };
      cursor.setDate(cursor.getDate() + 1);
    }
    filteredStockIns.forEach(si => {
      const key = format(new Date(si.date), 'dd/MM');
      if (dayMap[key]) dayMap[key].stockIn += si.quantity;
    });
    filteredStockOuts.forEach(so => {
      const key = format(new Date(so.date), 'dd/MM');
      if (dayMap[key]) dayMap[key].stockOut += so.quantity;
    });
    const chart = Object.entries(dayMap).map(([date, data]) => ({ date, ...data }));

    return {
      storeName: storeSettings?.storeName ?? 'Toko Saya',
      startDate,
      endDate,
      totalStockIn: totIn,
      totalStockInValue: totInVal,
      totalStockOut: totOut,
      currentStock: currStok,
      stockOutByReason: reasonMap,
      lowStockProducts: lowProd,
      outOfStockProducts: outProd,
      chartData: chart,
      themeHue: storeSettings?.themeColor ?? '217'
    };
  };

  return (
    <div className="pt-2 pb-24 space-y-6 w-full animate-in fade-in duration-300">
      {/* Action Header */}
      <div className="flex justify-between items-center gap-4">
        {/* Pengatur Periode Waktu */}
        <Tabs value={period} onValueChange={v => setPeriod(v as '7' | '30')} className="w-[180px] sm:w-[200px]">
          <TabsList className="grid grid-cols-2 w-full rounded-xl bg-muted p-1">
            <TabsTrigger value="7" className="rounded-lg text-xs font-medium py-1.5">7 Hari</TabsTrigger>
            <TabsTrigger value="30" className="rounded-lg text-xs font-medium py-1.5">30 Hari</TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          size="sm"
          className="h-9 gap-1.5 shrink-0"
          onClick={() => setShareOpen(true)}
        >
          <Share2 className="w-4 h-4" />
          Invoice Stok
        </Button>
      </div>

      {/* Grid Widget Ringkasan Utama */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <ArrowDownToLine className="w-4 h-4 mx-auto text-success mb-1" />
            <p className="text-lg font-bold">{totalStockIn}</p>
            <p className="text-[10px] text-muted-foreground">Stok Masuk</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <ArrowUpFromLine className="w-4 h-4 mx-auto text-destructive mb-1" />
            <p className="text-lg font-bold">{totalStockOut}</p>
            <p className="text-[10px] text-muted-foreground">Stok Keluar</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <Package className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{currentStock}</p>
            <p className="text-[10px] text-muted-foreground">Tersedia</p>
          </CardContent>
        </Card>
      </div>

      {/* Valuasi Nilai Finansial Stok */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Nilai Belanja Stok Masuk
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <ArrowDownToLine className="w-3.5 h-3.5 text-success" />
              <span>Total Pengeluaran Stok Masuk</span>
            </div>
            <span className="font-semibold">{formatRupiah(totalStockInValue)}</span>
          </div>
          <div className="flex justify-between items-center text-sm border-t pt-2">
            <span className="font-medium">Total Barang Masuk</span>
            <span className="font-bold">{totalStockIn} Unit</span>
          </div>
          <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
            <span>Estimasi Rata-rata / Unit</span>
            <span className="font-semibold">
              {totalStockIn > 0 ? formatRupiah(Math.round(totalStockInValue / totalStockIn)) : formatRupiah(0)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Grafik Batang Pergerakan Logistik */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40">
          <div>
            <CardTitle className="text-sm font-extrabold flex items-center gap-1.5">
              <BarChart3 className="w-4.5 h-4.5 text-primary" /> Analisis Alur Barang
            </CardTitle>
            <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">
              Perbandingan komparatif volume aktivitas masuk dan keluar persediaan barang harian.
            </p>
          </div>
        </CardHeader>
        <CardContent className="pt-4 pb-4 space-y-4">
          <div className="w-full bg-background/50 border border-border/40 rounded-xl p-2.5 pt-4">
            <div className="w-full h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip 
                    formatter={(value: number, name: string) => [value, name === 'stockIn' ? 'Barang Masuk' : 'Barang Keluar']} 
                    contentStyle={{ 
                      fontSize: 11, 
                      borderRadius: 10, 
                      fontWeight: 'bold', 
                      backgroundColor: 'hsl(var(--card))', 
                      borderColor: 'hsl(var(--border))',
                      color: 'hsl(var(--foreground))'
                    }}
                    labelStyle={{ fontSize: 10, fontWeight: 'bold', marginBottom: 4, color: 'hsl(var(--muted-foreground))' }}
                  />
                  <Bar dataKey="stockIn" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={24} name="stockIn" />
                  <Bar dataKey="stockOut" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={24} name="stockOut" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center items-center gap-4 text-[10px] mt-2 font-extrabold text-muted-foreground">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Barang Masuk</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Barang Keluar</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2-Column Grid for Details & Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column: Alerts */}
        <div className="space-y-4">
          {/* Bagian Peringatan: Stok Menipis */}
          {lowStockProducts.length > 0 && (
            <Card className="border-0 shadow-sm bg-amber-500/10 text-amber-950 dark:text-amber-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  Stok Menipis ({lowStockProducts.length} SKU)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-1 divide-y divide-amber-200/20 dark:divide-amber-900/20">
                {lowStockProducts.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                    <span className="text-sm font-semibold truncate max-w-[200px] sm:max-w-xs text-amber-900 dark:text-amber-200">{p.name}</span>
                    <span className="text-xs font-bold bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-md">
                      Sisa: {p.stock}
                    </span>
                  </div>
                ))}
                {lowStockProducts.length > 5 && (
                  <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 text-center pt-2 font-medium">
                    +{lowStockProducts.length - 5} produk menipis lainnya
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Bagian Krisis: Stok Kosong */}
          {outOfStockProducts.length > 0 && (
            <Card className="border-0 shadow-sm bg-rose-500/10 text-rose-950 dark:text-rose-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <Layers className="w-4 h-4" />
                  Stok Habis / Kosong ({outOfStockProducts.length} SKU)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-1 divide-y divide-rose-200/20 dark:divide-rose-900/20">
                {outOfStockProducts.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                    <span className="text-sm font-semibold truncate max-w-[200px] sm:max-w-xs text-rose-900 dark:text-rose-200">{p.name}</span>
                    <span className="text-xs font-bold bg-rose-500/20 text-rose-700 dark:text-rose-400 px-2 py-0.5 rounded-md">
                      Kosong
                    </span>
                  </div>
                ))}
                {outOfStockProducts.length > 5 && (
                  <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 text-center pt-2 font-medium">
                    +{outOfStockProducts.length - 5} produk kosong lainnya
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {lowStockProducts.length === 0 && outOfStockProducts.length === 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-success">
                  <Package className="w-4 h-4" />
                  Status Persediaan
                </CardTitle>
              </CardHeader>
              <CardContent className="py-6 text-center">
                <p className="text-xs text-muted-foreground font-semibold">Semua stok produk dalam kondisi aman dan mencukupi.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Klasifikasi Penyebab Stok Keluar */}
        <div>
          <Card className="border-0 shadow-sm h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Activity className="w-4 h-4 text-rose-500" />
                Klasifikasi Penyebab Stok Keluar
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              {Object.keys(stockOutByReason).length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground font-semibold">
                  Tidak ada barang keluar di luar transaksi penjualan pada periode ini.
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {Object.entries(stockOutByReason).map(([reason, qty]) => (
                    <div key={reason} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                      <span className="text-sm font-semibold text-muted-foreground">{formatReasonLabel(reason)}</span>
                      <span className="text-sm font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-md">
                        {qty} Unit
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Share Modal */}
      <StockReportShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        onGenerate={handleGenerateReport as any}
        storeName={storeSettings?.storeName ?? 'Toko Saya'}
      />
    </div>
  );
}
