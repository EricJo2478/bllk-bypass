import { useEffect, useState } from "react";
import { Navbar, Nav, Container, Button, Badge } from "react-bootstrap";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { auth, db } from "../services/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "../auth/AuthContext";

export default function AppNavbar() {
  const { user } = useAuth();
  const nav = useNavigate();

  // lightweight verified check
  const [verified, setVerified] = useState<boolean>(false);
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) return setVerified(false);
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (mounted) setVerified(Boolean(snap.data()?.verified));
      } catch {
        if (mounted) setVerified(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user?.uid]);

  async function handleSignOut() {
    await auth.signOut();
    nav("/");
  }

  return (
    <Navbar bg="light" expand="md" className="mb-4 border-bottom">
      <Container>
        <Navbar.Brand as={Link} to="/">
          EMS Diverts
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="main-nav" />
        <Navbar.Collapse id="main-nav">
          <Nav className="me-auto">
            <Nav.Link as={NavLink} to="/" end>
              Home
            </Nav.Link>
            <Nav.Link as={NavLink} to="/report">
              Report
            </Nav.Link>
          </Nav>

          <Nav className="align-items-center gap-2">
            {!user ? (
              <Nav.Link as={NavLink} to="/login">
                Sign in
              </Nav.Link>
            ) : (
              <>
                <Nav.Link
                  as={NavLink}
                  to="/account"
                  className="d-flex align-items-center gap-2"
                >
                  <span className="text-truncate" style={{ maxWidth: 160 }}>
                    {user.displayName || user.email || "Account"}
                  </span>
                  {verified && (
                    <Badge bg="success" title="Verified reporter">
                      Verified
                    </Badge>
                  )}
                </Nav.Link>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={handleSignOut}
                >
                  Sign out
                </Button>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
