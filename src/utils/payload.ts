// src/utils/payload.ts

import { serverTimestamp } from "firebase/firestore";
import { dateKeyFromDate } from "./dateKey";
import { dateFromRegina } from "./datetime";
import type { DivertKind } from "../types";

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

/** Build a single divert payload for a verified user. */
export function buildUserDivertPayload(params: {
  hospitalId: string;
  kind: DivertKind;
  notes?: string;
  startDate: string; // "YYYY-MM-DD" Regina
  startTime: string; // "HH:mm" Regina
  endDate?: string;
  endTime?: string;
  createdByUid: string;
  seriesId?: string;
}) {
  const startedAt = dateFromRegina(params.startDate, params.startTime);
  const clearedAt =
    params.endDate && params.endTime
      ? dateFromRegina(params.endDate, params.endTime)
      : undefined;

  const rawPayload = {
    hospitalId: params.hospitalId,
    kind: params.kind,
    notes: params.notes || undefined,
    status: "active",
    startedAt,
    clearedAt,
    createdAt: serverTimestamp(),
    dateKey: dateKeyFromDate(startedAt),
    source: { type: "user" },
    createdByUid: params.createdByUid,
    seriesId: params.seriesId,
  };

  return cleanUndefined(rawPayload);
}

/** Build a single divert payload for a unit QR submission. */
export function buildUnitDivertPayload(params: {
  hospitalId: string;
  kind: DivertKind;
  notes?: string;
  startDate: string;
  startTime: string;
  endDate?: string;
  endTime?: string;
  unitId: string;
  unitReportKey: string;
  seriesId?: string;
}) {
  const startedAt = dateFromRegina(params.startDate, params.startTime);
  const clearedAt =
    params.endDate && params.endTime
      ? dateFromRegina(params.endDate, params.endTime)
      : undefined;

  const rawPayload = {
    hospitalId: params.hospitalId,
    kind: params.kind,
    notes: params.notes || undefined,
    status: "active",
    startedAt,
    clearedAt,
    createdAt: serverTimestamp(),
    dateKey: dateKeyFromDate(startedAt),
    source: { type: "unit", unitId: params.unitId },
    unitReportKey: params.unitReportKey,
    seriesId: params.seriesId,
  };

  return cleanUndefined(rawPayload);
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
