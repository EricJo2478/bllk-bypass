import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Container } from "react-bootstrap";
import { AuthProvider } from "./auth/AuthContext";
import RequireAuth from "./auth/RequireAuth";
import RequireVerifiedOrUnit from "./auth/RequireVerifiedOrUnit";
import ReportPage from "./pages/ReportPage";
import AppNavbar from "./components/AppNavbar";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppNavbar />
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
            {
              <Route
                path="/report"
                element={
                  <RequireVerifiedOrUnit>
                    <ReportPage />
                  </RequireVerifiedOrUnit>
                }
              />
            }

            {/* catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Container>
      </BrowserRouter>
    </AuthProvider>
  );
}
