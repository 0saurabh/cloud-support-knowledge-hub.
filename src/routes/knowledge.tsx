import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RotateCcw, Search } from "lucide-react";
import { useEffect, useMemo } from "react";
import { DataState, DemoNote, Empty, PageHeader, Pill } from "@/components/kb-ui";
import { useKB } from "@/hooks/use-kb";
import { issueStats, mins, pct } from "@/lib/metrics";
import { searchIssues } from "@/lib/search";
import { CATEGORIES, FREQUENCIES, IMPORTANCES, STATUSES } from "@/lib/types";
import { recordSearch } from "@/lib/usage";

type KSearch = {
  q?: string; category?: string; frequency?: string; importance?: string; status?: string;
  contributor?: string; outcome?: string; env?: string; since?: string; sort?: string;
};

export const Route = createFileRoute("/knowledge")({
  validateSearch: (s: Record<string, unknown>): KSearch => {
    const out: KSearch = {};
    for (const k of ["q", "category", "frequency", "importance", "status", "contributor", "outcome", "env", "since", "sort"] as const) {
      if (typeof s[k] === "string" && s[k]) out[k] = s[k] as string;
    }
    return out;
  },
  head: () => ({
    meta: [
      { title: "Knowledge Base — Cloud Support Knowledge Hub" },
      { name: "description", content: "Search documented Tally on Cloud, RDP, Windows Server and IIS issues with root causes and solutions." },
      { property: "og:title", content: "Knowledge Base — Cloud Support Knowledge Hub" },
      { property: "og:description", content: "Search documented support issues, root causes and verified solutions." },
    ],
  }),
  component: KnowledgePage,
});

const SORTS = [
  ["relevant", "Most relevant"],
  ["updated", "Recently updated"],
  ["frequent", "Most frequently encountered"],
  ["success", "Highest verified success rate"],
  ["fastest", "Fastest median resolution"],
] as const;

