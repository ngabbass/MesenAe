// firebase-messaging-sw.js — Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// 1. Ambil konfigurasi dari query parameters (Dikirim dari fcm.ts)
const params = new URLSearchParams(self.location.search);

// 2. Inisialisasi Firebase App
firebase.initializeApp({
  apiKey: params.get('apiKey') || "",
  authDomain: params.get('authDomain') || "",
  projectId: params.get('projectId') || "",
  storageBucket: params.get('storageBucket') || "",
  messagingSenderId: params.get('messagingSenderId') || "",
  appId: params.get('appId') || "",
});

const messaging = firebase.messaging();

// 3. Tangani Pesan Background via API resmi Firebase (Mencegah Notifikasi Ganda)
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM SW] Menerima pesan di background:', payload);

  const title = payload.notification?.title || payload.data?.title || 'MesenAe';
  const body  = payload.notification?.body  || payload.data?.body  || '';
  const url   = payload.data?.url || '/';

  const options = {
    body,
    icon: '/logo.png',
    badge: '/logo.png',
    // Pola getar kompatibel dan kuat
    vibrate: [500, 200, 500, 200, 500, 200, 500, 200, 500],
    data: { url },
    renotify: true,
    requireInteraction: true,
    silent: false,
    tag: 'mesenae-notification'
  };

  self.registration.showNotification(title, options);
});

// 4. Intercept klik notifikasi untuk navigasi cerdas
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Jika tab sudah terbuka → fokuskan dan navigasikan (hindari refresh jika memungkinkan)
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          // Menggunakan postMessage lebih halus untuk SPA (React) agar tidak full-reload
          client.postMessage({ type: 'FCM_NAVIGATE', url: targetUrl });
          return client.focus();
        }
      }
      // Jika belum ada tab yang terbuka → buka tab/jendela baru
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
