import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  // ...your keys...
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
