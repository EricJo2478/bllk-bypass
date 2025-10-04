// src/pages/ReportPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Col, Form, Row, Stack } from "react-bootstrap";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { getUnitFromUrl } from "../utils/url";
import { dateKeyFromNowRegina } from "../utils/dateKey";
import {
  eachDayInclusive,
  buildUserDivertPayload,
  buildUnitDivertPayload,
} from "../utils/payload";
import type { DivertKind, Hospital, UnitDoc } from "../types";

type Mode = "blocked" | "user" | "unit";

export default function ReportPage() {
  // --- Auth & user verification ---
  const [userVerified, setUserVerified] = useState<boolean>(false);
  const [userChecked, setUserChecked] = useState<boolean>(false);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) {
      setUserVerified(false);
      setUserChecked(true);
      return;
    }
    getDoc(doc(db, "users", u.uid))
      .then((snap) => setUserVerified(Boolean(snap.data()?.verified)))
      .finally(() => setUserChecked(true));
  }, [auth.currentUser?.uid]);

  // --- Unit QR (from URL) ---
  const unitId = getUnitFromUrl();
  const [unit, setUnit] = useState<(UnitDoc & { id: string }) | null>(null);
  const [unitLoaded, setUnitLoaded] = useState<boolean>(false);

  useEffect(() => {
    if (!unitId) {
      setUnit(null);
      setUnitLoaded(true);
      return;
    }
    getDoc(doc(db, "units", unitId))
      .then((snap) => {
        const data = snap.data() as UnitDoc | undefined;
        if (data && data.active) {
          setUnit({ id: unitId, ...data });
        } else {
          setUnit(null);
        }
      })
      .finally(() => setUnitLoaded(true));
  }, [unitId]);

  // --- Hospitals list (for dropdown) ---
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  useEffect(() => {
    (async () => {
      const qs = await getDocs(query(collection(db, "hospitals")));
      const rows = qs.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as Hospital[];
      const activeFirst = rows.filter((r) => r.active !== false);
      setHospitals(activeFirst);
    })();
  }, []);

  // --- Determine mode ---
  const mode: Mode = useMemo(() => {
    if (unitId && unitLoaded) return unit ? "unit" : "blocked";
    if (userChecked) return userVerified ? "user" : "blocked";
    return "blocked";
  }, [unitId, unit, unitLoaded, userVerified, userChecked]);

  // --- Form state ---
  const allHospOptions = useMemo(() => hospitals, [hospitals]);
  const allowedHospOptions = useMemo(() => {
    if (mode !== "unit" || !unit) return allHospOptions;
    const allowSet = new Set(unit.allowedHospitals || []);
    return allHospOptions.filter((h) => allowSet.has(h.id));
  }, [mode, unit, allHospOptions]);

  const [hospitalId, setHospitalId] = useState<string>("");
  useEffect(() => {
    // Preselect first allowed on mount / mode change
    if (!hospitalId && allowedHospOptions.length > 0) {
      setHospitalId(allowedHospOptions[0].id);
    } else if (
      mode === "unit" &&
      unit &&
      hospitalId &&
      !unit.allowedHospitals.includes(hospitalId)
    ) {
      // If current selection becomes invalid due to mode change, fix it
      setHospitalId(allowedHospOptions[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, unit?.id, allowedHospOptions.length]);

  const [kind, setKind] = useState<DivertKind>("full");
  const [notes, setNotes] = useState("");

  // single
  const [startDate, setStartDate] = useState<string>(dateKeyFromNowRegina());
  const [startTime, setStartTime] = useState<string>("07:00");
  const [endDate, setEndDate] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");

  // recurring
  const [isRecurring, setIsRecurring] = useState(false);
  const [recStartDate, setRecStartDate] = useState<string>(
    dateKeyFromNowRegina()
  );
  const [recEndDate, setRecEndDate] = useState<string>(dateKeyFromNowRegina());
  const [recDailyStart, setRecDailyStart] = useState<string>("07:00");
  const [recDailyEnd, setRecDailyEnd] = useState<string>("19:00");

  // UX state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [ok, setOk] = useState<string>("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setOk("");

    try {
      if (!hospitalId) throw new Error("Please select a hospital.");

      // Guard: mode must be allowed
      if (mode === "blocked") {
        throw new Error(
          "You must be signed in and verified or use a valid unit QR to report."
        );
      }

      // Build payload(s)
      if (!isRecurring) {
        // SINGLE
        if (mode === "user") {
          const uid = auth.currentUser?.uid;
          if (!uid) throw new Error("Not signed in.");
          const payload = buildUserDivertPayload({
            hospitalId,
            kind,
            notes: notes.trim() || undefined,
            startDate,
            startTime,
            endDate: endDate || undefined,
            endTime: endTime || undefined,
            createdByUid: uid,
          });
          await addDoc(
            collection(db, "days", payload.dateKey, "diverts"),
            payload
          );
          setOk("Divert reported.");
        } else {
          // unit mode
          if (!unit) throw new Error("Invalid unit.");
          const payload = buildUnitDivertPayload({
            hospitalId,
            kind,
            notes: notes.trim() || undefined,
            startDate,
            startTime,
            endDate: endDate || undefined,
            endTime: endTime || undefined,
            unitId: unit.id,
            unitReportKey: unit.reportKey,
          });
          await addDoc(
            collection(db, "days", payload.dateKey, "diverts"),
            payload
          );
          setOk("Divert reported (via unit).");
        }
      } else {
        // RECURRING (expand 1 per day)
        const days = eachDayInclusive(recStartDate, recEndDate);
        const batch = writeBatch(db);

        if (mode === "user") {
          const uid = auth.currentUser?.uid;
          if (!uid) throw new Error("Not signed in.");
          for (const day of days) {
            const payload = buildUserDivertPayload({
              hospitalId,
              kind,
              notes: notes.trim() || undefined,
              startDate: day,
              startTime: recDailyStart,
              endDate: day,
              endTime: recDailyEnd,
              createdByUid: uid,
            });
            const ref = doc(collection(db, "days", payload.dateKey, "diverts"));
            batch.set(ref, payload);
          }
        } else {
          if (!unit) throw new Error("Invalid unit.");
          for (const day of days) {
            const payload = buildUnitDivertPayload({
              hospitalId,
              kind,
              notes: notes.trim() || undefined,
              startDate: day,
              startTime: recDailyStart,
              endDate: day,
              endTime: recDailyEnd,
              unitId: unit.id,
              unitReportKey: unit.reportKey,
            });
            const ref = doc(collection(db, "days", payload.dateKey, "diverts"));
            batch.set(ref, payload);
          }
        }

        await batch.commit();
        setOk(`Created ${days.length} divert${days.length > 1 ? "s" : ""}.`);
      }

      // Reset minimal fields after success (keep hospital/kind)
      setNotes("");
      if (!isRecurring) {
        setEndDate("");
        setEndTime("");
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to submit divert.");
    } finally {
      setSubmitting(false);
    }
  }

  // --- Render guards ---
  if (mode === "blocked") {
    return (
      <Card>
        <Card.Body>
          <Card.Title>Report a divert</Card.Title>
          <Alert variant="warning" className="mt-2 mb-0">
            To report a divert, please{" "}
            <strong>sign in with a verified account</strong> or
            <strong> open this page using a unit QR</strong>.
          </Alert>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Body>
        <Stack gap={3}>
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
            <Card.Title className="mb-0">Report a divert</Card.Title>
            <div className="text-muted small">
              {mode === "user"
                ? "Verified account"
                : unit
                ? `Verified via Unit QR • ${unit.label}`
                : ""}
            </div>
          </div>

          {error && (
            <Alert variant="danger" className="mb-0">
              {error}
            </Alert>
          )}
          {ok && (
            <Alert variant="success" className="mb-0">
              {ok}
            </Alert>
          )}

          <Form onSubmit={handleSubmit}>
            <Stack gap={3}>
              <Row>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Hospital</Form.Label>
                    <Form.Select
                      value={hospitalId}
                      onChange={(e) => setHospitalId(e.target.value)}
                      required
                      disabled={
                        mode === "unit" && allowedHospOptions.length <= 1
                      }
                    >
                      {allowedHospOptions.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </Form.Select>
                    {mode === "unit" && unit && (
                      <Form.Text>
                        Limited to unit’s allowed hospitals.
                      </Form.Text>
                    )}
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Divert type</Form.Label>
                    <Form.Select
                      value={kind}
                      onChange={(e) => setKind(e.target.value as DivertKind)}
                    >
                      <option value="full">Full divert</option>
                      <option value="labs-xray">Labs/X-Ray unavailable</option>
                      <option value="ct">CT down</option>
                      <option value="other">Other</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Single vs Recurring</Form.Label>
                    <Form.Check
                      type="switch"
                      id="recurring-switch"
                      label="Recurring daily window"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.currentTarget.checked)}
                    />
                    <Form.Text>
                      Enable to create one divert per day across a date range.
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              {!isRecurring ? (
                <>
                  <Row>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Start date</Form.Label>
                        <Form.Control
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Start time</Form.Label>
                        <Form.Control
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          required
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Row>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>End date (optional)</Form.Label>
                        <Form.Control
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>End time (optional)</Form.Label>
                        <Form.Control
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </>
              ) : (
                <>
                  <Row>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>From date</Form.Label>
                        <Form.Control
                          type="date"
                          value={recStartDate}
                          onChange={(e) => setRecStartDate(e.target.value)}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>To date</Form.Label>
                        <Form.Control
                          type="date"
                          value={recEndDate}
                          onChange={(e) => setRecEndDate(e.target.value)}
                          required
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Row>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Daily start time</Form.Label>
                        <Form.Control
                          type="time"
                          value={recDailyStart}
                          onChange={(e) => setRecDailyStart(e.target.value)}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Daily end time</Form.Label>
                        <Form.Control
                          type="time"
                          value={recDailyEnd}
                          onChange={(e) => setRecDailyEnd(e.target.value)}
                          required
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </>
              )}

              <Form.Group>
                <Form.Label className="mb-1">Notes (optional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  placeholder="Anything useful for crews (e.g., department contact, reason)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Form.Group>

              <div className="d-flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Submitting..." : "Report divert"}
                </Button>
              </div>
            </Stack>
          </Form>
        </Stack>
      </Card.Body>
    </Card>
  );
}
