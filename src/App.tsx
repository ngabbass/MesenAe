import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import AdminApp from "./admin/AdminApp";
import KitchenApp from "./kitchen/KitchenApp";
import ErrorBoundary from "@/components/ErrorBoundary";

import { useThemeColor } from "./hooks/use-theme-color";
import { useRealtimeOrders } from "./hooks/useRealtimeOrders";

//  1. IMPORT FUNGSI LISTENER DARI FILE FCM ANDA
import { initPushListeners } from "./lib/fcm";
import { SplashScreen } from "@capacitor/splash-screen";
import { Capacitor } from "@capacitor/core";

//  IMPORT PLUGIN NATIVE UI BAR
import { StatusBar, Style } from '@capacitor/status-bar';
import { NavigationBar } from '@hugotomazi/capacitor-navigation-bar';

const SharedLogin = lazy(() => import("./login/Login"));

// Database connection is managed via Firebase real-time sync.

function GlobalNavigationHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    // ─── Handler navigasi untuk Capacitor Native ───
    const handleFCMNavigate = () => {
      const path = localStorage.getItem('fcm_redirect_path');
      if (path) {
        localStorage.removeItem('fcm_redirect_path');
        navigate(path);
      }
    };

    window.addEventListener('fcm_navigate', handleFCMNavigate);

    // Check if there is any pending FCM navigation path on mount (cold start click)
    const pendingPath = localStorage.getItem('fcm_redirect_path');
    if (pendingPath) {
      localStorage.removeItem('fcm_redirect_path');
      setTimeout(() => {
        navigate(pendingPath);
      }, 100);
    }

    // ─── Handler navigasi untuk Web Service Worker (postMessage) ───
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'FCM_NAVIGATE') {
        navigate(event.data.url);
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    // ─── Cleanup listeners saat unmount ───
    return () => {
      window.removeEventListener('fcm_navigate', handleFCMNavigate);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, [navigate]);

  return null;
}

const App = () => {
  useThemeColor(); // Activate global theme color sync
  useRealtimeOrders(); // Start global realtime order listener for authorized staff

  // 2. JALANKAN INISIALISASI PUSH LISTENER & NATIVE UI SAAT APP DIMULAI
  useEffect(() => {
    initPushListeners();

    const setupNativeEnvironment = async () => {
      if (Capacitor.isNativePlatform()) {
        document.body.classList.add('is-native');

        try {
          // --- EDGE-TO-EDGE SETTINGS ---
          // 1. Buat Status Bar (Atas) transparan dan menimpa Webview
          await StatusBar.setOverlaysWebView({ overlay: true });
          
          // Style.Dark berarti icon jam/baterai berwarna terang (cocok untuk background gelap Anda)
          await StatusBar.setStyle({ style: Style.Dark });

          // 2. Buat Navigation Bar (Bawah) transparan
          await NavigationBar.setTransparency({ isTransparent: true });
          const isDarkTheme = document.documentElement.classList.contains('dark') || localStorage.getItem('mesenae-theme') === 'dark';
          await NavigationBar.setColor({ color: '#00000000', darkButtons: !isDarkTheme }); 
        } catch (error) {
          console.error("[Native UI] Gagal mengatur Status/Nav Bar:", error);
        }
      }
    };

    setupNativeEnvironment();
  }, []);

  useEffect(() => {
    // Hide the native Capacitor splash screen dynamically after React mounts and is ready!
    const hideNativeSplash = async () => {
      // PENAMBAHAN: Hanya eksekusi SplashScreen.hide() jika dijalankan di platform Native (Android/iOS)
      if (Capacitor.isNativePlatform()) {
        try {
          await SplashScreen.hide({ fadeOutDuration: 400 });
          console.log("[Splash] Native splash screen successfully hidden.");
        } catch (err) {
          console.warn("[Splash] Failed to hide native splash screen:", err);
        }
      }
    };

    // A timeout of 1500ms to ensure the logo is loaded and React is fully painted
    const timer = setTimeout(() => {
      hideNativeSplash();
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ErrorBoundary>
          <BrowserRouter>
            <GlobalNavigationHandler />
            <Routes>
              {/* Paksa pengunjung root menuju login */}
              <Route path="/" element={<Navigate to="/login" replace />} />

              <Route path="/login" element={
                <Suspense fallback={
                  <div className="min-h-screen flex bg-zinc-950 items-center justify-center">
                    <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                }>
                  <SharedLogin />
                </Suspense>
              } />
              <Route path="/admin/*" element={<AdminApp />} />
              <Route path="/kitchen/*" element={<KitchenApp />} />
            </Routes>
          </BrowserRouter>
        </ErrorBoundary>
      </TooltipProvider>
  );
};

export default App;
