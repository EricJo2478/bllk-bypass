import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";

function getUnitFromUrl(search: string) {
  const p = new URLSearchParams(search);
  const v = p.get("unit");
  return v && v.trim() ? v.trim() : null;
}

export default function RequireVerifiedOrUnit({
  children,
}: {
  children: ReactNode;
}) {
  const loc = useLocation();
  const unitParam = getUnitFromUrl(loc.search);

  // If a unit param exists, allow and let the page verify properly.
  if (unitParam) return <>{children}</>;

  // Else require a verified user
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    async function check() {
      const u = auth.currentUser;
      if (!u) {
        setAllowed(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        setAllowed(Boolean(snap.data()?.verified));
      } catch {
        setAllowed(false);
      }
    }
    check();
  }, [auth.currentUser?.uid]);

  if (allowed === null) return null; // or spinner
  if (!allowed)
    return (
      <Navigate
        to="/login"
        state={{ next: loc.pathname + loc.search }}
        replace
      />
    );

  return <>{children}</>;
}
