import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Clock, Layers, PlusCircle, Repeat, Search, Sparkle } from "lucide-react";
import { useEffect, useState } from "react";
import { DataState, DemoNote, Panel, Pill } from "@/components/kb-ui";
import { useKB } from "@/hooks/use-kb";
import { solutionStats, pct } from "@/lib/metrics";
import { CATEGORIES } from "@/lib/types";
import { getViews } from "@/lib/usage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Cloud Support Knowledge Hub" },
      { name: "description", content: "Overview of documented cloud support issues, verified solutions and pending reviews." },
      { property: "og:title", content: "Dashboard — Cloud Support Knowledge Hub" },
      { property: "og:description", content: "Every Issue Documented. Every Solution Within Reach." },
    ],
  }),
  component: Dashboard,
});

function Stat({ icon: Icon, label, value, to }: { icon: typeof Layers; label: string; value: number; to?: string }) {
  const inner = (
    <div className="rounded-xl border bg-card p-4 shadow-card transition hover:border-primary/40">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div>
      <div className="mt-2 text-3xl font-extrabold text-navy">{value}</div>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function Dashboard() {
  const { data } = useKB();
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const [views, setViews] = useState<Record<string, number>>({});
  useEffect(() => setViews(getViews()), []);

  const issues = data.issues;
  const verifiedSolutions = data.solutions.filter((s) => s.verificationStatus === "Verified").length;
  const top = data.solutions.map((s) => solutionStats(s, data.attempts)).filter((s) => s.successRate !== null).sort((a, b) => b.score - a.score).slice(0, 5);
  const recent = [...issues].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const frequent = issues.filter((i) => views[i.issueId]).sort((a, b) => (views[b.issueId] ?? 0) - (views[a.issueId] ?? 0)).slice(0, 5);
  const byCat = CATEGORIES.map((c) => ({ c, n: issues.filter((i) => i.category === c).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...byCat.map((x) => x.n));

  return (
    <DataState>
      <section className="relative overflow-hidden rounded-2xl bg-brand p-6 text-navy-foreground md:p-8">
        <p className="text-xs font-bold uppercase tracking-widest opacity-80">Cloud Support Knowledge Hub</p>
        <h1 className="mt-1 text-2xl font-extrabold md:text-3xl">Every Issue Documented. Every Solution Within Reach.</h1>
        <form className="mt-5 flex max-w-2xl gap-2" onSubmit={(e) => { e.preventDefault(); navigate({ to: "/knowledge", search: { q } }); }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Describe an error or symptom to find a solution." className="h-11 w-full rounded-lg bg-card pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <button className="rounded-lg bg-navy px-4 text-sm font-bold text-navy-foreground hover:opacity-90">Search</button>
          <Link to="/issues/new" className="hidden items-center gap-1.5 rounded-lg border border-navy-foreground/30 px-4 text-sm font-bold sm:flex"><PlusCircle className="h-4 w-4" />Add issue</Link>
        </form>
      </section>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat icon={Layers} label="Documented issues" value={issues.length} to="/knowledge" />
        <Stat icon={CheckCircle2} label="Verified solutions" value={verifiedSolutions} to="/rankings" />
        <Stat icon={Repeat} label="Recurring issues" value={issues.filter((i) => i.frequency === "Recurring").length} />
        <Stat icon={Sparkle} label="Unique issues" value={issues.filter((i) => i.frequency === "Unique").length} />
        <Stat icon={Clock} label="Awaiting verification" value={issues.filter((i) => i.knowledgeStatus === "Pending Verification").length} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel title="Recently documented" className="lg:col-span-2">
          <ul className="divide-y">
            {recent.map((i) => (
              <li key={i.issueId}>
                <Link to="/issues/$id" params={{ id: i.issueId }} className="flex items-center gap-3 py-2.5 hover:text-primary">
                  <span className="font-mono text-[11px] text-muted-foreground">{i.issueId}</span>
                  <span className="flex-1 truncate text-sm font-semibold">{i.title}</span>
                  <Pill>{i.knowledgeStatus}</Pill>
                </Link>
              </li>
            ))}
            {!recent.length && <li className="py-4 text-sm text-muted-foreground">No issues yet.</li>}
          </ul>
        </Panel>
        <Panel title="Issues by category">
          <ul className="space-y-2">
            {byCat.map(({ c, n }) => (
              <li key={c}>
                <Link to="/knowledge" search={{ category: c }} className="block text-xs">
                  <div className="flex justify-between font-semibold"><span>{c}</span><span>{n}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(n / max) * 100}%` }} /></div>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Most successful solutions" className="lg:col-span-2" action={<DemoNote />}>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="pb-2">Solution</th><th>Success</th><th>Attempts</th></tr></thead>
            <tbody>
              {top.map((s) => (
                <tr key={s.solution.solutionId} className="border-t">
                  <td className="py-2"><Link to="/issues/$id" params={{ id: s.solution.issueId }} className="font-semibold hover:text-primary">{s.solution.solutionTitle}</Link></td>
                  <td className="font-bold text-success">{pct(s.successRate)}</td>
                  <td className="text-muted-foreground">n={s.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!top.length && <p className="text-sm text-muted-foreground">Not enough recorded outcomes yet.</p>}
        </Panel>
        <Panel title="Frequently viewed (this browser)">
          {frequent.length ? (
            <ul className="space-y-2 text-sm">
              {frequent.map((i) => (
                <li key={i.issueId}><Link to="/issues/$id" params={{ id: i.issueId }} className="flex justify-between gap-2 hover:text-primary"><span className="truncate">{i.title}</span><span className="text-muted-foreground">{views[i.issueId]}×</span></Link></li>
              ))}
            </ul>
          ) : (
            <p className="flex items-start gap-2 text-sm text-muted-foreground"><AlertCircle className="mt-0.5 h-4 w-4" />Open issues from the Knowledge Base and they'll appear here.</p>
          )}
        </Panel>
      </div>
    </DataState>
  );
}
