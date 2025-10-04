// src/pages/LoginPage.tsx
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, Form, Button, Stack, Alert, Row, Col } from "react-bootstrap";
import { useAuth } from "../auth/AuthContext";

export default function LoginPage() {
  const { signInEmail, signUpEmail, signInGoogle, loading, user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as any;
  const next = (loc.state && loc.state.next) || "/";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string>("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (mode === "signin") {
        await signInEmail(email.trim(), password);
      } else {
        await signUpEmail(
          email.trim(),
          password,
          displayName.trim() || undefined
        );
      }
      nav(next, { replace: true });
    } catch (err: any) {
      setError(err?.message ?? "Authentication failed");
    }
  }

  async function handleGoogle() {
    setError("");
    try {
      await signInGoogle(); // popup on desktop, redirect on mobile (handled in AuthContext)
      nav(next, { replace: true });
    } catch (err: any) {
      setError(err?.message ?? "Google sign-in failed");
    }
  }

  // If already logged in, bounce away
  if (user && !loading) {
    nav(next, { replace: true });
    return null;
  }

  return (
    <Card>
      <Card.Body>
        <Stack gap={3}>
          <div className="d-flex justify-content-between align-items-start">
            <Card.Title className="mb-0">
              {mode === "signin" ? "Sign in" : "Create your account"}
            </Card.Title>
            <Button
              variant="link"
              className="p-0"
              onClick={() => {
                setMode((m) => (m === "signin" ? "signup" : "signin"));
                setError("");
              }}
            >
              {mode === "signin"
                ? "Need an account? Sign up"
                : "Have an account? Sign in"}
            </Button>
          </div>

          {error && (
            <Alert variant="danger" className="mb-0">
              {error}
            </Alert>
          )}

          <Form onSubmit={handleSubmit}>
            <Stack gap={3}>
              {mode === "signup" && (
                <Form.Group>
                  <Form.Label>Display name</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Jane Paramedic"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </Form.Group>
              )}

              <Row>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Password</Form.Label>
                    <Form.Control
                      type="password"
                      autoComplete={
                        mode === "signin" ? "current-password" : "new-password"
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>

              <div className="d-flex gap-2">
                <Button type="submit" disabled={loading}>
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={handleGoogle}
                  disabled={loading}
                >
                  Continue with Google
                </Button>
              </div>

              <Form.Text className="text-muted">
                After signing {mode === "signin" ? "in" : "up"}, you’ll be sent
                to: <strong>{next}</strong>
              </Form.Text>
            </Stack>
          </Form>

          <div className="text-muted small">
            By signing in you agree to our operational use of data to track
            divert status.
          </div>
        </Stack>
      </Card.Body>
    </Card>
  );
}
