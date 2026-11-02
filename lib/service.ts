import { randomUUID, randomBytes } from "node:crypto";
import { z } from "zod";
import { Store, adminClient, isSupabase } from "./store";
import { safeUser, hashPassword } from "./auth";
import { buildTest, calculate, canViewStudent } from "./scoring";
import type { User, Question, Career } from "./types";
export class HttpError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function requireRole(u: User, ...roles: User["role"][]) {
  if (!roles.includes(u.role))
    throw new HttpError("Бұл әрекетке рұқсатыңыз жоқ", 403);
}
export async function studentAccess(s: Store, u: User, id: string) {
  const student = await s.get("users", id);
  if (
    !student ||
    student.role !== "student" ||
    !canViewStudent(u, student, await s.all("classes"))
  )
    throw new HttpError("Бұл нәтижеге рұқсатыңыз жоқ", 403);
  return student;
}
export async function writable(s: Store, u: User) {
  if (u.mustChange) throw new HttpError("Алдымен құпиясөзді өзгертіңіз", 403);
  if (u.org && (await s.get("organizations", u.org))?.status !== "active")
    throw new HttpError(
      "Ұйымның жазылымы тоқтатылған. Жауапты маманға хабарласыңыз",
      403,
    );
}
const text = (v: unknown, min = 1, max = 1000) =>
  z.string().trim().min(min).max(max).parse(v);
