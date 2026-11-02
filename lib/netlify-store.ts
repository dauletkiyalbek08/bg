import { getStore } from "@netlify/blobs";
import type { EntityMap, Kind } from "./types";
export interface NetlifyRow {
  kind: Kind;
  id: string;
  data: EntityMap[Kind];
  revision: number;
}
export interface NetlifyWrite {
  kind: Kind;
  id: string;
  data: EntityMap[Kind] | null;
  expected: number;
}
export interface NetlifySnapshot {
  rows: Record<string, NetlifyRow>;
  etag?: string;
}
const records = () =>
  getStore({ name: "bagdar-demo-v1", consistency: "strong" });
export const materialStore = () =>
  getStore({ name: "bagdar-demo-materials-v1", consistency: "strong" });
export async function readNetlifySnapshot(): Promise<NetlifySnapshot> {
  const saved = await records().getWithMetadata("database", {
    type: "json",
    consistency: "strong",
  });
  if (!saved) return { rows: {} };
  if (
    !saved.etag ||
    !saved.data ||
    saved.data.schema !== 1 ||
    typeof saved.data.rows !== "object"
  )
    throw new Error("Демо дерекқорының нұсқасы қолдау таппады");
  return { rows: saved.data.rows, etag: saved.etag };
}
export async function commitNetlifySnapshot(
  snapshot: NetlifySnapshot,
  writes: NetlifyWrite[],
) {
  const rows = structuredClone(snapshot.rows);
  for (const w of writes) {
    const key = w.kind + ":" + w.id;
    if ((rows[key]?.revision || 0) !== w.expected)
      throw new Error("Дерек өзгерді. Бетті жаңартыңыз");
    if (w.data)
      rows[key] = {
        kind: w.kind,
        id: w.id,
        data: w.data,
        revision: w.expected + 1,
      };
    else delete rows[key];
  }
  const result = await records().setJSON(
    "database",
    { schema: 1, rows },
    snapshot.etag ? { onlyIfMatch: snapshot.etag } : { onlyIfNew: true },
  );
  if (!result.modified) throw new Error("Дерек өзгерді. Бетті жаңартыңыз");
}
