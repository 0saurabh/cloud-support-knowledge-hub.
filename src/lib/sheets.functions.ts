import { createServerFn } from "@tanstack/react-start";
import { SHEET_TABS, colLetter, fromRow, toRow, type SheetTab } from "./sheets-schema";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";
const TABS = Object.keys(SHEET_TABS) as SheetTab[];

class SheetsError extends Error {}

function keys() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const conn = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!lovable || !conn) {
    throw new SheetsError("NOT_CONFIGURED: Google Sheets is not connected to this project yet.");
  }
  return { lovable, conn };
}

async function gw(path: string, init?: RequestInit) {
  const { lovable, conn } = keys();
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${lovable}`,
      "X-Connection-Api-Key": conn,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Sheets request failed [${res.status}]: ${body}`);
    let msg = body;
    try {
      msg = JSON.parse(body)?.error?.message ?? body;
    } catch {
      /* keep raw */
    }
    const hint =
      res.status === 403 ? " (permission denied — make sure the connected Google account can edit this spreadsheet)" :
      res.status === 404 ? " (spreadsheet not found — check the URL)" :
      res.status === 429 ? " (rate limited — wait a minute and try again)" : "";
    throw new SheetsError(`Google Sheets error ${res.status}: ${msg}${hint}`);
  }
  return res.json();
}

const idInput = (d: { spreadsheetId: string }) => {
  if (!d?.spreadsheetId || !/^[a-zA-Z0-9-_]{20,}$/.test(d.spreadsheetId)) throw new Error("Invalid spreadsheet ID");
  return d;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string; notConfigured?: boolean };
async function wrap<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg.replace("NOT_CONFIGURED: ", ""), notConfigured: msg.startsWith("NOT_CONFIGURED") };
  }
}

export const sheetsStatus = createServerFn({ method: "GET" }).handler(async () => ({
  connectorLinked: Boolean(process.env["GOOGLE_SHEETS_API_KEY"] && process.env["LOVABLE_API_KEY"]),
}));

export const sheetsTest = createServerFn({ method: "POST" })
  .inputValidator(idInput)
  .handler(async ({ data }) =>
    wrap(async () => {
      const meta = await gw(`/spreadsheets/${data.spreadsheetId}?fields=properties.title,sheets.properties.title`);
      const existing: string[] = (meta.sheets ?? []).map((s: { properties: { title: string } }) => s.properties.title);
      const missingTabs = TABS.filter((t) => !existing.includes(t));
      const headerProblems: string[] = [];
      const present = TABS.filter((t) => existing.includes(t));
      if (present.length) {
        const q = present.map((t) => `ranges=${t}!1:1`).join("&");
        const hv = await gw(`/spreadsheets/${data.spreadsheetId}/values:batchGet?${q}`);
        present.forEach((t, i) => {
          const got: string[] = hv.valueRanges?.[i]?.values?.[0] ?? [];
          const need = SHEET_TABS[t];
          const missing = need.filter((c) => !got.includes(c));
          if (missing.length) headerProblems.push(`${t}: missing ${missing.join(", ")}`);
        });
      }
      return { title: meta.properties?.title as string, missingTabs, headerProblems };
    }),
  );

export const sheetsSetupTabs = createServerFn({ method: "POST" })
  .inputValidator(idInput)
  .handler(async ({ data }) =>
    wrap(async () => {
      const meta = await gw(`/spreadsheets/${data.spreadsheetId}?fields=sheets.properties.title`);
      const existing: string[] = (meta.sheets ?? []).map((s: { properties: { title: string } }) => s.properties.title);
      const toAdd = TABS.filter((t) => !existing.includes(t));
      if (toAdd.length) {
        await gw(`/spreadsheets/${data.spreadsheetId}:batchUpdate`, {
          method: "POST",
          body: JSON.stringify({ requests: toAdd.map((title) => ({ addSheet: { properties: { title } } })) }),
        });
      }
      await gw(`/spreadsheets/${data.spreadsheetId}/values:batchUpdate`, {
        method: "POST",
        body: JSON.stringify({
          valueInputOption: "RAW",
          data: TABS.map((t) => ({ range: `${t}!A1:${colLetter(SHEET_TABS[t].length - 1)}1`, values: [SHEET_TABS[t]] })),
        }),
      });
      return { created: toAdd };
    }),
  );

export const sheetsLoad = createServerFn({ method: "POST" })
  .inputValidator(idInput)
  .handler(async ({ data }) =>
    wrap(async () => {
      const q = TABS.map((t) => `ranges=${t}!A:Z`).join("&");
      const res = await gw(`/spreadsheets/${data.spreadsheetId}/values:batchGet?${q}`);
      const out: Record<string, Record<string, unknown>[]> = {};
      TABS.forEach((t, i) => {
        const rows: string[][] = res.valueRanges?.[i]?.values ?? [];
        const [headers = [], ...body] = rows;
        out[t] = body.filter((r) => r[0]).map((r) => fromRow(t, headers, r));
      });
      return JSON.stringify(out);
    }),
  );

type WriteInput = { spreadsheetId: string; tab: SheetTab; record: Record<string, string | number | boolean | null | string[]> };
const writeInput = (d: WriteInput) => {
  idInput(d);
  if (!TABS.includes(d.tab)) throw new Error("Invalid tab");
  if (!d.record || typeof d.record !== "object") throw new Error("Invalid record");
  return d;
};

async function findRow(spreadsheetId: string, tab: SheetTab, id: string) {
  const res = await gw(`/spreadsheets/${spreadsheetId}/values/${tab}!A:A`);
  const col: string[][] = res.values ?? [];
  const idx = col.findIndex((r) => r[0] === id);
  return idx; // 0-based; header is 0
}

export const sheetsUpsert = createServerFn({ method: "POST" })
  .inputValidator(writeInput)
  .handler(async ({ data }) =>
    wrap(async () => {
      const { spreadsheetId, tab, record } = data;
      const idKey = SHEET_TABS[tab][0];
      const id = String(record[idKey] ?? "");
      if (!id) throw new SheetsError("Record is missing its ID");
      const row = toRow(tab, record);
      const last = colLetter(row.length - 1);
      const idx = await findRow(spreadsheetId, tab, id);
      if (idx > 0) {
        await gw(`/spreadsheets/${spreadsheetId}/values/${tab}!A${idx + 1}:${last}${idx + 1}?valueInputOption=RAW`, {
          method: "PUT",
          body: JSON.stringify({ values: [row] }),
        });
        return { action: "updated" as const };
      }
      await gw(`/spreadsheets/${spreadsheetId}/values/${tab}!A:${last}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: "POST",
        body: JSON.stringify({ values: [row] }),
      });
      return { action: "created" as const };
    }),
  );
