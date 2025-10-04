export function isMobileLike() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(ua);
}
