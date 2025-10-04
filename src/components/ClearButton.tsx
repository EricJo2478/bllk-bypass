// src/components/ClearButton.tsx
import { Button } from "react-bootstrap";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../services/firebase";
import { useDocument } from "react-firebase-hooks/firestore";
import { doc as docRefFS } from "firebase/firestore";

// tiny hook to know if the user is verified
function useIsVerified() {
  const u = auth.currentUser;
  const [snap] = useDocument(u ? docRefFS(db, "users", u.uid) : null);
  return Boolean(snap?.data()?.verified);
}

export default function ClearButton({
  dateKey,
  divertId,
  createdByUid,
}: {
  dateKey: string;
  divertId: string;
  createdByUid?: string;
}) {
  const user = auth.currentUser;
  const isVerified = useIsVerified();
  const canClear = !!user && (isVerified || user.uid === createdByUid);

  async function clearNow() {
    if (!canClear)
      return alert(
        "Only verified users or the original reporter can clear a divert."
      );
    if (!confirm("End this divert now?")) return;

    await updateDoc(doc(db, "days", dateKey, "diverts", divertId), {
      status: "cleared",
      clearedAt: serverTimestamp(),
    });
  }

  return (
    <Button
      variant="outline-secondary"
      onClick={clearNow}
      disabled={!canClear}
      title={
        canClear
          ? "Mark divert as cleared now"
          : "Need verification or be the original reporter"
      }
    >
      End now
    </Button>
  );
}
