import { useEffect, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db as firestoreDb } from '@/lib/firebase';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics } from '@capacitor/haptics';
import { toast } from 'sonner';
import { processedNotificationIds } from '@/lib/fcm';

export function useRealtimeOrders() {
  const isInitialLoad = useRef(true);
  const knownOrderIds = useRef<Set<string>>(new Set());
  const sessionStartTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    let mounted = true;
    let unsubscribe = () => {};

    // Only listen if logged in user is admin, cashier, or kitchen staff
    const authDataStr = localStorage.getItem('admin_auth') || '{}';
    let authData: any = {};
    try {
      authData = JSON.parse(authDataStr);
    } catch (_) {}

    const isAuthorizedRole = authData.role === 'admin' || authData.role === 'dapur' || authData.role === 'kasir' || authData.role === 'kitchen';
    if (!isAuthorizedRole) {
      return;
    }

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
                
                // If not initial load, register for notification trigger
                if (!isInitialLoad.current) {
                  const orderDateStr = data.date || data.createdAt;
                  const orderTime = orderDateStr ? new Date(orderDateStr).getTime() : 0;
                  if (orderTime >= sessionStartTimeRef.current) {
                    // Only process notifications for transactions originating from the Web customerapp (filtering out cashier orders)
                    const remarksLower = (data.remarks || '').toLowerCase();
                    const isFromWeb = remarksLower.includes('web') || remarksLower.includes('split');
                    if (isFromWeb) {
                      newOrders.push({ id, ...data });
                    }
                  }
                }
              }
            }
          });

          // Mark initial load finished on first snap callback
          if (isInitialLoad.current) {
            isInitialLoad.current = false;
            console.log(`[RealtimeOrders] Initial load synced. Registered ${knownOrderIds.current.size} existing orders.`);
            return;
          }

          // Trigger fallback local notifications for new orders when app is active (foreground)
          if (newOrders.length > 0) {
            for (const order of newOrders) {
              const receiptNum = order.receipt_number || order.receiptNumber || 'Baru';
              
              // 1. Deduplicate check: if this transaction ID or receipt is already handled
              if (processedNotificationIds.has(receiptNum)) {
                console.log(`[RealtimeOrders] Order #${receiptNum} already notified via FCM, skipping duplicate.`);
                continue;
              }
              
              processedNotificationIds.add(receiptNum);

              // Play notification sound
              try {
                const audio = new Audio('/ding.mp3');
                audio.play().catch(e => console.warn('[RealtimeOrders] Audio play blocked:', e));
              } catch (soundErr) {
                console.error('[RealtimeOrders] Sound player error:', soundErr);
              }

              // Trigger vibration
              Haptics.vibrate({ duration: 500 }).catch(() => {});

              // Show dynamic Sonner toast
              toast.success(`Pesanan Baru Masuk 🚀`, {
                description: `No: #${receiptNum} dari ${order.customer_name || 'Tamu'} (Meja: ${order.table_number || 'Bawa Pulang'})`,
                duration: 8000,
                position: 'bottom-right'
              });

              // 2. Always push Local Notification to status bar for maximum visibility
              // Fires regardless of app foreground/background state as long as the Firestore listener is alive
              try {
                await LocalNotifications.schedule({
                  notifications: [
                    {
                      title: 'Pesanan Baru Masuk! 🚀',
                      body: `Pesanan #${receiptNum} dari ${order.customer_name || 'Tamu'} (Meja: ${order.table_number || 'Bawa Pulang'})`,
                      id: Math.floor(Math.random() * 100000),
                      schedule: { at: new Date(Date.now() + 100) },
                      sound: 'ding.mp3',
                      smallIcon: 'ic_notification',
                      iconColor: '#f97316',
                      channelId: 'mesenae_orders',
                      extra: {
                        url: '/admin/pesanan-aktif'
                      }
                    }
                  ]
                });
                console.log(`[RealtimeOrders] Local notification scheduled for order #${receiptNum}`);
              } catch (localErr) {
                console.warn('[RealtimeOrders] Failed to trigger Local Notification:', localErr);
              }
            }
          }
        },
        (error) => {
          console.warn('[RealtimeOrders] Firestore snap listener error:', error);
          // Auto-reconnect safety loop
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
  }, []);
}
