import { Outlet } from 'react-router-dom';
import { useDbQuery, dbInsert, dbUpdate, dbDelete } from '@/hooks/db-hooks';
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useThemeColor, applyThemeColor } from '@/hooks/use-theme-color';
import AppSidebar from './AppSidebar';
import AppTopbar from './AppTopbar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, Store, Maximize, Minimize } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Skeleton } from '@/admin/components/SkeletonLoaders';
import PermissionDebugger from '../PermissionDebugger';
import { App } from '@capacitor/app';
import { toast } from 'sonner';

export default function AppLayout() {
  const allSettings = useDbQuery('storeSettings');
  const storeSettings = allSettings?.[0];

  useThemeColor(); // Apply saved theme color on mount
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Handle Android Physical Hardware Back Button
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let lastTime = 0;

    const handleBackButton = async () => {
      // 1. Cek apakah ada modal, dialog, sheet, atau dropdown yang terbuka
      // Radix UI dropdown, dialog, sheet menggunakan atribut `role="dialog"` atau `data-state="open"`
      const openModal = document.querySelector('[role="dialog"], [data-state="open"], .dialog-content');
      
      if (openModal) {
        // Simulasikan tombol Escape untuk menutup dialog/modal/sheet secara native
        const escEvent = new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          keyCode: 27,
          which: 27,
          bubbles: true
        });
        document.dispatchEvent(escEvent);
        console.log('[BackButton] Menutup modal/dialog/sheet aktif via Escape event.');
        return;
      }

      // 2. Cek apakah di halaman home/dashboard
      // Path utama admin adalah '/admin' atau '/admin/' atau '/login'
      const isHome = window.location.pathname === '/admin' || window.location.pathname === '/admin/' || window.location.pathname === '/login' || window.location.pathname === '/';
      
      if (!isHome) {
        // Jika tidak di home, kembali ke halaman sebelumnya
        window.history.back();
        console.log('[BackButton] Navigasi kembali ke halaman sebelumnya.');
        return;
      }

      // 3. Double tap untuk keluar aplikasi di halaman home
      const now = Date.now();
      if (now - lastTime < 2000) {
        App.exitApp();
      } else {
        lastTime = now;
        toast.info('Tekan sekali lagi untuk keluar dari aplikasi', {
          position: 'bottom-center',
          duration: 2000
        });
      }
    };

    const listener = App.addListener('backButton', () => {
      handleBackButton();
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, []);

  // Initialize native status bar and screen orientation on mount (Portrait by default but UNLOCKED to allow physical rotation)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    
    const initDeviceLayout = async () => {
      try {
        const { StatusBar } = await import('@capacitor/status-bar');
        const { ScreenOrientation } = await import('@capacitor/screen-orientation');
        
        await StatusBar.show().catch(console.warn);
        await StatusBar.setOverlaysWebView({ overlay: true }).catch(console.warn);
        
        // Unlock screen orientation so the user can physically rotate the device
        await ScreenOrientation.unlock().catch(console.warn);
      } catch (e) {
        console.warn("[AppLayout] Failed to initialize device layout:", e);
      }
    };
    
    initDeviceLayout();
  }, []);

  // Listen to screen orientation changes (both physical rotation and forced lock)
  useEffect(() => {
    const handleOrientation = async () => {
      const isLandscape = window.matchMedia('(orientation: landscape)').matches;
      
      if (Capacitor.isNativePlatform()) {
        try {
          const { StatusBar } = await import('@capacitor/status-bar');
          const { KeepAwake } = await import('@capacitor-community/keep-awake');
          
          if (isLandscape) {
            // Automatically enter landscape immersive mode (hide status bar, request fullscreen)
            await StatusBar.hide().catch(console.warn);
            await KeepAwake.keepAwake().catch(console.warn);
            if (document.documentElement.requestFullscreen) {
              await document.documentElement.requestFullscreen().catch(console.warn);
            }
            setIsFullscreen(true);
          } else {
            // Automatically return to portrait browser-like mode (exit fullscreen, show status bar, re-apply theme color)
            if (document.fullscreenElement) {
              await document.exitFullscreen().catch(console.warn);
            }
            await StatusBar.show().catch(console.warn);
            await StatusBar.setOverlaysWebView({ overlay: true }).catch(console.warn);
            await KeepAwake.allowSleep().catch(console.warn);
            // Re-apply theme color to status bar after exiting landscape/fullscreen
            await applyThemeColor(storeSettings?.themeColor || '217').catch(console.warn);
            setIsFullscreen(false);
          }
        } catch (e) {
          console.warn("[AppLayout] Error handling orientation transition:", e);
        }
      } else {
        setIsFullscreen(isLandscape);
      }
    };

    const query = window.matchMedia('(orientation: landscape)');
    query.addEventListener('change', handleOrientation);
    
    // Run initial orientation check on load
    handleOrientation();
    
    return () => query.removeEventListener('change', handleOrientation);
  }, [storeSettings?.themeColor]);

  const toggleFullscreen = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const { ScreenOrientation } = await import('@capacitor/screen-orientation');
        
        if (!isFullscreen) {
          // Force lock to landscape (this will automatically trigger handleOrientation above via event)
          await ScreenOrientation.lock({ orientation: 'landscape' }).catch(console.warn);
        } else {
          // Force back to portrait and immediately unlock so user can physically rotate again later
          await ScreenOrientation.lock({ orientation: 'portrait' }).catch(console.warn);
          await ScreenOrientation.unlock().catch(console.warn);
        }
      } catch (e) {
        console.error("[AppLayout] Failed to toggle native orientation via button:", e);
      }
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
      } else {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!Capacitor.isNativePlatform()) {
        setIsFullscreen(!!document.fullscreenElement);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);


  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // NOTE: Seeding default store settings automatically on admin layout mount
  // has been removed to prevent accidental writes. Store settings should be
  // created/modified explicitly via the Settings page or via sheet editing.

  // Loading state — show skeleton layout
  if (allSettings === undefined) {
    return (
      <div className="flex h-screen w-full bg-background overflow-hidden">
        {/* Desktop Sidebar Skeleton */}
        <div className="hidden lg:flex h-screen w-64 shrink-0 flex-col border-r bg-card p-4 gap-4">
          <div className="flex items-center gap-3 px-2 py-3">
            <Skeleton className="w-9 h-9 rounded-lg" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="space-y-1.5 flex-1">
            {[1,2,3,4,5,6,7].map(i => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        </div>

        {/* Main Content Skeleton */}
        <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
          {/* Topbar Skeleton */}
          <div className="w-full bg-card border-b px-6 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-lg" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="w-9 h-9 rounded-lg" />
          </div>
          <main className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 pt-2 md:pt-3 pb-6">
            <div className="space-y-4">
              <div className="flex justify-between">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-9 w-24 rounded-lg" />
              </div>
              {[1,2,3,4].map(i => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden">
      <PermissionDebugger />
      {/* Desktop Sidebar */}
      <div className="hidden lg:block h-full shrink-0">
        <AppSidebar />
      </div>

      <div className="app-content-wrapper flex-1 flex flex-col h-full overflow-hidden relative bg-slate-50 dark:bg-slate-950">
        {/* Mobile Sidebar Drawer Sheet */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" hideClose className="sidebar-drawer p-0 w-64 border-r-0 bg-[#0a1128] h-[100dvh] max-h-screen flex flex-col">
            <AppSidebar isMobile={true} />
          </SheetContent>
        </Sheet>

        {/* Fixed Topbar docked at the top */}
        <AppTopbar 
          isFullscreen={isFullscreen} 
          onToggleFullscreen={toggleFullscreen} 
          onToggleMobileSidebar={() => setMobileOpen(true)}
        />

        {/* Main Scrollable Content */}
        <main className="app-main flex-1 overflow-y-auto w-full px-3 md:px-6 lg:px-8 pt-2 md:pt-3 pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
