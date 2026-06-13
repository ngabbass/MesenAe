import { useDbQuery, dbInsert, dbUpdate, dbDelete, type Expense, type ExpenseCategory, type PaymentMethod } from '@/hooks/db-hooks';
import { useState, useMemo } from 'react';
import {
  Wallet, Plus, Edit2, Trash2, Calendar as CalendarIcon, FilterX, Tag, Loader2
} from 'lucide-react';
import { RpIcon } from '@/components/ui/RpIcon';
import ExpenseCategories from '../components/ExpenseCategories';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, startOfDay, subDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { usePermissions } from '@/hooks/use-permissions';

// ── Types & Helpers ────────────────────────────────────────────
type RangePreset = 'today' | '7' | '30' | 'all';
const RANGE_LABELS: Record<RangePreset, string> = {
  today: 'Hari ini',
  '7': '7 Hari',
  '30': '30 Hari',
  all: 'Semua',
};

function rangeStart(r: RangePreset): Date | null {
  const now = new Date();
  switch (r) {
    case 'today': return startOfDay(now);
    case '7':     return startOfDay(subDays(now, 6));
    case '30':    return startOfDay(subDays(now, 29));
    default:      return null;
  }
}

const rp = (n: number) => `Rp ${(n || 0).toLocaleString('id-ID')}`;

// Preset colors/icons and seeding are managed by the ExpenseCategories component.