function Select({ label, value, options, onChange }: { label: string; value?: string; options: readonly string[]; onChange: (v?: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground">
      {label}
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)} className="h-9 rounded-md border bg-card px-2 text-sm font-medium text-foreground">
        <option value="">All</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function KnowledgePage() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/knowledge" });
  const { data } = useKB();
  const set = (patch: Partial<KSearch>) => navigate({ search: (prev: KSearch) => ({ ...prev, ...patch }), replace: true });

  useEffect(() => {
    const t = setTimeout(() => s.q && recordSearch(s.q), 1200);
    return () => clearTimeout(t);
  }, [s.q]);

  const contributors = useMemo(() => [...new Set(data.issues.map((i) => i.contributor).filter(Boolean))].sort(), [data]);
  const freqRank = { Recurring: 3, Regular: 2, Unique: 1 } as const;

  const results = useMemo(() => {
    let r = searchIssues(s.q ?? "", data).map((x) => ({ ...x, stats: issueStats(x.issue.issueId, data) }));
    r = r.filter(({ issue: i, stats }) =>
      (!s.category || i.category === s.category) &&
      (!s.frequency || i.frequency === s.frequency) &&
      (!s.importance || i.importance === s.importance) &&
      (!s.status || i.knowledgeStatus === s.status) &&
      (!s.contributor || i.contributor === s.contributor) &&
      (!s.env || i.environment.toLowerCase().includes(s.env.toLowerCase())) &&
      (!s.since || i.updatedAt >= s.since) &&
      (!s.outcome || data.attempts.some((a) => a.issueId === i.issueId && a.outcome === s.outcome)) &&
      (s.outcome !== "No outcomes yet" || stats.attemptCount === 0),
    );
    const sort = s.sort ?? (s.q ? "relevant" : "updated");
    r.sort((a, b) => {
      if (sort === "updated") return b.issue.updatedAt.localeCompare(a.issue.updatedAt);
      if (sort === "frequent") return freqRank[b.issue.frequency] - freqRank[a.issue.frequency] || b.stats.attemptCount - a.stats.attemptCount;
      if (sort === "success") return (b.stats.best?.successRate ?? -1) - (a.stats.best?.successRate ?? -1);
      if (sort === "fastest") return (a.stats.medianMinutes ?? 1e9) - (b.stats.medianMinutes ?? 1e9);
      return b.score - a.score;
    });
    return r;
  }, [s, data]);

  const hasFilters = Object.keys(s).length > 0;

  return (
    <DataState>
      <PageHeader title="Knowledge Base" subtitle={`${results.length} of ${data.issues.length} issues`} actions={<Link to="/issues/new" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Add issue</Link>} />
      <div className="rounded-xl border bg-card p-4 shadow-card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input autoFocus value={s.q ?? ""} onChange={(e) => set({ q: e.target.value || undefined })} placeholder="Search titles, error messages, symptoms, root causes, steps, versions…" className="h-11 w-full rounded-lg border bg-panel pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
          <Select label="Category" value={s.category} options={CATEGORIES} onChange={(v) => set({ category: v })} />
          <Select label="Frequency" value={s.frequency} options={FREQUENCIES} onChange={(v) => set({ frequency: v })} />
          <Select label="Importance" value={s.importance} options={IMPORTANCES} onChange={(v) => set({ importance: v })} />
          <Select label="Status" value={s.status} options={STATUSES} onChange={(v) => set({ status: v })} />
          <Select label="Contributor" value={s.contributor} options={contributors} onChange={(v) => set({ contributor: v })} />
          <Select label="Solution outcome" value={s.outcome} options={["Worked", "Partially Worked", "Did Not Work", "No outcomes yet"]} onChange={(v) => set({ outcome: v })} />
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground">Environment / version
            <input value={s.env ?? ""} onChange={(e) => set({ env: e.target.value || undefined })} placeholder="e.g. 2019, IIS 10" className="h-9 rounded-md border bg-card px-2 text-sm text-foreground" />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground">Updated since
            <input type="date" value={s.since ?? ""} onChange={(e) => set({ since: e.target.value || undefined })} className="h-9 rounded-md border bg-card px-2 text-sm text-foreground" />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground">Sort by
            <select value={s.sort ?? (s.q ? "relevant" : "updated")} onChange={(e) => set({ sort: e.target.value })} className="h-9 rounded-md border bg-card px-2 text-sm font-medium text-foreground">
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {hasFilters && (
            <button onClick={() => navigate({ search: {}, replace: true })} className="flex h-9 items-center justify-center gap-1.5 self-end rounded-md border text-sm font-semibold hover:bg-muted"><RotateCcw className="h-3.5 w-3.5" />Clear</button>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {results.map(({ issue: i, stats }) => (
          <Link key={i.issueId} to="/issues/$id" params={{ id: i.issueId }} search={{ from: JSON.stringify(s) }} className="block rounded-xl border bg-card p-4 shadow-card transition hover:border-primary/50">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">{i.issueId}</span>
              <Pill>{i.category}</Pill><Pill>{i.knowledgeStatus}</Pill><Pill>{i.importance}</Pill><Pill>{i.frequency}</Pill>
            </div>
            <h3 className="mt-2 font-bold text-navy">{i.title}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Root cause ({i.rootCauseConfidence}):</span> {i.rootCause || "Not yet identified."}
            </p>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>{stats.solutions.length} solution(s)</span>
              <span>Best success: <b className="text-foreground">{stats.best ? pct(stats.best.successRate) : "—"}</b>{stats.best && ` (n=${stats.best.attempts})`}</span>
              <span>Median resolution: <b className="text-foreground">{mins(stats.medianMinutes)}</b></span>
              <DemoNote />
            </div>
          </Link>
        ))}
        {!results.length && <Empty title="No matching issues">Try fewer keywords or clear filters. Found a new problem? <Link to="/issues/new" className="font-semibold text-primary">Document it</Link>.</Empty>}
      </div>
    </DataState>
  );
}
