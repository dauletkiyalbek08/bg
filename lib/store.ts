import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  readNetlifySnapshot,
  commitNetlifySnapshot,
  type NetlifySnapshot,
} from "./netlify-store";
import type { Kind, EntityMap } from "./types";
type RecordRow = {
  kind: Kind;
  id: string;
  data: EntityMap[Kind];
  revision: number;
};
type Write = {
  kind: Kind;
  id: string;
  data: EntityMap[Kind] | null;
  expected: number;
};
const globals = globalThis as unknown as { bagdarDb?: DatabaseSync };
const backend = () =>
  process.env.BAGDAR_BACKEND || process.env.BAGDAR_DEFAULT_BACKEND || "sqlite";
export const isSupabase = () => backend() === "supabase";
export const isNetlify = () => backend() === "netlify";
export const demoEnabled = () =>
  !isSupabase() &&
  ((process.env.BAGDAR_MODE || process.env.BAGDAR_DEFAULT_MODE) === "demo" ||
    process.env.NODE_ENV !== "production");
export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase баптауы толық емес");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
function db() {
  if (!globals.bagdarDb) {
    if (
      process.env.NODE_ENV === "production" &&
      !demoEnabled() &&
      !isSupabase()
    )
      throw new Error("Жұмыс режимінде Supabase қосылуы қажет");
    const dir = process.env.BAGDAR_DATA_DIR || join(process.cwd(), ".data");
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const d = new DatabaseSync(join(dir, "bagdar.sqlite"));
    d.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(kind,id));",
    );
    globals.bagdarDb = d;
  }
  return globals.bagdarDb;
}
export class Store {
  private netlifySnapshot: NetlifySnapshot | undefined;
  private rollbacks: (() => Promise<void>)[] = [];
  onRollback(fn: () => Promise<void>) {
    this.rollbacks.push(fn);
  }
  async rollbackExternal() {
    for (const rollback of this.rollbacks.reverse()) {
      try {
        await rollback();
      } catch {
        console.error(
          "External account cleanup failed; reconciliation required",
        );
      }
    }
  }
  private rows = new Map<Kind, Map<string, RecordRow>>();
  private changes = new Map<string, Write>();
  async all<K extends Kind>(kind: K): Promise<EntityMap[K][]> {
    if (!this.rows.has(kind)) {
      let rows: RecordRow[];
      if (isSupabase()) {
        rows = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await adminClient()
            .from("bagdar_records")
            .select("kind,id,data,revision")
            .eq("kind", kind)
            .order("id")
            .range(offset, offset + 499);
          if (error) throw new Error("Дерекқор сұрауы орындалмады");
          rows.push(...(data as RecordRow[]));
          if (data.length < 500) break;
        }
      } else if (isNetlify()) {
        this.netlifySnapshot ||= await readNetlifySnapshot();
        rows = Object.values(this.netlifySnapshot.rows).filter(
          (row) => row.kind === kind,
        );
      } else
        rows = (
          db()
            .prepare("SELECT * FROM records WHERE kind=?")
            .all(kind) as unknown as {
            kind: Kind;
            id: string;
            data: string;
            revision: number;
          }[]
        ).map((r) => ({ ...r, data: JSON.parse(r.data) }));
      this.rows.set(kind, new Map(rows.map((r) => [r.id, r])));
    }
    return [...this.rows.get(kind)!.values()].map(
      (r) => structuredClone(r.data) as EntityMap[K],
    );
  }
  async get<K extends Kind>(
    kind: K,
    id: string,
  ): Promise<EntityMap[K] | undefined> {
    return (await this.all(kind)).find((r) => r.id === id);
  }
  async put<K extends Kind>(kind: K, value: EntityMap[K]) {
    await this.all(kind);
    const key = kind + ":" + value.id;
    const old = this.rows.get(kind)!.get(value.id);
    const previous = this.changes.get(key);
    this.changes.set(key, {
      kind,
      id: value.id,
      data: structuredClone(value),
      expected: previous?.expected ?? old?.revision ?? 0,
    });
    this.rows.get(kind)!.set(value.id, {
      kind,
      id: value.id,
      data: structuredClone(value),
      revision: old?.revision ?? 0,
    });
  }
  async delete(kind: Kind, id: string) {
    await this.all(kind);
    const row = this.rows.get(kind)!.get(id);
    if (!row) return;
    const key = kind + ":" + id;
    this.changes.set(key, {
      kind,
      id,
      data: null,
      expected: this.changes.get(key)?.expected ?? row.revision,
    });
    this.rows.get(kind)!.delete(id);
  }
  async commit() {
    const writes = [...this.changes.values()];
    if (!writes.length) return;
    if (isSupabase()) {
      const { error } = await adminClient().rpc("bagdar_commit", { writes });
      if (error)
        throw new Error(
          error.message.includes("conflict")
            ? "Дерек өзгерді. Бетті жаңартыңыз"
            : "Өзгерістер сақталмады",
        );
      return;
    }
    if (isNetlify()) {
      this.netlifySnapshot ||= await readNetlifySnapshot();
      await commitNetlifySnapshot(this.netlifySnapshot, writes);
      return;
    }
    const d = db();
    d.exec("BEGIN IMMEDIATE");
    try {
      for (const w of writes) {
        const old = d
          .prepare("SELECT revision FROM records WHERE kind=? AND id=?")
          .get(w.kind, w.id) as { revision: number } | undefined;
        if ((old?.revision ?? 0) !== w.expected)
          throw new Error("Дерек өзгерді. Бетті жаңартыңыз");
        if (w.data)
          d.prepare(
            "INSERT INTO records(kind,id,data,revision) VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data,revision=excluded.revision",
          ).run(w.kind, w.id, JSON.stringify(w.data), w.expected + 1);
        else
          d.prepare("DELETE FROM records WHERE kind=? AND id=?").run(
            w.kind,
            w.id,
          );
      }
      d.exec("COMMIT");
    } catch (e) {
      d.exec("ROLLBACK");
      throw e;
    }
  }
}
let tail: Promise<unknown> = Promise.resolve();
export async function transaction<T>(fn: (s: Store) => Promise<T>): Promise<T> {
  const run = tail.then(async () => {
    const s = new Store();
    try {
      const result = await fn(s);
      await s.commit();
      return result;
    } catch (e) {
      await s.rollbackExternal();
      throw e;
    }
  });
  tail = run.catch(() => {});
  return run;
}
