import { afterEach, it, expect, vi } from "vitest";
import { apiRequest, ApiError } from "../lib/api-client";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("sends a same-origin uncached request and returns the response", async () => {
  const mock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
  vi.stubGlobal("fetch", mock);
  expect(await apiRequest("login", { demo: true })).toEqual({ ok: true });
  expect(mock).toHaveBeenCalledWith(
    "/api/login",
    expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ demo: true }),
    }),
  );
});
it("preserves an API error and status so rejected sessions can be handled", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ error: "Жүйеге кіріңіз" }, { status: 401 }),
      ),
  );
  await expect(apiRequest("state")).rejects.toMatchObject({
    status: 401,
    message: "Жүйеге кіріңіз",
  });
});
it("translates a non-JSON gateway error instead of exposing a parsing exception", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("<h1>Gateway Timeout</h1>", { status: 504 }),
      ),
  );
  await expect(apiRequest("login", {})).rejects.toMatchObject({
    status: 504,
    message: expect.stringContaining("Серверден дұрыс жауап"),
  });
});
it("rejects malformed successful responses", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(null)));
  await expect(apiRequest("state")).rejects.toBeInstanceOf(ApiError);
});
it("stops stalled requests and never automatically repeats a POST", async () => {
  vi.useFakeTimers();
  const mock = vi.fn(
    (_url: string, options: RequestInit) =>
      new Promise((_resolve, reject) =>
        options.signal!.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        ),
      ),
  );
  vi.stubGlobal("fetch", mock);
  const result = expect(
    apiRequest("login", {}, { timeoutMs: 100 }),
  ).rejects.toThrow("күту уақыты аяқталды");
  await vi.advanceTimersByTimeAsync(101);
  await result;
  expect(mock).toHaveBeenCalledTimes(1);
});
it("supports cancelling a previous session request", async () => {
  const controller = new AbortController();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url: string, options: RequestInit) =>
        new Promise((_resolve, reject) =>
          options.signal!.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          ),
        ),
    ),
  );
  const result = expect(
    apiRequest("state", undefined, { signal: controller.signal }),
  ).rejects.toThrow("Сұрау тоқтатылды");
  controller.abort();
  await result;
});
it("translates network failures to a useful message", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
  );
  await expect(apiRequest("login", {})).rejects.toThrow(
    "Серверге қосылу мүмкін болмады",
  );
});
