import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import fontkit from "@pdf-lib/fontkit";
import { formatDate } from "../lib/date";
it("all active fonts contain Kazakh characters", () => {
  for (const name of ["Inter", "Montserrat", "Report"]) {
    const font = fontkit.create(readFileSync("public/fonts/" + name + ".ttf"));
    for (const c of "ӘҒҚҢӨҰҮҺІәғқңөұүһі")
      expect(font.hasGlyphForCodePoint(c.codePointAt(0)!)).toBe(true);
  }
});
it("uses Kazakh month names and the Almaty calendar date", () => {
  expect(formatDate("2026-11-02T20:00:00Z", true)).toBe("3 қараша 2026");
});
