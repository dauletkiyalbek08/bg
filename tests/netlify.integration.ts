import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { BlobsServer } from "@netlify/blobs/server";
import { setEnvironmentContext, getStore } from "@netlify/blobs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import {
  readNetlifySnapshot,
  commitNetlifySnapshot,
  materialStore,
} from "../lib/netlify-store";
import { Store, transaction } from "../lib/store";
import { ensureSeed } from "../lib/seed";
let server: BlobsServer, directory: string;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "bagdar-netlify-"));
  const token = randomBytes(32).toString("hex");
  server = new BlobsServer({ directory, token, logger: () => {} });
  const address = await server.start();
  setEnvironmentContext({
    edgeURL: `http://localhost:${address.port}`,
    uncachedEdgeURL: `http://localhost:${address.port}`,
    siteID: "bagdar-tests",
    token,
  });
  // BlobsServer 11.1.7 omits ETag on GET, although the cloud API returns it.
  // Supply the emulator's own ETag from LIST, preserving actual conditional PUT checks.
  const nativeFetch = globalThis.fetch.bind(globalThis);
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const response = await nativeFetch(input, init);
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const method =
      init?.method || (input instanceof Request ? input.method : "GET");
    if (
      method.toUpperCase() === "GET" &&
      new URL(url).pathname.endsWith("/database") &&
      response.status === 200 &&
      !response.headers.has("etag")
    ) {
      const listing = await getStore({
        name: "bagdar-demo-v1",
        consistency: "strong",
      }).list();
      const etag = listing.blobs.find((blob) => blob.key === "database")?.etag;
      if (!etag) throw new Error("Local emulator did not provide its ETag");
      const headers = new Headers(response.headers);
      headers.set("etag", etag);
      return new Response(response.body, { status: response.status, headers });
    }
    return response;
  });
  process.env.BAGDAR_BACKEND = "netlify";
  process.env.BAGDAR_MODE = "demo";
});
afterAll(async () => {
  delete process.env.BAGDAR_BACKEND;
  delete process.env.BAGDAR_MODE;
  vi.restoreAllMocks();
  await server.stop();
  await rm(directory, { recursive: true, force: true });
});
it("initializes a persistent demo without local SQLite files", async () => {
  await ensureSeed();
  const store = new Store();
  expect((await store.all("questions")).length).toBe(300);
  expect((await store.all("careers")).length).toBe(100);
  expect((await store.all("users")).length).toBe(11);
  const snapshot = await readNetlifySnapshot();
  expect(snapshot.etag).toBeTruthy();
  expect(Object.keys(snapshot.rows).length).toBeGreaterThan(400);
});
it("commits sessions across separate Store instances", async () => {
  await transaction(async (store) => {
    await store.put("sessions", {
      id: "test-session",
      userId: "student05",
      expires: Date.now() + 60000,
    });
  });
  expect((await new Store().get("sessions", "test-session"))?.userId).toBe(
    "student05",
  );
});
it("rejects stale snapshots atomically, including unrelated writes", async () => {
  const first = await readNetlifySnapshot(),
    second = await readNetlifySnapshot();
  const org = first.rows["organizations:demo-school"];
  await commitNetlifySnapshot(first, [
    {
      kind: "organizations",
      id: org.id,
      expected: org.revision,
      data: { ...org.data, name: "Updated school" } as typeof org.data,
    },
  ]);
  await expect(
    commitNetlifySnapshot(second, [
      {
        kind: "organizations",
        id: org.id,
        expected: org.revision,
        data: org.data,
      },
      {
        kind: "sessions",
        id: "must-not-exist",
        expected: 0,
        data: { id: "must-not-exist", userId: "student05", expires: 100 },
      },
    ]),
  ).rejects.toThrow("Дерек өзгерді");
  expect(await new Store().get("sessions", "must-not-exist")).toBeUndefined();
});
it("stores private material bytes independently of the function filesystem", async () => {
  const bytes = new Blob(["%PDF-1.7\nDemo"]);
  await materialStore().set("test-material", bytes);
  const received = await materialStore().get("test-material", {
    type: "arrayBuffer",
  });
  expect(Buffer.from(received).toString()).toBe("%PDF-1.7\nDemo");
  await materialStore().delete("test-material");
  expect(await materialStore().get("test-material")).toBeNull();
});
