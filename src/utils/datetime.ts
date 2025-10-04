// src/util/datetime.ts

const REGINA_TZ = "America/Regina";

/** Build a UTC Date corresponding to a Regina wall-clock "YYYY-MM-DD" + "HH:mm". */
export function dateFromRegina(dateStr: string, timeStr: string): Date {
  // Ex: "2025-10-04" + "07:00" -> 2025-10-04T13:00:00.000Z
  return new Date(`${dateStr}T${timeStr}:00-06:00`);
}

/** Format any Date/Firestore Timestamp-like value in Regina time. */
export function fmtRegina(
  val: any,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }
): string {
  const d =
    val?.toDate?.() ??
    (typeof val?.seconds === "number"
      ? new Date(val.seconds * 1000)
      : new Date(val));
  if (!d || isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REGINA_TZ,
    ...opts,
  }).format(d);
}

/** Now and window edges in UTC Dates, based on Regina wall clock. */
export function reginaNow(): Date {
  // Use Intl to derive the current Regina wall-clock and then map to actual UTC "now".
  const now = new Date();
  // No conversion needed here for logic; this is fine for "now".
  return now;
}

export function next24hWindow(): { start: Date; end: Date } {
  const start = new Date(); // now UTC
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}
