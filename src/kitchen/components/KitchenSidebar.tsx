import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import {
  LogOut, Maximize, Minimize, Moon, Sun, Flame, History, ChevronLeft, ChevronRight, Menu, Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { StoreSettings } from '@/hooks/db-hooks';
import type { KanbanStepKey, StageConfig } from '../constants';

function ClockWidget({ collapsed }: { collapsed: boolean }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (collapsed) {
    return (
      <span className="text-[10px] font-extrabold text-muted-foreground tabular-nums">
        {format(currentTime, 'HH:mm')}
      </span>
    );
  }

  return (
    <div className="text-center font-mono">
      <span className="text-lg font-black text-foreground tabular-nums leading-none tracking-tight">
        {format(currentTime, 'HH:mm:ss')}
      </span>
      <p className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-widest mt-1">
        {format(currentTime, 'dd MMM yyyy')}
      </p>
    </div>
  );
}

interface SidebarProps {
  activeTab: 'aktif' | 'riwayat';
  onTabChange: (tab: 'aktif' | 'riwayat') => void;
  billCounts: Record<KanbanStepKey, number> & { total: number; riwayat: number };
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  storeSettings?: StoreSettings;
  isDark: boolean;
  onToggleDark: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onLogout: () => void;
  stageConfigs: Record<KanbanStepKey, StageConfig>;
}

export default function KitchenSidebar({
  activeTab, onTabChange, billCounts, collapsed, onToggleCollapse,
  mobileOpen, onCloseMobile, storeSettings,
  isDark, onToggleDark, isFullscreen, onToggleFullscreen, onLogout,
  stageConfigs,
}: SidebarProps) {
  const authData = useMemo(
    () => JSON.parse(localStorage.getItem('kitchen_auth') || '{}'),
    [],
  );
  const displayName = useMemo(() => {
    const raw = authData.name || authData.username || 'Chef';
    return raw
      .split(' ')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }, [authData]);
  const initial = displayName.charAt(0).toUpperCase();

  // Sidebar common nav button helper
  const NavBtn = ({
    isActive,
    onClick,
    icon: Icon,
    label,
    count,
    title,
  }: {
    isActive: boolean;
    onClick: () => void;
    icon: React.ElementType;
    label: string;
    count?: number;
    title: string;
  }) => (
    <button
      onClick={onClick}
      title={collapsed ? title : undefined}
      className={cn(
        'w-full flex items-center rounded-xl transition-all duration-150 font-semibold text-sm border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        collapsed ? 'justify-center p-3 h-11' : 'gap-3 px-3 py-2.5',
        isActive
          ? 'bg-primary/10 text-primary border-primary/20 shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 border-transparent',
      )}
    >
      <div
        className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors',
          isActive ? 'bg-primary/10' : 'bg-muted/80',
        )}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
      {!collapsed && (
        <>
          <span className="flex-1 text-left truncate">{label}</span>
          {typeof count === 'number' && count > 0 && (
            <Badge
              variant="secondary"
              className={cn(
                'ml-auto font-black text-[10px] px-1.5 py-0.5 rounded-full shrink-0 tabular-nums',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted-foreground/10 text-muted-foreground',
              )}
            >
              {count}
            </Badge>
          )}
        </>
      )}
    </button>
  );

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between">
      {/* Upper Section */}
      <div className="space-y-4">
        {/* Brand / Logo */}
        <div className={cn('flex items-center gap-3', collapsed ? 'justify-center' : 'px-1')}>
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 overflow-hidden">
            {storeSettings?.logo ? (
              <img src={storeSettings.logo} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <Store className="w-4.5 h-4.5" />
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="font-black text-sm text-foreground truncate leading-none">
                {storeSettings?.storeName || 'Mesen.Ae'}
              </h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                Layar Chef
              </p>
            </div>
          )}
        </div>

        {/* Clock & Controls (Darkmode + Fullscreen) */}
        <div
          className={cn(
            'bg-muted/30 border border-border/30 rounded-2xl flex flex-col gap-2.5',
            collapsed ? 'p-2 flex justify-center items-center' : 'p-3',
          )}
        >
          <ClockWidget collapsed={collapsed} />

          {/* Quick actions (Dark mode & Fullscreen) */}
          <div className={cn('flex gap-1.5 w-full', collapsed ? 'flex-col' : 'flex-row')}>
            <button
              onClick={onToggleDark}
              title={isDark ? 'Mode Terang' : 'Mode Gelap'}
              className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 shrink-0" /> : <Moon className="w-3.5 h-3.5 shrink-0" />}
              {!collapsed && <span className="text-[10px] font-semibold">{isDark ? 'Terang' : 'Gelap'}</span>}
            </button>

            <button
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
              className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              {isFullscreen ? (
                <Minimize className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Maximize className="w-3.5 h-3.5 shrink-0" />
              )}
              {!collapsed && <span className="text-[10px] font-semibold">{isFullscreen ? 'Kecil' : 'Penuh'}</span>}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="space-y-1">
          <NavBtn
            isActive={activeTab === 'aktif'}
            onClick={() => {
              onTabChange('aktif');
              onCloseMobile();
            }}
            icon={Flame}
            label="Pesanan Aktif"
            title="Pesanan Aktif"
            count={billCounts.total}
          />
          <NavBtn
            isActive={activeTab === 'riwayat'}
            onClick={() => {
              onTabChange('riwayat');
              onCloseMobile();
            }}
            icon={History}
            label="Riwayat Hari Ini"
            title="Riwayat"
            count={billCounts.riwayat}
          />
        </div>

        {/* Mini Kanban Counts (Expanded only) */}
        {!collapsed && activeTab === 'aktif' && (
          <div className="border-t border-border/50 pt-4 space-y-2">
            <p className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider px-1">
              Antrian Proses
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {(['diproses', 'dimasak', 'disiapkan', 'siap'] as KanbanStepKey[]).map((key) => {
                const cfg = stageConfigs[key];
                const count = billCounts[key];
                return (
                  <div
                    key={key}
                    className="p-2 rounded-xl bg-muted/20 border border-border/40 flex flex-col gap-1 min-w-0"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dotClass)} />
                      <span className="text-[9px] font-bold text-muted-foreground truncate uppercase leading-none">
                        {cfg.shortLabel}
                      </span>
                    </div>
                    <span className={cn('text-sm font-black leading-none tabular-nums mt-0.5', count > 0 ? cfg.sidebarTextClass : 'text-muted-foreground/40')}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Lower Section (User Account Card & Collapse) */}
      <div className="space-y-4">
        {/* User Card with integrated Logout */}
        <div
          className={cn(
            'flex items-center gap-3 bg-muted/40 border border-border/40 rounded-2xl transition-all',
            collapsed ? 'flex-col p-2' : 'p-3',
          )}
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 text-white font-black text-xs flex items-center justify-center shadow-sm shrink-0 uppercase select-none">
            {initial}
          </div>
          {!collapsed ? (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground truncate leading-none">
                  {displayName}
                </p>
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                  Chef
                </p>
              </div>
              <button
                onClick={onLogout}
                title="Keluar Layar Chef"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={onLogout}
              title="Keluar Layar Chef"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={onToggleCollapse}
          className={cn(
            'hidden md:flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors border border-transparent hover:border-border',
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <>
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Sembunyikan Panel</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── DESKTOP SIDEBAR ── */}
      <aside
        className={cn(
          'app-sidebar hidden md:block shrink-0 border-r border-border bg-card transition-all duration-300 ease-in-out p-4 h-full',
          collapsed ? 'w-20' : 'w-64',
        )}
      >
        {sidebarContent}
      </aside>

      {/* ── MOBILE SIDEBAR DRAWER ── */}
      {mobileOpen && (
        <div className="sidebar-drawer md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Drawer body */}
          <aside className="app-sidebar relative flex flex-col w-64 max-w-xs bg-card p-4 pb-20 border-r border-border h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
