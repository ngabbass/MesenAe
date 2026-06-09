import React from 'react';
import {
  Flame, ChefHat, Timer, UtensilsCrossed, CheckCircle2, ArrowRight,
} from 'lucide-react';

export const transparentPixel =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export const KITCHEN_STEPS = ['diproses', 'dimasak', 'disiapkan', 'siap', 'diantarkan'] as const;
export type KitchenStep = (typeof KITCHEN_STEPS)[number];
export type KanbanStepKey = 'diproses' | 'dimasak' | 'disiapkan' | 'siap';

export interface StageConfig {
  label: string;
  shortLabel: string;
  dotClass: string;
  headerBg: string;
  borderLeft: string;
  iconWrap: string;
  countBadge: string;
  btnClass: string;
  actionText: string;
  Icon: React.ElementType;
  ActionIcon: React.ElementType;
  emptyText: string;
  sidebarTextClass: string;
}

export const getStageConfigs = (deliveryMode?: 'ambil' | 'diantar'): Record<KanbanStepKey, StageConfig> => {
  const isSelfPickup = deliveryMode === 'ambil';
  return {
    diproses: {
      label: 'Pesanan Masuk',
      shortLabel: 'Masuk',
      dotClass: 'bg-blue-500',
      headerBg: 'bg-blue-500/[0.06] dark:bg-blue-950/20',
      borderLeft: 'border-l-blue-500',
      iconWrap: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      countBadge: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
      btnClass:
        'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-md shadow-blue-500/20',
      actionText: 'Mulai Masak',
      Icon: ChefHat,
      ActionIcon: Flame,
      emptyText: 'Antrian pesanan kosong',
      sidebarTextClass: 'text-blue-600 dark:text-blue-400',
    },
    dimasak: {
      label: 'Sedang Dimasak',
      shortLabel: 'Dimasak',
      dotClass: 'bg-orange-500',
      headerBg: 'bg-orange-500/[0.06] dark:bg-orange-950/20',
      borderLeft: 'border-l-orange-500',
      iconWrap: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
      countBadge: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
      btnClass:
        'bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white shadow-md shadow-orange-500/20',
      actionText: 'Selesai Dimasak',
      Icon: Flame,
      ActionIcon: Timer,
      emptyText: 'Tidak ada yang sedang dimasak',
      sidebarTextClass: 'text-orange-600 dark:text-orange-400',
    },
    disiapkan: {
      label: 'Tahap Penyajian',
      shortLabel: 'Penyajian',
      dotClass: 'bg-violet-500',
      headerBg: 'bg-violet-500/[0.06] dark:bg-violet-950/20',
      borderLeft: 'border-l-violet-500',
      iconWrap: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
      countBadge: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20',
      btnClass:
        'bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white shadow-md shadow-violet-500/20',
      actionText: isSelfPickup ? 'Siap Diambil' : 'Siap Diantar',
      Icon: UtensilsCrossed,
      ActionIcon: CheckCircle2,
      emptyText: 'Tidak ada di tahap penyajian',
      sidebarTextClass: 'text-violet-600 dark:text-violet-400',
    },
    siap: {
      label: isSelfPickup ? 'Siap Diambil' : 'Menunggu Waiter',
      shortLabel: isSelfPickup ? 'Siap Diambil' : 'Siap Antar',
      dotClass: 'bg-emerald-500',
      headerBg: 'bg-emerald-500/[0.06] dark:bg-emerald-950/20',
      borderLeft: 'border-l-emerald-500',
      iconWrap: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      countBadge:
        'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
      btnClass:
        'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-md shadow-emerald-500/20',
      actionText: isSelfPickup ? 'Tandai Diambil' : 'Tandai Diantarkan',
      Icon: CheckCircle2,
      ActionIcon: ArrowRight,
      emptyText: isSelfPickup ? 'Belum ada yang siap diambil' : 'Belum ada yang siap diantar',
      sidebarTextClass: 'text-emerald-600 dark:text-emerald-400',
    },
  };
};

export const STEP_ORDER: KanbanStepKey[] = ['diproses', 'dimasak', 'disiapkan', 'siap'];

export function getTimerConfig(diffMins: number) {
  if (diffMins < 10)
    return {
      className:
        'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      pulse: false,
      label: `${diffMins}m`,
    };
  if (diffMins < 20)
    return {
      className: 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30',
      pulse: false,
      label: `${diffMins}m`,
    };
  return {
    className: 'text-red-700 dark:text-red-400 bg-red-500/15 border-red-500/40',
    pulse: true,
    label: `${diffMins}m ⚠`,
  };
}
