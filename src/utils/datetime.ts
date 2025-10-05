// src/util/datetime.ts

const REGINA_TZ = "America/Regina";

/**
 * Parse "YYYY-MM-DD" and "HH:mm" safely.
 */
function parseYmdHm(dateStr: string, timeStr: string) {
  if (!dateStr) throw new Error("Missing date");
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new Error(`Bad date "${dateStr}"`);
  }
  const [hh, mm] = (timeStr || "00:00").split(":").map((n) => parseInt(n, 10));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
    throw new Error(`Bad time "${timeStr}"`);
  }
  return { y, m, d, hh, mm };
}

/**
 * Get the numeric offset (minutes east of UTC, negative for "GMT-06:00" -> -360) for a given instant in a TZ.
 * We rely on timeZoneName: 'shortOffset' to get something like "GMT-06:00".
 */
function tzOffsetMinutesAt(instant: Date, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    timeZoneName: "shortOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(instant);
  const tzName =
    parts.find((p) => p.type === "timeZoneName")?.value || "GMT+00:00";
  // tzName like "GMT-06:00" or "UTC+00:00"
  const m = tzName.match(/([+-])(\d{2}):?(\d{2})/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  const h = parseInt(m[2], 10);
  const min = parseInt(m[3], 10);
  return sign * (h * 60 + min);
}

/**
 * Construct a JS Date that represents the instant when the Regina wall time equals
 * dateStr + timeStr. Works regardless of the user's local timezone.
 */
export function dateFromRegina(dateStr: string, timeStr: string): Date {
  const { y, m, d, hh, mm } = parseYmdHm(dateStr, timeStr);

  // First guess: treat components as if they were UTC.
  const guessUtcMs = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
  // Find Regina offset at that guess.
  const off1 = tzOffsetMinutesAt(new Date(guessUtcMs), REGINA_TZ);
  // Convert Regina wall time -> UTC epoch by subtracting offset minutes.
  const utcMs = Date.UTC(y, m - 1, d, hh, mm, 0, 0) - off1 * 60_000;

  // One refinement pass in case offset flips around that boundary.
  const off2 = tzOffsetMinutesAt(new Date(utcMs), REGINA_TZ);
  const refinedUtcMs =
    off2 === off1 ? utcMs : Date.UTC(y, m - 1, d, hh, mm, 0, 0) - off2 * 60_000;

  return new Date(refinedUtcMs);
}

/**
 * Format any Firestore Timestamp/Date/ISO as Regina local string.
 */
export function fmtRegina(v: any): string {
  try {
    if (!v) return "";
    const d =
      typeof v?.toDate === "function"
        ? v.toDate()
        : typeof v?.toMillis === "function"
        ? new Date(v.toMillis())
        : v instanceof Date
        ? v
        : new Date(v);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: REGINA_TZ,
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return "";
  }
}

/**
 * Inclusive day iterator for "YYYY-MM-DD" strings.
 */
export function eachDayInclusive(a: string, b: string): string[] {
  const [ay, am, ad] = a.split("-").map((n) => parseInt(n, 10));
  const [by, bm, bd] = b.split("-").map((n) => parseInt(n, 10));
  const start = new Date(Date.UTC(ay, am - 1, ad));
  const end = new Date(Date.UTC(by, bm - 1, bd));
  const out: string[] = [];
  for (let d = start; d <= end; d = new Date(d.getTime() + 86_400_000)) {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    out.push(`${yyyy}-${mm}-${dd}`);
  }
  return out;
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
