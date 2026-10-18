import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { DataState, PageHeader, Panel } from "@/components/kb-ui";
import { useKB, useKBMutations } from "@/hooks/use-kb";
import { findSimilar } from "@/lib/search";
import { CATEGORIES, CONFIDENCES, FREQUENCIES, IMPORTANCES, STATUSES, newId, type Issue, type Solution } from "@/lib/types";

export const Route = createFileRoute("/issues/new")({
  validateSearch: (s: Record<string, unknown>): { edit?: string } => (typeof s.edit === "string" ? { edit: s.edit } : {}),
  head: () => ({
    meta: [
      { title: "Add New Issue — Cloud Support Knowledge Hub" },
      { name: "description", content: "Document a support issue with investigation, root cause and ordered solution steps." },
      { property: "og:title", content: "Add New Issue — Cloud Support Knowledge Hub" },
      { property: "og:description", content: "Document a support issue, root cause and solution." },
    ],
  }),
  component: () => <DataState><IssueFormPage /></DataState>,
});

const blankIssue = (): Issue => ({
  issueId: newId("ISS"), title: "", ticketReference: "", description: "", errorMessage: "", symptoms: "",
  category: "Tally on Cloud", environment: "", initialObservations: "", troubleshootingSteps: [""], checksPerformed: "",
  failedAttempts: "", rootCause: "", rootCauseConfidence: "Unknown", frequency: "Regular", importance: "Normal",
  knowledgeStatus: "Draft", contributor: "", createdAt: "", updatedAt: "",
});
const blankSolution = (issueId: string, author: string): Solution => ({
  solutionId: newId("SOL"), issueId, solutionTitle: "", prerequisites: "", orderedSteps: [""], warnings: "",
  rollbackInstructions: "", verificationSteps: "", preventiveActions: "", escalationNotes: "", author,
  verificationStatus: "Draft", createdAt: "", updatedAt: "",
});

