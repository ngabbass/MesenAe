import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

// --- Icons ---
import {
  Settings as SettingsIcon, 
  Store, 
  CreditCard,
  Printer, 
  Database, 
  Smartphone, 
  Users,
  ChevronLeft,
  ChevronRight, 
  BadgeCheck, 
  ChefHat, 
  Shield,
  ArrowLeft
} from 'lucide-react';
import { RpIcon } from '@/components/ui/RpIcon';

// --- Hooks & Utils ---
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDbQuery, type StoreSettings } from '@/hooks/db-hooks';
import { Skeleton } from '@/admin/components/SkeletonLoaders';

// --- Lazy-load Tab Components untuk kurangi chunk size Settings ---
const StoreInfoTab      = lazy(() => import('./settings/StoreInfoTab'));
const ReceiptSettingsTab = lazy(() => import('./settings/ReceiptSettingsTab'));
const PrinterSettingsTab = lazy(() => import('./settings/PrinterSettingsTab'));
const PaymentMethodsTab  = lazy(() => import('./settings/PaymentMethodsTab'));
const UsersTab           = lazy(() => import('./settings/UsersTab'));
const SelforderTab       = lazy(() => import('./settings/SelforderTab'));
const DataBackupTab      = lazy(() => import('./settings/DataBackupTab'));
const AboutTab           = lazy(() => import('./settings/AboutTab'));

/* ============================================================================
   TYPE DEFINITIONS
============================================================================ */

type Tab = 'toko' | 'struk' | 'printer' | 'pembayaran' | 'pengguna' | 'selforder' | 'data' | 'tentang';

interface TabItem { 
  id: Tab; 
  label: string; 
  description: string;
  icon: React.ReactNode;
  
  // Konfigurasi Warna Dinamis untuk Efek Glow Ikon
  colorTheme: {
    iconBg: string;       // Background ikon saat normal
    iconText: string;     // Warna ikon saat normal
    hoverIconBg: string;  // Background ikon saat card di-hover (solid)
    hoverIconText: string;// Warna ikon saat card di-hover (putih)
    hoverGlow: string;    // Efek cahaya (shadow) yang memancar
  };
}

/* ============================================================================
   TAB CONFIGURATION
============================================================================ */

