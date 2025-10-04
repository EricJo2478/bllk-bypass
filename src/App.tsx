import { Routes, Link } from "react-router-dom";
import { Container, Navbar, Nav } from "react-bootstrap";
import { useAuth } from "./auth/AuthContext";

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
        <Routes></Routes>
      </Container>
    </>
  );
}
