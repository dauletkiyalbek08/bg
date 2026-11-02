import { randomInt } from "node:crypto";
import { scales, labels } from "./content";
import type { Question, Career, Survey, AssessmentResult } from "./types";
export function buildTest(
  bank: Question[],
  history: Question[][] = [],
): Question[] {
  const seen = new Map<string, number>();
  const extra: Record<string, number> = {};
  history.forEach((qs) => {
    qs.forEach((q) => seen.set(q.id, (seen.get(q.id) || 0) + 1));
    scales.klimov.forEach((k) => {
      extra[k] =
        (extra[k] || 0) +
        Math.max(0, qs.filter((q) => q.scale === k).length - 2);
    });
  });
  const extraScales = shuffle(
    [...scales.klimov].filter(
      (scale) =>
        bank.filter(
          (q) => q.active && q.scale === scale && q.family === "klimov",
        ).length >= 3,
    ),
  )
    .sort((a, b) => (extra[a] || 0) - (extra[b] || 0))
    .slice(0, 2);
  if (extraScales.length < 2)
    throw new Error("Кәсіби бағыттар бойынша сұрақтар жеткіліксіз");
  const out: Question[] = [];
  Object.entries(scales).forEach(([family, keys]) =>
    keys.forEach((scale) => {
      const n =
        family === "klimov" &&
        extraScales.includes(scale as (typeof extraScales)[number])
          ? 3
          : 2;
      const pool = bank.filter(
        (q) => q.active && q.family === family && q.scale === scale,
      );
      shuffle(pool);
      pool.sort((a, b) => (seen.get(a.id) || 0) - (seen.get(b.id) || 0));
      if (pool.length < n)
        throw new Error(`${labels[scale]}: сұрақтар жеткіліксіз`);
      out.push(...pool.slice(0, n));
    }),
  );
  return shuffle(out);
}
function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
export function calculate(
  questions: Question[],
  answers: Record<string, number>,
  careers: Career[],
  survey: Survey,
  timings: Record<string, number> = {},
): AssessmentResult {
  if (
    questions.length !== 36 ||
    new Set(questions.map((q) => q.id)).size !== 36
  )
    throw new Error("Сұрақтар жиыны толық емес");
  const scores: Record<string, number> = {};
  Object.values(scales)
    .flat()
    .forEach((scale) => {
      const qs = questions.filter((q) => q.scale === scale);
      if (!qs.length) throw new Error("Шкала толық емес");
      scores[scale] =
        (100 *
          qs.reduce((sum, q) => {
            const v = answers[q.id];
            if (!Number.isInteger(v) || v < 1 || v > 5)
              throw new Error("Барлық сұраққа жауап беріңіз");
            const norm = (v - 1) / 4;
            return sum + (q.reverse ? 1 - norm : norm);
          }, 0)) /
        qs.length;
    });
  const top = careers
    .filter((c) => c.active)
    .map((c) => {
      const components: Record<string, number> = {};
      for (const [family, keys] of Object.entries(scales)) {
        components[family] =
          100 -
          keys.reduce((s, k) => s + Math.abs(scores[k] - c.targets[k]), 0) /
            keys.length;
      }
      const preferences = ["values", "team", "environment"]
        .map((k) => survey.answers[k])
        .map((v) => (Array.isArray(v) ? v : [v]))
        .map((g) => g.filter((v) => !!v && v !== "unknown"));
      const filled = preferences.filter((g) => g.length);
      const bonus = filled.length
        ? (5 *
            filled.reduce(
              (a, g) =>
                a + g.filter((t) => c.tags.includes(t)).length / g.length,
              0,
            )) /
          filled.length
        : 0;
      components.bonus = bonus;
      const index = Math.min(
        100,
        components.riasec * 0.5 +
          components.klimov * 0.25 +
          components.skills * 0.25 +
          bonus,
      );
      const matching = Object.keys(scores).sort(
        (a, b) =>
          Math.abs(scores[a] - c.targets[a]) -
          Math.abs(scores[b] - c.targets[b]),
      );
      return {
        id: c.id,
        name: c.name,
        index,
        reasons: [
          `${labels[matching[0]]} бағыты бойынша жауаптарың ұқсас.`,
          `${labels[matching[1]]} бағытын осы мамандықта зерттеп көруге болады.`,
          "Қажетті дағдыларды шағын жобалар арқылы дамыта аласың.",
        ],
        components,
      };
    })
    .sort((a, b) => b.index - a.index || a.id.localeCompare(b.id))
    .slice(0, 5);
  const flags: string[] = [];
  if (new Set(questions.map((q) => answers[q.id])).size === 1)
    flags.push("uniform_responses");
  if (
    questions.filter((q) => timings[q.id] !== undefined && timings[q.id] < 2000)
      .length >= 18
  )
    flags.push("very_fast");
  if (!Object.keys(timings).length) flags.push("timing_unavailable");
  return {
    scores,
    top,
    flags,
    methodology: "bagdar-author-1.0",
    completedAt: new Date().toISOString(),
  };
}
export function canViewStudent(
  actor: { role: string; id: string; org: string | null },
  student: { id: string; org: string | null; classId: string | null },
  classes: { id: string; teacherId: string | null }[],
) {
  return (
    actor.org === student.org &&
    (actor.role === "specialist" ||
      (actor.role === "student" && actor.id === student.id) ||
      (actor.role === "teacher" &&
        classes.some(
          (c) => c.id === student.classId && c.teacherId === actor.id,
        )))
  );
}
