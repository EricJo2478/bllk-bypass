// src/utils/firestore-queries.ts

import { collection, collectionGroup, query, where } from "firebase/firestore";
import { db } from "../services/firebase";

/** Today bucket (for per-day page) */
export function qDivertsForDateKey(dateKey: string) {
  return collection(db, "days", dateKey, "diverts");
}

/** Landing: active overlapping a window (run two queries and merge client-side) */
export function qActiveNoClearWithin(end: Date) {
  return query(
    collectionGroup(db, "diverts"),
    where("status", "==", "active"),
    where("startedAt", "<=", end),
    where("clearedAt", "==", null)
  );
}

export function qActiveClearsAfter(start: Date, end: Date) {
  return query(
    collectionGroup(db, "diverts"),
    where("status", "==", "active"),
    where("startedAt", "<=", end),
    where("clearedAt", ">", start)
  );
}
