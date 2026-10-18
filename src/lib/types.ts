export const CATEGORIES = [
  "Tally on Cloud",
  "TallyPrime / Tally application",
  "RDP / Remote Access",
  "Windows Server",
  "IIS / Web Services",
  "Network / Connectivity",
  "User Permissions",
  "Printing / PDF",
  "Performance / Slow Response",
  "Backup / Restore",
  "Installation / Configuration",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const FREQUENCIES = ["Recurring", "Regular", "Unique"] as const;
export const IMPORTANCES = ["Critical", "Important", "Normal"] as const;
export const STATUSES = ["Draft", "Pending Verification", "Verified", "Retired"] as const;
export const CONFIDENCES = ["Confirmed", "Suspected", "Unknown"] as const;
export const OUTCOMES = ["Worked", "Partially Worked", "Did Not Work"] as const;

export type Frequency = (typeof FREQUENCIES)[number];
export type Importance = (typeof IMPORTANCES)[number];
export type KnowledgeStatus = (typeof STATUSES)[number];
export type Confidence = (typeof CONFIDENCES)[number];
export type Outcome = (typeof OUTCOMES)[number];

export interface Issue {
  issueId: string;
  title: string;
  ticketReference: string;
  description: string;
  errorMessage: string;
  symptoms: string;
  category: Category;
  environment: string;
  initialObservations: string;
  troubleshootingSteps: string[];
  checksPerformed: string;
  failedAttempts: string;
  rootCause: string;
  rootCauseConfidence: Confidence;
  frequency: Frequency;
  importance: Importance;
  knowledgeStatus: KnowledgeStatus;
  contributor: string;
  createdAt: string;
  updatedAt: string;
}

export interface Solution {
  solutionId: string;
  issueId: string;
  solutionTitle: string;
  prerequisites: string;
  orderedSteps: string[];
  warnings: string;
  rollbackInstructions: string;
  verificationSteps: string;
  preventiveActions: string;
  escalationNotes: string;
  author: string;
  verificationStatus: KnowledgeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SolutionAttempt {
  attemptId: string;
  solutionId: string;
  issueId: string;
  outcome: Outcome;
  resolutionTimeMinutes: number | null;
  issueRecurrence: boolean;
  feedbackNotes: string;
  recordedBy: string;
  createdAt: string;
}

export interface AuditEvent {
  eventId: string;
  recordType: "Issue" | "Solution" | "SolutionAttempt";
  recordId: string;
  action: "create" | "update" | "verify" | "feedback";
  changedBy: string;
  timestamp: string;
  summary: string;
}

export interface KnowledgeData {
  issues: Issue[];
  solutions: Solution[];
  attempts: SolutionAttempt[];
  audit: AuditEvent[];
}

export type DataSource = "demo" | "sheets";

export function newId(prefix: string) {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 6).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}
