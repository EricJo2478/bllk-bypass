import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Modal,
  Row,
  Stack,
  Table,
} from "react-bootstrap";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import QRCode from "qrcode";
import { db, auth } from "../services/firebase";
import type { Hospital, UnitDoc } from "../types";

/** Secure-ish random key for QR reporting */
function genKey(len = 24) {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => alphabet[n % alphabet.length]).join("");
}

function buildUnitUrl(origin: string, unitId: string, reportKey: string) {
  const u = new URL("/report", origin);
  u.searchParams.set("unit", unitId);
  u.searchParams.set("key", reportKey);
  return u.toString();
}

export default function AdminPage() {
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminError, setAdminError] = useState<string>("");

  // Try to read meta/admins (rules restrict to admins)
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "meta", "admins"));
        if (snap.exists()) {
          const map = snap.data() || {};
          const uid = auth.currentUser?.uid || "";
          setIsAdmin(Boolean(uid && map[uid]));
        } else {
          setIsAdmin(false);
        }
      } catch (e: any) {
        // Permission denied → not admin
        setIsAdmin(false);
        setAdminError(e?.message || "Not authorized.");
      } finally {
        setCheckingAdmin(false);
      }
    })();
  }, []);

  // Hospitals for multi-select
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  useEffect(() => {
    (async () => {
      const qs = await getDocs(query(collection(db, "hospitals")));
      const rows = qs.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((h: any) => h.active !== false)
        .sort((a: Hospital, b: Hospital) => a.name.localeCompare(b.name));
      setHospitals(rows as Hospital[]);
    })();
  }, []);

  // Units list
  const [units, setUnits] = useState<Array<UnitDoc & { id: string }>>([]);
  async function reloadUnits() {
    const qs = await getDocs(query(collection(db, "units")));
    const rows = qs.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    setUnits(rows as any);
  }
  useEffect(() => {
    if (isAdmin) reloadUnits();
  }, [isAdmin]);

  // Create form
  const [label, setLabel] = useState("");
  const [allowed, setAllowed] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string>("");

  function toggleAllowed(id: string) {
    setAllowed((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.concat(id)
    );
  }

  async function createUnit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!label.trim()) {
      setErr("Label is required.");
      return;
    }
    if (allowed.length === 0) {
      setErr("Select at least one hospital.");
      return;
    }
    setCreating(true);
    try {
      const reportKey = genKey();
      await addDoc(collection(db, "units"), {
        label: label.trim(),
        allowedHospitals: allowed,
        active: Boolean(active),
        reportKey,
        createdAt: serverTimestamp(),
        createdByUid: auth.currentUser?.uid || null,
      });
      setLabel("");
      setAllowed([]);
      setActive(true);
      await reloadUnits();
    } catch (e: any) {
      setErr(e?.message || "Failed to create unit.");
    } finally {
      setCreating(false);
    }
  }

  // QR Modal
  const [qrUnit, setQrUnit] = useState<(UnitDoc & { id: string }) | null>(null);
  const [qrUrl, setQrUrl] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  async function openQr(u: UnitDoc & { id: string }) {
    const origin = window.location.origin;
    const url = buildUnitUrl(origin, u.id, u.reportKey);
    setQrUnit(u);
    setQrUrl(url);
    const dataUrl = await QRCode.toDataURL(url, {
      margin: 1,
      scale: 8,
      errorCorrectionLevel: "M",
    });
    setQrDataUrl(dataUrl);
  }

  function closeQr() {
    setQrUnit(null);
    setQrUrl("");
    setQrDataUrl("");
  }

  async function rotateKey(u: UnitDoc & { id: string }) {
    const newKey = genKey();
    await updateDoc(doc(db, "units", u.id), { reportKey: newKey });
    await reloadUnits();
    // if modal open for this unit, refresh QR
    if (qrUnit && qrUnit.id === u.id) {
      openQr({ ...u, reportKey: newKey });
    }
  }

  async function toggleActive(u: UnitDoc & { id: string }) {
    await updateDoc(doc(db, "units", u.id), { active: !u.active });
    await reloadUnits();
  }

  async function saveAllowed(u: UnitDoc & { id: string }, newList: string[]) {
    await updateDoc(doc(db, "units", u.id), { allowedHospitals: newList });
    await reloadUnits();
  }

  async function removeUnit(u: UnitDoc & { id: string }) {
    if (!confirm(`Delete unit "${u.label}"? This cannot be undone.`)) return;
    await deleteDoc(doc(db, "units", u.id));
    await reloadUnits();
  }

  const hospMap = useMemo(
    () => new Map(hospitals.map((h) => [h.id, h])),
    [hospitals]
  );

  if (checkingAdmin) return null;

  if (!isAdmin) {
    return (
      <Card>
        <Card.Body>
          <Card.Title>Admin — Units</Card.Title>
          <Alert variant="danger" className="mb-0">
            Not authorized to view this page.
            {adminError && <div className="mt-2 small">{adminError}</div>}
          </Alert>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Stack gap={4}>
      <Card>
        <Card.Body>
          <Card.Title className="mb-3">Create Unit QR</Card.Title>
          {err && (
            <Alert variant="danger" className="mb-3">
              {err}
            </Alert>
          )}
          <Form onSubmit={createUnit}>
            <Row className="g-3">
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Label</Form.Label>
                  <Form.Control
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g., Medic 12, Triage Desk"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={5}>
                <Form.Group>
                  <Form.Label>Allowed Hospitals</Form.Label>
                  <div
                    className="border rounded p-2"
                    style={{ maxHeight: 220, overflow: "auto" }}
                  >
                    {hospitals.map((h) => (
                      <Form.Check
                        key={h.id}
                        type="checkbox"
                        id={`h-${h.id}`}
                        className="mb-1"
                        label={h.name}
                        checked={allowed.includes(h.id)}
                        onChange={() => toggleAllowed(h.id)}
                      />
                    ))}
                  </div>
                  <Form.Text className="text-muted">
                    Units can only report for the selected hospitals.
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Label>Status</Form.Label>
                  <Form.Check
                    type="switch"
                    id="unit-active"
                    label={active ? "Active" : "Inactive"}
                    checked={active}
                    onChange={(e) => setActive(e.currentTarget.checked)}
                  />
                </Form.Group>
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating…" : "Create Unit"}
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <Card.Title className="mb-3">Units</Card.Title>
          <Table responsive hover>
            <thead>
              <tr>
                <th>Label</th>
                <th>Allowed Hospitals</th>
                <th>Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id}>
                  <td>{u.label}</td>
                  <td style={{ maxWidth: 400 }}>
                    <div className="d-flex flex-wrap gap-1">
                      {(u.allowedHospitals || []).map((hid: string) => (
                        <Badge bg="secondary" key={hid}>
                          {hospMap.get(hid)?.name || hid}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-2">
                      <Form.Select
                        multiple
                        value={u.allowedHospitals || []}
                        onChange={(e) => {
                          const selected = Array.from(
                            e.currentTarget.selectedOptions
                          ).map((o) => o.value);
                          saveAllowed(u, selected);
                        }}
                      >
                        {hospitals.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name}
                          </option>
                        ))}
                      </Form.Select>
                      <Form.Text className="text-muted">
                        Hold Ctrl/Cmd to select multiple and release to
                        auto-save.
                      </Form.Text>
                    </div>
                  </td>
                  <td>
                    {u.active ? (
                      <Badge bg="success">Active</Badge>
                    ) : (
                      <Badge bg="secondary">Inactive</Badge>
                    )}
                  </td>
                  <td className="text-end">
                    <div className="d-flex justify-content-end gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={() => openQr(u)}
                      >
                        QR / Link
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-warning"
                        onClick={() => rotateKey(u)}
                      >
                        Rotate key
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={() => toggleActive(u)}
                      >
                        {u.active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => removeUnit(u)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {units.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-muted">
                    No units yet.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal show={!!qrUnit} onHide={closeQr} centered>
        <Modal.Header closeButton>
          <Modal.Title>Unit QR — {qrUnit?.label}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Stack gap={2} className="align-items-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR code"
                style={{ width: 256, height: 256 }}
              />
            ) : (
              <div className="text-muted">Generating QR…</div>
            )}
            <Form.Control readOnly value={qrUrl} />
            <div className="d-flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigator.clipboard.writeText(qrUrl)}
              >
                Copy link
              </Button>
              {qrDataUrl && (
                <a
                  className="btn btn-sm btn-primary"
                  href={qrDataUrl}
                  download={`unit-${qrUnit?.id}.png`}
                >
                  Download QR
                </a>
              )}
            </div>
            <Alert variant="light" className="border small mb-0">
              This QR encodes the link above. Anyone with this QR can report for
              the unit’s allowed hospitals while the unit is active and the key
              matches your Firestore doc.
            </Alert>
          </Stack>
        </Modal.Body>
      </Modal>
    </Stack>
  );
}
