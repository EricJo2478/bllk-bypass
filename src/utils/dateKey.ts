export function dateKeyFromLocal(d = new Date(), tz = "America/Regina") {
  return d.toLocaleDateString("en-CA", { timeZone: tz });
}
