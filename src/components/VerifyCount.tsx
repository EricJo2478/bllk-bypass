import { collection } from "firebase/firestore";
import { useCollection } from "react-firebase-hooks/firestore";
import { db } from "../services/firebase";
import { Badge } from "react-bootstrap";

export default function VerifyCount({
  dateKey,
  divertId,
}: {
  dateKey: string;
  divertId: string;
}) {
  const [snap] = useCollection(
    collection(db, "days", dateKey, "diverts", divertId, "votes")
  );
  const count = snap?.size ?? 0;
  return (
    <Badge bg="light" text="dark">
      {count} verified
    </Badge>
  );
}
