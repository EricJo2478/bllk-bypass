import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import type { ReactNode } from "react";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) return null; // or a spinner
  if (!user)
    return (
      <Navigate
        to="/login"
        state={{ next: loc.pathname + loc.search }}
        replace
      />
    );

  return <>{children}</>;
}
