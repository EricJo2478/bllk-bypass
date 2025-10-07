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
    await setDoc(
      ref,
      {
        displayName: u.displayName ?? "",
        email: u.email ?? "",
        photoURL: u.photoURL ?? null,
        providers: (u.providerData ?? []).map((p) => p.providerId),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
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

  // Only finish redirect if WE initiated one (prevents auth/argument-error)
  useEffect(() => {
    (async () => {
      try {
        const expect = localStorage.getItem("auth:expectRedirect");
        if (!expect) return;
        localStorage.removeItem("auth:expectRedirect");

        const res = await getRedirectResult(auth);
        if (res?.user) {
          console.debug("[auth] redirect user:", res.user.uid);
          await ensureUserDoc(res.user);
        } else {
          console.debug("[auth] redirect: no user (ok)");
        }
      } catch (e) {
        console.error("[auth] getRedirectResult error:", e);
      }
    })();
  }, []);

  useEffect(() => {
    if (user) ensureUserDoc(user).catch(console.error);
  }, [user?.uid]);

  const value = useMemo<Ctx>(
    () => ({
      user,
      loading,
      async signInEmail(email, password) {
        await signInWithEmailAndPassword(auth, email, password);
      },
      async signUpEmail(email, password, displayName) {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        if (displayName) await updateProfile(cred.user, { displayName });
        await ensureUserDoc(cred.user);
      },
      async signInGoogle() {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });

        console.log("[auth] config", {
          authDomain: (auth as any)?.config?.authDomain,
          appName: (auth as any)?.app?.name,
          providerId: (provider as any)?.providerId,
        });

        try {
          if (isMobileLike()) {
            localStorage.setItem("auth:expectRedirect", "1");
            await signInWithRedirect(auth, provider);
          } else {
            await signInWithPopup(auth, provider);
          }
        } catch (err: any) {
          console.error(
            "[auth] signInGoogle failed:",
            err?.code,
            err?.message,
            err
          );
          if (String(err?.code || "").startsWith("auth/popup-")) {
            localStorage.setItem("auth:expectRedirect", "1");
            await signInWithRedirect(auth, provider);
          } else {
            throw err;
          }
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
