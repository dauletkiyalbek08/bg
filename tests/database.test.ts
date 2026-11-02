import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const pg = new PGlite();
beforeAll(async () => {
  await pg.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;grant usage on schema auth to public;`,
  );
  await pg.exec(await readFile("supabase/migrations/001_bagdar.sql", "utf8"));
}, 30000);
afterAll(() => pg.close());
async function commit(writes: unknown[]) {
  return pg.query("select public.bagdar_commit($1::jsonb)", [
    JSON.stringify(writes),
  ]);
}
describe("PostgreSQL persistence and RLS boundary", () => {
  it("denies anonymous and authenticated direct reads and writes", async () => {
    for (const role of ["anon", "authenticated"]) {
      await pg.exec(`set role ${role}`);
      await expect(
        pg.query("select * from public.bagdar_records"),
      ).rejects.toThrow();
      await expect(
        pg.query(
          "insert into public.bagdar_records(kind,id,data) values('organizations','bad','{}')",
        ),
      ).rejects.toThrow();
      await expect(commit([])).rejects.toThrow();
      await pg.exec("reset role");
    }
  });
  it("commits service-owned data atomically and rejects stale revisions", async () => {
    await pg.exec(
      "set role service_role;set request.jwt.claim.role='service_role'",
    );
    await commit([
      {
        kind: "organizations",
        id: "a",
        expected: 0,
        data: { id: "a", name: "A" },
      },
      {
        kind: "organizations",
        id: "b",
        expected: 0,
        data: { id: "b", name: "B" },
      },
    ]);
    await expect(
      commit([
        {
          kind: "organizations",
          id: "a",
          expected: 0,
          data: { id: "a", name: "Wrong" },
        },
      ]),
    ).rejects.toThrow("conflict");
    const row = await pg.query<{ data: { name: string } }>(
      "select data from public.bagdar_records where kind='organizations' and id='a'",
    );
    expect(row.rows[0].data.name).toBe("A");
    await pg.exec("reset role");
  });
  it("rejects cross-organization references at the database layer", async () => {
    await pg.exec(
      "set role service_role;set request.jwt.claim.role='service_role'",
    );
    await commit([
      {
        kind: "classes",
        id: "a-class",
        expected: 0,
        data: { id: "a-class", org: "a" },
      },
    ]);
    await expect(
      commit([
        {
          kind: "users",
          id: "bad-owner",
          expected: 0,
          data: {
            id: "bad-owner",
            org: "b",
            login: "bad.user",
            classId: "a-class",
          },
        },
      ]),
    ).rejects.toThrow("class organization mismatch");
    const result = await pg.query(
      "select * from public.bagdar_records where id='bad-owner'",
    );
    expect(result.rows).toHaveLength(0);
    await pg.exec("reset role");
  });
  it("enforces organization existence and global login uniqueness", async () => {
    await pg.exec(
      "set role service_role;set request.jwt.claim.role='service_role'",
    );
    await expect(
      commit([
        {
          kind: "classes",
          id: "bad-class",
          expected: 0,
          data: { id: "bad-class", org: "missing" },
        },
      ]),
    ).rejects.toThrow();
    await commit([
      {
        kind: "users",
        id: "one",
        expected: 0,
        data: { id: "one", org: "a", login: "unique.user" },
      },
    ]);
    await expect(
      commit([
        {
          kind: "users",
          id: "two",
          expected: 0,
          data: { id: "two", org: "b", login: "UNIQUE.USER" },
        },
      ]),
    ).rejects.toThrow();
    await pg.exec("reset role");
  });
});
