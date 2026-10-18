import type { Issue, KnowledgeData } from "./types";

// Keyword search service. Swap `scoreIssue` for an embedding-based scorer later.
const STOP = new Set(["the", "a", "an", "is", "to", "of", "and", "in", "on", "for", "with", "not", "after", "when", "my", "it"]);

export function tokenize(q: string) {
  return q.toLowerCase().split(/[^a-z0-9.]+/).filter((t) => t.length > 1 && !STOP.has(t));
}

function fields(issue: Issue, data: KnowledgeData) {
  const sols = data.solutions.filter((s) => s.issueId === issue.issueId);
  return [
    { text: issue.title, w: 4 },
    { text: issue.errorMessage, w: 3 },
    { text: issue.symptoms, w: 2 },
    { text: issue.rootCause, w: 2 },
    { text: `${issue.description} ${issue.initialObservations} ${issue.troubleshootingSteps.join(" ")} ${issue.checksPerformed} ${issue.failedAttempts}`, w: 1 },
    { text: sols.map((s) => `${s.solutionTitle} ${s.orderedSteps.join(" ")}`).join(" "), w: 1 },
    { text: `${issue.environment} ${issue.category} ${issue.issueId} ${issue.ticketReference}`, w: 1.5 },
  ];
}

export function scoreIssue(issue: Issue, tokens: string[], data: KnowledgeData) {
  if (!tokens.length) return 0;
  const fs = fields(issue, data).map((f) => ({ t: f.text.toLowerCase(), w: f.w }));
  let score = 0;
  let matched = 0;
  for (const tok of tokens) {
    let hit = false;
    for (const f of fs) if (f.t.includes(tok)) { score += f.w; hit = true; }
    if (hit) matched++;
  }
  return matched === 0 ? 0 : score * (matched / tokens.length);
}

export function searchIssues(query: string, data: KnowledgeData) {
  const tokens = tokenize(query);
  return data.issues
    .map((issue) => ({ issue, score: scoreIssue(issue, tokens, data) }))
    .filter((r) => !tokens.length || r.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function findSimilar(text: string, data: KnowledgeData, excludeId?: string, limit = 3) {
  const tokens = tokenize(text);
  if (tokens.length < 2) return [];
  return data.issues
    .filter((i) => i.issueId !== excludeId)
    .map((issue) => ({ issue, score: scoreIssue(issue, tokens, data) }))
    .filter((r) => r.score >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
