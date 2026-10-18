// Local (this browser) usage tracking: issue views and searches. Not ticket data.
const VIEWS = "kb-usage-views";
const SEARCHES = "kb-usage-searches";

function read<T>(k: string, d: T): T {
  try { return JSON.parse(localStorage.getItem(k) || "") as T; } catch { return d; }
}
export function recordView(issueId: string) {
  const v = read<Record<string, number>>(VIEWS, {});
  v[issueId] = (v[issueId] ?? 0) + 1;
  localStorage.setItem(VIEWS, JSON.stringify(v));
}
export function getViews(): Record<string, number> { return read(VIEWS, {}); }
export function recordSearch(q: string) {
  if (q.trim().length < 3) return;
  const s = read<{ q: string; at: string }[]>(SEARCHES, []);
  s.push({ q: q.trim(), at: new Date().toISOString() });
  localStorage.setItem(SEARCHES, JSON.stringify(s.slice(-500)));
}
export function getSearches() { return read<{ q: string; at: string }[]>(SEARCHES, []); }

// Checklist progress — kept separate from saved articles.
const CK = "kb-checklist";
export function getChecklist(key: string): Record<number, boolean> { return read<Record<string, Record<number, boolean>>>(CK, {})[key] ?? {}; }
export function setChecklist(key: string, v: Record<number, boolean>) {
  const all = read<Record<string, Record<number, boolean>>>(CK, {});
  all[key] = v;
  localStorage.setItem(CK, JSON.stringify(all));
}
