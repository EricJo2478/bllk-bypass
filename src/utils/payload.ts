// src/utils/payload.ts

import { serverTimestamp } from "firebase/firestore";
import { dateFromRegina } from "./datetime";

/** Recursively removes any `undefined` values so Firestore won't reject writes. */
export function cleanUndefined<T extends Record<string, any>>(obj: T): T {
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const nested = cleanUndefined(value);
      if (Object.keys(nested).length > 0) cleaned[key] = nested;
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/** Expand a recurring range (inclusive) into an array of day strings "YYYY-MM-DD". */
export function eachDayInclusive(startDate: string, endDate: string): string[] {
  const [ys, ms, ds] = startDate.split("-").map(Number);
  const [ye, me, de] = endDate.split("-").map(Number);
  const start = new Date(Date.UTC(ys, ms - 1, ds));
  const end = new Date(Date.UTC(ye, me - 1, de));
  const days: string[] = [];
  for (let d = start; d <= end; d = new Date(d.getTime() + 86400000)) {
    const y = d.getUTCFullYear();
    const m = `${d.getUTCMonth() + 1}`.padStart(2, "0");
    const day = `${d.getUTCDate()}`.padStart(2, "0");
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

  // dateKey = day bucket for the START date in Regina
  const dateKey = startDate;

  const payload = {
    hospitalId,
    kind,
    notes: notes || undefined,
    status: "active" as const,
    startedAt,
    clearedAt, // may be null; rules allow null
    createdAt: serverTimestamp(),
    createdByUid,
    source: { type: "user" as const },
    dateKey,
  };

  return payload;
}

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

  const payload = {
    hospitalId,
    kind,
    notes: notes || undefined,
    status: "active" as const,
    startedAt,
    clearedAt,
    createdAt: serverTimestamp(),
    source: { type: "unit" as const, unitId },
    unitReportKey, // validated by rules
    dateKey,
  };

  return payload;
}
