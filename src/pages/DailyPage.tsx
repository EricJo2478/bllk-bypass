import { useMemo } from "react";
import { useCollection, useDocument } from "react-firebase-hooks/firestore";
import { collection, query, orderBy, doc } from "firebase/firestore";
import { dateKeyFromLocal } from "../utils/dateKey";
import { Button, Badge, Card, Stack } from "react-bootstrap";
import { auth, db } from "../services/firebase";
import { fmtDateTime } from "../utils/datetime";
import VerifyCount from "../components/VerifyCount";
import ClearButton from "../components/ClearButton";

type Hospital = { id: string; name: string; shortCode: string };

function useHospitals(): Hospital[] {
  const [snap] = useCollection(collection(db, "hospitals"));
  return snap?.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) ?? [];
}

// src/pages/DailyPage.tsx
// ...imports unchanged...

export default function DailyPage({
  dateKey = dateKeyFromLocal(),
}: {
  dateKey?: string;
}) {
  const hospitals = useHospitals();
  const [divertsSnap] = useCollection(
    query(
      collection(db, "days", dateKey, "diverts"),
      orderBy("startedAt", "desc")
    )
  );
  const diverts = (divertsSnap?.docs ?? []).map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));

  const byHospital = useMemo(() => {
    const m = new Map<string, any[]>();
    diverts.forEach((d: any) => {
      const arr = m.get(d.hospitalId) ?? [];
      arr.push(d);
      m.set(d.hospitalId, arr);
    });
    return m;
  }, [diverts]);

  if (hospitals.length === 0) {
    return <div>No hospitals seeded yet.</div>;
  }

  return (
    <Stack gap={4}>
      {hospitals.map((hosp) => {
        const reports = byHospital.get(hosp.id) ?? [];
        const current =
          reports.find((r: any) => r.status === "active") ?? reports[0];

        return (
          <Card key={hosp.id}>
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
                <div>
                  <Card.Title className="mb-1">
                    {hosp.name} <Badge bg="secondary">{hosp.shortCode}</Badge>
                  </Card.Title>

                  {current ? (
                    <>
                      <div className="mb-2">
                        <Badge
                          bg={current.kind === "full" ? "danger" : "warning"}
                          text={current.kind === "full" ? "light" : "dark"}
                          className="me-2"
                        >
                          {String(current.kind).toUpperCase()}
                        </Badge>
                        <Badge bg="info" className="me-2">
                          {current.status}
                        </Badge>
                        <VerifyCount dateKey={dateKey} divertId={current.id} />
                      </div>
                      <div className="text-muted">
                        {current.startedAt && (
                          <span>
                            <strong>Start:</strong>{" "}
                            {fmtDateTime(current.startedAt)}
                          </span>
                        )}
                        {current.clearedAt && (
                          <span className="ms-3">
                            <strong>End:</strong>{" "}
                            {fmtDateTime(current.clearedAt)}
                          </span>
                        )}
                      </div>
                      {current.scope && (
                        <div className="mt-2">
                          <strong>Scope:</strong> {current.scope}
                        </div>
                      )}
                      {current.notes && (
                        <div>
                          <strong>Notes:</strong> {current.notes}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-muted">No diverts reported today.</div>
                  )}
                </div>
                {current && (
                  <div className="d-flex gap-2">
                    <VerifyButton dateKey={dateKey} divertId={current.id} />
                    <ClearButton
                      dateKey={dateKey}
                      divertId={current.id}
                      createdByUid={current.createdByUid}
                    />
                  </div>
                )}
              </div>

              <div className="mt-3">
                <small className="text-muted">
                  Today’s reports: {reports.length}
                </small>
              </div>
            </Card.Body>
          </Card>
        );
      })}
    </Stack>
  );
}

function VerifyButton({
  dateKey,
  divertId,
}: {
  dateKey: string;
  divertId: string;
}) {
  const user = auth.currentUser;
  const voteRef = user
    ? doc(db, "days", dateKey, "diverts", divertId, "votes", user.uid)
    : null;
  const [voteSnap] = useDocument(voteRef);
  const hasVoted = !!voteSnap?.exists();

  async function toggle() {
    if (!user) return alert("Sign in to verify");
    if (hasVoted)
      await import("firebase/firestore").then(({ deleteDoc }) =>
        deleteDoc(voteRef!)
      );
    else
      await import("firebase/firestore").then(({ setDoc }) =>
        setDoc(voteRef!, { createdAt: new Date() })
      );
  }

  return (
    <Button
      variant={hasVoted ? "success" : "outline-success"}
      onClick={toggle}
      title="Verified users can confirm"
    >
      {hasVoted ? "👍 Verified" : "👍 Verify"}
    </Button>
  );
}
