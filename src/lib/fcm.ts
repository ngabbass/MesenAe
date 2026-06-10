/**
 * fcm.ts — Firebase Cloud Messaging (FCM) Integration
 *
 * Alur:
 *   1. requestForToken()  → Daftarkan device ke Firebase, simpan FCM token ke Firestore
 *   2. sendPushToRole()   → Ambil semua token untuk role tertentu, kirim via /api/fcm-send
 *   3. /api/fcm-send      → Firebase Admin SDK kirim ke Google FCM → OS Android/iOS
 */

import { getToken } from "firebase/messaging";
import { getMessagingInstance } from "./firebase";
import { dbUpsert, dbSelect } from "@/lib/db";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Haptics } from "@capacitor/haptics";
import { toast } from "sonner";
import { getApiUrl } from "./api-helper";
import { getActiveThemeColorHex } from "@/hooks/use-theme-color";

const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

// Shared Set to prevent duplicate notifications in the foreground
export const processedNotificationIds = new Set<string>();

// Helper to extract receipt numbers (e.g. TX1234567890) from notification content
export const extractReceiptNumber = (title: string, body: string): string | null => {
  const combined = `${title} ${body}`;
  const match = combined.match(/TX\d+/i);
  return match ? match[0].toUpperCase() : null;
};

// ─── REQUEST & REGISTER FCM TOKEN ────────────────────────────────────────────
export const requestForToken = async (
  role: "admin" | "customer",
  name: string
): Promise<string | null> => {
  try {
    let tokenStr = "";

    if (Capacitor.isNativePlatform()) {
      try {
        // Native Capacitor Push Notifications (Android/iOS)
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== 'granted') {
          console.warn("[FCM] Native Push permission denied.");
          return null;
        }

        // Register custom Android channel (required for background pushes to work with sound & banner)
        // PEMBUATAN CHANNEL DIPANGGIL DENGAN BENAR SEBELUM REGISTRASI
        if (Capacitor.getPlatform() === 'android') {
          try {
            await PushNotifications.createChannel({
              id: 'mesenae_orders',
              name: 'Notifikasi Pesanan',
              description: 'Notifikasi push saat ada pesanan masuk',
              importance: 5, // IMPORTANCE_HIGH
              sound: 'ding', // ding.mp3 in res/raw/ding.mp3
              visibility: 1, // VISIBILITY_PUBLIC
              vibration: true
            });
            console.log("[FCM] Android push channel 'mesenae_orders' created.");
          } catch (channelErr) {
            console.error("[FCM] Failed to create Android push channel:", channelErr);
          }
        }

        // Menggunakan Promise asinkron yang langsung mendengarkan event registration (one-time listener)
        // untuk menghindari Race Condition dan polling timeout.
        const tokenPromise = new Promise<string>((resolve, reject) => {
          let regListener: any = null;
          let errListener: any = null;

          const cleanup = () => {
            if (regListener) regListener.remove();
            if (errListener) errListener.remove();
          };

          PushNotifications.addListener('registration', (token) => {
            cleanup();
            localStorage.setItem('fcm_token_native', token.value);
            resolve(token.value);
          }).then(handle => {
            regListener = handle;
          }).catch(err => {
            cleanup();
            reject(err);
          });

          PushNotifications.addListener('registrationError', (error) => {
            cleanup();
            reject(new Error(error.error));
          }).then(handle => {
            errListener = handle;
          }).catch(err => {
            cleanup();
            reject(err);
          });

          // Timeout setelah 10 detik sebagai fallback
          setTimeout(() => {
            cleanup();
            reject(new Error('FCM Native registration timeout (10s)'));
          }, 10000);
        });

        // Trigger registrasi ke native push server
        await PushNotifications.register();

        // Tunggu hingga token berhasil didapatkan oleh listener
        tokenStr = await tokenPromise;

        if (!tokenStr) {
          console.warn("[FCM] Failed to obtain native push token.");
          return null;
        }
      } catch (nativeErr) {
        console.error("[FCM] Native push setup failed:", nativeErr);
        return null;
      }

    } else {
      // Web Browser Firebase Messaging
      const messaging = await getMessagingInstance();
      if (!messaging) {
        console.warn("[FCM] Firebase Messaging tidak didukung di browser ini.");
        return null;
      }

      let permission = "default";
      if (typeof window !== "undefined" && 'Notification' in window) {
        permission = await (window as any).Notification.requestPermission();
      } else {
        permission = "granted";
      }
      
      if (permission !== "granted") {
        console.warn("[FCM] Izin notifikasi ditolak.");
        return null;
      }

      const configParams = new URLSearchParams({
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
        appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
      }).toString();

      const registration = await navigator.serviceWorker.register(
        `/firebase-messaging-sw.js?${configParams}`,
        { scope: "/" }
      );
      await navigator.serviceWorker.ready;

      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (!token) {
        console.warn("[FCM] Gagal mendapatkan FCM token (Web).");
        return null;
      }
      tokenStr = token;
    }

    // 5. Simpan token ke Firestore
    await dbUpsert("fcmTokens", {
      token: tokenStr,
      role,
      name,
      updatedAt: new Date().toISOString(),
    }, "token");

    console.info(`[FCM] Token berhasil didaftarkan untuk role=${role}`);
    return tokenStr;
  } catch (err) {
    console.error("[FCM] Error saat mendaftar token:", err);
    return null;
  }
};

