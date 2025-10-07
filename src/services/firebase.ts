import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);

// ✅ Robust multi-fallback persistence so redirect survives reloads
export const auth = initializeAuth(app, {
  persistence: [
    indexedDBLocalPersistence, // best (survives reloads, multi-tab)
    browserLocalPersistence, // good fallback
    browserSessionPersistence, // last resort (survives redirects in same tab)
  ],
});

// Firestore (unchanged; optional caching)
export const db = getFirestore(app);
