import { initializeApp, getApps } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { getMessaging, isSupported as isMessagingSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Pastikan hanya ada 1 instance Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Inisialisasi Firestore dengan persistentLocalCache (Firestore SDK v9.20+ / v10+)
// Ini menggantikan enableIndexedDbPersistence yang sudah deprecated.
// persistentMultipleTabManager memungkinkan cache bekerja di multi-tab tanpa error.
let db: ReturnType<typeof getFirestore>;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch (e) {
  // Fallback jika sudah diinisialisasi sebelumnya (HMR / dev reload)
  db = getFirestore(app);
}

const storage = getStorage(app);

// Analytics — hanya di browser yang mendukung
let analytics: any = null;
isAnalyticsSupported().then(supported => {
  if (supported) analytics = getAnalytics(app);
}).catch(() => {});

// Messaging — hanya di browser yang mendukung (bukan SSR / Node)
const getMessagingInstance = async () => {
  try {
    const supported = await isMessagingSupported();
    if (!supported) return null;
    return getMessaging(app);
  } catch {
    return null;
  }
};

export { app, db, storage, analytics, getMessagingInstance };
