import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import {
  TrendingUp, CheckCircle2, UtensilsCrossed, History, Printer, Clock, Filter,
} from 'lucide-react';
import { cn, formatReceiptTable } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Transaction, TransactionItemRecord, StoreSettings } from '@/hooks/db-hooks';
import KitchenDisplayItemsList from './KitchenDisplayItemsList';
import KitchenItemSummary from './KitchenItemSummary';

interface AnalogHourPickerModalProps {
  open: boolean;
  onClose: () => void;
  selectedHour: string;
  onSelect: (hour: string) => void;
}

function AnalogHourPickerModal({ open, onClose, selectedHour, onSelect }: AnalogHourPickerModalProps) {
  const [tempHour, setTempHour] = useState<string>('12');
  const [isDragging, setIsDragging] = useState(false);
  const svgRef = React.useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (open) {
      setTempHour(selectedHour === 'all' ? '12' : selectedHour);
    }
  }, [open, selectedHour]);

  const handlePointerAction = (clientX: number, clientY: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;

    const distance = Math.sqrt(dx * dx + dy * dy);
    // SVG viewBox coordinates are 240x240, scale distance accordingly
    const svgScale = 240 / rect.width;
    const scaledDistance = distance * svgScale;

    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;

    const step = Math.round(angle / 30) % 12;

    let hour = 12;
    // Determine outer or inner circle. Outer circle radius is ~90, inner is ~60. Threshold = 75.
    if (scaledDistance > 75) {
      hour = step === 0 ? 12 : step;
    } else {
      hour = step === 0 ? 0 : step + 12;
    }

    setTempHour(String(hour).padStart(2, '0'));
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    setIsDragging(true);
    handlePointerAction(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    handlePointerAction(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    setIsDragging(true);
    if (e.touches[0]) {
      handlePointerAction(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    if (e.touches[0]) {
      handlePointerAction(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Coordinates of selected hour pointer
  const activeHourNum = parseInt(tempHour || '12', 10);
  const isOuter = activeHourNum >= 1 && activeHourNum <= 12;
  const radius = isOuter ? 90 : 60;
  const targetStep = isOuter ? (activeHourNum % 12) : (activeHourNum - 12) % 12;
  const radAngle = ((targetStep * 30 - 90) * Math.PI) / 180;
  const handCoords = {
    x: 120 + radius * Math.cos(radAngle),
    y: 120 + radius * Math.sin(radAngle),
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-[320px] rounded-2xl p-5 border border-border shadow-2xl bg-background flex flex-col items-center select-none z-[160] gap-4">
        <DialogHeader className="w-full text-center">
          <DialogTitle className="text-sm font-bold text-foreground">Pilih Jam</DialogTitle>
        </DialogHeader>

        {/* Selected Display */}
        <div className="text-center font-mono py-1">
          <span className="text-2xl font-black text-primary tabular-nums">
            {tempHour}:00 - {tempHour}:59
          </span>
        </div>

        {/* Clock SVG Face */}
        <svg
          ref={svgRef}
          viewBox="0 0 240 240"
          className="w-56 h-56 select-none touch-none mx-auto cursor-pointer relative"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Background circle */}
          <circle cx="120" cy="120" r="115" className="fill-muted/20 stroke-border stroke-1" />

          {/* Central pin */}
          <circle cx="120" cy="120" r="3" className="fill-primary" />

          {/* Clock Hand line */}
          <line
            x1="120"
            y1="120"
            x2={handCoords.x}
            y2={handCoords.y}
            className="stroke-primary stroke-[1.5] opacity-80"
          />

          {/* Hand end selection indicator */}
          <circle
            cx={handCoords.x}
            cy={handCoords.y}
            r="14"
            className="fill-primary/20 stroke-primary stroke-[1.5]"
          />
          <circle
            cx={handCoords.x}
            cy={handCoords.y}
            r="2"
            className="fill-primary"
          />

          {/* Render numbers 1-12 (outer ring) */}
          {Array.from({ length: 12 }, (_, index) => {
            const h = index + 1;
            const a = ((h * 30 - 90) * Math.PI) / 180;
            const x = 120 + 90 * Math.cos(a);
            const y = 120 + 90 * Math.sin(a);
            const isActive = activeHourNum === h;
            return (
              <text
                key={`outer-${h}`}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                className={cn(
                  'text-[10px] font-bold select-none pointer-events-none transition-all',
                  isActive ? 'fill-primary font-black text-xs' : 'fill-muted-foreground/80'
                )}
              >
                {h}
              </text>
            );
          })}

          {/* Render numbers 13-23 and 00 (inner ring) */}
          {Array.from({ length: 12 }, (_, index) => {
            const hRaw = index + 13;
            const h = hRaw === 24 ? 0 : hRaw;
            const label = h === 0 ? '00' : String(h);
            const a = (((index + 1) * 30 - 90) * Math.PI) / 180;
            const x = 120 + 60 * Math.cos(a);
            const y = 120 + 60 * Math.sin(a);
            const isActive = activeHourNum === h;
            return (
              <text
                key={`inner-${h}`}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                className={cn(
                  'text-[9px] font-bold select-none pointer-events-none transition-all',
                  isActive ? 'fill-primary font-black text-[11px]' : 'fill-muted-foreground/60'
                )}
              >
                {label}
              </text>
            );
          })}
        </svg>

        {/* Buttons */}
        <div className="flex flex-col gap-2 w-full mt-2">
          <div className="flex gap-2 w-full">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-9 rounded-xl text-xs font-bold border-border text-muted-foreground"
              onClick={onClose}
            >
              Batal
            </Button>
            <Button
              type="button"
              className="flex-1 h-9 rounded-xl text-xs font-bold bg-primary text-primary-foreground"
              onClick={() => {
                onSelect(tempHour);
                onClose();
              }}
            >
              Terapkan
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="w-full h-8 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground"
            onClick={() => {
              onSelect('all');
              onClose();
            }}
          >
            Pilih Semua Jam
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


interface HistoryViewProps {
  bills: Transaction[];
  allTxItems: TransactionItemRecord[];
  onPrint: (bill: Transaction) => void;
  storeSettings?: StoreSettings;
}

export default function HistoryView({ bills, allTxItems, onPrint, storeSettings }: HistoryViewProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string | number, boolean>>({});
  const toggleRow = (id: string | number) =>
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));

  const [filterHour, setFilterHour] = useState('all');
  const [filterTable, setFilterTable] = useState('all');
  const [searchName, setSearchName] = useState('');
  
  // Mobile filter collapsed state
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  // Analog Picker state
  const [isHourPickerOpen, setIsHourPickerOpen] = useState(false);

  // Table Dropdown state
  const [isTableDropdownOpen, setIsTableDropdownOpen] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterHour !== 'all') count++;
    if (filterTable !== 'all') count++;
    if (searchName.trim() !== '') count++;
    return count;
  }, [filterHour, filterTable, searchName]);

  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }),
    [],
  );

  const parseDate = (dateVal: any): Date | null => {
    if (!dateVal) return null;
    try {
      let d: Date;
      if (dateVal instanceof Date) {
        d = dateVal;
      } else if (typeof dateVal === 'object' && dateVal.seconds !== undefined) {
        d = new Date(dateVal.seconds * 1000);
      } else {
        d = new Date(dateVal);
      }
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  };

  const safeFormatTime = (dateVal: any): string => {
    const d = parseDate(dateVal);
    if (!d) return '--:--';
    try {
      return timeFormatter.format(d).replace('.', ':');
    } catch {
      return '--:--';
    }
  };

  const isSelfPickup = storeSettings?.deliveryMode === 'ambil';

  // Extract unique hours present in transactions (formatted as 'HH')
  const availableHours = useMemo(() => {
    const hours = new Set<string>();
    bills.forEach((b) => {
      try {
        const d = parseDate(b.date);
        if (d) {
          const h = format(d, 'HH');
          hours.add(h);
        }
      } catch (e) {
        console.warn('Error formatting date:', e);
      }
    });
    return Array.from(hours).sort();
  }, [bills]);

  // Extract unique tables present in transactions
  const availableTables = useMemo(() => {
    const tables = new Set<string>();
    bills.forEach((b) => {
      if (b.tableNumber !== undefined && b.tableNumber !== null) {
        tables.add(b.tableNumber.toString());
      }
    });
    return Array.from(tables).sort((a, b) => {
      const displayA = formatReceiptTable(a);
      const displayB = formatReceiptTable(b);
      const isTakeawayA = displayA === 'Bawa Pulang';
      const isTakeawayB = displayB === 'Bawa Pulang';

      if (isTakeawayA && !isTakeawayB) return -1;
      if (!isTakeawayA && isTakeawayB) return 1;

      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [bills]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterHour, filterTable, searchName]);

  // Filtered bills list
  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      // 1. Name/Struk Filter
      if (searchName.trim()) {
        const term = searchName.toLowerCase();
        const customerMatch = b.customerName?.toLowerCase().includes(term);
        const receiptMatch = b.receiptNumber?.toLowerCase().includes(term);
        if (!customerMatch && !receiptMatch) return false;
      }

      // 2. Table Filter
      if (filterTable !== 'all') {
        if (b.tableNumber?.toString() !== filterTable) return false;
      }

      // 3. Hour Filter
      if (filterHour !== 'all') {
        try {
          const d = parseDate(b.date);
          if (!d) return false;
          const h = format(d, 'HH');
          if (h !== filterHour) return false;
        } catch {
          return false;
        }
      }

      return true;
    });
  }, [bills, searchName, filterTable, filterHour]);

  // Paginated bills list
  const totalPages = Math.ceil(filteredBills.length / itemsPerPage) || 1;
  const paginatedBills = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredBills.slice(start, start + itemsPerPage);
  }, [filteredBills, currentPage]);

  // Daily stats (unfiltered overall summary for today)
  const stats = useMemo(() => {
    const completed = bills.length;
    const totalItems = bills.reduce(
      (sum, b) =>
        sum + allTxItems.filter((i) => i.transactionId === b.id).reduce((s, i) => s + i.quantity, 0),
      0,
    );
    return { total: bills.length, completed, totalItems };
  }, [bills, allTxItems]);

  const statsConfig = [
    { label: 'Total Pesanan', value: stats.total, Icon: TrendingUp, colorClass: 'text-primary bg-primary/10 border-primary/20' },
    {
      label: isSelfPickup ? 'Selesai Diambil' : 'Selesai Diantar',
      value: stats.completed,
      Icon: CheckCircle2,
      colorClass: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    },
    { label: 'Total Item', value: stats.totalItems, Icon: UtensilsCrossed, colorClass: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20' },
  ];

  return (
    <div className="flex-1 overflow-hidden flex flex-col gap-4 min-h-0">

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3 shrink-0">
        {statsConfig.map(({ label, value, Icon, colorClass }) => (
          <div
            key={label}
            className="bg-card border border-slate-300 dark:border-slate-800/90 rounded-2xl p-4 flex items-center gap-3 shadow-sm"
          >
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border', colorClass)}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-xl font-black text-foreground tabular-nums leading-tight">{value}</p>
              <p className="text-[10px] font-semibold text-muted-foreground leading-tight mt-0.5 truncate">
                {label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile filter toggle bar */}
      <div className="md:hidden flex items-center justify-between bg-card border border-slate-300 dark:border-slate-800/90 rounded-2xl p-3 shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-black text-foreground">Filter & Pencarian</span>
          {activeFiltersCount > 0 && (
            <Badge className="bg-primary text-primary-foreground text-[9px] px-1.5 py-0.5 rounded-full font-extrabold">
              {activeFiltersCount}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFiltersMobile(!showFiltersMobile)}
          className="h-8 rounded-xl px-3 text-xs font-bold flex items-center gap-1.5 border-slate-300 dark:border-slate-800"
        >
          {showFiltersMobile ? 'Sembunyikan' : 'Filter'}
        </Button>
      </div>

      {/* Filters bar */}
      <div
        className={cn(
          "bg-card border border-slate-300 dark:border-slate-800/90 rounded-2xl p-4 md:flex flex-col md:flex-row gap-4 items-center justify-between shrink-0 shadow-sm",
          showFiltersMobile ? "flex" : "hidden"
        )}
      >
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto items-center">
          {/* Hour filter */}
          <div className="flex flex-col w-full sm:w-44">
            <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest mb-1.5">Filter Jam</span>
            <button
              onClick={() => setIsHourPickerOpen(true)}
              className="h-9 w-full rounded-xl border border-border bg-background px-3 flex items-center justify-between text-xs font-semibold text-foreground hover:bg-muted/30 transition-all select-none text-left focus:outline-none"
            >
              <span className="truncate">
                {filterHour === 'all' ? 'Semua Jam' : `Jam ${filterHour}:00 - ${filterHour}:59`}
              </span>
              <Clock className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 ml-1.5" />
            </button>
          </div>

          {/* Table filter */}
          <div className="flex flex-col w-full sm:w-44 relative">
            <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest mb-1.5">Filter Meja</span>
            <button
              onClick={() => setIsTableDropdownOpen(!isTableDropdownOpen)}
              className="h-9 w-full rounded-xl border border-border bg-background px-3 flex items-center justify-between text-xs font-semibold text-foreground hover:bg-muted/30 transition-all select-none text-left focus:outline-none"
            >
              <span className="truncate">
                {filterTable === 'all' ? 'Semua Meja' : formatReceiptTable(filterTable)}
              </span>
              <UtensilsCrossed className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 ml-1.5" />
            </button>

            {isTableDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsTableDropdownOpen(false)}
                />
                <div className="absolute top-[calc(100%+4px)] left-0 z-50 w-full bg-card border border-slate-300 dark:border-slate-800/80 rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 slide-in-from-top-1 duration-100 max-h-60 overflow-y-auto">
                  <button
                    onClick={() => {
                      setFilterTable('all');
                      setIsTableDropdownOpen(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs font-bold transition-colors border-b border-border/40',
                      filterTable === 'all'
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted/50'
                    )}
                  >
                    Semua Meja
                  </button>
                  {availableTables.map((t) => {
                    const display = formatReceiptTable(t);
                    return (
                      <button
                        key={t}
                        onClick={() => {
                          setFilterTable(t);
                          setIsTableDropdownOpen(false);
                        }}
                        className={cn(
                          'w-full text-left px-3 py-2 text-xs font-semibold transition-colors truncate',
                          filterTable === t
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground hover:bg-muted/50'
                        )}
                        title={display}
                      >
                        {display}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Name filter */}
          <div className="flex flex-col w-full sm:w-60">
            <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest mb-1.5">Cari Nama / No. Struk</span>
            <input
              type="text"
              placeholder="Ketik nama / no. struk..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="h-9 w-full rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Clear filter button (only show when filters are active) */}
        {(filterHour !== 'all' || filterTable !== 'all' || searchName !== '') && (
          <Button
            variant="ghost"
            onClick={() => {
              setFilterHour('all');
              setFilterTable('all');
              setSearchName('');
            }}
            className="text-xs font-bold text-muted-foreground hover:text-foreground h-9 px-3 shrink-0"
          >
            Bersihkan Filter
          </Button>
        )}
      </div>

      {/* History table / list */}
      <div className="flex-1 overflow-hidden bg-card border border-slate-300 dark:border-slate-800/90 rounded-2xl flex flex-col min-h-0 shadow-sm">

        {/* Table header */}
        <div className="px-5 py-3.5 border-b border-slate-300 dark:border-slate-800/80 bg-muted/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-black text-foreground">Riwayat Hari Ini</h3>
          </div>
          <Badge variant="secondary" className="text-[10px] font-bold">
            {filteredBills.length} pesanan
          </Badge>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 pb-20">
          {bills.length === 0 ? (
            <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center p-8 opacity-50">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-3 border border-border">
                <History className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-bold text-muted-foreground">Belum ada pesanan selesai hari ini</p>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-[240px]">
                {isSelfPickup
                  ? 'Riwayat tampil setelah pesanan ditandai sebagai "diambil"'
                  : 'Riwayat tampil setelah waiter menandai pesanan sebagai "diantarkan"'}
              </p>
            </div>
          ) : filteredBills.length === 0 ? (
            <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center p-8 opacity-50">
              <p className="text-sm font-bold text-muted-foreground">Tidak ada pesanan cocok dengan filter</p>
            </div>
          ) : (
            <>
              {/* ── Desktop Table ── */}
              <table className="hidden md:table w-full">
                <thead>
                  <tr className="border-b border-slate-300 bg-muted/5">
                    {['Waktu / No. Struk', 'Pemesan', 'Meja', 'Pesanan', 'Aksi'].map((h, i) => (
                      <th
                        key={h}
                        className={cn(
                          'px-4 py-2.5 text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest',
                          i === 0 ? 'text-left w-32' : i === 1 ? 'text-left w-40' : i === 2 ? 'text-left w-28' : i === 4 ? 'text-center w-12' : 'text-left',
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/40">
                  {paginatedBills.map((bill) => {
                    const timeStr = safeFormatTime(bill.date);
                    const isExpanded = !!expandedRows[bill.id!];
                    const billItems = allTxItems.filter((i) => i.transactionId === bill.id);

                    return (
                      <React.Fragment key={bill.id}>
                        <tr
                          onClick={() => toggleRow(bill.id!)}
                          className={cn(
                            'hover:bg-muted/30 dark:hover:bg-muted/10 transition-colors cursor-pointer group border-b border-slate-200/40 dark:border-slate-800/40',
                            isExpanded && 'bg-slate-50/50 dark:bg-slate-900/30'
                          )}
                        >
                          <td className="px-4 py-2.5 align-middle">
                            <p className="text-sm font-bold text-foreground tabular-nums">{timeStr}</p>
                            <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                              {bill.receiptNumber}
                            </p>
                          </td>
                          <td className="px-4 py-2.5 align-middle text-sm font-semibold text-foreground">
                            {bill.customerName ? (
                              <span className="uppercase">{bill.customerName}</span>
                            ) : (
                              <span className="text-muted-foreground/40 font-normal italic">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 align-middle text-sm font-bold text-foreground">
                            {bill.tableNumber && formatReceiptTable(bill.tableNumber) !== 'Bawa Pulang' ? (
                              <span>Meja {formatReceiptTable(bill.tableNumber)}</span>
                            ) : (
                              <span className="text-muted-foreground font-semibold text-xs">Bawa Pulang</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 align-middle max-w-0">
                            <KitchenItemSummary items={billItems} isExpanded={isExpanded} />
                          </td>
                          <td className="px-4 py-2.5 align-middle text-center">
                            <button
                              onClick={(e) => { e.stopPropagation(); onPrint(bill); }}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-colors mx-auto"
                              title="Cetak Tiket Dapur"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>

                        {/* Expanded detail row */}
                        {isExpanded && (
                          <tr className="bg-slate-50/10 dark:bg-slate-900/5">
                            <td colSpan={5} className="px-5 py-2.5 text-left">
                              <div className="inline-block bg-card border border-slate-300 dark:border-slate-800/60 rounded-xl p-3 shadow-sm text-xs text-foreground min-w-[240px] max-w-xl">
                                <div className="font-extrabold text-muted-foreground text-[10px] uppercase tracking-wider mb-2 border-b border-slate-200 dark:border-slate-800/50 pb-1">
                                  Rincian Pesanan
                                </div>
                                <div className="flex flex-col gap-1.5 font-semibold">
                                  {billItems.map((item, idx) => {
                                    const variantStr = item.selectedVariants && item.selectedVariants.length > 0
                                      ? ` (${item.selectedVariants.map((v: any) => v.optionName).join(' · ')})`
                                      : '';
                                    const notesStr = item.notes ? ` [Catatan: ${item.notes}]` : '';
                                    return (
                                      <div key={item.id} className="flex items-start gap-1">
                                        <span className="shrink-0 text-muted-foreground w-4">{idx + 1})</span>
                                        <span>
                                          {item.quantity}x {item.productName}
                                          <span className="text-muted-foreground font-medium text-[11px] ml-1.5">
                                            {variantStr}
                                            {notesStr && <span className="text-amber-600 dark:text-amber-400 ml-1.5">{notesStr}</span>}
                                          </span>
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>

              {/* ── Mobile Table ── */}
              <div className="md:hidden flex flex-col divide-y divide-slate-200/40 dark:divide-slate-800/40">
                {/* Table Header for Mobile */}
                <div className="px-4 py-2.5 bg-muted/10 flex items-center text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest border-b border-slate-300">
                  <div className="w-16">Waktu</div>
                  <div className="flex-1 px-2 text-right">Pemesan & Meja</div>
                  <div className="w-20 text-right">Aksi</div>
                </div>

                {/* Table Rows for Mobile */}
                {paginatedBills.map((bill) => {
                  const timeStr = safeFormatTime(bill.date);
                  const isExpanded = !!expandedRows[bill.id!];
                  const billItems = allTxItems.filter((i) => i.transactionId === bill.id);
                  const tableDisplay = formatReceiptTable(bill.tableNumber);
                  const isTakeaway = tableDisplay === 'Bawa Pulang';

                  return (
                    <div
                      key={bill.id}
                      className={cn(
                        'flex flex-col transition-colors border-b border-slate-200/40 dark:border-slate-800/40',
                        isExpanded ? 'bg-slate-50/50 dark:bg-slate-900/30' : 'hover:bg-muted/10'
                      )}
                    >
                      {/* Row Header */}
                      <div
                        onClick={() => toggleRow(bill.id!)}
                        className="flex items-center px-4 py-3 cursor-pointer text-[11px] sm:text-xs"
                      >
                        {/* Time */}
                        <div className="w-16 shrink-0">
                          <p className="font-bold text-foreground tabular-nums text-[11px] sm:text-xs">{timeStr}</p>
                          <p className="text-[9px] text-muted-foreground font-mono mt-0.5 leading-none">
                            {bill.receiptNumber}
                          </p>
                        </div>

                        {/* Customer Name & Table */}
                        <div className="flex-1 min-w-0 px-2 text-right">
                          <p className="font-bold text-foreground uppercase truncate text-[11px] sm:text-xs">
                            {bill.customerName || <span className="text-muted-foreground/40 font-normal italic text-[10px] sm:text-xs">—</span>}
                          </p>
                          <p className="text-[9px] sm:text-[10px] text-muted-foreground font-bold mt-0.5 leading-none">
                            {isTakeaway ? 'Bawa Pulang' : `Meja ${tableDisplay}`}
                          </p>
                        </div>

                        {/* Action buttons (Print & expand toggle) */}
                        <div className="w-20 shrink-0 flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); onPrint(bill); }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-colors"
                            title="Cetak Tiket Dapur"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <span
                            className={cn(
                              'text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors',
                              isExpanded
                                ? 'text-primary bg-primary/10 border-primary/20'
                                : 'text-muted-foreground bg-muted/50 border-border',
                            )}
                          >
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        </div>
                      </div>

                      {/* Expandable items detail */}
                      {isExpanded && (
                        <div className="px-4 pb-3 pt-0.5 bg-slate-50/10 dark:bg-slate-900/5 text-left">
                          <div className="inline-block bg-card border border-slate-300 dark:border-slate-800/60 rounded-xl p-2.5 shadow-sm text-[11px] text-foreground min-w-[200px] max-w-full">
                            <div className="font-extrabold text-muted-foreground text-[9px] uppercase tracking-wider mb-1.5 border-b border-slate-200 dark:border-slate-800/50 pb-0.5">
                              Rincian Pesanan
                            </div>
                            <div className="flex flex-col gap-1 font-semibold">
                              {billItems.map((item, idx) => {
                                const variantStr = item.selectedVariants && item.selectedVariants.length > 0
                                  ? ` (${item.selectedVariants.map((v: any) => v.optionName).join(' · ')})`
                                  : '';
                                const notesStr = item.notes ? ` [Catatan: ${item.notes}]` : '';
                                return (
                                  <div key={item.id} className="flex items-start gap-1">
                                    <span className="shrink-0 text-muted-foreground w-3.5">{idx + 1})</span>
                                    <span>
                                      {item.quantity}x {item.productName}
                                      <span className="text-muted-foreground font-medium text-[10px] ml-1">
                                        {variantStr}
                                        {notesStr && <span className="text-amber-600 dark:text-amber-400 ml-1">{notesStr}</span>}
                                      </span>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination controls inside scroll area */}
              {totalPages > 1 && (
                <div className="px-5 py-3 border-t border-slate-300 dark:border-slate-800/80 bg-muted/5 flex items-center justify-between shrink-0">
                  <span className="text-xs text-muted-foreground font-semibold">
                    Menampilkan {Math.min(filteredBills.length, (currentPage - 1) * itemsPerPage + 1)} - {Math.min(filteredBills.length, currentPage * itemsPerPage)} dari {filteredBills.length} pesanan
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8 px-2.5 text-xs font-bold border-slate-300 dark:border-slate-800"
                    >
                      Sebelumnya
                    </Button>
                    <span className="text-xs font-bold text-foreground min-w-[36px] text-center">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 px-2.5 text-xs font-bold border-slate-300 dark:border-slate-800"
                    >
                      Selanjutnya
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Analog Hour Picker Modal */}
      <AnalogHourPickerModal
        open={isHourPickerOpen}
        onClose={() => setIsHourPickerOpen(false)}
        selectedHour={filterHour}
        onSelect={setFilterHour}
      />
    </div>
  );
}
