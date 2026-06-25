import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

/** 
 * Komponen Skeleton Dasar 
 * Dimodernisasi dengan warna yang lebih menyatu dengan tema (light/dark)
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted-foreground/10',
        className
      )}
    />
  );
}

/** Dashboard Skeleton */
export function DashboardSkeleton() {
  return (
    <div className="px-4 pt-6 pb-24 space-y-6 w-full mx-auto animate-in fade-in duration-300">
      {/* Date Badge */}
      <div className="flex justify-end">
        <Skeleton className="h-7 w-48 rounded-xl" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2].map(i => (
          <div key={i} className="rounded-2xl border-0 shadow-sm bg-card p-4 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <Skeleton className="h-4 w-24 mb-3" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl border-0 shadow-sm bg-card p-4 flex flex-col items-center gap-2">
              <Skeleton className="w-11 h-11 rounded-xl" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-20 rounded-md" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-2xl border-0 shadow-sm bg-card p-3 flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-2.5 w-12" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Product List Skeleton */
export function ProductsSkeleton() {
  return (
    <div className="px-4 pt-6 pb-24 space-y-6 w-full mx-auto animate-in fade-in duration-300">
      {/* Action Header */}
      <div className="flex justify-end">
        <Skeleton className="h-11 w-40 rounded-xl" />
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-card border border-border/50 p-3 rounded-2xl shadow-sm flex flex-col sm:flex-row gap-3">
        <Skeleton className="h-11 flex-1 rounded-xl" />
        <Skeleton className="h-11 w-full sm:w-[180px] rounded-xl" />
      </div>

      {/* Stats Counter */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-32 rounded-full" />
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="rounded-2xl border border-border/50 bg-card p-3 sm:p-4 flex items-center gap-4 shadow-sm">
            <Skeleton className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-5 sm:h-6 w-3/4 max-w-[200px]" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-md" />
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0 ml-auto">
              <div className="text-right space-y-1">
                <Skeleton className="h-3 w-16 hidden sm:block ml-auto" />
                <Skeleton className="h-5 sm:h-6 w-24" />
              </div>
              <Skeleton className="h-5 w-20 rounded-lg mt-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Reports Skeleton */
export function ReportsSkeleton() {
  return (
    <div className="px-5 pt-8 pb-20 space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32 rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>

      {/* Range Picker */}
      <Skeleton className="h-12 w-full max-w-sm rounded-xl" />

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-2xl border border-border/50 bg-card p-4 flex flex-col items-center justify-center text-center space-y-3 shadow-sm">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Main Chart Area */}
      <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-[280px] w-full rounded-xl" />
      </div>
    </div>
  );
}

/** Transaction History Skeleton */
export function TransactionHistorySkeleton() {
  return (
    <div className="px-4 pt-3 pb-24 space-y-6 w-full mx-auto animate-in fade-in duration-300">
      {/* Control Panel */}
      <div className="bg-card border border-border/50 p-4 sm:p-5 rounded-[2rem] shadow-sm mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <Skeleton className="h-11 flex-1 max-w-md rounded-xl" />
          <Skeleton className="h-11 w-full md:w-[280px] rounded-xl shrink-0" />
        </div>
        <div className="h-px bg-border/50 w-full" />
        <div className="flex flex-wrap items-center gap-2.5">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-5 w-4" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {[1, 2].map(i => (
          <div key={i} className="border border-border/50 shadow-sm bg-card rounded-[1.5rem] p-5 flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="w-12 h-12 rounded-full shrink-0" />
          </div>
        ))}
      </div>

      {/* Transaction List */}
      <div className="space-y-8">
        {[1, 2].map(group => (
          <div key={group} className="space-y-3">
            <div className="flex items-center gap-3 px-1">
              <Skeleton className="w-4 h-4 rounded-sm" />
              <Skeleton className="h-4 w-40 rounded-md" />
              <Skeleton className="h-4 w-12 rounded-md" />
            </div>
            
            <div className="grid gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="border border-border/60 shadow-sm bg-card rounded-2xl p-4 flex items-center gap-4">
                  <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
                  <div className="flex-1 min-w-0 flex flex-col justify-center space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-4 w-12 rounded-md" />
                      </div>
                      <Skeleton className="h-4 w-10 rounded-md shrink-0" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-3 w-40" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Skeleton className="h-5 w-20 rounded-md" />
                      <Skeleton className="h-5 w-20 rounded-md" />
                    </div>
                  </div>
                  <Skeleton className="w-5 h-5 rounded-md shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Vouchers Skeleton */
export function VouchersSkeleton() {
  return (
    <div className="px-4 pt-6 pb-24 space-y-6 w-full mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-11 w-36 rounded-xl" />
      </div>

      {/* Vouchers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-[1.5rem] border-0 bg-card shadow-md flex h-[160px] overflow-hidden relative">
            {/* Dashed line effect */}
            <div className="absolute left-[30%] sm:left-[25%] top-0 bottom-0 border-l-2 border-dashed border-border/50 z-10" />
            
            {/* Left part */}
            <div className="w-[30%] sm:w-[25%] bg-muted/20 flex flex-col items-center justify-center p-4">
              <Skeleton className="w-8 h-8 rounded-full mb-2" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-10 mt-1" />
            </div>

            {/* Right part */}
            <div className="flex-1 p-5 pl-8 flex flex-col justify-between relative z-20">
              <div className="space-y-2.5">
                <Skeleton className="h-4 w-12 rounded-full" />
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
              <div className="flex justify-end gap-2">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Settings Skeleton */
export function SettingsSkeleton() {
  // Check if we are loading a specific tab page
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const hasTab = searchParams ? searchParams.has('tab') : false;

  if (hasTab) {
    const tab = searchParams ? searchParams.get('tab') : null;

    // 1. INFORMASI TOKO (Store Info)
    if (tab === 'toko') {
      return (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Store hero card skeleton */}
          <div className="bg-card border border-border/50 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between gap-4 p-4 bg-gradient-to-r from-primary/5 via-primary/2 to-transparent animate-pulse">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <Skeleton className="w-14 h-14 rounded-xl shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className="h-4 w-1/3 rounded" />
                  <Skeleton className="h-3 w-2/3 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
              </div>
              <Skeleton className="h-8 w-16 rounded-lg shrink-0" />
            </div>
          </div>

          {/* Cards for options */}
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-36 rounded" />
                <div className="bg-card border border-border/50 rounded-xl p-4 space-y-3 shadow-sm">
                  <Skeleton className="h-3.5 w-2/3 rounded" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // 2. PENGATURAN STRUK (Receipt Settings)
    if (tab === 'struk') {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in duration-200">
          {/* Left: controls skeleton */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-card border border-border/50 rounded-2xl p-6 space-y-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-border/80">
                <Skeleton className="h-5 w-32 rounded animate-pulse" />
                <Skeleton className="h-8 w-20 rounded-xl animate-pulse" />
              </div>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
                    <div className="space-y-1.5 flex-1 animate-pulse">
                      <Skeleton className="h-4 w-1/4 rounded" />
                      <Skeleton className="h-3 w-1/2 rounded" />
                    </div>
                    <Skeleton className="h-5 w-10 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Right: Live Preview skeleton */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-border/80 flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-4 h-4 rounded-full" />
                  <Skeleton className="h-4 w-32 rounded" />
                </div>
                <Skeleton className="h-3 w-16 rounded" />
              </div>
              <div className="p-6 bg-slate-50/50 dark:bg-zinc-900/50 flex flex-col items-center justify-center min-h-[480px]">
                <Skeleton className="w-[280px] h-[400px] rounded-xl bg-white dark:bg-zinc-900 border border-border" />
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 3. METODE PEMBAYARAN (Payment Methods)
    if (tab === 'pembayaran') {
      return (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border/50 bg-muted-foreground/5 animate-pulse">
            <div className="flex items-center gap-2 flex-1">
              <Skeleton className="w-4 h-4 rounded-full shrink-0" />
              <Skeleton className="h-4 w-1/3 rounded" />
            </div>
            <Skeleton className="h-8 w-20 rounded-lg shrink-0" />
          </div>
          <div className="bg-card border border-border/50 rounded-xl overflow-hidden shadow-sm">
            {[1, 2, 3, 4].map((i, idx) => (
              <div key={i} className={cn('flex items-center gap-3 px-4 py-3 border-b border-border/50', idx === 3 && 'border-b-0')}>
                <Skeleton className="w-4 h-4 rounded" />
                <Skeleton className="w-5 h-5 rounded-md" />
                <div className="flex-1 space-y-1.5 animate-pulse">
                  <Skeleton className="h-4 w-1/3 rounded" />
                  <Skeleton className="h-3 w-1/4 rounded" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="w-7 h-7 rounded-md" />
                  <Skeleton className="w-7 h-7 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // 4. MANAJEMEN PENGGUNA (Users Tab)
    if (tab === 'pengguna') {
      return (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border/50 bg-muted-foreground/5 animate-pulse">
            <div className="flex items-center gap-2 flex-1">
              <Skeleton className="w-4 h-4 rounded-full shrink-0" />
              <Skeleton className="h-4 w-2/3 rounded" />
            </div>
            <Skeleton className="h-8 w-20 rounded-lg shrink-0" />
          </div>
          <div className="bg-card border border-border/50 rounded-xl overflow-hidden shadow-sm">
            {[1, 2, 3].map((i, idx) => (
              <div key={i} className={cn('flex items-center gap-3 px-4 py-3 border-b border-border/50', idx === 2 && 'border-b-0')}>
                <Skeleton className="w-9 h-9 rounded-full shrink-0 animate-pulse" />
                <div className="flex-1 space-y-1.5 animate-pulse">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-28 rounded" />
                    <Skeleton className="h-4 w-12 rounded" />
                  </div>
                  <Skeleton className="h-3 w-40 rounded" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="w-7 h-7 rounded-md" />
                  <Skeleton className="w-7 h-7 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Default fallback for other tabs (display, data, about, printer)
    return (
      <div className="space-y-5 animate-in fade-in duration-200">
        <div className="bg-card border border-border/50 rounded-2xl p-6 space-y-6 shadow-sm">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5 last:border-0 last:pb-0">
              <div className="space-y-2 flex-1 animate-pulse">
                <Skeleton className="h-4.5 w-1/3 min-w-[120px] rounded" />
                <Skeleton className="h-3 w-2/3 min-w-[200px] rounded" />
              </div>
              <Skeleton className="h-9 w-24 rounded-xl shrink-0 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Otherwise show the default grid menu skeleton
  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5 md:py-7 animate-in fade-in duration-300">
      {/* Grid container matching Settings.tsx */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div
            key={i}
            className="flex flex-col p-4 sm:p-6 rounded-2xl border border-border/50 bg-card shadow-sm"
          >
            {/* Icon placeholder */}
            <Skeleton className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl mb-3 sm:mb-4 shrink-0 bg-muted/70" />
            
            {/* Title placeholder */}
            <Skeleton className="h-4 w-24 sm:w-28 mb-2 bg-muted/80 rounded" />
            
            {/* Description lines placeholder */}
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3 w-full max-w-[160px] bg-muted/50 rounded" />
              <Skeleton className="h-3 w-[75%] max-w-[110px] bg-muted/40 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Generic Page Loading Skeleton */
export function PageSkeleton() {
  return (
    <div className="px-5 pt-8 pb-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      
      <Skeleton className="h-14 w-full rounded-xl" />
      
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-2xl border border-border/50 bg-card p-5 space-y-3 shadow-sm">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Cashier Catalog & Cart Skeleton with 2-column grid on mobile */
export function CashierSkeleton() {
  return (
    <div className="pt-2 pb-24 w-full flex flex-col animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row gap-0 md:gap-4">
        {/* Catalog Skeleton */}
        <div className="flex-1 min-w-0 flex flex-col space-y-3">
          {/* Search Input Skeleton */}
          <div className="flex gap-2 mb-2 py-1">
            <Skeleton className="flex-1 h-10 rounded-xl" />
            <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
          </div>
          
          {/* SKU Input Skeleton */}
          <div className="flex gap-2 mb-2 py-1">
            <Skeleton className="flex-1 h-10 rounded-xl" />
          </div>

          {/* Category Chips Skeleton */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-3 pb-1 pr-4">
            <Skeleton className="h-7 w-16 rounded-full shrink-0" />
            <Skeleton className="h-7 w-20 rounded-full shrink-0" />
            <Skeleton className="h-7 w-24 rounded-full shrink-0" />
            <Skeleton className="h-7 w-16 rounded-full shrink-0" />
          </div>

          {/* Product Grid Skeleton: 2 columns on mobile/tablet, 3-4 on larger displays */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="bg-card border border-border/50 shadow-sm rounded-xl overflow-hidden">
                <Skeleton className="w-full aspect-square rounded-t-xl" />
                <div className="p-2.5 space-y-2">
                  <Skeleton className="h-3 w-3/4 rounded" />
                  <Skeleton className="h-4 w-1/2 rounded" />
                  <Skeleton className="h-2.5 w-1/3 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Cart Skeleton (Desktop Only) */}
        <div className="hidden md:flex md:w-80 lg:w-96 flex-col bg-card rounded-xl border border-border/50 shrink-0 h-fit min-h-[450px] self-start shadow-sm p-4 space-y-3">
          <Skeleton className="h-5 w-32 rounded" />
          <div className="flex-1 space-y-3 py-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-muted-foreground/5 animate-pulse rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-14 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/** QRIS Dinamis Menu Skeleton with split-column desktop layout */
export function QrisDinamisSkeleton() {
  return (
    <div className="pb-24 space-y-6 w-full animate-in fade-in duration-300">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri — Input */}
        <div className="xl:col-span-5 space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50 bg-muted-foreground/5 space-y-2">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-3 w-48 rounded" />
            </div>
            <div className="p-5 space-y-4">
              {/* Textarea placeholder */}
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-20 rounded" />
                <Skeleton className="h-28 w-full rounded-xl" />
              </div>
              {/* Buttons placeholder */}
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-11 rounded-xl" />
                <Skeleton className="h-11 rounded-xl" />
              </div>
            </div>
          </div>
        </div>

        {/* Kolom Kanan — Info / Result Placeholder */}
        <div className="xl:col-span-7 space-y-4">
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted-foreground/5 flex flex-col items-center justify-center py-16 text-center px-6 space-y-4">
            <Skeleton className="w-16 h-16 rounded-2xl" />
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-3 w-56 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

