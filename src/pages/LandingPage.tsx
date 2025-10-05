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
  doc,
  getDocs,
  onSnapshot,
  QuerySnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "../services/firebase";
import { fmtRegina } from "../utils/datetime";
import { dateKeyFromNowRegina, dateKeyFromDate } from "../utils/dateKey";
import type { Hospital } from "../types";

/** Default window: now → next 24h */
function defaultWindow() {
  const start = new Date();
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Input helpers for date/time controls */
function isoDate(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}
function isoTime(d: Date) {
  return d.toTimeString().slice(0, 5);
}

/** Build Regina day keys inclusively for a window. */
function dayKeysInWindowRegina(
  start: Date,
  end: Date,
  backfillDays = 3
): string[] {
  const keys = new Set<string>();
  const oneDay = 24 * 60 * 60 * 1000;

  const loopStart = new Date(start.getTime());
  loopStart.setHours(0, 0, 0, 0);
  loopStart.setTime(loopStart.getTime() - backfillDays * oneDay);

  const loopEnd = new Date(end.getTime());
  loopEnd.setHours(0, 0, 0, 0);

  for (let d = loopStart; d <= loopEnd; d = new Date(d.getTime() + oneDay)) {
    keys.add(dateKeyFromDate(d)); // your Regina-aware util
  }
  return Array.from(keys);
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

  // --- per-day listeners (NO collectionGroup) ---
  const [dayDocs, setDayDocs] = useState<Record<string, any[]>>({});

  useEffect(() => {
    const keys = dayKeysInWindowRegina(start, end, 7);
    const unsubs: Array<() => void> = [];

    setDayDocs({});
    keys.forEach((dk) => {
      const q = collection(db, "days", dk, "diverts");
      const unsub = onSnapshot(q, (snap: QuerySnapshot) => {
        setDayDocs((prev) => ({
          ...prev,
          [dk]: snap.docs.map((d) => ({
            id: d.id,
            ref: d.ref,
            ...(d.data() as any),
          })),
        }));
      });
      unsubs.push(unsub);
    });

    return () => unsubs.forEach((u) => u());
  }, [start.getTime(), end.getTime()]);

  // Merge + filter + sort (client-side)
  const active = useMemo(() => {
    const merged = Object.values(dayDocs).flat();

    const toMillis = (v: any): number | null => {
      if (!v && v !== 0) return null; // undefined/null
      if (typeof v?.toMillis === "function") return v.toMillis(); // Firestore Timestamp
      if (v instanceof Date) return v.getTime();
      const t = new Date(v as any).getTime();
      return Number.isFinite(t) ? t : null;
    };

    const sWin = start.getTime();
    const eWin = end.getTime();

    const list = merged
      .filter((x: any) => x?.status === "active") // only active
      .filter((x: any) => {
        const s = toMillis(x.startedAt);
        const c = toMillis(x.clearedAt); // null means open-ended
        if (s == null) return false; // invalid doc
        const startsBeforeWindowEnd = s <= eWin;
        const isOngoing = c == null; // ✅ open-ended counts as overlapping
        const clearsAfterWindowStart = c != null && c > sWin;
        return startsBeforeWindowEnd && (isOngoing || clearsAfterWindowStart);
      });

    const filtered =
      hospitalFilter === "all"
        ? list
        : list.filter((x: any) => x.hospitalId === hospitalFilter);

    filtered.sort((a: any, b: any) => {
      const ta = toMillis(a.startedAt) ?? 0;
      const tb = toMillis(b.startedAt) ?? 0;
      if (ta !== tb) return ta - tb;
      return String(a.hospitalId).localeCompare(String(b.hospitalId));
    });

    return filtered;
  }, [dayDocs, hospitalFilter, start.getTime(), end.getTime()]);

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
          {active.map((d: any) => {
            const kindBadge =
              d.kind === "full" ? (
                <Badge bg="danger">FULL DIVERT</Badge>
              ) : d.kind === "labs-xray-divert" ? (
                <Badge bg="warning" text="dark">
                  LABS/X-RAY DIVERT
                </Badge>
              ) : d.kind === "ct-divert" ? (
                <Badge bg="info" text="dark">
                  CT DIVERT
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
