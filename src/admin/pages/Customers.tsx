import { useDbQuery } from '@/hooks/db-hooks';
import { useState, useMemo } from 'react';
import { Users, Search, Phone, ShoppingBag, Calendar, TrendingUp, ChevronRight, X as XIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { usePermissions } from '@/hooks/use-permissions';

const rp = (n: number) => `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`;

interface CustomerSummary {
  name: string;
  phone: string;
  totalTransactions: number;
  totalSpent: number;
  lastVisit: string;
  transactions: any[];
}

export default function CustomersPage() {
  const { isAdmin, canView } = usePermissions();

  const allTransactions = useDbQuery<any>('transactions') || [];
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [modalPage, setModalPage] = useState(1);
  const modalItemsPerPage = 10;
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  const handleSelectCustomer = (cust: CustomerSummary | null) => {
    setSelectedCustomer(cust);
    setModalPage(1);
  };

  // Aggregate customers from transactions
  const customers = useMemo<CustomerSummary[]>(() => {
    const map = new Map<string, CustomerSummary>();

    allTransactions
      .filter(t => t.status === 'lunas' && t.customerName && t.customerName.trim())
      .forEach(t => {
        const name = (t.customerName || '').trim();
        const phone = (t.customerPhone || '').trim();
        const key = name.toLowerCase();

        if (!map.has(key)) {
          map.set(key, {
            name,
            phone,
            totalTransactions: 0,
            totalSpent: 0,
            lastVisit: t.date,
            transactions: [],
          });
        }

        const cust = map.get(key)!;
        cust.totalTransactions += 1;
        cust.totalSpent += t.total || 0;
        if (phone && !cust.phone) cust.phone = phone;
        if (new Date(t.date) > new Date(cust.lastVisit)) cust.lastVisit = t.date;
        cust.transactions.push(t);
      });

    return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [allTransactions]);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [customers, search]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage]);

  const totalCustomers = customers.length;
  const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0);
  const avgSpend = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

  if (!isAdmin && !canView('customers')) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <Users className="w-12 h-12 text-muted-foreground/30" strokeWidth={1.5} />
        <p className="text-muted-foreground text-sm">Anda tidak memiliki akses ke halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="pb-24 space-y-4 w-full animate-in fade-in duration-300">


      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Total Pelanggan', value: totalCustomers.toString(), icon: <Users className="w-4 h-4" />, color: 'text-primary' },
          { label: 'Total Transaksi', value: rp(totalRevenue), icon: <TrendingUp className="w-4 h-4" />, color: 'text-success' },
          { label: 'Rata-rata Belanja', value: rp(avgSpend), icon: <ShoppingBag className="w-4 h-4" />, color: 'text-accent' },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <div className={cn('w-6 h-6 mx-auto mb-1', s.color)}>{s.icon}</div>
              <p className="text-xs font-black text-foreground leading-tight">{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Cari nama atau nomor HP..."
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          className="pl-10 h-11 rounded-xl bg-background border-border/60"
        />
        {search && (
          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => handleSearchChange('')}>
            <XIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Badge count */}
      <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/20">
        {filtered.length} Pelanggan Ditemukan
      </Badge>

      {/* Customer List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
            <Users className="w-8 h-8 text-muted-foreground/30" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-muted-foreground font-medium">
            {customers.length === 0
              ? 'Belum ada data pelanggan dari transaksi'
              : 'Tidak ada pelanggan sesuai pencarian'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            {paginatedCustomers.map((cust) => (
              <Card
                key={cust.name}
                className="border border-border/50 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 rounded-2xl cursor-pointer group"
                onClick={() => handleSelectCustomer(cust)}
              >
                <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 font-black text-primary text-base">
                    {cust.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-extrabold truncate">{cust.name}</p>
                      {cust.name === filtered[0]?.name && <Badge className="text-[9px] px-1.5 py-0 bg-warning/20 text-warning border-warning/30 shrink-0">Top</Badge>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                      {cust.phone && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {cust.phone}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(cust.lastVisit), 'dd MMM yyyy', { locale: idLocale })}
                      </span>
                    </div>
                  </div>

                  {/* Right */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="text-sm font-black text-primary">{rp(cust.totalSpent)}</p>
                    <p className="text-[10px] text-muted-foreground font-semibold">{cust.totalTransactions}× transaksi</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0 group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground font-semibold">
                Halaman {currentPage} dari {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 px-2.5 text-xs font-bold rounded-xl border-border/60"
                >
                  Sebelumnya
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 px-2.5 text-xs font-bold rounded-xl border-border/60"
                >
                  Selanjutnya
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Customer Detail Dialog */}
      <Dialog open={!!selectedCustomer} onOpenChange={o => !o && handleSelectCustomer(null)}>
        {selectedCustomer && (
          <DialogContent className="max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center font-black text-primary text-2xl shrink-0">
                  {selectedCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <DialogTitle className="text-xl font-extrabold">{selectedCustomer.name}</DialogTitle>
                  {selectedCustomer.phone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Phone className="w-3.5 h-3.5" /> {selectedCustomer.phone}
                    </p>
                  )}
                </div>
              </div>
            </DialogHeader>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mt-1">
              {[
                { label: 'Transaksi', value: selectedCustomer.totalTransactions.toString() },
                { label: 'Total Belanja', value: rp(selectedCustomer.totalSpent) },
                { label: 'Rata-rata', value: rp(selectedCustomer.totalSpent / selectedCustomer.totalTransactions) },
              ].map(s => (
                <div key={s.label} className="bg-muted/30 rounded-xl p-3 text-center">
                  <p className="text-sm font-black">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Transaction History */}
            <div className="space-y-2 mt-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Riwayat Transaksi</p>
              {(() => {
                const sortedTx = [...selectedCustomer.transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                const modalTotalPages = Math.ceil(sortedTx.length / modalItemsPerPage) || 1;
                const paginatedTx = sortedTx.slice((modalPage - 1) * modalItemsPerPage, modalPage * modalItemsPerPage);

                return (
                  <div className="space-y-2">
                    <div className="space-y-2">
                      {paginatedTx.map((tx: any) => (
                        <div key={tx.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-border/40">
                          <div>
                            <p className="text-xs font-bold text-foreground">{tx.receiptNumber || tx.id}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(tx.date), 'dd MMM yyyy, HH:mm', { locale: idLocale })}
                              {tx.tableNumber && tx.tableNumber !== 'Bawa Pulang' && (
                                <span className="ml-1 bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[9px] font-bold">
                                  Meja {tx.tableNumber}
                                </span>
                              )}
                            </p>
                          </div>
                          <p className="text-sm font-black text-primary">{rp(tx.total)}</p>
                        </div>
                      ))}
                    </div>

                    {modalTotalPages > 1 && (
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs text-muted-foreground font-semibold">
                          Halaman {modalPage} dari {modalTotalPages}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setModalPage(p => Math.max(1, p - 1))}
                            disabled={modalPage === 1}
                            className="h-8 px-2.5 text-xs font-bold rounded-xl border-border/60"
                          >
                            Sebelumnya
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setModalPage(p => Math.min(modalTotalPages, p + 1))}
                            disabled={modalPage === modalTotalPages}
                            className="h-8 px-2.5 text-xs font-bold rounded-xl border-border/60"
                          >
                            Selanjutnya
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </DialogContent>
        )}
      </Dialog>

    </div>
  );
}
