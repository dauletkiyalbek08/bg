import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { transaction, demoEnabled, isSupabase, isNetlify } from "./store";
import { hashPassword } from "./auth";
import { makeQuestions, makeCareers } from "./content";
import { buildTest, calculate } from "./scoring";
import type { User, Survey } from "./types";
let ready: Promise<void> | undefined;
export function ensureSeed() {
  if (!ready)
    ready = seedWithContentionRetry().catch((e) => {
      ready = undefined;
      throw e;
    });
  return ready;
}
async function seedWithContentionRetry() {
  for (let attempt = 0; ; attempt++) {
    try {
      return await seed();
    } catch (e) {
      if (
        !isNetlify() ||
        attempt >= 3 ||
        !(e instanceof Error) ||
        !e.message.includes("Дерек өзгерді")
      )
        throw e;
    }
  }
}
async function seed() {
  if (isSupabase()) return;
  if (!demoEnabled()) return;
  await transaction(async (s) => {
    if ((await s.all("organizations")).length) return;
    const org = "demo-school";
    await s.put("organizations", {
      id: org,
      name: "Bagdar демо мектеп",
      city: "Алматы",
      status: "active",
      limit: 1000,
    });
    await s.put("organizations", {
      id: "other-school",
      name: "Екінші демо мектеп",
      city: "Астана",
      status: "active",
      limit: 100,
    });
    const specs: [string, string, User["role"], string | null][] = [
      ["superadmin", "Платформа әкімшісі", "superadmin", null],
      ["prof.demo", "Айдана Мұратқызы", "specialist", null],
      ["teacher.9a", "Әлия Серікқызы", "teacher", "9a"],
      ["teacher.10b", "Марат Асқарұлы", "teacher", "10b"],
      ["student01", "Айгерім Сейітова", "student", "9a"],
      ["student02", "Нұрлан Әбенов", "student", "9a"],
      ["student03", "Дана Қасымова", "student", "9a"],
      ["student04", "Ерасыл Төлегенов", "student", "10b"],
      ["student05", "Әсем Жұмабаева", "student", "10b"],
      ["student06", "Арман Бекболатов", "student", "10b"],
    ];
    const creds = [];
    for (const [login, name, role, classId] of specs) {
      const password = randomBytes(16).toString("base64url");
      await s.put("users", {
        id: login,
        org: role === "superadmin" ? null : org,
        classId,
        name,
        login,
        role,
        blocked: false,
        mustChange: false,
        hash: hashPassword(password),
      });
      creds.push({ login, password });
    }
    await s.put("users", {
      id: "other-student",
      org: "other-school",
      name: "Сынақ оқушысы",
      login: "other.student",
      role: "student",
      classId: "other-class",
      blocked: false,
      mustChange: true,
      hash: hashPassword(randomBytes(24).toString("hex")),
    });
    await s.put("classes", {
      id: "other-class",
      org: "other-school",
      name: "9 «А»",
      teacherId: null,
    });
    await s.put("classes", {
      id: "9a",
      org,
      name: "9 «А»",
      teacherId: "teacher.9a",
    });
    await s.put("classes", {
      id: "10b",
      org,
      name: "10 «Б»",
      teacherId: "teacher.10b",
    });
    const questions = makeQuestions(),
      careers = makeCareers();
    for (const q of questions) await s.put("questions", q);
    for (const c of careers) await s.put("careers", c);
    await s.put("assignments", {
      id: "demo-assignment",
      org,
      title: "Өз бағытыңды тап",
      recipients: specs.filter((x) => x[2] === "student").map((x) => x[0]),
      classId: null,
      createdAt: new Date().toISOString(),
      closesAt: null,
      maxAttempts: 1,
    });
    for (let i = 1; i <= 4; i++) {
      const owner = "student0" + i;
      const survey: Survey = {
        id: owner,
        org,
        owner,
        complete: true,
        updatedAt: new Date().toISOString(),
        answers: {
          hobbies: ["Сурет салу", "Тәжірибе жасау", "Спорт", "Кітап оқу"][
            i - 1
          ],
          values: "creativity",
          team: "team",
          environment: "indoor",
        },
      };
      await s.put("surveys", survey);
      const qs = buildTest(questions);
      const answers = Object.fromEntries(
        qs.map((q) => [
          q.id,
          ((q.id.length + i + q.scale.charCodeAt(0)) % 5) + 1,
        ]),
      );
      const result = calculate(
        qs,
        answers,
        careers,
        survey,
        Object.fromEntries(qs.map((q) => [q.id, 6000])),
      );
      await s.put("attempts", {
        id: "demo-attempt-" + i,
        org,
        owner,
        assignmentId: "demo-assignment",
        questions: qs,
        survey,
        answers,
        timings: {},
        status: "completed",
        version: 1,
        createdAt: result.completedAt,
        completedAt: result.completedAt,
        result,
      });
    }
    for (const [i, title, days] of [
      [1, "Өзіңді таны: қызығушылықтар картасы", -7],
      [2, "Болашақ мамандықтар зертханасы", 7],
      [3, "Командада жұмыс істеу дағдылары", 14],
    ] as const)
      await s.put("trainings", {
        id: "training-" + i,
        org,
        title,
        description:
          "Қызығушылықтарыңды зерттеп, шағын топта тәжірибе жасап көр. Бірге талқылап, өзіңе жаңа мүмкіндік аш.",
        date: new Date(Date.now() + days * 86400000).toISOString(),
        classIds: ["9a", "10b"],
        url: "",
        status: "published",
        attendance: {},
      });
    if (!isNetlify()) {
      const dir = process.env.BAGDAR_DATA_DIR || join(process.cwd(), ".data");
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      writeFileSync(
        join(dir, "demo-credentials.json"),
        JSON.stringify(creds, null, 2),
        { mode: 0o600 },
      );
    }
  });
}
