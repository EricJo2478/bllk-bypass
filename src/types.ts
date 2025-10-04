export type DivertKind =
  | "full"
  | "partial"
  | "ct-divert"
  | "labs-xray-divert"
  | "other";
export type ReporterTier = "verified" | "user" | "anonymous";

export interface HospitalDoc {
  name: string;
  shortCode: string;
  region?: string;
  active: boolean;
}

export interface DivertDoc {
  hospitalId: string;
  kind: DivertKind;
  notes?: string;
  status: "active" | "cleared";
  startedAt: Date;
  clearedAt?: Date | null;
  createdAt: any; // Firestore serverTimestamp
  createdByUid?: string;
  reporterTier: ReporterTier;
  dateKey: string; // YYYY-MM-DD
  verifyCount: number; // count of verified thumbs-up
  reportsCount: number; // number of underlying reports contributing
}
