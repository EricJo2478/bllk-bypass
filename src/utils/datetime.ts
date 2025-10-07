// src/util/datetime.ts

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
 * Construct a JS Date representing the given local wall time.
 * No timezone conversion; 07:00 means 07:00 in the environment’s local time.
 */
export function dateFromLocal(dateStr: string, timeStr: string): Date {
  const { y, m, d, hh, mm } = parseYmdHm(dateStr, timeStr);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
}

/**
 * Format any Firestore Timestamp/Date/ISO as a local wall-time string.
 */
export function fmtLocal(v: any): string {
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
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      // NOTE: no timeZone specified → uses local environment time
    }).format(d);
  } catch {
    return "";
  }
}

/**
 * Inclusive day iterator for "YYYY-MM-DD" strings using LOCAL dates.
 */
export function eachDayInclusive(a: string, b: string): string[] {
  const [ay, am, ad] = a.split("-").map((n) => parseInt(n, 10));
  const [by, bm, bd] = b.split("-").map((n) => parseInt(n, 10));

  const start = new Date(ay, (am ?? 1) - 1, ad ?? 1);
  const end = new Date(by, (bm ?? 1) - 1, bd ?? 1);

  // Normalize to midnight local
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const out: string[] = [];
  for (
    let d = new Date(start);
    d <= end;
    d = new Date(d.getTime() + 86_400_000)
  ) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    out.push(`${yyyy}-${mm}-${dd}`);
  }
  return out;
}

/** Local "now" and a simple 24h window using local clock. */
export function nowLocal(): Date {
  return new Date();
}

export function next24hWindow(): { start: Date; end: Date } {
  const start = nowLocal();
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/* ------------------------------------------------------------------
 * Backwards-compatible aliases (remove later if you fully migrate)
 * ------------------------------------------------------------------ */

/** Alias: previous code called this; now it’s timezone-free local. */
export const dateFromRegina = dateFromLocal;

/** Alias: previous code called this; now it’s timezone-free local. */
export const fmtRegina = fmtLocal;

/** Alias: previous code called this; now it’s just local now. */
export const reginaNow = nowLocal;
