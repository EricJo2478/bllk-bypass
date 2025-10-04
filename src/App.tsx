import { Routes, Route, Link, useParams } from "react-router-dom";
import { Container, Navbar, Nav } from "react-bootstrap";
import DailyPage from "./pages/DailyPage";
import ReportDivertForm from "./components/ReportDivertForm";
import { collection } from "firebase/firestore";
import { useCollection } from "react-firebase-hooks/firestore";
import { db } from "./services/firebase";
import SignInPage from "./pages/SignInPage";
import AccountPage from "./pages/AccountPage";
import { useAuth } from "./auth/AuthContext";

function DailyWrapper() {
  const { dateKey } = useParams();
  return <DailyPage dateKey={dateKey} />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <>
      <Navbar className="mb-4" expand="sm">
        <Container>
          <Navbar.Brand as={Link} to="/">
            EMS Diverts
          </Navbar.Brand>
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/report">
              Report
            </Nav.Link>
            {user ? (
              <Nav.Link as={Link} to="/account">
                Account
              </Nav.Link>
            ) : (
              <Nav.Link as={Link} to="/signin">
                Sign In
              </Nav.Link>
            )}
          </Nav>
        </Container>
      </Navbar>

      <Container className="pb-5">
        <Routes>
          <Route path="/" element={<DailyWrapper />} />
          <Route path="/:dateKey" element={<DailyWrapper />} />
          <Route path="/report" element={<ReportRoute />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/account" element={<AccountPage />} />
        </Routes>
      </Container>
    </>
  );
}

function ReportRoute() {
  const [snap] = useCollection(collection(db, "hospitals"));
  const hospitals =
    snap?.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) ?? [];
  return (
    <ReportDivertForm
      hospitals={hospitals}
      onSubmitted={() => history.back()}
    />
  );
}
