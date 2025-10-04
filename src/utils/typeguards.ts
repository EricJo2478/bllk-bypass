// src/utils/typeguards.ts

export function isSourceUser(s: any): s is { type: "user" } {
  return s && s.type === "user";
}
export function isSourceUnit(s: any): s is { type: "unit"; unitId: string } {
  return s && s.type === "unit" && typeof s.unitId === "string";
}
