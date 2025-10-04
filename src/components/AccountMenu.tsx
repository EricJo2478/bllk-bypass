import { Nav, NavDropdown } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function AccountMenu() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();

  if (!user) {
    return <Nav.Link as={Link} to="/signin">Sign in</Nav.Link>;
  }

  return (
    <NavDropdown title={user.displayName || user.email || "Account"} id="account-menu" align="end">
      <NavDropdown.Item as={Link} to="/account">My account</NavDropdown.Item>
      <NavDropdown.Divider />
      <NavDropdown.Item onClick={async () => { await signOut(); nav("/"); }}>
        Sign out
      </NavDropdown.Item>
    </NavDropdown>
  );
}
