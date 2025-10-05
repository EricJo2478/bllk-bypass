// src/utils/payload.ts
import { serverTimestamp } from "firebase/firestore";
import { dateFromRegina } from "./datetime";

/** Type guards / helpers */
function isPlainObject(value: any): value is Record<string, any> {
  if (value === null) return false;
  if (typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
function isFirestoreTimestampLike(v: any): boolean {
  return !!(v && typeof v.toMillis === "function"); // Firestore Timestamp has toMillis()
}
function isFirestoreFieldValue(v: any): boolean {
  // serverTimestamp() and other FieldValue sentinels aren't plain objects and must pass through
  return !!(v && typeof v === "object" && typeof v._methodName === "string");
}

/**
 * Recursively remove `undefined` values.
 * - Keeps Date, Firestore Timestamp, and FieldValue objects intact.
 * - Cleans arrays (removes `undefined` elements and cleans nested values).
 * - Only recurses into *plain* objects (so we don't destroy special types).
 */
export function cleanUndefined<T>(value: T): T {
  // Leave special types as-is
  if (
    value instanceof Date ||
    isFirestoreTimestampLike(value) ||
    isFirestoreFieldValue(value)
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    // Clean each element and drop `undefined`
    const cleaned = (value as any[])
      .map((v) => cleanUndefined(v))
      .filter((v) => v !== undefined);
    return cleaned as unknown as T;
  }

  if (isPlainObject(value)) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as any)) {
      if (v === undefined) continue;
      const cleaned = cleanUndefined(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out as T;
  }

  // primitives and other objects pass through
  return value;
}

/** Expand a recurring range (inclusive) into an array of day strings "YYYY-MM-DD". */
export function eachDayInclusive(startDate: string, endDate: string): string[] {
  const [ys, ms, ds] = startDate.split("-").map(Number);
  const [ye, me, de] = endDate.split("-").map(Number);
  const start = new Date(Date.UTC(ys, ms - 1, ds));
  const end = new Date(Date.UTC(ye, me - 1, de));
  const days: string[] = [];
  for (let d = start; d <= end; d = new Date(d.getTime() + 86_400_000)) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    days.push(`${y}-${m}-${day}`);
  }
  return days;
}

type Base = {
  hospitalId: string;
  kind: "full" | "labs-xray" | "ct" | "other";
  notes?: string;
  startDate: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm"
  endDate?: string; // "YYYY-MM-DD"
  endTime?: string; // "HH:mm"
};

/** Builds payload for user-submitted divert */
export function buildUserDivertPayload(input: Base & { createdByUid: string }) {
  const {
    hospitalId,
    kind,
    notes,
    startDate,
    startTime,
    endDate,
    endTime,
    createdByUid,
  } = input;

  const startedAt = dateFromRegina(startDate, startTime);
  const clearedAt =
    endDate && endTime ? dateFromRegina(endDate, endTime) : null;

  const dateKey = startDate;

  const raw = {
    hospitalId,
    kind,
    notes, // may be undefined; cleanUndefined will strip it
    status: "active" as const,
    startedAt, // Date (kept)
    clearedAt, // Date|null (kept)
    createdAt: serverTimestamp(), // FieldValue (kept)
    createdByUid,
    source: { type: "user" as const },
    dateKey,
  };

  return cleanUndefined(raw);
}

/** Builds payload for unit QR-submitted divert */
export function buildUnitDivertPayload(
  input: Base & { unitId: string; unitReportKey: string }
) {
  const {
    hospitalId,
    kind,
    notes,
    startDate,
    startTime,
    endDate,
    endTime,
    unitId,
    unitReportKey,
  } = input;

  const startedAt = dateFromRegina(startDate, startTime);
  const clearedAt =
    endDate && endTime ? dateFromRegina(endDate, endTime) : null;

  const dateKey = startDate;

  const raw = {
    hospitalId,
    kind,
    notes,
    status: "active" as const,
    startedAt,
    clearedAt,
    createdAt: serverTimestamp(),
    source: { type: "unit" as const, unitId },
    unitReportKey,
    dateKey,
  };

  return cleanUndefined(raw);
}
