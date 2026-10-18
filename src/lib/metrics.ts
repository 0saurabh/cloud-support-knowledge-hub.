import type { KnowledgeData, Solution, SolutionAttempt } from "./types";

export const MIN_ATTEMPTS_FOR_RATE = 3;

export function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const a = [...nums].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

export interface SolutionStats {
  solution: Solution;
  attempts: number;
  worked: number;
  partial: number;
  failed: number;
  successRate: number | null; // null when sample too small
  medianMinutes: number | null;
  recurrenceRate: number | null;
  lastVerified: string | null;
  score: number;
}

export function solutionStats(solution: Solution, all: SolutionAttempt[]): SolutionStats {
  const at = all.filter((a) => a.solutionId === solution.solutionId);
  const worked = at.filter((a) => a.outcome === "Worked").length;
  const partial = at.filter((a) => a.outcome === "Partially Worked").length;
  const failed = at.filter((a) => a.outcome === "Did Not Work").length;
  const enough = at.length >= MIN_ATTEMPTS_FOR_RATE;
  const successRate = enough ? (worked + partial * 0.5) / at.length : null;
  const times = at.map((a) => a.resolutionTimeMinutes).filter((n): n is number => typeof n === "number" && !isNaN(n));
  const medianMinutes = times.length >= MIN_ATTEMPTS_FOR_RATE ? median(times) : null;
  const recurrenceRate = enough ? at.filter((a) => a.issueRecurrence).length / at.length : null;
  const lastWorked = at.filter((a) => a.outcome === "Worked").map((a) => a.createdAt).sort().pop() ?? null;
  // Wilson lower bound so small samples don't outrank large ones
  let score = 0;
  if (at.length) {
    const p = (worked + partial * 0.5) / at.length;
    const n = at.length, z = 1.64;
    score = (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / (1 + (z * z) / n);
  }
  if (solution.verificationStatus === "Verified") score += 0.15;
  if (solution.verificationStatus === "Retired") score -= 1;
  return {
    solution,
    attempts: at.length,
    worked,
    partial,
    failed,
    successRate,
    medianMinutes,
    recurrenceRate,
    lastVerified: solution.verificationStatus === "Verified" ? lastWorked ?? solution.updatedAt : null,
    score,
  };
}

export function issueStats(issueId: string, data: KnowledgeData) {
  const sols = data.solutions.filter((s) => s.issueId === issueId).map((s) => solutionStats(s, data.attempts));
  const best = [...sols].sort((a, b) => b.score - a.score)[0];
  const at = data.attempts.filter((a) => a.issueId === issueId);
  const times = at.map((a) => a.resolutionTimeMinutes).filter((n): n is number => typeof n === "number");
  return {
    solutions: sols,
    best,
    attemptCount: at.length,
    medianMinutes: times.length >= MIN_ATTEMPTS_FOR_RATE ? median(times) : null,
    failedCount: at.filter((a) => a.outcome === "Did Not Work").length,
  };
}

export const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);
export const mins = (n: number | null) => (n === null ? "—" : `${Math.round(n)} min`);
