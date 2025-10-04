// src/utils/url.ts

export function getQueryParam(
  name: string,
  search = window.location.search
): string | null {
  const params = new URLSearchParams(search);
  const v = params.get(name);
  return v && v.trim() ? v.trim() : null;
}

export function getUnitFromUrl(): string | null {
  return getQueryParam("unit");
}
