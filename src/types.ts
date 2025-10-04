// src/types.ts

export type DivertKind = "full" | "labs-xray" | "ct" | "other";
export type DivertStatus = "active" | "cleared";

export type SourceUser = { type: "user" };
export type SourceUnit = { type: "unit"; unitId: string };
export type DivertSource = SourceUser | SourceUnit;

export type DivertDoc = {
  hospitalId: string;
  kind: DivertKind;
  notes?: string;
  status: DivertStatus;
  startedAt: Date; // Firestore Timestamp on wire
  clearedAt?: Date; // Firestore Timestamp on wire
  createdAt: Date; // Firestore Timestamp on wire
  dateKey: string; // "YYYY-MM-DD"
  source: DivertSource;
  createdByUid?: string; // only when source.type === 'user'
  unitReportKey?: string; // only when source.type === 'unit'
};

export type Hospital = {
  id: string;
  name: string;
  shortCode: string;
  active?: boolean;
};

export type UnitDoc = {
  label: string;
  active: boolean;
  reportKey: string;
  reportKeyUpdatedAt?: Date;
  allowedHospitals: string[];
};
