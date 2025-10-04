import { useState } from "react";
import { Button, Card, Col, Form, Row, Stack } from "react-bootstrap";
import { useAuth } from "../auth/AuthContext";
import { Link, useNavigate } from "react-router-dom";

export default function SignInPage() {
  const { signInEmail, signUpEmail, signInGoogle } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const nav = useNavigate();
  const next = "/";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (mode === "signin") {
        await signInEmail(email, password);
      } else {
        await signUpEmail(email, password, displayName || undefined);
      }
      nav(next);
    } catch (err: any) {
      setError(err?.message ?? "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Row className="justify-content-center">
      <Col md={6} lg={5}>
        <Card>
          <Card.Body>
            <Stack gap={3}>
              <div className="d-flex justify-content-between align-items-center">
                <Card.Title className="mb-0">
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Card.Title>
                <Button
                  variant="link"
                  onClick={() =>
                    setMode(mode === "signin" ? "signup" : "signin")
                  }
                >
                  {mode === "signin" ? "Need an account?" : "Have an account?"}
                </Button>
              </div>

              <Form onSubmit={onSubmit}>
                <Stack gap={3}>
                  {mode === "signup" && (
                    <Form.Group>
                      <Form.Label>Display name</Form.Label>
                      <Form.Control
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                      />
                    </Form.Group>
                  )}
                  <Form.Group>
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Password</Form.Label>
                    <Form.Control
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </Form.Group>
                  {error && <div className="text-danger small">{error}</div>}
                  <div className="d-grid">
                    <Button type="submit" disabled={submitting}>
                      {submitting
                        ? "Please wait…"
                        : mode === "signin"
                        ? "Sign in"
                        : "Create account"}
                    </Button>
                  </div>
                </Stack>
              </Form>

              <div className="text-center text-muted">or</div>

              <div className="d-grid">
                <Button
                  variant="outline-secondary"
                  onClick={async () => {
                    await signInGoogle();
                    nav("/");
                  }}
                >
                  Continue with Google
                </Button>
              </div>

              <div className="text-center">
                <small>
                  By continuing you agree to the <Link to="#">terms</Link>.
                </small>
              </div>
            </Stack>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}
