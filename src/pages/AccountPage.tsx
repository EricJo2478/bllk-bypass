// src/pages/AccountPage.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Card,
  Stack,
  Row,
  Col,
  Badge,
  Button,
  Alert,
  ListGroup,
  Image,
} from "react-bootstrap";
import { auth, db } from "../services/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function AccountPage() {
  const user = auth.currentUser;
  const [verifiedFlag, setVerifiedFlag] = useState<boolean | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setError("");
      if (!user) {
        setVerifiedFlag(null);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (mounted) setVerifiedFlag(Boolean(snap.data()?.verified));
      } catch (e: any) {
        if (mounted) {
          setVerifiedFlag(null);
          setError(e?.message ?? "Failed to load account profile.");
        }
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [user?.uid]);

  const providerIds = useMemo(
    () => user?.providerData?.map((p) => p.providerId) ?? [],
    [user?.providerData]
  );

  async function handleSignOut() {
    await auth.signOut();
    // optional: window.location.assign("/") to hard-redirect
  }

  if (!user) {
    // If you wrapped this route with RequireAuth, this won't show.
    return (
      <Alert variant="warning" className="mb-0">
        You’re not signed in.
      </Alert>
    );
  }

  return (
    <Card>
      <Card.Body>
        <Stack gap={3}>
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div className="d-flex align-items-center gap-3">
              <Avatar
                url={user.photoURL}
                name={user.displayName || user.email || "You"}
              />
              <div>
                <Card.Title className="mb-1">
                  {user.displayName || user.email || "Your account"}{" "}
                  {verifiedFlag ? (
                    <Badge bg="success" className="align-middle">
                      Verified
                    </Badge>
                  ) : (
                    <Badge bg="secondary" className="align-middle">
                      Unverified
                    </Badge>
                  )}
                </Card.Title>
                <div className="text-muted">
                  {user.email || "No email"} • UID:{" "}
                  <code className="user-select-all">{user.uid}</code>
                </div>
              </div>
            </div>

            <div className="d-flex gap-2">
              <Button variant="outline-secondary" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="danger" className="mb-0">
              {error}
            </Alert>
          )}

          <Row className="g-3">
            <Col md={6}>
              <Card className="h-100">
                <Card.Body>
                  <Card.Subtitle className="mb-2 text-muted">
                    Authentication
                  </Card.Subtitle>
                  <ListGroup variant="flush">
                    <ListGroup.Item>
                      <strong>Email:</strong> {user.email || "—"}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>Email verified:</strong>{" "}
                      {user.emailVerified ? "Yes" : "No"}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>Providers:</strong>{" "}
                      {providerIds.length ? providerIds.join(", ") : "—"}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>Last sign-in:</strong>{" "}
                      {user.metadata?.lastSignInTime || "—"}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>Created:</strong>{" "}
                      {user.metadata?.creationTime || "—"}
                    </ListGroup.Item>
                  </ListGroup>
                </Card.Body>
              </Card>
            </Col>

            <Col md={6}>
              <Card className="h-100">
                <Card.Body>
                  <Card.Subtitle className="mb-2 text-muted">
                    Reporting status
                  </Card.Subtitle>
                  <p className="mb-2">
                    {verifiedFlag
                      ? "You can report diverts and clear them early."
                      : "You can sign in, but you cannot submit or clear diverts unless you scan a valid unit QR. Contact an admin to be marked as verified if appropriate."}
                  </p>
                  <div className="small text-muted">
                    Verification is managed by admins and can be updated at any
                    time.
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Stack>
      </Card.Body>
    </Card>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return (
      <Image
        src={url}
        alt={name}
        roundedCircle
        style={{ width: 56, height: 56, objectFit: "cover" }}
      />
    );
  }
  // Fallback initials
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className="d-flex align-items-center justify-content-center rounded-circle bg-secondary text-white"
      style={{ width: 56, height: 56, fontWeight: 600 }}
      aria-label={name}
      title={name}
    >
      {initials || "U"}
    </div>
  );
}
