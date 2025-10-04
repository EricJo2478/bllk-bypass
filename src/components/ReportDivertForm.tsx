import { useEffect, useState } from "react";
import { Form, Button, Stack, Row, Col, Alert } from "react-bootstrap";
import {
  addDoc,
  collection,
  serverTimestamp,
  writeBatch,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { dateKeyFromLocal } from "../utils/dateKey";
import type { DivertDoc, DivertKind, ReporterTier } from "../types";
import { dateFromLocal, eachDayInclusive } from "../utils/datetime";
import { auth, db } from "../services/firebase";

type Hospital = { id: string; name: string; shortCode: string };
type Props = { hospitals: Hospital[]; onSubmitted?: () => void };

export default function ReportDivertForm({ hospitals, onSubmitted }: Props) {
  if (hospitals.length === 0) return null;

  const [hospitalId, setHospitalId] = useState(hospitals[0].id);
  const [kind, setKind] = useState<DivertKind>("full");
  const [notes, setNotes] = useState("");

  // single instance
  const [startDate, setStartDate] = useState<string>(dateKeyFromLocal());
  const [startTime, setStartTime] = useState<string>("07:00");
  const [endDate, setEndDate] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");

  // recurring
  const [isRecurring, setIsRecurring] = useState(false);
  const [recStartDate, setRecStartDate] = useState<string>(dateKeyFromLocal());
  const [recEndDate, setRecEndDate] = useState<string>(dateKeyFromLocal());
  const [recDailyStart, setRecDailyStart] = useState<string>("07:00");
  const [recDailyEnd, setRecDailyEnd] = useState<string>("19:00");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  // --- NEW: check if current user is verified ---
  const [isVerified, setIsVerified] = useState(false);
  useEffect(() => {
    const u = auth.currentUser;
    if (!u) {
      setIsVerified(false);
      return;
    }
    getDoc(doc(db, "users", u.uid))
      .then((snap) => setIsVerified(Boolean(snap.data()?.verified)))
      .catch(() => setIsVerified(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.currentUser?.uid]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const user = auth.currentUser;
      const reporterTier: ReporterTier = user
        ? isVerified
          ? "verified"
          : "user"
        : "anonymous";

      if (isRecurring) {
        // Expand into one divert per day, with the daily time window.
        const days = eachDayInclusive(recStartDate, recEndDate);
        const batch = writeBatch(db);

        for (const day of days) {
          const startedAt = dateFromLocal(day, recDailyStart);
          const clearedAt = recDailyEnd
            ? dateFromLocal(day, recDailyEnd)
            : undefined;

          const payload: Omit<DivertDoc, "createdAt"> & { createdAt: any } = {
            hospitalId,
            kind,
            notes: notes || undefined,
            status: "active",
            startedAt,
            clearedAt,
            createdAt: serverTimestamp(),
            createdByUid: user?.uid ?? "",
            reporterTier,
            dateKey: day,
            verifyCount: 0,
            reportsCount: 1,
          };

          const divertRef = doc(collection(db, "days", day, "diverts"));
          batch.set(divertRef, payload);

          // --- NEW: auto-verify if reporter is verified ---
          if (user && isVerified) {
            batch.set(doc(divertRef, "votes", user.uid), {
              createdAt: serverTimestamp(),
            });
          }
        }

        await batch.commit();
      } else {
        // Single entry
        const sDate = startDate || dateKeyFromLocal();
        const startedAt = dateFromLocal(sDate, startTime || "00:00");
        const clearedAt =
          endDate && endTime ? dateFromLocal(endDate, endTime) : undefined;

        const payload: Omit<DivertDoc, "createdAt"> & { createdAt: any } = {
          hospitalId,
          kind,
          notes: notes || undefined,
          status: "active",
          startedAt,
          clearedAt,
          createdAt: serverTimestamp(),
          createdByUid: user?.uid ?? "",
          reporterTier,
          dateKey: sDate,
          verifyCount: 0,
          reportsCount: 1,
        };

        const ref = await addDoc(
          collection(db, "days", sDate, "diverts"),
          payload
        );

        // --- NEW: auto-verify if reporter is verified ---
        if (user && isVerified) {
          await setDoc(doc(ref, "votes", user.uid), {
            createdAt: serverTimestamp(),
          });
        }
      }

      onSubmitted?.();
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to submit divert");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form onSubmit={onSubmit}>
      <Stack gap={3}>
        {error && <Alert variant="danger">{error}</Alert>}

        <Form.Group>
          <Form.Label>Hospital</Form.Label>
          <Form.Select
            value={hospitalId}
            onChange={(e) => setHospitalId(e.target.value)}
            required
          >
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        <Form.Group>
          <Form.Label>Divert type</Form.Label>
          <Form.Select
            value={kind}
            onChange={(e) => setKind(e.target.value as DivertKind)}
          >
            <option value="full">Full divert</option>
            <option value="partial">Partial divert</option>
            <option value="ct-divert">CT down</option>
            <option value="labs-xray-divert">Labs/X-Ray unavailable</option>
            <option value="other">Other</option>
          </Form.Select>
        </Form.Group>

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
                Enable to create one divert per day across a date range (e.g.,
                1st–7th, 07:00–19:00 daily).
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
          <Form.Control
            className="mt-2"
            as="textarea"
            rows={2}
            placeholder="Optional notes"
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
  );
}
