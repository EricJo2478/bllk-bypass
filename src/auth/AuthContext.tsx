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
    (async () => {
      try {
        const expect = localStorage.getItem("auth:expectRedirect");
        if (!expect) {
          // no redirect was initiated by this tab/session
          return;
        }
        // clear the flag immediately to avoid repeated calls
        localStorage.removeItem("auth:expectRedirect");

        const res = await getRedirectResult(auth);
        if (res?.user) {
          console.debug("[auth] redirect result user:", res.user.uid);
          await ensureUserDoc(res.user); // optional
        } else {
          console.debug("[auth] redirect returned null user (ok)");
        }
      } catch (e) {
        console.error("[auth] getRedirectResult error:", e);
      }
    })();
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
          if (isMobileLike()) {
            // mark that we initiated a redirect
            localStorage.setItem("auth:expectRedirect", "1");
            await signInWithRedirect(auth, provider);
            return; // we’re navigating away
          } else {
            await signInWithPopup(auth, provider);
          }
        } catch (err: any) {
          if (String(err?.code || "").includes("popup-")) {
            localStorage.setItem("auth:expectRedirect", "1");
            await signInWithRedirect(auth, provider);
            return;
          }
          throw err;
        }
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
