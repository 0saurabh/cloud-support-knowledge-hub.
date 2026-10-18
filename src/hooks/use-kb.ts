import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getProvider, useStorageConfig } from "@/lib/storage";
import { newId, type AuditEvent, type Issue, type KnowledgeData, type Solution, type SolutionAttempt } from "@/lib/types";

const EMPTY: KnowledgeData = { issues: [], solutions: [], attempts: [], audit: [] };

export function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => setH(true), []);
  return h;
}

export function useKB() {
  const cfg = useStorageConfig();
  const hydrated = useHydrated();
  const q = useQuery({
    queryKey: ["kb", cfg.source, cfg.spreadsheetId],
    queryFn: () => getProvider(cfg).load(),
    enabled: hydrated,
    staleTime: cfg.source === "sheets" ? 60_000 : 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return {
    data: q.data ?? EMPTY,
    loading: !hydrated || q.isLoading,
    error: q.error as Error | null,
    refetch: q.refetch,
    source: cfg.source,
    isDemo: cfg.source === "demo",
  };
}

export function useKBMutations() {
  const cfg = useStorageConfig();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["kb"] });

  const audit = (e: Omit<AuditEvent, "eventId" | "timestamp">) =>
    getProvider(cfg).upsert("AuditLog", { ...e, eventId: newId("EVT"), timestamp: new Date().toISOString() });

  const saveIssue = useMutation({
    mutationFn: async (p: { issue: Issue; solutions: Solution[]; isNew: boolean }) => {
      const prov = getProvider(cfg);
      await prov.upsert("Issues", p.issue);
      for (const s of p.solutions) await prov.upsert("Solutions", s);
      await audit({
        recordType: "Issue",
        recordId: p.issue.issueId,
        action: p.isNew ? "create" : "update",
        changedBy: p.issue.contributor,
        summary: `${p.isNew ? "Created" : "Updated"} "${p.issue.title}" with ${p.solutions.length} solution(s)`,
      });
    },
    onSuccess: invalidate,
  });

  const recordAttempt = useMutation({
    mutationFn: async (a: SolutionAttempt) => {
      await getProvider(cfg).upsert("SolutionAttempts", a);
      await audit({ recordType: "SolutionAttempt", recordId: a.attemptId, action: "feedback", changedBy: a.recordedBy, summary: `${a.outcome} on ${a.solutionId}` });
    },
    onSuccess: invalidate,
  });

  const setSolutionStatus = useMutation({
    mutationFn: async (p: { solution: Solution; status: Solution["verificationStatus"]; by: string }) => {
      await getProvider(cfg).upsert("Solutions", { ...p.solution, verificationStatus: p.status, updatedAt: new Date().toISOString() });
      await audit({ recordType: "Solution", recordId: p.solution.solutionId, action: "verify", changedBy: p.by, summary: `Status set to ${p.status}` });
    },
    onSuccess: invalidate,
  });

  return { saveIssue, recordAttempt, setSolutionStatus };
}
