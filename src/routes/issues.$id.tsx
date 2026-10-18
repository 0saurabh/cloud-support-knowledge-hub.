import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bot, Pencil, RotateCcw, ThumbsDown, ThumbsUp, Minus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { DataState, DemoNote, Empty, Panel, Pill } from "@/components/kb-ui";
import { useKB, useKBMutations } from "@/hooks/use-kb";
import { mins, pct, solutionStats } from "@/lib/metrics";
import { findSimilar } from "@/lib/search";
import { newId, type Outcome, type Solution } from "@/lib/types";
import { getChecklist, recordView, setChecklist } from "@/lib/usage";

export const Route = createFileRoute("/issues/$id")({
  validateSearch: (s: Record<string, unknown>): { from?: string } => (typeof s.from === "string" ? { from: s.from } : {}),
  head: ({ params }) => ({
    meta: [
      { title: `${params.id} — Troubleshooting Playbook` },
      { name: "description", content: "Issue overview, root cause, ordered checklist and verified solutions." },
      { property: "og:title", content: `${params.id} — Cloud Support Knowledge Hub` },
      { property: "og:description", content: "Troubleshooting playbook with root cause and solutions." },
    ],
  }),
  component: () => <DataState><IssueDetail /></DataState>,
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t py-4 first:border-t-0 first:pt-0">
      <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-navy/70">{title}</h3>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}
const Txt = ({ v }: { v: string }) => (v?.trim() ? <p className="whitespace-pre-wrap">{v}</p> : <p className="text-muted-foreground">Not recorded.</p>);

function FeedbackForm({ solution, onDone }: { solution: Solution; onDone: () => void }) {
  const { recordAttempt } = useKBMutations();
  const { isDemo } = useKB();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [minutes, setMinutes] = useState("");
  const [recurred, setRecurred] = useState(false);
  const [notes, setNotes] = useState("");
  const [by, setBy] = useState("");
  const submit = async () => {
    if (!outcome || !by.trim()) { toast.error("Choose an outcome and enter your name."); return; }
    const m = minutes ? Number(minutes) : null;
    if (m !== null && (isNaN(m) || m < 0)) { toast.error("Resolution time must be a positive number."); return; }
    try {
      await recordAttempt.mutateAsync({ attemptId: newId("ATT"), solutionId: solution.solutionId, issueId: solution.issueId, outcome, resolutionTimeMinutes: m, issueRecurrence: recurred, feedbackNotes: notes, recordedBy: by, createdAt: new Date().toISOString() });
      toast.success(isDemo ? "Feedback saved to DEMO data (this browser only)." : "Feedback saved to Google Sheets.");
      onDone();
    } catch (e) { toast.error(`Could not save feedback: ${e instanceof Error ? e.message : e}`); }
  };
  const btn = (o: Outcome, Icon: typeof ThumbsUp) => (
    <button type="button" onClick={() => setOutcome(o)} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold ${outcome === o ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}><Icon className="h-4 w-4" />{o}</button>
  );
  return (
    <div className="mt-3 rounded-lg border bg-panel p-3">
      <div className="flex flex-wrap gap-2">{btn("Worked", ThumbsUp)}{btn("Partially Worked", Minus)}{btn("Did Not Work", ThumbsDown)}</div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="Your name *" className="rounded-md border bg-card px-2 py-1.5 text-sm" />
        <input value={minutes} onChange={(e) => setMinutes(e.target.value)} type="number" min={0} placeholder="Resolution time (min)" className="rounded-md border bg-card px-2 py-1.5 text-sm" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={recurred} onChange={(e) => setRecurred(e.target.checked)} />Issue recurred</label>
      </div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (no passwords or customer confidential data)" rows={2} className="mt-2 w-full rounded-md border bg-card px-2 py-1.5 text-sm" />
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded-md border px-3 py-1.5 text-sm">Cancel</button>
        <button type="button" disabled={recordAttempt.isPending} onClick={submit} className="rounded-md bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground disabled:opacity-60">{recordAttempt.isPending ? "Saving…" : "Submit feedback"}</button>
      </div>
    </div>
  );
}

function SolutionCard({ solution, rank }: { solution: Solution; rank: number }) {
  const { data } = useKB();
  const st = solutionStats(solution, data.attempts);
  const key = solution.solutionId;
  const [checks, setChecks] = useState<Record<number, boolean>>({});
  const [fb, setFb] = useState(false);
  useEffect(() => setChecks(getChecklist(key)), [key]);
  const toggle = (i: number) => { const n = { ...checks, [i]: !checks[i] }; setChecks(n); setChecklist(key, n); };
  const done = solution.orderedSteps.filter((_, i) => checks[i]).length;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-mono text-muted-foreground">#{rank} · {solution.solutionId} · by {solution.author}</div>
          <h4 className="font-bold text-navy">{solution.solutionTitle}</h4>
        </div>
        <Pill>{solution.verificationStatus}</Pill>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>Success: <b className="text-foreground">{pct(st.successRate)}</b> (n={st.attempts})</span>
        <span>Worked {st.worked} · Partial {st.partial} · Failed {st.failed}</span>
        <span>Median: <b className="text-foreground">{mins(st.medianMinutes)}</b></span>
        <DemoNote />
      </div>
      {solution.prerequisites && <p className="mt-3 rounded-md bg-accent px-3 py-2 text-xs"><b>Prerequisites:</b> {solution.prerequisites}</p>}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs font-semibold text-muted-foreground">
          <span>Troubleshooting checklist — {done}/{solution.orderedSteps.length} done (your progress only)</span>
          {done > 0 && <button onClick={() => { setChecks({}); setChecklist(key, {}); }} className="flex items-center gap-1 text-primary"><RotateCcw className="h-3 w-3" />Reset</button>}
        </div>
        <ol className="space-y-1.5">
          {solution.orderedSteps.map((s, i) => (
            <li key={i}>
              <label className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm ${checks[i] ? "bg-success/5 text-muted-foreground line-through" : "hover:bg-panel"}`}>
                <input type="checkbox" checked={!!checks[i]} onChange={() => toggle(i)} className="mt-0.5" />
                <span className="font-bold text-primary">{i + 1}.</span><span className="font-mono text-[13px]">{s}</span>
              </label>
            </li>
          ))}
        </ol>
      </div>
      <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
        {solution.verificationSteps && <div><b className="text-xs uppercase text-navy/70">Verification & expected result</b><p>{solution.verificationSteps}</p></div>}
        {solution.warnings && <div className="rounded-md border border-warning/40 bg-warning/10 p-2"><b className="text-xs uppercase">Risks</b><p>{solution.warnings}</p></div>}
        {solution.rollbackInstructions && <div><b className="text-xs uppercase text-navy/70">Rollback</b><p className="font-mono text-[13px]">{solution.rollbackInstructions}</p></div>}
        {solution.preventiveActions && <div><b className="text-xs uppercase text-navy/70">Prevention</b><p>{solution.preventiveActions}</p></div>}
        {solution.escalationNotes && <div className="md:col-span-2"><b className="text-xs uppercase text-navy/70">Escalation</b><p>{solution.escalationNotes}</p></div>}
      </div>
      {!fb ? <button onClick={() => setFb(true)} className="mt-3 rounded-lg border px-3 py-1.5 text-sm font-semibold text-primary hover:bg-accent">Record outcome</button> : <FeedbackForm solution={solution} onDone={() => setFb(false)} />}
    </div>
  );
}

function IssueDetail() {
  const { id } = Route.useParams();
  const { from } = Route.useSearch();
  const { data } = useKB();
  const issue = data.issues.find((i) => i.issueId === id);
  useEffect(() => { if (issue) recordView(issue.issueId); }, [issue?.issueId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!issue) return <Empty title={`Issue ${id} not found`}><Link to="/knowledge" className="text-primary">Back to Knowledge Base</Link></Empty>;

  let backSearch: Record<string, string> = {};
  try { backSearch = from ? JSON.parse(from) : {}; } catch { /* ignore */ }
  const sols = data.solutions.filter((s) => s.issueId === id).map((s) => solutionStats(s, data.attempts)).sort((a, b) => b.score - a.score);
  const related = findSimilar(`${issue.title} ${issue.category} ${issue.errorMessage}`, data, id, 4);
  const sameCat = data.issues.filter((i) => i.category === issue.category && i.issueId !== id && !related.some((r) => r.issue.issueId === i.issueId)).slice(0, 3);
  const history = data.audit.filter((a) => a.recordId === id || sols.some((s) => s.solution.solutionId === a.recordId)).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link to="/knowledge" search={backSearch} className="flex items-center gap-1 text-sm font-semibold text-primary"><ArrowLeft className="h-4 w-4" />Back to results</Link>
        <div className="flex gap-2">
          <Link to="/assistant" search={{ issue: id }} className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-sm font-bold text-navy-foreground"><Bot className="h-4 w-4" />Ask AI about this</Link>
          <Link to="/issues/new" search={{ edit: id }} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold hover:bg-muted"><Pencil className="h-4 w-4" />Edit</Link>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{issue.issueId}{issue.ticketReference && ` · ${issue.ticketReference}`}</span>
          <Pill>{issue.category}</Pill><Pill>{issue.knowledgeStatus}</Pill><Pill>{issue.importance}</Pill><Pill>{issue.frequency}</Pill>
        </div>
        <h1 className="mt-2 text-2xl font-extrabold text-navy">{issue.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{issue.description}</p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel>
            <Section title="Symptoms & error message">
              {issue.errorMessage && <pre className="mb-2 whitespace-pre-wrap rounded-md bg-navy p-3 font-mono text-xs text-navy-foreground">{issue.errorMessage}</pre>}
              <Txt v={issue.symptoms} />
            </Section>
            <Section title="Environment"><Txt v={issue.environment} /></Section>
            <Section title={`Root cause — ${issue.rootCauseConfidence}`}>
              {issue.rootCauseConfidence !== "Confirmed" && <p className="mb-1 text-xs font-semibold text-warning-foreground">⚠ This root cause is {issue.rootCauseConfidence.toLowerCase()} — not confirmed.</p>}
              <Txt v={issue.rootCause} />
            </Section>
            <Section title="Investigation performed">
              <Txt v={issue.initialObservations} />
              {issue.troubleshootingSteps.length > 0 && <ol className="mt-2 list-decimal space-y-1 pl-5">{issue.troubleshootingSteps.map((s, i) => <li key={i}>{s}</li>)}</ol>}
              {issue.checksPerformed && <p className="mt-2"><b>Checks:</b> {issue.checksPerformed}</p>}
            </Section>
            <Section title="Failed approaches"><Txt v={issue.failedAttempts} /></Section>
          </Panel>
          <h2 className="pt-2 text-lg font-extrabold text-navy">Available solutions ({sols.length})</h2>
          {sols.map((s, i) => <SolutionCard key={s.solution.solutionId} solution={s.solution} rank={i + 1} />)}
          {!sols.length && <Empty title="No solutions documented yet"><Link to="/issues/new" search={{ edit: id }} className="text-primary">Add a solution</Link></Empty>}
        </div>
        <div className="space-y-4">
          <Panel title="Contributor & history">
            <p className="text-sm"><b>{issue.contributor}</b></p>
            <p className="text-xs text-muted-foreground">Created {new Date(issue.createdAt).toLocaleDateString()} · Updated {new Date(issue.updatedAt).toLocaleDateString()}</p>
            <ul className="mt-3 space-y-2 text-xs">
              {history.map((h) => <li key={h.eventId} className="border-l-2 border-primary/30 pl-2"><b>{h.changedBy}</b> — {h.summary}<div className="text-muted-foreground">{new Date(h.timestamp).toLocaleString()}</div></li>)}
              {!history.length && <li className="text-muted-foreground">No revisions recorded.</li>}
            </ul>
          </Panel>
          <Panel title="Related & possible duplicates">
            <ul className="space-y-2 text-sm">
              {[...related.map((r) => r.issue), ...sameCat].map((r) => (
                <li key={r.issueId}><Link to="/issues/$id" params={{ id: r.issueId }} className="block hover:text-primary"><span className="font-mono text-[11px] text-muted-foreground">{r.issueId}</span><div className="font-semibold leading-snug">{r.title}</div></Link></li>
              ))}
              {!related.length && !sameCat.length && <li className="text-muted-foreground">None found.</li>}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
