import { useEffect, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db as firestoreDb } from '@/lib/firebase';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics } from '@capacitor/haptics';
import { toast } from 'sonner';
import { processedNotificationIds } from '@/lib/fcm';
import { getActiveThemeColorHex } from '@/hooks/use-theme-color';
import { usePermissions } from '@/hooks/use-permissions';

const isActiveOrder = (order: any) => {
  const isUnpaid = order.status === 'belum lunas';
  const isPaidButCooking = order.status === 'lunas' && order.kitchenStatus && !['diantarkan', 'selesai'].includes(order.kitchenStatus);
  const isPaidRetailWeb = order.status === 'lunas' && (order.remarks || '').includes('Web') && (!order.kitchenStatus || order.kitchenStatus === 'pending');
  return isUnpaid || isPaidButCooking || isPaidRetailWeb;
};

const isRecentOrder = (order: any) => {
  if (!order.date) return false;
  try {
    const orderTime = new Date(order.date).getTime();
    const now = Date.now();
    // Toleransi 10 menit untuk perbedaan waktu jam perangkat kasir vs server
    return Math.abs(now - orderTime) < 10 * 60 * 1000;
  } catch (e) {
    return false;
  }
};

export function useRealtimeOrders() {
  const { authData } = usePermissions();
  const isInitialLoad = useRef(true);
  const knownOrderIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    // 1. Validasi login & role user
    if (!authData || !authData.username) {
      console.log('[RealtimeOrders] User not logged in. Skipping realtime listener.');
      return;
    }

    const allowedRoles = ['admin', 'dapur', 'kasir', 'kitchen', 'user'];
    if (!allowedRoles.includes(authData.role)) {
      console.log(`[RealtimeOrders] Role "${authData.role}" is not allowed to monitor orders. Skipping.`);
      return;
    }

    // Reset load pertama & daftar cache order ID saat sesi baru dimulai
    isInitialLoad.current = true;
    knownOrderIds.current = new Set();

    let mounted = true;
    let unsubscribe = () => {};

    const currentCashierName = authData.name || authData.username || 'Kasir';

    const setupListener = () => {
      console.log('[RealtimeOrders] Starting real-time listener for incoming orders...');
      const colRef = collection(firestoreDb, 'transactions');
      const q = query(colRef, orderBy('date', 'desc'), limit(15));

      unsubscribe = onSnapshot(
        q,
        async (snapshot) => {
          if (!mounted) return;

          const newOrders: any[] = [];
          
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const id = change.doc.id;
              const data = change.doc.data();
              
              if (!knownOrderIds.current.has(id)) {
                knownOrderIds.current.add(id);
                
                // Jika ini BUKAN tarikan data pertama kalinya, berarti ini pesanan baru (Real-time)
                if (!isInitialLoad.current) {
                  const txCashier = String(data.cashier_name || data.cashierName || '').trim().toLowerCase();
                  const currentCashier = String(currentCashierName).trim().toLowerCase();
                  
                  // Hanya proses jika bukan kasir yang sama yang membuat, merupakan pesanan aktif, dan merupakan pesanan baru (recent)
                  if (txCashier !== currentCashier && isActiveOrder(data) && isRecentOrder(data)) {
                    newOrders.push({ id, ...data });
                  }
                }
              }
            }
          });

          // Tandai bahwa load pertama sudah selesai pada callback snapshot pertama
          if (isInitialLoad.current) {
            isInitialLoad.current = false;
            console.log(`[RealtimeOrders] Initial load synced. Registered ${knownOrderIds.current.size} existing orders.`);
            return;
          }

          // Picu notifikasi untuk pesanan yang benar-benar baru
          for (const order of newOrders) {
            const receiptNum = order.receipt_number || order.receiptNumber || 'Baru';
            
            // 1. Cek Duplikasi (Menghindari double notif jika FCM push juga masuk)
            if (processedNotificationIds.has(receiptNum)) {
              console.log(`[RealtimeOrders] Order #${receiptNum} already notified, skipping duplicate.`);
              continue;
            }
            
            processedNotificationIds.add(receiptNum);

            // Putar suara notifikasi (dibungkus try-catch untuk mengantisipasi blokir Autoplay browser)
            try {
              const audio = new Audio('/ding.mp3');
              audio.play().catch(e => console.warn('[RealtimeOrders] Audio play diblokir oleh OS/Browser:', e));
            } catch (soundErr) {
              console.error('[RealtimeOrders] Sound player error:', soundErr);
            }

            // Getaran Haptic
            Haptics.vibrate({ duration: 500 }).catch(() => {});

            // Tampilkan Toast di dalam aplikasi
            toast.success(`Pesanan Baru Masuk 🚀`, {
              description: `No: #${receiptNum} dari ${order.customer_name || 'Tamu'} (Meja: ${order.table_number || 'Bawa Pulang'})`,
              duration: 8000,
              position: 'bottom-right'
            });

            // Pembuatan ID Notifikasi yang deterministik (bukan Math.random)
            // Mengubah string nomor resi jadi angka bulat, fallback ke detik timestamp jika gagal
            const numericId = parseInt(receiptNum.toString().replace(/\D/g, ''), 10);
            const notificationId = isNaN(numericId) ? Math.floor(Date.now() / 1000) : (numericId % 2147483647); // Limit 32-bit integer

            // 2. Jadwalkan Local Notification ke System Tray Android/iOS
            try {
              const activeThemeColor = await getActiveThemeColorHex();
              await LocalNotifications.schedule({
                notifications: [
                  {
                    title: 'Pesanan Baru Masuk! 🚀',
                    body: `Pesanan #${receiptNum} dari ${order.customer_name || 'Tamu'} (Meja: ${order.table_number || 'Bawa Pulang'})`,
                    id: notificationId,
                    schedule: { at: new Date(Date.now() + 100) },
                    sound: 'ding',
                    smallIcon: 'ic_notification',
                    iconColor: activeThemeColor,
                    channelId: 'mesenae_orders',
                    extra: {
                      url: '/admin/pesanan-aktif'
                    }
                  }
                ]
              });
              console.log(`[RealtimeOrders] Local notification scheduled for order #${receiptNum} with color ${activeThemeColor}`);
            } catch (localErr) {
              console.warn('[RealtimeOrders] Failed to trigger Local Notification:', localErr);
            }
          }
        },
        (error) => {
          console.warn('[RealtimeOrders] Firestore snap listener error:', error);
          // Auto-reconnect safety loop jika internet sempat putus
          unsubscribe();
          setTimeout(() => {
            if (mounted) {
              console.log('[RealtimeOrders] Reconnecting to Firestore snapshot...');
              setupListener();
            }
          }, 5000);
        }
      );
    };

    setupListener();

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [authData]);
}
