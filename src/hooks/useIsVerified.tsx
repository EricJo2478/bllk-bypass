// src/hooks/useIsVerified.ts
import { useDocument } from "react-firebase-hooks/firestore";
import { doc } from "firebase/firestore";
import { auth, db } from "../services/firebase";

export function useIsVerified() {
  const u = auth.currentUser;
  const [snap] = useDocument(u ? doc(db, "users", u.uid) : null);
  return Boolean(snap?.data()?.verified);
}
