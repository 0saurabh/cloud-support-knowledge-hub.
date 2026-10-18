import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { BarChart3, Bot, BookOpen, LayoutDashboard, PlusCircle, Search, Settings, Trophy, Cloud } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { useKB } from "@/hooks/use-kb";
import { useStorageConfig } from "@/lib/storage";

const nav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Add New Issue", url: "/issues/new", icon: PlusCircle },
  { title: "Knowledge Base", url: "/knowledge", icon: BookOpen },
  { title: "AI Support Assistant", url: "/assistant", icon: Bot },
  { title: "Solution Rankings", url: "/rankings", icon: Trophy },
  { title: "Categories & Reports", url: "/reports", icon: BarChart3 },
  { title: "Settings / Integrations", url: "/settings", icon: Settings },
] as const;

function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const active = (u: string) => (u === "/" ? path === "/" : path.startsWith(u) || (u === "/knowledge" && path.startsWith("/issues/") && path !== "/issues/new"));
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-sidebar-primary-foreground"><Cloud className="h-4 w-4" /></div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-sm font-extrabold text-sidebar-accent-foreground">Cloud Support</div>
              <div className="text-[11px] text-sidebar-foreground/70">Knowledge Hub</div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((n) => (
                <SidebarMenuItem key={n.url}>
                  <SidebarMenuButton asChild isActive={active(n.url)} tooltip={n.title}>
                    <Link to={n.url}><n.icon className="h-4 w-4" /><span>{n.title}</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {!collapsed && (
        <SidebarFooter>
          <p className="px-2 pb-2 text-[11px] leading-snug text-sidebar-foreground/60">Every Issue Documented. Every Solution Within Reach.</p>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}

function SourceBadge() {
  const { isDemo } = useKB();
  const cfg = useStorageConfig();
  return (
    <Link to="/settings" className={isDemo
      ? "rounded-full border border-warning/40 bg-warning/15 px-3 py-1 text-xs font-bold text-warning-foreground"
      : "rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-bold text-success"}>
      {isDemo ? "DEMO DATA · browser only" : `LIVE · ${cfg.spreadsheetTitle ?? "Google Sheets"}`}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/90 px-3 backdrop-blur">
            <SidebarTrigger />
            <form className="relative max-w-xl flex-1" onSubmit={(e) => { e.preventDefault(); navigate({ to: "/knowledge", search: { q } }); }}>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search issues, errors, root causes…" className="h-9 w-full rounded-lg border bg-panel pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </form>
            <div className="ml-auto"><SourceBadge /></div>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