// ─── SEND PUSH NOTIFICATION TO ALL DEVICES OF A ROLE ─────────────────────────
export const sendPushToRole = async (
  role: string | string[],
  payload: { title: string; body: string; url?: string }
): Promise<void> => {
  try {
    // Ambil semua FCM token untuk role tersebut dari Firestore
    const roles = Array.isArray(role) ? role : [role];
    const allTokens = await dbSelect("fcmTokens");
    const tokens: string[] = allTokens
      .filter((t: any) => roles.includes(t.role) && t.token)
      .map((t: any) => t.token as string);

    if (tokens.length === 0) {
      console.info(`[FCM] Tidak ada token untuk role=${role}, skip.`);
      return;
    }

    // Kirim ke backend Vercel yang meneruskan ke Firebase Admin SDK
    const res = await fetch(getApiUrl("/api/fcm-send"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens, payload }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[FCM] Gagal mengirim push:", err);
    }
  } catch (err) {
    console.error("[FCM] Error sendPushToRole:", err);
  }
};

// ─── SEND TARGETED PUSH NOTIFICATION TO A CUSTOMER DEVICE ────────────────────
export const sendPushToCustomer = async (
  bill: any,
  payload: { title: string; body: string; url?: string }
): Promise<void> => {
  try {
    const tokens: string[] = [];

    // 1. Cek jika bill menyimpan token FCM secara langsung
    if (bill.fcmToken && typeof bill.fcmToken === 'string') {
      tokens.push(bill.fcmToken);
    }
    if (bill.customerFcmToken && typeof bill.customerFcmToken === 'string') {
      tokens.push(bill.customerFcmToken);
    }

    // 2. Cari dari koleksi fcmTokens dengan role customer dan nama yang cocok
    if (bill.customerName) {
      const allTokens = await dbSelect("fcmTokens");
      const matched = allTokens.filter(
        (t: any) =>
          t.role === "customer" &&
          t.name &&
          String(t.name).trim().toLowerCase() === String(bill.customerName).trim().toLowerCase() &&
          t.token
      );
      matched.forEach((t: any) => {
        if (!tokens.includes(t.token)) {
          tokens.push(t.token);
        }
      });
    }

    // 3. Fallback: Jika tidak ada token khusus, kirim broadcast ke semua customer
    if (tokens.length === 0) {
      console.info(`[FCM] Tidak ada token khusus untuk customer '${bill.customerName}', broadcast.`);
      await sendPushToRole('customer', payload);
      return;
    }

    console.info(`[FCM] Mengirim push ke customer '${bill.customerName}' via ${tokens.length} token:`, tokens);

    const res = await fetch(getApiUrl("/api/fcm-send"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens, payload }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[FCM] Gagal mengirim push ke customer:", err);
    }
  } catch (err) {
    console.error("[FCM] Error sendPushToCustomer:", err);
  }
};

