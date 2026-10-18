import { Link } from "@tanstack/react-router";
import { AlertTriangle, Database, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useKB } from "@/hooks/use-kb";

const tone: Record<string, string> = {
  Critical: "bg-destructive/10 text-destructive border-destructive/20",
  Important: "bg-warning/15 text-warning-foreground border-warning/30",
  Normal: "bg-muted text-muted-foreground border-border",
  Verified: "bg-success/10 text-success border-success/25",
  "Pending Verification": "bg-warning/15 text-warning-foreground border-warning/30",
  Draft: "bg-muted text-muted-foreground border-border",
  Retired: "bg-muted text-muted-foreground border-border line-through",
  Confirmed: "bg-success/10 text-success border-success/25",
  Suspected: "bg-warning/15 text-warning-foreground border-warning/30",
  Unknown: "bg-muted text-muted-foreground border-border",
  Recurring: "bg-primary/10 text-primary border-primary/20",
  Regular: "bg-accent text-accent-foreground border-border",
  Unique: "bg-muted text-muted-foreground border-border",
  Worked: "bg-success/10 text-success border-success/25",
  "Partially Worked": "bg-warning/15 text-warning-foreground border-warning/30",
  "Did Not Work": "bg-destructive/10 text-destructive border-destructive/20",
};

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  const key = typeof children === "string" ? children : "";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", tone[key] ?? "bg-secondary text-secondary-foreground border-border", className)}>
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Panel({ title, children, className, action }: { title?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn("rounded-xl border bg-card p-5 shadow-card", className)}>
      {title && (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy/80">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function DataState({ children }: { children: ReactNode }) {
  const { loading, error, refetch, isDemo } = useKB();
  if (loading)
    return (
      <div className="flex items-center gap-2 p-10 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading records{isDemo ? "" : " from Google Sheets"}…
      </div>
    );
  if (error)
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <div className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" /> Could not load records</div>
        <p className="mt-2 text-sm text-foreground">{error.message}</p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => refetch()} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">Retry</button>
          <Link to="/settings" className="rounded-md border px-3 py-1.5 text-sm font-semibold">Open Settings</Link>
        </div>
      </div>
    );
  return <>{children}</>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed bg-panel p-8 text-center">
      <Database className="mx-auto h-6 w-6 text-muted-foreground" />
      <p className="mt-2 font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function DemoNote() {
  const { isDemo } = useKB();
  if (!isDemo) return null;
  return <span className="ml-2 rounded bg-warning/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-warning-foreground">Illustrative</span>;
}