export default function ExpensesPage() {
  const { isAdmin, canView, canEdit } = usePermissions();
  const canManage = isAdmin || canEdit('expenses');
  const canViewExpenses = isAdmin || canView('expenses');

  // ── Data ──────────────────────────────────────────────────────
  const allExpenses = useDbQuery<Expense>('expenses') || [];
  const allCategories = useDbQuery<ExpenseCategory>('expenseCategories') || [];
  const paymentMethods = useDbQuery<PaymentMethod>('paymentMethods') || [];

  const activeCategories = useMemo(() => {
    return allCategories
      .filter(c => !c.isDeleted)
      .sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
        if (a.createdAt && b.createdAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        return String(a.id!).localeCompare(String(b.id!));
      });
  }, [allCategories]);

  // ── Filter state ──────────────────────────────────────────────
  const [range, setRange] = useState<RangePreset>('30');
  const [filterCatId, setFilterCatId] = useState<string>('all');

  // ── O(1) Lookup Maps ──────────────────────────────────────────
  const categoryMap = useMemo(() => {
    const map = new Map<string, ExpenseCategory>();
    for (const c of activeCategories) map.set(String(c.id), c);
    return map;
  }, [activeCategories]);

  const paymentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of paymentMethods) map.set(String(p.id), p.name);
    return map;
  }, [paymentMethods]);

  const getCat = (id: string | number) => categoryMap.get(String(id));
  const getPaymentName = (id: string | number) => paymentMap.get(String(id)) ?? '-';

  const filteredExpenses = useMemo(() => {
    const start = rangeStart(range);
    return allExpenses
      .filter(e => {
        // Compare date strings directly — avoids new Date() timezone conversion.
        // rangeStart returns a Date at local midnight; e.date is stored as 'yyyy-MM-dd'.
        if (start && e.date < format(start, 'yyyy-MM-dd')) return false;
        if (filterCatId !== 'all' && String(e.categoryId) !== filterCatId) return false;
        return true;
      })
      .sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
  }, [allExpenses, range, filterCatId]);

  const totalAmount = useMemo(() => filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0), [filteredExpenses]);

  // Pre-computed for empty-state check — avoids inline .filter() in JSX.
  const activeExpensesCount = useMemo(() => allExpenses.length, [allExpenses]);

  // ── Expense CRUD State ────────────────────────────────────────
  const [expDialogOpen, setExpDialogOpen] = useState(false);
  const [editingExp, setEditingExp] = useState<Expense | null>(null);
  const [expTitle, setExpTitle] = useState('');
  const [expCatId, setExpCatId] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expPmId, setExpPmId] = useState('');
  const [expDate, setExpDate] = useState('');
  const [expNotes, setExpNotes] = useState('');
  const [expSaving, setExpSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const openAddExp = () => {
    setEditingExp(null);
    setExpTitle('');
    setExpCatId(activeCategories[0]?.id?.toString() ?? '');
    setExpAmount('');
    setExpPmId(paymentMethods[0]?.id?.toString() ?? '');
    setExpDate(format(new Date(), 'yyyy-MM-dd'));
    setExpNotes('');
    setExpDialogOpen(true);
  };

  const openEditExp = (exp: Expense) => {
    setEditingExp(exp);
    setExpTitle(exp.title);
    setExpCatId(String(exp.categoryId));
    setExpAmount(String(exp.amount));
    setExpPmId(String(exp.paymentMethodId));
    // exp.date is stored as 'yyyy-MM-dd'; parse it as local date to avoid UTC shift.
    setExpDate(exp.date?.slice(0, 10) ?? format(new Date(), 'yyyy-MM-dd'));
    setExpNotes(exp.notes ?? '');
    setExpDialogOpen(true);
  };

  const handleSaveExp = async () => {
    const trimTitle = expTitle.trim();
    const numAmount = Number(expAmount);
    if (!trimTitle) { toast.error('Judul wajib diisi'); return; }
    if (!expCatId) { toast.error('Pilih kategori'); return; }
    if (!numAmount || numAmount <= 0) { toast.error('Nominal harus lebih dari 0'); return; }
    if (!expPmId) { toast.error('Pilih metode pembayaran'); return; }
    if (!expDate) { toast.error('Pilih tanggal'); return; }
    setExpSaving(true);
    try {
      const payload = {
        title: trimTitle,
        categoryId: expCatId,
        amount: numAmount,
        paymentMethodId: expPmId,
        // Store as a plain 'yyyy-MM-dd' string to avoid timezone conversion bugs.
        // Converting to ISO (UTC) causes dates to shift for users in UTC+x timezones.
        date: expDate.slice(0, 10),
        notes: expNotes.trim() || undefined,
      };
      if (editingExp?.id) {
        await dbUpdate('expenses', editingExp.id, payload);
        toast.success('Pengeluaran diperbarui');
      } else {
        await dbInsert('expenses', { ...payload, createdAt: new Date().toISOString() });
        toast.success('Pengeluaran dicatat');
      }
      setExpDialogOpen(false);
    } catch {
      toast.error('Gagal menyimpan pengeluaran');
    } finally {
      setExpSaving(false);
    }
  };

  const handleDeleteExp = async () => {
    if (!deleteTarget?.id) return;
    await dbDelete('expenses', deleteTarget.id);
    toast.success('Pengeluaran dihapus');
    setDeleteTarget(null);
  };

  // ── Category Management State ─────────────────────────────────
  const [catModalOpen, setCatModalOpen] = useState(false);

  if (!canViewExpenses) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
          <Wallet className="w-10 h-10 text-muted-foreground/30" strokeWidth={1.5} />
        </div>
        <p className="text-muted-foreground text-sm">Anda tidak memiliki akses ke halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="pb-24 space-y-4 w-full animate-in fade-in duration-300">

      {/* ── Actions ── */}
      <div className={cn("grid gap-3 w-full", canManage ? "grid-cols-2 sm:flex sm:justify-end" : "grid-cols-1 sm:flex sm:justify-end")}>
        <Button 
          variant="outline" 
          onClick={() => setCatModalOpen(true)} 
          className="h-11 px-3 sm:px-4 rounded-xl font-bold border-primary/20 hover:bg-primary/5 hover:text-primary transition-all duration-200 text-foreground w-full sm:w-auto"
        >
          <Tag className="w-4 h-4 mr-2 text-primary shrink-0" />
          <span className="truncate">Kelola Kategori</span>
        </Button>
        {canManage && (
          <Button onClick={openAddExp} className="h-11 px-3 sm:px-5 rounded-xl font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98] w-full sm:w-auto">
            <Plus className="w-5 h-5 mr-1.5 sm:mr-2 shrink-0" strokeWidth={3} />
            <span className="truncate">Tambah Pengeluaran</span>
          </Button>
        )}
      </div>

      {/* ── Range Filter ── */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(RANGE_LABELS) as RangePreset[]).map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
              range === r
                ? 'border-primary bg-primary/10 text-primary shadow-sm'
                : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40'
            )}
          >{RANGE_LABELS[r]}</button>
        ))}
      </div>

      {/* ── Summary Card ── */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-warning/8 to-warning/3 pointer-events-none" />
        <CardContent className="p-4 flex items-center gap-4 relative">
          <div className="w-12 h-12 rounded-2xl bg-warning/15 text-warning flex items-center justify-center shrink-0 shadow-sm">
            <RpIcon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold mb-0.5">
              Total Pengeluaran · {RANGE_LABELS[range]}
            </p>
            <p className="text-2xl font-black text-foreground leading-none">{rp(totalAmount)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{filteredExpenses.length} catatan</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Category Filter ── */}
      <div className="flex items-center gap-2">
        <Select value={filterCatId} onValueChange={setFilterCatId}>
          <SelectTrigger className="h-10 flex-1 rounded-xl bg-background border-border/60">
            <SelectValue placeholder="Filter kategori" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">Semua Kategori</SelectItem>
            {activeCategories.map(c => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.icon} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filterCatId !== 'all' && (
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-xl" onClick={() => setFilterCatId('all')}>
            <FilterX className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* ── Expense List ── */}
      {filteredExpenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
            <Wallet className="w-8 h-8 text-muted-foreground/30" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-muted-foreground font-medium">
            {activeExpensesCount === 0
              ? 'Belum ada pengeluaran tercatat'
              : 'Tidak ada pengeluaran sesuai filter'}
          </p>
          {canManage && (
            <Button variant="outline" size="sm" className="mt-2 rounded-xl border-primary/20 text-primary hover:bg-primary/5" onClick={openAddExp}>
              <Plus className="w-4 h-4 mr-1.5" /> Catat Pengeluaran
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredExpenses.map(exp => {
            const cat = getCat(exp.categoryId);
            return (
              <Card key={exp.id} className="border border-border/50 shadow-sm hover:shadow-md transition-all duration-200 rounded-2xl overflow-hidden">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-lg"
                      style={{ backgroundColor: (cat?.color ?? '#6B7280') + '25' }}
                    >
                      {cat?.icon ?? '📦'}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate">{exp.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {cat?.name ?? '—'} · {getPaymentName(exp.paymentMethodId)}
                          </p>
                        </div>
                        <p className="text-sm font-black text-warning shrink-0">-{rp(exp.amount)}</p>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <CalendarIcon className="w-3.5 h-3.5" />
                          <span>{format(new Date(exp.date), 'dd MMM yyyy', { locale: idLocale })}</span>
                        </div>
                        {canManage && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => openEditExp(exp)}>
                              <Edit2 className="w-3 h-3" /> Edit
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(exp)}>
                              <Trash2 className="w-3 h-3" /> Hapus
                            </Button>
                          </div>
                        )}
                      </div>
                      {exp.notes && (
                        <p className="text-[11px] text-muted-foreground mt-1.5 italic line-clamp-2">{exp.notes}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Add/Edit Expense Dialog ── */}
      <Dialog open={expDialogOpen} onOpenChange={setExpDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-extrabold">
              <div className="p-1.5 bg-warning/10 rounded-lg text-warning">
                {editingExp ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </div>
              {editingExp ? 'Edit Pengeluaran' : 'Catat Pengeluaran'}
            </DialogTitle>
          </DialogHeader>

          {(activeCategories.length === 0 || paymentMethods.length === 0) && (
            <div className="rounded-xl bg-warning/10 border border-warning/30 p-3 text-xs text-foreground space-y-1">
              {activeCategories.length === 0 && <p>⚠️ Belum ada kategori pengeluaran. Tambahkan via "Kelola Kategori".</p>}
              {paymentMethods.length === 0 && <p>⚠️ Belum ada metode pembayaran. Tambahkan di Pengaturan.</p>}
            </div>
          )}

          <div className="space-y-4 mt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Judul *</Label>
              <Input value={expTitle} onChange={e => setExpTitle(e.target.value)} placeholder="Contoh: Bayar listrik bulan ini" className="h-11 rounded-xl" maxLength={120} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kategori *</Label>
              <Select value={expCatId} onValueChange={setExpCatId}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {activeCategories.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.icon} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 flex flex-col">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tanggal *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      type="button"
                      className={cn(
                        "h-11 text-sm font-medium gap-2 rounded-xl border-border/60 bg-background shadow-sm hover:bg-muted w-full px-3 justify-start",
                        expDate && "border-primary/50 text-primary bg-primary/5"
                      )}
                    >
                      <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="truncate">
                        {expDate ? (() => {
                          const [y, m, d] = expDate.split('-').map(Number);
                          return format(new Date(y, m - 1, d), 'dd MMM yyyy', { locale: idLocale });
                        })() : 'Pilih Tanggal'}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-xl z-[10000]" align="start">
                    <Calendar
                      mode="single"
                      selected={expDate ? (() => {
                        const [y, m, d] = expDate.split('-').map(Number);
                        return new Date(y, m - 1, d);
                      })() : undefined}
                      onSelect={(date) => {
                        if (date) {
                          setExpDate(format(date, 'yyyy-MM-dd'));
                        }
                      }}
                      initialFocus
                      className="p-3"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nominal *</Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">Rp</span>
                  <Input type="number" inputMode="numeric" min={0} value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="0" className="h-11 pl-10 rounded-xl font-mono" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Metode Pembayaran *</Label>
              <Select value={expPmId} onValueChange={setExpPmId}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Pilih metode" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {paymentMethods.map(pm => (
                    <SelectItem key={pm.id} value={String(pm.id)}>{pm.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Catatan</Label>
              <Textarea value={expNotes} onChange={e => setExpNotes(e.target.value)} placeholder="Opsional" rows={2} className="resize-none rounded-xl" />
            </div>
          </div>

          <DialogFooter className="mt-2 gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-xl h-11 font-bold border-border/60" onClick={() => setExpDialogOpen(false)} disabled={expSaving}>Batal</Button>
            <Button className="rounded-xl h-11 font-bold px-8 shadow-md active:scale-[0.98]" onClick={handleSaveExp} disabled={expSaving || activeCategories.length === 0 || paymentMethods.length === 0}>
              {expSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</> : (editingExp ? 'Simpan Perubahan' : 'Catat Pengeluaran')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Expense AlertDialog ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-[360px] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pengeluaran?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" ({deleteTarget && rp(deleteTarget.amount)}) akan dihapus dan tidak masuk laporan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExp} className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Kategori Pengeluaran Component (Drag & Drop) ── */}
      <ExpenseCategories open={catModalOpen} onOpenChange={setCatModalOpen} />

    </div>
  );
}
