import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Container } from "react-bootstrap";
import { AuthProvider } from "./auth/AuthContext";
import RequireAuth from "./auth/RequireAuth";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Container className="py-4">
          <Routes>
            <Route path="/" element={<LandingPage />} />

            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/account"
              element={
                <RequireAuth>
                  <AccountPage />
                </RequireAuth>
              }
            />

            {/* Option A: let ReportPage handle blocking UI itself (simplest) */}
            <Route path="/report" element={<ReportPage />} />

            {/* Option B: lightweight guard—uncomment to require verified OR unit=? */}
            {/*
            <Route
              path="/report"
              element={
                <RequireVerifiedOrUnit>
                  <ReportPage />
                </RequireVerifiedOrUnit>
              }
            />
            */}

            {/* catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Container>
      </BrowserRouter>
    </AuthProvider>
  );
}
