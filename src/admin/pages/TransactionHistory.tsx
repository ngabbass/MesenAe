import { useDbQuery, dbUpdate, dbDelete, usePaginatedTransactions } from '@/hooks/db-hooks';
import { type Transaction, type TransactionItemRecord } from '@/hooks/db-hooks';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ArrowLeft, Search, Receipt as ReceiptIcon, Calendar, ChevronRight, ShoppingBag, CalendarIcon, X, Trash2, ShoppingCart, TrendingUp, Filter, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn, formatReceiptTable } from '@/lib/utils';
import ReceiptDialog from '@/components/Receipt';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';

export default function TransactionHistory() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { canEdit } = usePermissions();
  const hasEditAccess = canEdit('history');

  const [search, setSearch] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [restoreStock, setRestoreStock] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'lunas' | 'belum lunas'>('all');

  const { data: transactionsData, loading: txLoading, hasMore: txHasMore, loadMore: txLoadMore } = usePaginatedTransactions(20);
  const transactions = useMemo(() => transactionsData || [], [transactionsData]);
  
  const productsResult = useDbQuery<any>('products');
  const products = useMemo(() => productsResult || [], [productsResult]);

  const allTxItemsResult = useDbQuery<any>('transactionItems');
  const allTxItems = useMemo(() => allTxItemsResult || [], [allTxItemsResult]);

  const txItemsMap = useMemo(() => {
    const map: Record<number, TransactionItemRecord[]> = {};
    for (const item of allTxItems) {
      if (!map[item.transactionId]) map[item.transactionId] = [];
      map[item.transactionId].push(item);
    }
    return map;
  }, [allTxItems]);

  const getTxItems = useCallback((txId: number | undefined): TransactionItemRecord[] =>
    txId ? (txItemsMap?.[txId] ?? []) : [], [txItemsMap]);

  const paymentMethods = useDbQuery('paymentMethods');
  const pmMap = useMemo(() => {
    const map = new Map<number, string>();
    paymentMethods?.forEach(pm => map.set(pm.id!, pm.name));
    return map;
  }, [paymentMethods]);

  const storeSettings = useDbQuery<any>('storeSettings')?.[0];

  const txIdParam = searchParams.get('txId');
  useEffect(() => {
    if (txIdParam && transactions) {
      const tx = transactions.find(t => t.id === Number(txIdParam) || t.receiptNumber === txIdParam);
      if (tx) {
        setSelectedTx(tx);
        setDetailOpen(true);
      }
    }
  }, [txIdParam, transactions]);

  const getPaymentName = useCallback((pmId: number) => pmMap.get(pmId) || 'Tunai', [pmMap]);

  const filtered = useMemo(() => {
    return transactions?.filter(tx => {
      const txDateObj = tx.date ? new Date(tx.date) : null;
      // Skip rendering invalid date records to prevent date-fns from throwing RangeError
      if (!txDateObj || isNaN(txDateObj.getTime())) return false; 
      
      if (filterStatus !== 'all' && tx.status !== filterStatus) return false;
      if (dateFrom) {
        if (txDateObj < startOfDay(dateFrom)) return false;
      }
      if (dateTo) {
        if (txDateObj > endOfDay(dateTo)) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const receiptMatch = (tx.receiptNumber || '').toLowerCase().includes(q);
        const nameMatch = (tx.customerName || '').toLowerCase().includes(q);
        
        const rawTable = (tx.tableNumber || '').toString().toLowerCase();
        const tableStr = rawTable === 'take away' || rawTable === 'bawa pulang'
          ? 'bawa pulang take away'
          : `meja ${rawTable.replace(/^(meja\s+)+/i, '')}`;
        const tableMatch = tableStr.includes(q) || rawTable.includes(q);
        
        return receiptMatch || nameMatch || tableMatch;
      }
      return true;
    }) ?? [];
  }, [transactions, filterStatus, dateFrom, dateTo, search, getTxItems]);

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, Transaction[]>>((acc, tx) => {
      const key = format(new Date(tx.date), 'yyyy-MM-dd');
      if (!acc[key]) acc[key] = [];
      acc[key].push(tx);
      return acc;
    }, {});
  }, [filtered]);

  const dateKeys = useMemo(() => Object.keys(grouped).sort((a, b) => b.localeCompare(a)), [grouped]);

  const filteredTotal = useMemo(() => filtered.filter(t => t.status === 'lunas').reduce((s, t) => s + t.total, 0), [filtered]);
  const hasDateFilter = dateFrom || dateTo;

  const openDetail = (tx: Transaction) => {
    setSelectedTx(tx);
    setDetailOpen(true);
  };

  const openReceipt = () => {
    setDetailOpen(false);
    setTimeout(() => setReceiptOpen(true), 200);
  };

  const clearDateFilter = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const handleDeleteTransaction = async () => {
    if (!hasEditAccess) {
      toast.error('Akses ditolak. Anda tidak memiliki izin untuk mengapus transaksi.');
      return;
    }
    if (!selectedTx?.id) return;
    try {
      if (restoreStock) {
        const items = getTxItems(selectedTx.id);
        for (const item of items) {
          const product = products.find((p: any) => p.id === item.productId);
          if (product) {
            await dbUpdate('products', item.productId, { stock: product.stock + item.quantity });
          }
        }
      }
      const items = getTxItems(selectedTx.id);
      for(const item of items) {
        if(item.id) await dbDelete('transactionItems', item.id);
      }
      await dbDelete('transactions', selectedTx.id);
      setDeleteDialogOpen(false);
      setDetailOpen(false);
      setSelectedTx(null);
      toast.success('Transaksi berhasil dihapus');
    } catch {
      toast.error('Gagal menghapus transaksi');
    }
  };

  const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  return (
    <div className="pt- pb-24 space-y-6 w-full mx-auto animate-in fade-in duration-300">
      
      {!hasEditAccess && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 select-none mb-2">
          <span className="text-base shrink-0">🔒</span>
          <span><strong>Mode Lihat Saja:</strong> Anda tidak memiliki izin untuk menghapus transaksi riwayat.</span>
        </div>
      )}

      {/* Control Panel (Filters & Search) */}
      <div className="bg-card border border-border/50 p-4 sm:p-5 rounded-[2rem] shadow-sm mb-6 space-y-4">
        
        {/* Search & Status Tabs */}
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Cari no. struk, pelanggan, meja..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-xl bg-background border-border/60 shadow-sm focus-visible:ring-1"
            />
          </div>

          {/* Segmented Control for Status */}
          <div className="flex p-1 bg-muted/40 border border-border/50 rounded-xl w-fit shrink-0">
            {([
              { value: 'all', label: 'Semua' },
              { value: 'belum lunas', label: 'Belum Lunas' },
              { value: 'lunas', label: 'Lunas' },
            ] as const).map(tab => (
              <button
                key={tab.value}
                onClick={() => setFilterStatus(tab.value)}
                className={cn(
                  'px-5 py-2 rounded-lg text-xs font-bold transition-all duration-200 select-none',
                  filterStatus === tab.value 
                    ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-border/50 w-full" />

        {/* Date Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground mr-1">
            <Filter className="w-4 h-4" /> Rentang:
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-10 text-xs font-medium gap-2 rounded-xl border-border/60 bg-background shadow-sm hover:bg-muted", dateFrom && "border-primary/50 text-primary bg-primary/5")}>
                <CalendarIcon className="w-4 h-4" />
                {dateFrom ? format(dateFrom, 'dd MMM yyyy', { locale: localeId }) : 'Tanggal Awal'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-xl z-[10000]" align="start">
              <CalendarPicker mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3" />
            </PopoverContent>
          </Popover>

          <span className="text-muted-foreground/50 font-bold">-</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-10 text-xs font-medium gap-2 rounded-xl border-border/60 bg-background shadow-sm hover:bg-muted", dateTo && "border-primary/50 text-primary bg-primary/5")}>
                <CalendarIcon className="w-4 h-4" />
                {dateTo ? format(dateTo, 'dd MMM yyyy', { locale: localeId }) : 'Tanggal Akhir'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-xl z-[10000]" align="start">
              <CalendarPicker mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3" />
            </PopoverContent>
          </Popover>

          {hasDateFilter && (
            <Button variant="ghost" className="h-10 px-3 text-xs font-bold text-destructive hover:bg-destructive/10 rounded-xl ml-auto sm:ml-0" onClick={clearDateFilter}>
              Reset <X className="w-3.5 h-3.5 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card className="border border-border/50 shadow-sm bg-gradient-to-br from-card to-muted/20 rounded-[1.5rem]">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Transaksi</p>
                <p className="text-2xl font-black text-foreground">{filtered.length} <span className="text-sm font-semibold text-muted-foreground">Nota</span></p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <ReceiptIcon className="w-6 h-6 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border/50 shadow-sm bg-gradient-to-br from-card to-muted/20 rounded-[1.5rem]">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Penjualan</p>
                <p className="text-lg xs:text-xl sm:text-2xl font-black text-primary tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">{rp(filteredTotal)}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-success" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transaction List Grouped by Date */}
      {dateKeys.length === 0 ? (
        <div className="text-center py-20 bg-card border border-dashed border-border/60 rounded-[2rem]">
          <ShoppingBag className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" strokeWidth={1.5} />
          <h3 className="text-lg font-extrabold text-foreground mb-1">Pencarian Kosong</h3>
          <p className="text-sm font-medium text-muted-foreground max-w-sm mx-auto">
            {hasDateFilter ? 'Tidak ada transaksi pada rentang tanggal yang dipilih.' : 'Belum ada transaksi di sistem Anda.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {dateKeys.map(dateKey => (
            <div key={dateKey} className="space-y-3">
              <div className="flex items-center gap-3 px-1">
                <Calendar className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground tracking-wide">
                  {format(new Date(dateKey), 'EEEE, dd MMMM yyyy', { locale: localeId })}
                </h3>
                <Badge variant="outline" className="text-[10px] font-bold bg-muted/50 border-border/60 text-muted-foreground px-2 py-0.5 rounded-md">
                  {grouped[dateKey].length} TRX
                </Badge>
              </div>
              
              <div className="grid gap-3">
                {grouped[dateKey].map(tx => (
                  <Card
                    key={tx.id ?? tx.receiptNumber}
                    className="group border border-border/60 shadow-sm bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer rounded-2xl active:scale-[0.99] overflow-hidden"
                    onClick={() => openDetail(tx)}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-colors',
                        tx.status === 'belum lunas' 
                          ? 'bg-warning/10 text-warning border-warning/20 group-hover:bg-warning/20' 
                          : 'bg-primary/5 text-primary border-primary/10 group-hover:bg-primary/10'
                      )}>
                        {tx.status === 'belum lunas' ? <ShoppingCart className="w-5 h-5" /> : <ReceiptIcon className="w-5 h-5" />}
                      </div>
                      
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-sm font-bold text-foreground font-mono truncate">{tx.receiptNumber}</p>
                            {tx.status === 'belum lunas' ? (
                              <Badge className="text-[10px] font-black uppercase tracking-wider px-2 py-0 bg-warning text-warning-foreground hover:bg-warning shadow-sm">Belum Lunas</Badge>
                            ) : (
                              <Badge className="text-[10px] font-black uppercase tracking-wider px-2 py-0 bg-success text-success-foreground hover:bg-success shadow-sm">Lunas</Badge>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-muted-foreground shrink-0 bg-muted/50 px-2 py-0.5 rounded-md">
                            {format(new Date(tx.date), 'HH:mm')}
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-between mt-1 gap-2">
                          <p className="text-xs font-medium text-muted-foreground truncate flex-1 min-w-0">
                            {getTxItems(tx.id).map(it => it.productName).join(', ')}
                          </p>
                          <p className="text-xs sm:text-sm md:text-base font-black text-foreground whitespace-nowrap shrink-0 ml-2">
                            {rp(tx.total)}
                          </p>
                        </div>
                        
                        {/* Tags */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {tx.customerName && <span className="text-[10px] font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded flex items-center gap-1"><User className="w-3 h-3"/> {tx.customerName}</span>}
                          {tx.tableNumber && (
                            <span className="text-[10px] font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded flex items-center gap-1">
                              <ShoppingCart className="w-3 h-3"/>
                              {formatReceiptTable(tx.tableNumber)}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
          {txHasMore && (
            <div className="pt-4 flex justify-center">
              <Button 
                variant="outline" 
                className="rounded-xl font-bold px-8 shadow-sm"
                onClick={() => txLoadMore()}
                disabled={txLoading}
              >
                {txLoading ? 'Memuat...' : 'Muat Lebih Banyak'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-[2rem] max-w-lg md:max-w-xl mx-auto flex flex-col p-0 border-border/60 shadow-2xl">
          <SheetHeader className="shrink-0 px-6 py-5 border-b border-border/50 bg-muted/10">
            <SheetTitle className="text-left font-extrabold flex items-center gap-2">
              <ReceiptIcon className="w-5 h-5 text-primary" /> Detail Transaksi
            </SheetTitle>
          </SheetHeader>
          
          {selectedTx && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              
              {/* Meta Info */}
              <div className="bg-card border border-border/60 rounded-2xl p-4 space-y-2.5 shadow-sm">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground font-medium">Status</span>
                  <Badge className={cn('font-black uppercase tracking-wider text-[10px]', selectedTx.status === 'belum lunas' ? 'bg-warning text-warning-foreground' : 'bg-success text-success-foreground')}>
                    {selectedTx.status === 'belum lunas' ? 'Belum Lunas' : 'Lunas'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground font-medium">No. Struk</span>
                  <span className="font-mono font-bold">{selectedTx.receiptNumber}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground font-medium">Tanggal</span>
                  <span className="font-semibold">{format(new Date(selectedTx.date), 'dd MMM yyyy, HH:mm', { locale: localeId })}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground font-medium">Pembayaran</span>
                  <span className="font-semibold">{selectedTx.status === 'belum lunas' ? '-' : getPaymentName(selectedTx.paymentMethodId)}</span>
                </div>
                {selectedTx.customerName && (
                  <div className="flex justify-between items-center text-sm pt-2 border-t border-dashed border-border/60 mt-2">
                    <span className="text-muted-foreground font-medium">Pelanggan</span>
                    <span className="font-bold">👤 {selectedTx.customerName}</span>
                  </div>
                )}
                {selectedTx.tableNumber && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground font-medium">Meja</span>
                    <span className="font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                      {formatReceiptTable(selectedTx.tableNumber)}
                    </span>
                  </div>
                )}
                {selectedTx.remarks && (
                  <div className="flex justify-between items-start text-sm">
                    <span className="text-muted-foreground font-medium mt-0.5">Catatan</span>
                    <span className="text-right max-w-[60%] font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-md">{selectedTx.remarks}</span>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div>
                <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-primary" /> Rincian Item
                </p>
                <div className="space-y-3">
                  {getTxItems(selectedTx.id).map((item, i) => (
                    <div key={i} className="flex justify-between items-start bg-card border border-border/50 p-3.5 rounded-xl shadow-sm">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="text-sm font-bold text-foreground leading-snug">{item.productName}</p>
                        <p className="text-xs font-semibold text-muted-foreground mt-1">
                          {item.quantity} × {rp(item.price)}
                          {item.discountAmount > 0 && <span className="text-destructive ml-1">(Diskon {rp(item.discountAmount)})</span>}
                        </p>
                        {item.notes && (
                          <p className="text-[11px] font-bold text-amber-600 mt-1.5 line-clamp-2">📝 {item.notes}</p>
                        )}
                      </div>
                      <p className="text-sm font-black text-foreground mt-0.5">{rp(item.subtotal)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Calculation Summary */}
              <div className="bg-muted/30 border border-border/60 rounded-2xl p-5 space-y-3">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{rp(selectedTx.subtotal)}</span>
                </div>
                {selectedTx.discountAmount > 0 && (
                  <div className="flex justify-between text-sm font-bold text-destructive">
                    <span>Diskon</span>
                    <span>-{rp(selectedTx.discountAmount)}</span>
                  </div>
                )}

                {((selectedTx.taxAmount !== undefined || (selectedTx as any).tax_amount !== undefined) || (selectedTx.adminFee !== undefined || (selectedTx as any).admin_fee !== undefined)) ? (
                  <>
                    {((selectedTx.taxAmount ?? (selectedTx as any).tax_amount) > 0) && (
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-muted-foreground">Pajak (PPN)</span>
                        <span>{rp(selectedTx.taxAmount ?? (selectedTx as any).tax_amount)}</span>
                      </div>
                    )}
                    {((selectedTx.adminFee ?? (selectedTx as any).admin_fee) > 0) && (
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-muted-foreground">Biaya Admin</span>
                        <span>{rp(selectedTx.adminFee ?? (selectedTx as any).admin_fee)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  ((selectedTx.tax_and_service ?? (selectedTx as any).taxAndService ?? 0) > 0) && (
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-muted-foreground">Biaya Admin</span>
                      <span>{rp(selectedTx.tax_and_service ?? (selectedTx as any).taxAndService)}</span>
                    </div>
                  )
                )}
                
                <div className="my-3 border-t-2 border-dashed border-border/60" />
                
                <div className="flex justify-between text-lg">
                  <span className="font-extrabold text-foreground">Total Tagihan</span>
                  <span className="font-black text-primary">{rp(selectedTx.total)}</span>
                </div>
                
                {selectedTx.status === 'lunas' ? (
                  <div className="pt-3 mt-3 border-t border-border/50 space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-muted-foreground">Uang Dibayar</span>
                      <span>{rp(selectedTx.paymentAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-muted-foreground">Kembalian</span>
                      <span className="text-success font-bold">{rp(selectedTx.change)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 bg-warning/10 border border-warning/20 rounded-lg p-2 text-center">
                    <p className="text-xs font-bold text-warning uppercase tracking-wider">Menunggu Pembayaran</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                {selectedTx.status === 'belum lunas' ? (
                  <Button className="w-full h-12 rounded-xl font-bold shadow-md active:scale-[0.98] transition-all" onClick={() => { setDetailOpen(false); navigate('/admin/orders'); }}>
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Lanjutkan Pembayaran
                  </Button>
                ) : (
                  <Button className="w-full h-12 rounded-xl font-bold shadow-md active:scale-[0.98] transition-all" onClick={openReceipt}>
                    <ReceiptIcon className="w-4 h-4 mr-2" />
                    Lihat & Cetak Struk Digital
                  </Button>
                )}

                {hasEditAccess && (
                  <Button
                    variant="outline"
                    className="w-full h-12 rounded-xl font-bold text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-colors"
                    onClick={() => { setRestoreStock(true); setDeleteDialogOpen(true); }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Hapus Transaksi Permanen
                  </Button>
                )}
              </div>

            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Receipt Dialog */}
      {selectedTx && (
        <ReceiptDialog
          open={receiptOpen}
          onClose={() => setReceiptOpen(false)}
          transaction={selectedTx}
          items={getTxItems(selectedTx.id)}
          storeSettings={storeSettings}
          paymentMethodName={getPaymentName(selectedTx.paymentMethodId)}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[400px] rounded-2xl p-6">
          <AlertDialogHeader>
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2 mx-auto">
              <Trash2 className="w-6 h-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center text-xl font-extrabold">Hapus Transaksi?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-center mt-2">
                <p className="text-sm">Anda akan menghapus transaksi <span className="font-mono font-bold text-foreground">{selectedTx?.receiptNumber}</span> senilai <span className="font-bold text-foreground">Rp {selectedTx?.total.toLocaleString('id-ID')}</span>.</p>
                <div className="flex items-center justify-center gap-2.5 bg-muted/50 p-3 rounded-xl border border-border/50">
                  <Checkbox
                    id="restore-stock"
                    checked={restoreStock}
                    onCheckedChange={(checked) => setRestoreStock(checked === true)}
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <label htmlFor="restore-stock" className="text-sm font-semibold cursor-pointer select-none text-foreground">
                    Kembalikan stok produk ke sistem
                  </label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 sm:justify-center flex-row gap-3">
            <AlertDialogCancel className="flex-1 mt-0 rounded-xl h-11 font-bold">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTransaction} className="flex-1 rounded-xl h-11 font-bold bg-destructive hover:bg-destructive/90 text-white shadow-md shadow-destructive/20">
              Hapus Permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.3); border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(156, 163, 175, 0.5); }
      `}} />
    </div>
  );
}
