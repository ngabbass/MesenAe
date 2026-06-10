import { useDbQuery } from '@/hooks/db-hooks';
import type { Expense } from '@/hooks/db-hooks';
import { useState, useMemo, useEffect } from 'react';
import { BarChart3, TrendingUp, ShoppingCart, Package, DollarSign, ArrowDown, ArrowUp, Minus, Plus, Share2, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { toast } from 'sonner';
import ReportShareModal from '@/admin/components/ReportShareModal';
import type { MesenAeReportData } from '@/admin/components/ReportPrint';
import { useSearchParams } from 'react-router-dom';
import StockReport from './StockReport';

export default function Laporan() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'stock' ? 'stock' : 'sales';

  const setActiveTab = (tab: 'sales' | 'stock') => {
    setSearchParams({ tab });
  };

  const [period, setPeriod] = useState<'7' | '30'>('7');
  const [shareOpen, setShareOpen] = useState(false);
  const days = Number(period);

  // Advanced Trend Chart States
  const [chartType, setChartType] = useState<'bar' | 'line'>('line');
  const [trendFilter, setTrendFilter] = useState<'all' | 'category' | 'product'>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  const storeSettings = useDbQuery<any>('storeSettings')?.[0];

  const allTransactionsResult = useDbQuery<any>('transactions');
  const allTxItemsResult = useDbQuery<any>('transactionItems');
  const categories = useDbQuery<any>('categories') || [];
  const products = useDbQuery<any>('products') || [];
  const allExpensesResult = useDbQuery<Expense>('expenses');
  const expenseCategoriesResult = useDbQuery<any>('expenseCategories');

  const allTransactions = useMemo(() => allTransactionsResult || [], [allTransactionsResult]);
  const allTxItems = useMemo(() => allTxItemsResult || [], [allTxItemsResult]);
  const allExpenses = useMemo(() => allExpensesResult || [], [allExpensesResult]);
  const expenseCategories = useMemo(() => expenseCategoriesResult || [], [expenseCategoriesResult]);

  const expCatMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of expenseCategories) {
      map[String(c.id)] = c.name;
    }
    return map;
  }, [expenseCategories]);

  // Dictionary mapping product ID to the product object for fast O(1) lookups
  const productMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const p of products) {
      map[String(p.id)] = p;
    }
    return map;
  }, [products]);

  // Sync initial select values
  useEffect(() => {
    if (categories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(String(categories[0].id));
    }
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(String(products[0].id));
    }
  }, [products, selectedProductId]);

  const transactions = useMemo(() => {
    const since = startOfDay(subDays(new Date(), days));
    return allTransactions.filter(t => t.status === 'lunas' && new Date(t.date) >= since);
  }, [allTransactions, days]);

  const allItems = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    const txIds = new Set(transactions.map(t => t.id));
    return allTxItems.filter((i: any) => txIds.has(i.transactionId));
  }, [transactions, allTxItems]);

  const txCount = transactions.length;

  const totalSales = useMemo(() => transactions.reduce((sum, t) => sum + (t.total || 0), 0), [transactions]);
  const totalProfit = useMemo(() => transactions.reduce((sum, t) => sum + (t.profit || 0), 0), [transactions]);
  const totalRevenue = useMemo(() => transactions.reduce((sum, t) => sum + (t.subtotal || 0), 0), [transactions]);
  const totalDiscount = useMemo(() => transactions.reduce((sum, t) => sum + (t.discountAmount || 0), 0), [transactions]);
  const totalTaxAmount = useMemo(() => transactions.reduce((sum, t) => sum + (t.taxAmount ?? t.tax_amount ?? 0), 0), [transactions]);
  const totalAdminFee = useMemo(() => transactions.reduce((sum, t) => {
    if (t.adminFee !== undefined || t.admin_fee !== undefined) {
      return sum + (t.adminFee ?? t.admin_fee ?? 0);
    }
    return sum + (t.taxAndService ?? t.tax_and_service ?? 0);
  }, 0), [transactions]);

  const netSales = totalSales;
  const grossProfit = totalProfit;
  const totalHpp = totalRevenue - totalDiscount - grossProfit;
  const marginPercent = useMemo(() => {
    if (netSales === 0) return 0;
    return (grossProfit / netSales) * 100;
  }, [grossProfit, netSales]);

  // Expenses for the same period
  const totalExpenses = useMemo(() => {
    const since = startOfDay(subDays(new Date(), days));
    return allExpenses
      .filter((e: Expense) => new Date(e.date) >= since)
      .reduce((sum: number, e: Expense) => sum + (e.amount || 0), 0);
  }, [allExpenses, days]);

  const netProfit = grossProfit - totalExpenses;

  const chartData = useMemo(() => {
    const data: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const dateStr = format(subDays(new Date(), i), 'dd MMM');
      data[dateStr] = 0;
    }

    for (const t of transactions) {
      const dateStr = format(new Date(t.date), 'dd MMM');
      if (!(dateStr in data)) continue;

      if (trendFilter === 'all') {
        data[dateStr] += (t.total || 0);
      } else {
        // Find items for this transaction
        const txItems = allTxItems.filter((item: any) => item.transactionId === t.id);
        let sum = 0;
        
        for (const item of txItems) {
          if (trendFilter === 'category' && selectedCategoryId) {
            const prod = productMap[String(item.productId)];
            if (prod && String(prod.categoryId) === String(selectedCategoryId)) {
              sum += (item.subtotal || 0);
            }
          } else if (trendFilter === 'product' && selectedProductId) {
            if (String(item.productId) === String(selectedProductId)) {
              sum += (item.subtotal || 0);
            }
          }
        }
        data[dateStr] += sum;
      }
    }

    return Object.entries(data).map(([date, sales]) => ({ date, sales }));
  }, [transactions, days, trendFilter, selectedCategoryId, selectedProductId, allTxItems, productMap]);

  const { topProducts, bottomProducts } = useMemo(() => {
    const map: Record<string, { name: string, qty: number, revenue: number, profit: number, stock: number }> = {};
    
    // Initialize map with all active products to capture 0 sales
    for (const p of products) {
      map[p.name] = {
        name: p.name,
        qty: 0,
        revenue: 0,
        profit: 0,
        stock: p.stock || 0
      };
    }

    // Add sales from allItems
    for (const i of allItems) {
      if (!map[i.productName]) {
        map[i.productName] = {
          name: i.productName,
          qty: 0,
          revenue: 0,
          profit: 0,
          stock: 0
        };
      }
      map[i.productName].qty += (i.quantity || 0);
      map[i.productName].revenue += (i.subtotal || 0);
      map[i.productName].profit += ((i.price - i.hpp) * i.quantity) || 0;
    }

    const allList = Object.values(map);

    const top = [...allList]
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const bottom = [...allList]
      .sort((a, b) => {
        if (a.qty !== b.qty) {
          return a.qty - b.qty;
        }
        return b.stock - a.stock;
      })
      .slice(0, 5);

    return { topProducts: top, bottomProducts: bottom };
  }, [allItems, products]);

  const rp = (v: number) => `Rp ${(Number(v) || 0).toLocaleString('id-ID')}`;

  const handleGenerateReport = async (startDateStr: string, endDateStr: string): Promise<MesenAeReportData> => {
    try {
      const start = startOfDay(new Date(startDateStr));
      const end = new Date(endDateStr);
      end.setHours(23, 59, 59, 999);

      const filteredTx = allTransactions.filter(t => {
        if (t.status !== 'lunas') return false;
        const d = new Date(t.date);
        return d >= start && d <= end;
      });

      const txIds = new Set(filteredTx.map(t => t.id));
      const filteredItems = allTxItems.filter((i: any) => txIds.has(i.transactionId));

      const txCount = filteredTx.length;
      const totalRevenue = filteredTx.reduce((sum, t) => sum + (t.subtotal || 0), 0);
      const totalDiscount = filteredTx.reduce((sum, t) => sum + (t.discountAmount || 0), 0);
      const netSales = filteredTx.reduce((sum, t) => sum + (t.total || 0), 0);
      const grossProfit = filteredTx.reduce((sum, t) => sum + (t.profit || 0), 0);
      const totalTaxAmount = filteredTx.reduce((sum, t) => sum + (t.taxAmount ?? t.tax_amount ?? 0), 0);
      const totalAdminFee = filteredTx.reduce((sum, t) => {
        if (t.adminFee !== undefined || t.admin_fee !== undefined) {
          return sum + (t.adminFee ?? t.admin_fee ?? 0);
        }
        return sum + (t.taxAndService ?? t.tax_and_service ?? 0);
      }, 0);
      const totalHpp = totalRevenue - totalDiscount - grossProfit;
      const marginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

      const reportProductMap: Record<string, { name: string, qty: number, revenue: number, profit: number, stock: number }> = {};
      for (const p of products) {
        reportProductMap[p.name] = {
          name: p.name,
          qty: 0,
          revenue: 0,
          profit: 0,
          stock: p.stock || 0
        };
      }

      for (const item of filteredItems) {
        if (!reportProductMap[item.productName]) {
          reportProductMap[item.productName] = {
            name: item.productName,
            qty: 0,
            revenue: 0,
            profit: 0,
            stock: 0
          };
        }
        reportProductMap[item.productName].qty += item.quantity || 0;
        reportProductMap[item.productName].revenue += item.subtotal || 0;
        reportProductMap[item.productName].profit += ((item.price - item.hpp) * item.quantity) || 0;
      }

      const reportProductList = Object.values(reportProductMap);

      const topProductsReport = [...reportProductList]
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

      const bottomProductsReport = [...reportProductList]
        .sort((a, b) => {
          if (a.qty !== b.qty) {
            return a.qty - b.qty;
          }
          return b.stock - a.stock;
        })
        .slice(0, 5);

      const soldProductMap: Record<string, { date: string, name: string, qty: number, revenue: number, profit: number, stock: number }> = {};
      for (const item of filteredItems) {
        const tx = filteredTx.find(t => t.id === item.transactionId);
        const dateStr = tx ? format(new Date(tx.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
        const key = `${dateStr}_${item.productName}`;

        if (!soldProductMap[key]) {
          const prod = products.find(p => String(p.id) === String(item.productId));
          soldProductMap[key] = {
            date: dateStr,
            name: item.productName,
            qty: 0,
            revenue: 0,
            profit: 0,
            stock: prod ? (prod.stock || 0) : 0
          };
        }
        soldProductMap[key].qty += item.quantity || 0;
        soldProductMap[key].revenue += item.subtotal || 0;
        soldProductMap[key].profit += ((item.price - item.hpp) * item.quantity) || 0;
      }

      const soldProductsReport = Object.values(soldProductMap)
        .filter(p => p.qty > 0)
        .sort((a, b) => {
          const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
          if (dateDiff !== 0) return dateDiff;
          return b.qty - a.qty;
        });

      const filteredExpenses = allExpenses.filter((e: Expense) => {
        const d = new Date(e.date);
        return d >= start && d <= end;
      });
      const totalExpensesReport = filteredExpenses.reduce((sum: number, e: Expense) => sum + (e.amount || 0), 0);
      const netProfitReport = grossProfit - totalExpensesReport;

      const chart: Record<string, { sales: number; expenses: number }> = {};
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      
      for (let i = 0; i <= diffDays; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        chart[format(d, 'dd/MM')] = { sales: 0, expenses: 0 };
      }
      for (const t of filteredTx) {
        const key = format(new Date(t.date), 'dd/MM');
        if (key in chart) {
          chart[key].sales += (t.total || 0);
        }
      }
      for (const e of filteredExpenses) {
        const key = format(new Date(e.date), 'dd/MM');
        if (key in chart) {
          chart[key].expenses += (e.amount || 0);
        }
      }

      const expensesListReport = filteredExpenses.map((e: Expense) => ({
        date: e.date,
        title: e.title || 'Pengeluaran',
        categoryName: expCatMap[String(e.categoryId)] || 'Umum',
        amount: e.amount || 0,
        notes: e.notes || '',
      }));

      return {
        storeName: storeSettings?.storeName ?? 'Toko Saya',
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        txCount,
        totalRevenue,
        totalDiscount,
        totalTaxAmount,
        totalAdminFee,
        netSales,
        totalHpp,
        grossProfit,
        marginPercent,
        totalExpenses: totalExpensesReport,
        netProfit: netProfitReport,
        expensesList: expensesListReport,
        topProducts: topProductsReport,
        bottomProducts: bottomProductsReport,
        soldProducts: soldProductsReport,
        chartData: Object.entries(chart).map(([date, val]) => ({ date, sales: val.sales, expenses: val.expenses })),
        themeHue: storeSettings?.themeColor ?? '217',
      };
    } catch (err) {
      toast.error('Gagal membuat laporan');
      throw err;
    }
  };

  return (
    <div className="mx-auto w-full space-y-4">
      {/* Premium Segmented Tab Control */}
      <div className="flex justify-center mt-2 px-1">
        <div className="flex bg-muted/85 dark:bg-zinc-900/80 p-1 rounded-xl border border-border/60 max-w-md w-full shadow-sm relative select-none">
          {/* Active Sliding Background Indicator */}
          <div 
            className={cn(
              "absolute top-1 bottom-1 rounded-lg bg-background shadow border border-border/40 transition-all duration-300 ease-out",
              activeTab === 'sales' ? "left-1 w-[calc(50%-4px)]" : "left-[calc(50%+2px)] w-[calc(50%-4px)]"
            )}
          />
          <button
            onClick={() => setActiveTab('sales')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-300 outline-none select-none relative z-10",
              activeTab === 'sales'
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Laporan Penjualan</span>
          </button>
          <button
            onClick={() => setActiveTab('stock')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-300 outline-none select-none relative z-10",
              activeTab === 'stock'
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Laporan Stok</span>
          </button>
        </div>
      </div>

      {activeTab === 'sales' ? (
        <div className="pt-2 pb-24 space-y-6 w-full animate-in fade-in duration-300">
        {/* Action Header */}
        <div className="flex items-center justify-between gap-4">
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
            Invoice Penjualan
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="border-0 shadow-sm col-span-3">
            <CardContent className="p-3 flex items-center justify-center gap-4">
              <div className="text-center flex-1">
                <ShoppingCart className="w-4 h-4 mx-auto text-primary mb-1" />
                <p className="text-lg font-bold">{txCount}</p>
                <p className="text-[10px] text-muted-foreground">Transaksi</p>
              </div>
              <div className="w-px h-10 bg-border/50" />
              <div className="text-center flex-1">
                <TrendingUp className="w-4 h-4 mx-auto text-success mb-1" />
                <p className="text-sm font-bold">{rp(totalSales)}</p>
                <p className="text-[10px] text-muted-foreground">Penjualan</p>
              </div>
              <div className="w-px h-10 bg-border/50" />
              <div className="text-center flex-1">
                <DollarSign className="w-4 h-4 mx-auto text-accent mb-1" />
                <p className="text-sm font-bold">{rp(netProfit)}</p>
                <p className="text-[10px] text-muted-foreground">Laba Bersih</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profit & Loss */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <DollarSign className="w-4 h-4" />
              Laba Rugi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <ArrowUp className="w-3.5 h-3.5 text-success" />
                <span>Pendapatan Kotor</span>
              </div>
              <span className="font-semibold">{rp(totalRevenue)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between items-center text-sm text-destructive">
                <div className="flex items-center gap-2">
                  <Minus className="w-3.5 h-3.5" />
                  <span>Diskon</span>
                </div>
                <span className="font-semibold">-{rp(totalDiscount)}</span>
              </div>
            )}
            {totalTaxAmount > 0 && (
              <div className="flex justify-between items-center text-sm text-blue-600 dark:text-blue-400">
                <div className="flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Pajak (PPN)</span>
                </div>
                <span className="font-semibold">+{rp(totalTaxAmount)}</span>
              </div>
            )}
            {totalAdminFee > 0 && (
              <div className="flex justify-between items-center text-sm text-blue-600 dark:text-blue-400">
                <div className="flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Biaya Admin</span>
                </div>
                <span className="font-semibold">+{rp(totalAdminFee)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-sm border-t pt-2">
              <span className="font-medium">Penjualan Bersih</span>
              <span className="font-bold">{rp(netSales)}</span>
            </div>
            <div className="flex justify-between items-center text-sm text-destructive">
              <div className="flex items-center gap-2">
                <ArrowDown className="w-3.5 h-3.5" />
                <span>HPP (Modal)</span>
              </div>
              <span className="font-semibold">-{rp(totalHpp)}</span>
            </div>
            <div className="flex justify-between items-center text-base border-t pt-2">
              <span className="font-bold">Laba Kotor</span>
              <span className={`font-bold ${grossProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                {rp(grossProfit)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm text-destructive">
              <div className="flex items-center gap-2">
                <ArrowDown className="w-3.5 h-3.5" />
                <span>Pengeluaran Operasional</span>
              </div>
              <span className="font-semibold">-{rp(totalExpenses)}</span>
            </div>
            <div className="flex justify-between items-center text-base border-t border-border pt-2 bg-primary/5 -mx-4 px-4 py-2 rounded-xl">
              <span className="font-black">Laba Bersih</span>
              <span className={`font-black text-lg ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                {rp(netProfit)}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Margin</span>
              <span className="font-semibold">{marginPercent.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Interactive Advanced Chart Center */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-extrabold flex items-center gap-1.5">
                  <TrendingUp className="w-4.5 h-4.5 text-primary" /> Analisis Tren Penjualan
                </CardTitle>
                <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">
                  Visualisasikan fluktuasi omzet berdasarkan kategori produk atau item tertentu.
                </p>
              </div>

              {/* Chart Type Selector */}
              <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/50 shrink-0 self-start sm:self-center">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={cn(
                    "h-7 text-[10px] font-bold px-2.5 rounded-md gap-1", 
                    chartType === 'line' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setChartType('line')}
                >
                  <TrendingUp className="w-3.5 h-3.5" /> Diagram Garis
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={cn(
                    "h-7 text-[10px] font-bold px-2.5 rounded-md gap-1", 
                    chartType === 'bar' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setChartType('bar')}
                >
                  <BarChart3 className="w-3.5 h-3.5" /> Diagram Batang
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pt-4 pb-4 space-y-4">
            
            {/* Trend Filter Row */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-3 bg-muted/20 border border-border/40 rounded-xl">
              {/* Type Filter */}
              <div className="flex items-center gap-2 shrink-0">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[11px] font-extrabold text-muted-foreground">Lihat Berdasarkan:</span>
                <div className="flex bg-muted/50 p-0.5 rounded-lg border border-border/60">
                  <button 
                    className={cn("px-2.5 py-1 text-[10px] font-bold rounded-md transition-all", trendFilter === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                    onClick={() => setTrendFilter('all')}
                  >
                    Semua
                  </button>
                  <button 
                    className={cn("px-2.5 py-1 text-[10px] font-bold rounded-md transition-all", trendFilter === 'category' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                    onClick={() => setTrendFilter('category')}
                  >
                    Kategori
                  </button>
                  <button 
                    className={cn("px-2.5 py-1 text-[10px] font-bold rounded-md transition-all", trendFilter === 'product' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                    onClick={() => setTrendFilter('product')}
                  >
                    Produk
                  </button>
                </div>
              </div>

              {/* Sub-selectors for Category/Product */}
              {trendFilter === 'category' && (
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <span className="text-[11px] font-bold text-muted-foreground shrink-0">Pilih Kategori:</span>
                  <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                    <SelectTrigger className="h-8 w-full md:w-44 text-[11px] font-bold">
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)} className="text-[11px] font-bold">
                          {c.icon} {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {trendFilter === 'product' && (
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <span className="text-[11px] font-bold text-muted-foreground shrink-0">Pilih Produk:</span>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger className="h-8 w-full md:w-56 text-[11px] font-bold">
                      <SelectValue placeholder="Pilih produk" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)} className="text-[11px] font-bold">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* The Responsive Chart Area */}
            <div className="w-full bg-background/50 border border-border/40 rounded-xl p-2.5 pt-4">
              <ResponsiveContainer width="100%" height={200}>
                {chartType === 'line' ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip 
                      formatter={(v: number) => [rp(v), 'Penjualan']} 
                      contentStyle={{ fontSize: 11, borderRadius: 10, fontWeight: 'bold', backgroundColor: 'rgba(var(--background), 0.8)', backdropFilter: 'blur(8px)', border: '1px solid hsl(var(--border))' }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="sales" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3} 
                      dot={{ r: 4, strokeWidth: 1 }}
                      activeDot={{ r: 6 }} 
                    />
                  </LineChart>
                ) : (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip 
                      formatter={(v: number) => [rp(v), 'Penjualan']} 
                      contentStyle={{ fontSize: 11, borderRadius: 10, fontWeight: 'bold', backgroundColor: 'rgba(var(--background), 0.8)', backdropFilter: 'blur(8px)', border: '1px solid hsl(var(--border))' }} 
                    />
                    <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
            
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top Products */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5 text-success">
                <Package className="w-4 h-4" />
                5 Produk Terlaris (Top Selling)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Belum ada data penjualan</p>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((p, i) => (
                    <div key={p.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 max-w-[60%]">
                        <span className="w-5 h-5 rounded-full bg-success/10 text-success text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold truncate">{p.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            Laba: <span className="font-semibold text-success">{rp(p.profit)}</span>
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <p className="text-xs font-bold text-foreground">{rp(p.revenue)}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                          <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-extrabold">{p.qty} terjual</span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded font-extrabold",
                            p.stock <= 5 
                              ? "bg-destructive/10 text-destructive" 
                              : "bg-muted text-muted-foreground"
                          )}>
                            Stok: {p.stock}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Least Popular Products */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5 text-destructive">
                <Package className="w-4 h-4" />
                5 Produk Kurang Diminati (Least Popular)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bottomProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Belum ada data produk</p>
              ) : (
                <div className="space-y-3">
                  {bottomProducts.map((p, i) => (
                    <div key={p.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 max-w-[60%]">
                        <span className="w-5 h-5 rounded-full bg-destructive/10 text-destructive text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold truncate">{p.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            Laba: <span className="font-semibold">{rp(p.profit)}</span>
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <p className="text-xs font-bold text-foreground">{rp(p.revenue)}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                          <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-extrabold">{p.qty} terjual</span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded font-extrabold",
                            p.stock <= 5 
                              ? "bg-destructive/10 text-destructive" 
                              : "bg-muted text-muted-foreground"
                          )}>
                            Stok: {p.stock}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <ReportShareModal
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          onGenerate={handleGenerateReport}
          storeName={storeSettings?.storeName ?? 'Toko Saya'}
        />
      </div>
      ) : (
        <StockReport />
      )}
    </div>
  );
}
