import React, { useEffect, useRef } from 'react';
import { useDbQuery, Transaction } from '@/hooks/db-hooks';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics } from '@capacitor/haptics';
import { processedNotificationIds } from '@/lib/fcm';
import { getActiveThemeColorHex } from '@/hooks/use-theme-color';

export default function GlobalAdminNotifier() {
  const allBills = useDbQuery<Transaction>('transactions') || [];
  
  const seenIdsRef = useRef<Set<string>>(new Set());
  const isInitializedRef = useRef(false);
  const sessionStartTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    // Jika data belum dimuat dari database, lewatkan
    if (!allBills || allBills.length === 0) return;

    const authDataStr = localStorage.getItem('admin_auth') || '{}';
    let authData: any = {};
    try {
      authData = JSON.parse(authDataStr);
    } catch (_) {}
    const currentCashierName = authData.name || authData.username || 'Kasir';
    const currentCashier = String(currentCashierName).trim().toLowerCase();

    // 1. Jalankan filter openBills di dalam useEffect untuk menghindari masalah referensi render React
    const openBills = allBills.filter((t) => {
      // Filter out transactions created by the current user to prevent self-notifications
      const txCashier = String(t.cashier_name || (t as any).cashierName || '').trim().toLowerCase();
      if (txCashier === currentCashier) return false;

      const isUnpaid = t.status === 'belum lunas';
      const isPaidButCooking = t.status === 'lunas' && t.kitchenStatus && !['diantarkan', 'selesai'].includes(t.kitchenStatus);
      const isPaidRetailWeb = t.status === 'lunas' && t.remarks === 'Pesanan dari Web' && (!t.kitchenStatus || t.kitchenStatus === 'pending');
      
      return isUnpaid || isPaidButCooking || isPaidRetailWeb;
    });

    // Normalisasi semua ID transaksi aktif saat ini ke string
    const currentIds = openBills
      .map(t => String(t.id))
      .filter(id => id && id !== 'undefined' && id !== 'null');

    // Inisialisasi awal: Rekam semua pesanan yang sudah ada saat aplikasi dibuka agar tidak memicu alarm palsu
    if (!isInitializedRef.current) {
      currentIds.forEach(id => seenIdsRef.current.add(id));
      isInitializedRef.current = true;
      console.log(`[GlobalNotifier] Initialized. Monitoring ${seenIdsRef.current.size} open bills.`);
      return;
    }

    // Cari ID yang benar-benar baru masuk ke daftar openBills
    const trulyNewIds = currentIds.filter(id => !seenIdsRef.current.has(id));

    // Perbarui cache Set kumulatif
    currentIds.forEach(id => seenIdsRef.current.add(id));

    if (trulyNewIds.length === 0) return;

    // Filter berdasarkan waktu transaksi secara aman (Mendukung Firestore Timestamp & String ISO)
    const recentNewBills = openBills.filter(t => {
      const sid = String(t.id);
      if (!trulyNewIds.includes(sid)) return false;

      let txTime = 0;
      const txDate = t.date || (t as any).createdAt;
      if (txDate) {
        if (typeof txDate.toDate === 'function') {
          txTime = txDate.toDate().getTime(); // Jika formatnya Firestore Timestamp asli
        } else {
          txTime = new Date(txDate).getTime(); // Jika formatnya String ISO / Number
        }
      }
      return txTime >= sessionStartTimeRef.current;
    });

    if (recentNewBills.length === 0) return;

    // 2. Eksekusi Trigger Notifikasi
    const triggerNotification = async () => {
      let isNotificationPermitted = false;

      // Cek izin notifikasi native sekali saja sebelum masuk ke looping pesanan
      if (Capacitor.isNativePlatform()) {
        try {
          let permStatus = await LocalNotifications.checkPermissions();
          if (permStatus.display === 'prompt') {
            permStatus = await LocalNotifications.requestPermissions();
          }
          isNotificationPermitted = permStatus.display === 'granted';
        } catch (e) {
          console.error('[GlobalNotifier] Error checking permissions:', e);
        }
      }

      for (const bill of recentNewBills) {
        const receiptNum = (bill as any).receipt_number || (bill as any).receiptNumber || String(bill.id);
        
        // Sinkronisasi lintas sistem: Lewati jika sudah di-handle oleh useRealtimeOrders / FCM
        if (processedNotificationIds.has(receiptNum)) {
          console.log(`[GlobalNotifier] Order #${receiptNum} already handled elsewhere, skipping.`);
          continue;
        }
        processedNotificationIds.add(receiptNum);

        const title = 'Pesanan Baru Masuk! 🔔';
        const body = `Pesanan #${receiptNum} dari ${(bill as any).customer_name || 'Tamu'} menunggu konfirmasi.`;

        // Jalur Android / iOS Native
        if (Capacitor.isNativePlatform()) {
          try {
            Haptics.vibrate({ duration: 500 }).catch(() => {});
            
            if (isNotificationPermitted) {
              // ID Deterministik berbasis angka dari nomor resi untuk mencegah crash overflow
              const numericId = parseInt(receiptNum.toString().replace(/\D/g, ''), 10);
              const notificationId = isNaN(numericId) ? Math.floor(Date.now() / 1000) : (numericId % 2147483647);

              const activeThemeColor = await getActiveThemeColorHex();
              await LocalNotifications.schedule({
                notifications: [
                  {
                    title,
                    body,
                    id: notificationId,
                    schedule: { at: new Date(Date.now() + 150) },
                    channelId: 'mesenae_orders',
                    sound: 'ding.mp3',
                    smallIcon: 'ic_notification',
                    iconColor: activeThemeColor,
                  }
                ]
              });
              console.log(`[GlobalNotifier] Native local notification pushed for #${receiptNum} with color ${activeThemeColor}`);
            }
          } catch (e) {
            console.error('[GlobalNotifier] Native push error:', e);
          }
        } 
        // Jalur Web Browser Standard
        else if (typeof window !== 'undefined' && 'Notification' in window) {
          try {
            const audio = new Audio('/ding.mp3');
            audio.play().catch(() => {});
          } catch (_) {}

          if ((window as any).Notification.permission === 'granted') {
            const options = {
              body,
              icon: '/logo.png',
              vibrate: [500, 110, 500],
              requireInteraction: true,
              silent: false,
              data: { url: '/admin/orders' }
            };
            
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
              navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, options);
              }).catch(() => {
                try { new (window as any).Notification(title, options); } catch(e) {}
              });
            } else {
              try { new (window as any).Notification(title, options); } catch(e) {}
            }
          }
        }
      }
    };

    triggerNotification();
  }, [allBills]); // Hanya berjalan ulang jika data array transaksi dari DB berubah total.

  return null;
}