// ─── INITIALIZE PUSH LISTENERS (CAPACITOR NATIVE) ───────────────────────────
export const initPushListeners = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    // Create local notification channel once at startup (Android 8.0+)
    if (Capacitor.getPlatform() === 'android') {
      try {
        await LocalNotifications.createChannel({
          id: 'mesenae_orders',
          name: 'Notifikasi Pesanan',
          description: 'Notifikasi push saat ada pesanan masuk',
          importance: 5, // IMPORTANCE_HIGH
          sound: 'ding',
          visibility: 1, // VISIBILITY_PUBLIC
          vibration: true,
        });
        console.log('[FCM] LocalNotifications channel mesenae_orders created at startup.');
      } catch (channelErr) {
        console.warn('[FCM] LocalNotifications channel creation warning:', channelErr);
      }
    }

    // Force notifications to only update badge when app is in foreground to suppress duplicate native alerts
    await PushNotifications.setPresentationOptions({
      presentationOptions: ['badge']
    }).catch(err => console.warn("[FCM] Failed to set presentation options:", err));

    await PushNotifications.removeAllListeners();

    // 1. Permanent Global Registration Success Listener
    await PushNotifications.addListener('registration', async (token) => {
      console.info('[FCM] Native registration success, token received:', token.value);
      
      // Cache token in localStorage for instant retrieval
      localStorage.setItem('fcm_token_native', token.value);

      // If user is already logged in, automatically save/sync to Firestore!
      try {
        const authDataStr = localStorage.getItem('admin_auth') || '{}';
        const authData = JSON.parse(authDataStr);
        if (authData.role && authData.name) {
          await dbUpsert("fcmTokens", {
            token: token.value,
            role: authData.role,
            name: authData.name,
            updatedAt: new Date().toISOString(),
          }, "token");
          console.info(`[FCM] Native token auto-saved to Firestore for active user: ${authData.name}`);
        }
      } catch (err) {
        console.error("[FCM] Error auto-syncing native token to Firestore:", err);
      }
    });

    // 2. Permanent Global Registration Error Listener
    await PushNotifications.addListener('registrationError', (error) => {
      console.error('[FCM] Error on native registration event:', error);
    });

    // 3. Foreground Push Received Listener
    await PushNotifications.addListener('pushNotificationReceived', async (notification) => {
      console.log('[FCM] Foreground push received:', notification);
      
      const receiptNumber = notification.data?.receiptNumber || notification.data?.orderId || 
                            extractReceiptNumber(notification.title || '', notification.body || '') ||
                            notification.id;
      
      if (receiptNumber) {
        if (processedNotificationIds.has(receiptNumber)) {
          console.log(`[FCM] Duplicate notification detected for ID: ${receiptNumber}, skipping.`);
          return;
        }
        processedNotificationIds.add(receiptNumber);
      }
      
      // Play notification sound based on notification content
      try {
        const title = (notification.title || "");
        const body = (notification.body || "");
        const titleLower = title.toLowerCase();
        const bodyLower = body.toLowerCase();
        
        // Cek jika push bertema pembaruan status / konfirmasi pembayaran
        const isStatusUpdate = 
          titleLower.includes("siap") || titleLower.includes("selesai") || titleLower.includes("konfirmasi") || titleLower.includes("lunas") || titleLower.includes("perubahan") ||
          bodyLower.includes("siap") || bodyLower.includes("selesai") || bodyLower.includes("konfirmasi") || bodyLower.includes("lunas") || bodyLower.includes("perubahan");
        
        const soundFile = isStatusUpdate ? 'beep.mp3' : 'ding.mp3';
        const audio = new Audio('/' + soundFile);
        audio.play().catch(e => console.warn("[FCM] Foreground audio play blocked/failed:", e));
        
        // Trigger device vibration
        Haptics.vibrate({ duration: 500 }).catch(() => {});

        // Dismiss any existing toast first to prevent stacking
        toast.dismiss();

        // Display dynamic premium toast
        if (isStatusUpdate) {
          toast.success(
            `${title || "Pembaruan Pesanan"}: ${body || "Ada pembaruan status!"}`,
            {
              duration: 6000,
              position: 'bottom-right'
            }
          );
        } else {
          toast.success(title || `Pesanan Baru Masuk 🚀`, {
            description: body || `Ada pesanan baru masuk!`,
            duration: 8000,
            position: 'bottom-right'
          });
        }

        // Schedule local notification immediately in the status bar
        const numericId = parseInt(receiptNumber.toString().replace(/\D/g, ''), 10);
        const notificationId = isNaN(numericId) ? Math.floor(Date.now() / 1000) : (numericId % 2147483647);
        
        try {
          const activeThemeColor = await getActiveThemeColorHex();
          const notificationUrl = notification.data?.url || '/admin/pesanan-aktif';
          
          await LocalNotifications.schedule({
            notifications: [
              {
                title: title || 'Notifikasi Baru',
                body: body || 'Ada pembaruan pesanan.',
                id: notificationId,
                schedule: { at: new Date(Date.now() + 100) },
                sound: soundFile,
                smallIcon: 'ic_notification',
                iconColor: activeThemeColor,
                channelId: 'mesenae_orders',
                extra: {
                  url: notificationUrl
                }
              }
            ]
          });
          console.log(`[FCM] Local notification scheduled in foreground for receipt #${receiptNumber}`);
        } catch (localErr) {
          console.warn('[FCM] Failed to trigger Local Notification in foreground:', localErr);
        }
      } catch (soundErr) {
        console.error("[FCM] Sound player error:", soundErr);
      }
    });

    // 4. Notification Action Performed (Click) Listener
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[FCM] Push action performed:', action);
      const rawUrl = action.notification.data?.url || '/admin/orders';
      
      // Extract path out of url if it contains protocol/host
      let path = rawUrl;
      try {
        if (path.startsWith('http')) {
          const parsed = new URL(path);
          path = parsed.pathname + parsed.search;
        }
      } catch (_) {}

      if (typeof window !== 'undefined') {
        localStorage.setItem('fcm_redirect_path', path);
        window.dispatchEvent(new Event('fcm_navigate'));
      }
    });

    // 5. Trigger Native Registration early on startup if permissions are granted
    const permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'granted') {
      PushNotifications.register().catch(err => {
        console.error('[FCM] Native PushNotifications.register at boot failed:', err);
      });
    }

    console.log("[FCM] Native push listeners successfully initialized.");
  } catch (listenerErr) {
    console.error("[FCM] Failed to register push listeners:", listenerErr);
  }
};