const TABS: TabItem[] = [
  { 
    id: 'toko',        
    label: 'Informasi Toko',    
    description: 'Kelola nama, logo, alamat, & kontak.',
    icon: <Store className="w-5 h-5 sm:w-6 sm:h-6" />,
    colorTheme: {
      iconBg: 'bg-orange-500/10 dark:bg-orange-500/20',
      iconText: 'text-orange-600 dark:text-orange-500',
      hoverIconBg: 'group-hover:bg-orange-500',
      hoverIconText: 'group-hover:text-white',
      hoverGlow: 'group-hover:shadow-[0_0_16px_rgba(249,115,22,0.6)]'
    }
  },
  { 
    id: 'struk',       
    label: 'Pengaturan Struk', 
    description: 'Kustomisasi layout & logo struk.',
    icon: <RpIcon className="w-5 h-5 sm:w-6 sm:h-6" />,
    colorTheme: {
      iconBg: 'bg-blue-500/10 dark:bg-blue-500/20',
      iconText: 'text-blue-600 dark:text-blue-500',
      hoverIconBg: 'group-hover:bg-blue-505',
      hoverIconText: 'group-hover:text-white',
      hoverGlow: 'group-hover:shadow-[0_0_16px_rgba(59,130,246,0.6)]'
    }
  },
  { 
    id: 'printer',     
    label: 'Pengaturan Printer', 
    description: 'Atur printer kasir dan dapur.',
    icon: <Printer className="w-5 h-5 sm:w-6 sm:h-6" />,
    colorTheme: {
      iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      iconText: 'text-emerald-600 dark:text-emerald-500',
      hoverIconBg: 'group-hover:bg-emerald-500',
      hoverIconText: 'group-hover:text-white',
      hoverGlow: 'group-hover:shadow-[0_0_16px_rgba(16,185,129,0.6)]'
    }
  },
  { 
    id: 'pembayaran',  
    label: 'Metode Pembayaran',   
    description: 'Metode tunai, transfer, & QRIS.',
    icon: <CreditCard className="w-5 h-5 sm:w-6 sm:h-6" />,
    colorTheme: {
      iconBg: 'bg-purple-500/10 dark:bg-purple-500/20',
      iconText: 'text-purple-600 dark:text-purple-500',
      hoverIconBg: 'group-hover:bg-purple-500',
      hoverIconText: 'group-hover:text-white',
      hoverGlow: 'group-hover:shadow-[0_0_16px_rgba(168,85,247,0.6)]'
    }
  },
  { 
    id: 'pengguna',    
    label: 'Manajemen Pengguna',   
    description: 'Kelola akun & hak akses staf.',
    icon: <Users className="w-5 h-5 sm:w-6 sm:h-6" />,
    colorTheme: {
      iconBg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
      iconText: 'text-indigo-600 dark:text-indigo-500',
      hoverIconBg: 'group-hover:bg-indigo-500',
      hoverIconText: 'group-hover:text-white',
      hoverGlow: 'group-hover:shadow-[0_0_16px_rgba(99,102,241,0.6)]'
    }
  },
  { 
    id: 'selforder',    
    label: 'Self Order',      
    description: 'Konfigurasi Web Selforder',
    icon: <Smartphone className="w-5 h-5 sm:w-6 sm:h-6" />,
    colorTheme: {
      iconBg: 'bg-pink-500/10 dark:bg-pink-500/20',
      iconText: 'text-pink-600 dark:text-pink-500',
      hoverIconBg: 'group-hover:bg-pink-500',
      hoverIconText: 'group-hover:text-white',
      hoverGlow: 'group-hover:shadow-[0_0_16px_rgba(236,72,153,0.6)]'
    }
  },
  { 
    id: 'data',        
    label: 'Data & Backup', 
    description: 'Backup JSON, excel & reset.',
    icon: <Database className="w-5 h-5 sm:w-6 sm:h-6" />,
    colorTheme: {
      iconBg: 'bg-amber-500/10 dark:bg-amber-500/20',
      iconText: 'text-amber-600 dark:text-amber-500',
      hoverIconBg: 'group-hover:bg-amber-500',
      hoverIconText: 'group-hover:text-white',
      hoverGlow: 'group-hover:shadow-[0_0_16px_rgba(245,158,11,0.6)]'
    }
  },
  { 
    id: 'tentang',     
    label: 'Tentang',      
    description: 'Versi aplikasi & info lisensi.',
    icon: <SettingsIcon className="w-5 h-5 sm:w-6 sm:h-6" />,
    colorTheme: {
      iconBg: 'bg-slate-500/10 dark:bg-slate-500/20',
      iconText: 'text-slate-600 dark:text-slate-500',
      hoverIconBg: 'group-hover:bg-slate-600',
      hoverIconText: 'group-hover:text-white',
      hoverGlow: 'group-hover:shadow-[0_0_16px_rgba(71,85,105,0.6)]'
    }
  },
];

/* ============================================================================
   MAIN SETTINGS COMPONENT
============================================================================ */

