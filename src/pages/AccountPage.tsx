// src/pages/AccountPage.tsx
import { Card, Button, Stack } from "react-bootstrap";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";

export default function AccountPage() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();

  async function handleSignOut() {
    await signOut();
    nav("/"); // redirect to home after signing out
  }

  return (
    <Card>
      <Card.Body>
        <Card.Title>My account</Card.Title>
        <Stack gap={3}>
          <div>
            <strong>Name:</strong> {user?.displayName || "—"}
          </div>
          <div>
            <strong>Email:</strong> {user?.email || "—"}
          </div>
          <div>
            <strong>UID:</strong> <code>{user?.uid}</code>
          </div>

          <div>
            <Button variant="outline-danger" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </Stack>
      </Card.Body>
    </Card>
  );
}
