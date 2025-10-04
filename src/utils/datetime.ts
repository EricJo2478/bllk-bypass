/**
 * Returns the UTC instant that corresponds to the given wall-clock date/time
 * in the provided IANA timezone (e.g., "America/Regina").
 */
export function dateFromLocal(
  dateStr: string, // "YYYY-MM-DD"
  timeStr: string, // "HH:mm"
  tz: string = DEFAULT_TZ
): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);

  // 1) Pretend the local fields are already UTC.
  const pretendUtcMs = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0);

  // 2) Ask the timezone what wall clock that UTC instant corresponds to.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = fmt
    .formatToParts(new Date(pretendUtcMs))
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});

  const fy = Number(parts.year),
    fm = Number(parts.month),
    fd = Number(parts.day);
  const fhh = Number(parts.hour),
    fmm = Number(parts.minute);

  // 3) Compute the difference (in minutes) between desired local and formatted local.
  const desiredMsAsUtc = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0);
  const formattedMsAsUtc = Date.UTC(
    fy,
    (fm ?? 1) - 1,
    fd,
    fhh ?? 0,
    fmm ?? 0,
    0
  );
  const diffMin = (desiredMsAsUtc - formattedMsAsUtc) / 60000;

  // 4) Adjust the UTC instant so that, in tz, it shows the desired wall clock.
  const trueUtcMs = pretendUtcMs + diffMin * 60000;
  return new Date(trueUtcMs);
}

/** Iterate from start (inclusive) to end (inclusive) by days (local tz). */
export function eachDayInclusive(
  startDate: string,
  endDate: string,
  tz = "America/Regina"
): string[] {
  const out: string[] = [];
  let cur = new Date(
    new Date(startDate + "T00:00:00").toLocaleString("en-CA", { timeZone: tz })
  );
  const end = new Date(
    new Date(endDate + "T00:00:00").toLocaleString("en-CA", { timeZone: tz })
  );

  while (cur <= end) {
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, "0");
    const dd = String(cur.getDate()).padStart(2, "0");
    out.push(`${yyyy}-${mm}-${dd}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export const DEFAULT_TZ = "America/Regina";

/** Robust formatter that ALWAYS shows Regina wall-clock (or the tz you pass). */
export function fmtDateTime(
  val:
    | Date
    | { seconds: number }
    | { toDate: () => Date }
    | string
    | number
    | null
    | undefined,
  tz: string = DEFAULT_TZ,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }
): string {
  let d: Date | null = null;
  if (!val) d = null;
  else if (val instanceof Date) d = val;
  else if (typeof val === "string") d = new Date(val);
  else if (typeof val === "number") d = new Date(val);
  else if (typeof (val as any).toDate === "function") d = (val as any).toDate();
  else if (typeof (val as any).seconds === "number")
    d = new Date((val as any).seconds * 1000);
  if (!d || isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, ...opts }).format(d);
}

type AnyDate =
  | Date
  | string
  | number
  | { seconds: number; nanoseconds?: number } // Firestore Timestamp-like
  | { toDate?: () => Date }; // actual Firestore Timestamp

export function toDate(val: AnyDate | null | undefined): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === "number") return new Date(val); // epoch ms
  if (typeof val === "string") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof (val as any).toDate === "function") {
    // Firestore Timestamp
    return (val as any).toDate();
  }
  if (typeof (val as any).seconds === "number") {
    // Firestore Timestamp shape from plain objects
    return new Date((val as any).seconds * 1000);
  }
  return null;
}
