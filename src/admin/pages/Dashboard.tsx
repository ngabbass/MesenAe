import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

// --- Icons ---
import { 
  ShoppingCart, 
  Package, 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  Receipt, 
  ChevronRight, 
  ClipboardList, 
  Clock, 
  QrCode, 
  Settings,
  ArrowUpRight,
  Sun,
  Sunrise,
  Sunset,
  Moon
} from 'lucide-react';

// --- Components & Hooks ---
import { useDbQuery, type TransactionItemRecord } from '@/hooks/db-hooks';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DashboardSkeleton } from '@/admin/components/SkeletonLoaders';
import { usePermissions, type UserPermissions } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';

// ============================================================================
// SUB-COMPONENT: ClockAndGreeting
// Isolated so that the 1-second setInterval ONLY re-renders this small widget,
// NOT the entire Dashboard with all its expensive useMemo calculations.
// ============================================================================
function ClockAndGreeting({ accountName }: { accountName: string }) {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer); // Cleanup on unmount (no memory leak)
  }, []);

  const greetingInfo = useMemo(() => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 11) return { text: 'Selamat Pagi', icon: Sunrise, color: 'text-amber-500' };
    if (hour >= 11 && hour < 15) return { text: 'Selamat Siang', icon: Sun, color: 'text-orange-500' };
    if (hour >= 15 && hour < 18) return { text: 'Selamat Sore', icon: Sunset, color: 'text-rose-500' };
    return { text: 'Selamat Malam', icon: Moon, color: 'text-indigo-400' };
  }, [currentTime]);

  return (
    <section className="flex items-center justify-between">
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 mb-0.5">
          <greetingInfo.icon className={`w-4 h-4 ${greetingInfo.color}`} />
          <h1 className="text-sm font-semibold text-muted-foreground">{greetingInfo.text},</h1>
        </div>
        <h2 className="text-xl font-bold text-foreground tracking-tight leading-none">{accountName}</h2>
      </div>

      <Card className="border border-slate-200 dark:border-zinc-800 shadow-sm bg-card w-fit hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
        <CardContent className="p-2.5 px-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-foreground tabular-nums tracking-tight leading-none flex items-baseline gap-1">
              {format(currentTime, 'HH:mm:ss')}
              <span className="text-[9px] font-bold text-muted-foreground uppercase">WIB</span>
            </p>
            <p className="text-[10px] text-muted-foreground font-medium mt-1 leading-none capitalize">
              {format(currentTime, 'EEEE, d MMM', { locale: id })}
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Transaction {
  id?: number;
  receiptNumber?: string;
  date: string | Date;
  status: 'lunas' | 'belum lunas' | string;
  total: number | string;
  profit: number | string;
  paymentMethodId?: number;
}

interface Product {
  id: number;
  name: string;
  stock: number;
  unit: string;
}

interface PaymentMethod {
  id: number;
  name: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const quickActions = [
  { 
    to: '/admin/cashier', icon: ShoppingCart, label: 'Kasir', 
    baseClass: 'text-primary bg-primary/10', 
    glowClass: 'group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-[0_0_12px_rgba(249,115,22,0.5)]' 
  },
  { 
    to: '/admin/orders', icon: ClipboardList, label: 'Pesanan', 
    baseClass: 'text-amber-500 bg-amber-500/10', 
    glowClass: 'group-hover:bg-amber-500 group-hover:text-white group-hover:shadow-[0_0_12px_rgba(245,158,11,0.5)]' 
  },
  { 
    to: '/admin/products', icon: Package, label: 'Produk', 
    baseClass: 'text-blue-500 bg-blue-500/10', 
    glowClass: 'group-hover:bg-blue-500 group-hover:text-white group-hover:shadow-[0_0_12px_rgba(59,130,246,0.5)]' 
  },
  { 
    to: '/admin/qris-dinamis', icon: QrCode, label: 'Konverter QRIS', 
    baseClass: 'text-emerald-500 bg-emerald-500/10', 
    glowClass: 'group-hover:bg-emerald-500 group-hover:text-white group-hover:shadow-[0_0_12px_rgba(16,185,129,0.5)]' 
  },
  { 
    to: '/admin/reports', icon: BarChart3, label: 'Laporan', 
    baseClass: 'text-indigo-500 bg-indigo-500/10', 
    glowClass: 'group-hover:bg-indigo-500 group-hover:text-white group-hover:shadow-[0_0_12px_rgba(99,102,241,0.5)]' 
  },
  { 
    to: '/admin/settings', icon: Settings, label: 'Setelan', 
    baseClass: 'text-slate-500 bg-slate-500/10', 
    glowClass: 'group-hover:bg-slate-600 group-hover:text-white group-hover:shadow-[0_0_12px_rgba(71,85,105,0.5)]' 
  },
];

export default function Dashboard() {
  const { canView } = usePermissions();
  const authData = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('admin_auth') || '{}');
    } catch {
      return {};
    }
  }, []);
  const accountName = authData.name || 'Admin';

  // (Clock & greeting state moved to <ClockAndGreeting> sub-component above)

  // --------------------------------------------------------------------------
  // DATA FETCHING
  // --------------------------------------------------------------------------
  const storeSettings = useDbQuery<any>('storeSettings')?.[0];

  const allTransactions = useDbQuery<Transaction>('transactions') || [];
  const allProducts = useDbQuery<Product>('products') || [];
  const allTxItems = useDbQuery<TransactionItemRecord>('transactionItems') || [];
  const paymentMethods = useDbQuery<PaymentMethod>('paymentMethods') || [];

  // --------------------------------------------------------------------------
  // DATA PROCESSING
  // --------------------------------------------------------------------------

  // O(1) payment name lookup — avoids .find() inside JSX render loop.
  const paymentMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const pm of paymentMethods) map.set(pm.id, pm.name);
    return map;
  }, [paymentMethods]);

  const todayTransactions = useMemo(() => {
    // Compute start-of-today INSIDE useMemo so it re-evaluates whenever
    // allTransactions changes. This prevents the stale-date bug where the app
    // stays open past midnight and "today" remains stuck on yesterday.
    const startOfTodayTs = (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.getTime(); // Compare numbers (faster than Date object comparisons)
    })();

    return allTransactions.filter(t =>
      new Date(t.date).getTime() >= startOfTodayTs && t.status === 'lunas'
    );
  }, [allTransactions]);

  const openBillsCount = useMemo(() => {
    return allTransactions.filter(t => t.status === 'belum lunas').length;
  }, [allTransactions]);

  const lowStockProducts = useMemo(() => {
    return allProducts.filter(p => p.stock <= 5);
  }, [allProducts]);

  const recentTransactions = useMemo(() => {
    return [...allTransactions]
      .filter(t => t.status === 'lunas')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [allTransactions]);

  const recentTxItems = useMemo(() => {
    if (!recentTransactions || recentTransactions.length === 0) return {};
    const txIds = recentTransactions.map(t => t.id!).filter(Boolean);
    const items = allTxItems.filter(i => txIds.includes(i.transactionId));
    
    const map: Record<number, TransactionItemRecord[]> = {};
    for (const item of items) {
      if (!map[item.transactionId]) map[item.transactionId] = [];
      map[item.transactionId].push(item);
    }
    return map;
  }, [recentTransactions, allTxItems]);

  const totalSales = useMemo(() => {
    return todayTransactions?.reduce((sum, t) => sum + (Number(t.total) || 0), 0) ?? 0;
  }, [todayTransactions]);

  const totalProfit = useMemo(() => {
    return todayTransactions?.reduce((sum, t) => sum + (Number(t.profit) || 0), 0) ?? 0;
  }, [todayTransactions]);

  const txCount = todayTransactions?.length ?? 0;

  const allowedQuickActions = useMemo(() => {
    const actionPermissionMap: Record<string, keyof UserPermissions> = {
      '/admin/cashier': 'cashier',
      '/admin/orders': 'activeOrders',
      '/admin/products': 'products',
      '/admin/qris-dinamis': 'dashboard',
      '/admin/reports': 'reports',
      '/admin/settings': 'settings',
    };

    return quickActions.filter(action => {
      const moduleName = actionPermissionMap[action.to];
      return moduleName ? canView(moduleName) : true;
    });
  }, [canView]);

  if (storeSettings === undefined) {
    return <DashboardSkeleton />;
  }

  // --------------------------------------------------------------------------
  // RENDER MAIN
  // --------------------------------------------------------------------------
  return (
    <div className="pt-2 pb-24 space-y-7 w-full max-w-7xl mx-auto overflow-hidden px-1 sm:px-2 animate-in fade-in duration-500">
      
      {/* =====================================================================
          SECTION 1: HEADER & WIDGET WAKTU
          Rendered by isolated sub-component — 1-second tick ONLY re-renders
          the clock widget, NOT the entire Dashboard tree.
          ================================================================= */}
      <ClockAndGreeting accountName={accountName} />

      {/* =====================================================================
          SECTION 2: KEY METRICS (STATS)
          ================================================================= */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4">
        
        {/* Card Penjualan */}
        <Card className="border-0 shadow-md bg-gradient-to-br from-primary to-primary/80 text-primary-foreground relative overflow-hidden hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute -left-4 -bottom-4 w-20 h-20 bg-black/5 rounded-full blur-xl"></div>
          
          <CardContent className="p-4 flex flex-col justify-between h-[110px] relative z-10">
            <div className="flex items-center gap-2 opacity-90">
              <div className="p-1 bg-white/20 rounded-md backdrop-blur-sm">
                <BarChart3 className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-xs font-medium">Penjualan Hari Ini</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black tracking-tight drop-shadow-sm">
                <span className="text-lg font-bold opacity-80 mr-1">Rp</span>
                {totalSales.toLocaleString('id-ID')}
              </p>
              <div className="flex items-center mt-1">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/20 text-white backdrop-blur-md uppercase tracking-wider">
                  {txCount} Transaksi
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Profit Bersih (Animasi lift & shadow netral, TANPA GLOW WARNA) */}
        <Card className="border border-slate-200 dark:border-zinc-800 shadow-md bg-card hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden">
          <CardContent className="p-4 flex flex-col justify-between h-[110px] relative z-10">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-primary/10 rounded-md">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
              </div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Profit Bersih</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                <span className="text-lg font-bold text-muted-foreground mr-1">Rp</span>
                {totalProfit.toLocaleString('id-ID')}
              </p>
              <p className="text-[10px] font-medium text-muted-foreground mt-1.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                Telah dipotong modal
              </p>
            </div>
          </CardContent>
        </Card>

      </section>

      {/* =====================================================================
          SECTION 3: ALERTS (OPEN BILLS)
          ================================================================= */}
      {openBillsCount != null && openBillsCount > 0 && (
        <section>
          <Link to="/admin/orders" className="block outline-none">
            <Card className="border border-warning/40 shadow-sm bg-gradient-to-r from-warning/10 via-warning/5 to-transparent hover:shadow-md transition-all duration-300 cursor-pointer group">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-warning/20 text-warning flex items-center justify-center shrink-0 relative">
                  <div className="absolute inset-0 rounded-xl border border-warning/30 animate-ping opacity-20"></div>
                  <ClipboardList className="w-5 h-5 relative z-10" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">Perhatian: Tagihan Aktif</p>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5">
                    Ada <span className="font-bold text-warning">{openBillsCount} pesanan</span> yang belum dilunasi.
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-background/50 border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-muted-foreground group-hover:bg-warning group-hover:text-warning-foreground group-hover:border-warning transition-all shadow-sm shrink-0">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </section>
      )}

      {/* =====================================================================
          SECTION 4: QUICK ACTIONS (MENU UTAMA)
          ================================================================= */}
      {allowedQuickActions.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="text-sm font-bold text-foreground tracking-tight">Akses Cepat</h2>
          </div>
          <div className={cn(
            "grid gap-3 sm:gap-4",
            allowedQuickActions.length === 1 && "grid-cols-1 sm:grid-cols-1 max-w-[140px]",
            allowedQuickActions.length === 2 && "grid-cols-2 sm:grid-cols-2 max-w-[280px]",
            allowedQuickActions.length === 3 && "grid-cols-3 sm:grid-cols-3 max-w-[420px]",
            allowedQuickActions.length === 4 && "grid-cols-2 sm:grid-cols-4 max-w-[560px]",
            allowedQuickActions.length === 5 && "grid-cols-3 sm:grid-cols-5 max-w-[700px]",
            allowedQuickActions.length >= 6 && "grid-cols-3 sm:grid-cols-6"
          )}>
            {allowedQuickActions.map(({ to, icon: Icon, label, baseClass, glowClass }) => (
              <Link key={to} to={to} className="group outline-none">
                <Card className="border border-slate-200 dark:border-zinc-800 shadow-sm bg-card h-full hover:shadow-md transition-shadow duration-300">
                  <CardContent className="p-3.5 flex flex-col items-center justify-center gap-3 text-center h-full">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-105 ${baseClass} ${glowClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold text-foreground/80 group-hover:text-foreground w-full truncate transition-colors">
                      {label}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* =====================================================================
          SECTION 5: RECENT TRANSACTIONS
          ================================================================= */}
      {recentTransactions && recentTransactions.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2 tracking-tight">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <Receipt className="w-4 h-4 text-primary" />
              </div>
              Transaksi Terakhir
            </h2>
            <Link to="/admin/history">
              <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-primary px-3 hover:bg-primary/10">
                Lihat Semua 
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>

          <div className="space-y-3">
            {recentTransactions.map((tx) => {
              const txId = tx.id ?? tx.receiptNumber;
              const items = recentTxItems?.[tx.id!] ?? [];
              const paymentMethodName = paymentMap.get(tx.paymentMethodId!) ?? 'Tunai';
              
              return (
                <Link key={txId} to={`/admin/history?txId=${txId}`} className="block outline-none group">
                  <Card className="group border border-border/60 shadow-sm bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer rounded-2xl active:scale-[0.99] overflow-hidden">
                    <CardContent className="p-4 flex items-center gap-4">
                      
                      {/* Ikon dengan efek hover bg transition */}
                      <div className="w-10 h-10 rounded-xl bg-primary/5 text-primary border border-primary/10 flex items-center justify-center shrink-0 transition-colors group-hover:bg-primary/10">
                        <Receipt className="w-4 h-4" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-[13px] font-bold text-foreground truncate mr-2">
                            {items.length > 0 
                              ? items.map(i => i.productName).join(', ') 
                              : `Invoice #${tx.receiptNumber || tx.id}`}
                          </p>
                          <p className="text-[10px] font-bold text-muted-foreground shrink-0 bg-muted px-2 py-0.5 rounded-full">
                            {format(new Date(tx.date), 'HH:mm')}
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-between mt-1.5">
                          <p className="text-sm font-black text-primary tracking-tight">
                            Rp {Number(tx.total).toLocaleString('id-ID')}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                              {paymentMethodName}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* =====================================================================
          SECTION 6: LOW STOCK ALERTS
          ================================================================= */}
      {lowStockProducts && lowStockProducts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3.5 mt-2">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2 tracking-tight">
              <div className="p-1.5 bg-destructive/10 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              Stok Menipis
            </h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {lowStockProducts.slice(0, 4).map((product) => (
              <Card key={product.id} className="border border-slate-200 dark:border-zinc-800 shadow-sm bg-card overflow-hidden relative hover:shadow-md transition-shadow">
                <div className="w-1.5 h-full bg-destructive absolute left-0 top-0"></div>
                <CardContent className="p-3.5 pl-5 flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground truncate mr-3" title={product.name}>
                    {product.name}
                  </span>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-[9px] font-bold text-destructive uppercase tracking-widest mb-0.5">Sisa</span>
                    <span className="text-[11px] font-black text-destructive bg-destructive/10 px-2 py-0.5 rounded border border-destructive/20">
                      {product.stock} {product.unit}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
