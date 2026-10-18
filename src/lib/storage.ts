import { useSyncExternalStore } from "react";
import { seedData } from "./seed";
import { sheetsLoad, sheetsUpsert } from "./sheets.functions";
import type { SheetTab } from "./sheets-schema";
import type { AuditEvent, DataSource, Issue, KnowledgeData, Solution, SolutionAttempt } from "./types";

/* ---------------- config (data source) ---------------- */
export interface StorageConfig {
  source: DataSource;
  spreadsheetId: string | null;
  spreadsheetTitle: string | null;
  lastTestAt: string | null;
}
const CFG_KEY = "kb-storage-config";
const DEFAULT_CFG: StorageConfig = { source: "demo", spreadsheetId: null, spreadsheetTitle: null, lastTestAt: null };
let cfgCache: StorageConfig | null = null;
const listeners = new Set<() => void>();

function readCfg(): StorageConfig {
  if (cfgCache) return cfgCache;
  try {
    cfgCache = { ...DEFAULT_CFG, ...JSON.parse(localStorage.getItem(CFG_KEY) || "{}") };
  } catch {
    cfgCache = DEFAULT_CFG;
  }
  return cfgCache!;
}
export function setConfig(patch: Partial<StorageConfig>) {
  cfgCache = { ...readCfg(), ...patch };
  localStorage.setItem(CFG_KEY, JSON.stringify(cfgCache));
  listeners.forEach((l) => l());
}
export function useStorageConfig(): StorageConfig {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    readCfg,
    () => DEFAULT_CFG,
  );
}
export function getConfig() {
  return readCfg();
}

/* ---------------- provider interface ---------------- */
export interface StorageProvider {
  load(): Promise<KnowledgeData>;
  upsert(tab: SheetTab, record: object): Promise<void>;
}

const DEMO_KEY = "kb-demo-data-v1";
export const demoProvider: StorageProvider = {
  async load() {
    try {
      const raw = localStorage.getItem(DEMO_KEY);
      if (raw) return JSON.parse(raw) as KnowledgeData;
    } catch {
      /* fallthrough */
    }
    const d = seedData();
    localStorage.setItem(DEMO_KEY, JSON.stringify(d));
    return d;
  },
  async upsert(tab, record) {
    const d = await demoProvider.load();
    const map: Record<SheetTab, [keyof KnowledgeData, string]> = {
      Issues: ["issues", "issueId"],
      Solutions: ["solutions", "solutionId"],
      SolutionAttempts: ["attempts", "attemptId"],
      AuditLog: ["audit", "eventId"],
    };
    const [key, idKey] = map[tab];
    const list = d[key] as unknown as Record<string, unknown>[];
    const rec = record as Record<string, unknown>;
    const i = list.findIndex((r) => r[idKey] === rec[idKey]);
    if (i >= 0) list[i] = rec;
    else list.push(rec);
    localStorage.setItem(DEMO_KEY, JSON.stringify(d));
  },
};
export function resetDemoData() {
  localStorage.removeItem(DEMO_KEY);
}

export function sheetsProvider(spreadsheetId: string): StorageProvider {
  return {
    async load() {
      const r = await sheetsLoad({ data: { spreadsheetId } });
      if (!r.ok) throw new Error(r.error);
      const d = JSON.parse(r.data);
      return {
        issues: d.Issues as unknown as Issue[],
        solutions: d.Solutions as unknown as Solution[],
        attempts: d.SolutionAttempts as unknown as SolutionAttempt[],
        audit: d.AuditLog as unknown as AuditEvent[],
      };
    },
    async upsert(tab, record) {
      const r = await sheetsUpsert({ data: { spreadsheetId, tab, record: record as never } });
      if (!r.ok) throw new Error(r.error);
    },
  };
}

export function getProvider(cfg: StorageConfig): StorageProvider {
  if (cfg.source === "sheets" && cfg.spreadsheetId) return sheetsProvider(cfg.spreadsheetId);
  return demoProvider;
}