const inputCls = "w-full rounded-md border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
function Field({ label, required, error, children, hint }: { label: string; required?: boolean; error?: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-navy/80">{label}{required && <span className="text-destructive"> *</span>}</span>
      <div className="mt-1">{children}</div>
      {hint && !error && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
      {error && <span className="mt-1 block text-[11px] font-semibold text-destructive">{error}</span>}
    </label>
  );
}

function StepList({ steps, onChange, placeholder }: { steps: string[]; onChange: (s: string[]) => void; placeholder: string }) {
  const move = (i: number, d: number) => { const a = [...steps]; [a[i], a[i + d]] = [a[i + d], a[i]]; onChange(a); };
  return (
    <div className="space-y-2">
      {steps.map((st, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-2 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
          <input value={st} onChange={(e) => onChange(steps.map((x, j) => (j === i ? e.target.value : x)))} placeholder={placeholder} className={inputCls} />
          <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="mt-1.5 rounded p-1 hover:bg-muted disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
          <button type="button" aria-label="Move down" disabled={i === steps.length - 1} onClick={() => move(i, 1)} className="mt-1.5 rounded p-1 hover:bg-muted disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
          <button type="button" aria-label="Remove step" disabled={steps.length === 1} onClick={() => onChange(steps.filter((_, j) => j !== i))} className="mt-1.5 rounded p-1 text-destructive hover:bg-destructive/10 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...steps, ""])} className="flex items-center gap-1 text-sm font-semibold text-primary"><Plus className="h-4 w-4" />Add step</button>
    </div>
  );
}

function IssueFormPage() {
  const { edit } = Route.useSearch();
  const { data, isDemo } = useKB();
  const { saveIssue } = useKBMutations();
  const navigate = useNavigate();
  const existing = edit ? data.issues.find((i) => i.issueId === edit) : undefined;

  const [issue, setIssue] = useState<Issue>(blankIssue);
  const [sols, setSols] = useState<Solution[]>(() => [blankSolution(issue.issueId, "")]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (existing) {
      setIssue({ ...existing, troubleshootingSteps: existing.troubleshootingSteps.length ? existing.troubleshootingSteps : [""] });
      const ss = data.solutions.filter((s) => s.issueId === existing.issueId);
      setSols(ss.length ? ss.map((s) => ({ ...s, orderedSteps: s.orderedSteps.length ? s.orderedSteps : [""] })) : [blankSolution(existing.issueId, existing.contributor)]);
    }
  }, [existing?.issueId]); // eslint-disable-line react-hooks/exhaustive-deps

  const up = <K extends keyof Issue>(k: K, v: Issue[K]) => setIssue((p) => ({ ...p, [k]: v }));
  const upSol = (i: number, patch: Partial<Solution>) => setSols((p) => p.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const similar = useMemo(() => findSimilar(`${issue.title} ${issue.errorMessage}`, data, issue.issueId), [issue.title, issue.errorMessage, data, issue.issueId]);

  const reset = () => {
    const b = blankIssue();
    setIssue(b);
    setSols([blankSolution(b.issueId, "")]);
    setErrors({});
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (issue.title.trim().length < 8) e.title = "Enter a descriptive title (at least 8 characters).";
    if (!issue.description.trim()) e.description = "Describe the issue.";
    if (!issue.contributor.trim()) e.contributor = "Enter your name.";
    if (issue.rootCauseConfidence !== "Unknown" && !issue.rootCause.trim()) e.rootCause = "Describe the root cause or set confidence to Unknown.";
    if (issue.knowledgeStatus === "Verified" && issue.rootCauseConfidence !== "Confirmed") e.knowledgeStatus = "Only issues with a Confirmed root cause can be marked Verified.";
    sols.forEach((s, i) => {
      const hasSteps = s.orderedSteps.some((x) => x.trim());
      if (s.solutionTitle.trim() && !hasSteps) e[`sol${i}`] = "Add at least one step.";
      if (!s.solutionTitle.trim() && hasSteps) e[`sol${i}`] = "Give this solution a title.";
    });
    if (!existing && data.issues.some((i) => i.issueId === issue.issueId)) e.title = "Duplicate Issue ID — please reset the form.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (submitting) return;
    if (!validate()) { toast.error("Please fix the highlighted fields."); return; }
    setSubmitting(true);
    const now = new Date().toISOString();
    const clean: Issue = { ...issue, troubleshootingSteps: issue.troubleshootingSteps.filter((x) => x.trim()), createdAt: issue.createdAt || now, updatedAt: now };
    const cleanSols = sols.filter((s) => s.solutionTitle.trim()).map((s) => ({ ...s, author: s.author || clean.contributor, orderedSteps: s.orderedSteps.filter((x) => x.trim()), createdAt: s.createdAt || now, updatedAt: now }));
    try {
      await saveIssue.mutateAsync({ issue: clean, solutions: cleanSols, isNew: !existing });
      toast.success(isDemo ? "Saved to DEMO data in this browser only — not Google Sheets." : "Saved to Google Sheets.");
      navigate({ to: "/issues/$id", params: { id: clean.issueId } });
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (edit && !existing) return <p className="text-sm text-muted-foreground">Issue {edit} not found. <Link to="/issues/new" className="text-primary">Create a new one</Link>.</p>;

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader title={existing ? "Edit Issue" : "Add New Issue"} subtitle={`Issue ID: ${issue.issueId}`} actions={
        isDemo ? <span className="rounded-md bg-warning/15 px-3 py-1.5 text-xs font-bold text-warning-foreground">Demo mode — saves stay in this browser</span> : null
      } />

      {similar.length > 0 && (
        <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-warning-foreground"><AlertTriangle className="h-4 w-4" />Possible duplicates found</div>
          <ul className="mt-2 space-y-1 text-sm">
            {similar.map(({ issue: s }) => (
              <li key={s.issueId}><Link to="/issues/$id" params={{ id: s.issueId }} target="_blank" className="font-semibold text-primary hover:underline">{s.issueId} — {s.title}</Link></li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4">
        <Panel title="Issue identification">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Issue title" required error={errors.title}><input className={inputCls} value={issue.title} onChange={(e) => up("title", e.target.value)} /></Field>
            <Field label="Ticket reference"><input className={inputCls} value={issue.ticketReference} onChange={(e) => up("ticketReference", e.target.value)} placeholder="Optional" /></Field>
            <Field label="Category" required>
              <select className={inputCls} value={issue.category} onChange={(e) => up("category", e.target.value as Issue["category"])}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            </Field>
            <Field label="Environment & versions" hint="e.g. Windows Server 2019, TallyPrime 4.1, IIS 10"><input className={inputCls} value={issue.environment} onChange={(e) => up("environment", e.target.value)} /></Field>
            <div className="md:col-span-2"><Field label="Description" required error={errors.description}><textarea rows={3} className={inputCls} value={issue.description} onChange={(e) => up("description", e.target.value)} /></Field></div>
            <Field label="Exact error message"><textarea rows={2} className={`${inputCls} font-mono`} value={issue.errorMessage} onChange={(e) => up("errorMessage", e.target.value)} /></Field>
            <Field label="Customer-reported symptoms"><textarea rows={2} className={inputCls} value={issue.symptoms} onChange={(e) => up("symptoms", e.target.value)} /></Field>
          </div>
        </Panel>

        <Panel title="Investigation">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><Field label="Initial observations"><textarea rows={2} className={inputCls} value={issue.initialObservations} onChange={(e) => up("initialObservations", e.target.value)} /></Field></div>
            <div className="md:col-span-2"><Field label="Major troubleshooting steps (in order)"><StepList steps={issue.troubleshootingSteps} onChange={(v) => up("troubleshootingSteps", v)} placeholder="What did you check or do?" /></Field></div>
            <Field label="Checks performed"><textarea rows={2} className={inputCls} value={issue.checksPerformed} onChange={(e) => up("checksPerformed", e.target.value)} /></Field>
            <Field label="Failed attempts & outcomes"><textarea rows={2} className={inputCls} value={issue.failedAttempts} onChange={(e) => up("failedAttempts", e.target.value)} /></Field>
            <Field label="Root cause" error={errors.rootCause}><textarea rows={2} className={inputCls} value={issue.rootCause} onChange={(e) => up("rootCause", e.target.value)} /></Field>
            <Field label="Root cause confidence">
              <select className={inputCls} value={issue.rootCauseConfidence} onChange={(e) => up("rootCauseConfidence", e.target.value as Issue["rootCauseConfidence"])}>{CONFIDENCES.map((c) => <option key={c}>{c}</option>)}</select>
            </Field>
          </div>
        </Panel>

        {sols.map((s, i) => (
          <Panel key={s.solutionId} title={`Solution ${i + 1}`} action={sols.length > 1 && <button type="button" onClick={() => setSols(sols.filter((_, j) => j !== i))} className="text-xs font-semibold text-destructive">Remove</button>}>
            {errors[`sol${i}`] && <p className="mb-2 text-xs font-semibold text-destructive">{errors[`sol${i}`]}</p>}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Solution title"><input className={inputCls} value={s.solutionTitle} onChange={(e) => upSol(i, { solutionTitle: e.target.value })} /></Field>
              <Field label="Prerequisites"><input className={inputCls} value={s.prerequisites} onChange={(e) => upSol(i, { prerequisites: e.target.value })} /></Field>
              <div className="md:col-span-2"><Field label="Ordered solution steps"><StepList steps={s.orderedSteps} onChange={(v) => upSol(i, { orderedSteps: v })} placeholder="Step instruction" /></Field></div>
              <Field label="Verification steps"><textarea rows={2} className={inputCls} value={s.verificationSteps} onChange={(e) => upSol(i, { verificationSteps: e.target.value })} /></Field>
              <Field label="Preventive recommendations"><textarea rows={2} className={inputCls} value={s.preventiveActions} onChange={(e) => upSol(i, { preventiveActions: e.target.value })} /></Field>
              <Field label="Warnings & risks"><textarea rows={2} className={inputCls} value={s.warnings} onChange={(e) => upSol(i, { warnings: e.target.value })} /></Field>
              <Field label="Rollback instructions"><textarea rows={2} className={inputCls} value={s.rollbackInstructions} onChange={(e) => upSol(i, { rollbackInstructions: e.target.value })} /></Field>
              <div className="md:col-span-2"><Field label="Escalation notes"><textarea rows={2} className={inputCls} value={s.escalationNotes} onChange={(e) => upSol(i, { escalationNotes: e.target.value })} /></Field></div>
            </div>
          </Panel>
        ))}
        <button type="button" onClick={() => setSols([...sols, blankSolution(issue.issueId, issue.contributor)])} className="flex items-center gap-1 rounded-lg border border-dashed px-4 py-2 text-sm font-semibold text-primary hover:bg-accent"><Plus className="h-4 w-4" />Add another solution</button>

        <Panel title="Classification">
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Frequency"><select className={inputCls} value={issue.frequency} onChange={(e) => up("frequency", e.target.value as Issue["frequency"])}>{FREQUENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Importance"><select className={inputCls} value={issue.importance} onChange={(e) => up("importance", e.target.value as Issue["importance"])}>{IMPORTANCES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Knowledge status" error={errors.knowledgeStatus}><select className={inputCls} value={issue.knowledgeStatus} onChange={(e) => up("knowledgeStatus", e.target.value as Issue["knowledgeStatus"])}>{STATUSES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Contributor" required error={errors.contributor}><input className={inputCls} value={issue.contributor} onChange={(e) => up("contributor", e.target.value)} /></Field>
          </div>
          {existing && <p className="mt-3 text-xs text-muted-foreground">Created {new Date(existing.createdAt).toLocaleString()} · Last updated {new Date(existing.updatedAt).toLocaleString()}</p>}
        </Panel>
      </div>

      <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t bg-background/95 py-3 backdrop-blur">
        <button type="button" onClick={reset} className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">Reset form</button>
        <button disabled={submitting} className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">{submitting ? "Saving…" : existing ? "Save changes" : "Save issue"}</button>
      </div>
    </form>
  );
}