const sid = (v: unknown) => text(v, 1, 100);
export async function getState(s: Store, u: User) {
  if (u.mustChange)
    return {
      user: safeUser(u),
      demo: !isSupabase(),
      organization: null,
      organizations: [],
      users: [],
      classes: [],
      attempts: [],
      surveys: [],
      comments: [],
      careers: [],
      questions: [],
      assignments: [],
      trainings: [],
      materials: [],
      feedback: [],
      favorites: [],
      audit: [],
    };
  const classes = (await s.all("classes")).filter(
    (c) =>
      c.org === u.org &&
      (u.role === "student"
        ? c.id === u.classId
        : u.role !== "teacher" || c.teacherId === u.id),
  );
  const users = (await s.all("users")).filter((x) =>
    u.role === "superadmin"
      ? x.role === "specialist"
      : x.org === u.org &&
        (u.role === "student"
          ? x.id === u.id
          : u.role === "teacher"
            ? x.id === u.id || classes.some((c) => c.id === x.classId)
            : true),
  );
  const ids = new Set(
    users.filter((x) => x.role === "student").map((x) => x.id),
  );
  const attempts = (await s.all("attempts")).filter((a) => ids.has(a.owner));
  const surveys = (await s.all("surveys"))
    .filter((x) => ids.has(x.owner))
    .map((survey) => {
      if (u.role !== "teacher") return survey;
      return {
        ...survey,
        answers: Object.fromEntries(
          Object.entries(survey.answers).filter(
            ([k]) =>
              ![
                "private",
                "hobbies",
                "free",
                "clubs",
                "dream",
                "interest",
                "learning",
                "easy",
                "develop",
              ].includes(k),
          ),
        ),
      };
    });
  const stateTrainingClasses = new Map(
    (await s.all("trainings"))
      .filter((t) => t.org === u.org)
      .map((t) => [t.id, t.classIds]),
  );
  const comments = (await s.all("comments")).filter(
    (c) =>
      ids.has(c.owner) && (u.role !== "student" || c.visibility === "student"),
  );
  return {
    user: safeUser(u),
    demo: !isSupabase(),
    organization: u.org ? await s.get("organizations", u.org) : null,
    organizations: u.role === "superadmin" ? await s.all("organizations") : [],
    users: users.map(safeUser),
    classes,
    attempts: attempts.map((a) => ({
      ...a,
      ...(u.role === "teacher"
        ? { questions: [], answers: {}, timings: {} }
        : {}),
      survey:
        u.role === "teacher"
          ? {
              ...a.survey,
              answers: Object.fromEntries(
                Object.entries(a.survey.answers).filter(([k]) =>
                  ["values", "team", "environment"].includes(k),
                ),
              ),
            }
          : a.survey,
    })),
    surveys,
    comments,
    careers: (await s.all("careers")).filter(
      (c) =>
        (!c.org || c.org === u.org) &&
        (c.active || u.role === "specialist" || u.role === "superadmin"),
    ),
    questions: ["specialist", "superadmin"].includes(u.role)
      ? (await s.all("questions")).filter((q) => !q.org || q.org === u.org)
      : [],
    assignments: (await s.all("assignments")).filter(
      (a) =>
        a.org === u.org &&
        (u.role === "specialist" || a.recipients.some((id) => ids.has(id))),
    ),
    trainings: (await s.all("trainings"))
      .filter(
        (t) =>
          t.org === u.org &&
          (u.role === "specialist" ||
            t.classIds.some((id) => classes.some((c) => c.id === id)) ||
            (u.role === "student" &&
              !!u.classId &&
              t.classIds.includes(u.classId))),
      )
      .map((t) => ({
        ...t,
        attendance:
          u.role === "student" ? { [u.id]: t.attendance[u.id] } : t.attendance,
      })),
    materials: (await s.all("materials")).filter(
      (m) =>
        m.org === u.org &&
        (u.role === "specialist" ||
          (u.role === "teacher"
            ? classes.some(
                (c) =>
                  c.org === m.org &&
                  (stateTrainingClasses.get(m.trainingId) || []).includes(c.id),
              )
            : !!u.classId &&
              (stateTrainingClasses.get(m.trainingId) || []).includes(
                u.classId,
              ))),
    ),
    feedback: (await s.all("feedback")).filter(
      (f) => ids.has(f.owner) && (u.role !== "student" || f.owner === u.id),
    ),
    favorites: (await s.all("favorites")).filter((f) => f.owner === u.id),
    audit: ["specialist", "superadmin"].includes(u.role)
      ? (await s.all("audit"))
          .filter((a) => u.role === "superadmin" || a.org === u.org)
          .slice(-50)
          .reverse()
      : [],
  };
}
export async function createAccount(
  s: Store,
  actor: User,
  input: Record<string, unknown>,
) {
  requireRole(actor, "specialist", "superadmin");
  const role = z.enum(["student", "teacher", "specialist"]).parse(input.role);
  if (actor.role === "specialist" && role === "specialist")
    throw new HttpError("Маман аккаунтын платформа әкімшісі жасайды", 403);
  if (actor.role === "superadmin" && role !== "specialist")
    throw new HttpError("Оқушыны ұйым маманы қосады", 403);
  const orgId = actor.org || sid(input.org);
  const org = await s.get("organizations", orgId);
  if (!org || org.status !== "active")
    throw new HttpError("Ұйым белсенді емес");
  let login = input.login
    ? text(input.login, 3, 40).toLowerCase()
    : `${orgId.slice(0, 5)}.${randomBytes(4).toString("hex")}`;
  login = z
    .string()
    .regex(/^[a-z0-9._-]{3,40}$/)
    .parse(login);
  const users = await s.all("users");
  if (users.some((u) => u.login === login))
    throw new HttpError("Бұл логин қолданылып жүр");
  if (
    role === "student" &&
    users.filter((u) => u.org === orgId && u.role === "student" && !u.blocked)
      .length >= org.limit
  )
    throw new HttpError("Оқушылар лимиті аяқталды");
  const classId =
    role === "student" && input.classId ? sid(input.classId) : null;
  if (classId && (await s.get("classes", classId))?.org !== orgId)
    throw new HttpError("Сынып табылмады");
  const password = randomBytes(18).toString("base64url");
  const user: User = {
    id: randomUUID(),
    name: text(input.name, 2, 100),
    login,
    role,
    org: orgId,
    classId,
    blocked: false,
    mustChange: true,
  };
  if (isSupabase()) {
    const { data, error } = await adminClient().auth.admin.createUser({
      email: `${login}@accounts.bagdar.invalid`,
      password,
      email_confirm: true,
    });
    if (error) throw new HttpError("Аккаунтты жасау мүмкін болмады");
    user.id = data.user.id;
    user.authId = data.user.id;
    s.onRollback(async () => {
      const { error } = await adminClient().auth.admin.deleteUser(user.id);
      if (error) throw error;
    });
  } else user.hash = hashPassword(password);
  await s.put("users", user);
  await s.put("organizations", org);
  return { user: safeUser(user), credentials: { login, password } };
}
export async function perform(s: Store, u: User, b: Record<string, unknown>) {
  const action = sid(b.action);
  if (action === "password") {
    const password = text(b.password, 12, 128);
    if (isSupabase()) {
      const { error } = await adminClient().auth.admin.updateUserById(
        u.authId || u.id,
        { password },
      );
      if (error) throw new HttpError("Құпиясөз сақталмады");
    } else u.hash = hashPassword(password);
    u.mustChange = false;
    await s.put("users", u);
    for (const sess of (await s.all("sessions")).filter(
      (x) => x.userId === u.id,
    ))
      await s.delete("sessions", sess.id);
    return { relogin: true };
  }
  await writable(s, u);
  let result: unknown = { ok: true };
  if (action === "survey") {
    requireRole(u, "student");
    const answers = z
      .record(
        z.string(),
        z.union([z.string().max(2000), z.array(z.string().max(100)).max(3)]),
      )
      .parse(b.answers);
    const complete = b.complete === true;
    if (complete && b.consent !== true)
      throw new HttpError("Деректерді өңдеу шарттарымен танысыңыз");
    await s.put("surveys", {
      id: u.id,
      org: u.org!,
      owner: u.id,
      answers,
      complete,
      updatedAt: new Date().toISOString(),
    });
  } else if (action === "start") {
    requireRole(u, "student");
    const assignment = await s.get("assignments", sid(b.assignmentId));
    if (
      !assignment ||
      assignment.org !== u.org ||
      !assignment.recipients.includes(u.id)
    )
      throw new HttpError("Тест тағайындалмаған", 403);
    if (assignment.closesAt && new Date(assignment.closesAt) < new Date())
      throw new HttpError("Тест мерзімі аяқталды");
    const own = (await s.all("attempts")).filter(
      (a) => a.owner === u.id && a.assignmentId === assignment.id,
    );
    const active = own.find((a) => a.status === "active");
    if (active) return { attemptId: active.id };
    if (own.length >= assignment.maxAttempts)
      throw new HttpError("Қайта тапсыруға маманның рұқсаты қажет");
    const survey = await s.get("surveys", u.id);
    if (!survey?.complete)
      throw new HttpError("Алдымен сауалнаманы толтырыңыз");
    const qs = (await s.all("questions")).filter(
      (q) => !q.org || q.org === u.org,
    );
    let questions: Question[];
    try {
      questions = buildTest(
        qs,
        own.map((a) => a.questions),
      );
    } catch (e) {
      throw new HttpError((e as Error).message);
    }
    const id = randomUUID();
    await s.put("attempts", {
      id,
      org: u.org!,
      owner: u.id,
      assignmentId: assignment.id,
      questions,
      survey,
      answers: {},
      timings: {},
      status: "active",
      version: 1,
      createdAt: new Date().toISOString(),
    });
    result = { attemptId: id };
  } else if (action === "answer" || action === "finish") {
    requireRole(u, "student");
    const a = await s.get("attempts", sid(b.attemptId));
    if (!a || a.owner !== u.id || a.org !== u.org)
      throw new HttpError("Тест табылмады", 403);
    if (a.status === "completed") {
      if (action === "finish") return { result: a.result };
      throw new HttpError("Тест аяқталған");
    }
    const assignment = await s.get("assignments", a.assignmentId);
    if (assignment?.closesAt && new Date(assignment.closesAt) < new Date())
      throw new HttpError("Тест мерзімі аяқталды");
    if (action === "answer") {
      if (b.version !== a.version)
        throw new HttpError(
          "Жауаптар басқа терезеде өзгерді. Бетті жаңартыңыз",
          409,
        );
      const qid = sid(b.questionId);
      if (!a.questions.some((q) => q.id === qid))
        throw new HttpError("Сұрақ бұл тестке кірмейді");
      a.answers[qid] = z.number().int().min(1).max(5).parse(b.value);
      if (b.elapsed !== undefined)
        a.timings[qid] = Math.min(
          3600000,
          (a.timings[qid] || 0) +
            z.number().min(0).max(3600000).parse(b.elapsed),
        );
      a.version++;
      result = { version: a.version };
    } else {
      if (a.questions.some((q) => !a.answers[q.id]))
        throw new HttpError("Барлық сұраққа жауап беріңіз");
      a.result = calculate(
        a.questions,
        a.answers,
        (await s.all("careers")).filter((c) => !c.org || c.org === u.org),
        a.survey,
        a.timings,
      );
      a.status = "completed";
      a.completedAt = a.result.completedAt;
      result = { result: a.result };
    }
    await s.put("attempts", a);
  } else if (action === "favorite") {
    requireRole(u, "student");
    const career = await s.get("careers", sid(b.careerId));
    if (!career || !career.active || (career.org && career.org !== u.org))
      throw new HttpError("Мамандық табылмады");
    const id = u.id + ":" + career.id;
    if (await s.get("favorites", id)) await s.delete("favorites", id);
    else
      await s.put("favorites", {
        id,
        org: u.org!,
        owner: u.id,
        careerId: career.id,
      });
  } else if (action === "comment") {
    requireRole(u, "teacher", "specialist");
    const owner = sid(b.owner);
    await studentAccess(s, u, owner);
    await s.put("comments", {
      id: randomUUID(),
      org: u.org!,
      owner,
      authorId: u.id,
      authorName: u.name,
      text: text(b.text, 1, 2000),
      visibility: z.enum(["student", "staff"]).parse(b.visibility),
      createdAt: new Date().toISOString(),
    });
  } else if (action === "user-create") result = await createAccount(s, u, b);
  else if (action === "user-update" || action === "user-reset") {
    requireRole(u, "specialist", "superadmin");
    const target = await s.get("users", sid(b.id));
    if (
      !target ||
      target.id === u.id ||
      target.role === "superadmin" ||
      (u.role === "specialist" &&
        (target.org !== u.org || target.role === "specialist")) ||
      (u.role === "superadmin" && target.role !== "specialist")
    )
      throw new HttpError("Рұқсат жоқ", 403);
    if (action === "user-reset") {
      const password = randomBytes(18).toString("base64url");
      if (isSupabase()) {
        const { error } = await adminClient().auth.admin.updateUserById(
          target.authId || target.id,
          { password },
        );
        if (error) throw new HttpError("Құпиясөз өзгермеді");
      } else target.hash = hashPassword(password);
      target.mustChange = true;
      result = { credentials: { login: target.login, password } };
    } else {
      if (b.blocked !== undefined) {
        const blocked = z.boolean().parse(b.blocked);
        if (!blocked && target.blocked && target.role === "student") {
          const org = await s.get("organizations", target.org!);
          const count = (await s.all("users")).filter(
            (x) => x.org === target.org && x.role === "student" && !x.blocked,
          ).length;
          if (!org || count >= org.limit) throw new HttpError("Лимит аяқталды");
          await s.put("organizations", org);
        }
        target.blocked = blocked;
      }
      if (b.classId !== undefined && target.role === "student") {
        const cl = await s.get("classes", sid(b.classId));
        if (!cl || cl.org !== target.org)
          throw new HttpError("Сынып табылмады");
        target.classId = cl.id;
      }
    }
    await s.put("users", target);
    for (const sess of (await s.all("sessions")).filter(
      (x) => x.userId === target.id,
    ))
      await s.delete("sessions", sess.id);
  } else if (action === "class") {
    requireRole(u, "specialist");
    const existing = b.id ? await s.get("classes", sid(b.id)) : null;
    if (existing && existing.org !== u.org)
      throw new HttpError("Рұқсат жоқ", 403);
    const teacherId = b.teacherId ? sid(b.teacherId) : null;
    if (teacherId) {
      const teacher = await s.get("users", teacherId);
      if (teacher?.org !== u.org || teacher.role !== "teacher")
        throw new HttpError("Сынып жетекшісі табылмады");
    }
    await s.put("classes", {
      id: existing?.id || randomUUID(),
      org: u.org!,
      name: text(b.name, 1, 80),
      teacherId,
    });
  } else if (action === "assign") {
    requireRole(u, "specialist");
    const classId = b.classId ? sid(b.classId) : null;
    const owner = b.owner ? sid(b.owner) : null;
    if (classId && (await s.get("classes", classId))?.org !== u.org)
      throw new HttpError("Сынып табылмады");
    const recipients = (await s.all("users"))
      .filter(
        (x) =>
          x.org === u.org &&
          x.role === "student" &&
          !x.blocked &&
          (owner ? x.id === owner : classId ? x.classId === classId : true),
      )
      .map((x) => x.id);
    if (!recipients.length) throw new HttpError("Алушылар табылмады");
    await s.put("assignments", {
      id: randomUUID(),
      org: u.org!,
      title: text(b.title, 2, 120),
      recipients,
      classId,
      createdAt: new Date().toISOString(),
      closesAt: b.closesAt ? z.iso.datetime().parse(b.closesAt) : null,
      maxAttempts: 1,
    });
  } else if (action === "retry") {
    requireRole(u, "specialist");
    const a = await s.get("assignments", sid(b.id));
    if (!a || a.org !== u.org) throw new HttpError("Тест табылмады");
    text(b.reason, 3, 500);
    a.maxAttempts++;
    await s.put("assignments", a);
  } else if (action === "training") {
    requireRole(u, "specialist");
    const classIds = z.array(z.string()).min(1).parse(b.classIds);
    const classes = await s.all("classes");
    if (
      classIds.some(
        (id) => !classes.some((c) => c.id === id && c.org === u.org),
      )
    )
      throw new HttpError("Сынып табылмады");
    const url = b.url ? z.url().startsWith("https://").parse(b.url) : "";
    await s.put("trainings", {
      id: randomUUID(),
      org: u.org!,
      title: text(b.title, 2, 150),
      description: text(b.description, 2, 3000),
      date: z.iso.datetime().parse(b.date),
      classIds,
      url,
      status: "published",
      attendance: {},
    });
  } else if (action === "training-cancel") {
    requireRole(u, "specialist");
    const t = await s.get("trainings", sid(b.id));
    if (!t || t.org !== u.org) throw new HttpError("Тренинг табылмады");
    t.status = "cancelled";
    await s.put("trainings", t);
  } else if (action === "feedback") {
    requireRole(u, "student");
    const t = await s.get("trainings", sid(b.trainingId));
    if (
      !t ||
      t.org !== u.org ||
      !u.classId ||
      !t.classIds.includes(u.classId) ||
      new Date(t.date) > new Date() ||
      t.status === "cancelled"
    )
      throw new HttpError("Пікір қалдыру қолжетімсіз");
    await s.put("feedback", {
      id: t.id + ":" + u.id,
      org: u.org!,
      owner: u.id,
      trainingId: t.id,
      rating: z.number().int().min(1).max(5).parse(b.rating),
      text: text(b.text || "—", 1, 1000),
      createdAt: new Date().toISOString(),
    });
  } else if (action === "attendance") {
    requireRole(u, "specialist");
    const t = await s.get("trainings", sid(b.id));
    const student = await studentAccess(s, u, sid(b.owner));
    if (
      !t ||
      t.org !== u.org ||
      !student.classId ||
      !t.classIds.includes(student.classId)
    )
      throw new HttpError("Қатысушы табылмады");
    t.attendance[student.id] = z
      .enum(["present", "absent", "excused", "unknown"])
      .parse(b.value);
    await s.put("trainings", t);
  } else if (action === "question") {
    requireRole(u, "specialist", "superadmin");
    const existing = b.id ? await s.get("questions", sid(b.id)) : undefined;
    if (
      existing &&
      (u.role === "specialist" ? existing.org !== u.org : existing.org !== null)
    )
      throw new HttpError(
        "Ортақ сұрақты көшіруге болады, өзгертуге болмайды",
        403,
      );
    const q: Question = {
      id: existing?.id || randomUUID(),
      org: u.role === "superadmin" ? null : u.org,
      text: text(b.text, 8, 1000),
      family: z.enum(["riasec", "klimov", "skills"]).parse(b.family),
      scale: text(b.scale, 1, 30),
      active: b.active !== false,
      reverse: b.reverse === true,
      version: (existing?.version || 0) + 1,
    };
    const { scales } = await import("./content");
    if (!(scales[q.family] as readonly string[]).includes(q.scale))
      throw new HttpError("Шкала сәйкес емес");
    await s.put("questions", q);
  } else if (action === "career") {
    requireRole(u, "specialist", "superadmin");
    const existing = b.id ? await s.get("careers", sid(b.id)) : undefined;
    if (
      existing &&
      (u.role === "specialist" ? existing.org !== u.org : existing.org !== null)
    )
      throw new HttpError("Ортақ мамандықты өзгертуге болмайды", 403);
    const { scales } = await import("./content");
    const targets: Record<string, number> = {};
    const incoming = z
      .record(z.string(), z.number().min(0).max(100))
      .parse(b.targets);
    for (const key of Object.values(scales).flat()) {
      if (incoming[key] === undefined)
        throw new HttpError("Барлық шкаланы толтырыңыз");
      targets[key] = incoming[key];
    }
    const c: Career = {
      id: existing?.id || randomUUID(),
      org: u.role === "superadmin" ? null : u.org,
      name: text(b.name, 2, 100),
      description: text(b.description, 10, 2000),
      task: text(b.task || b.description, 10, 2000),
      sector: text(b.sector, 2, 100),
      route: text(b.route, 3, 500),
      skills: z.array(z.string().max(100)).max(10).parse(b.skills),
      subjects: z.array(z.string().max(100)).max(10).parse(b.subjects),
      targets,
      tags: z
        .array(z.string().max(50))
        .max(20)
        .parse(b.tags || []),
      active: b.active !== false,
    };
    await s.put("careers", c);
  } else if (action === "organization") {
    requireRole(u, "superadmin");
    const existing = b.id ? await s.get("organizations", sid(b.id)) : null;
    await s.put("organizations", {
      id: existing?.id || randomUUID(),
      name: text(b.name, 2, 150),
      city: text(b.city || "—", 1, 100),
      limit: z.number().int().min(1).max(100000).parse(b.limit),
      status: z.enum(["active", "suspended", "archived"]).parse(b.status),
    });
  } else if (action === "import") {
    requireRole(u, "specialist");
    const rows = z
      .array(
        z.object({
          name: z.string().min(2).max(100),
          login: z.string().regex(/^[a-z0-9._-]{3,40}$/),
          classId: z.string(),
        }),
      )
      .min(1)
      .max(1000)
      .parse(b.rows);
    const key = sid(b.key);
    const id = u.org + ":" + key;
    if (await s.get("imports", id))
      throw new HttpError("Бұл импорт бұрын орындалған. Қайта импорттамаңыз");
    const creds = [];
    for (const row of rows) {
      const created = await createAccount(s, u, { ...row, role: "student" });
      creds.push(created.credentials);
    }
    await s.put("imports", {
      id,
      org: u.org!,
      actor: u.id,
      key,
      completed: true,
      rows,
    });
    result = { credentialsList: creds };
  } else throw new HttpError("Әрекет табылмады", 404);
  if (!["answer", "survey", "favorite"].includes(action))
    await s.put("audit", {
      id: randomUUID(),
      org: u.org,
      actor: u.id,
      action,
      createdAt: new Date().toISOString(),
    });
  return result;
}
