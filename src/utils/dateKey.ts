// src/utils/dateKey.ts

const REGINA_TZ = "America/Regina";

/** Get today's date key in Regina: "YYYY-MM-DD". */
export function dateKeyFromNowRegina(): string {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: REGINA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // e.g., "2025-10-04"
  // en-CA returns YYYY-MM-DD already.
  return s;
}

/** Get a date key from a UTC Date instant as Regina wall date. */
export function dateKeyFromDate(d: Date): string {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: REGINA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return s; // "YYYY-MM-DD"
}
