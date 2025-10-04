// src/utils/device.ts
/**
 * Determines if the current client looks like a mobile device.
 * Uses viewport width, user agent heuristics, and touch support.
 */
export function isMobileLike(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined")
    return false;

  const ua =
    navigator.userAgent || navigator.vendor || (window as any).opera || "";

  // Common mobile keywords
  const mobileRegex =
    /android|iphone|ipad|ipod|blackberry|bb|playbook|windows phone|opera mini|mobile|silk/i;

  const byUA = mobileRegex.test(ua);

  // small screen hint
  const byViewport = window.innerWidth <= 768;

  // Touchscreen hint (catches e.g. iPad landscape)
  const byTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  return byUA || (byViewport && byTouch);
}

/**
 * Returns true if this environment looks like a standalone
 * app (PWA installed to home screen or iOS standalone).
 */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    (window.matchMedia?.("(display-mode: standalone)")?.matches ?? false) ||
    (window.navigator as any).standalone === true
  );
}
