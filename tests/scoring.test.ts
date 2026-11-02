import { describe, it, expect } from "vitest";
import { makeQuestions, makeCareers, scales } from "../lib/content";
import { buildTest, calculate, canViewStudent } from "../lib/scoring";
import type { Survey } from "../lib/types";
const bank = makeQuestions(),
  careers = makeCareers();
const survey: Survey = {
  id: "s",
  org: "a",
  owner: "s",
  answers: {},
  complete: true,
  updatedAt: "2026-11-03",
};
describe("content and balanced test", () => {
  it("contains 300 distinct questions with the documented quotas", () => {
    expect(bank.length).toBe(300);
    expect(new Set(bank.map((q) => q.text)).size).toBe(300);
    expect(bank.filter((q) => q.family === "riasec").length).toBe(108);
    expect(bank.filter((q) => q.family === "klimov").length).toBe(96);
    expect(bank.filter((q) => q.family === "skills").length).toBe(96);
  });
  it("contains 100 complete career profiles", () => {
    expect(careers.length).toBe(100);
    expect(new Set(careers.map((c) => c.name)).size).toBe(100);
    for (const c of careers) {
      expect(Object.keys(c.targets).length).toBe(17);
      expect(c.description.length).toBeGreaterThan(20);
    }
  });
  it("balances 36 items across all scales", () => {
    for (let t = 0; t < 20; t++) {
      const qs = buildTest(bank);
      expect(qs.length).toBe(36);
      expect(new Set(qs.map((q) => q.id)).size).toBe(36);
      for (const [family, keys] of Object.entries(scales)) {
        expect(qs.filter((q) => q.family === family).length).toBe(12);
        for (const k of keys)
          expect(qs.filter((q) => q.scale === k).length).toBeGreaterThanOrEqual(
            2,
          );
      }
    }
  });
  it("prefers unused questions and eventually reuses safely", () => {
    const first = buildTest(bank),
      second = buildTest(bank, [first]);
    expect(second.some((q) => first.some((f) => f.id === q.id))).toBe(false);
    const small = first;
    expect(buildTest(small, [first]).length).toBe(36);
  });
  it("rejects insufficient scale coverage", () =>
    expect(() => buildTest(bank.filter((q) => q.scale !== "r"))).toThrow(
      "жеткіліксіз",
    ));
});
describe("scoring invariants", () => {
  it.each([1, 5])("normalizes endpoint %i correctly", (v) => {
    const qs = buildTest(bank),
      answers = Object.fromEntries(qs.map((q) => [q.id, v]));
    const r = calculate(qs, answers, careers, survey);
    expect(
      Object.values(r.scores).every((n) => n === (v === 1 ? 0 : 100)),
    ).toBe(true);
    expect(r.flags).toContain("uniform_responses");
    expect(r.top.length).toBe(5);
  });
  it("rejects incomplete and out-of-range answers", () => {
    const qs = buildTest(bank);
    expect(() => calculate(qs, {}, careers, survey)).toThrow();
    expect(() =>
      calculate(
        qs,
        Object.fromEntries(qs.map((q) => [q.id, 6])),
        careers,
        survey,
      ),
    ).toThrow();
  });
  it("reverse coding changes only its own scale", () => {
    const qs = buildTest(bank),
      answers = Object.fromEntries(qs.map((q) => [q.id, 5]));
    const baseline = calculate(qs, answers, careers, survey);
    const flipped = calculate(
      qs.map((q, i) => ({ ...q, reverse: i === 0 })),
      answers,
      careers,
      survey,
    );
    expect(flipped.scores[qs[0].scale]).toBeLessThan(
      baseline.scores[qs[0].scale],
    );
    for (const k of Object.keys(baseline.scores).filter(
      (k) => k !== qs[0].scale,
    ))
      expect(flipped.scores[k]).toBe(baseline.scores[k]);
  });
  it("is reproducible and does not treat missing timing as cheating", () => {
    const qs = buildTest(bank),
      answers = Object.fromEntries(qs.map((q, i) => [q.id, (i % 5) + 1]));
    const r = calculate(qs, answers, careers, survey);
    expect(r.top).toEqual(calculate(qs, answers, careers, survey).top);
    expect(r.flags).toEqual(["timing_unavailable"]);
  });
  it("limits questionnaire bonus to 5 and indices to 100", () => {
    const qs = buildTest(bank),
      answers = Object.fromEntries(qs.map((q) => [q.id, 4]));
    const r = calculate(qs, answers, careers, {
      ...survey,
      answers: { values: "creativity", team: "team", environment: "indoor" },
    });
    expect(r.top.every((c) => c.components.bonus <= 5 && c.index <= 100)).toBe(
      true,
    );
  });
});
describe("authorization", () => {
  const student = { id: "student", org: "a", classId: "9a" },
    classes = [
      { id: "9a", teacherId: "teacher" },
      { id: "10b", teacherId: "other" },
    ];
  it("allows only self, current class teacher, or own specialist", () => {
    expect(
      canViewStudent(
        { id: "student", org: "a", role: "student" },
        student,
        classes,
      ),
    ).toBe(true);
    expect(
      canViewStudent(
        { id: "teacher", org: "a", role: "teacher" },
        student,
        classes,
      ),
    ).toBe(true);
    expect(
      canViewStudent(
        { id: "prof", org: "a", role: "specialist" },
        student,
        classes,
      ),
    ).toBe(true);
    expect(
      canViewStudent(
        { id: "other", org: "a", role: "student" },
        student,
        classes,
      ),
    ).toBe(false);
    expect(
      canViewStudent(
        { id: "other", org: "a", role: "teacher" },
        student,
        classes,
      ),
    ).toBe(false);
    expect(
      canViewStudent(
        { id: "prof", org: "b", role: "specialist" },
        student,
        classes,
      ),
    ).toBe(false);
    expect(
      canViewStudent(
        { id: "admin", org: null, role: "superadmin" },
        student,
        classes,
      ),
    ).toBe(false);
  });
});
