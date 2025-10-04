// src/pages/LandingPage.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Card,
  Stack,
  Row,
  Col,
  Form,
  Badge,
  Button,
  Alert,
} from "react-bootstrap";
import {
  collection,
  collectionGroup,
  query,
  where,
  updateDoc,
  doc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { useCollection } from "react-firebase-hooks/firestore";
import { db, auth } from "../services/firebase";
import { fmtRegina } from "../utils/datetime";
import { dateKeyFromNowRegina } from "../utils/dateKey";
import type { Hospital } from "../types";

function defaultWindow() {
  const start = new Date();
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function isoDate(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}
function isoTime(d: Date) {
  return d.toTimeString().slice(0, 5);
}

export default function LandingPage() {
  // --- hospitals ---
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "hospitals"));
      setHospitals(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((h: any) => h.active !== false)
          .sort((a: Hospital, b: Hospital) => a.name.localeCompare(b.name))
      );
    })();
  }, []);

  // --- filters ---
  const { start: defStart, end: defEnd } = defaultWindow();
  const [startDate, setStartDate] = useState<string>(isoDate(defStart));
  const [startTime, setStartTime] = useState<string>(isoTime(defStart));
  const [endDate, setEndDate] = useState<string>(isoDate(defEnd));
  const [endTime, setEndTime] = useState<string>(isoTime(defEnd));
  const [hospitalFilter, setHospitalFilter] = useState<string>("all");

  const start = useMemo(
    () => new Date(`${startDate}T${startTime || "00:00"}:00Z`),
    [startDate, startTime]
  );
  const end = useMemo(
    () => new Date(`${endDate}T${endTime || "23:59"}:00Z`),
    [endDate, endTime]
  );

  // --- Firestore queries: active diverts overlapping window ---
  const q1 = useMemo(
    () =>
      query(
        collectionGroup(db, "diverts"),
        where("status", "==", "active"),
        where("startedAt", "<=", end),
        where("clearedAt", "==", null)
      ),
    [end.getTime()]
  );
  const q2 = useMemo(
    () =>
      query(
        collectionGroup(db, "diverts"),
        where("status", "==", "active"),
        where("startedAt", "<=", end),
        where("clearedAt", ">", start)
      ),
    [start.getTime(), end.getTime()]
  );
  const [snap1] = useCollection(q1);
  const [snap2] = useCollection(q2);

  const active = useMemo(() => {
    const map = new Map<string, any>();
    const push = (d: any) =>
      map.set(d.ref.path, { id: d.id, ref: d.ref, ...(d.data() as any) });
    snap1?.docs.forEach(push);
    snap2?.docs.forEach(push);
    let list = Array.from(map.values());
    if (hospitalFilter !== "all") {
      list = list.filter((x) => x.hospitalId === hospitalFilter);
    }
    list.sort((a, b) => {
      const ta = a.startedAt?.toMillis?.() ?? new Date(a.startedAt).getTime();
      const tb = b.startedAt?.toMillis?.() ?? new Date(b.startedAt).getTime();
      if (ta !== tb) return ta - tb;
      return String(a.hospitalId).localeCompare(String(b.hospitalId));
    });
    return list;
  }, [snap1, snap2, hospitalFilter]);

  async function endNow(refPath: string) {
    try {
      await updateDoc(doc(db, refPath), {
        status: "cleared",
        clearedAt: serverTimestamp(),
      });
    } catch (e: any) {
      alert(e?.message ?? "Failed to clear divert.");
    }
  }

  const hospitalName = (id: string) =>
    hospitals.find((h) => h.id === id)?.name || id;

  return (
    <Stack gap={4}>
      <Card>
        <Card.Body>
          <Card.Title className="mb-3">Active diverts</Card.Title>
          <Form>
            <Row className="g-3">
              <Col md={6} lg={5}>
                <Form.Label className="mb-1">Time window (Regina)</Form.Label>
                <div className="d-flex flex-wrap gap-2">
                  <Form.Control
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ maxWidth: 160 }}
                  />
                  <Form.Control
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    style={{ maxWidth: 120 }}
                  />
                  <span className="align-self-center">to</span>
                  <Form.Control
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{ maxWidth: 160 }}
                  />
                  <Form.Control
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    style={{ maxWidth: 120 }}
                  />
                </div>
                <Form.Text>
                  Default shows now → next 24 hours (Regina). Today is{" "}
                  {dateKeyFromNowRegina()}.
                </Form.Text>
              </Col>
              <Col md={6} lg={7}>
                <Form.Label className="mb-1">Hospital</Form.Label>
                <Form.Select
                  value={hospitalFilter}
                  onChange={(e) => setHospitalFilter(e.target.value)}
                >
                  <option value="all">All Hospitals</option>
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </Form.Select>
                <Form.Text>Select one hospital or view all.</Form.Text>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      {active.length === 0 ? (
        <Alert variant="light" className="border">
          No active diverts in this window.
        </Alert>
      ) : (
        <Stack gap={3}>
          {active.map((d) => {
            const kindBadge =
              d.kind === "full" ? (
                <Badge bg="danger">FULL</Badge>
              ) : d.kind === "labs-xray" ? (
                <Badge bg="warning" text="dark">
                  LABS/X-RAY
                </Badge>
              ) : d.kind === "ct" ? (
                <Badge bg="info" text="dark">
                  CT
                </Badge>
              ) : (
                <Badge bg="secondary">OTHER</Badge>
              );

            return (
              <Card key={d.ref.path}>
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
                    <div>
                      <Card.Title className="mb-1">
                        {hospitalName(d.hospitalId)}{" "}
                        <Badge bg="secondary" className="ms-1">
                          {d.hospitalId}
                        </Badge>
                      </Card.Title>
                      <div className="mb-2 d-flex align-items-center gap-2">
                        {kindBadge}
                        <Badge bg="success">ACTIVE</Badge>
                      </div>
                      <div className="text-muted">
                        <strong>Start:</strong> {fmtRegina(d.startedAt)}
                        {d.clearedAt && (
                          <>
                            {" "}
                            • <strong>End:</strong> {fmtRegina(d.clearedAt)}
                          </>
                        )}
                      </div>
                      {d.notes && <div className="mt-2">{d.notes}</div>}
                    </div>
                    {auth.currentUser && (
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => endNow(d.ref.path)}
                      >
                        End now
                      </Button>
                    )}
                  </div>
                </Card.Body>
              </Card>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
