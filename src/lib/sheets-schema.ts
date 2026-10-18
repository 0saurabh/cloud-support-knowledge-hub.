// Client-safe: column layout for each Google Sheets tab.
export const SHEET_TABS = {
  Issues: [
    "issueId", "title", "ticketReference", "description", "errorMessage", "symptoms", "category", "environment",
    "initialObservations", "troubleshootingSteps", "failedAttempts", "rootCause", "rootCauseConfidence", "frequency",
    "importance", "knowledgeStatus", "contributor", "createdAt", "updatedAt", "checksPerformed",
  ],
  Solutions: [
    "solutionId", "issueId", "solutionTitle", "prerequisites", "orderedSteps", "warnings", "rollbackInstructions",
    "verificationSteps", "preventiveActions", "escalationNotes", "author", "verificationStatus", "createdAt", "updatedAt",
  ],
  SolutionAttempts: [
    "attemptId", "solutionId", "issueId", "outcome", "resolutionTimeMinutes", "issueRecurrence", "feedbackNotes",
    "recordedBy", "createdAt",
  ],
  AuditLog: ["eventId", "recordType", "recordId", "action", "changedBy", "timestamp", "summary"],
} as const;

export type SheetTab = keyof typeof SHEET_TABS;
export const LIST_FIELDS = new Set(["troubleshootingSteps", "orderedSteps"]);

export function colLetter(n: number) {
  let s = "";
  n++;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function extractSpreadsheetId(input: string): string | null {
  const t = input.trim();
  const m = t.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(t)) return t;
  return null;
}

export function toRow(tab: SheetTab, obj: Record<string, unknown>): string[] {
  return SHEET_TABS[tab].map((k) => {
    const v = obj[k];
    if (Array.isArray(v)) return v.join("\n");
    if (v === null || v === undefined) return "";
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    return String(v);
  });
}

export function fromRow(tab: SheetTab, headers: string[], row: string[]): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  headers.forEach((h, i) => {
    const raw = row[i] ?? "";
    if (LIST_FIELDS.has(h)) o[h] = raw ? raw.split("\n").map((x) => x.trim()).filter(Boolean) : [];
    else if (h === "resolutionTimeMinutes") o[h] = raw === "" ? null : Number(raw);
    else if (h === "issueRecurrence") o[h] = raw.toUpperCase() === "TRUE";
    else o[h] = raw;
  });
  void tab;
  return o;
}
