// src/auth/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useState,
} from "react";
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
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
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
  user: User | null;
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
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true); // ← gate rendering until redirect+initial state done

  // Finish redirect (only if we initiated one)
  useEffect(() => {
    (async () => {
      try {
        const expect = localStorage.getItem("auth:expectRedirect");
        if (expect) {
          localStorage.removeItem("auth:expectRedirect");
          const res = await getRedirectResult(auth);
          if (res?.user) {
            console.debug("[auth] redirect user:", res.user.uid);
            await ensureUserDoc(res.user);
          } else {
            console.debug("[auth] redirect: no user (ok)");
          }
        }
      } catch (e) {
        console.error("[auth] getRedirectResult error:", e);
      } finally {
        // After attempting redirect handoff, we still wait for the initial auth state below
      }
    })();
  }, []);

  // Subscribe to auth state; resolve initial state before rendering
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // optional: ensure profile exists on any sign-in
        await ensureUserDoc(u);
      }
      // First time this fires, we’re done booting
      setBooting(false);
      console.debug("[auth] onAuthStateChanged:", u ? u.uid : null);
    });
    return () => unsub();
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      user,
      loading: booting, // consumers can treat "booting" as loading
      async signInEmail(email, password) {
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged will fire
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

        console.debug(
          "[auth] signInGoogle auth app:",
          (auth as any)?.app?.name
        );

        try {
          if (isMobileLike()) {
            localStorage.setItem("auth:expectRedirect", "1");
            await signInWithRedirect(auth, provider);
          } else {
            await signInWithPopup(auth, provider);
          }
        } catch (err: any) {
          if (String(err?.code || "").startsWith("auth/popup-")) {
            localStorage.setItem("auth:expectRedirect", "1");
            await signInWithRedirect(auth, provider);
          } else {
            console.error("[auth] signInGoogle error:", err);
            throw err;
          }
        }
      },
      async signOut() {
        await fbSignOut(auth);
      },
    }),
    [user, booting]
  );

  // Gate rendering until we’ve finished redirect handoff + received initial auth state.
  if (booting) {
    return null; // or a small splash/loader
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