export default function Settings() {
  const { canEdit, isAdmin } = usePermissions();
  const hasEditAccess = canEdit('settings');
  const storeSettings = useDbQuery<StoreSettings>('storeSettings')?.[0];

  // Filter tabs: hanya admin yang bisa lihat "Informasi Toko" dan "Akses Pengguna"
  const visibleTabs = TABS.filter(tab => {
    if (!isAdmin && (tab.id === 'toko' || tab.id === 'pengguna')) {
      return false; // Sembunyikan tab ini dari non-admin
    }
    return true;
  });

  const [searchParams, setSearchParams] = useSearchParams();

  // Derive activeTab directly from URL query param to eliminate state loops
  const activeTab: Tab | 'menu' = (() => {
    const tabFromUrl = searchParams.get('tab') as Tab;
    if (tabFromUrl && visibleTabs.some(t => t.id === tabFromUrl)) return tabFromUrl;
    return 'menu';
  })();

  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left');
  const prevTabRef = useRef<Tab | 'menu'>(activeTab);
  const touchStartRef = useRef<number | null>(null);
  const touchEndRef = useRef<number | null>(null);

  // Sync slide direction animation reactive to activeTab changes
  useEffect(() => {
    if (activeTab !== prevTabRef.current) {
      if (activeTab !== 'menu' && prevTabRef.current !== 'menu') {
        const currentIndex = visibleTabs.findIndex(t => t.id === prevTabRef.current);
        const targetIndex = visibleTabs.findIndex(t => t.id === activeTab);
        if (targetIndex > currentIndex) {
          setSlideDirection('left');
        } else if (targetIndex < currentIndex) {
          setSlideDirection('right');
        }
      }
      prevTabRef.current = activeTab;
    }
  }, [activeTab, visibleTabs]);

  const changeTab = (tabId: Tab | 'menu') => {
    if (tabId === 'menu') {
      setSearchParams({}, { replace: true });
      return;
    }
    
    // Prevent access to hidden tabs
    if (!visibleTabs.some(t => t.id === tabId)) {
      return;
    }
    
    setSearchParams({ tab: tabId }, { replace: true });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (activeTab === 'menu') return;
    touchStartRef.current = e.touches[0].clientX;
    touchEndRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (activeTab === 'menu') return;
    touchEndRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (activeTab === 'menu') return;
    if (touchStartRef.current === null || touchEndRef.current === null) return;
    
    const diffX = touchStartRef.current - touchEndRef.current;
    const minSwipeDistance = 60; 

    if (Math.abs(diffX) > minSwipeDistance) {
      const currentIndex = visibleTabs.findIndex(t => t.id === activeTab);
      if (diffX > 0) {
        if (currentIndex < visibleTabs.length - 1) {
          setSearchParams({ tab: visibleTabs[currentIndex + 1].id }, { replace: true });
        }
      } else {
        if (currentIndex > 0) {
          setSearchParams({ tab: visibleTabs[currentIndex - 1].id }, { replace: true });
        }
      }
    }
    touchStartRef.current = null;
    touchEndRef.current = null;
  };

  // Scroll to top of settings container when tab changes
  useEffect(() => {
    if (activeTab === 'menu') return;
    const scrollContainer = document.getElementById('settings-scroll-container');
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeTab]);

  const activeTabItem = visibleTabs.find(t => t.id === activeTab);

  const handlePrevTab = () => {
    if (activeTab === 'menu') return;
    const currentIndex = visibleTabs.findIndex(t => t.id === activeTab);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : visibleTabs.length - 1;
    setSearchParams({ tab: visibleTabs[prevIndex].id }, { replace: true });
  };

  const handleNextTab = () => {
    if (activeTab === 'menu') return;
    const currentIndex = visibleTabs.findIndex(t => t.id === activeTab);
    const nextIndex = currentIndex < visibleTabs.length - 1 ? currentIndex + 1 : 0;
    setSearchParams({ tab: visibleTabs[nextIndex].id }, { replace: true });
  };

  /* ============================================================================
     RENDER
  ============================================================================ */
  return (
    // Latar belakang dan susunan layout persis dengan aslinya (tidak ada kotak hitam)
    // -mx-3 md:-mx-6 lg:-mx-8 untuk counteract parent app-main padding, lalu re-apply sendiri
    <div className="flex flex-col h-full min-h-0 bg-[#f8fafc] dark:bg-slate-950/40 -mx-3 md:-mx-6 lg:-mx-8">
      
      {/* ── Animasi Transisi ── */}
      <style>{`
        @keyframes settingsSlideNext {
          0% { transform: translateX(30px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes settingsSlidePrev {
          0% { transform: translateX(-30px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        .animate-settings-slide-next {
          animation: settingsSlideNext 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-settings-slide-prev {
          animation: settingsSlidePrev 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* ── Grid Menu Pengaturan ── */}
      {activeTab === 'menu' && (
        <div className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 pt-1 pb-5 md:pt-2 md:pb-7">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => changeTab(tab.id)}
                className={cn(
                  "flex flex-col text-left p-4 sm:p-5 rounded-2xl outline-none group",
                  // Card UI: Jelas di Light Mode, tanpa animasi naik berlebihan (hanya tipis -translate-y-0.5)
                  "bg-card border border-slate-200 dark:border-zinc-800/80 shadow-sm",
                  "hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                )}
              >
                {/* IKON MENYALA (GLOW)
                  Di sini magis animasinya terjadi: latar berubah warna solid dan mengeluarkan glow 
                */}
                <div className={cn(
                  "w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-3 sm:mb-4 transition-all duration-300",
                  tab.colorTheme.iconBg,
                  tab.colorTheme.iconText,
                  tab.colorTheme.hoverIconBg,
                  tab.colorTheme.hoverIconText,
                  tab.colorTheme.hoverGlow
                )}>
                  {tab.icon}
                </div>

                <h3 className="text-[13px] sm:text-sm font-bold text-foreground mb-1 flex items-center gap-1 transition-colors group-hover:text-primary">
                  {tab.label}
                  <ChevronRight className="w-3.5 h-3.5 opacity-50 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
                </h3>
                
                <p className="text-[10px] sm:text-[11px] font-medium leading-relaxed text-muted-foreground flex-1">
                  {tab.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab Content yang Aktif (Unified Scroll Container) ── */}
      {activeTab !== 'menu' && (
        <div 
          id="settings-scroll-container"
          key={activeTab}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={cn(
            "flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 pt-1.5 pb-6 space-y-3 transition-all duration-300 ease-out",
            slideDirection === 'left' ? "animate-settings-slide-next" : "animate-settings-slide-prev"
          )}
        >
          {/* Header Row: Tombol Kembali (Kiri) & Header Tab (Tengah) */}
          <div className="relative w-full select-none bg-transparent pb-2 flex items-center justify-center min-h-[50px]">
            {/* Tombol Kembali (Kiri Mutlak) */}
            <div className="absolute left-0 flex items-center h-full">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => changeTab('menu')}
                className="h-9 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent/40 gap-1.5 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Kembali ke Menu</span>
                <span className="inline sm:hidden">Kembali</span>
              </Button>
            </div>

            {/* Header di Tengah */}
            <div className="flex flex-col items-center justify-center text-center px-24 sm:px-36">
              <h1 className="text-sm sm:text-base font-extrabold text-foreground tracking-tight flex items-center justify-center gap-2">
                <span className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center shadow-sm shrink-0",
                  activeTabItem?.colorTheme.iconBg,
                  activeTabItem?.colorTheme.iconText
                )}>
                  <span className="scale-75 flex items-center justify-center">{activeTabItem?.icon}</span>
                </span>
                <span>{activeTabItem?.label}</span>
              </h1>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 leading-relaxed hidden sm:block max-w-[280px]">
                {activeTabItem?.description}
              </p>
            </div>
          </div>
          
          {/* Wrapper untuk Slider Row agar terpusat di bawah header */}
          <div className="w-full flex flex-col items-center pb-2">

            {/* Navigation Slider Row (Di bawah header, ada tombol kanan kiri dan indicators) */}
            <div className="flex items-center justify-between w-full max-w-xs px-4 mt-1">
              {/* Left navigation button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevTab}
                className="h-8 px-2 rounded-lg border border-border/60 bg-background text-muted-foreground hover:text-foreground hover:bg-accent transition-all flex items-center gap-1 text-[11px] font-semibold shadow-sm"
                title="Sebelumnya (Swipe Kanan)"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Sebelumnya</span>
              </Button>

              {/* Slide hint dot indicators (Tengah) */}
              <div className="flex items-center gap-1.5 px-2">
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => changeTab(tab.id)}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      tab.id === activeTab 
                        ? "w-4 bg-primary" 
                        : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    )}
                    title={`Ke ${tab.label}`}
                  />
                ))}
              </div>

              {/* Right navigation button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextTab}
                className="h-8 px-2 rounded-lg border border-border/60 bg-background text-muted-foreground hover:text-foreground hover:bg-accent transition-all flex items-center gap-1 text-[11px] font-semibold shadow-sm"
                title="Selanjutnya (Swipe Kiri)"
              >
                <span className="hidden sm:inline">Berikutnya</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="space-y-4">
            <Suspense key={activeTab} fallback={<div className="space-y-3"><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-16 rounded-xl" /></div>}>
              {activeTab === 'toko'       && isAdmin && <StoreInfoTab hasEditAccess={hasEditAccess} />}
              {activeTab === 'struk'      && <ReceiptSettingsTab storeSettings={storeSettings} hasEditAccess={hasEditAccess} />}
              {activeTab === 'printer'    && <PrinterSettingsTab hasEditAccess={hasEditAccess} />}
              {activeTab === 'pembayaran' && <PaymentMethodsTab hasEditAccess={hasEditAccess} />}
              {activeTab === 'pengguna'   && isAdmin && <UsersTab hasEditAccess={hasEditAccess} />}
              {activeTab === 'selforder'  && <SelforderTab hasEditAccess={hasEditAccess} />}
              {activeTab === 'data'       && <DataBackupTab hasEditAccess={hasEditAccess} />}
              {activeTab === 'tentang'    && <AboutTab />}
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   SHARED SETTINGS COMPONENTS
============================================================================ */

/**
 * Section wrapper dengan konsistensi header
 */
export function Section({ 
  title, 
  description, 
  action, 
  hideHeader,
  children 
}: {
  title: string; 
  description?: string;
  action?: React.ReactNode; 
  hideHeader?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 sm:space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
      {!hideHeader ? (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] sm:text-base font-bold text-foreground">{title}</h2>
            {description && (
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      ) : (
        action && (
          <div className="flex items-center justify-end">
            {action}
          </div>
        )
      )}
      {children}
    </div>
  );
}

/**
 * Komponen Card pembungkus list (bersih & rapi)
 */
export function SettingCard({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string;
}) {
  return (
    <div className={cn(
      'bg-card border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm',
      className
    )}>
      {children}
    </div>
  );
}

/**
 * Baris item di dalam Card
 */
export function SettingRow({ 
  label, 
  description, 
  children, 
  last 
}: {
  label: string; 
  description?: React.ReactNode;
  children?: React.ReactNode; 
  last?: boolean;
}) {
  return (
    <div className={cn(
      'flex items-center justify-between gap-4 px-4 py-3 sm:py-3.5',
      !last && 'border-b border-border/50'
    )}>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] sm:text-sm font-bold text-foreground">{label}</p>
        {description && (
          <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
            {description}
          </div>
        )}
      </div>
      {children && <div className="flex-shrink-0">{children}</div>}
    </div>
  );
}

/**
 * Badge role (Admin, Dapur, Staf)
 */
export function RoleBadge({ role }: { role: string }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20 uppercase tracking-wider">
        <BadgeCheck className="w-3 h-3" /> Admin
      </span>
    );
  }
  if (role === 'dapur') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-500 border border-rose-500/20 uppercase tracking-wider">
        <ChefHat className="w-3 h-3" /> Dapur
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-500 border border-blue-500/20 uppercase tracking-wider">
      <Shield className="w-3 h-3" /> Staf
    </span>
  );
}

/**
 * Tombol Link berdesain baris
 */
export function StockLink({ 
  to, 
  icon, 
  label, 
  description 
}: {
  to: string; 
  icon: React.ReactNode; 
  label: string; 
  description: string;
}) {
  return (
    <Link to={to} className="flex items-center gap-3 sm:gap-4 px-4 py-3 sm:py-3.5 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-b-0 group outline-none">
      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
    </Link>
  );
}
