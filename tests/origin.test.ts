import { it, expect } from "vitest";
import { isTrustedOrigin } from "../lib/origin";
it("accepts the public HTTPS origin without depending on an internal proxy scheme", () => {
  expect(
    isTrustedOrigin(
      "https://demo.netlify.app",
      "demo.netlify.app",
      undefined,
      false,
    ),
  ).toBe(true);
});
it("rejects cross-site origins, deceptive suffixes, absent and null origins", () => {
  for (const origin of [
    "https://evil.test",
    "https://demo.netlify.app.evil.test",
    "null",
    null,
  ])
    expect(isTrustedOrigin(origin, "demo.netlify.app", undefined, false)).toBe(
      false,
    );
});
it("rejects insecure remote production origins but permits local development", () => {
  expect(
    isTrustedOrigin(
      "http://demo.netlify.app",
      "demo.netlify.app",
      undefined,
      false,
    ),
  ).toBe(false);
  expect(
    isTrustedOrigin(
      "http://localhost:3000",
      "localhost:3000",
      undefined,
      false,
    ),
  ).toBe(true);
  expect(
    isTrustedOrigin(
      "http://192.168.1.5:3000",
      "192.168.1.5:3000",
      undefined,
      true,
    ),
  ).toBe(true);
});
it("honors a configured canonical origin without trusting other hosts", () => {
  expect(
    isTrustedOrigin(
      "https://bagdar.example",
      "internal.server",
      "https://bagdar.example/",
      false,
    ),
  ).toBe(true);
  expect(
    isTrustedOrigin(
      "https://another.example",
      "another.example",
      "https://bagdar.example",
      false,
    ),
  ).toBe(false);
});
it("rejects malformed origins and origin values containing paths", () => {
  expect(
    isTrustedOrigin(
      "https://demo.netlify.app/evil",
      "demo.netlify.app",
      undefined,
      false,
    ),
  ).toBe(false);
  expect(isTrustedOrigin("broken", "demo.netlify.app", undefined, false)).toBe(
    false,
  );
});
