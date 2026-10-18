import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataState, PageHeader, Pill } from "@/components/kb-ui";
import { useKB, useKBMutations } from "@/hooks/use-kb";
import { MIN_ATTEMPTS_FOR_RATE, mins, pct, solutionStats } from "@/lib/metrics";
import { STATUSES, type KnowledgeStatus } from "@/lib/types";

export const Route = createFileRoute("/rankings")({
  head: () => ({
    meta: [
      { title: "Solution Rankings — Cloud Support Knowledge Hub" },
      { name: "description", content: "Compare solutions by recorded outcomes, sample size and verification status." },
      { property: "og:title", content: "Solution Rankings — Cloud Support Knowledge Hub" },
      { property: "og:description", content: "Reliability metrics calculated from recorded solution outcomes." },
    ],
  }),
  component: () => <DataState><Rankings /></DataState>,
});

function Rankings() {
  const { data, isDemo } = useKB();
  const { setSolutionStatus } = useKBMutations();
  const [issueFilter, setIssueFilter] = useState("");
  const [reviewer, setReviewer] = useState("");

  const groups = useMemo(() => {
    return data.issues
      .filter((i) => !issueFilter || i.issueId === issueFilter)
      .map((issue) => ({ issue, stats: data.solutions.filter((s) => s.issueId === issue.issueId).map((s) => solutionStats(s, data.attempts)).sort((a, b) => b.score - a.score) }))
      .filter((g) => g.stats.length);
  }, [data, issueFilter]);

  const change = async (sol: (typeof groups)[0]["stats"][0]["solution"], status: KnowledgeStatus) => {
    if (!reviewer.trim()) { toast.error("Enter the reviewing senior executive's name first."); return; }
    try {
      await setSolutionStatus.mutateAsync({ solution: sol, status, by: reviewer });
      toast.success(`${sol.solutionId} marked ${status}${isDemo ? " (demo data)" : ""}.`);
    } catch (e) { toast.error(`Update failed: ${e instanceof Error ? e.message : e}`); }
  };

  return (
    <div>
      <PageHeader title="Solution Rankings" subtitle={`Ranked by verification status and recorded outcomes (lower-confidence bound). Success rate shown only with ≥${MIN_ATTEMPTS_FOR_RATE} attempts; partial = half credit.`} />
      {isDemo && <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2 text-sm font-semibold text-warning-foreground">All statistics below are illustrative sample data.</div>}
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={issueFilter} onChange={(e) => setIssueFilter(e.target.value)} className="h-9 rounded-md border bg-card px-2 text-sm">
          <option value="">All issues</option>
          {data.issues.map((i) => <option key={i.issueId} value={i.issueId}>{i.issueId} — {i.title.slice(0, 50)}</option>)}
        </select>
        <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Reviewer name (for approvals)" className="h-9 rounded-md border bg-card px-3 text-sm" />
      </div>
      <div className="space-y-5">
        {groups.map(({ issue, stats }) => (
          <div key={issue.issueId} className="overflow-hidden rounded-xl border bg-card shadow-card">
            <Link to="/issues/$id" params={{ id: issue.issueId }} className="block border-b bg-panel px-4 py-2.5 font-bold text-navy hover:text-primary"><span className="mr-2 font-mono text-xs text-muted-foreground">{issue.issueId}</span>{issue.title}</Link>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>{["#", "Solution", "Status", "Attempts", "Worked", "Partial / Failed", "Success rate", "Median time", "Recurrence", "Last verified", "Review"].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {stats.map((s, i) => (
                    <tr key={s.solution.solutionId} className="border-t">
                      <td className="px-3 py-2 font-bold text-primary">{i + 1}</td>
                      <td className="px-3 py-2"><div className="font-semibold">{s.solution.solutionTitle}</div><div className="font-mono text-[11px] text-muted-foreground">{s.solution.solutionId}</div></td>
                      <td className="px-3 py-2"><Pill>{s.solution.verificationStatus}</Pill></td>
                      <td className="px-3 py-2">{s.attempts}</td>
                      <td className="px-3 py-2 text-success">{s.worked}</td>
                      <td className="px-3 py-2">{s.partial} / <span className="text-destructive">{s.failed}</span></td>
                      <td className="px-3 py-2 font-bold">{s.successRate === null ? <span className="text-xs font-normal text-muted-foreground">Insufficient data</span> : `${pct(s.successRate)} (n=${s.attempts})`}</td>
                      <td className="px-3 py-2">{mins(s.medianMinutes)}</td>
                      <td className="px-3 py-2">{pct(s.recurrenceRate)}</td>
                      <td className="px-3 py-2 text-xs">{s.lastVerified ? new Date(s.lastVerified).toLocaleDateString() : "—"}</td>
                      <td className="px-3 py-2">
                        <select value={s.solution.verificationStatus} onChange={(e) => change(s.solution, e.target.value as KnowledgeStatus)} className="h-8 rounded border bg-card px-1 text-xs">
                          {STATUSES.map((st) => <option key={st}>{st}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
