import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { DataState, DemoNote, PageHeader, Panel, Pill } from "@/components/kb-ui";
import { useKB } from "@/hooks/use-kb";
import { MIN_ATTEMPTS_FOR_RATE, median, mins, solutionStats } from "@/lib/metrics";
import { CATEGORIES } from "@/lib/types";
import { getSearches, getViews } from "@/lib/usage";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Categories & Reports — Cloud Support Knowledge Hub" },
      { name: "description", content: "Knowledge base analytics: categories, root causes, failed fixes, review queue and usage." },
      { property: "og:title", content: "Categories & Reports — Cloud Support Knowledge Hub" },
      { property: "og:description", content: "Analytics across documented issues and recorded solution outcomes." },
    ],
  }),
  component: () => <DataState><Reports /></DataState>,
});

function Bars({ rows }: { rows: { label: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="text-xs">
          <div className="flex justify-between gap-2 font-semibold"><span className="truncate">{r.label}</span><span>{r.n}</span></div>
          <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(r.n / max) * 100}%` }} /></div>
        </li>
      ))}
      {!rows.length && <li className="text-sm text-muted-foreground">No data yet.</li>}
    </ul>
  );
}

function Reports() {
  const { data } = useKB();
  const [usage, setUsage] = useState<{ views: Record<string, number>; searches: { q: string; at: string }[] }>({ views: {}, searches: [] });
  useEffect(() => setUsage({ views: getViews(), searches: getSearches() }), []);

  const r = useMemo(() => {
    const cats = CATEGORIES.map((c) => ({ label: c, n: data.issues.filter((i) => i.category === c).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
    const causeCount: Record<string, number> = {};
    data.issues.filter((i) => i.rootCause && i.rootCauseConfidence !== "Unknown").forEach((i) => { const k = i.rootCause.split(/[.;—]/)[0].slice(0, 70); causeCount[k] = (causeCount[k] ?? 0) + 1; });
    const causes = Object.entries(causeCount).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n).slice(0, 6);
    const repeatedFail = data.issues.map((i) => ({ i, n: data.attempts.filter((a) => a.issueId === i.issueId && a.outcome === "Did Not Work").length })).filter((x) => x.n >= 2).sort((a, b) => b.n - a.n);
    const awaiting = [...data.issues.filter((i) => i.knowledgeStatus === "Pending Verification").map((i) => ({ id: i.issueId, issueId: i.issueId, title: i.title, kind: "Issue" })), ...data.solutions.filter((s) => s.verificationStatus === "Pending Verification").map((s) => ({ id: s.solutionId, issueId: s.issueId, title: s.solutionTitle, kind: "Solution" }))];
    const used = data.solutions.filter((s) => s.verificationStatus === "Verified").map((s) => solutionStats(s, data.attempts)).sort((a, b) => b.attempts - a.attempts).slice(0, 6);
    const times = data.attempts.map((a) => a.resolutionTimeMinutes).filter((n): n is number => typeof n === "number");
    const enough = times.length >= MIN_ATTEMPTS_FOR_RATE;
    const cutoff = new Date(Date.now() - 180 * 864e5).toISOString();
    const stale = data.issues.filter((i) => i.updatedAt < cutoff && i.knowledgeStatus !== "Retired");
    return { cats, causes, repeatedFail, awaiting, used, avg: enough ? times.reduce((a, b) => a + b, 0) / times.length : null, med: enough ? median(times) : null, n: times.length, stale };
  }, [data]);

  const months: Record<string, number> = {};
  usage.searches.forEach((s) => { const m = s.at.slice(0, 7); months[m] = (months[m] ?? 0) + 1; });
  const totalViews = Object.values(usage.views).reduce((a, b) => a + b, 0);

  return (
    <div>
      <PageHeader title="Categories & Reports" subtitle="Counts reflect documented knowledge-base records — not actual ticket volume. No ticket data has been imported." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Most common issue categories"><Bars rows={r.cats} /></Panel>
        <Panel title="Most documented root causes"><Bars rows={r.causes} /></Panel>
        <Panel title="Resolution time" action={<DemoNote />}>
          {r.med === null ? <p className="text-sm text-muted-foreground">Not enough recorded outcomes ({r.n}).</p> : (
            <div className="grid grid-cols-2 gap-3">
              <div><div className="text-xs text-muted-foreground">Median</div><div className="text-2xl font-extrabold text-navy">{mins(r.med)}</div></div>
              <div><div className="text-xs text-muted-foreground">Average</div><div className="text-2xl font-extrabold text-navy">{mins(r.avg)}</div></div>
              <div className="col-span-2 text-xs text-muted-foreground">Based on {r.n} recorded attempts.</div>
            </div>
          )}
        </Panel>
        <Panel title="Repeated unsuccessful fixes" className="lg:col-span-2">
          <ul className="divide-y text-sm">
            {r.repeatedFail.map(({ i, n }) => <li key={i.issueId} className="flex justify-between py-2"><Link to="/issues/$id" params={{ id: i.issueId }} className="font-semibold hover:text-primary">{i.title}</Link><span className="text-destructive">{n} failed</span></li>)}
            {!r.repeatedFail.length && <li className="py-2 text-muted-foreground">None.</li>}
          </ul>
        </Panel>
        <Panel title="Knowledge base usage (this browser)">
          <p className="text-sm">Issue views: <b>{totalViews}</b> · Searches: <b>{usage.searches.length}</b></p>
          <Bars rows={Object.entries(months).sort().map(([label, n]) => ({ label, n }))} />
        </Panel>
        <Panel title="Awaiting verification" className="lg:col-span-2">
          <ul className="divide-y text-sm">
            {r.awaiting.map((a) => <li key={a.id} className="flex items-center gap-2 py-2"><Pill>{a.kind}</Pill><Link to="/issues/$id" params={{ id: a.issueId }} className="flex-1 font-semibold hover:text-primary">{a.title}</Link><span className="font-mono text-[11px] text-muted-foreground">{a.id}</span></li>)}
            {!r.awaiting.length && <li className="py-2 text-muted-foreground">Nothing pending.</li>}
          </ul>
        </Panel>
        <Panel title="Needs review (not updated in 180 days)">
          <ul className="space-y-2 text-sm">
            {r.stale.map((i) => <li key={i.issueId}><Link to="/issues/$id" params={{ id: i.issueId }} className="hover:text-primary">{i.title}</Link></li>)}
            {!r.stale.length && <li className="text-muted-foreground">All records are recent.</li>}
          </ul>
        </Panel>
        <Panel title="Most-used verified solutions" className="lg:col-span-3" action={<DemoNote />}>
          <Bars rows={r.used.map((s) => ({ label: s.solution.solutionTitle, n: s.attempts }))} />
        </Panel>
      </div>
    </div>
  );
}
