import React from 'react';
import { Outlet } from 'react-router-dom';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function KitchenLayout() {
  useThemeColor();
  return (
    <div className="h-screen w-full bg-slate-100 dark:bg-[#0b0f19] text-foreground overflow-hidden select-none">
      <Outlet />
    </div>
  );
}
