// src/utils/payload.ts
import { serverTimestamp } from "firebase/firestore";

/** Type guards / helpers */
function isPlainObject(value: any): value is Record<string, any> {
  if (value === null) return false;
  if (typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
function isFirestoreTimestampLike(v: any): boolean {
  return !!(v && typeof v.toMillis === "function");
}
function isFirestoreFieldValue(v: any): boolean {
  return !!(v && typeof v === "object" && typeof v._methodName === "string");
}

/**
 * Recursively remove `undefined` values.
 * - Keeps Date, Firestore Timestamp, and FieldValue objects intact.
 * - Cleans arrays (removes `undefined` elements and cleans nested values).
 * - Only recurses into *plain* objects (so we don't destroy special types).
 */
export function cleanUndefined<T>(value: T): T {
  if (
    value instanceof Date ||
    isFirestoreTimestampLike(value) ||
    isFirestoreFieldValue(value)
  ) {
    return value;
  }

  if (Array.isArray(value)) {
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

  return value;
}

/** Expand a recurring range (inclusive) into an array of day strings "YYYY-MM-DD". */
export function eachDayInclusive(startDate: string, endDate: string): string[] {
  const [ys, ms, ds] = startDate.split("-").map(Number);
  const [ye, me, de] = endDate.split("-").map(Number);
  const start = new Date(ys, ms - 1, ds);
  const end = new Date(ye, me - 1, de);
  const days: string[] = [];
  for (let d = start; d <= end; d = new Date(d.getTime() + 86_400_000)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${day}`);
  }
  return days;
}

/** Build a Date object in *local* time — no timezone conversions. */
function dateFromLocal(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
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

  // No timezone adjustment — use direct local wall time
  const startedAt = dateFromLocal(startDate, startTime);
  const clearedAt = endDate && endTime ? dateFromLocal(endDate, endTime) : null;
  const dateKey = startDate;

  const raw = {
    hospitalId,
    kind,
    notes,
    status: "active" as const,
    startedAt,
    clearedAt,
    createdAt: serverTimestamp(),
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

  const startedAt = dateFromLocal(startDate, startTime);
  const clearedAt = endDate && endTime ? dateFromLocal(endDate, endTime) : null;
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
