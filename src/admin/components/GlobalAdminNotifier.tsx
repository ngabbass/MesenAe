import React, { useEffect, useRef } from 'react';
import { useDbQuery, Transaction } from '@/hooks/db-hooks';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics } from '@capacitor/haptics';
import { processedNotificationIds } from '@/lib/fcm';

export default function GlobalAdminNotifier() {
  const allBills = useDbQuery<Transaction>('transactions') || [];
  
  // Filter yang sama persis dengan ActiveOrders untuk menangkap semua pesanan yang butuh perhatian admin/dapur
  const openBills = allBills.filter((t) => {
    // Hanya proses notifikasi untuk transaksi yang berasal dari Web Customer (tidak memicu alarm untuk transaksi kasir lokal)
    const remarksLower = (t.remarks || '').toLowerCase();
    const isFromWeb = remarksLower.includes('web') || remarksLower.includes('split');
    if (!isFromWeb) return false;

    const isUnpaid = t.status === 'belum lunas';
    const isPaidButCooking = t.status === 'lunas' && t.kitchenStatus && !['diantarkan', 'selesai'].includes(t.kitchenStatus);
    const isPaidRetailWeb = t.status === 'lunas' && t.remarks === 'Pesanan dari Web' && (!t.kitchenStatus || t.kitchenStatus === 'pending');
    return isUnpaid || isPaidButCooking || isPaidRetailWeb;
  });

  // Set kumulatif: sekali ID masuk set ini, TIDAK PERNAH dihapus.
  // Ini mencegah false alarm ketika pesanan keluar lalu masuk kembali ke openBills
  // akibat perubahan status dapur atau fluktuasi data Firestore real-time.
  const seenIdsRef = useRef<Set<string>>(new Set());
  const isInitializedRef = useRef(false);
  const sessionStartTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    // Jika query database belum memuat data, tunggu
    if (allBills.length === 0) return;

    // Normalisasi SEMUA ID ke string untuk konsistensi (Firestore=string, IndexedDB bisa number)
    const currentIds = openBills
      .map(t => String(t.id))
      .filter(id => id && id !== 'undefined' && id !== 'null');

    // Inisialisasi pertama: catat semua ID yang sudah ada TANPA membunyikan notifikasi
    if (!isInitializedRef.current) {
      currentIds.forEach(id => seenIdsRef.current.add(id));
      isInitializedRef.current = true;
      return;
    }

    // Cari ID yang BENAR-BENAR baru (belum pernah terlihat sama sekali)
    const trulyNewIds = currentIds.filter(id => !seenIdsRef.current.has(id));

    // Tambahkan SEMUA ID saat ini ke set kumulatif (termasuk yang lama)
    currentIds.forEach(id => seenIdsRef.current.add(id));

    // Jika tidak ada ID baru, selesai — TIDAK ADA notifikasi
    if (trulyNewIds.length === 0) return;

    // Filter tambahan: hanya notifikasi untuk transaksi yang dibuat setelah sesi aktif
    const recentNewBills = openBills.filter(t => {
      const sid = String(t.id);
      if (!trulyNewIds.includes(sid)) return false;
      const txTime = t.date ? new Date(t.date).getTime() : 0;
      return txTime >= sessionStartTimeRef.current;
    });

    if (recentNewBills.length === 0) return;

    // === HANYA sampai di sini jika ada pesanan BENAR-BENAR BARU ===
    const triggerNotification = async () => {
      for (const bill of recentNewBills) {
        const receiptNum = (bill as any).receipt_number || (bill as any).receiptNumber || String(bill.id);
        
        // Cross-system deduplication: cek apakah useRealtimeOrders atau FCM listener sudah menangani pesanan ini
        if (processedNotificationIds.has(receiptNum)) {
          console.log(`[GlobalNotifier] Order #${receiptNum} already handled by useRealtimeOrders/FCM, skipping.`);
          continue;
        }
        processedNotificationIds.add(receiptNum);

        const title = 'Pesanan Baru Masuk! 🔔';
        const body = `Pesanan #${receiptNum} dari ${(bill as any).customer_name || 'Tamu'} menunggu konfirmasi.`;

        if (Capacitor.isNativePlatform()) {
          try {
            await Haptics.vibrate({ duration: 500 });
            
            let permStatus = await LocalNotifications.checkPermissions();
            if (permStatus.display === 'prompt') {
              permStatus = await LocalNotifications.requestPermissions();
            }
            if (permStatus.display === 'granted') {
              await LocalNotifications.schedule({
                notifications: [
                  {
                    title,
                    body,
                    id: Math.floor(Math.random() * 100000),
                    schedule: { at: new Date(Date.now() + 150) },
                    channelId: 'mesenae_orders',
                    sound: 'ding.mp3',
                    smallIcon: 'ic_notification',
                    iconColor: '#f97316',
                  }
                ]
              });
              console.log(`[GlobalNotifier] Local notification pushed for order #${receiptNum}`);
            }
          } catch (e) {
            console.error('[GlobalNotifier] Error with native notification:', e);
          }
        } else if (typeof window !== 'undefined' && 'Notification' in window) {
          // Web: play ding sound + show Web Notification
          try {
            const audio = new Audio('/ding.mp3');
            audio.play().catch(() => {});
          } catch (_) {}

          if ((window as any).Notification.permission === 'granted') {
            const options = {
              body,
              icon: '/logo.png',
              vibrate: [500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 450, 110, 200, 110, 170, 40, 500],
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
  }, [openBills, allBills.length]);

  return null;
}
