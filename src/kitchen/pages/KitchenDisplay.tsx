import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { isToday } from 'date-fns';
import { Menu, Flame, History } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Capacitor } from '@capacitor/core';
import {
  useDbQuery, dbUpdate,
  type Transaction, type TransactionItemRecord, type StoreSettings,
} from '@/hooks/db-hooks';
import PrintActionModal from '@/components/PrintActionModal';
import KitchenSidebar from '../components/KitchenSidebar';
import KanbanColumn from '../components/KanbanColumn';
import KanbanTicket from '../components/KanbanTicket';
import HistoryView from '../components/HistoryView';
import KitchenReceiptModal from '../components/KitchenReceiptModal';
import { getStageConfigs, type KanbanStepKey, KITCHEN_STEPS, STEP_ORDER, type KitchenStep } from '../constants';

// ── Audio Singleton ──────────────────────────────────────────────────────────
// One Audio object reused forever. Prevents WebView AudioContext limit exhaustion
// when the button is tapped hundreds of times during a busy service.
const beepSound = typeof window !== 'undefined' ? new Audio('/beep.mp3') : null;

// ─────────────────────────────────────────────────────────────────────────────
export default function KitchenDisplay() {
  const navigate = useNavigate();

  // Safe date helper to prevent RangeError crashes
  const safeGetTime = useCallback((dateVal: any): number => {
    if (!dateVal) return 0;
    try {
      let d: Date;
      if (dateVal instanceof Date) {
        d = dateVal;
      } else if (typeof dateVal === 'object' && dateVal.seconds !== undefined) {
        d = new Date(dateVal.seconds * 1000);
      } else {
        d = new Date(dateVal);
      }
      const t = d.getTime();
      return isNaN(t) ? 0 : t;
    } catch {
      return 0;
    }
  }, []);

  // ── UI State ──
  const [activeTab, setActiveTab] = useState<'aktif' | 'riwayat'>('aktif');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('kitchen_sidebar_collapsed') === 'true',
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileKanbanTab, setMobileKanbanTab] = useState<KanbanStepKey>('diproses');
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [isFullscreen, setIsFullscreen] = useState(false);
  // kanbanTime: updates every 60 s — enough to refresh elapsed-time badges on
  // Kanban tickets without forcing a full re-render every single second.
  const [kanbanTime, setKanbanTime] = useState(new Date());

  // dayTrigger: checked every hour to detect a calendar-day change.
  // When the day changes, billsRiwayat is recomputed and yesterday's tickets
  // disappear from the screen automatically (fixes the midnight stale-data bug).
  const [dayTrigger, setDayTrigger] = useState(new Date().getDate());

  // Swipe logic untuk Mobile
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe || isRightSwipe) {
      const currentIndex = STEP_ORDER.indexOf(mobileKanbanTab);
      if (isLeftSwipe && currentIndex < STEP_ORDER.length - 1) {
        setMobileKanbanTab(STEP_ORDER[currentIndex + 1]);
      } else if (isRightSwipe && currentIndex > 0) {
        setMobileKanbanTab(STEP_ORDER[currentIndex - 1]);
      }
    }
  };

  // ── Modal State ──
  const [receiptTx, setReceiptTx] = useState<Transaction | null>(null);
  const [printActionTx, setPrintActionTx] = useState<Transaction | null>(null);

  // ── Data ──
  const storeSettings = useDbQuery<StoreSettings>('storeSettings')?.[0];
  const allBills = useDbQuery<Transaction>('transactions') || [];
  const allTxItems = useDbQuery<TransactionItemRecord>('transactionItems') || [];

  const stageConfigs = useMemo(() => getStageConfigs(storeSettings?.deliveryMode), [storeSettings?.deliveryMode]);

  // ── Derived ──
  const activeBills = useMemo(
    () =>
      allBills.filter(
        (t) =>
          t.needsKitchen !== false &&
          t.kitchenStatus &&
          !['diantarkan', 'pending'].includes(t.kitchenStatus!),
      ),
    [allBills],
  );

  const billsByStep = useMemo(
    () => ({
      diproses: activeBills.filter((t) => t.kitchenStatus === 'diproses').sort((a, b) => safeGetTime(a.date) - safeGetTime(b.date)),
      dimasak:  activeBills.filter((t) => t.kitchenStatus === 'dimasak').sort((a, b) => safeGetTime(a.date) - safeGetTime(b.date)),
      disiapkan: activeBills.filter((t) => t.kitchenStatus === 'disiapkan').sort((a, b) => safeGetTime(a.date) - safeGetTime(b.date)),
      siap:     activeBills.filter((t) => t.kitchenStatus === 'siap').sort((a, b) => safeGetTime(a.date) - safeGetTime(b.date)),
    }),
    [activeBills, safeGetTime],
  );

  // Today-only riwayat (excluding cancelled orders).
  // dayTrigger is included as a dependency so this list recomputes automatically
  // when the calendar day changes (fixes the midnight stale-data bug).
  const billsRiwayat = useMemo(() => {
    return allBills
      .filter((t) => {
        if (t.kitchenStatus !== 'diantarkan' || t.status === 'batal') return false;
        if (!t.date) return false;
        try {
          const d = t.date instanceof Date ? t.date : new Date(t.date);
          return !isNaN(d.getTime()) && isToday(d);
        } catch {
          return false;
        }
      })
      .sort((a, b) => safeGetTime(b.date) - safeGetTime(a.date));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBills, safeGetTime, dayTrigger]);

  const billCounts = useMemo(
    () => ({
      diproses: billsByStep.diproses.length,
      dimasak: billsByStep.dimasak.length,
      disiapkan: billsByStep.disiapkan.length,
      siap: billsByStep.siap.length,
      total: activeBills.length,
      riwayat: billsRiwayat.length,
    }),
    [billsByStep, activeBills, billsRiwayat],
  );

  const receiptItems = useMemo(
    () => allTxItems.filter((i) => receiptTx && i.transactionId === receiptTx.id),
    [allTxItems, receiptTx],
  );

  // ── Effects ──

  // 60-second ticker for Kanban elapsed-time display.
  // ONLY KanbanColumn/KanbanTicket re-renders, not the entire page.
  useEffect(() => {
    const timer = setInterval(() => setKanbanTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Hourly check for calendar-day change (midnight auto-reset of riwayat).
  useEffect(() => {
    const timer = setInterval(() => {
      const today = new Date().getDate();
      if (today !== dayTrigger) setDayTrigger(today);
    }, 3_600_000);
    return () => clearInterval(timer);
  }, [dayTrigger]);

  // Redirect if kitchen is disabled
  useEffect(() => {
    if (storeSettings && storeSettings.enableKitchen === false) {
      toast.error('Akses ditolak. Fitur dapur sedang dinonaktifkan.');
      localStorage.removeItem('kitchen_auth');
      navigate('/login');
    }
  }, [storeSettings, navigate]);

  // Unlock orientation on mount so user can physically rotate the device
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const initDeviceLayout = async () => {
      try {
        const { ScreenOrientation } = await import('@capacitor/screen-orientation');
        await ScreenOrientation.unlock().catch(console.warn);
      } catch (e) {
        console.warn("[KitchenDisplay] Failed to initialize device orientation:", e);
      }
    };
    initDeviceLayout();
  }, []);

  // Listen to orientation changes to update fullscreen states dynamically on native platforms
  useEffect(() => {
    const handleOrientation = async () => {
      const isLandscape = window.matchMedia('(orientation: landscape)').matches;
      
      if (Capacitor.isNativePlatform()) {
        try {
          const { StatusBar } = await import('@capacitor/status-bar');
          const { KeepAwake } = await import('@capacitor-community/keep-awake');
          
          if (isLandscape) {
            await StatusBar.hide().catch(console.warn);
            await KeepAwake.keepAwake().catch(console.warn);
            if (document.documentElement.requestFullscreen) {
              await document.documentElement.requestFullscreen().catch(console.warn);
            }
            setIsFullscreen(true);
          } else {
            if (document.fullscreenElement) {
              await document.exitFullscreen().catch(console.warn);
            }
            await StatusBar.show().catch(console.warn);
            await StatusBar.setOverlaysWebView({ overlay: true }).catch(console.warn);
            await KeepAwake.allowSleep().catch(console.warn);
            setIsFullscreen(false);
          }
        } catch (e) {
          console.warn("[KitchenDisplay] Error handling orientation transition:", e);
        }
      } else {
        setIsFullscreen(isLandscape);
      }
    };

    const query = window.matchMedia('(orientation: landscape)');
    query.addEventListener('change', handleOrientation);
    handleOrientation();
    
    return () => query.removeEventListener('change', handleOrientation);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!Capacitor.isNativePlatform()) {
        setIsFullscreen(!!document.fullscreenElement);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    localStorage.setItem('kitchen_sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // ── Callbacks ──
  const handleToggleDark = useCallback(() => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('mesenae-theme', next ? 'dark' : 'light');
  }, [isDark]);

  const handleToggleFullscreen = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const { ScreenOrientation } = await import('@capacitor/screen-orientation');
        if (!isFullscreen) {
          await ScreenOrientation.lock({ orientation: 'landscape' }).catch(console.warn);
        } else {
          await ScreenOrientation.lock({ orientation: 'portrait' }).catch(console.warn);
          await ScreenOrientation.unlock().catch(console.warn);
        }
      } catch (e) {
        console.error("[KitchenDisplay] Failed to toggle orientation:", e);
      }
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => console.error(err));
      } else {
        document.exitFullscreen();
      }
    }
  }, [isFullscreen]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('kitchen_auth');
    navigate('/login');
  }, [navigate]);

  const handleNextStep = useCallback(async (bill: Transaction) => {
    // Immediate audio feedback using the module-level singleton.
    // Resetting currentTime to 0 allows rapid repeated plays.
    try {
      if (beepSound) {
        beepSound.currentTime = 0;
        beepSound.play().catch((e) => console.warn('[Sound]', e));
      }
    } catch {}

    try {
      const currentIndex = KITCHEN_STEPS.indexOf(bill.kitchenStatus as KitchenStep);
      if (currentIndex >= 0 && currentIndex < KITCHEN_STEPS.length - 1) {
        const nextStatus = KITCHEN_STEPS[currentIndex + 1];
        await dbUpdate('transactions', bill.id!, { kitchenStatus: nextStatus });
        toast.success(`${bill.receiptNumber} → ${nextStatus.toUpperCase()}`);
      }
    } catch {
      toast.error('Gagal memperbarui status pesanan');
    }
  }, []);

  return (
    <div className="h-full flex flex-row overflow-hidden">

      {/* ── SIDEBAR ── */}
      {/* currentTime prop removed — KitchenSidebar now owns its own ClockWidget
          with an isolated 1-second ticker so only the clock text re-renders. */}
      <KitchenSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        billCounts={billCounts}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        storeSettings={storeSettings}
        isDark={isDark}
        onToggleDark={handleToggleDark}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        onLogout={handleLogout}
        stageConfigs={stageConfigs}
      />

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-slate-100/80 dark:bg-[#080c14]">

        {/* Mobile top bar */}
        <div className="kitchen-topbar md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm shrink-0">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-lg overflow-hidden bg-muted border border-border shrink-0">
              <img src={storeSettings?.logo || '/icon-192.png'} alt="" className="w-full h-full object-contain" />
            </div>
            <span className="text-sm font-black text-foreground uppercase tracking-tight truncate">
              Dapur {storeSettings?.storeName || 'MesenAe'}
            </span>
          </div>

          {/* Live status indicator for mobile */}
          {billCounts.total > 0 && (
            <div className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-1 shrink-0">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inset-0 rounded-full bg-primary/60" />
                <span className="relative rounded-full h-1.5 w-1.5 bg-primary" />
              </span>
              <span className="text-[11px] font-black tabular-nums">{billCounts.total}</span>
            </div>
          )}
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-hidden p-4 pb-20 md:p-5 flex flex-col gap-4 min-h-0">

          {activeTab === 'aktif' ? (
            <>
              {/* ── DESKTOP: 4-column Kanban board ── */}
              <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1 overflow-hidden min-h-0">
                {STEP_ORDER.map((stepKey) => (
                  <KanbanColumn
                    key={stepKey}
                    stepKey={stepKey}
                    config={stageConfigs[stepKey]}
                    bills={billsByStep[stepKey]}
                    currentTime={kanbanTime}
                    onPrintAction={setPrintActionTx}
                    onNextStep={handleNextStep}
                    allTxItems={allTxItems}
                  />
                ))}
              </div>

              {/* ── MOBILE: Horizontal status tabs + single column ── */}
              <div 
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="md:hidden flex flex-col flex-1 overflow-hidden gap-3 min-h-0"
              >

                {/* Status tab pills */}
                <div className="flex gap-1.5 overflow-x-auto py-1.5 shrink-0 scrollbar-none">
                  {STEP_ORDER.map((stepKey) => {
                    const cfg = stageConfigs[stepKey];
                    const count = billCounts[stepKey];
                    const isActive = mobileKanbanTab === stepKey;
                    return (
                      <button
                        key={stepKey}
                        onClick={() => setMobileKanbanTab(stepKey)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold whitespace-nowrap transition-all shrink-0 focus:outline-none',
                          isActive
                            ? cn(cfg.countBadge)
                            : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/60',
                        )}
                      >
                        <cfg.Icon className="w-3 h-3 shrink-0" />
                        <span>{cfg.shortLabel}</span>
                        {count > 0 && (
                          <span
                            className={cn(
                              'font-black text-[10px] px-1.5 rounded-full min-w-[18px] text-center',
                              isActive ? 'bg-current/20' : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Ticket list for selected mobile tab */}
                <div className="grid grid-cols-2 gap-3 items-start flex-1 overflow-y-auto min-h-0 pb-20">
                  {billsByStep[mobileKanbanTab].length === 0 ? (
                    <div className="col-span-2 min-h-[180px] flex flex-col items-center justify-center text-center opacity-40 bg-card rounded-2xl border border-border">
                      {React.createElement(stageConfigs[mobileKanbanTab].Icon, {
                        className: 'w-10 h-10 text-muted-foreground mb-3',
                      })}
                      <p className="text-sm font-semibold text-muted-foreground">
                        {stageConfigs[mobileKanbanTab].emptyText}
                      </p>
                    </div>
                  ) : (
                    billsByStep[mobileKanbanTab].map((bill) => (
                      <KanbanTicket
                        key={bill.id}
                        bill={bill}
                        config={stageConfigs[mobileKanbanTab]}
                        currentTime={kanbanTime}
                        onPrintAction={setPrintActionTx}
                        onNextStep={handleNextStep}
                        items={allTxItems.filter((i) => i.transactionId === bill.id)}
                        compact={true}
                      />
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            /* ── HISTORY VIEW ── */
            <HistoryView
              bills={billsRiwayat}
              allTxItems={allTxItems}
              onPrint={setReceiptTx}
              storeSettings={storeSettings}
            />
          )}
        </div>

        {/* ── MOBILE BOTTOM NAV TAB BAR ── */}
        <div className="kitchen-bottombar md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm">
          <div className="flex">
            {(
              [
                { key: 'aktif' as const, label: 'Pesanan Aktif', Icon: Flame, count: billCounts.total, pulse: true },
                { key: 'riwayat' as const, label: 'Riwayat', Icon: History, count: billCounts.riwayat, pulse: false },
              ] as const
            ).map(({ key, label, Icon, count, pulse }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1 py-3 px-2 transition-colors relative focus:outline-none',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {/* Active indicator line */}
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-primary rounded-full" />
                  )}
                  {/* Icon with count badge */}
                  <div className="relative">
                    <Icon className={cn('w-5 h-5', isActive && pulse && 'animate-pulse')} />
                    {count > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-primary text-primary-foreground text-[9px] font-black rounded-full flex items-center justify-center px-0.5 leading-none tabular-nums">
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold leading-tight">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── PRINT ACTION MODAL (from kanban ticket printer icon) ── */}
      {printActionTx && (() => {
        const txItems = allTxItems.filter((i) => i.transactionId === printActionTx.id);
        return (
          <PrintActionModal
            open={!!printActionTx}
            onClose={() => setPrintActionTx(null)}
            transaction={printActionTx}
            items={txItems}
            storeSettings={storeSettings}
            showCustomerReceipt={false}
            showKitchenReceipt={true}
          />
        );
      })()}

      {/* ── RECEIPT MODAL (from history row print icon) ── */}
      {receiptTx && (
        <KitchenReceiptModal
          open={!!receiptTx}
          onClose={() => setReceiptTx(null)}
          transaction={receiptTx}
          items={receiptItems}
          storeSettings={storeSettings}
        />
      )}
    </div>
  );
}
