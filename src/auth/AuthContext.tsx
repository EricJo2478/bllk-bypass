// src/auth/AuthContext.tsx
import React, { createContext, useContext, useMemo, useEffect } from "react";
import { auth, db } from "../services/firebase";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  type User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { isMobileLike } from "../utils/device";

async function ensureUserDoc(u: User) {
  try {
    const ref = doc(db, "users", u.uid);
    const base = {
      displayName: u.displayName ?? "",
      email: u.email ?? "",
      photoURL: u.photoURL ?? null,
      providers: (u.providerData ?? []).map((p) => p.providerId),
      // Note: updatedAt will change on every login; that's fine.
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, base, { merge: true });
  } catch (e) {
    console.error("ensureUserDoc failed:", e);
  }
}

type Ctx = {
  user: User | null | undefined;
  loading: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, loading] = useAuthState(auth);

  useEffect(() => {
    // Completes Google redirect flow on mobile
    getRedirectResult(auth).catch(() => {});
  }, []);

  // 👇 Ensure a Firestore user doc exists for any provider
  useEffect(() => {
    if (user) {
      ensureUserDoc(user).catch(console.error);
    }
  }, [user?.uid]); // run once per uid

  const value = useMemo<Ctx>(
    () => ({
      user,
      loading,
      async signInEmail(email, password) {
        await signInWithEmailAndPassword(auth, email, password);
        // ensureUserDoc will run via the effect
      },
      async signUpEmail(email, password, displayName) {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        if (displayName) {
          await updateProfile(cred.user, { displayName });
        }
        await ensureUserDoc(cred.user); // optional; effect will also run
      },
      async signInGoogle() {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        try {
          if (isMobileLike()) await signInWithRedirect(auth, provider);
          else await signInWithPopup(auth, provider);
        } catch (err: any) {
          if (String(err?.code || "").includes("popup-")) {
            await signInWithRedirect(auth, provider);
          } else {
            throw err;
          }
        }
        // ensureUserDoc runs after redirect/popup via effect
      },
      async signOut() {
        await fbSignOut(auth);
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
